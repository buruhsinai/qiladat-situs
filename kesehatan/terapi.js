/* =========================================================
   JAZMI — KESEHATAN / TERAPI (C09)
   terapi.js
   Pola nav mobile & reveal-on-scroll disalin PERSIS dari
   kesehatan.js (C08) / js/main.js sesuai kontrak 4.2 / 3.3.
   Halaman ini memiliki dua state yang ditentukan dari query
   string URL:
     - terapi.html            → STATE LIST (daftar terapi)
     - terapi.html?id=<id>    → STATE DETAIL (detail terapi)
   Data diambil dari data/terapi-demo.json (data DEMO lokal C09,
   bukan data resmi JAZMI — lihat mandat: jangan buat data/relasi
   fiktif untuk Artikel/Media, dan tandai jelas semua data demo).
   ========================================================= */
(function () {
  "use strict";

  const DATA_URL = "data/terapi-demo.json";

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

  function getQueryParam(name) {
    const params = new URLSearchParams(window.location.search);
    return params.get(name);
  }

  function showOnly(id) {
    const states = ["stateLoading", "stateError", "stateNotFound", "stateList", "stateDetail"];
    states.forEach((s) => {
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

  /* ---------------------------------------------------------
     3. STATE LIST — daftar, filter kategori, pencarian
     --------------------------------------------------------- */

  let semuaTerapi = [];
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
    const grid = document.getElementById("therapyGrid");
    const emptyState = document.getElementById("emptyState");
    const status = document.getElementById("filterStatus");
    if (!grid) return;

    let hasil = semuaTerapi.slice();

    if (kategoriAktif !== "semua") {
      hasil = hasil.filter((t) => t.kategori === kategoriAktif);
    }
    if (kataKunci.trim() !== "") {
      const kunci = kataKunci.trim().toLowerCase();
      hasil = hasil.filter((t) => (t.nama || "").toLowerCase().includes(kunci));
    }

    grid.innerHTML = "";

    if (hasil.length === 0) {
      if (emptyState) emptyState.hidden = false;
    } else {
      if (emptyState) emptyState.hidden = true;
      hasil.forEach((t) => {
        const card = document.createElement("a");
        card.className = "therapy-card";
        card.href = "terapi.html?id=" + encodeURIComponent(t.id);
        card.innerHTML =
          '<span class="therapy-card-category">' + escapeHTML(t.kategori) + "</span>" +
          '<h3 class="therapy-card-title">' + escapeHTML(t.nama) + "</h3>" +
          '<p class="therapy-card-desc">' + escapeHTML(t.ringkasan) + "</p>" +
          '<span class="therapy-card-link">Lihat Detail →</span>';
        grid.appendChild(card);
      });
    }

    if (status) {
      status.textContent = hasil.length + " terapi ditemukan.";
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
    semuaTerapi = data.terapi || [];
    const daftarKategori = Array.from(new Set(semuaTerapi.map((t) => t.kategori))).sort();
    renderFilterBar(daftarKategori);
    initSearch();
    renderGrid();
    showOnly("stateList");
  }

  /* ---------------------------------------------------------
     4. STATE DETAIL — satu terapi
     --------------------------------------------------------- */

  function renderStateDetail(data, id) {
    const item = (data.terapi || []).find((t) => t.id === id);

    if (!item) {
      showOnly("stateNotFound");
      return;
    }

    document.title = item.nama + " — Terapi — Kesehatan — JAZMI";
    const metaDesc = document.getElementById("pageDescription");
    if (metaDesc) metaDesc.setAttribute("content", escapeHTML(item.ringkasan || ""));

    const breadcrumbCurrent = document.getElementById("breadcrumbCurrent");
    const breadcrumbInner = document.getElementById("breadcrumbInner");
    if (breadcrumbInner && breadcrumbCurrent) {
      // Ubah "Terapi" pada breadcrumb menjadi tautan, tambahkan nama terapi sebagai current.
      breadcrumbCurrent.remove();
      const sep = document.createElement("span");
      sep.className = "breadcrumb-sep";
      sep.setAttribute("aria-hidden", "true");
      sep.textContent = "/";

      const linkTerapi = document.createElement("a");
      linkTerapi.href = "terapi.html";
      linkTerapi.textContent = "Terapi";

      const current = document.createElement("span");
      current.setAttribute("aria-current", "page");
      current.textContent = item.nama;

      breadcrumbInner.appendChild(linkTerapi);
      breadcrumbInner.appendChild(sep);
      breadcrumbInner.appendChild(current);
    }

    const category = document.getElementById("therapyCategory");
    if (category) category.textContent = item.kategori || "";

    const name = document.getElementById("therapyName");
    if (name) name.textContent = item.nama || "";

    const demoBadge = document.getElementById("therapyDemoBadge");
    if (demoBadge) demoBadge.hidden = item.status !== "demo";

    const summary = document.getElementById("therapySummary");
    if (summary) summary.textContent = item.ringkasan || "";

    const body = document.getElementById("therapyBody");
    if (body) {
      body.innerHTML = "";
      (item.deskripsi || []).forEach((paragraf) => {
        const p = document.createElement("p");
        p.textContent = paragraf;
        body.appendChild(p);
      });
    }

    const refBlock = document.getElementById("therapyReferenceBlock");
    const refList = document.getElementById("therapyReferenceList");
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

    // Artikel terkait: sistem global. Hanya ditampilkan jika data relasi
    // NYATA tersedia pada item — jangan membuat relasi fiktif ke Artikel.
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

    showOnly("stateDetail");
  }

  /* ---------------------------------------------------------
     5. INISIALISASI
     --------------------------------------------------------- */

  function muatData() {
    fetch(DATA_URL)
      .then((res) => {
        if (!res.ok) throw new Error("Gagal memuat data terapi: " + res.status);
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
        showOnly("stateError");
      });
  }

  function init() {
    initNavigasiMobile();
    initRevealOnScroll();
    muatData();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
