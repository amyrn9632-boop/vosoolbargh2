import "dotenv/config";
import express from "express";
import multer from "multer";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as store from "./db.js";
import { parseSpreadsheet, COLUMN_LABELS } from "./import.js";
import { sendBatch, applyTemplate, providerInfo, allProviderInfo } from "./messaging.js";
import { recognizeImage, ocrInfo } from "./ocr.js";
import { encrypt, decrypt, maskSecret } from "./secrets.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, "..", "public");
const PORT = Number(process.env.PORT || 3000);
const APP_PASSWORD = process.env.APP_PASSWORD || "1234";
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(24).toString("hex");
const SESSION_HOURS = Number(process.env.SESSION_HOURS || 72);
const COOKIE_SECURE = process.env.COOKIE_SECURE === "true";
const BODY_LIMIT = process.env.BODY_LIMIT || "5mb";
const MAX_UPLOAD_MB = Number(process.env.MAX_UPLOAD_MB || 25);
const MAX_AUDIO_MB = Number(process.env.MAX_AUDIO_MB || 15);

const app = express();
app.disable("x-powered-by");
if (process.env.TRUST_PROXY === "true") app.set("trust proxy", 1);

/* ---------- Security headers ---------- */

app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "same-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; img-src 'self' data: blob:; media-src 'self' blob:; " +
      "style-src 'self' 'unsafe-inline'; script-src 'self'; font-src 'self'; connect-src 'self'; " +
      "frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
  );
  next();
});

/** درخواست‌های تغییردهنده باید از همان میزبان باشند (محافظت ساده در برابر CSRF). */
app.use((req, res, next) => {
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) return next();
  const origin = req.headers.origin;
  if (!origin) return next();
  try {
    const parsed = new URL(origin);
    if (parsed.host !== req.headers.host) {
      return res.status(403).json({ error: "درخواست از منبع نامعتبر رد شد." });
    }
  } catch {
    return res.status(403).json({ error: "درخواست از منبع نامعتبر رد شد." });
  }
  return next();
});

app.use(express.json({ limit: BODY_LIMIT }));
app.use(express.urlencoded({ extended: true, limit: BODY_LIMIT }));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_MB * 1024 * 1024 },
});

const audioUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_AUDIO_MB * 1024 * 1024 },
});

function publicBaseUrl(req) {
  const configured = (store.getSetting("public_base_url") || process.env.PUBLIC_BASE_URL || "").trim();
  if (configured) return configured.replace(/\/+$/, "");
  return `${req.protocol}://${req.get("host")}`;
}

function voiceSignature(id) {
  return crypto.createHmac("sha256", SESSION_SECRET).update(`voice:${id}`).digest("hex").slice(0, 24);
}

function voiceUrl(req, sample) {
  return `${publicBaseUrl(req)}/media/voice/${sample.id}?s=${voiceSignature(sample.id)}`;
}

/* ---------- Session ---------- */

function sign(value) {
  return crypto.createHmac("sha256", SESSION_SECRET).update(value).digest("base64url");
}

function createToken() {
  const exp = Date.now() + SESSION_HOURS * 3600 * 1000;
  const payload = `ok.${exp}`;
  return `${payload}.${sign(payload)}`;
}

