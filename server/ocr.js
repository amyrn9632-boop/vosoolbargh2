/**
 * آداپتور OCR برای خواندن عکس جدول.
 * provider = local (tesseract.js) | webhook | none
 *
 * روش محلی: متن را با مختصات هر کلمه می‌خواند و ستون‌ها را از روی
 * موقعیت افقی سرستون‌ها تشخیص می‌دهد (جدول‌خوان هندسی).
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { matchField, matchFieldExact } from "./import.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = process.env.OCR_CACHE_DIR || path.join(__dirname, "..", "data", "ocr-cache");
const PROVIDER = (process.env.OCR_PROVIDER || "local").toLowerCase();
const LANG = process.env.OCR_LANG || "fas+eng";
const WEBHOOK = process.env.OCR_WEBHOOK_URL || "";
const WEBHOOK_TOKEN = process.env.OCR_WEBHOOK_TOKEN || "";

export function ocrInfo() {
  return {
    provider: PROVIDER,
    lang: LANG,
    configured: PROVIDER === "local" || (PROVIDER === "webhook" && !!WEBHOOK),
  };
}

let workerPromise = null;

async function getWorker() {
  if (workerPromise) return workerPromise;
  workerPromise = (async () => {
    const mod = await import("tesseract.js");
    fs.mkdirSync(CACHE_DIR, { recursive: true });
    const worker = await mod.createWorker(LANG, 1, { cachePath: CACHE_DIR, logger: () => {} });
    await worker.setParameters({
      preserve_interword_spaces: "1",
      tessedit_pageseg_mode: "6",
    });
    return worker;
  })();
  return workerPromise;
}

async function preprocess(buffer) {
  try {
    const sharpMod = await import("sharp");
    const sharp = sharpMod.default;
    const image = sharp(buffer, { failOn: "none" }).rotate();
    const meta = await image.metadata();
    const width = meta.width || 0;
    let pipeline = image.grayscale().normalize();
    if (width > 0 && width < 1400) {
      pipeline = pipeline.resize({ width: Math.min(2400, Math.round(width * 2)) });
    }
    return await pipeline.png().toBuffer();
  } catch (e) {
    return buffer;
  }
}

/* ---------- low-level ---------- */

const FA = "۰۱۲۳۴۵۶۷۸۹";
const AR = "٠١٢٣٤٥٦٧٨٩";

