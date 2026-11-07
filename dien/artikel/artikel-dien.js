/* =========================================================
   JAZMI — Artikel Dien (index fisik ranah)
   artikel-dien.js
   Vanilla JavaScript, berdiri sendiri (tidak memuat main.js
   atau artikel/js/artikel.js). Menampilkan SEMUA artikel
   berkategori "Agama" dari data/articles.json, dengan paginasi
   "Muat Lebih Banyak" seperti halaman Artikel utama.
   ========================================================= */

(function () {
  "use strict";

  const PAGE_SIZE = 8;
  const KATEGORI_RANAH = "Agama";

  let artikelRanah = [];
  let jumlahTampil = PAGE_SIZE;

  function escapeHTML(str) {
    if (str === null || str === undefined) return "";
    const div = document.createElement("div");
    div.textContent = String(str);
    return div.innerHTML;
  }

  function formatTanggalIndonesia(isoDate) {
    try {
      const bulan = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
      const d = new Date(isoDate + "T00:00:00");
      if (isNaN(d.getTime())) return isoDate;
      return `${d.getDate()} ${bulan[d.getMonth()]} ${d.getFullYear()}`;
    } catch (e) {
      return isoDate;
    }
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

  async function ambilData(path) {
    const res = await fetch(path, { cache: "no-store" });
    if (!res.ok) throw new Error(`Gagal memuat ${path} (status ${res.status})`);
    return res.json();
  }

  function tampilkanPesanKosong(container, pesan) {
    if (!container) return;
    container.innerHTML = `<p class="data-empty-note">${escapeHTML(pesan)}</p>`;
  }

  function renderStatus(total, ditampilkan) {
    const status = document.getElementById("filterStatus");
    if (!status) return;
    status.textContent = total ? `Menampilkan ${ditampilkan} dari ${total} artikel Dien` : "";
  }

  function renderDaftar() {
    const list = document.getElementById("dienArtikelIndexList");
    const loadMoreBtn = document.getElementById("loadMoreBtn");
    if (!list) return;

    if (!artikelRanah.length) {
      tampilkanPesanKosong(list, "Belum ada artikel Dien untuk ditampilkan.");
      renderStatus(0, 0);
      if (loadMoreBtn) loadMoreBtn.hidden = true;
      return;
    }

    const ditampilkan = artikelRanah.slice(0, jumlahTampil);

    list.innerHTML = ditampilkan.map((a) => `
      <li class="article-item">
        <span class="article-date">${escapeHTML(labelWaktuArtikel(a))}</span>
        <div class="article-body">
          <a class="article-title" href="../../artikel/${escapeHTML(a.tautan || "#")}">${escapeHTML(a.judul)}</a>
          ${a.ringkasan ? `<p class="article-ringkasan">${escapeHTML(a.ringkasan)}</p>` : ""}
        </div>
      </li>
    `).join("");

    renderStatus(artikelRanah.length, ditampilkan.length);

    if (loadMoreBtn) {
      loadMoreBtn.hidden = ditampilkan.length >= artikelRanah.length;
    }
  }

  async function muatArtikelDien() {
    const list = document.getElementById("dienArtikelIndexList");
    if (!list) return;
    try {
      const data = await ambilData("../../data/articles.json");
      artikelRanah = (data.artikel || [])
        .filter((a) => a.kategori === KATEGORI_RANAH)
        .sort((a, b) => kunciUrutanArtikel(b) - kunciUrutanArtikel(a));
      renderDaftar();
    } catch (err) {
      console.error("[JAZMI] Gagal memuat Artikel Dien:", err);
      tampilkanPesanKosong(list, "Artikel Dien belum dapat dimuat saat ini.");
    }
  }

  function initNavigasiMobile() {
    const toggle = document.getElementById("navToggle");
    const nav = document.getElementById("primaryNav");
    if (!toggle || !nav) return;

    function tutupMenu() {
      nav.classList.remove("is-open");
      toggle.setAttribute("aria-expanded", "false");
    }

    toggle.addEventListener("click", () => {
      const terbuka = nav.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", terbuka ? "true" : "false");
    });

    let lebarSebelumnya = window.innerWidth;
    window.addEventListener("resize", () => {
      const lebarSekarang = window.innerWidth;
      if (lebarSekarang >= 860 && lebarSebelumnya < 860) tutupMenu();
      lebarSebelumnya = lebarSekarang;
    });
  }

  function init() {
    initNavigasiMobile();
    muatArtikelDien();

    const loadMoreBtn = document.getElementById("loadMoreBtn");
    if (loadMoreBtn) {
      loadMoreBtn.addEventListener("click", () => {
        jumlahTampil += PAGE_SIZE;
        renderDaftar();
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