function verifyToken(token) {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [state, exp, sig] = parts;
  if (state !== "ok") return false;
  if (Number(exp) < Date.now()) return false;
  const expected = sign(`${state}.${exp}`);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function readCookie(req, name) {
  const raw = req.headers.cookie || "";
  const found = raw.split(";").map((s) => s.trim()).find((s) => s.startsWith(name + "="));
  return found ? decodeURIComponent(found.slice(name.length + 1)) : "";
}

function setSessionCookie(res, token) {
  const maxAge = SESSION_HOURS * 3600;
  const parts = [
    `vosol_session=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAge}`,
  ];
  if (COOKIE_SECURE) parts.push("Secure");
  res.setHeader("Set-Cookie", parts.join("; "));
}

function clearSessionCookie(res) {
  const parts = ["vosol_session=", "Path=/", "HttpOnly", "SameSite=Lax", "Max-Age=0"];
  if (COOKIE_SECURE) parts.push("Secure");
  res.setHeader("Set-Cookie", parts.join("; "));
}

function matchSecret(given, expected) {
  if (!given || !expected) return false;
  const a = Buffer.from(String(given));
  const b = Buffer.from(String(expected));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function externalApiKey() {
  if (process.env.API_KEY) return process.env.API_KEY;
  return decrypt(store.getSetting("external_api_key") || "");
}

function requireAuth(req, res, next) {
  const key = externalApiKey();
  if (key && matchSecret(req.headers["x-api-key"], key)) return next();
  const token = readCookie(req, "vosol_session");
  if (verifyToken(token)) return next();
  res.status(401).json({ error: "برای ادامه وارد شوید." });
}

/** محدودیت نرخ ساده برای جلوگیری از بار زیاد روی API. */
const apiHits = new Map();
function apiRateLimit(req, res, next) {
  const ip = req.ip || "unknown";
  const now = Date.now();
  const record = apiHits.get(ip) || { count: 0, first: now };
  if (now - record.first > 60 * 1000) {
    record.count = 0;
    record.first = now;
  }
  record.count += 1;
  apiHits.set(ip, record);
  if (apiHits.size > 5000) apiHits.clear();
  if (record.count > 1500) {
    return res.status(429).json({ error: "تعداد درخواست‌ها زیاد است؛ کمی بعد تلاش کنید." });
  }
  return next();
}

const loginAttempts = new Map();

app.post("/api/login", (req, res) => {
  const ip = req.ip || "unknown";
  const now = Date.now();
  const record = loginAttempts.get(ip) || { count: 0, first: now };
  if (now - record.first > 15 * 60 * 1000) {
    record.count = 0;
    record.first = now;
  }
  if (record.count >= 10) {
    return res.status(429).json({ error: "تلاش‌های ناموفق زیاد بود. ۱۵ دقیقه بعد تلاش کنید." });
  }

  const password = String(req.body?.password || "");
  const ok = matchSecret(password, APP_PASSWORD);

  if (!ok) {
    record.count += 1;
    loginAttempts.set(ip, record);
    return res.status(401).json({ error: "رمز عبور نادرست است." });
  }

  loginAttempts.delete(ip);
  setSessionCookie(res, createToken());
  res.json({ ok: true });
});

app.post("/api/logout", (req, res) => {
  clearSessionCookie(res);
  res.json({ ok: true });
});

app.get("/api/me", (req, res) => {
  res.json({ authenticated: verifyToken(readCookie(req, "vosol_session")) });
});

app.get("/api/healthz", (req, res) => {
  res.json({ ok: true, uptime: process.uptime(), time: new Date().toISOString() });
});

/* ---------- Protected API ---------- */

const api = express.Router();
api.use(apiRateLimit);
api.use(requireAuth);

api.get("/meta", (req, res) => {
  res.json({
    providers: allProviderInfo(),
    sms: providerInfo("sms"),
    voice: providerInfo("voice"),
    ocr: ocrInfo(),
    maxUploadMb: MAX_UPLOAD_MB,
    maxAudioMb: MAX_AUDIO_MB,
    columns: COLUMN_LABELS,
  });
});

api.get("/stats", (req, res) => {
  const regionId = req.query.regionId ? Number(req.query.regionId) : null;
  res.json({
    stats: store.stats(regionId),
    sends: store.listSends(6),
    top: store.topDebtors(5, regionId),
  });
});

/* ----- Regions ----- */

api.get("/regions", (req, res) => {
  res.json({ regions: store.listRegions() });
});

api.post("/regions", (req, res) => {
  const number = Number(req.body?.number);
  const name = String(req.body?.name || "").trim();
  if (!number || number <= 0) return res.status(400).json({ error: "شماره منطقه نامعتبر است." });
  if (!name) return res.status(400).json({ error: "نام منطقه را وارد کنید." });
  if (store.getRegion(number)) return res.status(409).json({ error: "منطقه‌ای با این شماره وجود دارد." });
  res.status(201).json({ region: store.createRegion(number, name) });
});

/* ----- Roozkars ----- */

api.get("/roozkars", (req, res) => {
  const regionId = req.query.regionId ? Number(req.query.regionId) : null;
  res.json({ roozkars: store.listRoozkars(regionId) });
});

api.post("/roozkars", (req, res) => {
  const number = Number(req.body?.number);
  const name = String(req.body?.name || "").trim();
  const regionId = req.body?.regionId ? Number(req.body.regionId) : null;
  if (!number || number <= 0) return res.status(400).json({ error: "شماره روزکار نامعتبر است." });
  if (!name) return res.status(400).json({ error: "نام منطقه را وارد کنید." });
  if (regionId && !store.getRegion(regionId)) return res.status(400).json({ error: "منطقه پیدا نشد." });
  if (store.getRoozkarByNumber(number, regionId)) {
    return res.status(409).json({ error: "روزکاری با این شماره در همین منطقه وجود دارد." });
  }
  res.status(201).json({ roozkar: store.createRoozkar(number, name, regionId) });
});

/* ----- Search ----- */

api.get("/search", (req, res) => {
  const regionId = req.query.regionId ? Number(req.query.regionId) : null;
  res.json(store.searchSubscribers({
    q: req.query.q,
    regionId,
    limit: req.query.limit,
  }));
});

api.get("/roozkars/:id", (req, res) => {
  const roozkar = store.getRoozkar(req.params.id);
  if (!roozkar) return res.status(404).json({ error: "روزکار پیدا نشد." });
  res.json({ roozkar, imports: store.listImports(roozkar.id) });
});

api.get("/roozkars/:id/subscribers", (req, res) => {
  const result = store.listSubscribers({
    roozkarId: req.params.id,
    importId: req.query.import,
    q: req.query.q,
    debt: req.query.debt,
    status: req.query.status,
    page: req.query.page,
    pageSize: req.query.pageSize,
  });
  res.json(result);
});

api.post("/roozkars/:id/subscribers", (req, res) => {
  const roozkar = store.getRoozkar(req.params.id);
  if (!roozkar) return res.status(404).json({ error: "روزکار پیدا نشد." });
  if (!String(req.body?.name || "").trim()) {
    return res.status(400).json({ error: "نام مشترک را وارد کنید." });
  }
  let activeId = roozkar.active_import_id;
  if (activeId == null) {
    const imp = store.createImport(roozkar.id, "ورود دستی", null, 0, "manual");
    store.setActiveImport(roozkar.id, imp.id);
    activeId = imp.id;
  }
  const sub = store.addSubscriber(roozkar.id, req.body);
  res.status(201).json({ subscriber: sub });
});

api.delete("/subscribers/:id", (req, res) => {
  const removed = store.deleteSubscriber(req.params.id);
  if (!removed) return res.status(404).json({ error: "مشترک پیدا نشد." });
  res.json({ ok: true });
});

/* ----- Import ----- */

const previewCache = new Map();
const PREVIEW_TTL = 60 * 60 * 1000;

function previewFile(token) {
  return path.join(store.UPLOAD_DIR, `${token}.preview.json`);
}

function dropPreview(token) {
  const entry = previewCache.get(token);
  previewCache.delete(token);
  if (entry) {
    try { fs.rmSync(entry.file, { force: true }); } catch { /* ignore */ }
  }
}

/**
 * ردیف‌های کامل روی دیسک نگهداری می‌شوند تا فایل‌های ۱۲۰ هزار ردیفی
 * حافظه‌ی سرور را اشغال نکنند؛ فقط متادیتا در حافظه می‌ماند.
 */
function cachePreview(token, parsed) {
  const file = previewFile(token);
  fs.writeFileSync(file, JSON.stringify(parsed));

  const meta = { ...parsed };
  delete meta.rows;
  previewCache.set(token, { meta, file, rows: parsed.rows.length, at: Date.now() });

  const now = Date.now();
  for (const [k, v] of previewCache) {
    if (now - v.at > PREVIEW_TTL) dropPreview(k);
  }
  if (previewCache.size > 10) {
    const oldest = [...previewCache.entries()].sort((a, b) => a[1].at - b[1].at)[0];
    if (oldest) dropPreview(oldest[0]);
  }
}

function readPreview(token) {
  const entry = previewCache.get(token);
  if (!entry) return null;
  try {
    return JSON.parse(fs.readFileSync(entry.file, "utf8"));
  } catch {
    dropPreview(token);
    return null;
  }
}

function cleanupPreviewFiles() {
  try {
    const cutoff = Date.now() - 2 * 60 * 60 * 1000;
    for (const name of fs.readdirSync(store.UPLOAD_DIR)) {
      if (!name.endsWith(".preview.json")) continue;
      const p = path.join(store.UPLOAD_DIR, name);
      if (fs.statSync(p).mtimeMs < cutoff) fs.rmSync(p, { force: true });
    }
  } catch { /* ignore */ }
}

cleanupPreviewFiles();

api.post("/imports/preview", upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "فایلی ارسال نشده است." });
  const name = String(req.file.originalname || "file");
  const ext = path.extname(name).toLowerCase();
  const allowed = [".xlsx", ".xls", ".csv", ".txt"];
  if (!allowed.includes(ext)) {
    return res.status(400).json({ error: "فرمت مجاز: xlsx، xls، csv" });
  }
  try {
    const parsed = parseSpreadsheet(req.file.buffer, name);
    const token = crypto.randomBytes(16).toString("hex");

    // ذخیره‌ی فایل اصلی برای بایگانی
    const stored = path.join(store.UPLOAD_DIR, `${token}${ext}`);
    fs.writeFileSync(stored, req.file.buffer);
    parsed.storedPath = stored;

    cachePreview(token, parsed);
    res.json({
      token,
      total: parsed.rows.length,
      skipped: parsed.skipped,
      warnings: parsed.warnings,
      mapping: parsed.mappingLabels,
      preview: parsed.rows.slice(0, 20),
      sheetName: parsed.sheetName,
      filename: parsed.filename,
    });
  } catch (err) {
    res.status(400).json({ error: err.message || "خواندن فایل ناموفق بود." });
  }
});

