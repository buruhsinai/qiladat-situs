/* =========================================================
   JAZMI — ARSIP / LABEL
   label.js
   Vanilla JavaScript, berdiri sendiri (tidak memuat main.js
   atau arsip.js), mengikuti konvensi artikel/js/detail.js.

   Menampilkan seluruh label dari data/labels.json beserta
   artikel yang cocok — dicocokkan LIVE dari data/articles.json
   memakai js/label-utils.js (JazmiLabel), bukan penandaan
   manual. Mendukung ?slug=... untuk membuka satu label
   langsung. Lihat HANDOFF-TAG-LABEL-ARTIKEL.md §1.3.
   ========================================================= */

(function () {
  "use strict";

  /* ---------------------------------------------------------
     util kecil (disalin dari artikel/js/detail.js agar halaman
     ini tetap berdiri sendiri)
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

  async function ambilData(path) {
    const res = await fetch(path, { cache: "no-store" });
    if (!res.ok) {
      throw new Error(`Gagal memuat ${path} (status ${res.status})`);
    }
    return res.json();
  }

  const URUTAN_OFFSET = new Date("2099-01-01T00:00:00").getTime();
  function kunciUrutanArtikel(a) {
    if (a && a.tanggal) {
      const t = new Date(a.tanggal + "T00:00:00").getTime();
      if (!isNaN(t)) return t;
    }
    if (a && typeof a.urutan === "number") return URUTAN_OFFSET + a.urutan;
    return 0;
  }

  function labelWaktuArtikel(a) {
    if (a && a.tanggal) return formatTanggalIndonesia(a.tanggal);
    if (a && a.seri) return a.seri;
    return "";
  }

  function ambilSlugDariURL() {
    const params = new URLSearchParams(window.location.search);
    return params.get("slug") || "";
  }

  /* ---------------------------------------------------------
     render — daftar semua label (kartu, dengan jumlah artikel)
     --------------------------------------------------------- */

  function renderGridLabel(daftarLabel, semuaArtikel) {
    const grid = document.getElementById("labelGrid");
    if (!grid) return;

    if (!daftarLabel.length) {
      document.getElementById("stateEmpty").hidden = false;
      grid.hidden = true;
      return;
    }

    const util = window.JazmiLabel;
    grid.innerHTML = daftarLabel.map((lbl) => {
      const cocok = util && typeof util.cariArtikelUntukLabel === "function"
        ? util.cariArtikelUntukLabel(lbl, semuaArtikel)
        : [];
      return `
        <a class="label-card" href="?slug=${encodeURIComponent(lbl.slug)}">
          <h3 class="label-card-title">${escapeHTML(lbl.nama)}</h3>
          <p class="label-card-count">${cocok.length} artikel</p>
        </a>
      `;
    }).join("");

    grid.hidden = false;
  }

  /* ---------------------------------------------------------
     render — satu label (artikel-artikel yang cocok)
     --------------------------------------------------------- */

  function renderDetailLabel(slug, daftarLabel, semuaArtikel) {
    const heading = document.getElementById("label-detail-heading");
    const countEl = document.getElementById("labelDetailCount");
    const list = document.getElementById("labelArticleList");
    const emptyEl = document.getElementById("labelDetailEmpty");
    const notFoundEl = document.getElementById("labelDetailNotFound");

    const util = window.JazmiLabel;
    const label = util && typeof util.cariLabelBerdasarkanSlug === "function"
      ? util.cariLabelBerdasarkanSlug(daftarLabel, slug)
      : null;

    if (!label) {
      heading.textContent = "Label Tidak Ditemukan";
      countEl.textContent = "";
      list.innerHTML = "";
      notFoundEl.hidden = false;
      emptyEl.hidden = true;
      return;
    }

    document.title = `${label.nama} — Label Arsip JAZMI`;
    heading.textContent = label.nama;

    const cocok = util && typeof util.cariArtikelUntukLabel === "function"
      ? util.cariArtikelUntukLabel(label, semuaArtikel).sort(
          (a, b) => kunciUrutanArtikel(b) - kunciUrutanArtikel(a)
        )
      : [];

    notFoundEl.hidden = true;
    countEl.textContent = cocok.length
      ? `${cocok.length} artikel cocok dengan label ini.`
      : "";

    if (!cocok.length) {
      list.innerHTML = "";
      emptyEl.hidden = false;
      return;
    }

    emptyEl.hidden = true;
    list.innerHTML = cocok.map((a) => `
      <li class="article-item">
        <span class="article-date">${escapeHTML(labelWaktuArtikel(a))}</span>
        <div class="article-body">
          <a class="article-title" href="${escapeHTML(a.tautan || ("/artikel/detail.html?slug=" + encodeURIComponent(a.slug || a.id)))}">${escapeHTML(a.judul)}</a>
          ${a.kategori ? `<span class="article-category">${escapeHTML(a.kategori)}</span>` : ""}
        </div>
      </li>
    `).join("");
  }

  /* ---------------------------------------------------------
     navigasi mobile (disalin dari main.js / detail.js)
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

  async function muatHalamanLabel() {
    const stateLoading = document.getElementById("stateLoading");
    const stateError = document.getElementById("stateError");
    const gridSection = document.getElementById("labelGridSection");
    const detailSection = document.getElementById("labelDetailSection");

    let dataArtikel;
    let dataLabel;
    try {
      [dataArtikel, dataLabel] = await Promise.all([
        ambilData("../../data/articles.json"),
        ambilData("../../data/labels.json"),
      ]);
    } catch (err) {
      console.error("[JAZMI] Gagal memuat data Arsip Label:", err);
      stateLoading.hidden = true;
      stateError.hidden = false;
      return;
    }

    stateLoading.hidden = true;

    const semuaArtikel = dataArtikel.artikel || [];
    const daftarLabel = Array.isArray(dataLabel.label) ? dataLabel.label : [];

    if (dataLabel._catatan) {
      const badge = document.getElementById("draftBadge");
      badge.textContent = dataLabel._catatan;
      badge.hidden = false;
    }

    const slug = ambilSlugDariURL();

    if (slug) {
      gridSection.hidden = true;
      detailSection.hidden = false;
      renderDetailLabel(slug, daftarLabel, semuaArtikel);
    } else {
      detailSection.hidden = true;
      gridSection.hidden = false;
      renderGridLabel(daftarLabel, semuaArtikel);
    }
  }

  function init() {
    initNavigasiMobile();
    muatHalamanLabel();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
