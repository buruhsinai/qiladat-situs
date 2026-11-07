/* =========================================================
   JAZMI — Dien Core (C04)
   dien.js
   Vanilla JavaScript, mengikuti konvensi js/main.js.
   Berdiri sendiri (tidak memuat main.js) — halaman ini
   berada di folder terpisah dan hanya butuh dua hal:
   1) navigasi mobile, 2) preview kurasi (Artikel & Syair)
   dari data/articles.json dan data/syair.json milik HOME.
   ========================================================= */

(function () {
  "use strict";

  const JUMLAH_ARTIKEL_PREVIEW = 2;
  const ID_BAIT_PILIHAN = "bait-002";

  /* ---------------------------------------------------------
     util kecil (sama seperti main.js / artikel.js)
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
        "Jan", "Feb", "Mar", "Apr", "Mei", "Jun",
        "Jul", "Agu", "Sep", "Okt", "Nov", "Des"
      ];
      const d = new Date(isoDate + "T00:00:00");
      if (isNaN(d.getTime())) return isoDate;
      return `${d.getDate()} ${bulan[d.getMonth()]} ${d.getFullYear()}`;
    } catch (e) {
      return isoDate;
    }
  }

  // Kunci pengurutan artikel: utamakan tanggal asli bila ada, kalau belum
  // ada tanggal publikasi resmi pakai field "urutan" (angka manual, makin
  // besar = makin baru) sebagai cadangan. Label tanggal jatuh ke nama seri
  // bila tanggal belum ada (bukan tanggal palsu). Lihat catatan skema di
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

  async function ambilData(path) {
    const res = await fetch(path);
    if (!res.ok) throw new Error(`Gagal memuat ${path}: ${res.status}`);
    return res.json();
  }

  function tampilkanPesanKosong(container, pesan) {
    container.innerHTML = `<p class="dien-syair-note">${escapeHTML(pesan)}</p>`;
  }

  /* ---------------------------------------------------------
     1. BACAAN TERBARU (preview Artikel, kurasi ranah Agama)
     --------------------------------------------------------- */

  async function muatBacaanTerbaru() {
    const list = document.getElementById("dienArtikelPreview");
    if (!list) return;

    try {
      const data = await ambilData("../data/articles.json");
      let artikel = (data.artikel || []).slice();

      artikel.sort((a, b) => kunciUrutanArtikel(b) - kunciUrutanArtikel(a));

      // Kurasi: utamakan kategori "Agama" (relevan dengan Dien),
      // lengkapi dengan artikel terbaru lain bila belum cukup.
      const agama = artikel.filter((a) => a.kategori === "Agama");
      const lainnya = artikel.filter((a) => a.kategori !== "Agama");
      const pilihan = agama.concat(lainnya).slice(0, JUMLAH_ARTIKEL_PREVIEW);

      if (!pilihan.length) {
        tampilkanPesanKosong(list, "Belum ada artikel untuk ditampilkan.");
        return;
      }

      list.innerHTML = pilihan.map((a) => `
        <li class="article-item">
          <span class="article-date">${escapeHTML(labelWaktuArtikel(a))}</span>
          <div class="article-body">
            <a class="article-title" href="../artikel/${escapeHTML(a.tautan || "#")}">${escapeHTML(a.judul)}</a>
            ${a.kategori ? `<span class="article-category">${escapeHTML(a.kategori)}</span>` : ""}
          </div>
        </li>
      `).join("");
    } catch (err) {
      console.error("[JAZMI] Gagal memuat Bacaan Terbaru (Dien):", err);
      tampilkanPesanKosong(list, "Bacaan terbaru belum dapat dimuat saat ini.");
    }
  }

  /* ---------------------------------------------------------
     2. SYAIR PILIHAN (satu bait kurasi dari data/syair.json)
     --------------------------------------------------------- */

  async function muatSyairPilihan() {
    const wrap = document.getElementById("dienSyairPreview");
    if (!wrap) return;

    try {
      const data = await ambilData("../data/syair.json");
      const bait = (data.bait || []);
      const pilihan = bait.find((b) => b.id === ID_BAIT_PILIHAN) || bait[0];

      if (!pilihan) {
        tampilkanPesanKosong(wrap, "Belum ada syair untuk ditampilkan.");
        return;
      }

      wrap.innerHTML = `
        <blockquote class="syair-arab" dir="rtl" lang="ar">${escapeHTML(pilihan.arab)}</blockquote>
        <p class="syair-terjemahan">${escapeHTML(pilihan.terjemahan)}</p>
        <p class="syair-meta">${escapeHTML(pilihan.penyair || "")}${pilihan.sumber ? " · " + escapeHTML(pilihan.sumber) : ""}</p>
      `;
    } catch (err) {
      console.error("[JAZMI] Gagal memuat Syair Pilihan (Dien):", err);
      tampilkanPesanKosong(wrap, "Syair pilihan belum dapat dimuat saat ini.");
    }
  }

  /* ---------------------------------------------------------
     navigasi mobile (disalin dari artikel.js — halaman ini
     berdiri sendiri dan tidak memuat main.js)
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

  function init() {
    initNavigasiMobile();
    muatBacaanTerbaru();
    muatSyairPilihan();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
