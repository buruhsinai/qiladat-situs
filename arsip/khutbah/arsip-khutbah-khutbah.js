/* =========================================================
   JAZMI — ARSIP / KHUTBAH
   khutbah.js
   Pola nav mobile & reveal-on-scroll disalin PERSIS dari
   arsip.js (C15) / produk-global.js (C14).
   Daftar khutbah dimuat dari data/khutbah.json — pola fetch,
   escapeHTML, formatTanggalIndonesia, tampilkanPesanKosong,
   tampilkanCatatanDemo & buatTautanWhatsApp disalin PERSIS
   dari dien/rangkuman.js supaya konsisten dengan cara situs
   menampilkan daftar khutbah di halaman lain.
   ========================================================= */
(function () {
  "use strict";

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
    if (!res.ok) throw new Error(`Gagal memuat ${path} (status ${res.status})`);
    return res.json();
  }

  function tampilkanPesanKosong(container, pesan) {
    if (!container) return;
    container.innerHTML = `<p class="data-empty-note">${escapeHTML(pesan)}</p>`;
  }

  // Data JSON menandai dirinya sendiri lewat field "_catatan" kalau
  // isinya masih data contoh/demo (bukan resmi JAZMI) — kalau field
  // itu ada, tampilkan penanda jujur; kalau tidak, sembunyikan badge.
  function tampilkanCatatanDemo(elId, data) {
    const el = document.getElementById(elId);
    if (!el) return;
    if (data && typeof data._catatan === "string") {
      el.hidden = false;
      el.textContent = "Catatan: bahan di atas masih berupa data contoh/demo, belum konten resmi JAZMI.";
    } else {
      el.hidden = true;
      el.textContent = "";
    }
  }

  function buatTautanWhatsApp(pesan) {
    // Halaman hanya MEMBUKA WhatsApp dengan pesan yang sudah
    // disiapkan — tidak ada pesan yang dikirim otomatis.
    const teks = `${pesan}\n${window.location.href}`;
    return `https://wa.me/?text=${encodeURIComponent(teks)}`;
  }

  async function muatDaftarKhutbah() {
    const grid = document.getElementById("khutbahGrid");
    if (!grid) return;

    try {
      const data = await ambilData("../../data/khutbah.json");
      const daftar = (data.khutbah || []).slice();

      if (!daftar.length) {
        tampilkanPesanKosong(grid, "Belum ada khutbah untuk ditampilkan.");
        tampilkanCatatanDemo("khutbahDemoNote", data);
        return;
      }

      daftar.sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal));

      grid.innerHTML = daftar.map((k) => {
        const tombolBaca = k.tautanBaca
          ? `<a class="btn-text" href="${escapeHTML(k.tautanBaca)}">Baca Naskah →</a>` : "";
        const tombolPdf = k.tautanPdf && k.tautanPdf !== k.tautanBaca
          ? `<a class="btn-text" href="${escapeHTML(k.tautanPdf)}">Unduh PDF</a>` : "";
        const tombolWa = k.pesanWhatsApp
          ? `<a class="btn-text" href="${escapeHTML(buatTautanWhatsApp(k.pesanWhatsApp))}" target="_blank" rel="noopener">Bagikan WhatsApp</a>`
          : "";

        return `
          <article class="arsip-card">
            <div class="arsip-card-badges">
              <span class="arsip-card-tipe">Khutbah Jumat</span>
            </div>
            <h3 class="arsip-card-title">${escapeHTML(k.judul)}</h3>
            <p class="arsip-card-desc">${escapeHTML(k.ringkasan || "")}</p>
            <p class="data-empty-note">${escapeHTML(formatTanggalIndonesia(k.tanggal))}</p>
            <div class="arsip-card-aksi">${tombolBaca}${tombolPdf}${tombolWa}</div>
          </article>
        `;
      }).join("");

      tampilkanCatatanDemo("khutbahDemoNote", data);
    } catch (err) {
      console.error("[JAZMI] Gagal memuat Arsip Khutbah:", err);
      tampilkanPesanKosong(grid, "Khutbah belum dapat dimuat saat ini.");
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

  function init() {
    initNavigasiMobile();
    initRevealOnScroll();
    muatDaftarKhutbah();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
