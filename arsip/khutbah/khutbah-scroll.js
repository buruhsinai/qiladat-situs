/* =========================================================
   JAZMI — Khutbah: Mode Scroll untuk Khatib
   khutbah-scroll.js  (satu berkas dipakai semua halaman khutbah)

   Menambahkan bar tetap di bawah layar berisi:
     - 3 mode:  Arab (per ayat/hadis/teks Arab) · Layar (per tatap muka,
                sisakan 2 baris konteks) · Ujung (paling atas / paling bawah)
     - 2 tombol besar: ▲ ke atas, ▼ ke bawah

   Cara pasang: sebelum </body> tambahkan
     <script src="khutbah-scroll.js" defer></script>
   Tidak menyentuh CSS/JS bawaan halaman. Mode terakhir diingat
   (localStorage, kunci jazmi-khutbah-mode-scroll).
   ========================================================= */
(function () {
  "use strict";

  var KEY_MODE = "jazmi-khutbah-mode-scroll";
  var BARIS_KONTEKS = 2;      // jumlah baris yang disisakan saat mode Layar
  var MARGIN_ATAS = 14;       // jarak target dari tepi atas layar (px)

  var CSS = [
    ".ks-bar{position:fixed;left:0;right:0;bottom:0;z-index:50;display:flex;justify-content:center;",
    "padding:.5rem .75rem calc(.5rem + env(safe-area-inset-bottom,0px));",
    "background:rgba(255,255,255,.96);border-top:1px solid var(--line,#DDD3B8);",
    "box-shadow:0 -6px 20px -10px rgba(15,61,46,.25);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);}",
    ".ks-inner{display:flex;align-items:stretch;gap:.5rem;width:100%;max-width:760px;}",
    ".ks-modes{display:flex;flex:1;min-width:0;border:1px solid var(--line,#DDD3B8);border-radius:4px;overflow:hidden;background:var(--bg-alt,#EEE6D2);}",
    ".ks-mode{flex:1;min-width:0;appearance:none;border:0;background:transparent;color:var(--ink,#1E2A22);",
    "font-family:var(--font-body,sans-serif);font-size:.8rem;font-weight:600;line-height:1.15;padding:.35rem .25rem;cursor:pointer;",
    "display:flex;flex-direction:column;align-items:center;justify-content:center;gap:.1rem;}",
    ".ks-mode + .ks-mode{border-left:1px solid var(--line,#DDD3B8);}",
    ".ks-mode small{font-size:.66rem;font-weight:500;color:var(--ink-soft,#4B5A50);}",
    ".ks-mode[aria-pressed=true]{background:var(--emerald-deep,#0F3D2E);color:#fff;}",
    ".ks-mode[aria-pressed=true] small{color:#D8C08A;}",
    ".ks-nav{flex:none;width:3.4rem;min-height:3rem;appearance:none;border:1px solid var(--emerald-deep,#0F3D2E);",
    "background:var(--emerald,#1C5C42);color:#fff;font-size:1.35rem;line-height:1;border-radius:4px;cursor:pointer;",
    "touch-action:manipulation;}",
    ".ks-nav:active{background:var(--emerald-deep,#0F3D2E);}",
    ".ks-mode:focus-visible,.ks-nav:focus-visible{outline:2px solid var(--brass,#A9812F);outline-offset:2px;}",
    "body.ks-aktif{padding-bottom:var(--ks-bar-h,5rem);}",
    "@keyframes ks-kilau{from{background:rgba(216,192,138,.55);}to{background:transparent;}}",
    ".ks-kilau{animation:ks-kilau 1.1s ease-out;border-radius:4px;}",
    "@media (prefers-reduced-motion:reduce){.ks-kilau{animation:none;}}",
    "@media print{.ks-bar{display:none !important;}body.ks-aktif{padding-bottom:0;}}"
  ].join("");

  var MODE = [
    { id: "arab",   label: "Arab",  sub: "per ayat/hadis", aria: "Mode loncat per ayat, hadis, atau teks Arab" },
    { id: "layar",  label: "Layar", sub: "per tatap muka", aria: "Mode geser per layar dengan dua baris konteks" },
    { id: "ujung",  label: "Ujung", sub: "atas / bawah",   aria: "Mode langsung ke paling atas atau paling bawah naskah" }
  ];

  var mode = "layar";
  var naskah, bar, blokArab = [];

  /* ---------- util ---------- */
  function tinggiBar() { return bar ? bar.offsetHeight : 0; }

  function tinggiBaris() {
    var p = naskah.querySelector("p:not(.arab):not(.doa)") || naskah;
    var lh = parseFloat(getComputedStyle(p).lineHeight);
    if (!isFinite(lh)) lh = parseFloat(getComputedStyle(p).fontSize) * 1.65;
    return lh || 26;
  }

  function lompat(y) {
    var maks = document.documentElement.scrollHeight - window.innerHeight;
    y = Math.max(0, Math.min(y, maks));
    window.scrollTo({ top: y, left: 0, behavior: "instant" });
  }

  function atasDok(el) { return el.getBoundingClientRect().top + window.pageYOffset; }

  /* ---------- deteksi blok Arab ---------- */
  function adalahArab(el) {
    if (el.classList.contains("arab") || el.classList.contains("doa")) return true;
    var teks = el.textContent.replace(/\[[^\]]*\]/g, "");
    var ar = (teks.match(/[\u0600-\u06FF]/g) || []).length;
    var lat = (teks.match(/[A-Za-z]/g) || []).length;
    return ar >= 5 && ar / (ar + lat) > 0.6;
  }

  function kumpulkanBlokArab() {
    blokArab = [];
    var anak = naskah.children;
    for (var i = 0; i < anak.length; i++) {
      if (anak[i].tagName === "P" && adalahArab(anak[i])) blokArab.push(anak[i]);
    }
  }

  function kilau(el) {
    el.classList.remove("ks-kilau");
    void el.offsetWidth;
    el.classList.add("ks-kilau");
  }

  /* ---------- tiga mode ---------- */
  function geserArab(arah) {
    var y = window.pageYOffset;
    var i, target = null;
    if (arah > 0) {
      for (i = 0; i < blokArab.length; i++) {
        if (atasDok(blokArab[i]) - MARGIN_ATAS > y + 4) { target = blokArab[i]; break; }
      }
      if (!target) { lompat(document.documentElement.scrollHeight); return; }
    } else {
      for (i = blokArab.length - 1; i >= 0; i--) {
        if (atasDok(blokArab[i]) - MARGIN_ATAS < y - 4) { target = blokArab[i]; break; }
      }
      if (!target) { lompat(atasDok(naskah) - MARGIN_ATAS); return; }
    }
    lompat(atasDok(target) - MARGIN_ATAS);
    kilau(target);
  }

  function geserLayar(arah) {
    var tampak = window.innerHeight - tinggiBar();
    var langkah = Math.max(tampak - BARIS_KONTEKS * tinggiBaris(), tampak * 0.4);
    lompat(window.pageYOffset + arah * langkah);
  }

  function geserUjung(arah) {
    if (arah < 0) {
      lompat(atasDok(naskah) - MARGIN_ATAS);
    } else {
      var bawahNaskah = naskah.getBoundingClientRect().bottom + window.pageYOffset;
      lompat(bawahNaskah - (window.innerHeight - tinggiBar()) + MARGIN_ATAS);
    }
  }

  function geser(arah) {
    if (mode === "arab") geserArab(arah);
    else if (mode === "ujung") geserUjung(arah);
    else geserLayar(arah);
  }

  /* ---------- UI ---------- */
  function setMode(id, simpan) {
    mode = id;
    var tombol = bar.querySelectorAll(".ks-mode");
    for (var i = 0; i < tombol.length; i++) {
      tombol[i].setAttribute("aria-pressed", tombol[i].getAttribute("data-mode") === id ? "true" : "false");
    }
    if (simpan) { try { localStorage.setItem(KEY_MODE, id); } catch (e) {} }
  }

  function bangun() {
    var style = document.createElement("style");
    style.textContent = CSS;
    document.head.appendChild(style);

    bar = document.createElement("div");
    bar.className = "ks-bar no-print";
    bar.setAttribute("role", "toolbar");
    bar.setAttribute("aria-label", "Mode scroll naskah");

    var html = '<div class="ks-inner"><div class="ks-modes">';
    MODE.forEach(function (m) {
      html += '<button type="button" class="ks-mode" data-mode="' + m.id + '" aria-pressed="false" aria-label="' + m.aria + '">' +
              m.label + "<small>" + m.sub + "</small></button>";
    });
    html += '</div>' +
      '<button type="button" class="ks-nav" id="ksAtas" aria-label="Ke atas">▲</button>' +
      '<button type="button" class="ks-nav" id="ksBawah" aria-label="Ke bawah">▼</button></div>';
    bar.innerHTML = html;
    document.body.appendChild(bar);
    document.body.classList.add("ks-aktif");
    document.documentElement.style.setProperty("--ks-bar-h", bar.offsetHeight + "px");

    bar.addEventListener("click", function (e) {
      var t = e.target.closest("button");
      if (!t) return;
      if (t.classList.contains("ks-mode")) setMode(t.getAttribute("data-mode"), true);
      else if (t.id === "ksAtas") geser(-1);
      else if (t.id === "ksBawah") geser(1);
    });

    window.addEventListener("resize", function () {
      document.documentElement.style.setProperty("--ks-bar-h", bar.offsetHeight + "px");
    });
  }

  function init() {
    naskah = document.getElementById("khutbahBody");
    if (!naskah) return;
    bangun();
    // tunggu penanda [..] dibungkus oleh skrip halaman, lalu petakan blok Arab
    kumpulkanBlokArab();
    var awal = "layar";
    try { awal = localStorage.getItem(KEY_MODE) || "layar"; } catch (e) {}
    if (!MODE.some(function (m) { return m.id === awal; })) awal = "layar";
    setMode(awal, false);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
