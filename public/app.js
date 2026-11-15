/* وصول مطالبات امور برق ۲ زاهدان — رابط کاربری متصل به API */
(function () {
  "use strict";

  /* ---------- Helpers ---------- */

  var FA = "۰۱۲۳۴۵۶۷۸۹";
  function toFa(v) { return String(v).replace(/[0-9]/g, function (d) { return FA[Number(d)]; }); }
  function faToEn(v) {
    return String(v).replace(/[۰-۹]/g, function (d) { return String(FA.indexOf(d)); })
      .replace(/[٠-٩]/g, function (d) { return String("٠١٢٣٤٥٦٧٨٩".indexOf(d)); });
  }
  function fmtNum(n) {
    var s = Math.round(Number(n) || 0).toString();
    var out = "";
    for (var i = 0; i < s.length; i++) {
      out += s[i];
      var left = s.length - i;
      if (left > 1 && (left - 1) % 3 === 0) out += "،";
    }
    return toFa(out);
  }
  function compact(n) {
    n = Number(n) || 0;
    if (n >= 1000000000) return toFa((n / 1000000000).toFixed(1).replace(".", "٫")) + " میلیارد";
    if (n >= 1000000) return toFa((n / 1000000).toFixed(1).replace(".", "٫")) + " میلیون";
    if (n >= 1000) return toFa(Math.round(n / 1000)) + " هزار";
    return fmtNum(n);
  }
  function pad2(n) { return n < 10 ? "0" + n : String(n); }
  function gregToJalali(date) {
    var gy = date.getFullYear(), gm = date.getMonth() + 1, gd = date.getDate();
    var gDM = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
    var jy = gy <= 1600 ? 0 : 979;
    var g = gy <= 1600 ? gy - 621 : gy - 1600;
    var g2 = gm > 2 ? g + 1 : g;
    var days = 365 * g + Math.floor((g2 + 3) / 4) - Math.floor((g2 + 99) / 100) +
      Math.floor((g2 + 399) / 400) - 80 + gd + gDM[gm - 1];
    jy += 33 * Math.floor(days / 12053); days %= 12053;
    jy += 4 * Math.floor(days / 1461); days %= 1461;
    if (days > 365) { jy += Math.floor((days - 1) / 365); days = (days - 1) % 365; }
    var jm = days < 186 ? 1 + Math.floor(days / 31) : 7 + Math.floor((days - 186) / 30);
    var jd = 1 + (days < 186 ? days % 31 : (days - 186) % 30);
    return toFa(jy + "/" + pad2(jm) + "/" + pad2(jd));
  }
  function formatDateTime(iso) {
    if (!iso) return "";
    var d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return gregToJalali(d) + " — " + toFa(pad2(d.getHours()) + ":" + pad2(d.getMinutes()));
  }
  function esc(t) {
    return String(t == null ? "" : t).replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  /* ---------- Icons ---------- */

  var I = {
    bolt: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z"/></svg>',
    users: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
    layers: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 3 7.5l9 4.5 9-4.5L12 3Z"/><path d="m3 12 9 4.5 9-4.5"/><path d="m3 16.5 9 4.5 9-4.5"/></svg>',
    wallet: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M20 12V8a2 2 0 0 0-2-2H5a2 2 0 0 1 0-4h13"/><path d="M3 6v12a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-4"/><path d="M18 12a2 2 0 0 0 0 4h4v-4h-4Z"/></svg>',
    send: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="m22 2-7 20-4-9-9-4 20-7Z"/><path d="M22 2 11 13"/></svg>',
    mic: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0"/><path d="M12 17v5"/><path d="M8 22h8"/></svg>',
    upload: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m17 8-5-5-5 5"/><path d="M12 3v12"/></svg>',
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>',
    file: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6"/><path d="M8 13h8M8 17h5"/></svg>',
    image: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-4.5-4.5L3 21"/></svg>',
    trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m20 6-11 11-5-5"/></svg>',
    x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>',
    back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>',
    alert: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/></svg>',
    shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/></svg>',
    chart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="M7 15v3M12 10v8M17 6v12"/></svg>',
    pin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s7-6.3 7-11a7 7 0 1 0-14 0c0 4.7 7 11 7 11Z"/><circle cx="12" cy="10" r="2.5"/></svg>',
    volume: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H2v6h4l5 4V5Z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.5 6a9 9 0 0 1 0 12"/></svg>',
    play: '<svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M8 5v14l11-7z"/></svg>',
    edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>',
    save: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z"/><path d="M17 21v-8H7v8"/><path d="M7 3v5h8"/></svg>',
    logout: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/></svg>'
  };

  /* ---------- API ---------- */

  async function api(path, opts) {
    opts = opts || {};
    var init = { method: opts.method || "GET", credentials: "same-origin", headers: {} };
    if (opts.form) init.body = opts.form;
    else if (opts.body) {
      init.headers["content-type"] = "application/json";
      init.body = JSON.stringify(opts.body);
    }
    var res = await fetch(path, init);
    var data = {};
    try { data = await res.json(); } catch (e) { data = {}; }
    if (res.status === 401) {
      showLogin();
      throw new Error("نیاز به ورود مجدد است.");
    }
    if (!res.ok) throw new Error(data.error || "خطای سرور (" + res.status + ")");
    return data;
  }

  /* ---------- State ---------- */

  var state = {
    meta: null,
    stats: null,
    sends: [],
    top: [],
    roozkars: [],
    regions: [],
    templates: [],
    voiceSamples: [],
    settings: null,
    view: { name: "dashboard" },
    detail: null,
    filters: { q: "", debt: "all", status: "all" },
    importToken: null,
    ocrRows: [],
    regionId: (function () {
      try { var v = Number(localStorage.getItem("vosol_region")); return v || null; } catch (e) { return null; }
    })(),
    globalQuery: "",
    globalResults: null
  };

  var qTimer = null;
  var gqTimer = null;

  /* ---------- Toast / Modal ---------- */

  function toast(message, kind) {
    var root = document.getElementById("toastRoot");
    var el = document.createElement("div");
    el.className = "toast " + (kind || "ok");
    el.innerHTML = (kind === "err" ? I.alert : I.check) + "<span>" + esc(message) + "</span>";
    root.appendChild(el);
    setTimeout(function () {
      el.style.opacity = "0";
      el.style.transition = "opacity 200ms";
      setTimeout(function () { el.remove(); }, 220);
    }, 3600);
  }

  function openModal(inner, wide) {
    var root = document.getElementById("modalRoot");
    root.innerHTML = '<div class="modal-back" id="modalBack"><div class="modal' + (wide ? " wide" : "") +
      '" role="dialog" aria-modal="true">' + inner + "</div></div>";
    var back = document.getElementById("modalBack");
    back.addEventListener("click", function (e) { if (e.target === back) closeModal(); });
  }
  function closeModal() { document.getElementById("modalRoot").innerHTML = ""; }

  function closeModalHead(title, sub) {
    return '<div class="modal-head"><div><h3>' + title + "</h3>" + (sub ? "<p>" + sub + "</p>" : "") +
      '</div><button class="modal-x" data-action="close-modal" aria-label="بستن">' + I.x + "</button></div>";
  }

  /* ---------- Auth / Boot ---------- */

  function showLogin() {
    document.getElementById("loginScreen").hidden = false;
    document.getElementById("appShell").hidden = true;
    closeModal();
    var p = document.getElementById("password");
    if (p) setTimeout(function () { p.focus(); }, 50);
  }

  function showApp() {
    document.getElementById("loginScreen").hidden = true;
    document.getElementById("appShell").hidden = false;
  }

  async function boot() {
    try {
      var me = await fetch("/api/me", { credentials: "same-origin" }).then(function (r) { return r.json(); });
      if (!me.authenticated) { showLogin(); return; }
      await loadAll();
      showApp();
      render();
    } catch (e) {
      showLogin();
    }
  }

  function regionQuery() {
    return state.regionId ? "?regionId=" + encodeURIComponent(state.regionId) : "";
  }

  function currentRegion() {
    if (!state.regionId) return null;
    return state.regions.filter(function (r) { return r.id === state.regionId; })[0] || null;
  }

  async function loadAll() {
    var results = await Promise.all([
      api("/api/meta"),
      api("/api/regions"),
      api("/api/templates"),
      api("/api/voice-samples"),
      api("/api/settings")
    ]);
    state.meta = results[0];
    state.regions = results[1].regions || [];
    state.templates = results[2].templates || [];
    state.voiceSamples = results[3].samples || [];
    state.settings = results[4];

    if (state.regionId && !state.regions.some(function (r) { return r.id === state.regionId; })) {
      state.regionId = null;
    }

    await Promise.all([refreshStats(), refreshRoozkars()]);
    updateModePill();
  }

  function updateModePill() {
    var pill = document.getElementById("modePill");
    var text = document.getElementById("modePillText");
    if (!pill || !text) return;
    var sms = (state.meta && state.meta.sms) || {};
    var voice = (state.meta && state.meta.voice) || {};
    var parts = [];
    if (sms.provider && sms.provider !== "simulate") parts.push("پیامک: " + (sms.configured ? sms.provider : "تنظیم نشده"));
    if (voice.provider && voice.provider !== "simulate") parts.push("صوتی: " + (voice.configured ? voice.provider : "تنظیم نشده"));
    if (!parts.length) {
      text.textContent = "حالت شبیه‌سازی";
      pill.classList.add("demo");
    } else {
      text.textContent = parts.join(" · ");
      pill.classList.remove("demo");
    }
  }

  function bindLogin() {
    document.getElementById("loginForm").addEventListener("submit", async function (e) {
      e.preventDefault();
      var btn = document.getElementById("loginBtn");
      var err = document.getElementById("loginError");
      var pass = document.getElementById("password").value;
      err.textContent = "";
      btn.classList.add("is-loading");
      btn.innerHTML = '<span class="spinner"></span>';
      try {
        await api("/api/login", { method: "POST", body: { password: pass } });
        await loadAll();
        showApp();
        render();
        document.getElementById("password").value = "";
      } catch (ex) {
        err.textContent = ex.message;
      } finally {
        btn.classList.remove("is-loading");
        btn.textContent = "ورود";
      }
    });
  }

  /* ---------- Render ---------- */

  function render() {
    var view = state.view;
    var host = document.getElementById("view");
    var title = document.getElementById("pageTitle");

    document.querySelectorAll(".nav-item").forEach(function (btn) {
      var nav = btn.getAttribute("data-nav");
      btn.classList.toggle("is-active", nav === view.name || (nav === "roozkars" && view.name === "roozkar"));
    });

    if (view.name === "dashboard") { title.textContent = "داشبورد"; host.innerHTML = viewDashboard(); }
    else if (view.name === "regions") { title.textContent = "منطقه"; host.innerHTML = viewRegions(); }
    else if (view.name === "roozkars") { title.textContent = "روزکارها"; host.innerHTML = viewRoozkars(); }
    else if (view.name === "roozkar") {
      title.textContent = state.detail ? "روزکار " + toFa(state.detail.roozkar.number) : "روزکار";
      host.innerHTML = viewRoozkar();
    }
    else if (view.name === "send") { title.textContent = "ارسال پیامک"; host.innerHTML = viewSend(); }
    else if (view.name === "voice") { title.textContent = "ارسال پیامک صوتی"; host.innerHTML = viewVoice(); }
    else if (view.name === "settings") { title.textContent = "تنظیمات"; host.innerHTML = viewSettings(); }

    window.scrollTo(0, 0);
    bindView();
  }

  function statCard(icon, tone, label, value, suffix) {
    return '<div class="stat-card"><div class="stat-icon ' + tone + '">' + icon + "</div>" +
      '<div class="stat-body"><div class="stat-label">' + label + "</div>" +
      '<div class="stat-value num">' + value + (suffix ? " <small>" + suffix + "</small>" : "") + "</div></div></div>";
  }

  function providerLabel() {
    var sms = (state.meta && state.meta.sms) || {};
    if (!sms.provider) return "";
    if (sms.provider === "simulate") return "شبیه‌سازی";
    if (!sms.configured) return "تنظیم نشده";
    return sms.provider;
  }

  function regionLabel(region) {
    if (!region) return "همه‌ی مناطق";
    var base = "منطقه " + toFa(region.number);
    if (!region.name || region.name === base) return base;
    return base + " — " + region.name;
  }

  function currentRegionLabel() {
    return regionLabel(currentRegion());
  }

  function rangeLabel(min, max) {
    min = Number(min) || 0;
    max = Number(max) || 0;
    if (!min && !max) return "همه‌ی بدهی‌ها";
    if (!max) return "بالای " + compact(min) + " ریال";
    if (!min) return "تا " + compact(max) + " ریال";
    return compact(min) + " تا " + compact(max) + " ریال";
  }

  function globalSearchBox() {
    return '<div class="panel search-panel"><div class="panel-head"><h2>جست‌وجوی مشترک</h2>' +
      '<span class="hint">' + esc(currentRegionLabel()) + "</span></div>" +
      '<div class="search-box search-box-lg">' + I.search +
      '<input id="gq" type="search" placeholder="نام، اشتراک، شناسه قبض، شناسه پرداخت یا شماره تماس…" value="' + esc(state.globalQuery) + '">' +
      "</div><div id=gqResults></div></div>";
  }

  function globalResultsHtml(res) {
    if (!res) return "";
    if (!res.rows || !res.rows.length) {
      return '<div class="empty" style="padding:18px"><strong>مشترکی پیدا نشد</strong><p>عبارت دیگری امتحان کنید یا منطقه را تغییر دهید.</p></div>';
    }
    var rows = res.rows.map(function (s) {
      return "<tr><td><div class='cell-strong num'>" + toFa(s.eshterak || "-") + "</div></td>" +
        "<td><div class='cell-strong'>" + esc(s.name) + "</div><div class='cell-sub num'>" + (s.phone ? toFa(s.phone) : "بدون تماس") + "</div></td>" +
        "<td class='cell-sub'>" + esc(s.address || "-") + "</td>" +
        "<td class='money over num'>" + fmtNum(s.debt) + "</td>" +
        "<td class='cell-sub'>منطقه " + toFa(s.region_number) + " · روزکار " + toFa(s.roozkar_number) + "</td>" +
        '<td><button class="btn btn-outline btn-sm" data-action="open-result" data-id="' + s.roozkar_id + '" data-q="' + esc(s.eshterak || "") + '">مشاهده</button></td></tr>';
    }).join("");
    return '<div class="search-meta">' + toFa(res.total) + " نتیجه" + (res.total > res.rows.length ? " (نمایش " + toFa(res.rows.length) + " مورد)" : "") + "</div>" +
      '<div class="table-wrap" style="max-height:340px"><table><thead><tr><th>اشتراک</th><th>مشترک</th><th>آدرس</th><th>بدهی (ریال)</th><th>روزکار</th><th></th></tr></thead><tbody>' +
      rows + "</tbody></table></div>";
  }

  async function runGlobalSearch(q) {
    var box = document.getElementById("gqResults");
    if (!box) return;
    if (!q.trim()) {
      state.globalResults = null;
      box.innerHTML = "";
      return;
    }
    box.innerHTML = '<div class="loading-line">در حال جست‌وجو…</div>';
    try {
      var res = await api("/api/search?q=" + encodeURIComponent(q) + (state.regionId ? "&regionId=" + state.regionId : ""));
      state.globalResults = res;
      if (document.getElementById("gqResults")) document.getElementById("gqResults").innerHTML = globalResultsHtml(res);
    } catch (e) {
      box.innerHTML = '<div class="note warn">' + esc(e.message) + "</div>";
    }
  }

  function viewDashboard() {
    var s = state.stats || { roozkars: 0, subscribers: 0, debt: 0, due: 0, sends: 0 };
    var top = state.top || [];
    var topRows = top.map(function (t) {
      return "<tr><td><div class='cell-strong'>" + esc(t.name) + "</div><div class='cell-sub num'>" + toFa(t.eshterak || "") + "</div></td>" +
        "<td class='cell-sub'>" + esc(t.address || "") + "</td>" +
        "<td class='cell-sub'>روزکار " + toFa(t.roozkar_number || "-") + "</td>" +
        "<td class='money over num'>" + fmtNum(t.debt) + " ریال</td></tr>";
    }).join("");

    var recent = (state.sends || []).slice(0, 4);
    var recentHtml = recent.length ? recent.map(function (x) {
      return '<div class="file-row"><div class="file-ic" style="background:var(--blue-soft);color:var(--blue)">' +
        (x.type === "voice" ? I.volume : I.send) + "</div>" +
        '<div class="file-info"><strong>' + (x.type === "voice" ? "پیام صوتی" : "پیامک متنی") + " — " + toFa(x.count) + " گیرنده</strong>" +
        "<span>" + esc(x.scope) + " · " + formatDateTime(x.created_at) + "</span></div>" +
        '<span class="chip ' + statusChip(x.status) + '">' + statusLabel(x.status) + "</span></div>";
    }).join("") : '<div class="empty"><div class="eic">' + I.send + "</div><strong>ارسالی ثبت نشده است</strong><p>از «ارسال گروهی» شروع کنید.</p></div>";

    return '' +
      '<div class="page-head"><div><h1>داشبورد</h1><p class="sub">نمای کلی وضعیت وصول مطالبات · <b>' + esc(currentRegionLabel()) + "</b></p></div>" +
      '<div class="head-actions"><button class="btn btn-outline" data-nav="regions">' + I.pin + "تغییر منطقه</button>" +
      '<button class="btn btn-outline" data-action="add-roozkar">' + I.plus + "افزودن روزکار</button>" +
      '<button class="btn btn-primary" data-action="open-send">' + I.send + "ارسال گروهی</button></div></div>" +
      globalSearchBox() +
      '<div class="stats">' +
      statCard(I.layers, "blue", "روزکارهای فعال", fmtNum(s.roozkars)) +
      statCard(I.users, "teal", "کل مشترکین", fmtNum(s.subscribers)) +
      statCard(I.wallet, "yellow", "مجموع بدهی", compact(s.debt), "ریال") +
      statCard(I.chart, "green", "مشترکین بدهکار", fmtNum(s.due)) +
      "</div>" +
      '<div class="panel"><div class="panel-head"><h2>اقدام سریع</h2><span class="hint">کارهای پرتکرار روزانه</span></div>' +
      '<div class="quick-grid">' +
      '<button class="quick" data-action="go-roozkars"><span class="qi">' + I.upload + "</span><strong>بارگذاری اکسل</strong><span>انتخاب روزکار و ثبت فایل جدید</span></button>" +
      '<button class="quick" data-action="add-roozkar"><span class="qi">' + I.plus + "</span><strong>افزودن روزکار</strong><span>ساخت روزکار جدید برای منطقه</span></button>" +
      '<button class="quick" data-action="open-voice-send"><span class="qi">' + I.volume + "</span><strong>ارسال پیام صوتی</strong><span>انتخاب فایل صوتی بر اساس بدهی</span></button>" +
      '<button class="quick" data-action="open-send"><span class="qi">' + I.send + "</span><strong>ارسال پیامک</strong><span>ارسال با قالب‌های آماده</span></button>" +
      "</div></div>" +
      '<div class="panel"><div class="panel-head"><h2>بیشترین بدهی</h2><span class="hint">۵ مشترک نخست</span></div>' +
      '<div class="table-wrap" style="max-height:none"><table class="t-debt"><thead><tr><th>مشترک</th><th>آدرس</th><th>روزکار</th><th>مبلغ بدهی</th></tr></thead><tbody>' +
      (topRows || '<tr><td colspan="4"><div class="empty"><strong>داده‌ای موجود نیست</strong><p>اولین فایل اکسل را بارگذاری کنید.</p></div></td></tr>') +
      "</tbody></table></div></div>" +
      '<div class="panel"><div class="panel-head"><h2>آخرین ارسال‌ها</h2><span class="hint">' + providerLabel() + "</span></div>" +
      '<div class="file-list">' + recentHtml + "</div></div>";
  }

  function viewRegions() {
    var cards = state.regions.map(function (g) {
      var active = g.id === state.regionId;
      return '<div class="region-card' + (active ? " is-active" : "") + '">' +
        '<div class="rc-top"><div class="rc-icon">' + I.pin + "</div>" +
        '<div class="rc-titles"><strong>منطقه ' + toFa(g.number) + "</strong><span>" + esc(g.name) + "</span></div>" +
        (active ? '<span class="chip green">انتخاب‌شده</span>' : "") + "</div>" +
        '<div class="rc-meta"><span>روزکار: <b class="num">' + toFa(g.roozkars) + "</b></span>" +
        '<span>مشترک: <b class="num">' + toFa(g.subscribers) + "</b></span>" +
        '<span>بدهی: <b class="num">' + compact(g.debt) + " ریال</b></span></div>" +
        '<div class="rc-actions"><button class="btn btn-yellow btn-sm" data-action="select-region" data-id="' + g.id + '">' + I.chart + "ورود به منطقه" + "</button>" +
        '<button class="btn btn-outline btn-sm" data-action="select-region" data-id="' + g.id + '" data-go="roozkars">' + I.layers + "روزکارها</button>" +
        "</div></div>";
    }).join("");

    return '<div class="page-head"><div><h1>منطقه</h1><p class="sub">اطلاعات هر منطقه جدا نگهداری می‌شود؛ شماره اشتراک تکراری در دو منطقه، دو مشترک جدا هستند.</p></div>' +
      '<div class="head-actions"><button class="btn btn-outline" data-action="clear-region">' + I.layers + "همه‌ی مناطق</button>" +
      '<button class="btn btn-primary" data-action="add-region">' + I.plus + "افزودن منطقه</button></div></div>" +
      '<div class="region-grid">' + (cards || "") + "</div>" +
      '<div class="note">پس از انتخاب منطقه، همه‌ی صفحه‌ها (روزکارها، جست‌وجو، ارسال و آمار) فقط همان منطقه را نشان می‌دهند.</div>';
  }

  function viewRoozkars() {
    var cards = state.roozkars.map(function (rz) {
      var regionTag = state.regionId ? "" : '<span class="chip blue">منطقه ' + toFa(rz.region_number) + "</span>";
      return '<div class="roozkar-card">' +
        '<div class="rc-top"><div class="rc-icon">' + I.bolt + "</div>" +
        '<div class="rc-titles"><strong>روزکار ' + toFa(rz.number) + "</strong><span>" + esc(rz.name) + "</span></div>" +
        '<span class="rc-badge">' + toFa(rz.files) + " فایل</span></div>" +
        '<div class="rc-meta">' + regionTag + '<span>مشترکین: <b class="num">' + toFa(rz.subs) + "</b></span>" +
        '<span>بدهکار: <b class="num">' + toFa(rz.due) + "</b></span>" +
        '<span>بدهی: <b class="num">' + compact(rz.debt) + " ریال</b></span></div>" +
        '<div class="rc-actions">' +
        '<button class="btn btn-yellow btn-sm" data-action="open-roozkar" data-id="' + rz.id + '">' + I.chart + "مشاهده</button>" +
        '<button class="btn btn-outline btn-sm" data-action="upload" data-id="' + rz.id + '" aria-label="بارگذاری اکسل">' + I.upload + "اکسل</button>" +
        '<button class="btn btn-outline btn-sm" data-action="files" data-id="' + rz.id + '" aria-label="فایل‌ها">' + I.file + "فایل‌ها</button>" +
        "</div></div>";
    }).join("");

    return '' +
      '<div class="page-head"><div><h1>روزکارها</h1><p class="sub">' + esc(currentRegionLabel()) +
      " · هر روزکار یک مسیر است؛ روی کاشی، اکسل همان روزکار را بارگذاری کنید.</p></div>" +
      '<div class="head-actions"><button class="btn btn-outline" data-nav="regions">' + I.pin + "تغییر منطقه</button>" +
      '<button class="btn btn-primary" data-action="add-roozkar">' + I.plus + "افزودن روزکار</button></div></div>" +
      globalSearchBox() +
      '<div class="roozkar-grid">' + (cards || "") +
      '<button class="roozkar-card add-card" data-action="add-roozkar"><span class="plus">' + I.plus + "</span><strong>افزودن روزکار</strong><span>شماره و نام مسیر را وارد کنید</span></button>" +
      "</div>";
  }

  function viewRoozkar() {
    if (!state.detail) {
      return '<div class="loading-line">در حال بارگذاری…</div>';
    }
    var d = state.detail;
    var rz = d.roozkar;
    var rows = d.rows || [];

    var body = rows.map(function (s) {
      var status = s.debt === 0
        ? '<span class="chip green">تسویه‌شده</span>'
        : (s.last_contact ? '<span class="chip gray">' + esc(s.last_contact) + "</span>" : '<span class="chip red">بدهی معوق</span>');
      var phone = s.phone
        ? '<a class="phone-link num" href="tel:' + esc(s.phone) + '">' + toFa(s.phone) + "</a>"
        : '<span class="chip gray">بدون تماس</span>';
      var money = s.debt === 0 ? '<span class="money zero num">۰</span>' : '<span class="money over num">' + fmtNum(s.debt) + "</span>";
      return "<tr>" +
        '<td><div class="cell-strong num">' + toFa(s.eshterak || "-") + "</div>" +
        '<div class="cell-sub num">' + (s.pay_id ? toFa(s.pay_id) : "") + "</div></td>" +
        '<td><div class="cell-strong">' + esc(s.name) + "</div></td>" +
        '<td class="num">' + phone + "</td>" +
        '<td class="cell-sub">' + esc(s.address || "-") + "</td>" +
        '<td class="cell-sub num">' + esc(s.last_pay || "-") + "</td>" +
        "<td>" + money + "</td>" +
        '<td class="cell-sub num">' + (s.bill_id ? toFa(s.bill_id) : "-") + "</td>" +
        "<td>" + status + "</td>" +
        '<td><div class="cell-actions">' +
        '<button class="btn btn-outline btn-sm" data-action="send-one" data-id="' + s.id + '" aria-label="ارسال پیامک">' + I.send + "</button>" +
        '<button class="btn btn-outline btn-sm" data-action="send-voice" data-id="' + s.id + '" aria-label="ارسال پیام صوتی">' + I.volume + "</button>" +
        '<button class="btn btn-danger btn-sm" data-action="delete-sub" data-id="' + s.id + '" aria-label="حذف مشترک">' + I.trash + "</button>" +
        "</div></td></tr>";
    }).join("");

    var bodyHtml = body || ('<tr><td colspan="9"><div class="empty"><div class="eic">' + I.file +
      "</div><strong>مشترکی در این فایل نیست</strong><p>فایل اکسل را بارگذاری کنید یا مشترک دستی اضافه کنید.</p></div></td></tr>");

    return '' +
      '<div class="page-head"><div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">' +
      '<button class="btn btn-ghost btn-sm" data-action="go-roozkars" aria-label="بازگشت">' + I.back + "روزکارها</button>" +
      "<div><h1>روزکار " + toFa(rz.number) + " — " + esc(rz.name) + "</h1>" +
      '<p class="sub num">' + esc("منطقه " + toFa(rz.region_number)) +
      (rz.region_name && rz.region_name !== "منطقه " + toFa(rz.region_number) ? esc(" · " + rz.region_name) : "") + " · " +
      toFa(d.total) + " مشترک در این فایل</p></div></div>" +
      '<div class="head-actions">' +
      '<button class="btn btn-outline" data-action="files" data-id="' + rz.id + '">' + I.file + "فایل‌ها</button>" +
      '<button class="btn btn-outline" data-action="open-ocr" data-id="' + rz.id + '">' + I.image + "عکس جدول</button>" +
      '<button class="btn btn-outline" data-action="add-sub" data-id="' + rz.id + '">' + I.plus + "افزودن مشترک</button>" +
      '<button class="btn btn-yellow" data-action="upload" data-id="' + rz.id + '">' + I.upload + "بارگذاری اکسل</button></div></div>" +

      '<div class="panel"><div class="toolbar">' +
      '<div class="search-box">' + I.search + '<input id="q" type="search" placeholder="نام، اشتراک، شناسه قبض/پرداخت، تلفن یا آدرس…" value="' + esc(state.filters.q) + '"></div>' +
      '<select id="debtFilter" aria-label="فیلتر مبلغ بدهی">' +
      '<option value="all"' + (state.filters.debt === "all" ? " selected" : "") + ">همه‌ی مبالغ</option>" +
      '<option value="lt1"' + (state.filters.debt === "lt1" ? " selected" : "") + ">زیر ۱ میلیون</option>" +
      '<option value="1to10"' + (state.filters.debt === "1to10" ? " selected" : "") + ">۱ تا ۱۰ میلیون</option>" +
      '<option value="gt10"' + (state.filters.debt === "gt10" ? " selected" : "") + ">بالای ۱۰ میلیون</option></select>" +
      '<select id="statusFilter" aria-label="فیلتر وضعیت">' +
      '<option value="all"' + (state.filters.status === "all" ? " selected" : "") + ">همه‌ی وضعیت‌ها</option>" +
      '<option value="due"' + (state.filters.status === "due" ? " selected" : "") + ">بدهکار</option>" +
      '<option value="paid"' + (state.filters.status === "paid" ? " selected" : "") + ">تسویه‌شده</option></select>" +
      '<button class="btn btn-outline" data-action="open-send" data-id="' + rz.id + '">' + I.send + "ارسال گروهی</button>" +
      "</div>" +
      '<div class="table-wrap"><table class="t-subs"><thead><tr>' +
      "<th>اشتراک / <span class=\"hide-sm\">شناسه پرداخت</span></th><th>مشترک</th><th>شماره تماس</th><th>آدرس</th><th>آخرین پرداخت</th><th>مبلغ بدهی (ریال)</th><th>شناسه قبض</th><th>وضعیت</th><th>عملیات</th>" +
      "</tr></thead><tbody>" + bodyHtml + "</tbody></table></div>" +
      '<div class="pager"><div class="pager-info num">' +
      (d.total ? "نمایش " + toFa((d.page - 1) * d.pageSize + 1) + " تا " + toFa(Math.min(d.page * d.pageSize, d.total)) + " از " + toFa(d.total) : "بدون رکورد") +
      '</div><div class="pager-btns">' +
      '<button class="btn btn-outline btn-sm" data-action="page" data-page="' + (d.page - 1) + '"' + (d.page <= 1 ? " disabled" : "") + ">قبلی</button>" +
      '<span class="btn btn-ghost btn-sm num">' + toFa(d.page) + " / " + toFa(d.pages) + "</span>" +
      '<button class="btn btn-outline btn-sm" data-action="page" data-page="' + (d.page + 1) + '"' + (d.page >= d.pages ? " disabled" : "") + ">بعدی</button>" +
      "</div></div></div>";
  }

  function statusLabel(s) {
    return s === "sent" ? "ارسال شد" : s === "simulated" ? "شبیه‌سازی" : s === "partial" ? "ناقص" : s === "failed" ? "ناموفق" : "نامشخص";
  }
  function statusChip(s) {
    return s === "sent" ? "green" : s === "simulated" ? "blue" : s === "partial" ? "amber" : "red";
  }

  function viewSend() {
    var sends = (state.sends || []).filter(function (x) { return x.type !== "voice"; });
    var templates = state.templates || [];

    var templateRows = templates.map(function (t) {
      return '<div class="file-row"><div class="file-ic" style="background:var(--yellow-soft);color:var(--amber)">' + I.file + "</div>" +
        '<div class="file-info"><strong>' + esc(t.title) + '</strong><span class="tpl-body">' + esc(t.body) + "</span></div>" +
        '<div class="file-actions">' +
        '<button class="btn btn-outline btn-sm" data-action="edit-template" data-id="' + t.id + '">' + I.edit + "ویرایش</button>" +
        '<button class="btn btn-danger btn-sm" data-action="delete-template" data-id="' + t.id + '">' + I.trash + "</button>" +
        "</div></div>";
    }).join("");

    return '<div class="page-head"><div><h1>ارسال پیامک</h1>' +
      '<p class="sub">قالب‌های متن را بسازید یا ویرایش کنید و برای گیرندگان فیلترشده بفرستید.</p></div>' +
      '<div class="head-actions"><button class="btn btn-outline" data-action="add-template">' + I.plus + "قالب جدید</button>" +
      '<button class="btn btn-primary" data-action="open-send">' + I.send + "ارسال گروهی</button></div></div>" +
      '<div class="stats">' +
      statCard(I.users, "blue", "کل مشترکین", fmtNum(state.stats.subscribers)) +
      statCard(I.wallet, "yellow", "مشترکین بدهکار", fmtNum(state.stats.due)) +
      statCard(I.send, "teal", "پیامک‌های ارسالی", fmtNum(sends.length)) +
      "</div>" +
      '<div class="panel"><div class="panel-head"><h2>قالب‌های متن پیامک</h2><span class="hint">' + toFa(templates.length) + " قالب</span></div>" +
      (templateRows ? '<div class="file-list">' + templateRows + "</div>" : '<div class="empty"><div class="eic">' + I.file + "</div><strong>قالبی ثبت نشده</strong><p>یک متن آماده بسازید تا در ارسال‌های بعدی استفاده کنید.</p></div>") +
      "</div>" +
      '<div class="panel"><div class="panel-head"><h2>تاریخچه‌ی پیامک</h2><span class="hint">' + providerLabel() + "</span></div>" +
      (sends.length ? '<div class="file-list">' + sends.map(function (x) {
        return '<div class="file-row"><div class="file-ic" style="background:var(--blue-soft);color:var(--blue)">' + I.send + "</div>" +
          '<div class="file-info"><strong>' + "پیامک متنی — " + toFa(x.count) + " گیرنده</strong>" +
          "<span>" + esc(x.scope) + " · " + formatDateTime(x.created_at) + "</span></div>" +
          '<span class="chip ' + statusChip(x.status) + '">' + statusLabel(x.status) + "</span></div>";
      }).join("") + "</div>"
        : '<div class="empty"><div class="eic">' + I.send + "</div><strong>هنوز پیامکی ارسال نشده</strong><p>اولین ارسال گروهی را بسازید.</p></div>") +
      "</div>";
  }

  function filePick(id, accept, text, extra) {
    return '<label class="file-pick" for="' + id + '">' +
      '<span class="fp-btn">' + I.upload + "انتخاب فایل</span>" +
      '<span class="fp-name" id="' + id + 'Name">' + esc(text || "فایلی انتخاب نشده") + "</span></label>" +
      '<input class="fp-input" id="' + id + '" type="file" accept="' + accept + '"' + (extra || "") + ">";
  }

  function filePickInline(id, accept, text, extra) {
    return "<span class=\"fp-inline\">" +
      '<label class="file-pick-btn" for="' + id + '">' + I.upload + "انتخاب فایل</label>" +
      '<span class="fp-name" id="' + id + 'Name">' + esc(text || "فایلی انتخاب نشده") + "</span></span>" +
      '<input class="fp-input" id="' + id + '" type="file" accept="' + accept + '"' + (extra || "") + ">";
  }

  function viewVoice() {
    var samples = state.voiceSamples || [];
    var sends = (state.sends || []).filter(function (x) { return x.type === "voice"; });
    var meta = state.meta || {};
    var maxAudio = meta.maxAudioMb || 15;

    var sampleRows = samples.map(function (s) {
      return '<div class="voice-row"><div class="file-ic" style="background:var(--teal-soft);color:var(--teal)">' + I.volume + "</div>" +
        '<div class="file-info"><strong>' + esc(s.title) + "</strong>" +
        "<span>" + esc(rangeLabel(s.debt_min, s.debt_max)) + " · " + toFa(Math.max(1, Math.round(s.size / 1024))) + " کیلوبایت</span>" +
        '<audio controls preload="none" src="/api/voice-samples/' + s.id + '/audio"></audio></div>' +
        '<div class="file-actions">' +
        '<button class="btn btn-outline btn-sm" data-action="edit-voice" data-id="' + s.id + '">' + I.edit + "ویرایش بازه</button>" +
        '<button class="btn btn-danger btn-sm" data-action="delete-voice" data-id="' + s.id + '">' + I.trash + "</button>" +
        "</div></div>";
    }).join("");

    var sampleOptions = samples.map(function (s) {
      return '<option value="' + s.id + '">' + esc(s.title) + " — " + esc(rangeLabel(s.debt_min, s.debt_max)) + "</option>";
    }).join("");

    return '<div class="page-head"><div><h1>ارسال پیامک صوتی</h1>' +
      '<p class="sub">چند فایل صوتی آپلود کنید و به هر بازه‌ی بدهی یک فایل اختصاص دهید؛ ارسال خودکار بر اساس بدهی انجام می‌شود.</p></div>' +
      '<div class="head-actions"><button class="btn btn-primary" data-action="open-voice-send">' + I.volume + "ارسال گروهی صوتی</button></div></div>" +
      '<div class="stats">' +
      statCard(I.volume, "teal", "فایل‌های صوتی", fmtNum(samples.length)) +
      statCard(I.users, "blue", "کل مشترکین", fmtNum(state.stats.subscribers)) +
      statCard(I.wallet, "yellow", "مشترکین بدهکار", fmtNum(state.stats.due)) +
      "</div>" +

      '<div class="panel"><div class="panel-head"><h2>آپلود فایل صوتی</h2>' +
      '<span class="hint">حداکثر ' + toFa(maxAudio) + " مگابایت · mp3، ogg، wav، m4a، amr</span></div>" +
      '<div class="voice-upload">' +
      '<div class="field"><label for="vTitle">نام فایل</label><input id="vTitle" type="text" placeholder="مثلاً یادآوری بدهی زیر ۱ میلیون"></div>' +
      '<div class="field"><label>فایل صوتی</label>' + filePick("vFile", "audio/*", "فایل صوتی انتخاب نشده") + "</div>" +
      '<div class="row2"><div class="field"><label for="vMin">از بدهی (ریال)</label><input id="vMin" type="number" inputmode="numeric" value="0"></div>' +
      '<div class="field"><label for="vMax">تا بدهی (ریال) — ۰ یعنی بدون سقف</label><input id="vMax" type="number" inputmode="numeric" value="0"></div></div>' +
      '<button class="btn btn-yellow" data-action="upload-voice">' + I.upload + "آپلود فایل صوتی</button>" +
      "</div>" +
      (sampleRows ? '<div class="file-list" style="margin-top:14px">' + sampleRows + "</div>"
        : '<div class="empty"><div class="eic">' + I.volume + "</div><strong>هنوز فایل صوتی ندارید</strong><p>اولین فایل را آپلود کنید و بازه‌ی بدهی آن را مشخص کنید.</p></div>") +
      "</div>" +

      '<div class="panel"><div class="panel-head"><h2>ارسال گروهی صوتی</h2><span class="hint">' + esc(currentRegionLabel()) + "</span></div>" +
      '<div class="send-form">' +
      '<div class="row2"><div class="field"><label for="vRegion">منطقه</label><select id="vRegion">' +
      '<option value="">همه‌ی مناطق</option>' +
      state.regions.map(function (g) { return '<option value="' + g.id + '"' + (state.regionId === g.id ? " selected" : "") + ">منطقه " + toFa(g.number) + " — " + esc(g.name) + "</option>"; }).join("") +
      "</select></div>" +
      '<div class="field"><label for="vDebt">بازه‌ی بدهی</label><select id="vDebt">' +
      '<option value="all">همه‌ی بدهکاران</option><option value="lt1">کمتر از ۱ میلیون ریال</option>' +
      '<option value="1to10">۱ تا ۱۰ میلیون ریال</option><option value="gt10">بیش از ۱۰ میلیون ریال</option></select></div></div>' +
      '<div class="row2"><div class="field"><label for="vMode">انتخاب فایل</label><select id="vMode">' +
      '<option value="auto">خودکار بر اساس بازه‌ی بدهی</option><option value="manual">انتخاب دستی یک فایل</option></select></div>' +
      '<div class="field"><label for="vSample">فایل صوتی</label><select id="vSample" disabled>' +
      (sampleOptions || '<option value="">فایل صوتی ندارید</option>') + "</select></div></div>" +
      '<div class="field"><label for="vMessage">متن همراه (اختیاری — برخی سرویس‌ها لازم دارند)</label>' +
      '<textarea id="vMessage" placeholder="مشترک گرامی، بدهی برق شما را تسویه کنید."></textarea></div>' +
      '<div class="send-preview" id="voiceSummary"><div class="loading-line">در حال محاسبه…</div></div>' +
      '<div class="send-actions"><button class="btn btn-yellow" data-action="send-voice-bulk">' + I.volume + "ارسال پیام صوتی" +
      "</button></div></div></div>" +

      '<div class="panel"><div class="panel-head"><h2>تاریخچه‌ی ارسال صوتی</h2><span class="hint">' + providerLabel() + "</span></div>" +
      (sends.length ? '<div class="file-list">' + sends.map(function (x) {
        return '<div class="file-row"><div class="file-ic" style="background:var(--teal-soft);color:var(--teal)">' + I.volume + "</div>" +
          '<div class="file-info"><strong>' + "پیام صوتی — " + toFa(x.count) + " گیرنده</strong>" +
          "<span>" + esc(x.scope) + " · " + formatDateTime(x.created_at) + "</span></div>" +
          '<span class="chip ' + statusChip(x.status) + '">' + statusLabel(x.status) + "</span></div>";
      }).join("") + "</div>"
        : '<div class="empty"><div class="eic">' + I.volume + "</div><strong>هنوز پیام صوتی ارسال نشده</strong><p>یک فایل آپلود کنید و ارسال گروهی را انجام دهید.</p></div>") +
      "</div>";
  }

  function providerForm(kind, cfg) {
    cfg = cfg || {};
    var isVoice = kind === "voice";
    var title = isVoice ? "سرویس پیامک صوتی" : "سرویس پیامک متنی";
    var hint = isVoice ? "پنل تماس صوتی شما (مثلاً اوانک)" : "پنل پیامک متنی شما";
    var provider = cfg.provider || "simulate";
    var status = provider === "simulate"
      ? '<span class="chip gray">شبیه‌سازی</span>'
      : (state.settings && state.settings[kind] && state.settings[kind].has_api_key || cfg.base_url)
        ? '<span class="chip green">ذخیره‌شده</span>'
        : '<span class="chip amber">نیاز به تکمیل</span>';

    var options = [
      ["simulate", "شبیه‌سازی (بدون ارسال واقعی)"],
      ["custom", "سرویس اختصاصی (JSON / REST)"],
      ["kavenegar", "کاوه‌نگار"],
      ["webhook", "وب‌هوک ساده"]
    ].map(function (o) {
      return '<option value="' + o[0] + '"' + (provider === o[0] ? " selected" : "") + ">" + o[1] + "</option>";
    }).join("");

    var keyHint = cfg.has_api_key ? "ذخیره شده: " + esc(cfg.api_key_masked || "••••") + " — برای تغییر، مقدار جدید بنویسید." : "کلید API را اینجا وارد کنید.";

    return '<div class="panel provider-panel"><div class="panel-head"><h2>' + title + "</h2>" +
      '<span class="hint">' + hint + " · " + status + "</span></div>" +
      '<div class="form-grid">' +
      '<div class="field"><label for="' + kind + 'Provider">نوع سرویس</label>' +
      '<select id="' + kind + 'Provider" data-provider-kind="' + kind + '">' + options + "</select></div>" +
      '<div class="field"><label for="' + kind + 'BaseUrl">آدرس سرویس (Base URL)</label>' +
      '<input id="' + kind + 'BaseUrl" type="url" dir="ltr" placeholder="https://api.example.com/v1/send" value="' + esc(cfg.base_url || "") + '"></div>' +
      '<div class="field"><label for="' + kind + 'ApiKey">کلید API / توکن</label>' +
      '<input id="' + kind + 'ApiKey" type="password" dir="ltr" autocomplete="new-password" placeholder="' + esc(keyHint) + '"></div>' +
      '<div class="field"><label for="' + kind + 'Sender">شماره فرستنده / خط</label>' +
      '<input id="' + kind + 'Sender" type="text" dir="ltr" placeholder="مثلاً 1000" value="' + esc(cfg.sender || "") + '"></div>' +
      '<div class="field"><label for="' + kind + 'AuthHeader">نام هدر احراز هویت</label>' +
      '<input id="' + kind + 'AuthHeader" type="text" dir="ltr" placeholder="Authorization" value="' + esc(cfg.auth_header || "Authorization") + '"></div>' +
      '<div class="field"><label for="' + kind + 'AuthPrefix">پیشوند مقدار هدر</label>' +
      '<input id="' + kind + 'AuthPrefix" type="text" dir="ltr" placeholder="Bearer " value="' + esc(cfg.auth_prefix == null ? "Bearer " : cfg.auth_prefix) + '"></div>' +
      '<div class="field"><label for="' + kind + 'Method">روش درخواست</label>' +
      '<select id="' + kind + 'Method"><option value="POST"' + (cfg.method !== "GET" ? " selected" : "") + '>POST</option>' +
      '<option value="GET"' + (cfg.method === "GET" ? " selected" : "") + ">GET</option></select></div>" +
      "</div>" +
      '<div class="field" style="margin-top:12px"><label for="' + kind + 'Payload">قالب JSON درخواست</label>' +
      '<textarea id="' + kind + 'Payload" dir="ltr" rows="4" placeholder=\'{"to":"{phone}","message":"{message}"}\'>' + esc(cfg.payload || "") + "</textarea>" +
      '<span class="help">متغیرهای مجاز: {phone} {message} {sender} {type} {audio_url} {audio_title} {name} {debt} {eshterak} {bill_id} {pay_id} {region} {roozkar}</span></div>' +
      '<div class="test-send"><div class="field"><label for="' + kind + 'TestPhone">شماره تست</label>' +
      '<input id="' + kind + 'TestPhone" type="tel" inputmode="tel" dir="ltr" placeholder="09123456789"></div>' +
      '<button class="btn btn-outline" data-action="test-send" data-kind="' + kind + '">' + I.send + "ارسال تست</button></div>" +
      '<div class="modal-foot" style="justify-content:flex-start;border-top:1px solid var(--line);padding-top:14px;margin-top:16px">' +
      '<button class="btn btn-yellow" data-action="save-provider" data-kind="' + kind + '">' + I.save + "ذخیره‌ی تنظیمات " + (isVoice ? "صوتی" : "پیامک") +
      "</button></div></div>";
  }

  function viewSettings() {
    var meta = state.meta || {};
    var settings = state.settings || {};
    var sms = settings.sms || {};
    var voice = settings.voice || {};
    var ocr = meta.ocr || {};
    var externalKey = settings.externalApiKeyMasked || "";

    var swatches = [
      ["#0F2742", "سرمه‌ای برند"], ["#1463C6", "آبی اصلی"], ["#F7B500", "زرد برند"],
      ["#0F9E9E", "فیروزه‌ای"], ["#1F9D6B", "سبز تسویه"], ["#C8453D", "قرمز بدهی"]
    ].map(function (c) {
      return '<div style="display:flex;align-items:center;gap:10px"><span style="width:26px;height:26px;border-radius:8px;border:1px solid var(--line);background:' + c[0] + '"></span>' +
        "<div><div style='font-size:12.5px;font-weight:600'>" + c[1] + "</div><div class='cell-sub' style='direction:ltr;text-align:right'>" + c[0] + "</div></div></div>";
    }).join("");

    return '<div class="page-head"><div><h1>تنظیمات</h1><p class="sub">اتصال به پنل پیامک متنی، پنل پیام صوتی و دسترسی API سایت دیگر</p></div></div>' +
      '<div class="panel"><div class="panel-head"><h2>وضعیت سرویس‌ها</h2></div>' +
      '<div class="summary-box">' +
      '<div class="line"><span>پیامک متنی</span><b>' + esc((meta.sms && meta.sms.provider) || sms.provider || "-") + " " +
      (meta.sms && meta.sms.configured ? '<span class="chip green">آماده</span>' : '<span class="chip amber">تنظیم نشده</span>') + "</b></div>" +
      '<div class="line"><span>پیامک صوتی</span><b>' + esc((meta.voice && meta.voice.provider) || voice.provider || "-") + " " +
      (meta.voice && meta.voice.configured ? '<span class="chip green">آماده</span>' : '<span class="chip amber">تنظیم نشده</span>') + "</b></div>" +
      '<div class="line"><span>OCR</span><b>' + esc(ocr.provider || "-") + " " +
      (ocr.configured ? '<span class="chip green">آماده</span>' : '<span class="chip amber">تنظیم نشده</span>') + "</b></div>" +
      '<div class="line"><span>سقف هر ارسال</span><b class="num">' + toFa((meta.sms && meta.sms.maxPerBatch) || 0) + " نفر</b></div>" +
      '<div class="line"><span>حداکثر حجم فایل</span><b class="num">' + toFa(meta.maxUploadMb || 25) + " مگابایت اکسل · " + toFa(meta.maxAudioMb || 15) + " مگابایت صدا</b></div>" +
      "</div></div>" +

      providerForm("sms", sms) +
      providerForm("voice", voice) +

      '<div class="panel"><div class="panel-head"><h2>اتصال سایت دیگر (API)</h2></div>' +
      '<div class="note">برای اتصال سایت خدمات تماس و پیامک، درخواست‌ها را با هدر <b style="direction:ltr;display:inline-block">x-api-key</b> بفرستید. بدون این کلید فقط با ورود از همین مرورگر پاسخ داده می‌شود.</div>' +
      '<div class="field"><label>کلید دسترسی API</label><div class="api-key-row">' +
      '<input id="extKeyBox" type="text" dir="ltr" readonly value="' + (externalKey ? esc(externalKey) : "هنوز کلیدی ساخته نشده") + '">' +
      '<button class="btn btn-outline" data-action="gen-api-key">' + I.plus + "ساخت کلید جدید</button>" +
      '<button class="btn btn-danger" data-action="clear-api-key">' + I.trash + "حذف</button></div>" +
      '<span class="help">پس از ساخت، کلید کامل فقط یک بار نمایش داده می‌شود؛ آن را در سایت مقصد ذخیره کنید.</span></div>' +
      '<div class="summary-box"><div class="line"><span>دریافت مشترکین</span><b style="direction:ltr">GET /api/export/subscribers</b></div>' +
      '<div class="line"><span>ثبت ارسال</span><b style="direction:ltr">POST /api/sends</b></div>' +
      '<div class="line"><span>منطقه‌ها</span><b style="direction:ltr">GET /api/regions</b></div>' +
      '<div class="line"><span>سلامت سرویس</span><b style="direction:ltr">GET /api/healthz</b></div></div></div>' +

      '<div class="panel"><div class="panel-head"><h2>آدرس عمومی سامانه</h2></div>' +
      '<div class="note">برای ارسال فایل صوتی، سرویس بیرونی باید بتواند فایل را از این آدرس دریافت کند. اگر سایت روی دامنه/هاست اجرا شد، دامنه را اینجا بنویسید.</div>' +
      '<div class="field"><label for="publicBaseUrl">آدرس عمومی</label>' +
      '<input id="publicBaseUrl" type="url" dir="ltr" placeholder="https://vosol.example.com" value="' + esc(settings.publicBaseUrl || "") + '">' +
      '<span class="help">خالی بگذارید تا آدرس فعلی مرورگر استفاده شود.</span></div>' +
      '<button class="btn btn-outline" data-action="save-general">' + I.save + "ذخیره‌ی آدرس</button></div>" +

      '<div class="panel"><div class="panel-head"><h2>هویت بصری</h2></div>' +
      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:14px">' + swatches + "</div></div>" +
      '<div class="panel"><div class="panel-head"><h2>حساب کاربری</h2></div>' +
      '<button class="btn btn-danger" data-action="logout">' + I.logout + "خروج از حساب</button></div>";
  }

  /* ---------- Detail loading ---------- */

  async function loadDetail(id) {
    var res = await api("/api/roozkars/" + id);
    state.detail = {
      roozkar: res.roozkar,
      imports: res.imports || [],
      rows: [],
      total: 0,
      page: 1,
      pages: 1,
      pageSize: 25
    };
    await loadSubscribers();
  }

  async function loadSubscribers(page) {
    if (!state.detail) return;
    var d = state.detail;
    if (page) d.page = page;
    var params = new URLSearchParams({
      page: d.page,
      pageSize: d.pageSize,
      q: state.filters.q,
      debt: state.filters.debt,
      status: state.filters.status
    });
    var res = await api("/api/roozkars/" + d.roozkar.id + "/subscribers?" + params.toString());
    d.rows = res.rows;
    d.total = res.total;
    d.pages = res.pages;
    d.page = res.page;
  }

  async function refreshRoozkars() {
    var res = await api("/api/roozkars" + regionQuery());
    state.roozkars = res.roozkars;
  }

  async function refreshStats() {
    var res = await api("/api/stats" + regionQuery());
    state.stats = res.stats;
    state.sends = res.sends || [];
    state.top = res.top || [];
  }

  async function refreshRegions() {
    var res = await api("/api/regions");
    state.regions = res.regions || [];
  }

  async function refreshTemplates() {
    var res = await api("/api/templates");
    state.templates = res.templates || [];
  }

  async function refreshVoice() {
    var res = await api("/api/voice-samples");
    state.voiceSamples = res.samples || [];
  }

  async function refreshSettings() {
    state.settings = await api("/api/settings");
  }

  async function refreshMeta() {
    state.meta = await api("/api/meta");
    updateModePill();
  }

  /* ---------- Actions ---------- */

  async function handleAction(action, el) {
    var id = el.getAttribute("data-id");

    try {
      if (action === "close-modal") { closeModal(); return; }
      if (action === "go-roozkars") { state.view = { name: "roozkars" }; await refreshRoozkars(); render(); return; }

      if (action === "select-region") {
        state.regionId = Number(id);
        try { localStorage.setItem("vosol_region", String(state.regionId)); } catch (e) { /* ignore */ }
        state.view = { name: el.getAttribute("data-go") || "dashboard" };
        await Promise.all([refreshRegions(), refreshStats(), refreshRoozkars()]);
        render();
        toast("وارد " + currentRegionLabel() + " شدید.");
        return;
      }

      if (action === "clear-region") {
        state.regionId = null;
        try { localStorage.removeItem("vosol_region"); } catch (e) { /* ignore */ }
        await Promise.all([refreshRegions(), refreshStats(), refreshRoozkars()]);
        state.view = { name: "regions" };
        render();
        toast("نمایش همه‌ی مناطق فعال شد.");
        return;
      }

      if (action === "add-region") { openAddRegion(); return; }

      if (action === "add-region-submit") {
        var rNum = Number(faToEn(document.getElementById("rgNum").value));
        var rName = document.getElementById("rgName").value.trim();
        if (!rNum) { toast("شماره منطقه را وارد کنید.", "err"); return; }
        if (!rName) { toast("نام منطقه را وارد کنید.", "err"); return; }
        await api("/api/regions", { method: "POST", body: { number: rNum, name: rName } });
        closeModal();
        await Promise.all([refreshRegions(), refreshStats(), refreshRoozkars()]);
        toast("منطقه " + toFa(rNum) + " ساخته شد.");
        render();
        return;
      }

      if (action === "open-result") {
        var qv = el.getAttribute("data-q") || "";
        state.filters = { q: qv, debt: "all", status: "all" };
        state.view = { name: "roozkar", id: id };
        document.getElementById("view").innerHTML = '<div class="loading-line">در حال بارگذاری…</div>';
        await loadDetail(id);
        render();
        return;
      }

      if (action === "open-voice-send") {
        state.view = { name: "voice" };
        await Promise.all([refreshVoice(), refreshStats()]);
        render();
        var vform = document.querySelector(".send-form");
        if (vform) vform.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }

      if (action === "open-roozkar") {
        state.filters = { q: "", debt: "all", status: "all" };
        state.view = { name: "roozkar", id: id };
        document.getElementById("view").innerHTML = '<div class="loading-line">در حال بارگذاری…</div>';
        await loadDetail(id);
        render();
        return;
      }

      if (action === "page") {
        var p = Number(el.getAttribute("data-page")) || 1;
        await loadSubscribers(p);
        render();
        return;
      }

      if (action === "add-roozkar") { openAddRoozkar(); return; }
      if (action === "upload") { openUpload(id); return; }
      if (action === "files") { await openFiles(id); return; }
      if (action === "add-sub") { openAddSub(id); return; }
      if (action === "open-ocr") { openOcr(id); return; }
      if (action === "open-send") { await openSend(el.getAttribute("data-id") ? { roozkarId: Number(el.getAttribute("data-id")) } : {}); return; }
      if (action === "send-one" || action === "send-voice") { await openSingleSend(id, action === "send-voice" ? "voice" : "sms"); return; }

      if (action === "delete-sub") {
        openModal(closeModalHead("حذف مشترک", "این عمل قابل بازگشت نیست") +
          '<div class="note warn">این مشترک از فهرست حذف شود؟</div>' +
          '<div class="modal-foot"><button class="btn btn-danger" data-action="delete-sub-confirm" data-id="' + id + '">' + I.trash + "حذف" +
          '</button><button class="btn btn-ghost" data-action="close-modal">انصراف</button></div>');
        return;
      }

      if (action === "delete-sub-confirm") {
        await api("/api/subscribers/" + id, { method: "DELETE" });
        closeModal();
        toast("مشترک حذف شد.");
        await Promise.all([loadSubscribers(state.detail.page), refreshRoozkars(), refreshStats()]);
        render();
        return;
      }

      if (action === "add-roozkar-submit") {
        var num = Number(faToEn(document.getElementById("rzNum").value));
        var name = document.getElementById("rzName").value.trim();
        var rzRegion = document.getElementById("rzRegion") ? Number(document.getElementById("rzRegion").value) : state.regionId;
        if (!num) { toast("شماره روزکار را وارد کنید.", "err"); return; }
        if (!name) { toast("نام منطقه را وارد کنید.", "err"); return; }
        if (!rzRegion) { toast("ابتدا منطقه را انتخاب کنید.", "err"); return; }
        await api("/api/roozkars", { method: "POST", body: { number: num, name: name, regionId: rzRegion } });
        closeModal();
        await Promise.all([refreshRoozkars(), refreshRegions(), refreshStats()]);
        toast("روزکار " + toFa(num) + " ساخته شد.");
        render();
        return;
      }

      if (action === "add-sub-submit") {
        var payload = {
          name: document.getElementById("sName").value.trim(),
          eshterak: faToEn(document.getElementById("sEsh").value.trim()),
          phone: faToEn(document.getElementById("sPhone").value.trim()),
          debt: Number(faToEn(document.getElementById("sDebt").value)) || 0,
          address: document.getElementById("sAddr").value.trim(),
          bill_id: faToEn(document.getElementById("sBill").value.trim()),
          pay_id: faToEn(document.getElementById("sPay").value.trim()),
          last_pay: document.getElementById("sLastPay").value.trim()
        };
        if (!payload.name) { toast("نام مشترک را وارد کنید.", "err"); return; }
        await api("/api/roozkars/" + id + "/subscribers", { method: "POST", body: payload });
        closeModal();
        toast("مشترک اضافه شد.");
        await Promise.all([loadSubscribers(), refreshRoozkars(), refreshStats()]);
        render();
        return;
      }

      if (action === "add-template") { openTemplateModal(null); return; }

      if (action === "edit-template") {
        var tpl = state.templates.filter(function (t) { return String(t.id) === String(id); })[0];
        if (!tpl) { toast("قالب پیدا نشد.", "err"); return; }
        openTemplateModal(tpl);
        return;
      }

      if (action === "template-submit") {
        var tId = el.getAttribute("data-id");
        var tTitle = document.getElementById("tplTitle").value.trim();
        var tBody = document.getElementById("tplBody").value.trim();
        if (!tTitle) { toast("نام قالب را وارد کنید.", "err"); return; }
        if (!tBody) { toast("متن قالب خالی است.", "err"); return; }
        if (tId) {
          await api("/api/templates/" + tId, { method: "PUT", body: { title: tTitle, body: tBody } });
        } else {
          await api("/api/templates", { method: "POST", body: { title: tTitle, body: tBody } });
        }
        closeModal();
        await refreshTemplates();
        toast("قالب ذخیره شد.");
        render();
        return;
      }

      if (action === "delete-template") {
        openModal(closeModalHead("حذف قالب", "این عمل قابل بازگشت نیست") +
          '<div class="note warn">این قالب متن حذف شود؟</div>' +
          '<div class="modal-foot"><button class="btn btn-danger" data-action="delete-template-confirm" data-id="' + id + '">' + I.trash + "حذف" +
          '</button><button class="btn btn-ghost" data-action="close-modal">انصراف</button></div>');
        return;
      }

      if (action === "delete-template-confirm") {
        await api("/api/templates/" + id, { method: "DELETE" });
        closeModal();
        await refreshTemplates();
        toast("قالب حذف شد.");
        render();
        return;
      }

      if (action === "save-template-from-send") {
        var sTitle = document.getElementById("tplSaveTitle").value.trim();
        var sBody = document.getElementById("msgText").value.trim();
        if (!sTitle) { toast("نام قالب را وارد کنید.", "err"); return; }
        if (!sBody) { toast("متن پیام خالی است.", "err"); return; }
        await api("/api/templates", { method: "POST", body: { title: sTitle, body: sBody } });
        document.getElementById("tplSaveTitle").value = "";
        await refreshTemplates();
        toast("متن به قالب‌ها اضافه شد.");
        return;
      }

      if (action === "upload-voice") {
        var vFile = document.getElementById("vFile").files[0];
        if (!vFile) { toast("ابتدا فایل صوتی را انتخاب کنید.", "err"); return; }
        var vTitle = document.getElementById("vTitle").value.trim();
        var vMin = Number(faToEn(document.getElementById("vMin").value)) || 0;
        var vMax = Number(faToEn(document.getElementById("vMax").value)) || 0;
        var vBtn = document.querySelector('[data-action="upload-voice"]');
        vBtn.classList.add("is-loading");
        vBtn.innerHTML = '<span class="spinner"></span>';
        var vForm = new FormData();
        vForm.append("audio", vFile);
        vForm.append("title", vTitle || vFile.name);
        vForm.append("debt_min", String(vMin));
        vForm.append("debt_max", String(vMax));
        try {
          await api("/api/voice-samples", { method: "POST", form: vForm });
          await refreshVoice();
          toast("فایل صوتی ذخیره شد.");
          render();
        } catch (e) {
          toast(e.message, "err");
          vBtn.classList.remove("is-loading");
          vBtn.innerHTML = I.upload + "آپلود فایل صوتی";
        }
        return;
      }

      if (action === "edit-voice") {
        var vs = state.voiceSamples.filter(function (s) { return String(s.id) === String(id); })[0];
        if (!vs) { toast("فایل صوتی پیدا نشد.", "err"); return; }
        openVoiceModal(vs);
        return;
      }

      if (action === "edit-voice-submit") {
        var eTitle = document.getElementById("evTitle").value.trim();
        var eMin = Number(faToEn(document.getElementById("evMin").value)) || 0;
        var eMax = Number(faToEn(document.getElementById("evMax").value)) || 0;
        if (!eTitle) { toast("نام فایل را وارد کنید.", "err"); return; }
        await api("/api/voice-samples/" + id, { method: "PUT", body: { title: eTitle, debt_min: eMin, debt_max: eMax } });
        closeModal();
        await refreshVoice();
        toast("بازه‌ی فایل صوتی ذخیره شد.");
        render();
        return;
      }

      if (action === "delete-voice") {
        openModal(closeModalHead("حذف فایل صوتی", "این عمل قابل بازگشت نیست") +
          '<div class="note warn">این فایل صوتی حذف شود؟</div>' +
          '<div class="modal-foot"><button class="btn btn-danger" data-action="delete-voice-confirm" data-id="' + id + '">' + I.trash + "حذف" +
          '</button><button class="btn btn-ghost" data-action="close-modal">انصراف</button></div>');
        return;
      }

      if (action === "delete-voice-confirm") {
        await api("/api/voice-samples/" + id, { method: "DELETE" });
        closeModal();
        await refreshVoice();
        toast("فایل صوتی حذف شد.");
        render();
        return;
      }

      if (action === "send-voice-bulk") {
        if (!state.voiceSamples.length) { toast("ابتدا یک فایل صوتی آپلود کنید.", "err"); return; }
        var vRegionSel = document.getElementById("vRegion");
        var vDebtSel = document.getElementById("vDebt");
        var vMode = document.getElementById("vMode").value;
        var vSampleSel = document.getElementById("vSample");
        var vMessage = document.getElementById("vMessage").value.trim();
        var vSampleId = vMode === "manual" && vSampleSel.value ? Number(vSampleSel.value) : null;

        var svBtn = document.querySelector('[data-action="send-voice-bulk"]');
        svBtn.classList.add("is-loading");
        svBtn.innerHTML = '<span class="spinner"></span> در حال ارسال…';
        try {
          var svRes = await api("/api/sends", {
            method: "POST",
            body: {
              type: "voice",
              regionId: vRegionSel.value ? Number(vRegionSel.value) : null,
              debt: vDebtSel.value,
              sampleId: vSampleId,
              message: vMessage
            }
          });
          var svResult = svRes.result || {};
          toast("ارسال صوتی: " + toFa(svResult.sent || 0) + " نفر" +
            (svResult.failed ? "، ناموفق: " + toFa(svResult.failed) : "") +
            (svResult.skipped ? "، ردشده: " + toFa(svResult.skipped) : ""));
          await refreshStats();
          render();
        } catch (e) {
          toast(e.message, "err");
          svBtn.classList.remove("is-loading");
          svBtn.innerHTML = I.volume + "ارسال پیام صوتی";
        }
        return;
      }

      if (action === "save-provider") {
        var pKind = el.getAttribute("data-kind") === "voice" ? "voice" : "sms";
        var pBody = {
          provider: document.getElementById(pKind + "Provider").value,
          base_url: document.getElementById(pKind + "BaseUrl").value.trim(),
          api_key: document.getElementById(pKind + "ApiKey").value.trim(),
          sender: document.getElementById(pKind + "Sender").value.trim(),
          auth_header: document.getElementById(pKind + "AuthHeader").value.trim(),
          auth_prefix: document.getElementById(pKind + "AuthPrefix").value,
          method: document.getElementById(pKind + "Method").value,
          payload: document.getElementById(pKind + "Payload").value
        };
        var pBtn = el;
        pBtn.classList.add("is-loading");
        pBtn.innerHTML = '<span class="spinner"></span>';
        try {
          await api("/api/settings/providers/" + pKind, { method: "POST", body: pBody });
          await Promise.all([refreshSettings(), refreshMeta()]);
          toast("تنظیمات " + (pKind === "voice" ? "پیام صوتی" : "پیامک") + " ذخیره شد.");
          render();
        } catch (e) {
          toast(e.message, "err");
          pBtn.classList.remove("is-loading");
          pBtn.innerHTML = I.save + "ذخیره‌ی تنظیمات";
        }
        return;
      }

      if (action === "save-general") {
        var baseUrl = document.getElementById("publicBaseUrl").value.trim();
        await api("/api/settings/general", { method: "POST", body: { publicBaseUrl: baseUrl } });
        await refreshSettings();
        toast("آدرس عمومی ذخیره شد.");
        return;
      }

      if (action === "gen-api-key") {
        var keyRes = await api("/api/settings/api-key", { method: "POST", body: { action: "generate" } });
        var keyBox = document.getElementById("extKeyBox");
        if (keyBox) keyBox.value = keyRes.apiKey || "";
        await refreshSettings();
        toast("کلید API ساخته شد؛ همین حالا آن را کپی کنید.");
        return;
      }

      if (action === "clear-api-key") {
        await api("/api/settings/api-key", { method: "POST", body: { action: "clear" } });
        var clearBox = document.getElementById("extKeyBox");
        if (clearBox) clearBox.value = "هنوز کلیدی ساخته نشده";
        await refreshSettings();
        toast("کلید API حذف شد.");
        return;
      }

      if (action === "test-send") {
        var tKind = el.getAttribute("data-kind") === "voice" ? "voice" : "sms";
        var tPhone = document.getElementById(tKind + "TestPhone").value.trim();
        if (!tPhone) { toast("شماره تست را وارد کنید.", "err"); return; }
        el.classList.add("is-loading");
        el.innerHTML = '<span class="spinner"></span>';
        try {
          var testRes = await api("/api/settings/test-send", { method: "POST", body: { kind: tKind, phone: tPhone } });
          var tr = testRes.result || {};
          toast("نتیجه‌ی تست: " + toFa(tr.sent || 0) + " ارسال" + (tr.failed ? "، ناموفق: " + toFa(tr.failed) : "") +
            (tr.note ? " — " + tr.note : ""));
          el.classList.remove("is-loading");
          el.innerHTML = I.send + "ارسال تست";
        } catch (e) {
          toast(e.message, "err");
          el.classList.remove("is-loading");
          el.innerHTML = I.send + "ارسال تست";
        }
        return;
      }

      if (action === "logout") {
        await api("/api/logout", { method: "POST" });
        showLogin();
        return;
      }
    } catch (err) {
      toast(err.message, "err");
    }
  }

  /* ---------- Modals ---------- */

  function openAddRoozkar() {
    var regionOptions = state.regions.map(function (g) {
      return '<option value="' + g.id + '"' + (state.regionId === g.id ? " selected" : "") + ">منطقه " + toFa(g.number) + " — " + esc(g.name) + "</option>";
    }).join("");
    openModal(closeModalHead("افزودن روزکار", "شماره، نام مسیر و منطقه را مشخص کنید") +
      '<div class="field"><label for="rzRegion">منطقه</label><select id="rzRegion">' + regionOptions + "</select></div>" +
      '<div class="row2"><div class="field"><label for="rzNum">شماره روزکار</label>' +
      '<input id="rzNum" type="number" inputmode="numeric" placeholder="مثلاً 36"></div>' +
      '<div class="field"><label for="rzName">نام منطقه / مسیر</label>' +
      '<input id="rzName" type="text" placeholder="مثلاً جانبازان"></div></div>' +
      '<div class="note">شماره‌ی روزکار فقط در همان منطقه یکتا است؛ شماره‌ی تکراری در منطقه‌ی دیگر مجاز است.</div>' +
      '<div class="modal-foot"><button class="btn btn-primary" data-action="add-roozkar-submit">' + I.plus + "افزودن" +
      '</button><button class="btn btn-ghost" data-action="close-modal">انصراف</button></div>');
  }

  function openAddRegion() {
    openModal(closeModalHead("افزودن منطقه", "منطقه‌ی جدید با داده‌های کاملاً جدا") +
      '<div class="row2"><div class="field"><label for="rgNum">شماره منطقه</label>' +
      '<input id="rgNum" type="number" inputmode="numeric" placeholder="مثلاً 16"></div>' +
      '<div class="field"><label for="rgName">نام منطقه</label>' +
      '<input id="rgName" type="text" placeholder="مثلاً زاهدان شمالی"></div></div>' +
      '<div class="modal-foot"><button class="btn btn-primary" data-action="add-region-submit">' + I.plus + "افزودن" +
      '</button><button class="btn btn-ghost" data-action="close-modal">انصراف</button></div>');
  }

  function openTemplateModal(tpl) {
    var editing = !!tpl;
    openModal(closeModalHead(editing ? "ویرایش قالب" : "قالب جدید پیامک", "از {name} و {debt} و {eshterak} می‌توانید استفاده کنید") +
      '<div class="field"><label for="tplTitle">نام قالب</label>' +
      '<input id="tplTitle" type="text" value="' + esc(editing ? tpl.title : "") + '" placeholder="مثلاً یادآوری بدهی"></div>' +
      '<div class="field"><label for="tplBody">متن پیام</label>' +
      '<textarea id="tplBody" rows="5" placeholder="مشترک گرامی {name}، بدهی برق شما {debt} ریال است.">' + esc(editing ? tpl.body : "") + "</textarea>" +
      '<span class="help">حداکثر ۲۰۰۰ کاراکتر · متغیرهای مجاز: {name} {debt} {eshterak} {address} {phone} {bill_id} {pay_id} {roozkar} {region}</span></div>' +
      '<div class="modal-foot"><button class="btn btn-yellow" data-action="template-submit"' +
      (editing ? ' data-id="' + tpl.id + '"' : "") + ">" + I.save + (editing ? "ذخیره" : "افزودن") +
      '</button><button class="btn btn-ghost" data-action="close-modal">انصراف</button></div>');
  }

  function openVoiceModal(sample) {
    openModal(closeModalHead("ویرایش فایل صوتی", esc(sample.original_name || "")) +
      '<div class="field"><label for="evTitle">نام فایل</label>' +
      '<input id="evTitle" type="text" value="' + esc(sample.title) + '"></div>' +
      '<div class="row2"><div class="field"><label for="evMin">از بدهی (ریال)</label>' +
      '<input id="evMin" type="number" inputmode="numeric" value="' + Number(sample.debt_min || 0) + '"></div>' +
      '<div class="field"><label for="evMax">تا بدهی (ریال) — ۰ یعنی بدون سقف</label>' +
      '<input id="evMax" type="number" inputmode="numeric" value="' + Number(sample.debt_max || 0) + '"></div></div>' +
      '<div class="modal-foot"><button class="btn btn-yellow" data-action="edit-voice-submit" data-id="' + sample.id + '">' + I.save + "ذخیره" +
      '</button><button class="btn btn-ghost" data-action="close-modal">انصراف</button></div>');
  }

  function openUpload(rzId) {
    state.importToken = null;
    openModal(closeModalHead("بارگذاری اکسل", "فایل xlsx یا csv انتخاب کنید؛ قبل از ثبت پیش‌نمایش می‌بینید.") +
      '<div class="dropzone" id="dropzone">' + I.upload +
      "<strong>فایل را انتخاب کنید</strong><span>فرمت مجاز: xlsx، xls، csv — حداکثر " +
      toFa((state.meta && state.meta.maxUploadMb) || 25) + " مگابایت</span>" +
      '<div style="margin-top:12px">' + filePickInline("fileInput", ".xlsx,.xls,.csv", "اکسل انتخاب نشده") + "</div></div>" +
      '<div class="field" style="margin-top:14px"><label for="mode">رفتار بارگذاری</label>' +
      '<select id="mode"><option value="replace">فایل جدید (نسخه‌ی فعال)</option><option value="append">افزودن به فهرست فعلی</option></select></div>' +
      '<div class="modal-foot"><button class="btn btn-yellow" data-action="upload-preview" data-id="' + rzId + '">' + I.upload + "پیش‌نمایش" +
      '</button><button class="btn btn-ghost" data-action="close-modal">انصراف</button></div>');
  }

  async function openFiles(rzId) {
    try {
      var res = await api("/api/roozkars/" + rzId);
      var rz = res.roozkar;
      var imports = res.imports || [];
      state.detailImports = imports;
      state.filesRoozkarId = rzId;

      var list = imports.map(function (f) {
        var active = f.id === rz.active_import_id;
        return '<div class="file-row"><div class="file-ic">' + I.file + "</div>" +
          '<div class="file-info"><strong>' + esc(f.original_name) + (active ? ' <span class="chip green">فعال</span>' : "") + "</strong>" +
          '<span class="num">' + formatDateTime(f.created_at) + " · " + toFa(f.rows) + " ردیف · " +
          (f.source === "ocr" ? "عکس" : f.source === "manual" ? "دستی" : "اکسل") + "</span></div>" +
          '<div class="file-actions">' +
          (active ? "" : '<button class="btn btn-outline btn-sm" data-action="activate-import" data-id="' + f.id + '">فعال‌سازی</button>') +
          "</div></div>";
      }).join("");

      openModal(closeModalHead("فایل‌های روزکار " + toFa(rz.number), toFa(imports.length) + " فایل ثبت‌شده") +
        (list || '<div class="empty"><strong>فایلی ثبت نشده است</strong></div>') +
        '<div class="modal-foot"><button class="btn btn-yellow" data-action="upload" data-id="' + rzId + '">' + I.upload + "بارگذاری فایل جدید</button></div>",
        true);
    } catch (e) { toast(e.message, "err"); }
  }

  async function activateImport(importId) {
    await api("/api/imports/" + importId + "/activate", { method: "POST" });
    closeModal();
    var id = state.view.id;
    await loadDetail(id);
    await refreshRoozkars();
    toast("نسخه‌ی انتخابی فعال شد.");
    render();
  }

  async function uploadPreview(rzId) {
    var input = document.getElementById("fileInput");
    var file = input && input.files && input.files[0];
    if (!file) { toast("ابتدا یک فایل انتخاب کنید.", "err"); return; }

    var btn = document.querySelector('[data-action="upload-preview"]');
    btn.classList.add("is-loading");
    btn.innerHTML = '<span class="spinner"></span>';

    var form = new FormData();
    form.append("file", file);

    try {
      var res = await api("/api/imports/preview", { method: "POST", form: form });
      state.importToken = res.token;
      state.importMode = document.getElementById("mode").value;
      renderImportPreview(rzId, res);
    } catch (err) {
      toast(err.message, "err");
      btn.classList.remove("is-loading");
      btn.innerHTML = I.upload + "پیش‌نمایش";
    }
  }

  function renderImportPreview(rzId, res) {
    var rows = (res.preview || []).map(function (r) {
      return "<tr><td class='num'>" + toFa(r.eshterak || "-") + "</td><td>" + esc(r.name) + "</td>" +
        "<td class='cell-sub'>" + esc(r.address || "-") + "</td><td class='num'>" + (r.last_pay || "-") + "</td>" +
        "<td class='money over num'>" + fmtNum(r.debt) + "</td><td class='cell-sub num'>" + (r.phone ? toFa(r.phone) : "-") + "</td></tr>";
    }).join("");

    var labels = (state.meta && state.meta.columns) || {};
    var mapping = Object.keys(res.mapping || {}).map(function (k) {
      return "<div class='line'><span>" + esc(labels[k] || k) + "</span><b>" + esc(res.mapping[k]) + "</b></div>";
    }).join("");

    var warnings = (res.warnings || []).slice(0, 6).map(function (w) {
      return "<div style='font-size:11.5px' class='badge-warn'>" + esc(w) + "</div>";
    }).join("");

    openModal(closeModalHead("پیش‌نمایش فایل", esc(res.filename)) +
      '<div class="kv">' +
      "<div><span>ردیف معتبر</span><b class='num'>" + toFa(res.total) + "</b></div>" +
      "<div><span>ردیف ردشده</span><b class='num'>" + toFa(res.skipped || 0) + "</b></div>" +
      "<div><span>شیت</span><b>" + esc(res.sheetName || "-") + "</b></div>" +
      "<div><span>شماره تماس</span><b>" + (res.mapping && res.mapping.phone ? "دارد" : "ندارد") + "</b></div>" +
      "</div>" +
      (warnings ? '<div class="note warn">' + warnings + "</div>" : "") +
      '<div class="table-wrap preview-table"><table><thead><tr><th>اشتراک</th><th>مشترک</th><th>آدرس</th><th>آخرین پرداخت</th><th>بدهی</th><th>تلفن</th></tr></thead><tbody>' +
      (rows || '<tr><td colspan="6">ردیفی برای نمایش نیست</td></tr>') + "</tbody></table></div>" +
      '<details style="margin-top:12px"><summary style="font-size:12.5px;cursor:pointer;color:var(--text-2)">نگاشت ستون‌ها</summary>' +
      '<div class="summary-box" style="margin-top:8px">' + mapping + "</div></details>" +
      '<div class="modal-foot"><button class="btn btn-yellow" data-action="commit-import" data-id="' + rzId + '">' + I.check + "ثبت " + toFa(res.total) + " ردیف" +
      '</button><button class="btn btn-ghost" data-action="close-modal">انصراف</button></div>', true);
  }

  async function commitImport(rzId) {
    try {
      var res = await api("/api/roozkars/" + rzId + "/imports", {
        method: "POST",
        body: { token: state.importToken, mode: state.importMode || "replace" }
      });
      closeModal();
      toast("ثبت شد: " + toFa(res.inserted) + " ردیف.");
      await Promise.all([refreshRoozkars(), refreshStats()]);
      if (state.view.name === "roozkar" && Number(state.view.id) === Number(rzId)) {
        await loadDetail(rzId);
      }
      render();
    } catch (e) { toast(e.message, "err"); }
  }

  function openAddSub(rzId) {
    openModal(closeModalHead("افزودن مشترک", "فیلدها اختیاری‌اند؛ نام الزامی است.") +
      '<div class="row2"><div class="field"><label for="sName">نام مشترک</label><input id="sName" type="text"></div>' +
      '<div class="field"><label for="sEsh">شماره اشتراک</label><input id="sEsh" type="text" inputmode="numeric"></div></div>' +
      '<div class="row2"><div class="field"><label for="sPhone">شماره تماس</label><input id="sPhone" type="text" inputmode="tel" placeholder="0912…"></div>' +
      '<div class="field"><label for="sDebt">مبلغ بدهی (ریال)</label><input id="sDebt" type="number" inputmode="numeric" value="0"></div></div>' +
      '<div class="field"><label for="sAddr">آدرس</label><input id="sAddr" type="text"></div>' +
      '<div class="row2"><div class="field"><label for="sBill">شناسه قبض</label><input id="sBill" type="text" inputmode="numeric" maxlength="13"></div>' +
      '<div class="field"><label for="sPay">شناسه پرداخت</label><input id="sPay" type="text" inputmode="numeric" maxlength="11"></div></div>' +
      '<div class="field"><label for="sLastPay">تاریخ آخرین پرداخت (شمسی)</label><input id="sLastPay" type="text" placeholder="۱۴۰۵/۰۸/۲۱"></div>' +
      '<div class="modal-foot"><button class="btn btn-primary" data-action="add-sub-submit" data-id="' + rzId + '">' + I.plus + "ثبت مشترک" +
      '</button><button class="btn btn-ghost" data-action="close-modal">انصراف</button></div>');
  }

  /* ---------- OCR ---------- */

  function openOcr(rzId) {
    openModal(closeModalHead("خواندن عکس جدول", "عکس جدول را انتخاب کنید؛ متن و ردیف‌ها استخراج می‌شوند و قبل از ثبت قابل ویرایش‌اند.") +
      '<div class="dropzone">' + I.image +
      "<strong>عکس جدول (PNG یا JPG)</strong><span>کیفیت و نور مناسب، نتیجه‌ی دقیق‌تری می‌دهد</span>" +
      '<div style="margin-top:12px">' + filePickInline("ocrInput", "image/*", "عکس انتخاب نشده", ' capture="environment"') + "</div></div>" +
      '<div class="note warn" style="margin-top:12px">دقت OCR روی عکس‌های کم‌کیفیت پایین است؛ ردیف‌ها را قبل از ثبت بررسی کنید.</div>' +
      '<div class="modal-foot"><button class="btn btn-yellow" data-action="ocr-run" data-id="' + rzId + '">' + I.search + "خواندن تصویر" +
      '</button><button class="btn btn-ghost" data-action="close-modal">انصراف</button></div>', true);
  }

  async function runOcr(rzId) {
    var input = document.getElementById("ocrInput");
    var file = input && input.files && input.files[0];
    if (!file) { toast("ابتدا عکس را انتخاب کنید.", "err"); return; }
    var btn = document.querySelector('[data-action="ocr-run"]');
    btn.classList.add("is-loading");
    btn.innerHTML = '<span class="spinner"></span> در حال خواندن…';

    var form = new FormData();
    form.append("image", file);
    try {
      var res = await api("/api/ocr", { method: "POST", form: form });
      state.ocrRows = res.rows || [];
      renderOcrEditor(rzId, res, file.name);
    } catch (e) {
      toast(e.message, "err");
      btn.classList.remove("is-loading");
      btn.innerHTML = I.search + "خواندن تصویر";
    }
  }

  function renderOcrEditor(rzId, res, filename) {
    var fields = [
      ["name", "مشترک", ""],
      ["eshterak", "اشتراک", "num"],
      ["phone", "تلفن", "ltr"],
      ["debt", "بدهی (ریال)", "num"],
      ["address", "آدرس", ""]
    ];
    var rowsHtml = state.ocrRows.map(function (r, idx) {
      return "<tr data-row='" + idx + "'><td>" + fields.map(function (f) {
        return ""; // placeholder, filled below
      }).join("") + "</td></tr>";
    });
    // ردیف‌های ویرایش‌پذیر
    rowsHtml = state.ocrRows.map(function (r, idx) {
      return "<tr data-row='" + idx + "'>" +
        fields.map(function (f) {
          return "<td><input data-field='" + f[0] + "' value='" + esc(r[f[0]] != null ? r[f[0]] : "") + "'></td>";
        }).join("") +
        "</tr>";
    }).join("");

    var headHtml = fields.map(function (f) { return "<th>" + f[1] + "</th>"; }).join("");

    openModal(closeModalHead("بازبینی ردیف‌های خوانده‌شده", esc(filename) + " · " + toFa(state.ocrRows.length) + " ردیف") +
      (state.ocrRows.length ? "" : '<div class="note warn">هیچ ردیفی شناسایی نشد. عکس واضح‌تری امتحان کنید یا ردیف‌ها را دستی اضافه کنید.</div>') +
      '<div class="table-wrap ocr-editor" style="max-height:340px"><table><thead><tr>' + headHtml + '<th></th></tr></thead><tbody>' +
      (rowsHtml || "") + "</tbody></table></div>" +
      '<div class="modal-foot"><button class="btn btn-primary" data-action="ocr-commit" data-id="' + rzId + '"' +
      (state.ocrRows.length ? "" : " disabled") + ">" + I.check + "ثبت ردیف‌ها</button>" +
      '<button class="btn btn-ghost" data-action="close-modal">انصراف</button></div>', true);

    var editor = document.querySelector(".ocr-editor tbody");
    if (editor) {
      editor.addEventListener("input", function (e) {
        var input = e.target.closest("input[data-field]");
        if (!input) return;
        var tr = input.closest("tr");
        var idx = Number(tr.getAttribute("data-row"));
        var field = input.getAttribute("data-field");
        var value = input.value;
        state.ocrRows[idx][field] = field === "debt" ? Number(faToEn(value)) || 0 : value;
      });
    }
  }

  async function commitOcr(rzId) {
    try {
      var rows = state.ocrRows.filter(function (r) { return String(r.name || "").trim(); });
      if (!rows.length) { toast("ردیف معتبری برای ثبت نیست.", "err"); return; }
      var res = await api("/api/ocr/commit", { method: "POST", body: { roozkarId: Number(rzId), rows: rows } });
      closeModal();
      toast("ثبت شد: " + toFa(res.inserted) + " ردیف از عکس.");
      await Promise.all([refreshRoozkars(), refreshStats()]);
      if (state.view.name === "roozkar") await loadDetail(state.view.id);
      render();
    } catch (e) { toast(e.message, "err"); }
  }

  /* ---------- Send ---------- */

  async function openSingleSend(subId, type) {
    try {
      var found = null;
      if (state.detail) {
        state.detail.rows.forEach(function (r) { if (String(r.id) === String(subId)) found = r; });
      }
      var sub = found;
      var phone = sub ? sub.phone : "";
      var name = sub ? sub.name : "مشترک";
      var debt = sub ? sub.debt : 0;

      openModal(closeModalHead(type === "voice" ? "ارسال پیام صوتی" : "ارسال پیامک", esc(name) + " · " + fmtNum(debt) + " ریال بدهی") +
        (phone ? "" : '<div class="note warn">برای این مشترک شماره تماس ثبت نشده است؛ ارسال ممکن نیست.</div>') +
        '<div class="field"><label for="msgText">' + (type === "voice" ? "متن پیام صوتی" : "متن پیامک") + "</label>" +
        '<textarea id="msgText">مشترک گرامی، بدهی برق شما به مبلغ ' + fmtNum(debt) + ' ریال است. لطفاً نسبت به تسویه اقدام فرمایید.</textarea>' +
        '<span class="help">در صورت فعال بودن آداپتور، ارسال واقعی انجام می‌شود.</span></div>' +
        '<div class="modal-foot"><button class="btn btn-yellow" data-action="send-submit" data-id="' + subId + '" data-type="' + type + '"' +
        (phone ? "" : " disabled") + ">" + I.send + "ارسال</button>" +
        '<button class="btn btn-ghost" data-action="close-modal">انصراف</button></div>');
    } catch (e) { toast(e.message, "err"); }
  }

  async function openSend(opts) {
    opts = opts || {};
    var scopeRegion = opts.regionId ? null : state.regionId;
    var templateOptions = '<option value="">متن آزاد</option>' + (state.templates || []).map(function (t) {
      return '<option value="' + t.id + '">' + esc(t.title) + "</option>";
    }).join("");

    openModal(closeModalHead("ارسال گروهی", "انتخاب گیرندگان بر اساس مبلغ بدهی") +
      '<div class="note">محدوده‌ی ارسال: <b>' + esc(opts.roozkarId ? "همین روزکار" : currentRegionLabel()) + "</b></div>" +
      '<div class="field"><label>نوع ارسال</label><div class="seg" id="typeSeg">' +
      '<button data-type="sms" class="is-active">' + I.send + 'پیامک متنی</button>' +
      '<button data-type="voice">' + I.volume + "پیام صوتی</button></div></div>" +
      (opts.roozkarId ? "" : '<div class="field"><label for="sendRz">محدوده</label><select id="sendRz">' +
        '<option value="">همه‌ی روزکارهای ' + (scopeRegion ? "این منطقه" : "همه‌ی مناطق") + "</option>" +
        state.roozkars.map(function (rz) {
          return '<option value="' + rz.id + '">روزکار ' + toFa(rz.number) + " — " + esc(rz.name) + "</option>";
        }).join("") + "</select></div>") +
      '<div class="field"><label for="sendDebt">بازه‌ی بدهی</label><select id="sendDebt">' +
      '<option value="all">همه‌ی بدهکاران</option>' +
      '<option value="lt1">کمتر از ۱ میلیون ریال</option>' +
      '<option value="1to10">۱ تا ۱۰ میلیون ریال</option>' +
      '<option value="gt10">بیش از ۱۰ میلیون ریال</option></select></div>' +
      '<div class="summary-box" id="sendSummary"><div class="line"><span>در حال محاسبه…</span></div></div>' +
      '<div class="field" style="margin-top:12px"><label for="sendTemplate">قالب آماده</label>' +
      '<select id="sendTemplate">' + templateOptions + "</select>" +
      '<span class="help">قالب را انتخاب کنید تا متن پایین پر شود، یا خودتان بنویسید.</span></div>' +
      '<div class="field"><label for="msgText">متن پیام</label>' +
      '<textarea id="msgText" rows="4">مشترک گرامی، بدهی برق شما به مبلغ {debt} ریال است. لطفاً نسبت به تسویه اقدام فرمایید.</textarea>' +
      '<span class="help">متغیرها: {name} {debt} {eshterak} {address} {phone} {bill_id} {pay_id} {roozkar} {region} — برای پیام صوتی، متن اختیاری است.</span></div>' +
      '<div class="tpl-save-row"><input id="tplSaveTitle" type="text" placeholder="نام قالب برای ذخیره‌ی این متن">' +
      '<button class="btn btn-outline btn-sm" data-action="save-template-from-send">' + I.save + "ذخیره به عنوان قالب</button></div>" +
      '<div class="modal-foot"><button class="btn btn-yellow" data-action="send-bulk" data-id="' + (opts.roozkarId || "") + '">' + I.send + "ارسال" +
      '</button><button class="btn btn-ghost" data-action="close-modal">انصراف</button></div>', true);

    var seg = document.getElementById("typeSeg");
    var debtSel = document.getElementById("sendDebt");
    var rzSel = document.getElementById("sendRz");
    var tplSel = document.getElementById("sendTemplate");
    var typeState = { type: "sms" };
    state.sendTypeState = typeState;

    seg.addEventListener("click", function (e) {
      var b = e.target.closest("button[data-type]");
      if (!b) return;
      typeState.type = b.getAttribute("data-type");
      seg.querySelectorAll("button").forEach(function (x) { x.classList.remove("is-active"); });
      b.classList.add("is-active");
    });

    if (tplSel) {
      tplSel.addEventListener("change", function () {
        var tpl = state.templates.filter(function (t) { return String(t.id) === tplSel.value; })[0];
        if (tpl) document.getElementById("msgText").value = tpl.body;
      });
    }

    async function refresh() {
      await refreshSendSummary(opts.roozkarId, rzSel, debtSel, scopeRegion);
    }
    debtSel.addEventListener("change", refresh);
    if (rzSel) rzSel.addEventListener("change", refresh);
    await refresh();
  }

  async function refreshSendSummary(fixedRz, rzSel, debtSel, regionId) {
    var box = document.getElementById("sendSummary");
    if (!box) return;
    var roozkarId = fixedRz || (rzSel ? rzSel.value : "");
    try {
      var res = await api("/api/sends/preview", {
        method: "POST",
        body: { roozkarId: roozkarId || null, regionId: roozkarId ? null : regionId || null, debt: debtSel.value }
      });
      box.innerHTML =
        '<div class="line"><span>تعداد گیرندگان</span><b class="num">' + toFa(res.count) + " نفر</b></div>" +
        '<div class="line"><span>مجموع بدهی</span><b class="num">' + fmtNum(res.debt) + " ریال</b></div>" +
        '<div class="line"><span>دارای شماره تماس</span><b class="num">' + toFa(res.withPhone) + " نفر</b></div>" +
        (res.sample.length ? '<div class="line" style="border-top:1px solid var(--line);padding-top:6px"><span>نمونه</span><b style="font-weight:500;font-size:11.5px">' +
          res.sample.map(function (s) { return esc(s.name); }).join("، ") + "</b></div>" : "");
      var btn = document.querySelector('[data-action="send-bulk"]');
      if (btn) btn.disabled = !res.count || !res.withPhone;
      if (res.count && !res.withPhone) {
        box.innerHTML += '<div class="line" style="color:var(--amber)"><span>برای ارسال، ستون «شماره تماس» در اکسل لازم است.</span></div>';
      }
    } catch (e) {
      box.innerHTML = '<div class="line"><span>' + esc(e.message) + "</span></div>";
    }
  }

  async function submitBulkSend(roozkarId) {
    var debtSel = document.getElementById("sendDebt");
    var rzSel = document.getElementById("sendRz");
    var msg = document.getElementById("msgText").value.trim();
    var type = state.sendTypeState ? state.sendTypeState.type : "sms";
    if (type === "sms" && !msg) { toast("متن پیام خالی است.", "err"); return; }

    var btn = document.querySelector('[data-action="send-bulk"]');
    btn.classList.add("is-loading");
    btn.innerHTML = '<span class="spinner"></span> در حال ارسال…';
    try {
      var res = await api("/api/sends", {
        method: "POST",
        body: {
          type: type,
          roozkarId: (roozkarId || (rzSel ? rzSel.value : "")) || null,
          regionId: roozkarId || (rzSel && rzSel.value) ? null : state.regionId,
          debt: debtSel.value,
          message: msg
        }
      });
      closeModal();
      toast("ارسال انجام شد: " + toFa(res.result.sent) + " نفر" + (res.result.failed ? "، ناموفق: " + toFa(res.result.failed) : ""));
      await refreshStats();
      if (state.view.name === "roozkar") await loadSubscribers();
      render();
    } catch (e) {
      toast(e.message, "err");
      btn.classList.remove("is-loading");
      btn.innerHTML = I.send + "ارسال";
    }
  }

  async function submitSingleSend(subId, type) {
    var msg = document.getElementById("msgText").value.trim();
    var btn = document.querySelector('[data-action="send-submit"]');
    btn.classList.add("is-loading");
    btn.innerHTML = '<span class="spinner"></span>';
    try {
      var res = await api("/api/sends", { method: "POST", body: { type: type, subscriberId: Number(subId), message: msg } });
      closeModal();
      toast("ارسال: " + toFa(res.result.sent) + " نفر" + (res.result.failed ? "، ناموفق: " + toFa(res.result.failed) : ""));
      await refreshStats();
      if (state.view.name === "roozkar") await loadSubscribers();
      render();
    } catch (e) {
      toast(e.message, "err");
      btn.classList.remove("is-loading");
      btn.innerHTML = I.send + "ارسال";
    }
  }

  /* ---------- View bindings ---------- */

  async function refreshVoiceSummary() {
    var box = document.getElementById("voiceSummary");
    if (!box) return;
    var regionSel = document.getElementById("vRegion");
    var debtSel = document.getElementById("vDebt");
    try {
      var res = await api("/api/sends/preview", {
        method: "POST",
        body: { regionId: regionSel && regionSel.value ? Number(regionSel.value) : null, debt: debtSel ? debtSel.value : "all" }
      });
      var ranges = (state.voiceSamples || []).map(function (s) {
        return '<div class="line"><span>' + esc(rangeLabel(s.debt_min, s.debt_max)) + "</span><b>" + esc(s.title) + "</b></div>";
      }).join("");
      box.innerHTML =
        '<div class="line"><span>تعداد گیرندگان</span><b class="num">' + toFa(res.count) + " نفر</b></div>" +
        '<div class="line"><span>دارای شماره تماس</span><b class="num">' + toFa(res.withPhone) + " نفر</b></div>" +
        '<div class="line"><span>مجموع بدهی</span><b class="num">' + fmtNum(res.debt) + " ریال</b></div>" +
        (ranges ? '<div class="line" style="border-top:1px solid var(--line);padding-top:6px"><span>نگاشت خودکار فایل‌ها</span><b>' + toFa(state.voiceSamples.length) + " فایل</b></div>" + ranges : "");
      var btn = document.querySelector('[data-action="send-voice-bulk"]');
      if (btn) btn.disabled = !res.count || !res.withPhone || !state.voiceSamples.length;
      if (!state.voiceSamples.length) {
        box.innerHTML += '<div class="line" style="color:var(--amber)"><span>ابتدا یک فایل صوتی آپلود کنید.</span></div>';
      } else if (res.count && !res.withPhone) {
        box.innerHTML += '<div class="line" style="color:var(--amber)"><span>گیرندگان شماره تماس ندارند؛ ستون «شماره تماس» را در اکسل بررسی کنید.</span></div>';
      }
    } catch (e) {
      box.innerHTML = '<div class="line"><span>' + esc(e.message) + "</span></div>";
    }
  }

  function bindView() {
    var q = document.getElementById("q");
    if (q) {
      q.addEventListener("input", function () {
        state.filters.q = q.value;
        clearTimeout(qTimer);
        qTimer = setTimeout(async function () {
          await loadSubscribers(1);
          var pos = q.selectionStart;
          render();
          var nq = document.getElementById("q");
          if (nq) { nq.focus(); try { nq.setSelectionRange(pos, pos); } catch (e) {} }
        }, 320);
      });
    }
    var d = document.getElementById("debtFilter");
    if (d) d.addEventListener("change", async function () {
      state.filters.debt = d.value;
      await loadSubscribers(1);
      render();
    });
    var st = document.getElementById("statusFilter");
    if (st) st.addEventListener("change", async function () {
      state.filters.status = st.value;
      await loadSubscribers(1);
      render();
    });

    var gq = document.getElementById("gq");
    if (gq) {
      gq.addEventListener("input", function () {
        state.globalQuery = gq.value;
        clearTimeout(gqTimer);
        var value = gq.value;
        gqTimer = setTimeout(function () { runGlobalSearch(value); }, 320);
      });
      gq.addEventListener("keydown", function (e) {
        if (e.key === "Enter") {
          e.preventDefault();
          clearTimeout(gqTimer);
          runGlobalSearch(gq.value);
        }
      });
    }

    var vMode = document.getElementById("vMode");
    if (vMode) {
      vMode.addEventListener("change", function () {
        var sel = document.getElementById("vSample");
        if (sel) sel.disabled = vMode.value !== "manual";
        refreshVoiceSummary();
      });
    }
    ["vRegion", "vDebt"].forEach(function (fid) {
      var f = document.getElementById(fid);
      if (f) f.addEventListener("change", refreshVoiceSummary);
    });
    if (document.getElementById("voiceSummary")) refreshVoiceSummary();
  }

  /* ---------- Global events ---------- */

  document.addEventListener("click", async function (e) {
    var el = e.target.closest("[data-action],[data-nav]");
    if (!el) return;

    if (el.hasAttribute("data-nav")) {
      var nav = el.getAttribute("data-nav");
      state.view = { name: nav };
      closeSidebar();
      try {
        if (nav === "roozkars" || nav === "send" || nav === "dashboard" || nav === "voice") {
          await Promise.all([refreshRoozkars(), refreshStats()]);
        }
        if (nav === "regions") await refreshRegions();
        if (nav === "voice") await refreshVoice();
        if (nav === "settings") await Promise.all([refreshSettings(), refreshMeta()]);
        if (nav === "send" || nav === "voice") {
          var r = await api("/api/sends?limit=50");
          state.sends = r.sends;
        }
      } catch (err) { /* ignore */ }
      render();
      return;
    }

    var action = el.getAttribute("data-action");

    if (action === "upload-preview") { await uploadPreview(el.getAttribute("data-id")); return; }
    if (action === "commit-import") { await commitImport(el.getAttribute("data-id")); return; }
    if (action === "activate-import") { await activateImport(el.getAttribute("data-id")); return; }
    if (action === "ocr-run") { await runOcr(el.getAttribute("data-id")); return; }
    if (action === "ocr-commit") { await commitOcr(el.getAttribute("data-id")); return; }
    if (action === "send-bulk") { await submitBulkSend(el.getAttribute("data-id")); return; }
    if (action === "send-submit") { await submitSingleSend(el.getAttribute("data-id"), el.getAttribute("data-type")); return; }

    await handleAction(action, el);
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") closeModal();
  });

  /* ---------- Sidebar ---------- */

  function openSidebar() {
    document.getElementById("sidebar").classList.add("open");
    document.getElementById("scrim").hidden = false;
  }
  function closeSidebar() {
    document.getElementById("sidebar").classList.remove("open");
    document.getElementById("scrim").hidden = true;
  }

  document.getElementById("menuBtn").addEventListener("click", function () {
    if (document.getElementById("sidebar").classList.contains("open")) closeSidebar(); else openSidebar();
  });
  document.getElementById("scrim").addEventListener("click", closeSidebar);
  document.getElementById("quickSendBtn").addEventListener("click", function () { openSend({}); });

  /* نام فایل انتخاب‌شده را کنار دکمه‌ی «انتخاب فایل» نشان می‌دهد */
  document.addEventListener("change", function (e) {
    var inp = e.target;
    if (!inp || !inp.classList || !inp.classList.contains("fp-input")) return;
    var nm = document.getElementById(inp.id + "Name");
    if (nm) nm.textContent = inp.files && inp.files[0] ? inp.files[0].name : "فایلی انتخاب نشده";
  });
  var voiceSendBtn = document.getElementById("voiceSendBtn");
  if (voiceSendBtn) voiceSendBtn.addEventListener("click", async function () {
    state.view = { name: "voice" };
    try { await Promise.all([refreshVoice(), refreshStats()]); } catch (e) { /* ignore */ }
    render();
    var form = document.querySelector(".send-form");
    if (form) form.scrollIntoView({ behavior: "smooth", block: "center" });
  });

  /* ---------- Start ---------- */

  bindLogin();
  boot();
})();
