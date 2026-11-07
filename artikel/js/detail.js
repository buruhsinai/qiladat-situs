/* =========================================================
   JAZMI — Halaman Artikel Detail
   detail.js
   Vanilla JavaScript, mengikuti konvensi js/main.js dan
   artikel/js/artikel.js. Berdiri sendiri (tidak memuat
   main.js atau artikel.js).

   Identitas URL artikel: query string ?slug=... pada
   /artikel/detail.html — lihat catatan "KEPUTUSAN URL" di
   laporan akhir C03 untuk alasan pemilihan pola ini.
   ========================================================= */

(function () {
  "use strict";

  /* ---------------------------------------------------------
     util kecil (disalin dari main.js / artikel.js agar halaman
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

  // Kunci pengurutan artikel: utamakan tanggal asli bila ada, kalau belum
  // ada tanggal publikasi resmi pakai field "urutan" (angka manual, makin
  // besar = makin baru) sebagai cadangan. Lihat catatan skema di
  // data/articles.json._catatan / artikel/js/artikel.js.
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

  /* ---------------------------------------------------------
     identitas artikel dari URL
     --------------------------------------------------------- */

  function ambilSlugDariURL() {
    const params = new URLSearchParams(window.location.search);
    return params.get("slug") || "";
  }

  // Kompatibilitas: cocokkan berdasarkan slug bila ada,
  // fallback ke id kalau data lama belum memiliki slug.
  function cariArtikel(daftarArtikel, pengenal) {
    if (!pengenal) return null;
    return (
      daftarArtikel.find((a) => a.slug === pengenal) ||
      daftarArtikel.find((a) => a.id === pengenal) ||
      null
    );
  }

  /* ---------------------------------------------------------
     tampilkan salah satu keadaan (loading/not-found/error/artikel)
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

  function renderArtikel(artikel) {
    document.title = `${artikel.judul} — Artikel JAZMI`;
    const metaDesc = document.getElementById("pageDescription");
    if (metaDesc && artikel.ringkasan) {
      metaDesc.setAttribute("content", artikel.ringkasan);
    }

    const kategoriEl = document.getElementById("articleCategory");
    if (kategoriEl) {
      kategoriEl.textContent = artikel.kategori || "Artikel";
    }

    const judulEl = document.getElementById("articleTitle");
    if (judulEl) judulEl.textContent = artikel.judul;

    const tanggalEl = document.getElementById("articleDate");
    if (tanggalEl) {
      tanggalEl.textContent = labelWaktuArtikel(artikel);
    }

    const bodyEl = document.getElementById("articleBody");
    if (bodyEl) {
      const paragraf = Array.isArray(artikel.isi) && artikel.isi.length
        ? artikel.isi
        : (artikel.ringkasan ? [artikel.ringkasan] : []);

      if (paragraf.length) {
        bodyEl.innerHTML = paragraf
          .map((p) => `<p>${escapeHTML(p)}</p>`)
          .join("");
      } else {
        bodyEl.innerHTML = `<p class="data-empty-note">Isi artikel belum tersedia.</p>`;
      }
    }
  }

  // Tag relasi otomatis (menggantikan filter kategori polos lama) —
  // dihitung LIVE dari data/articles.json lewat js/relasi-artikel.js
  // (JazmiRelasi), lihat HANDOFF-TAG-LABEL-ARTIKEL.md §1.1.
  function renderTagRelasi(artikelSaatIni, semuaArtikel) {
    const section = document.getElementById("relatedSection");
    const list = document.getElementById("relatedList");
    if (!section || !list) return;

    const relasi = (window.JazmiRelasi && typeof window.JazmiRelasi.hitungTagRelasiArtikel === "function")
      ? window.JazmiRelasi.hitungTagRelasiArtikel(artikelSaatIni, semuaArtikel)
      : [];

    if (!relasi.length) {
      section.hidden = true;
      return;
    }

    const labelTipe = (window.JazmiRelasi && window.JazmiRelasi.LABEL_TIPE_TAG) || {};

    list.innerHTML = relasi.map(({ tipe, artikel: a }) => `
      <li class="article-item tag-relasi-item">
        <span class="tag-type-badge" data-tipe="${escapeHTML(tipe)}">${escapeHTML(labelTipe[tipe] || tipe)}</span>
        <div class="article-body">
          <a class="article-title" href="${escapeHTML(a.tautan || ("detail.html?slug=" + encodeURIComponent(a.slug || a.id)))}">${escapeHTML(a.judul)}</a>
          ${a.kategori ? `<span class="article-category">${escapeHTML(a.kategori)}</span>` : ""}
        </div>
      </li>
    `).join("");

    section.hidden = false;
  }

  // Label taksonomi topik untuk artikel ini — dicocokkan LIVE lewat
  // js/label-utils.js (JazmiLabel), lihat HANDOFF §1.2. Ditandai
  // sebagai draf selama data/labels.json._catatan masih berisi
  // penanda draf (diteruskan lewat parameter catatanDraf).
  function renderLabelArtikel(artikelSaatIni, daftarLabel) {
    const section = document.getElementById("labelSection");
    const list = document.getElementById("labelChipList");
    if (!section || !list) return;

    const cocok = (window.JazmiLabel && typeof window.JazmiLabel.cariLabelUntukArtikel === "function")
      ? window.JazmiLabel.cariLabelUntukArtikel(artikelSaatIni, daftarLabel)
      : [];

    if (!cocok.length) {
      section.hidden = true;
      return;
    }

    list.innerHTML = cocok.map((lbl) => `
      <li>
        <a class="label-chip" href="../arsip/label/index.html?slug=${encodeURIComponent(lbl.slug)}">${escapeHTML(lbl.nama)}</a>
      </li>
    `).join("");

    section.hidden = false;
  }

  /* ---------------------------------------------------------
     navigasi mobile (disalin dari main.js / artikel.js)
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

  async function muatArtikelDetail() {
    tampilkanKeadaan("loading");

    let data;
    let dataLabel = { label: [] };
    try {
      data = await ambilData("../data/articles.json");
    } catch (err) {
      console.error("[JAZMI] Gagal memuat data Artikel Detail:", err);
      tampilkanKeadaan("error");
      return;
    }
    try {
      dataLabel = await ambilData("../data/labels.json");
    } catch (err) {
      // labels.json gagal dimuat tidak boleh menggagalkan halaman artikel
      // itu sendiri — cukup tidak menampilkan section Label.
      console.error("[JAZMI] Gagal memuat data/labels.json:", err);
    }

    const semuaArtikel = data.artikel || [];
    const daftarLabel = Array.isArray(dataLabel.label) ? dataLabel.label : [];
    const pengenal = ambilSlugDariURL();
    const artikel = cariArtikel(semuaArtikel, pengenal);

    if (!artikel) {
      tampilkanKeadaan("notFound");
      return;
    }

    renderArtikel(artikel);
    renderTagRelasi(artikel, semuaArtikel);
    renderLabelArtikel(artikel, daftarLabel);
    tampilkanKeadaan("artikel");
  }

  function init() {
    initNavigasiMobile();
    muatArtikelDetail();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