api.post("/roozkars/:id/imports", (req, res) => {
  const roozkar = store.getRoozkar(req.params.id);
  if (!roozkar) return res.status(404).json({ error: "روزکار پیدا نشد." });
  const token = String(req.body?.token || "");
  const mode = req.body?.mode === "append" ? "append" : "replace";
  const parsed = readPreview(token);
  if (!parsed) return res.status(400).json({ error: "پیش‌نمایش منقضی شده؛ فایل را دوباره بارگذاری کنید." });

  if (!parsed.rows.length) return res.status(400).json({ error: "فایل هیچ ردیف معتبری ندارد." });

  let targetImport;
  let created = false;

  if (mode === "append" && roozkar.active_import_id != null) {
    targetImport = store.getImport(roozkar.active_import_id);
  } else {
    targetImport = store.createImport(roozkar.id, parsed.filename, parsed.storedPath, 0, "excel");
    created = true;
  }

  const inserted = store.addSubscribersBulk(roozkar.id, parsed.rows, targetImport.id);

  store.db
    .prepare("UPDATE imports SET rows = (SELECT COUNT(*) FROM subscribers WHERE import_id = ?) WHERE id = ?")
    .run(targetImport.id, targetImport.id);

  if (created) store.setActiveImport(roozkar.id, targetImport.id);

  dropPreview(token);
  res.json({ ok: true, mode, inserted, importId: targetImport.id, import: store.getImport(targetImport.id) });
});

