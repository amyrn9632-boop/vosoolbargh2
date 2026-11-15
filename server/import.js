import XLSX from "xlsx";

const FA_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
const AR_DIGITS = "٠١٢٣٤٥٦٧٨٩";

export function toLatinDigits(input) {
  if (input == null) return "";
  return String(input)
    .replace(/[۰-۹]/g, (d) => String(FA_DIGITS.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String(AR_DIGITS.indexOf(d)));
}

function normalizeHeader(value) {
  return toLatinDigits(String(value ?? ""))
    .replace(/[\u200c\u200f\u200e\u00a0\u202f\u2009]/g, " ")
    .replace(/[يى]/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/[()\[\]،,.:;؛\-_/\\]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const ALIASES = {
  eshterak: ["اشتراک", "شماره اشتراک", "شماره اشتراك", "اشتراك", "پرونده", "شماره پرونده"],
  name: ["مشترک", "نام مشترک", "نام و نام خانوادگی", "نام", "مشترك"],
  address: ["آدرس", "نشانی", "ادرس", "آدرس محل مصرف"],
  last_pay: ["تاریخ آخرین پرداخت", "تاریخ آخرین پرداختی", "آخرین پرداخت", "تاریخ پرداخت", "اخرین پرداخت"],
  debt: ["مبلغ بدهی", "بدهی", "مبلغ بدهی ریال", "مانده بدهی", "مبلغ"],
  bill_id: ["شناسه قبض", "شماره قبض", "شناسه قبوض"],
  pay_id: ["شناسه پرداخت", "شماره پرداخت", "شناسه پرداختی", "شناسه پرداخد", "شناسهپرداخت"],
  phone: [
    "شماره تماس",
    "تلفن",
    "موبایل",
    "شماره موبایل",
    "تلفن همراه",
    "همراه",
    "شماره همراه",
    "شماره تماس مشترک",
    "تلفن مشترک",
    "موبایل مشترک",
    "شماره همراه مشترک",
    "تلفن ثابت",
    "تلفن منزل",
  ],
};

const FIELD_ORDER = ["eshterak", "name", "address", "last_pay", "debt", "bill_id", "pay_id", "phone"];

function matchField(header) {
  const h = normalizeHeader(header);
  if (!h) return null;
  const compact = h.replace(/\s+/g, "");
  for (const field of FIELD_ORDER) {
    for (const alias of ALIASES[field]) {
      const a = normalizeHeader(alias);
      if (h === a || compact === a.replace(/\s+/g, "")) return field;
    }
  }
  for (const field of FIELD_ORDER) {
    for (const alias of ALIASES[field]) {
      const a = normalizeHeader(alias);
      if (a.length >= 3 && (h.includes(a) || compact.includes(a.replace(/\s+/g, "")))) return field;
    }
  }
  return null;
}

export { matchField };

export function matchFieldExact(header) {
  const h = normalizeHeader(header);
  if (!h) return null;
  const compact = h.replace(/\s+/g, "");
  for (const field of FIELD_ORDER) {
    for (const alias of ALIASES[field]) {
      const a = normalizeHeader(alias);
      if (h === a || compact === a.replace(/\s+/g, "")) return field;
    }
  }
  return null;
}

function parseMoney(value) {
  if (value == null || value === "") return 0;
  if (typeof value === "number" && isFinite(value)) return Math.max(0, Math.round(value));
  const cleaned = toLatinDigits(value).replace(/[^\d.-]/g, "");
  const n = Number(cleaned);
  return isFinite(n) ? Math.max(0, Math.round(n)) : 0;
}

function parseDigits(value) {
  return toLatinDigits(value).replace(/\D/g, "");
}

function parsePhone(value) {
  let d = parseDigits(value);
  if (!d) return "";
  if (d.startsWith("0098")) d = "0" + d.slice(4);
  else if (d.startsWith("98") && d.length > 10) d = "0" + d.slice(2);
  else if (d.length === 10 && d.startsWith("9")) d = "0" + d;
  return d;
}

function pad2(n) {
  return n < 10 ? "0" + n : String(n);
}

function gregorianToJalali(gy, gm, gd) {
  const gDM = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  let jy = gy <= 1600 ? 0 : 979;
  const g = gy <= 1600 ? gy - 621 : gy - 1600;
  const g2 = gm > 2 ? g + 1 : g;
  let days =
    365 * g +
    Math.floor((g2 + 3) / 4) -
    Math.floor((g2 + 99) / 100) +
    Math.floor((g2 + 399) / 400) -
    80 +
    gd +
    gDM[gm - 1];
  jy += 33 * Math.floor(days / 12053);
  days %= 12053;
  jy += 4 * Math.floor(days / 1461);
  days %= 1461;
  if (days > 365) {
    jy += Math.floor((days - 1) / 365);
    days = (days - 1) % 365;
  }
  const jm = days < 186 ? 1 + Math.floor(days / 31) : 7 + Math.floor((days - 186) / 30);
  const jd = 1 + (days < 186 ? days % 31 : (days - 186) % 30);
  return { jy, jm, jd };
}

function excelSerialToJalali(serial) {
  // Excel epoch: 1899-12-30
  const ms = Math.round(serial * 86400 * 1000) + Date.UTC(1899, 11, 30);
  const d = new Date(ms);
  const j = gregorianToJalali(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
  return `${j.jy}/${pad2(j.jm)}/${pad2(j.jd)}`;
}

function normalizeDate(value) {
  if (value == null || value === "") return "";
  if (typeof value === "number" && value > 1000 && value < 80000) {
    return excelSerialToJalali(value);
  }
  if (value instanceof Date) {
    const j = gregorianToJalali(value.getFullYear(), value.getMonth() + 1, value.getDate());
    return `${j.jy}/${pad2(j.jm)}/${pad2(j.jd)}`;
  }
  const s = toLatinDigits(String(value)).trim();
  const m = s.match(/(\d{4})\D+(\d{1,2})\D+(\d{1,2})/);
  if (m) return `${m[1]}/${pad2(Number(m[2]))}/${pad2(Number(m[3]))}`;
  return s;
}

export function detectMapping(headerRow) {
  const mapping = {};
  const headers = [];
  (headerRow || []).forEach((cell, index) => {
    const field = matchField(cell);
    headers.push(String(cell ?? "").trim());
    if (field && mapping[field] == null) mapping[field] = index;
  });
  return { mapping, headers };
}

export function parseSpreadsheet(buffer, filename = "") {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: false, raw: true });
  if (!workbook.SheetNames.length) throw new Error("فایل هیچ شیتی ندارد.");

  // همه‌ی شیت‌ها را بررسی می‌کنیم؛ شیتی که بیشترین ستون‌های شناخته‌شده را دارد انتخاب می‌شود.
  const candidates = [];
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;
    const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: "" });
    if (!matrix.length) continue;

    let best = null;
    const limit = Math.min(matrix.length, 20);
    for (let i = 0; i < limit; i++) {
      const detected = detectMapping(matrix[i]);
      const found = Object.keys(detected.mapping).length;
      if (found >= 2 && detected.mapping.name != null) {
        if (!best || found > Object.keys(best.mapping).length) {
          best = { mapping: detected.mapping, headers: detected.headers, headerIndex: i };
        }
      }
    }
    if (best) candidates.push({ sheetName, matrix, ...best });
  }

  if (!candidates.length) {
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    const firstMatrix = XLSX.utils.sheet_to_json(firstSheet, { header: 1, raw: true, defval: "" });
    const firstRow = (firstMatrix[0] || []).map((c) => String(c ?? "").trim()).filter(Boolean).slice(0, 10);
    throw new Error(
      "ستون «مشترک» در هیچ شیتی پیدا نشد. سرستون‌های شیت اول: " +
        (firstRow.join(" | ") || "خالی") +
        " — حداقل ستون‌های «مشترک» و «مبلغ بدهی» لازم است."
    );
  }

  candidates.sort((a, b) => Object.keys(b.mapping).length - Object.keys(a.mapping).length);
  const { sheetName, matrix, mapping, headers, headerIndex } = candidates[0];

  const rows = [];
  const warnings = [];
  let skipped = 0;

  if (mapping.phone == null) {
    warnings.push("ستون «شماره تماس» در فایل پیدا نشد؛ برای ارسال پیامک یا تماس، این ستون لازم است.");
  }
  if (mapping.debt == null) {
    warnings.push("ستون «مبلغ بدهی» پیدا نشد؛ مبلغ همه‌ی ردیف‌ها صفر ثبت می‌شود.");
  }
  if (mapping.bill_id == null) {
    warnings.push("ستون «شناسه قبض» پیدا نشد؛ برای تطبیق پرداخت‌ها در آینده لازم می‌شود.");
  }

  for (let i = headerIndex + 1; i < matrix.length; i++) {
    const raw = matrix[i] || [];
    const get = (field) => (mapping[field] == null ? "" : raw[mapping[field]]);

    const name = String(toLatinDigits(get("name")) ?? "").trim();
    const eshterak = parseDigits(get("eshterak"));
    const debt = parseMoney(get("debt"));

    if (!name && !eshterak) {
      skipped++;
      continue;
    }
    if (!name) {
      warnings.push(`ردیف ${i + 1}: نام مشترک خالی است.`);
      continue;
    }

    const bill = parseDigits(get("bill_id"));
    if (bill && bill.length !== 13) warnings.push(`ردیف ${i + 1}: شناسه قبض ${bill.length} رقمی است (باید ۱۳ رقم باشد).`);

    rows.push({
      eshterak,
      name,
      address: String(get("address") ?? "").trim(),
      last_pay: normalizeDate(get("last_pay")),
      debt,
      bill_id: bill,
      pay_id: parseDigits(get("pay_id")),
      phone: parsePhone(get("phone")),
    });
  }

  return {
    rows,
    headers,
    mapping,
    mappingLabels: Object.fromEntries(
      Object.entries(mapping).map(([field, index]) => [field, headers[index] || `ستون ${index + 1}`])
    ),
    skipped,
    warnings: warnings.slice(0, 30),
    sheetName,
    filename,
  };
}

export const COLUMN_LABELS = {
  eshterak: "اشتراک",
  name: "مشترک",
  address: "آدرس",
  last_pay: "تاریخ آخرین پرداخت",
  debt: "مبلغ بدهی",
  bill_id: "شناسه قبض",
  pay_id: "شناسه پرداخت",
  phone: "شماره تماس",
};
