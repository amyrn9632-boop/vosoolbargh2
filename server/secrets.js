import crypto from "node:crypto";

/**
 * رمزنگاری مقادیر حساس (کلید API) در پایگاه‌داده.
 * کلید از SESSION_SECRET مشتق می‌شود؛ پس تغییر SESSION_SECRET یعنی
 * کلیدهای ذخیره‌شده باید دوباره وارد شوند.
 */

const SECRET = process.env.DATA_SECRET || process.env.SESSION_SECRET || "vosol-local-dev";
const KEY = crypto.createHash("sha256").update(`vosol-secrets:${SECRET}`).digest();

export function encrypt(text) {
  if (!text) return "";
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", KEY, iv);
  const enc = Buffer.concat([cipher.update(String(text), "utf8"), cipher.final()]);
  return `enc1:${iv.toString("base64url")}:${cipher.getAuthTag().toString("base64url")}:${enc.toString("base64url")}`;
}

export function decrypt(value) {
  if (!value) return "";
  const raw = String(value);
  if (!raw.startsWith("enc1:")) return raw;
  const parts = raw.split(":");
  if (parts.length !== 4) return "";
  try {
    const iv = Buffer.from(parts[1], "base64url");
    const tag = Buffer.from(parts[2], "base64url");
    const data = Buffer.from(parts[3], "base64url");
    const decipher = crypto.createDecipheriv("aes-256-gcm", KEY, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
  } catch {
    return "";
  }
}

export function maskSecret(value) {
  if (!value) return "";
  const text = String(value);
  if (text.length <= 4) return "••••";
  return `••••${text.slice(-4)}`;
}