api.get("/imports/:id", (req, res) => {
  const imp = store.getImport(req.params.id);
  if (!imp) return res.status(404).json({ error: "فایل پیدا نشد." });
  res.json({ import: imp });
});

api.post("/imports/:id/activate", (req, res) => {
  const imp = store.getImport(req.params.id);
  if (!imp) return res.status(404).json({ error: "فایل پیدا نشد." });
  store.setActiveImport(imp.roozkar_id, imp.id);
  res.json({ ok: true });
});

/* ----- OCR ----- */

api.post("/ocr", upload.single("image"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "تصویری ارسال نشده است." });
  const allowed = ["image/png", "image/jpeg", "image/webp", "image/bmp", "image/tiff"];
  if (!allowed.includes(req.file.mimetype)) {
    return res.status(400).json({ error: "فرمت تصویر مجاز نیست (PNG، JPG، WEBP)." });
  }
  try {
    const result = await recognizeImage(req.file.buffer, req.file.mimetype);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message || "خواندن تصویر ناموفق بود." });
  }
});

api.post("/ocr/commit", (req, res) => {
  const roozkar = store.getRoozkar(req.body?.roozkarId);
  if (!roozkar) return res.status(404).json({ error: "روزکار پیدا نشد." });
  const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
  if (!rows.length) return res.status(400).json({ error: "ردیفی برای ثبت وجود ندارد." });

  const validRows = rows.filter((row) => String(row.name || "").trim());
  if (!validRows.length) return res.status(400).json({ error: "هیچ ردیفی نام مشترک ندارد." });

  const imp = store.createImport(
    roozkar.id,
    String(req.body?.filename || "عکس جدول"),
    null,
    validRows.length,
    "ocr"
  );

  const inserted = store.addSubscribersBulk(roozkar.id, validRows, imp.id);
  store.db
    .prepare("UPDATE imports SET rows = (SELECT COUNT(*) FROM subscribers WHERE import_id = ?) WHERE id = ?")
    .run(imp.id, imp.id);
  store.setActiveImport(roozkar.id, imp.id);

  res.json({ ok: true, inserted, importId: imp.id });
});

/* ----- SMS templates ----- */

api.get("/templates", (req, res) => {
  res.json({ templates: store.listTemplates() });
});

api.post("/templates", (req, res) => {
  const title = String(req.body?.title || "").trim();
  const body = String(req.body?.body || "").trim();
  if (!title) return res.status(400).json({ error: "نام قالب را وارد کنید." });
  if (!body) return res.status(400).json({ error: "متن قالب خالی است." });
  res.status(201).json({ template: store.createTemplate(title, body) });
});

api.put("/templates/:id", (req, res) => {
  const tpl = store.getTemplate(req.params.id);
  if (!tpl) return res.status(404).json({ error: "قالب پیدا نشد." });
  const title = String(req.body?.title || "").trim();
  const body = String(req.body?.body || "").trim();
  if (!title) return res.status(400).json({ error: "نام قالب را وارد کنید." });
  if (!body) return res.status(400).json({ error: "متن قالب خالی است." });
  res.json({ template: store.updateTemplate(tpl.id, title, body) });
});

