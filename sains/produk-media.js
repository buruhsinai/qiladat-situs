/* =========================================================
   JAZMI — SAINS / PRODUK + MEDIA (C13)
   produk-media.js
   Dipakai bersama oleh produk.html dan media.html. Pola nav
   mobile & reveal-on-scroll disalin PERSIS dari astronomi.js
   (C12) / sains.js (C11), sesuai kontrak 4.2 / 3.3. Fungsi
   pemuat grid produk & media memeriksa dulu apakah elemen
   target ada di halaman (produk-grid hanya di produk.html,
   media-grid hanya di media.html) sehingga satu file ini aman
   dipakai di kedua halaman tanpa error. Kegagalan memuat satu
   dataset tidak boleh merusak bagian statis halaman lain.
   ========================================================= */
(function () {
  "use strict";

  const PRODUK_DATA_URL = "data/produk-demo.json";
  const MEDIA_DATA_URL = "data/media-demo.json";

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
     1. NAVIGASI MOBILE (disalin persis dari astronomi.js C12 /
        sains.js C11)
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
     2. REVEAL ON SCROLL (disalin persis dari astronomi.js C12 /
        sains.js C11)
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
     3. STATE HELPER (loading/error/empty, dipakai grid produk
        maupun media — disalin pola dari astronomi.js C12)
     --------------------------------------------------------- */

  function showState(prefix, id) {
    ["Loading", "Error", "Empty"].forEach((s) => {
      const el = document.getElementById(prefix + "State" + s);
      if (el) el.hidden = "State" + s !== id;
    });
  }

  /* ---------------------------------------------------------
     4. PRODUK SAINS — produk-grid (hanya berjalan bila elemen
        ada, yaitu di produk.html)
     --------------------------------------------------------- */

  function renderProdukGrid(produk) {
    const grid = document.getElementById("produkGrid");
    if (!grid) return;

    if (!Array.isArray(produk) || produk.length === 0) {
      showState("produk", "StateEmpty");
      return;
    }

    grid.innerHTML = "";
    produk.forEach((p) => {
      const card = document.createElement("article");
      card.className = "produk-card";
      card.innerHTML =
        '<span class="produk-card-kategori">' + escapeHTML(p.kategori) + "</span>" +
        '<h3 class="produk-card-title">' + escapeHTML(p.nama) + "</h3>" +
        '<p class="produk-card-desc">' + escapeHTML(p.ringkasan) + "</p>" +
        (p.catatan
          ? '<p class="produk-card-catatan">' + escapeHTML(p.catatan) + "</p>"
          : "");
      grid.appendChild(card);
    });

    grid.hidden = false;
    ["produkStateLoading", "produkStateError", "produkStateEmpty"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.hidden = true;
    });
  }

  function muatProdukSains() {
    const grid = document.getElementById("produkGrid");
    if (!grid) return; // Bukan produk.html — tidak perlu memuat apa pun.

    fetch(PRODUK_DATA_URL)
      .then((res) => {
        if (!res.ok) throw new Error("Gagal memuat data produk: " + res.status);
        return res.json();
      })
      .then((data) => {
        renderProdukGrid(data && data.produk);
      })
      .catch(() => {
        showState("produk", "StateError");
      });
  }

  /* ---------------------------------------------------------
     5. MEDIA SAINS — media-grid (hanya berjalan bila elemen
        ada, yaitu di media.html)
     --------------------------------------------------------- */

  function renderMediaGrid(media) {
    const grid = document.getElementById("mediaGrid");
    if (!grid) return;

    if (!Array.isArray(media) || media.length === 0) {
      showState("media", "StateEmpty");
      return;
    }

    grid.innerHTML = "";
    media.forEach((m) => {
      const card = document.createElement("article");
      card.className = "media-card";
      card.innerHTML =
        '<span class="media-card-tipe">' + escapeHTML(m.tipe) + "</span>" +
        '<h3 class="media-card-title">' + escapeHTML(m.judul) + "</h3>" +
        '<p class="media-card-desc">' + escapeHTML(m.ringkasan) + "</p>" +
        '<p class="media-card-status">Segera Hadir</p>';
      grid.appendChild(card);
    });

    grid.hidden = false;
    ["mediaStateLoading", "mediaStateError", "mediaStateEmpty"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.hidden = true;
    });
  }

  function muatMediaSains() {
    const grid = document.getElementById("mediaGrid");
    if (!grid) return; // Bukan media.html — tidak perlu memuat apa pun.

    fetch(MEDIA_DATA_URL)
      .then((res) => {
        if (!res.ok) throw new Error("Gagal memuat data media: " + res.status);
        return res.json();
      })
      .then((data) => {
        renderMediaGrid(data && data.media);
      })
      .catch(() => {
        showState("media", "StateError");
      });
  }

  /* ---------------------------------------------------------
     Jalankan semuanya
     --------------------------------------------------------- */

  function init() {
    initNavigasiMobile();
    initRevealOnScroll();
    muatProdukSains();
    muatMediaSains();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
