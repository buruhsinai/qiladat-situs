/* =========================================================
   JAZMI — KESEHATAN / PRODUK & MEDIA (C10)
   produk-media.js
   Dipakai bersama oleh produk.html dan media.html (satu file
   JS, karena kedua halaman berbagi pola & komponen yang sama).
   Pola nav mobile & reveal-on-scroll disalin PERSIS dari
   kesehatan.js (C08) / terapi.js (C09) sesuai kontrak 4.2/3.3.

   produk.html memiliki dua state via query string URL:
     - produk.html            → STATE LIST (daftar produk)
     - produk.html?id=<id>    → STATE DETAIL (detail produk)
   Data: data/produk-demo.json (DEMO lokal C10).

   media.html hanya STATE LIST (tidak ada halaman detail —
   seluruh entri media-demo.json belum memiliki tautan nyata,
   lihat _catatan pada data/media-demo.json; kartu media
   sengaja dibuat non-tautan, bukan <a>, agar tidak membuat
   link fiktif).
   Data: data/media-demo.json (DEMO lokal C10).

   Skrip ini otomatis mendeteksi halaman aktif dari elemen yang
   tersedia di DOM (#productGrid vs #mediaGrid) — tidak ada
   percabangan berdasarkan nama file.
   ========================================================= */