api.delete("/templates/:id", (req, res) => {
  const tpl = store.deleteTemplate(req.params.id);
  if (!tpl) return res.status(404).json({ error: "قالب پیدا نشد." });
  res.json({ ok: true });
});

/* ----- Voice samples ----- */

const AUDIO_TYPES = {
  ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg",
  ".wav": "audio/wav",
  ".m4a": "audio/mp4",
  ".aac": "audio/aac",
  ".amr": "audio/amr",
};

api.get("/voice-samples", (req, res) => {
  res.json({ samples: store.listVoiceSamples() });
});

api.post("/voice-samples", audioUpload.single("audio"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "فایل صوتی ارسال نشده است." });
  const original = String(req.file.originalname || "voice");
  const ext = path.extname(original).toLowerCase();
  if (!AUDIO_TYPES[ext]) {
    return res.status(400).json({ error: "فرمت مجاز صوتی: mp3، ogg، wav، m4a، aac، amr" });
  }
  const title = String(req.body?.title || "").trim() || original;
  const debtMin = Math.max(0, Number(req.body?.debt_min) || 0);
  const debtMax = Math.max(0, Number(req.body?.debt_max) || 0);
  if (debtMax > 0 && debtMax < debtMin) {
    return res.status(400).json({ error: "سقف بازه‌ی بدهی نباید کمتر از کف آن باشد." });
  }

  const fileName = `${crypto.randomBytes(12).toString("hex")}${ext}`;
  const stored = path.join(store.VOICE_DIR, fileName);
  fs.writeFileSync(stored, req.file.buffer);

  const sample = store.createVoiceSample({
    title,
    original_name: original,
    stored_path: stored,
    mime: AUDIO_TYPES[ext],
    size: req.file.size,
    debt_min: debtMin,
    debt_max: debtMax,
  });
  res.status(201).json({ sample });
});

api.put("/voice-samples/:id", (req, res) => {
  const sample = store.getVoiceSample(req.params.id);
  if (!sample) return res.status(404).json({ error: "فایل صوتی پیدا نشد." });
  const title = String(req.body?.title || "").trim();
  if (!title) return res.status(400).json({ error: "نام فایل صوتی را وارد کنید." });
  const debtMin = Math.max(0, Number(req.body?.debt_min) || 0);
  const debtMax = Math.max(0, Number(req.body?.debt_max) || 0);
  if (debtMax > 0 && debtMax < debtMin) {
    return res.status(400).json({ error: "سقف بازه‌ی بدهی نباید کمتر از کف آن باشد." });
  }
  res.json({ sample: store.updateVoiceSample(sample.id, { title, debt_min: debtMin, debt_max: debtMax }) });
});

api.delete("/voice-samples/:id", (req, res) => {
  const sample = store.deleteVoiceSample(req.params.id);
  if (!sample) return res.status(404).json({ error: "فایل صوتی پیدا نشد." });
  try { fs.rmSync(sample.stored_path, { force: true }); } catch { /* ignore */ }
  res.json({ ok: true });
});

api.get("/voice-samples/:id/audio", (req, res) => {
  const sample = store.getVoiceSample(req.params.id);
  if (!sample || !fs.existsSync(sample.stored_path)) {
    return res.status(404).json({ error: "فایل صوتی پیدا نشد." });
  }
  res.setHeader("Content-Type", sample.mime || "application/octet-stream");
  res.setHeader("Cache-Control", "private, max-age=300");
  fs.createReadStream(sample.stored_path).pipe(res);
});

/* ----- Settings / provider APIs ----- */

function providerView(kind) {
  const config = store.getProviderConfig(kind);
  return {
    kind,
    provider: config.provider,
    base_url: config.base_url || "",
    sender: config.sender || "",
    auth_header: config.auth_header || "Authorization",
    auth_prefix: config.auth_prefix ?? "Bearer ",
    method: config.method || "POST",
    payload: config.payload || "",
    api_key_masked: config.api_key ? maskSecret(decrypt(config.api_key)) : "",
    has_api_key: !!config.api_key,
    updated_at: config.updated_at || "",
  };
}

api.get("/settings", (req, res) => {
  res.json({
    sms: providerView("sms"),
    voice: providerView("voice"),
    publicBaseUrl: store.getSetting("public_base_url") || process.env.PUBLIC_BASE_URL || "",
    externalApiKeyMasked: maskSecret(externalApiKey()),
    hasExternalApiKey: !!externalApiKey(),
    maxAudioMb: MAX_AUDIO_MB,
  });
});

