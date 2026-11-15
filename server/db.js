import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(__dirname, "..");
export const DATA_DIR = process.env.DATA_DIR || path.join(ROOT, "data");
export const UPLOAD_DIR = path.join(DATA_DIR, "uploads");
export const VOICE_DIR = path.join(DATA_DIR, "voice");

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
fs.mkdirSync(VOICE_DIR, { recursive: true });

const DB_PATH = process.env.DATABASE_FILE || path.join(DATA_DIR, "app.db");

export const db = new DatabaseSync(DB_PATH);

db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );

  CREATE TABLE IF NOT EXISTS regions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    number INTEGER NOT NULL UNIQUE,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS roozkars (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    region_id INTEGER NOT NULL REFERENCES regions(id) ON DELETE CASCADE,
    number INTEGER NOT NULL,
    name TEXT NOT NULL,
    active_import_id INTEGER,
    created_at TEXT NOT NULL,
    UNIQUE(region_id, number)
  );

  CREATE TABLE IF NOT EXISTS imports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    roozkar_id INTEGER NOT NULL REFERENCES roozkars(id) ON DELETE CASCADE,
    original_name TEXT NOT NULL,
    stored_path TEXT,
    rows INTEGER NOT NULL DEFAULT 0,
    source TEXT NOT NULL DEFAULT 'excel',
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS subscribers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    roozkar_id INTEGER NOT NULL REFERENCES roozkars(id) ON DELETE CASCADE,
    import_id INTEGER REFERENCES imports(id) ON DELETE CASCADE,
    eshterak TEXT,
    name TEXT NOT NULL,
    address TEXT,
    last_pay TEXT,
    debt INTEGER NOT NULL DEFAULT 0,
    bill_id TEXT,
    pay_id TEXT,
    phone TEXT,
    last_contact TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sends (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL,
    count INTEGER NOT NULL DEFAULT 0,
    scope TEXT,
    message TEXT,
    status TEXT NOT NULL,
    provider TEXT,
    detail TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sms_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS voice_samples (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    original_name TEXT,
    stored_path TEXT NOT NULL,
    mime TEXT,
    size INTEGER NOT NULL DEFAULT 0,
    debt_min INTEGER NOT NULL DEFAULT 0,
    debt_max INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS provider_configs (
    kind TEXT PRIMARY KEY,
    provider TEXT NOT NULL DEFAULT 'simulate',
    base_url TEXT NOT NULL DEFAULT '',
    api_key TEXT NOT NULL DEFAULT '',
    sender TEXT NOT NULL DEFAULT '',
    auth_header TEXT NOT NULL DEFAULT 'Authorization',
    auth_prefix TEXT NOT NULL DEFAULT 'Bearer ',
    method TEXT NOT NULL DEFAULT 'POST',
    payload TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_sub_roozkar ON subscribers(roozkar_id);
  CREATE INDEX IF NOT EXISTS idx_sub_import ON subscribers(import_id);
  CREATE INDEX IF NOT EXISTS idx_sub_debt ON subscribers(debt);
  CREATE INDEX IF NOT EXISTS idx_sub_eshterak ON subscribers(eshterak);
  CREATE INDEX IF NOT EXISTS idx_sub_phone ON subscribers(phone);
  CREATE INDEX IF NOT EXISTS idx_sub_bill ON subscribers(bill_id);
  CREATE INDEX IF NOT EXISTS idx_sub_roozkar_import ON subscribers(roozkar_id, import_id);
`);

/* ---------- Migrations ---------- */

const iso = () => new Date().toISOString();

// دو منطقه‌ی ثابت سامانه؛ قابل افزایش از خود برنامه.
db.prepare("INSERT INTO regions (number, name, created_at) VALUES (?, ?, ?) ON CONFLICT(number) DO NOTHING")
  .run(14, "منطقه ۱۴", iso());
db.prepare("INSERT INTO regions (number, name, created_at) VALUES (?, ?, ?) ON CONFLICT(number) DO NOTHING")
  .run(15, "زاهدان و حومه", iso());

// پایگاه‌داده‌های قدیمی: افزودن منطقه به روزکارها و اجازه‌ی تکرار شماره‌ی روزکار در مناطق مختلف.
const roozkarCols = db.prepare("PRAGMA table_info(roozkars)").all().map((c) => c.name);
if (!roozkarCols.includes("region_id")) {
  db.exec("PRAGMA foreign_keys = OFF");
  db.exec("BEGIN");
  try {
    db.exec(`
      CREATE TABLE roozkars_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        region_id INTEGER NOT NULL REFERENCES regions(id) ON DELETE CASCADE,
        number INTEGER NOT NULL,
        name TEXT NOT NULL,
        active_import_id INTEGER,
        created_at TEXT NOT NULL,
        UNIQUE(region_id, number)
      );
    `);
    db.exec(`
      INSERT INTO roozkars_new (id, region_id, number, name, active_import_id, created_at)
      SELECT r.id, (SELECT id FROM regions WHERE number = 14), r.number, r.name, r.active_import_id, r.created_at
      FROM roozkars r;
    `);
    db.exec("DROP TABLE roozkars");
    db.exec("ALTER TABLE roozkars_new RENAME TO roozkars");
    db.exec("COMMIT");
  } catch (err) {
    try { db.exec("ROLLBACK"); } catch { /* ignore */ }
    throw err;
  }
  db.exec("PRAGMA foreign_keys = ON");
  db.exec("CREATE INDEX IF NOT EXISTS idx_roozkar_region ON roozkars(region_id)");
}

if (!db.prepare("SELECT COUNT(*) AS c FROM sms_templates").get().c) {
  db.prepare("INSERT INTO sms_templates (title, body, created_at, updated_at) VALUES (?, ?, ?, ?)")
    .run(
      "یادآوری بدهی",
      "مشترک گرامی {name}، بدهی برق شما به مبلغ {debt} ریال است. لطفاً نسبت به تسویه اقدام فرمایید.",
      iso(),
      iso()
    );
}

export function nowIso() {
  return new Date().toISOString();
}

/* ---------- Regions ---------- */

export function listRegions() {
  const rows = db.prepare(`
    SELECT g.*,
      (SELECT COUNT(*) FROM roozkars r WHERE r.region_id = g.id) AS roozkars,
      (SELECT COUNT(*) FROM subscribers s
        JOIN roozkars r ON r.id = s.roozkar_id
        WHERE r.region_id = g.id AND (r.active_import_id IS NULL OR s.import_id = r.active_import_id)) AS subscribers,
      (SELECT COALESCE(SUM(s.debt), 0) FROM subscribers s
        JOIN roozkars r ON r.id = s.roozkar_id
        WHERE r.region_id = g.id AND (r.active_import_id IS NULL OR s.import_id = r.active_import_id)) AS debt
    FROM regions g
    ORDER BY g.number
  `).all();
  return rows;
}

export function getRegion(id) {
  return db.prepare("SELECT * FROM regions WHERE id = ?").get(Number(id)) || null;
}

export function createRegion(number, name) {
  const info = db
    .prepare("INSERT INTO regions (number, name, created_at) VALUES (?, ?, ?)")
    .run(Number(number), String(name).trim(), nowIso());
  return getRegion(info.lastInsertRowid);
}

/* ---------- Roozkars ---------- */

export function listRoozkars(regionId) {
  const where = regionId ? "WHERE r.region_id = ?" : "";
  const params = regionId ? [Number(regionId)] : [];
  const rows = db.prepare(`
    SELECT r.*, g.number AS region_number, g.name AS region_name,
      (SELECT COUNT(*) FROM subscribers s WHERE s.roozkar_id = r.id AND (r.active_import_id IS NULL OR s.import_id = r.active_import_id)) AS subs,
      (SELECT COALESCE(SUM(debt), 0) FROM subscribers s WHERE s.roozkar_id = r.id AND (r.active_import_id IS NULL OR s.import_id = r.active_import_id)) AS debt,
      (SELECT COUNT(*) FROM subscribers s WHERE s.roozkar_id = r.id AND s.debt > 0 AND (r.active_import_id IS NULL OR s.import_id = r.active_import_id)) AS due,
      (SELECT COUNT(*) FROM imports i WHERE i.roozkar_id = r.id) AS files
    FROM roozkars r
    JOIN regions g ON g.id = r.region_id
    ${where}
    ORDER BY g.number, r.number
  `).all(...params);
  return rows.map((r) => ({ ...r, has_data: r.active_import_id != null }));
}

export function getRoozkar(id) {
  return db.prepare(`
    SELECT r.*, g.number AS region_number, g.name AS region_name
    FROM roozkars r JOIN regions g ON g.id = r.region_id
    WHERE r.id = ?
  `).get(Number(id)) || null;
}

export function getRoozkarByNumber(number, regionId) {
  if (regionId) {
    return db
      .prepare("SELECT * FROM roozkars WHERE number = ? AND region_id = ?")
      .get(Number(number), Number(regionId)) || null;
  }
  return db.prepare("SELECT * FROM roozkars WHERE number = ?").get(Number(number)) || null;
}

export function createRoozkar(number, name, regionId) {
  const region = regionId ? getRegion(regionId) : db.prepare("SELECT * FROM regions ORDER BY number LIMIT 1").get();
  if (!region) throw new Error("هیچ منطقه‌ای تعریف نشده است.");
  const info = db
    .prepare("INSERT INTO roozkars (region_id, number, name, created_at) VALUES (?, ?, ?, ?)")
    .run(region.id, Number(number), String(name).trim(), nowIso());
  return getRoozkar(info.lastInsertRowid);
}

export function setActiveImport(roozkarId, importId) {
  db.prepare("UPDATE roozkars SET active_import_id = ? WHERE id = ?").run(importId, roozkarId);
}

/* ---------- Imports ---------- */

export function listImports(roozkarId) {
  return db
    .prepare("SELECT * FROM imports WHERE roozkar_id = ? ORDER BY id DESC")
    .all(Number(roozkarId));
}

export function getImport(id) {
  return db.prepare("SELECT * FROM imports WHERE id = ?").get(Number(id)) || null;
}

export function createImport(roozkarId, originalName, storedPath, rows, source = "excel") {
  const info = db
    .prepare(
      "INSERT INTO imports (roozkar_id, original_name, stored_path, rows, source, created_at) VALUES (?, ?, ?, ?, ?, ?)"
    )
    .run(Number(roozkarId), originalName, storedPath, rows, source, nowIso());
  return getImport(info.lastInsertRowid);
}

export function deleteImport(id) {
  db.prepare("DELETE FROM imports WHERE id = ?").run(Number(id));
}

/* ---------- Subscribers ---------- */

function debtCondition(debt) {
  if (debt === "lt1") return " AND s.debt > 0 AND s.debt < 1000000";
  if (debt === "1to10") return " AND s.debt >= 1000000 AND s.debt <= 10000000";
  if (debt === "gt10") return " AND s.debt > 10000000";
  return "";
}

function statusCondition(status) {
  if (status === "paid") return " AND s.debt = 0";
  if (status === "due") return " AND s.debt > 0";
  return "";
}

export function listSubscribers(opts) {
  const roozkar = getRoozkar(opts.roozkarId);
  if (!roozkar) return { rows: [], total: 0, page: 1, pageSize: 25, pages: 1 };

  const importId = opts.importId ? Number(opts.importId) : roozkar.active_import_id;
  const pageSize = Math.min(Math.max(Number(opts.pageSize) || 25, 5), 200);
  const page = Math.max(Number(opts.page) || 1, 1);
  const q = (opts.q || "").trim();

  const where = ["s.roozkar_id = ?"];
  const params = [Number(opts.roozkarId)];
  if (importId) {
    where.push("s.import_id = ?");
    params.push(importId);
  }
  if (q) {
    where.push("(s.name LIKE ? OR s.eshterak LIKE ? OR s.phone LIKE ? OR s.bill_id LIKE ? OR s.pay_id LIKE ? OR s.address LIKE ?)");
    const like = `%${q}%`;
    params.push(like, like, like, like, like, like);
  }

  const base = `FROM subscribers s WHERE ${where.join(" AND ")}${debtCondition(opts.debt)}${statusCondition(opts.status)}`;

  const total = db.prepare(`SELECT COUNT(*) AS c ${base}`).get(...params).c;
  const rows = db
    .prepare(`SELECT s.* ${base} ORDER BY s.debt DESC, s.id ASC LIMIT ? OFFSET ?`)
    .all(...params, pageSize, (page - 1) * pageSize);

  return { rows, total, page, pageSize, pages: Math.max(1, Math.ceil(total / pageSize)), importId };
}

/**
 * جست‌وجوی سراسری بین همه‌ی روزکارهای یک منطقه (یا همه‌ی مناطق).
 * فقط نسخه‌ی فعال هر روزکار جست‌وجو می‌شود تا ردیف‌های آرشیوی نتیجه را شلوغ نکنند.
 */
export function searchSubscribers({ q, regionId, limit = 60 }) {
  const term = String(q || "").trim();
  if (!term) return { rows: [], total: 0 };
  const like = `%${term}%`;

  const where = ["(s.name LIKE ? OR s.eshterak LIKE ? OR s.phone LIKE ? OR s.bill_id LIKE ? OR s.pay_id LIKE ? OR s.address LIKE ?)"];
  const params = [like, like, like, like, like, like];
  if (regionId) {
    where.push("r.region_id = ?");
    params.push(Number(regionId));
  }

  const base = `
    FROM subscribers s
    JOIN roozkars r ON r.id = s.roozkar_id
    JOIN regions g ON g.id = r.region_id
    WHERE (r.active_import_id IS NULL OR s.import_id = r.active_import_id)
      AND ${where.join(" AND ")}`;

  const total = db.prepare(`SELECT COUNT(*) AS c ${base}`).get(...params).c;
  const rows = db.prepare(`
    SELECT s.id, s.roozkar_id, s.eshterak, s.name, s.phone, s.debt, s.address, s.bill_id, s.pay_id,
           r.number AS roozkar_number, r.name AS roozkar_name, g.number AS region_number
    ${base}
    ORDER BY s.debt DESC, s.id ASC
    LIMIT ?
  `).all(...params, Math.min(Math.max(Number(limit) || 60, 1), 200));

  return { rows, total };
}

const INSERT_SUBSCRIBER = `
  INSERT INTO subscribers
    (roozkar_id, import_id, eshterak, name, address, last_pay, debt, bill_id, pay_id, phone, last_contact, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '', ?)
`;

function runInsert(stmt, roozkarId, data, importId) {
  return stmt.run(
    Number(roozkarId),
    importId ?? null,
    String(data.eshterak ?? "").trim(),
    String(data.name ?? "").trim(),
    String(data.address ?? "").trim(),
    String(data.last_pay ?? "").trim(),
    Math.max(0, Math.round(Number(data.debt) || 0)),
    String(data.bill_id ?? "").trim(),
    String(data.pay_id ?? "").trim(),
    String(data.phone ?? "").trim(),
    nowIso()
  );
}

export function addSubscriber(roozkarId, data, importId) {
  const roozkar = getRoozkar(roozkarId);
  if (!roozkar) return null;
  const resolvedImportId = importId === undefined ? roozkar.active_import_id ?? null : importId;
  const info = runInsert(db.prepare(INSERT_SUBSCRIBER), roozkarId, data, resolvedImportId);
  return db.prepare("SELECT * FROM subscribers WHERE id = ?").get(info.lastInsertRowid);
}

/**
 * درج گروهی در یک تراکنش — برای فایل‌های چندهزارتایی/صد هزارتایی.
 * بدون تراکنش، هر ردیف جداگانه commit می‌شود و ورود بسیار کند خواهد بود.
 */
export function addSubscribersBulk(roozkarId, rows, importId) {
  const roozkar = getRoozkar(roozkarId);
  if (!roozkar) return 0;
  const resolvedImportId = importId === undefined ? roozkar.active_import_id ?? null : importId;
  const stmt = db.prepare(INSERT_SUBSCRIBER);

  db.exec("BEGIN");
  try {
    for (const data of rows) runInsert(stmt, roozkarId, data, resolvedImportId);
    db.exec("COMMIT");
  } catch (err) {
    try { db.exec("ROLLBACK"); } catch { /* ignore */ }
    throw err;
  }
  return rows.length;
}

export function getSubscriber(id) {
  return db.prepare("SELECT * FROM subscribers WHERE id = ?").get(Number(id)) || null;
}

export function deleteSubscriber(id) {
  const sub = getSubscriber(id);
  if (!sub) return null;
  db.prepare("DELETE FROM subscribers WHERE id = ?").run(Number(id));
  return sub;
}

export function markContact(ids, label) {
  if (!ids.length) return 0;
  const stmt = db.prepare("UPDATE subscribers SET last_contact = ? WHERE id = ?");
  let n = 0;
  for (const id of ids) {
    stmt.run(label, Number(id));
    n++;
  }
  return n;
}

function recipientFilter({ roozkarId, regionId, debt }) {
  const where = ["s.debt > 0"];
  const params = [];

  if (roozkarId) {
    const roozkar = getRoozkar(roozkarId);
    if (!roozkar) return null;
    where.push("s.roozkar_id = ?");
    params.push(roozkar.id);
    if (roozkar.active_import_id != null) {
      where.push("s.import_id = ?");
      params.push(roozkar.active_import_id);
    }
  } else if (regionId) {
    where.push(
      "s.roozkar_id IN (SELECT r.id FROM roozkars r WHERE r.region_id = ? AND (r.active_import_id IS NULL OR s.import_id = r.active_import_id))"
    );
    params.push(Number(regionId));
  }

  return { sql: `${where.join(" AND ")}${debtCondition(debt)}`, params };
}

export function recipients({ roozkarId, regionId, debt, limit }) {
  const filter = recipientFilter({ roozkarId, regionId, debt });
  if (!filter) return [];
  const cap = limit ? ` LIMIT ${Math.max(1, Math.floor(Number(limit)))}` : "";
  return db
    .prepare(`SELECT s.* FROM subscribers s WHERE ${filter.sql} ORDER BY s.debt DESC, s.id ASC${cap}`)
    .all(...filter.params);
}

/** آمار گیرندگان بدون بارگذاری همه‌ی ردیف‌ها در حافظه. */
export function recipientStats({ roozkarId, regionId, debt }) {
  const filter = recipientFilter({ roozkarId, regionId, debt });
  if (!filter) return { count: 0, withPhone: 0, debt: 0 };
  return db
    .prepare(
      `SELECT COUNT(*) AS count,
              COALESCE(SUM(CASE WHEN s.phone IS NOT NULL AND s.phone <> '' THEN 1 ELSE 0 END), 0) AS withPhone,
              COALESCE(SUM(s.debt), 0) AS debt
       FROM subscribers s WHERE ${filter.sql}`
    )
    .get(...filter.params);
}

/* ---------- Sends ---------- */

export function addSend(data) {
  const info = db
    .prepare("INSERT INTO sends (type, count, scope, message, status, provider, detail, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
    .run(
      data.type,
      data.count,
      data.scope ?? "",
      data.message ?? "",
      data.status,
      data.provider ?? "",
      data.detail ? JSON.stringify(data.detail) : "",
      nowIso()
    );
  return db.prepare("SELECT * FROM sends WHERE id = ?").get(info.lastInsertRowid);
}

export function listSends(limit = 50) {
  return db.prepare("SELECT * FROM sends ORDER BY id DESC LIMIT ?").all(Number(limit));
}

export function topDebtors(limit = 5, regionId) {
  const where = ["s.debt > 0", "(r.active_import_id IS NULL OR s.import_id = r.active_import_id)"];
  const params = [];
  if (regionId) {
    where.push("r.region_id = ?");
    params.push(Number(regionId));
  }
  return db
    .prepare(
      `SELECT s.name, s.address, s.debt, s.eshterak, s.phone, r.number AS roozkar_number
       FROM subscribers s
       JOIN roozkars r ON r.id = s.roozkar_id
       WHERE ${where.join(" AND ")}
       ORDER BY s.debt DESC
       LIMIT ?`
    )
    .all(...params, Number(limit));
}

/* ---------- Stats ---------- */

export function stats(regionId) {
  const scoped = !!regionId;
  const join = "JOIN roozkars r ON r.id = s.roozkar_id" + (scoped ? " AND r.region_id = ?" : "");
  const params = scoped ? [Number(regionId)] : [];
  const active = "(r.active_import_id IS NULL OR s.import_id = r.active_import_id)";

  const subs = db
    .prepare(`SELECT COUNT(*) AS c, COALESCE(SUM(s.debt), 0) AS debt FROM subscribers s ${join} WHERE ${active}`)
    .get(...params);
  const due = db
    .prepare(`SELECT COUNT(*) AS c FROM subscribers s ${join} WHERE ${active} AND s.debt > 0`)
    .get(...params);
  const roozkars = scoped
    ? db.prepare("SELECT COUNT(*) AS c FROM roozkars WHERE region_id = ?").get(Number(regionId))
    : db.prepare("SELECT COUNT(*) AS c FROM roozkars").get();
  const sends = db.prepare("SELECT COUNT(*) AS c FROM sends").get();
  const files = scoped
    ? db.prepare("SELECT COUNT(*) AS c FROM imports i JOIN roozkars r ON r.id = i.roozkar_id WHERE r.region_id = ?").get(Number(regionId))
    : db.prepare("SELECT COUNT(*) AS c FROM imports").get();
  return {
    roozkars: roozkars.c,
    subscribers: subs.c,
    debt: subs.debt,
    due: due.c,
    sends: sends.c,
    files: files.c,
  };
}

/* ---------- SMS templates ---------- */

export function listTemplates() {
  return db.prepare("SELECT * FROM sms_templates ORDER BY id DESC").all();
}

export function getTemplate(id) {
  return db.prepare("SELECT * FROM sms_templates WHERE id = ?").get(Number(id)) || null;
}

export function createTemplate(title, body) {
  const now = nowIso();
  const info = db
    .prepare("INSERT INTO sms_templates (title, body, created_at, updated_at) VALUES (?, ?, ?, ?)")
    .run(String(title).trim(), String(body), now, now);
  return getTemplate(info.lastInsertRowid);
}

export function updateTemplate(id, title, body) {
  db.prepare("UPDATE sms_templates SET title = ?, body = ?, updated_at = ? WHERE id = ?")
    .run(String(title).trim(), String(body), nowIso(), Number(id));
  return getTemplate(id);
}

export function deleteTemplate(id) {
  const tpl = getTemplate(id);
  if (!tpl) return null;
  db.prepare("DELETE FROM sms_templates WHERE id = ?").run(Number(id));
  return tpl;
}

/* ---------- Voice samples ---------- */

export function listVoiceSamples() {
  return db.prepare("SELECT * FROM voice_samples ORDER BY debt_min, id").all();
}

export function getVoiceSample(id) {
  return db.prepare("SELECT * FROM voice_samples WHERE id = ?").get(Number(id)) || null;
}

export function createVoiceSample(data) {
  const info = db
    .prepare(
      `INSERT INTO voice_samples (title, original_name, stored_path, mime, size, debt_min, debt_max, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      String(data.title).trim(),
      String(data.original_name || ""),
      String(data.stored_path),
      String(data.mime || ""),
      Number(data.size) || 0,
      Math.max(0, Number(data.debt_min) || 0),
      Math.max(0, Number(data.debt_max) || 0),
      nowIso()
    );
  return getVoiceSample(info.lastInsertRowid);
}

export function updateVoiceSample(id, data) {
  db.prepare("UPDATE voice_samples SET title = ?, debt_min = ?, debt_max = ? WHERE id = ?").run(
    String(data.title).trim(),
    Math.max(0, Number(data.debt_min) || 0),
    Math.max(0, Number(data.debt_max) || 0),
    Number(id)
  );
  return getVoiceSample(id);
}

export function deleteVoiceSample(id) {
  const sample = getVoiceSample(id);
  if (!sample) return null;
  db.prepare("DELETE FROM voice_samples WHERE id = ?").run(Number(id));
  return sample;
}

/** انتخاب فایل صوتی مناسب بر اساس بازه‌ی بدهی؛ بازه‌ی بدون سقف با debt_max = 0 مشخص می‌شود. */
export function matchVoiceSample(samples, debt) {
  return (
    samples.find((s) => debt >= s.debt_min && (s.debt_max === 0 || debt <= s.debt_max)) ||
    samples.find((s) => s.debt_min === 0 && s.debt_max === 0) ||
    null
  );
}

/* ---------- Provider configs ---------- */

const PROVIDER_DEFAULTS = {
  provider: "simulate",
  base_url: "",
  api_key: "",
  sender: "",
  auth_header: "Authorization",
  auth_prefix: "Bearer ",
  method: "POST",
  payload: "",
};

export function getProviderConfig(kind) {
  const row = db.prepare("SELECT * FROM provider_configs WHERE kind = ?").get(String(kind));
  return { kind, ...PROVIDER_DEFAULTS, ...(row || {}) };
}

export function saveProviderConfig(kind, data) {
  const current = getProviderConfig(kind);
  const next = { ...current, ...data };
  db.prepare(
    `INSERT INTO provider_configs (kind, provider, base_url, api_key, sender, auth_header, auth_prefix, method, payload, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(kind) DO UPDATE SET
       provider = excluded.provider,
       base_url = excluded.base_url,
       api_key = excluded.api_key,
       sender = excluded.sender,
       auth_header = excluded.auth_header,
       auth_prefix = excluded.auth_prefix,
       method = excluded.method,
       payload = excluded.payload,
       updated_at = excluded.updated_at`
  ).run(
    String(kind),
    String(next.provider || "simulate").toLowerCase(),
    String(next.base_url || "").trim(),
    String(next.api_key || ""),
    String(next.sender || ""),
    String(next.auth_header || "Authorization"),
    String(next.auth_prefix ?? "Bearer "),
    String(next.method || "POST").toUpperCase() === "GET" ? "GET" : "POST",
    String(next.payload || ""),
    nowIso()
  );
  return getProviderConfig(kind);
}

/* ---------- Settings ---------- */

export function getSetting(key) {
  const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(key);
  return row ? row.value : null;
}

export function setSetting(key, value) {
  db.prepare(
    "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
  ).run(key, String(value));
}
