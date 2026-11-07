/* =========================================================
   JAZMI — SAINS / ASTRONOMI (C12)
   astronomi.js
   Pola nav mobile & reveal-on-scroll disalin PERSIS dari
   js/main.js / sains.js (C11) sesuai kontrak 4.2 / 3.3.
   Satu-satunya bagian dinamis halaman ini adalah grid
   "Langit Malam Ini", diambil dari data DEMO lokal C12
   (data/astronomi-fenomena-demo.json). Kegagalan memuat data
   tidak boleh merusak bagian lain halaman (Lintasan Langit &
   Langit dan Manusia tetap statis dan selalu tampil).
   ========================================================= */
(function () {
  "use strict";

  const DATA_URL = "data/astronomi-fenomena-demo.json";

  /* ---------------------------------------------------------
     0. UTIL
     --------------------------------------------------------- */

  function escapeHTML(str) {
    if (str === null || str === undefined) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  /* ---------------------------------------------------------
     1. NAVIGASI MOBILE (disalin persis dari sains.js C11)
     --------------------------------------------------------- */

  function initNavigasiMobile() {
    const toggle = document.getElementById("navToggle");
    const nav = document.getElementById("primaryNav");
    if (!toggle || !nav) return;

    function bukaMenu() {
      nav.classList.add("is-open");
      toggle.setAttribute("aria-expanded", "true");
    }
    function tutupMenu() {
      nav.classList.remove("is-open");
      toggle.setAttribute("aria-expanded", "false");
    }
    function toggleMenu() {
      const sedangTerbuka = toggle.getAttribute("aria-expanded") === "true";
      if (sedangTerbuka) tutupMenu(); else bukaMenu();
    }

    toggle.addEventListener("click", toggleMenu);

    nav.querySelectorAll("a").forEach((a) => {
      a.addEventListener("click", () => tutupMenu());
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") tutupMenu();
    });

    let lebarSebelumnya = window.innerWidth;
    window.addEventListener("resize", () => {
      const lebarSekarang = window.innerWidth;
      if (lebarSekarang >= 860 && lebarSebelumnya < 860) {
        tutupMenu();
      }
      lebarSebelumnya = lebarSekarang;
    });
  }

  /* ---------------------------------------------------------
     2. REVEAL ON SCROLL (disalin persis dari sains.js C11)
     --------------------------------------------------------- */

  function initRevealOnScroll() {
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const target = document.querySelectorAll(".domain-hero, .section");

    if (prefersReduced || !("IntersectionObserver" in window)) {
      return;
    }

    target.forEach((el) => el.classList.add("reveal"));

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });

    target.forEach((el) => observer.observe(el));
  }

  /* ---------------------------------------------------------
     3. LANGIT MALAM INI — grid fenomena (fetch + escapeHTML +
        empty state, kegagalan tidak merusak halaman lain)
     --------------------------------------------------------- */

  function showState(id) {
    ["stateLoading", "stateError", "stateEmpty"].forEach((s) => {
      const el = document.getElementById(s);
      if (el) el.hidden = s !== id;
    });
  }

  function renderPhenomenaGrid(fenomena) {
    const grid = document.getElementById("phenomenaGrid");
    if (!grid) return;

    if (!Array.isArray(fenomena) || fenomena.length === 0) {
      showState("stateEmpty");
      return;
    }

    grid.innerHTML = "";
    fenomena.forEach((f) => {
      const card = document.createElement("article");
      card.className = "phenomena-card";
      card.innerHTML =
        '<span class="phenomena-card-type">' + escapeHTML(f.tipe) + "</span>" +
        '<h3 class="phenomena-card-title">' + escapeHTML(f.nama) + "</h3>" +
        '<p class="phenomena-card-time">' + escapeHTML(f.waktuIlustratif) + "</p>" +
        '<p class="phenomena-card-desc">' + escapeHTML(f.ringkasan) + "</p>" +
        (f.caraMengamati
          ? '<p class="phenomena-card-how"><span class="phenomena-card-how-label">Cara mengamati: </span>' + escapeHTML(f.caraMengamati) + "</p>"
          : "");
      grid.appendChild(card);
    });

    grid.hidden = false;
    ["stateLoading", "stateError", "stateEmpty"].forEach((s) => {
      const el = document.getElementById(s);
      if (el) el.hidden = true;
    });
  }

  function muatFenomenaLangit() {
    fetch(DATA_URL)
      .then((res) => {
        if (!res.ok) throw new Error("Gagal memuat data fenomena langit: " + res.status);
        return res.json();
      })
      .then((data) => {
        renderPhenomenaGrid(data && data.fenomena);
      })
      .catch(() => {
        showState("stateError");
      });
  }

  /* ---------------------------------------------------------
     Jalankan semuanya
     --------------------------------------------------------- */

  function init() {
    initNavigasiMobile();
    initRevealOnScroll();
    muatFenomenaLangit();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
