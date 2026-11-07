/* =========================================================
   JAZMI — PRODUK GLOBAL (C14)
   produk-global.js
   Pola nav mobile & reveal-on-scroll disalin PERSIS dari
   produk-media.js (C13), sesuai kontrak 4.2 / 3.3. Menambahkan
   filter kategori sisi klien dan modal detail produk ringan
   (tanpa dependency eksternal), khusus kebutuhan katalog global
   C14. Kegagalan memuat data tidak boleh merusak bagian statis
   halaman lain.
   ========================================================= */
(function () {
  "use strict";

  const PRODUK_DATA_URL = "data/produk.json";
  let semuaProduk = [];
  let filterAktif = "Semua";

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
     1. NAVIGASI MOBILE (disalin persis dari produk-media.js C13)
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
     2. REVEAL ON SCROLL (disalin persis dari produk-media.js C13)
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
     3. STATE HELPER (loading/error/empty — pola dari C13)
     --------------------------------------------------------- */

  function showState(prefix, id) {
    ["Loading", "Error", "Empty"].forEach((s) => {
      const el = document.getElementById(prefix + "State" + s);
      if (el) el.hidden = "State" + s !== id;
    });
  }

  /* ---------------------------------------------------------
     4. KARTU PRODUK (dipakai bersama oleh Produk Pilihan &
        Semua Produk)
     --------------------------------------------------------- */

  function buatKartuProduk(p) {
    const card = document.createElement("article");
    card.className = "produk-card";
    card.innerHTML =
      (p.pilihan ? '<span class="produk-card-pilihan">Pilihan</span>' : "") +
      '<span class="produk-card-kategori">' + escapeHTML(p.kategori) + "</span>" +
      '<h3 class="produk-card-title">' + escapeHTML(p.nama) + "</h3>" +
      '<p class="produk-card-desc">' + escapeHTML(p.ringkasan) + "</p>" +
      '<div class="produk-card-aksi">' +
      '<button type="button" class="btn-text" data-produk-id="' + escapeHTML(p.id) + '">Lihat Detail →</button>' +
      "</div>";

    const tombol = card.querySelector("[data-produk-id]");
    tombol.addEventListener("click", () => bukaModalDetail(p.id));

    return card;
  }

  /* ---------------------------------------------------------
     5. PRODUK PILIHAN (statis dari subset data, tidak berubah
        oleh filter kategori)
     --------------------------------------------------------- */

  function renderProdukPilihan(produk) {
    const grid = document.getElementById("pilihanGrid");
    if (!grid) return;

    const pilihan = (produk || []).filter((p) => p.pilihan);

    if (pilihan.length === 0) {
      showState("pilihan", "StateEmpty");
      return;
    }

    grid.innerHTML = "";
    pilihan.forEach((p) => grid.appendChild(buatKartuProduk(p)));

    grid.hidden = false;
    ["pilihanStateLoading", "pilihanStateError", "pilihanStateEmpty"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.hidden = true;
    });
  }

  /* ---------------------------------------------------------
     6. SEMUA PRODUK + FILTER KATEGORI
     --------------------------------------------------------- */

  function renderSemuaProduk() {
    const grid = document.getElementById("produkGrid");
    if (!grid) return;

    const hasil = filterAktif === "Semua"
      ? semuaProduk
      : semuaProduk.filter((p) => p.kategori === filterAktif);

    if (!Array.isArray(semuaProduk) || semuaProduk.length === 0) {
      showState("produk", "StateEmpty");
      return;
    }

    grid.innerHTML = "";

    if (hasil.length === 0) {
      const kosong = document.createElement("p");
      kosong.className = "data-empty-note";
      kosong.textContent = "Belum ada produk pada kategori ini.";
      grid.appendChild(kosong);
    } else {
      hasil.forEach((p) => grid.appendChild(buatKartuProduk(p)));
    }

    grid.hidden = false;
    ["produkStateLoading", "produkStateError", "produkStateEmpty"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.hidden = true;
    });
  }

  function initFilterKategori() {
    const bar = document.getElementById("filterBar");
    if (!bar) return;

    bar.querySelectorAll(".filter-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        filterAktif = btn.getAttribute("data-kategori") || "Semua";
        bar.querySelectorAll(".filter-btn").forEach((b) => {
          b.setAttribute("aria-pressed", b === btn ? "true" : "false");
        });
        renderSemuaProduk();
      });
    });
  }

  /* ---------------------------------------------------------
     7. MODAL DETAIL PRODUK
     --------------------------------------------------------- */

  let elemenFokusSebelumModal = null;

  function bukaModalDetail(id) {
    const overlay = document.getElementById("modalOverlay");
    if (!overlay) return;

    const produk = semuaProduk.find((p) => p.id === id);
    if (!produk) return;

    document.getElementById("modalKategori").textContent = produk.kategori;
    document.getElementById("modalTitle").textContent = produk.nama;
    document.getElementById("modalDesc").textContent = produk.deskripsi || produk.ringkasan;
    document.getElementById("modalInfo").textContent = produk.informasiPenting || "";
    document.getElementById("modalInfo").hidden = !produk.informasiPenting;

    const tautan = document.getElementById("modalLink");
    const cta = document.getElementById("modalCta");
    if (tautan) {
      const adaTautan = typeof produk.tautan === "string" && produk.tautan.charAt(0) === "/";
      tautan.hidden = !adaTautan;
      if (adaTautan) {
        tautan.href = produk.tautan;
        tautan.textContent = produk.labelTautan || "Lihat halaman produk";
      }
      if (cta) cta.hidden = adaTautan;
    }

    elemenFokusSebelumModal = document.activeElement;

    overlay.hidden = false;
    document.body.classList.add("is-modal-open");

    const tombolTutup = document.getElementById("modalClose");
    if (tombolTutup) tombolTutup.focus();
  }

  function tutupModalDetail() {
    const overlay = document.getElementById("modalOverlay");
    if (!overlay || overlay.hidden) return;

    overlay.hidden = true;
    document.body.classList.remove("is-modal-open");

    if (elemenFokusSebelumModal && typeof elemenFokusSebelumModal.focus === "function") {
      elemenFokusSebelumModal.focus();
    }
  }

  function initModal() {
    const overlay = document.getElementById("modalOverlay");
    const tombolTutup = document.getElementById("modalClose");
    if (!overlay) return;

    if (tombolTutup) tombolTutup.addEventListener("click", tutupModalDetail);

    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) tutupModalDetail();
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !overlay.hidden) tutupModalDetail();
    });
  }

  /* ---------------------------------------------------------
     8. MUAT DATA
     --------------------------------------------------------- */

  function muatProdukGlobal() {
    const gridPilihan = document.getElementById("pilihanGrid");
    const gridSemua = document.getElementById("produkGrid");
    if (!gridPilihan && !gridSemua) return;

    fetch(PRODUK_DATA_URL)
      .then((res) => {
        if (!res.ok) throw new Error("Gagal memuat data produk: " + res.status);
        return res.json();
      })
      .then((data) => {
        semuaProduk = Array.isArray(data && data.produk) ? data.produk : [];
        renderProdukPilihan(semuaProduk);
        renderSemuaProduk();
      })
      .catch(() => {
        showState("pilihan", "StateError");
        showState("produk", "StateError");
      });
  }

  /* ---------------------------------------------------------
     Jalankan semuanya
     --------------------------------------------------------- */

  function init() {
    initNavigasiMobile();
    initRevealOnScroll();
    initFilterKategori();
    initModal();
    muatProdukGlobal();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