function validatePayload(payload) {
  if (!payload) return null;
  try {
    JSON.parse(payload.replace(/\{[a-z_]+\}/g, "x"));
    return null;
  } catch {
    return "قالب JSON معتبر نیست. نمونه: {\"to\":\"{phone}\",\"message\":\"{message}\"}";
  }
}

api.post("/settings/providers/:kind", (req, res) => {
  const kind = req.params.kind === "voice" ? "voice" : "sms";
  const provider = String(req.body?.provider || "simulate").toLowerCase();
  if (!["simulate", "kavenegar", "webhook", "custom"].includes(provider)) {
    return res.status(400).json({ error: "سرویس انتخاب‌شده معتبر نیست." });
  }
  const baseUrl = String(req.body?.base_url || "").trim();
  if (baseUrl && !/^https?:\/\//i.test(baseUrl)) {
    return res.status(400).json({ error: "آدرس سرویس باید با http:// یا https:// شروع شود." });
  }
  const payload = String(req.body?.payload || "");
  const payloadError = validatePayload(payload);
  if (payloadError) return res.status(400).json({ error: payloadError });

  const current = store.getProviderConfig(kind);
  let apiKey = current.api_key || "";
  const incomingKey = req.body?.api_key;
  if (typeof incomingKey === "string" && incomingKey.trim()) {
    apiKey = encrypt(incomingKey.trim());
  }

  store.saveProviderConfig(kind, {
    provider,
    base_url: baseUrl,
    api_key: apiKey,
    sender: String(req.body?.sender || "").trim(),
    auth_header: String(req.body?.auth_header || "Authorization").trim(),
    auth_prefix: String(req.body?.auth_prefix ?? "Bearer "),
    method: req.body?.method === "GET" ? "GET" : "POST",
    payload,
  });

  res.json({ ok: true, config: providerView(kind) });
});

api.post("/settings/general", (req, res) => {
  const baseUrl = String(req.body?.publicBaseUrl || "").trim().replace(/\/+$/, "");
  if (baseUrl && !/^https?:\/\//i.test(baseUrl)) {
    return res.status(400).json({ error: "آدرس عمومی سایت باید با http:// یا https:// شروع شود." });
  }
  store.setSetting("public_base_url", baseUrl);
  res.json({ ok: true, publicBaseUrl: baseUrl });
});

api.post("/settings/api-key", (req, res) => {
  const action = String(req.body?.action || "generate");
  if (action === "clear") {
    store.setSetting("external_api_key", "");
    return res.json({ ok: true, cleared: true });
  }
  const key = crypto.randomBytes(24).toString("hex");
  store.setSetting("external_api_key", encrypt(key));
  res.json({ ok: true, apiKey: key });
});

api.post("/settings/test-send", async (req, res) => {
  const kind = req.body?.kind === "voice" ? "voice" : "sms";
  const phone = String(req.body?.phone || "").replace(/\D+/g, "");
  if (phone.length < 10) return res.status(400).json({ error: "شماره تماس معتبر وارد کنید." });

  const sample = kind === "voice" ? store.listVoiceSamples()[0] : null;
  try {
    const result = await sendBatch({
      type: kind,
      recipients: [{ id: 0, name: "تست", phone, debt: 0 }],
      message: String(req.body?.message || "پیام تست از سامانه وصول مطالبات"),
      context: {
        type: kind,
        voiceUrl: sample ? voiceUrl(req, sample) : "",
        voiceTitle: sample ? sample.title : "",
      },
    });
    res.json({ ok: true, result });
  } catch (err) {
    res.status(400).json({ error: err.message || "ارسال تست ناموفق بود." });
  }
});

/* ----- Send ----- */

const DEBT_LABELS = {
  all: "همه‌ی بدهکاران",
  lt1: "زیر ۱ میلیون ریال",
  "1to10": "۱ تا ۱۰ میلیون ریال",
  gt10: "بالای ۱۰ میلیون ریال",
};

function scopeLabel({ roozkarId, regionId, debt }) {
  const rz = roozkarId ? store.getRoozkar(roozkarId) : null;
  const region = regionId ? store.getRegion(regionId) : null;
  const place = rz ? `روزکار ${rz.number} (${rz.region_name || ""})` : region ? region.name : "همه‌ی مناطق";
  return `${place} · ${DEBT_LABELS[debt] || DEBT_LABELS.all}`;
}

api.post("/sends/preview", (req, res) => {
  const roozkarId = req.body?.roozkarId ? Number(req.body.roozkarId) : null;
  const regionId = req.body?.regionId ? Number(req.body.regionId) : null;
  const debt = String(req.body?.debt || "all");
  const stats = store.recipientStats({ roozkarId, regionId, debt });
  const sample = store.recipients({ roozkarId, regionId, debt, limit: 4 });
  res.json({
    count: stats.count,
    withPhone: stats.withPhone,
    debt: stats.debt,
    sample: sample.map((s) => ({ id: s.id, name: s.name, debt: s.debt })),
  });
});

