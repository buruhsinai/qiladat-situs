/* =========================================================
   JAZMI — SAINS (C11)
   sains.js
   Pola nav mobile & reveal-on-scroll disalin PERSIS dari
   js/main.js (fungsi initNavigasiMobile, initRevealOnScroll)
   sesuai kontrak 4.2 / 3.3, diaudit dari C08/kesehatan.js.
   Halaman C11 statis — tidak ada fetch() data karena "Konten
   Pilihan" memakai data demo statis di HTML (lihat mandat:
   jangan buat relasi/data fiktif, dan halaman boleh sederhana
   tanpa JS bila memungkinkan — bagian 10 instruksi C11).
   ========================================================= */
(function () {
  "use strict";

  /* ---------------------------------------------------------
     1. NAVIGASI MOBILE
     --------------------------------------------------------- */

  const JUMLAH_ARTIKEL_PREVIEW = 3;

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

  /* ---------------------------------------------------------
     0. ARTIKEL TERBARU RANAH SAINS (kurasi kategori "Astronomi")
     --------------------------------------------------------- */

  async function muatArtikelSains() {
    const list = document.getElementById("sainsArtikelPreview");
    if (!list) return;

    try {
      const res = await fetch("../data/articles.json");
      if (!res.ok) throw new Error("Gagal memuat articles.json: " + res.status);
      const data = await res.json();
      let artikel = (data.artikel || []).slice();
      artikel.sort((a, b) => kunciUrutanArtikel(b) - kunciUrutanArtikel(a));

      const sains = artikel.filter((a) => a.kategori === "Astronomi" || a.kategori === "Sains");
      const lainnya = artikel.filter((a) => a.kategori !== "Astronomi" && a.kategori !== "Sains");
      const pilihan = sains.concat(lainnya).slice(0, JUMLAH_ARTIKEL_PREVIEW);

      if (!pilihan.length) {
        list.innerHTML = `<p class="access-note">Belum ada artikel untuk ditampilkan.</p>`;
        return;
      }

      list.innerHTML = pilihan.map((a) => `
        <li class="article-item">
          <span class="article-date">${escapeHTML(labelWaktuArtikel(a))}</span>
          <div class="article-body">
            <a class="article-title" href="/artikel/${escapeHTML(a.tautan || "#")}">${escapeHTML(a.judul)}</a>
            ${a.kategori ? `<span class="article-category">${escapeHTML(a.kategori)}</span>` : ""}
          </div>
        </li>
      `).join("");
    } catch (err) {
      console.error("[JAZMI] Gagal memuat Artikel Sains:", err);
      list.innerHTML = `<p class="access-note">Artikel terbaru belum dapat dimuat saat ini.</p>`;
    }
  }

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

    // Tutup menu setelah salah satu tautan dipilih (mobile).
    nav.querySelectorAll("a").forEach((a) => {
      a.addEventListener("click", () => tutupMenu());
    });

    // Tutup dengan tombol Escape.
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") tutupMenu();
    });

    // Jika layar diperbesar melewati breakpoint desktop, pastikan
    // status menu mobile direset agar tidak tersangkut kondisi terbuka.
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
     2. REVEAL ON SCROLL (halus, menghormati prefers-reduced-motion)
     --------------------------------------------------------- */

  function initRevealOnScroll() {
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const target = document.querySelectorAll(".domain-hero, .section");

    if (prefersReduced || !("IntersectionObserver" in window)) {
      // Tidak perlu animasi — biarkan tampil apa adanya.
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
     Jalankan semuanya
     --------------------------------------------------------- */

  function init() {
    initNavigasiMobile();
    initRevealOnScroll();
    muatArtikelSains();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