(function () {
  "use strict";

  /* ---------------------------------------------------------
     0. UTIL (disalin persis dari terapi.js C09)
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

  function getQueryParam(name) {
    const params = new URLSearchParams(window.location.search);
    return params.get(name);
  }

  function showOnly(id, semuaState) {
    semuaState.forEach((s) => {
      const el = document.getElementById(s);
      if (el) el.hidden = s !== id;
    });
  }

  /* ---------------------------------------------------------
     1. NAVIGASI MOBILE (disalin persis dari kesehatan.js C08)
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
     2. REVEAL ON SCROLL (disalin persis dari kesehatan.js C08)
     --------------------------------------------------------- */

  function initRevealOnScroll() {
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const target = document.querySelectorAll(".domain-hero, .identity, .section");

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

  /* ===========================================================
     A. HALAMAN PRODUK (produk.html) — hanya berjalan jika
        #productGrid ada di DOM
     =========================================================== */

  function initHalamanProduk() {
    const DATA_URL = "data/produk-demo.json";
    const STATES = ["stateLoading", "stateError", "stateNotFound", "stateList", "stateDetail"];

    let semuaProduk = [];
    let kategoriAktif = "semua";
    let kataKunci = "";

    function renderFilterBar(daftarKategori) {
      const bar = document.getElementById("filterBar");
      if (!bar) return;
      bar.innerHTML = "";

      const kategoriUnik = ["semua", ...daftarKategori];
      kategoriUnik.forEach((kat) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "filter-chip" + (kat === kategoriAktif ? " is-active" : "");
        btn.textContent = kat === "semua" ? "Semua" : kat;
        btn.setAttribute("data-kategori", kat);
        btn.setAttribute("aria-pressed", kat === kategoriAktif ? "true" : "false");
        btn.addEventListener("click", () => {
          kategoriAktif = kat;
          renderFilterBar(daftarKategori);
          renderGrid();
        });
        bar.appendChild(btn);
      });
    }

    function renderGrid() {
      const grid = document.getElementById("productGrid");
      const emptyState = document.getElementById("emptyState");
      const status = document.getElementById("filterStatus");
      if (!grid) return;

      let hasil = semuaProduk.slice();

      if (kategoriAktif !== "semua") {
        hasil = hasil.filter((p) => p.kategori === kategoriAktif);
      }
      if (kataKunci.trim() !== "") {
        const kunci = kataKunci.trim().toLowerCase();
        hasil = hasil.filter((p) => (p.nama || "").toLowerCase().includes(kunci));
      }

      grid.innerHTML = "";

      if (hasil.length === 0) {
        if (emptyState) emptyState.hidden = false;
      } else {
        if (emptyState) emptyState.hidden = true;
        hasil.forEach((p) => {
          const card = document.createElement("a");
          card.className = "product-card";
          card.href = "produk.html?id=" + encodeURIComponent(p.id);
          card.innerHTML =
            '<span class="product-card-category">' + escapeHTML(p.kategori) + "</span>" +
            '<h3 class="product-card-title">' + escapeHTML(p.nama) + "</h3>" +
            '<p class="product-card-desc">' + escapeHTML(p.ringkasan) + "</p>" +
            '<span class="product-card-link">Lihat Detail →</span>';
          grid.appendChild(card);
        });
      }

      if (status) {
        status.textContent = hasil.length + " produk ditemukan.";
      }
    }

    function initSearch() {
      const input = document.getElementById("searchInput");
      if (!input) return;
      input.addEventListener("input", (e) => {
        kataKunci = e.target.value;
        renderGrid();
      });
    }

    function renderStateList(data) {
      semuaProduk = data.produk || [];
      const daftarKategori = Array.from(new Set(semuaProduk.map((p) => p.kategori))).sort();
      renderFilterBar(daftarKategori);
      initSearch();
      renderGrid();
      showOnly("stateList", STATES);
    }

    function renderStateDetail(data, id) {
      const item = (data.produk || []).find((p) => p.id === id);

      if (!item) {
        showOnly("stateNotFound", STATES);
        return;
      }

      document.title = item.nama + " — Produk — Kesehatan — JAZMI";
      const metaDesc = document.getElementById("pageDescription");
      if (metaDesc) metaDesc.setAttribute("content", escapeHTML(item.ringkasan || ""));

      const breadcrumbCurrent = document.getElementById("breadcrumbCurrent");
      const breadcrumbInner = document.getElementById("breadcrumbInner");
      if (breadcrumbInner && breadcrumbCurrent) {
        breadcrumbCurrent.remove();
        const sep = document.createElement("span");
        sep.className = "breadcrumb-sep";
        sep.setAttribute("aria-hidden", "true");
        sep.textContent = "/";

        const linkProduk = document.createElement("a");
        linkProduk.href = "produk.html";
        linkProduk.textContent = "Produk";

        const current = document.createElement("span");
        current.setAttribute("aria-current", "page");
        current.textContent = item.nama;

        breadcrumbInner.appendChild(linkProduk);
        breadcrumbInner.appendChild(sep);
        breadcrumbInner.appendChild(current);
      }

      const category = document.getElementById("produkCategory");
      if (category) category.textContent = item.kategori || "";

      const name = document.getElementById("produkName");
      if (name) name.textContent = item.nama || "";

      const demoBadge = document.getElementById("produkDemoBadge");
      if (demoBadge) demoBadge.hidden = item.status !== "demo";

      const summary = document.getElementById("produkSummary");
      if (summary) summary.textContent = item.ringkasan || "";

      const body = document.getElementById("produkBody");
      if (body) {
        body.innerHTML = "";
        (item.deskripsi || []).forEach((paragraf) => {
          const p = document.createElement("p");
          p.textContent = paragraf;
          body.appendChild(p);
        });
      }

      // Sumber/Referensi
      const refBlock = document.getElementById("produkReferenceBlock");
      const refList = document.getElementById("produkReferenceList");
      if (refBlock && refList) {
        const referensi = item.sumberReferensi || [];
        if (referensi.length > 0) {
          refList.innerHTML = "";
          referensi.forEach((r) => {
            const li = document.createElement("li");
            li.textContent = r;
            refList.appendChild(li);
          });
          refBlock.hidden = false;
        } else {
          refBlock.hidden = true;
        }
      }

      // Terapi Terkait (C09) — hanya jika data relasi NYATA tersedia
      // pada item (lihat produk-demo.json), bukan relasi yang dibuat
      // otomatis agar halaman terlihat lengkap.
      const terapiBlock = document.getElementById("produkTerapiBlock");
      const terapiList = document.getElementById("produkTerapiList");
      if (terapiBlock && terapiList) {
        const terapi = item.terapiTerkait;
        if (terapi && terapi.tautan) {
          terapiList.innerHTML = "";
          const li = document.createElement("li");
          const link = document.createElement("a");
          link.href = terapi.tautan;
          link.textContent = terapi.nama;
          li.appendChild(link);
          terapiList.appendChild(li);
          terapiBlock.hidden = false;
        } else {
          terapiBlock.hidden = true;
        }
      }

      // Artikel Terkait: sistem global. Hanya ditampilkan jika data
      // relasi NYATA tersedia — jangan membuat relasi fiktif ke Artikel.
      const relatedSection = document.getElementById("relatedArticlesSection");
      const relatedList = document.getElementById("relatedArticlesList");
      if (relatedSection && relatedList) {
        const artikelTerkait = item.artikelTerkait;
        if (Array.isArray(artikelTerkait) && artikelTerkait.length > 0) {
          relatedList.innerHTML = "";
          artikelTerkait.forEach((a) => {
            const li = document.createElement("li");
            const link = document.createElement("a");
            link.href = a.tautan;
            link.textContent = a.judul;
            li.appendChild(link);
            relatedList.appendChild(li);
          });
          relatedSection.hidden = false;
        } else {
          relatedSection.hidden = true;
        }
      }

      showOnly("stateDetail", STATES);
    }

    function muatData() {
      fetch(DATA_URL)
        .then((res) => {
          if (!res.ok) throw new Error("Gagal memuat data produk: " + res.status);
          return res.json();
        })
        .then((data) => {
          const id = getQueryParam("id");
          if (id) {
            renderStateDetail(data, id);
          } else {
            renderStateList(data);
          }
        })
        .catch(() => {
          showOnly("stateError", STATES);
        });
    }

    muatData();
  }

  /* ===========================================================
     B. HALAMAN MEDIA (media.html) — hanya berjalan jika
        #mediaGrid ada di DOM. Tidak ada state detail: kartu
        media adalah <div>, bukan <a>, karena tautan media
        sungguhan belum tersedia (lihat data/media-demo.json).
     =========================================================== */

  function initHalamanMedia() {
    const DATA_URL = "data/media-demo.json";
    const STATES = ["stateLoading", "stateError", "stateList"];

    const LABEL_TIPE = {
      buku: "Buku",
      video: "Video",
      audio: "Audio",
      gambar: "Gambar"
    };

    let semuaMedia = [];
    let tipeAktif = "semua";
    let kataKunci = "";

    function renderFilterBar(daftarTipe) {
      const bar = document.getElementById("filterBar");
      if (!bar) return;
      bar.innerHTML = "";

      const tipeUnik = ["semua", ...daftarTipe];
      tipeUnik.forEach((tipe) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "filter-chip" + (tipe === tipeAktif ? " is-active" : "");
        btn.textContent = tipe === "semua" ? "Semua" : (LABEL_TIPE[tipe] || tipe);
        btn.setAttribute("data-tipe", tipe);
        btn.setAttribute("aria-pressed", tipe === tipeAktif ? "true" : "false");
        btn.addEventListener("click", () => {
          tipeAktif = tipe;
          renderFilterBar(daftarTipe);
          renderGrid();
        });
        bar.appendChild(btn);
      });
    }

    function renderGrid() {
      const grid = document.getElementById("mediaGrid");
      const emptyState = document.getElementById("emptyState");
      const status = document.getElementById("filterStatus");
      if (!grid) return;

      let hasil = semuaMedia.slice();

      if (tipeAktif !== "semua") {
        hasil = hasil.filter((m) => m.tipe === tipeAktif);
      }
      if (kataKunci.trim() !== "") {
        const kunci = kataKunci.trim().toLowerCase();
        hasil = hasil.filter((m) => (m.judul || "").toLowerCase().includes(kunci));
      }

      grid.innerHTML = "";

      if (hasil.length === 0) {
        if (emptyState) emptyState.hidden = false;
      } else {
        if (emptyState) emptyState.hidden = true;
        hasil.forEach((m) => {
          const card = document.createElement("div");
          card.className = "media-card";

          const catatanTautan = m.tautan
            ? ""
            : '<p class="media-card-note">Tautan menyusul pada tahap data resmi.</p>';

          card.innerHTML =
            '<span class="media-card-type">' + escapeHTML(LABEL_TIPE[m.tipe] || m.tipe) + "</span>" +
            '<h3 class="media-card-title">' + escapeHTML(m.judul) + "</h3>" +
            '<p class="media-card-desc">' + escapeHTML(m.ringkasan) + "</p>" +
            catatanTautan;
          grid.appendChild(card);
        });
      }

      if (status) {
        status.textContent = hasil.length + " media ditemukan.";
      }
    }

    function initSearch() {
      const input = document.getElementById("searchInput");
      if (!input) return;
      input.addEventListener("input", (e) => {
        kataKunci = e.target.value;
        renderGrid();
      });
    }

    function renderStateList(data) {
      semuaMedia = data.media || [];
      const daftarTipe = Array.from(new Set(semuaMedia.map((m) => m.tipe))).sort();
      renderFilterBar(daftarTipe);
      initSearch();
      renderGrid();
      showOnly("stateList", STATES);
    }

    function muatData() {
      fetch(DATA_URL)
        .then((res) => {
          if (!res.ok) throw new Error("Gagal memuat data media: " + res.status);
          return res.json();
        })
        .then((data) => renderStateList(data))
        .catch(() => {
          showOnly("stateError", STATES);
        });
    }

    muatData();
  }

  /* ---------------------------------------------------------
     3. INISIALISASI — deteksi halaman aktif dari DOM
     --------------------------------------------------------- */

  function init() {
    initNavigasiMobile();
    initRevealOnScroll();

    if (document.getElementById("productGrid")) {
      initHalamanProduk();
    } else if (document.getElementById("mediaGrid")) {
      initHalamanMedia();
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