api.post("/sends", async (req, res) => {
  const type = req.body?.type === "voice" ? "voice" : "sms";
  let message = String(req.body?.message || "").trim();
  const templateId = req.body?.templateId ? Number(req.body.templateId) : null;
  if (!message && templateId) {
    const tpl = store.getTemplate(templateId);
    if (tpl) message = tpl.body;
  }
  if (type === "sms" && !message) return res.status(400).json({ error: "متن پیام خالی است." });
  if (typeof message === "string" && message.length > 2000) {
    return res.status(400).json({ error: "متن پیام بیش از حد طولانی است." });
  }

  const roozkarId = req.body?.roozkarId ? Number(req.body.roozkarId) : null;
  const regionId = req.body?.regionId ? Number(req.body.regionId) : null;
  const debt = String(req.body?.debt || "all");

  let list = [];
  let scopeText = "";
  let context = {};

  if (req.body?.subscriberId) {
    const sub = store.getSubscriber(req.body.subscriberId);
    if (!sub) return res.status(404).json({ error: "مشترک پیدا نشد." });
    if (!sub.phone) return res.status(400).json({ error: "این مشترک شماره تماس ندارد." });
    list = [sub];
    const rz = store.getRoozkar(sub.roozkar_id);
    scopeText = `روزکار ${rz ? rz.number : "-"} — ارسال تکی`;
    context = { roozkarNumber: rz?.number, regionName: rz?.region_name };
  } else {
    const stats = store.recipientStats({ roozkarId, regionId, debt });
    if (!stats.count) return res.status(400).json({ error: "گیرنده‌ای با این فیلتر وجود ندارد." });
    if (!stats.withPhone) {
      return res.status(400).json({
        error: "هیچ‌کدام از گیرندگان شماره تماس ندارند. اکسل را با ستون «شماره تماس» دوباره بارگذاری کنید.",
      });
    }
    const info = providerInfo(type);
    if (stats.count > info.maxPerBatch) {
      return res.status(400).json({
        error: `تعداد گیرندگان (${stats.count}) از سقف مجاز هر ارسال (${info.maxPerBatch}) بیشتر است. فیلتر یا منطقه را محدودتر کنید.`,
      });
    }
    list = store.recipients({ roozkarId, regionId, debt, limit: info.maxPerBatch + 1 });
    scopeText = scopeLabel({ roozkarId, regionId, debt });
    const rz = roozkarId ? store.getRoozkar(roozkarId) : null;
    const region = regionId ? store.getRegion(regionId) : null;
    context = { roozkarNumber: rz?.number, regionName: rz?.region_name || region?.name };
  }

  if (!list.length) return res.status(400).json({ error: "گیرنده‌ای برای ارسال وجود ندارد." });
  if (!list.some((s) => !!s.phone)) {
    return res.status(400).json({ error: "گیرنده‌ها شماره تماس ندارند." });
  }

  const info = providerInfo(type);
  if (list.length > info.maxPerBatch) list = list.slice(0, info.maxPerBatch);

  if (type === "voice") {
    const samples = store.listVoiceSamples();
    if (!samples.length) {
      return res.status(400).json({ error: "هنوز فایل صوتی آپلود نشده است. از صفحه‌ی «پیامک صوتی» یک فایل اضافه کنید." });
    }
    const requested = req.body?.sampleId ? store.getVoiceSample(req.body.sampleId) : null;
    if (req.body?.sampleId && !requested) return res.status(404).json({ error: "فایل صوتی انتخابی پیدا نشد." });

    const groups = new Map();
    let unmatched = 0;
    for (const sub of list) {
      const sample = requested || store.matchVoiceSample(samples, sub.debt);
      if (!sample) { unmatched += 1; continue; }
      if (!groups.has(sample.id)) groups.set(sample.id, { sample, list: [] });
      groups.get(sample.id).list.push(sub);
    }

    if (!groups.size) {
      return res.status(400).json({
        error: "برای بازه‌ی بدهی این گیرندگان فایل صوتی تعریف نشده است. یک فایل با بازه‌ی مناسب اضافه کنید.",
      });
    }

    const results = [];
    let sent = 0, failed = 0, skipped = unmatched;
    const failures = [];

    for (const group of groups.values()) {
      const groupContext = { ...context, voiceUrl: voiceUrl(req, group.sample), voiceTitle: group.sample.title };
      const result = await sendBatch({ type: "voice", recipients: group.list, message, context: groupContext });
      results.push({ sampleId: group.sample.id, sampleTitle: group.sample.title, count: group.list.length, result });

      sent += result.sent;
      failed += result.failed;
      skipped += result.skipped;
      (result.failures || []).forEach((f) => { if (failures.length < 20) failures.push(f); });

      if (result.sent > 0) {
        store.markContact(group.list.slice(0, result.sent).map((s) => s.id), "پیام صوتی");
      }

      store.addSend({
        type: "voice",
        count: result.sent,
        scope: `${scopeText} · ${group.sample.title}`,
        message: message || `فایل صوتی: ${group.sample.title}`,
        status: result.status,
        provider: result.provider,
        detail: { failed: result.failed, skipped: result.skipped, failures: (result.failures || []).slice(0, 10) },
      });
    }

    const status = failed === 0 ? "sent" : sent === 0 ? "failed" : "partial";
    const record = results.length === 1 ? results[0].result : { status, sent, failed, skipped, failures };
    return res.json({ ok: true, result: record, results, voice: true });
  }

  const result = await sendBatch({ type: "sms", recipients: list, message, context });

  if (result.sent > 0) {
    store.markContact(list.slice(0, result.sent).map((s) => s.id), "پیامک");
  }

  const record = store.addSend({
    type: "sms",
    count: result.sent,
    scope: scopeText,
    message,
    status: result.status,
    provider: result.provider,
    detail: { failed: result.failed, skipped: result.skipped, failures: result.failures?.slice(0, 10) },
  });

  res.json({ ok: true, result, send: record });
});

