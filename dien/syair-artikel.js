/* =========================================================
   JAZMI — Dien: Artikel Syair (detail)
   syair-artikel.js
   Vanilla JavaScript, berdiri sendiri (tidak memuat main.js/
   dien.js/syair.js) — mengikuti konvensi artikel/js/detail.js.

   Identitas URL: query string ?tanggal=YYYY-MM-DD pada
   /dien/syair-artikel.html. Sumber data: SATU-SATUNYA yaitu
   dien/data/penjelasan-syair.json — bukan data/articles.json.

   Hanya entri bertanggal SUDAH BERLALU (bukan hari ini, bukan
   masa depan) yang dianggap "artikel" sah di halaman ini —
   entri hari ini adalah domain dien/syair.html#penjelasan-hari-ini,
   bukan halaman ini, supaya tidak ada dua URL untuk satu
   penjelasan yang sama saat masih "hari ini".
   ========================================================= */

(function () {
  "use strict";

  const PENJELASAN_PATH = "data/penjelasan-syair.json";

  /* ---------------------------------------------------------
     util kecil (disalin dari dien/syair.js agar halaman ini
     tetap berdiri sendiri)
     --------------------------------------------------------- */

  function escapeHTML(str) {
    if (str === null || str === undefined) return "";
    const div = document.createElement("div");
    div.textContent = String(str);
    return div.innerHTML;
  }

  function formatTanggalIndonesia(isoDate) {
    try {
      const bulan = [
        "Januari", "Februari", "Maret", "April", "Mei", "Juni",
        "Juli", "Agustus", "September", "Oktober", "November", "Desember"
      ];
      const d = new Date(isoDate + "T00:00:00");
      if (isNaN(d.getTime())) return isoDate;
      return `${d.getDate()} ${bulan[d.getMonth()]} ${d.getFullYear()}`;
    } catch (e) {
      return isoDate;
    }
  }

  function tanggalHariIniISO() {
    const s = new Date();
    const bulan = String(s.getMonth() + 1).padStart(2, "0");
    const tgl = String(s.getDate()).padStart(2, "0");
    return `${s.getFullYear()}-${bulan}-${tgl}`;
  }

  async function ambilData(path) {
    const res = await fetch(path, { cache: "no-store" });
    if (!res.ok) {
      throw new Error(`Gagal memuat ${path} (status ${res.status})`);
    }
    return res.json();
  }

  /* ---------------------------------------------------------
     identitas artikel dari URL
     --------------------------------------------------------- */

  function ambilTanggalDariURL() {
    const params = new URLSearchParams(window.location.search);
    return params.get("tanggal") || "";
  }

  /* ---------------------------------------------------------
     keadaan halaman (loading/not-found/error/artikel)
     --------------------------------------------------------- */

  function tampilkanKeadaan(nama) {
    const semua = {
      loading: document.getElementById("stateLoading"),
      notFound: document.getElementById("stateNotFound"),
      error: document.getElementById("stateError"),
      artikel: document.getElementById("stateArticle"),
    };
    Object.keys(semua).forEach((key) => {
      const el = semua[key];
      if (!el) return;
      el.hidden = key !== nama;
    });
  }

  /* ---------------------------------------------------------
     render artikel
     --------------------------------------------------------- */

  function renderArtikel(entri) {
    const judul = entri.judul || "Penjelasan Bait";
    document.title = `${judul} — Artikel Syair JAZMI`;
    const metaDesc = document.getElementById("pageDescription");
    if (metaDesc && entri.ringkasan) {
      metaDesc.setAttribute("content", entri.ringkasan);
    }

    const judulEl = document.getElementById("articleTitle");
    if (judulEl) judulEl.textContent = judul;

    const tanggalEl = document.getElementById("articleDate");
    if (tanggalEl) tanggalEl.textContent = formatTanggalIndonesia(entri.tanggal);

    const bodyEl = document.getElementById("articleBody");
    if (bodyEl) {
      const paragraf = Array.isArray(entri.isi) && entri.isi.length
        ? entri.isi
        : (entri.ringkasan ? [entri.ringkasan] : []);

      if (paragraf.length) {
        bodyEl.innerHTML = paragraf
          .map((p) => `<p>${escapeHTML(p)}</p>`)
          .join("");
      } else {
        bodyEl.innerHTML = `<p class="data-empty-note">Isi artikel belum tersedia.</p>`;
      }
    }
  }

  /* ---------------------------------------------------------
     navigasi mobile (disalin dari dien/syair.js)
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
      if (lebarSekarang >= 860 && lebarSebelumnya < 860) tutupMenu();
      lebarSebelumnya = lebarSekarang;
    });
  }

  /* ---------------------------------------------------------
     init
     --------------------------------------------------------- */

  async function muatArtikelSyair() {
    tampilkanKeadaan("loading");

    let data;
    try {
      data = await ambilData(PENJELASAN_PATH);
    } catch (err) {
      console.error("[JAZMI] Gagal memuat Artikel Syair:", err);
      tampilkanKeadaan("error");
      return;
    }

    const daftar = Array.isArray(data.penjelasan) ? data.penjelasan : [];
    const tanggalDiminta = ambilTanggalDariURL();
    const hariIni = tanggalHariIniISO();

    // Gate: hanya tanggal yang SUDAH BERLALU yang boleh tampil
    // sebagai Artikel Syair di sini — tanggal hari ini adalah
    // domain dien/syair.html#penjelasan-hari-ini, tanggal masa
    // depan tidak seharusnya ada datanya sama sekali.
    const entri = daftar.find((p) => p && p.tanggal === tanggalDiminta) || null;

    if (!entri || !tanggalDiminta || tanggalDiminta >= hariIni) {
      tampilkanKeadaan("notFound");
      return;
    }

    renderArtikel(entri);
    tampilkanKeadaan("artikel");
  }

  function init() {
    initNavigasiMobile();
    muatArtikelSyair();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
