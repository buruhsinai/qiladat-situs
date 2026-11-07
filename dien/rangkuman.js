/* =========================================================
   JAZMI — Dien: Rangkuman (C05)
   rangkuman.js
   Vanilla JavaScript, berdiri sendiri (tidak memuat main.js/
   dien.js) — mengikuti konvensi js/main.js, dien/dien.js, dan
   dien/pondok.js. Menangani: 1) navigasi mobile, 2) reveal-on-
   scroll, 3) muat & filter Bahan Belajar (data/bahan.json),
   4) muat Khutbah Jumat (data/khutbah.json), 5) muat Kajian &
   Taklim (data/kajian.json), 6) penanda data demo (tidak
   menyajikan data contoh sebagai konten resmi JAZMI), 7) BARU —
   deep-link filter lewat query string ?tipe= (dipakai tautan
   "Lihat Modul →" di dien/kajian/index.html), pola sama dengan
   ?kategori= di artikel/js/artikel.js.
   ========================================================= */

(function () {
  "use strict";

  /* ---------------------------------------------------------
     0. util kecil (sama pola dengan js/main.js & dien/dien.js)
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

  async function ambilData(path) {
    const res = await fetch(path, { cache: "no-store" });
    if (!res.ok) {
      throw new Error(`Gagal memuat ${path} (status ${res.status})`);
    }
    return res.json();
  }

  function tampilkanPesanKosong(container, pesan) {
    if (!container) return;
    container.innerHTML = `<p class="rangkuman-demo-note">${escapeHTML(pesan)}</p>`;
  }

  // Data JSON domain ini menandai dirinya sendiri lewat field
  // "_catatan" kalau isinya masih data contoh/demo (bukan resmi
  // JAZMI). Kalau field itu ada, tampilkan penanda yang jujur ke
  // pengunjung — jangan diam-diam menyajikannya sebagai resmi.
  function tampilkanCatatanDemo(elId, data) {
    const el = document.getElementById(elId);
    if (!el) return;
    if (data && typeof data._catatan === "string") {
      el.textContent = "Catatan: bahan di atas masih berupa data contoh/demo, belum konten resmi JAZMI.";
    } else {
      el.textContent = "";
    }
  }

  function buatTautanWhatsApp(pesan) {
    // Halaman hanya MEMBUKA WhatsApp dengan pesan yang sudah
    // disiapkan — tidak ada pesan yang dikirim otomatis.
    const teks = `${pesan}\n${window.location.href}`;
    return `https://wa.me/?text=${encodeURIComponent(teks)}`;
  }

  /* ---------------------------------------------------------
     1. BAHAN BELAJAR (data/bahan.json) + filter tipe
     --------------------------------------------------------- */

  function labelTipeBahan(tipe) {
    const label = { rangkuman: "Rangkuman", modul: "Modul", pdf: "PDF" };
    return label[tipe] || tipe;
  }

  function initFilterBahan() {
    const filterWrap = document.getElementById("bahanFilter");
    const list = document.getElementById("bahanList");
    if (!filterWrap || !list) return;

    filterWrap.addEventListener("click", (e) => {
      const btn = e.target.closest(".rangkuman-filter-btn");
      if (!btn) return;

      filterWrap.querySelectorAll(".rangkuman-filter-btn").forEach((b) => {
        b.classList.remove("is-active");
      });
      btn.classList.add("is-active");

      const tipe = btn.dataset.tipe || "semua";
      list.querySelectorAll(".material-item").forEach((item) => {
        const cocok = tipe === "semua" || item.dataset.tipe === tipe;
        item.hidden = !cocok;
      });
    });
  }

  // Deep-link tipe dari luar halaman lewat query string ?tipe=,
  // pola sama dengan paramKategori di artikel/js/artikel.js. Tautan
  // "Lihat Modul →" di dien/kajian/index.html kini menuju
  // /arsip/modul/ (bukan lagi ke sini), tapi fungsi ini tetap
  // berguna untuk deep-link internal lain yang mungkin memakainya.
  function terapkanFilterTipeDariURL() {
    const filterWrap = document.getElementById("bahanFilter");
    const list = document.getElementById("bahanList");
    if (!filterWrap || !list) return;

    const paramTipe = new URLSearchParams(window.location.search).get("tipe");
    if (!paramTipe) return;

    const btn = filterWrap.querySelector(`.rangkuman-filter-btn[data-tipe="${paramTipe}"]`);
    if (!btn) return;

    filterWrap.querySelectorAll(".rangkuman-filter-btn").forEach((b) => {
      b.classList.remove("is-active");
    });
    btn.classList.add("is-active");

    list.querySelectorAll(".material-item").forEach((item) => {
      item.hidden = item.dataset.tipe !== paramTipe;
    });
  }

  async function muatBahanBelajar() {
    const list = document.getElementById("bahanList");
    if (!list) return;

    try {
      const data = await ambilData("../data/bahan.json");
      const bahan = data.bahan || [];

      if (!bahan.length) {
        tampilkanPesanKosong(list, "Belum ada bahan belajar untuk ditampilkan.");
        return;
      }

      list.innerHTML = bahan.map((b) => `
        <div class="material-item" data-tipe="${escapeHTML(b.tipe || "")}">
          <span class="material-tag">${escapeHTML(labelTipeBahan(b.tipe))}</span>
          <span class="material-title">${escapeHTML(b.judul)}</span>
          <a class="material-link" href="${escapeHTML(b.tautan || "#")}">Buka</a>
        </div>
      `).join("");

      tampilkanCatatanDemo("bahanDemoNote", data);
    } catch (err) {
      console.error("[JAZMI] Gagal memuat Bahan Belajar (Rangkuman):", err);
      tampilkanPesanKosong(list, "Bahan belajar belum dapat dimuat saat ini.");
    }
  }

  /* ---------------------------------------------------------
     2. KHUTBAH JUMAT (data/khutbah.json) — seluruh daftar,
        bukan hanya satu terbaru seperti preview HOME/Dien.
     --------------------------------------------------------- */

  async function muatKhutbah() {
    const list = document.getElementById("khutbahList");
    if (!list) return;

    try {
      const data = await ambilData("../data/khutbah.json");
      const daftar = (data.khutbah || []).slice();

      if (!daftar.length) {
        tampilkanPesanKosong(list, "Belum ada khutbah Jumat untuk ditampilkan.");
        return;
      }

      daftar.sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal));

      list.innerHTML = daftar.map((k) => {
        const tombolBaca = k.tautanBaca
          ? `<a class="chip-btn" href="${escapeHTML(k.tautanBaca)}">Baca</a>` : "";
        const tombolPdf = k.tautanPdf
          ? `<a class="chip-btn" href="${escapeHTML(k.tautanPdf)}">PDF</a>` : "";
        const tombolWa = k.pesanWhatsApp
          ? `<a class="chip-btn chip-btn-whatsapp" href="${escapeHTML(buatTautanWhatsApp(k.pesanWhatsApp))}" target="_blank" rel="noopener">Bagikan ke WhatsApp</a>`
          : "";

        return `
          <article class="khutbah-card">
            <h3 class="khutbah-title">${escapeHTML(k.judul)}</h3>
            <p class="khutbah-date">${escapeHTML(formatTanggalIndonesia(k.tanggal))}</p>
            <div class="khutbah-actions">${tombolBaca}${tombolPdf}${tombolWa}</div>
          </article>
        `;
      }).join("");

      tampilkanCatatanDemo("khutbahDemoNote", data);
    } catch (err) {
      console.error("[JAZMI] Gagal memuat Khutbah Jumat (Rangkuman):", err);
      tampilkanPesanKosong(list, "Khutbah Jumat belum dapat dimuat saat ini.");
    }
  }

  /* ---------------------------------------------------------
     3. KAJIAN & TAKLIM (data/kajian.json) — seluruh daftar.
        Output video/audio hanya ditampilkan sebagai referensi
        keterkaitan (Media di luar cakupan C05).
     --------------------------------------------------------- */

  async function muatKajian() {
    const list = document.getElementById("kajianList");
    if (!list) return;

    try {
      const data = await ambilData("../data/kajian.json");
      const daftar = (data.kajian || []).slice();

      if (!daftar.length) {
        tampilkanPesanKosong(list, "Belum ada kajian untuk ditampilkan.");
        return;
      }

      daftar.sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal));

      const labelOutput = [
        ["rangkuman", "Rangkuman"],
        ["pdf", "PDF"],
        ["video", "Video"],
        ["audio", "Audio"]
      ];

      list.innerHTML = daftar.map((kj) => {
        const output = kj.output || {};
        const outputHTML = labelOutput.map(([key, label]) => {
          const aktif = !!output[key];
          return `<span class="${aktif ? "" : "is-off"}">${escapeHTML(label)}</span>`;
        }).join("");

        return `
          <article class="kajian-card">
            <h3 class="kajian-title">${escapeHTML(kj.judul)}</h3>
            <p class="kajian-date">${escapeHTML(formatTanggalIndonesia(kj.tanggal))}</p>
            <p class="kajian-desc">${escapeHTML(kj.deskripsi || "")}</p>
            <div class="kajian-outputs">${outputHTML}</div>
            <a class="chip-btn" href="${escapeHTML(kj.tautan || "#")}">Lihat Kajian</a>
          </article>
        `;
      }).join("");

      tampilkanCatatanDemo("kajianDemoNote", data);
    } catch (err) {
      console.error("[JAZMI] Gagal memuat Kajian & Taklim (Rangkuman):", err);
      tampilkanPesanKosong(list, "Kajian &amp; Taklim belum dapat dimuat saat ini.");
    }
  }

  /* ---------------------------------------------------------
     4. Navigasi mobile (disalin dari dien/pondok.js)
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
     5. Reveal on scroll (sama pola dengan js/main.js dan
        dien/pondok.js, menghormati prefers-reduced-motion)
     --------------------------------------------------------- */

  function initRevealOnScroll() {
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const target = document.querySelectorAll(".identity, .section");

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
     init
     --------------------------------------------------------- */

  function init() {
    initNavigasiMobile();
    initRevealOnScroll();
    initFilterBahan();
    muatBahanBelajar().then(terapkanFilterTipeDariURL);
    muatKhutbah();
    muatKajian();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