api.get("/sends", (req, res) => {
  res.json({ sends: store.listSends(Number(req.query.limit) || 50) });
});

/* ----- Export API for external site ----- */

api.get("/export/subscribers", (req, res) => {
  const roozkarId = req.query.roozkarId ? Number(req.query.roozkarId) : null;
  const regionId = req.query.regionId ? Number(req.query.regionId) : null;
  const debt = String(req.query.debt || "all");
  const rows = store.recipients({ roozkarId, regionId, debt });
  res.json({
    count: rows.length,
    items: rows.map((s) => ({
      id: s.id,
      eshterak: s.eshterak,
      name: s.name,
      phone: s.phone,
      address: s.address,
      debt: s.debt,
      last_pay: s.last_pay,
      bill_id: s.bill_id,
      pay_id: s.pay_id,
      roozkar: s.roozkar_id,
    })),
  });
});

app.use("/api", api);

/* ---------- Public signed media (for external voice providers) ---------- */

app.get("/media/voice/:id", (req, res) => {
  const id = Number(req.params.id);
  if (!id || !matchSecret(req.query.s, voiceSignature(id))) {
    return res.status(403).end();
  }
  const sample = store.getVoiceSample(id);
  if (!sample || !fs.existsSync(sample.stored_path)) return res.status(404).end();
  res.setHeader("Content-Type", sample.mime || "application/octet-stream");
  res.setHeader("Cache-Control", "public, max-age=3600");
  fs.createReadStream(sample.stored_path).pipe(res);
});

/* ---------- Static ---------- */

app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "same-origin");
  next();
});

app.use(express.static(PUBLIC_DIR, { maxAge: process.env.NODE_ENV === "production" ? "7d" : 0 }));

const ASSETS_DIR = (() => {
  if (process.env.ASSETS_DIR) return process.env.ASSETS_DIR;
  const rootAssets = path.resolve(__dirname, "..", "..", "assets");
  if (fs.existsSync(rootAssets)) return rootAssets;
  return path.resolve(__dirname, "..", "assets");
})();
app.use("/assets", express.static(ASSETS_DIR, { maxAge: "30d" }));

app.use((req, res, next) => {
  if (req.method !== "GET" || req.path.startsWith("/api/") || req.path.startsWith("/media/")) return next();
  res.sendFile(path.join(PUBLIC_DIR, "index.html"));
});

/* ---------- Errors ---------- */

app.use((err, req, res, next) => {
  if (err?.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({ error: `حجم فایل بیش از حد مجاز است (${MAX_UPLOAD_MB} مگابایت برای اکسل، ${MAX_AUDIO_MB} مگابایت برای صدا).` });
  }
  console.error("[error]", err);
  res.status(500).json({ error: "خطای داخلی سرور." });
});

/* ---------- Start ---------- */

if (!process.env.APP_PASSWORD) {
  console.warn("[هشدار] APP_PASSWORD تنظیم نشده؛ رمز پیش‌فرض «1234» فعال است.");
}

app.listen(PORT, () => {
  const info = allProviderInfo();
  console.log(`سامانه وصول مطالبات روی http://localhost:${PORT} اجرا شد.`);
  console.log(`پیامک: ${info.sms.provider} | صوتی: ${info.voice.provider} | OCR: ${ocrInfo().provider}`);
});
