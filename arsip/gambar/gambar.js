/* =========================================================
   JAZMI — Arsip Gambar
   gambar.js
   Vanilla JavaScript, berdiri sendiri (tidak memuat main.js).
   Memuat data/gambar.json (dihasilkan generate-manifest.py),
   menampilkan sebagai satu galeri grid (tanpa sekat folder),
   dengan filter tipe (Semua/Infografik/Sinematik), "Muat Lebih
   Banyak", dan lightbox saat kartu diklik.
   ========================================================= */

(function () {
  "use strict";

  const PAGE_SIZE = 12;
  const TIPE_URUTAN = ["Semua", "Infografik", "Sinematik"];
  const TIPE_KE_NILAI = { Infografik: "infografik", Sinematik: "sinematik" };

  let semuaGambar = [];
  let tipeAktif = "Semua";
  let jumlahTampil = PAGE_SIZE;

  function escapeHTML(str) {
    if (str === null || str === undefined) return "";
    const div = document.createElement("div");
    div.textContent = String(str);
    return div.innerHTML;
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

  /* ---------------------------------------------------------
     filter tipe
     --------------------------------------------------------- */

  function renderControls() {
    const bar = document.getElementById("galleryControls");
    if (!bar) return;

    bar.innerHTML = TIPE_URUTAN.map((t) => `
      <button type="button" class="filter-chip${t === tipeAktif ? " is-active" : ""}" data-tipe="${escapeHTML(t)}">
        ${escapeHTML(t)}
      </button>
    `).join("");

    bar.querySelectorAll(".filter-chip").forEach((btn) => {
      btn.addEventListener("click", () => {
        tipeAktif = btn.dataset.tipe;
        jumlahTampil = PAGE_SIZE;
        renderControls();
        renderGaleri();
      });
    });
  }

  function gambarTersaring() {
    if (tipeAktif === "Semua") return semuaGambar;
    const nilai = TIPE_KE_NILAI[tipeAktif];
    return semuaGambar.filter((g) => g.tipe === nilai);
  }

  /* ---------------------------------------------------------
     render grid + status + load more
     --------------------------------------------------------- */

  function renderStatus(total, ditampilkan) {
    const status = document.getElementById("filterStatus");
    if (!status) return;
    if (!total) {
      status.textContent = "";
      return;
    }
    status.textContent = `Menampilkan ${ditampilkan} dari ${total} gambar`
      + (tipeAktif !== "Semua" ? ` — ${tipeAktif}` : "");
  }

  function labelTipe(tipe) {
    if (tipe === "infografik") return "Infografik";
    if (tipe === "sinematik") return "Sinematik";
    return "";
  }

  function renderGaleri() {
    const grid = document.getElementById("galleryGrid");
    const loadMoreBtn = document.getElementById("loadMoreBtn");
    if (!grid) return;

    const tersaring = gambarTersaring();

    if (!tersaring.length) {
      tampilkanPesanKosong(grid, "Belum ada gambar pada tipe ini.");
      renderStatus(0, 0);
      if (loadMoreBtn) loadMoreBtn.hidden = true;
      return;
    }

    const ditampilkan = tersaring.slice(0, jumlahTampil);

    grid.innerHTML = ditampilkan.map((g, i) => `
      <a class="gallery-card" href="${escapeHTML(g.file)}" data-index="${i}" aria-label="${escapeHTML(g.alt || g.seri)}">
        <div class="gallery-card-thumb-wrap">
          <img class="gallery-card-thumb" src="${escapeHTML(g.file)}" alt="${escapeHTML(g.alt || g.seri)}" loading="lazy">
        </div>
        ${labelTipe(g.tipe) ? `<span class="gallery-card-tipe">${escapeHTML(labelTipe(g.tipe))}</span>` : ""}
        <div class="gallery-card-caption">
          <span class="gallery-card-seri">${escapeHTML(g.seri)}</span>
        </div>
      </a>
    `).join("");

    grid.querySelectorAll(".gallery-card").forEach((card) => {
      card.addEventListener("click", (e) => {
        e.preventDefault();
        const idx = Number(card.dataset.index);
        bukaLightbox(ditampilkan[idx]);
      });
    });

    renderStatus(tersaring.length, ditampilkan.length);

    if (loadMoreBtn) {
      loadMoreBtn.hidden = ditampilkan.length >= tersaring.length;
    }
  }

  /* ---------------------------------------------------------
     lightbox
     --------------------------------------------------------- */

  function bukaLightbox(g) {
    const lb = document.getElementById("lightbox");
    const img = document.getElementById("lightboxImg");
    const caption = document.getElementById("lightboxCaption");
    if (!lb || !img) return;

    img.src = g.file;
    img.alt = g.alt || g.seri || "";
    if (caption) {
      caption.textContent = g.seri + (labelTipe(g.tipe) ? ` — ${labelTipe(g.tipe)}` : "");
    }
    lb.hidden = false;
    document.body.style.overflow = "hidden";
  }

  function tutupLightbox() {
    const lb = document.getElementById("lightbox");
    if (!lb) return;
    lb.hidden = true;
    document.body.style.overflow = "";
  }

  function initLightbox() {
    const closeBtn = document.getElementById("lightboxClose");
    const lb = document.getElementById("lightbox");
    if (closeBtn) closeBtn.addEventListener("click", tutupLightbox);
    if (lb) {
      lb.addEventListener("click", (e) => {
        if (e.target === lb) tutupLightbox();
      });
    }
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") tutupLightbox();
    });
  }

  /* ---------------------------------------------------------
     muat data
     --------------------------------------------------------- */

  async function muatGaleri() {
    const grid = document.getElementById("galleryGrid");
    try {
      const data = await ambilData("data/gambar.json");
      semuaGambar = data.gambar || [];

      if (!semuaGambar.length) {
        tampilkanPesanKosong(grid, "Belum ada gambar untuk ditampilkan.");
        return;
      }

      renderControls();
      renderGaleri();
    } catch (err) {
      console.error("[JAZMI] Gagal memuat Arsip Gambar:", err);
      tampilkanPesanKosong(grid, "Galeri belum dapat dimuat saat ini.");
    }
  }

  /* ---------------------------------------------------------
     navigasi mobile (disalin dari pola main.js)
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
    initLightbox();

    const loadMoreBtn = document.getElementById("loadMoreBtn");
    if (loadMoreBtn) {
      loadMoreBtn.addEventListener("click", () => {
        jumlahTampil += PAGE_SIZE;
        renderGaleri();
      });
    }

    muatGaleri();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
