/**
 * آداپتور ارسال پیامک و پیام صوتی.
 * تنظیمات از جدول provider_configs خوانده می‌شود (صفحه‌ی تنظیمات).
 * provider = simulate | kavenegar | webhook | custom
 */

import { getProviderConfig } from "./db.js";
import { decrypt } from "./secrets.js";

const MAX_PER_BATCH = Number(process.env.MAX_SEND_PER_BATCH || 500);

function resolveConfig(kind) {
  const row = getProviderConfig(kind);
  return {
    kind,
    provider: String(row.provider || "simulate").toLowerCase(),
    baseUrl: String(row.base_url || "").trim(),
    apiKey: decrypt(row.api_key || ""),
    sender: String(row.sender || "").trim(),
    authHeader: String(row.auth_header || "").trim(),
    authPrefix: String(row.auth_prefix ?? "Bearer "),
    method: String(row.method || "POST").toUpperCase() === "GET" ? "GET" : "POST",
    payload: String(row.payload || "").trim(),
  };
}

function isConfigured(config) {
  if (config.provider === "simulate") return true;
  if (config.provider === "kavenegar") return !!config.apiKey;
  if (config.provider === "webhook" || config.provider === "custom") return !!config.baseUrl;
  return false;
}

export function providerInfo(kind = "sms") {
  const config = resolveConfig(kind);
  return {
    kind,
    provider: config.provider,
    configured: isConfigured(config),
    maxPerBatch: MAX_PER_BATCH,
  };
}

export function allProviderInfo() {
  return { sms: providerInfo("sms"), voice: providerInfo("voice") };
}

export function applyTemplate(template, sub, context = {}) {
  return String(template || "")
    .replace(/\{name\}/g, sub?.name ?? "")
    .replace(/\{debt\}/g, sub?.debt != null ? Number(sub.debt).toLocaleString("en-US") : "")
    .replace(/\{eshterak\}/g, sub?.eshterak ?? "")
    .replace(/\{address\}/g, sub?.address ?? "")
    .replace(/\{phone\}/g, sub?.phone ?? "")
    .replace(/\{bill_id\}/g, sub?.bill_id ?? "")
    .replace(/\{pay_id\}/g, sub?.pay_id ?? "")
    .replace(/\{roozkar\}/g, context.roozkarNumber != null ? String(context.roozkarNumber) : "")
    .replace(/\{region\}/g, context.regionName ?? "");
}

const DEFAULT_PAYLOAD =
  '{"to":"{phone}","message":"{message}","sender":"{sender}","type":"{type}","audio_url":"{audio_url}","audio_title":"{audio_title}"}';

function fillPayload(template, vars) {
  return String(template || DEFAULT_PAYLOAD).replace(/\{(\w+)\}/g, (match, key) =>
    vars[key] != null ? String(vars[key]) : ""
  );
}

function authHeaders(config) {
  const headers = { "content-type": "application/json", accept: "application/json" };
  if (config.apiKey && config.authHeader) {
    headers[config.authHeader] = `${config.authPrefix}${config.apiKey}`;
  }
  return headers;
}