function latin(value) {
  return String(value ?? "")
    .replace(/[۰-۹]/g, (d) => String(FA.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String(AR.indexOf(d)));
}
function digitsOf(value) {
  return latin(value).replace(/\D/g, "");
}
function pad2(n) {
  return n < 10 ? "0" + n : String(n);
}
function cleanDate(value) {
  const s = latin(value).trim();
  const m = s.match(/(\d{4})\s*[\/\-.]\s*(\d{1,2})\s*[\/\-.]\s*(\d{1,2})/);
  if (m) return `${m[1]}/${pad2(Number(m[2]))}/${pad2(Number(m[3]))}`;
  return s;
}

function normalizeRow(raw) {
  const row = {
    eshterak: digitsOf(raw.eshterak).slice(0, 8),
    name: String(raw.name || "").replace(/\s+/g, " ").trim(),
    address: String(raw.address || "").replace(/\s+/g, " ").trim(),
    last_pay: cleanDate(raw.last_pay || ""),
    debt: Math.max(0, Number(digitsOf(raw.debt)) || 0),
    bill_id: digitsOf(raw.bill_id).slice(0, 13),
    pay_id: digitsOf(raw.pay_id).slice(0, 11),
    phone: (function (p) {
      const d = digitsOf(p);
      if (!d) return "";
      if (d.startsWith("0098")) return "0" + d.slice(4);
      if (d.startsWith("98") && d.length > 10) return "0" + d.slice(2);
      if (d.length === 10 && d.startsWith("9")) return "0" + d;
      return d;
    })(raw.phone || ""),
  };
  return row;
}

/* ---------- geometric table parsing ---------- */

function collectWords(data) {
  const out = [];
  const push = (w) => {
    if (!w || !w.bbox || !w.text || !String(w.text).trim()) return;
    if (w.confidence != null && w.confidence < 25) return;
    out.push(w);
  };
  if (Array.isArray(data.blocks)) {
    for (const b of data.blocks) {
      for (const p of b.paragraphs || []) {
        for (const l of p.lines || []) {
          for (const w of l.words || []) push(w);
        }
      }
    }
  }
  if (!out.length && Array.isArray(data.words)) data.words.forEach(push);
  return out;
}

function groupLines(words) {
  const sorted = words
    .slice()
    .sort((a, b) => (a.bbox.y0 + a.bbox.y1) / 2 - (b.bbox.y0 + b.bbox.y1) / 2);
  const lines = [];
  for (const w of sorted) {
    const cy = (w.bbox.y0 + w.bbox.y1) / 2;
    const h = Math.max(6, w.bbox.y1 - w.bbox.y0);
    let line = null;
    for (const l of lines) {
      if (Math.abs(l.cy - cy) <= h * 0.7) { line = l; break; }
    }
    if (!line) {
      line = { cy, words: [] };
      lines.push(line);
    }
    line.words.push(w);
    line.cy = (line.cy * (line.words.length - 1) + cy) / line.words.length;
    line.height = Math.max(line.height || 0, h);
  }
  lines.forEach((l) => l.words.sort((a, b) => b.bbox.x0 - a.bbox.x0));
  return lines;
}

function detectColumns(headerWords) {
  const words = headerWords.slice().sort((a, b) => a.bbox.x0 - b.bbox.x0);
  const n = words.length;
  const matched = new Array(n).fill(null);

  const isFree = (from, len) => {
    for (let k = from; k < from + len; k++) if (matched[k]) return false;
    return true;
  };
  const assign = (from, len, field) => {
    for (let k = from; k < from + len; k++) matched[k] = field;
  };

  // ۱) تک‌کلمه‌های دقیق
  for (let i = 0; i < n; i++) {
    const f = matchFieldExact(words[i].text);
    if (f) matched[i] = f;
  }

  // ۲) عبارت‌های سه‌کلمه‌ای و دوکلمه‌ای (مثل «تاریخ آخرین پرداختی»)
  for (let len = 3; len >= 2; len--) {
    for (let i = 0; i + len <= n; i++) {
      if (!isFree(i, len)) continue;
      const label = words.slice(i, i + len).map((w) => w.text).join(" ");
      const f = matchFieldExact(label);
      if (f && !matched.includes(f)) assign(i, len, f);
    }
  }

  // ۳) تک‌کلمه‌های باقی‌مانده با تطبیق نسبی
  for (let i = 0; i < n; i++) {
    if (matched[i]) continue;
    const f = matchField(words[i].text);
    if (f && !matched.includes(f)) matched[i] = f;
  }

  const cols = [];
  for (let i = 0; i < n; i++) {
    const field = matched[i];
    if (!field) continue;
    if (cols.some((c) => c.field === field)) continue;
    const group = [words[i]];
    let j = i + 1;
    while (j < n && matched[j] === field && !cols.some((c) => c.field === field && c._last === j - 1)) {
      group.push(words[j]);
      j++;
    }
    const x0 = Math.min(...group.map((w) => w.bbox.x0));
    const x1 = Math.max(...group.map((w) => w.bbox.x1));
    cols.push({
      field,
      x0,
      x1,
      center: (x0 + x1) / 2,
      label: group.map((w) => w.text).join(" "),
    });
  }

  if (cols.length < 2) return [];

  cols.sort((a, b) => b.center - a.center); // راست به چپ
  for (let i = 0; i < cols.length; i++) {
    const c = cols[i];
    c.rightBound = i === 0 ? Infinity : (cols[i - 1].x0 + c.x1) / 2;
    c.leftBound = i === cols.length - 1 ? -Infinity : (cols[i + 1].x1 + c.x0) / 2;
    if (c.rightBound < c.leftBound) {
      const mid = (c.rightBound + c.leftBound) / 2;
      c.rightBound = mid;
      c.leftBound = mid;
    }
  }
  return cols;
}

function wordsToCell(words) {
  if (!words || !words.length) return "";
  return words
    .slice()
    .sort((a, b) => b.bbox.x0 - a.bbox.x0)
    .map((w) => w.text)
    .join(" ")
    .trim();
}

export function rowsFromWords(data) {
  const words = collectWords(data);
  if (words.length < 8) return { rows: [], columns: [] };

  const lines = groupLines(words);

  let header = null;
  let bestScore = 0;
  for (const line of lines) {
    let score = 0;
    for (const w of line.words) {
      if (matchField(w.text)) score++;
      else if (matchField("شناسه " + w.text) || matchField("تاریخ " + w.text)) score++;
    }
    if (score > bestScore) {
      bestScore = score;
      header = line;
    }
  }
  if (!header || bestScore < 3) return { rows: [], columns: [] };

  const cols = detectColumns(header.words);
  if (cols.length < 3) return { rows: [], columns: [] };

  const rows = [];
  const headerY = header.cy;
  const minGap = Math.max(6, (header.height || 20) * 0.9);

  for (const line of lines) {
    if (line.cy <= headerY + minGap * 0.6) continue;
    const cells = {};
    for (const c of cols) cells[c.field] = [];
    let assigned = 0;

    for (const w of line.words) {
      const cx = (w.bbox.x0 + w.bbox.x1) / 2;
      let target = null;
      for (const c of cols) {
        if (cx >= c.leftBound && cx <= c.rightBound) { target = c; break; }
      }
      if (!target) {
        let best = null;
        let bestDist = Infinity;
        for (const c of cols) {
          const d = Math.abs(cx - c.center);
          if (d < bestDist) { bestDist = d; best = c; }
        }
        if (best && bestDist < (header.height || 20) * 2.5) target = best;
      }
      if (target) { cells[target.field].push(w); assigned++; }
    }

    if (assigned < 2) continue;

    const raw = {};
    for (const c of cols) raw[c.field] = wordsToCell(cells[c.field]);

    const row = normalizeRow(raw);
    if (!row.name && !row.eshterak) continue;
    if (!row.debt && !row.bill_id && !row.pay_id && !row.last_pay && !row.phone) continue;
    rows.push(row);
  }

  return { rows, columns: cols.map((c) => ({ field: c.field, label: c.label })) };
}

/* ---------- خط‌محور (پشتیبان) ---------- */

const HEADER_WORDS = ["مشترک", "اشتراک", "آدرس", "نشانی", "بدهی", "شناسه", "پرداخت", "تماس", "تاریخ", "مبلغ"];

function isHeaderLine(line) {
  return HEADER_WORDS.filter((w) => line.includes(w)).length >= 3;
}

function classifyToken(token) {
  const t = latin(token).trim();
  const d = t.replace(/[^\d]/g, "");
  if (/\d{4}\s*[\/\-.]\s*\d{1,2}\s*[\/\-.]\s*\d{1,2}/.test(t)) return { field: "last_pay", value: cleanDate(t) };
  if (/^0?9\d{9}$/.test(d)) return { field: "phone", value: d.startsWith("9") ? "0" + d : d };
  if (d.length === 13 && /^\d+$/.test(t.replace(/\s/g, ""))) return { field: "bill_id", value: d };
  if (d.length === 11 && /^\d+$/.test(t.replace(/\s/g, "")) && !d.startsWith("09")) return { field: "pay_id", value: d };
  if (/^[\d,٬،\s]+$/.test(t) && d.length >= 4) return { field: "debt", value: Number(d) };
  return null;
}

export function parseRowsText(text) {
  const lines = String(text || "")
    .split(/\r?\n/)
    .map((l) => l.replace(/\u200c/g, " ").trim())
    .filter((l) => l.length > 3 && !isHeaderLine(l));

  const rows = [];
  for (const line of lines) {
    const parts = line.split(/\s{2,}|\t+/).map((p) => p.trim()).filter(Boolean);
    const tokens = parts.length >= 3 ? parts : line.split(/\s+/);
    const raw = { eshterak: "", name: "", address: "", last_pay: "", debt: 0, bill_id: "", pay_id: "", phone: "" };
    const nameParts = [];
    let numericHits = 0;

    for (const token of tokens) {
      const kind = classifyToken(token);
      if (kind) {
        numericHits++;
        if (kind.field === "debt") raw.debt = Math.max(Number(raw.debt) || 0, Number(kind.value) || 0);
        else if (!raw[kind.field]) raw[kind.field] = kind.value;
        continue;
      }
      const d = digitsOf(token);
      if (d.length >= 4 && /^[\d۰-۹,٬،\s]+$/.test(token)) {
        if (!raw.eshterak && d.length <= 8) raw.eshterak = d;
        continue;
      }
      nameParts.push(token);
    }
    if (numericHits === 0) continue;
    raw.name = nameParts.join(" ").trim();
    if (!raw.name && !raw.eshterak) continue;
    rows.push(normalizeRow(raw));
  }
  return rows;
}

/* ---------- webhook ---------- */

async function recognizeWithWebhook(buffer, mimetype) {
  if (!WEBHOOK) throw new Error("سرویس OCR تنظیم نشده است (OCR_WEBHOOK_URL).");
  const res = await fetch(WEBHOOK, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(WEBHOOK_TOKEN ? { authorization: `Bearer ${WEBHOOK_TOKEN}` } : {}),
    },
    body: JSON.stringify({ image: buffer.toString("base64"), mimetype }),
  });
  if (!res.ok) throw new Error(`سرویس OCR خطا داد (${res.status}).`);
  const data = await res.json();
  const rows = Array.isArray(data.rows) ? data.rows.map(normalizeRow) : parseRowsText(data.text || "");
  return { provider: "webhook", text: data.text || "", confidence: data.confidence ?? null, rows, method: "webhook" };
}

export async function recognizeImage(buffer, mimetype = "image/png") {
  if (PROVIDER === "none") {
    throw new Error("OCR غیرفعال است. OCR_PROVIDER را روی local یا webhook تنظیم کنید.");
  }
  if (PROVIDER === "webhook") return recognizeWithWebhook(buffer, mimetype);

  const worker = await getWorker();
  const prepared = await preprocess(buffer);
  const result = await worker.recognize(prepared, {}, { blocks: true });
  const text = result?.data?.text || "";

  const geometric = rowsFromWords(result.data);
  const rows = geometric.rows.length ? geometric.rows : parseRowsText(text);

  return {
    provider: "local",
    text,
    confidence: result?.data?.confidence ?? null,
    rows,
    method: geometric.rows.length ? "table" : "text",
    columns: geometric.columns || [],
  };
}