async function sendCustomOne(config, sub, message, context) {
  if (!config.baseUrl) throw new Error("آدرس سرویس (Base URL) تنظیم نشده است.");
  if (!sub.phone) throw new Error("شماره تماس ندارد.");

  const vars = {
    phone: sub.phone,
    name: sub.name ?? "",
    debt: sub.debt ?? 0,
    eshterak: sub.eshterak ?? "",
    bill_id: sub.bill_id ?? "",
    pay_id: sub.pay_id ?? "",
    message: message ?? "",
    sender: config.sender,
    type: context.type || "sms",
    audio_url: context.voiceUrl || "",
    audio_title: context.voiceTitle || "",
    roozkar: context.roozkarNumber ?? "",
    region: context.regionName ?? "",
  };

  const payloadText = fillPayload(config.payload, vars);
  let payload;
  try {
    payload = JSON.parse(payloadText);
  } catch {
    throw new Error("قالب JSON در تنظیمات سرویس معتبر نیست.");
  }

  let url = config.baseUrl;
  const init = { method: config.method, headers: authHeaders(config) };

  if (config.method === "GET") {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(payload)) {
      if (value == null || typeof value === "object") continue;
      params.set(key, String(value));
    }
    const sep = url.includes("?") ? "&" : "?";
    url = `${url}${sep}${params.toString()}`;
  } else {
    init.body = JSON.stringify(payload);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    const text = (await res.text()).slice(0, 300);
    if (!res.ok) throw new Error(`سرویس پیام خطا داد (${res.status}): ${text}`);
    return { ok: true };
  } catch (err) {
    if (err.name === "AbortError") throw new Error("پاسخی از سرویس پیام در ۱۵ ثانیه دریافت نشد.");
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

async function sendViaKavenegar(config, type, sub, message) {
  if (!config.apiKey) throw new Error("کلید API کاوه‌نگار تنظیم نشده است.");
  const base = `https://api.kavenegar.com/v1/${encodeURIComponent(config.apiKey)}`;
  const receptor = sub.phone;
  if (!receptor) throw new Error("شماره تماس ندارد.");

  let url;
  if (type === "voice") {
    if (!message) throw new Error("کاوه‌نگار برای تماس صوتی به متن پیام نیاز دارد.");
    url = `${base}/call/maketss.json?receptor=${encodeURIComponent(receptor)}&message=${encodeURIComponent(message)}&repeat=1`;
  } else {
    url = `${base}/sms/send.json?receptor=${encodeURIComponent(receptor)}&message=${encodeURIComponent(message)}`;
    if (config.sender) url += `&sender=${encodeURIComponent(config.sender)}`;
  }

  const res = await fetch(url, { method: "GET" });
  const text = await res.text();
  if (!res.ok) throw new Error(`کاوه‌نگار خطا داد (${res.status}): ${text.slice(0, 200)}`);
  let data;
  try { data = JSON.parse(text); } catch { data = null; }
  const status = data?.return?.status;
  if (status != null && status !== 200) {
    throw new Error(`کاوه‌نگار: ${data?.return?.message || "خطای نامشخص"}`);
  }
  return { providerMessageId: data?.entries?.[0]?.messageid ?? null };
}

async function sendViaWebhook(config, type, recipients, message, context) {
  if (!config.baseUrl) throw new Error("آدرس وب‌هوک تنظیم نشده است.");
  const res = await fetch(config.baseUrl, {
    method: "POST",
    headers: authHeaders(config),
    body: JSON.stringify({
      type,
      message,
      sender: config.sender,
      audio_url: context.voiceUrl || "",
      audio_title: context.voiceTitle || "",
      recipients: recipients.map((s) => ({
        id: s.id,
        name: s.name,
        phone: s.phone,
        debt: s.debt,
        eshterak: s.eshterak,
        bill_id: s.bill_id,
        pay_id: s.pay_id,
      })),
    }),
  });
  const text = (await res.text()).slice(0, 300);
  if (!res.ok) throw new Error(`وب‌هوک ارسال خطا داد (${res.status}): ${text}`);
  return { ok: true };
}

async function runPool(items, concurrency, worker) {
  let cursor = 0;
  async function run() {
    while (cursor < items.length) {
      const index = cursor++;
      await worker(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, run));
}

export async function sendBatch({ type, recipients, message, context = {} }) {
  const kind = type === "voice" ? "voice" : "sms";
  const config = resolveConfig(kind);
  const list = recipients.filter((s) => s.phone);
  const skipped = recipients.length - list.length;
  const limited = list.slice(0, MAX_PER_BATCH);
  const overflow = list.length - limited.length;

  if (config.provider === "simulate") {
    await new Promise((r) => setTimeout(r, 300));
    return {
      status: "simulated",
      provider: "simulate",
      sent: limited.length,
      failed: 0,
      skipped: skipped + overflow,
      failures: [],
      note: `حالت شبیه‌سازی فعال است؛ برای ارسال واقعی تنظیمات «${kind === "voice" ? "پیامک صوتی" : "پیامک متنی"}» را کامل کنید.`,
    };
  }

  if (!isConfigured(config)) {
    throw new Error(
      `سرویس ${kind === "voice" ? "پیام صوتی" : "پیامک"} تنظیم نشده است. در صفحه‌ی تنظیمات آدرس و کلید API را وارد کنید.`
    );
  }

  if (config.provider === "webhook") {
    let sent = 0;
    let failed = 0;
    const failures = [];
    try {
      await sendViaWebhook(config, type, limited, message, context);
      sent = limited.length;
    } catch (err) {
      failed = limited.length;
      failures.push({ error: err.message });
    }
    return { status: failed ? "failed" : "sent", provider: "webhook", sent, failed, skipped: skipped + overflow, failures };
  }

  let sent = 0;
  let failed = 0;
  const failures = [];

  await runPool(limited, 5, async (sub) => {
    const text = applyTemplate(message, sub, context);
    try {
      if (config.provider === "kavenegar") {
        await sendViaKavenegar(config, type, sub, text);
      } else {
        await sendCustomOne(config, sub, text, { ...context, type });
      }
      sent++;
    } catch (err) {
      failed++;
      if (failures.length < 20) failures.push({ id: sub.id, name: sub.name, error: err.message });
    }
  });

  return {
    status: failed === 0 ? "sent" : sent === 0 ? "failed" : "partial",
    provider: config.provider,
    sent,
    failed,
    skipped: skipped + overflow,
    failures,
  };
}
