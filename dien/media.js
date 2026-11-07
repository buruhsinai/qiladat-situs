/* =========================================================
   JAZMI — DIEN: MEDIA (C07)
   media.js
   Vanilla JavaScript, mandiri — tidak bergantung pada js/main.js
   HOME. Mengisi elemen dinamis di media.html menggunakan data
   dari data/media-dien.json.
   ========================================================= */

(function () {
  "use strict";

  /* ---------------------------------------------------------
     0. util kecil (pola sama dengan main.js HOME, disalin
        ulang karena tidak ada mekanisme import di static site)
     --------------------------------------------------------- */

  function escapeHTML(str) {
    if (str === null || str === undefined) return "";
    const div = document.createElement("div");
    div.textContent = String(str);
    return div.innerHTML;
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
    container.innerHTML = `<p class="data-empty-note">${escapeHTML(pesan)}</p>`;
  }

  // Label "Bagian dari: [judul]" — hanya dipakai kalau kontenIndukId
  // tersedia. Tidak ada registry/relationship engine; hanya string
  // deskriptif yang disiapkan oleh data itu sendiri lewat field
  // opsional "kontenIndukJudul" pada item mana pun yang membawanya.
  function labelBagianDari(item) {
    if (item && item.kontenIndukId && item.kontenIndukJudul) {
      return `<span class="media-related">Bagian dari: ${escapeHTML(item.kontenIndukJudul)}</span>`;
    }
    return "";
  }

  const IKON_PLAY = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>`;

  /* ---------------------------------------------------------
     1. BUKU
     --------------------------------------------------------- */

  function labelTipeBuku(tipe) {
    const label = { pdf: "PDF", bacaOnline: "Baca Online" };
    return label[tipe] || tipe || "Buku";
  }

  async function muatBuku(dataMedia) {
    const list = document.getElementById("bukuList");
    if (!list) return;

    const buku = (dataMedia.buku || []);

    if (!buku.length) {
      tampilkanPesanKosong(list, "Belum ada buku untuk ditampilkan.");
      return;
    }

    list.innerHTML = buku.map((b) => {
      const punyaTautan = !!(b.tautan && b.tautan.trim());
      const aksi = punyaTautan
        ? `<a class="media-book-link" href="${escapeHTML(b.tautan)}" target="_blank" rel="noopener noreferrer">Baca</a>`
        : `<span class="media-book-unavailable">Segera hadir</span>`;

      return `
        <li class="media-book-item">
          <div class="media-book-body">
            <span class="media-book-tag">${escapeHTML(labelTipeBuku(b.tipe))}</span>
            <span class="media-book-title">${escapeHTML(b.judul)}</span>
            ${labelBagianDari(b)}
          </div>
          <div class="media-book-action">${aksi}</div>
        </li>
      `;
    }).join("");
  }

  /* ---------------------------------------------------------
     2. VIDEO
     --------------------------------------------------------- */

  async function muatVideo(dataMedia) {
    const grid = document.getElementById("videoGrid");
    if (!grid) return;

    const video = (dataMedia.video || []);

    if (!video.length) {
      tampilkanPesanKosong(grid, "Belum ada video untuk ditampilkan.");
      return;
    }

    grid.innerHTML = video.map((v) => `
      <a class="video-card" href="${escapeHTML(v.tautanYoutube || "#")}" target="_blank" rel="noopener noreferrer">
        <div class="video-thumb">
          <span class="video-play">${IKON_PLAY}</span>
        </div>
        <p class="video-title">${escapeHTML(v.judul)}</p>
        ${labelBagianDari(v)}
      </a>
    `).join("");
  }

  /* ---------------------------------------------------------
     3. AUDIO
     --------------------------------------------------------- */

  const TINGGI_BAR_AUDIO = ["40%", "70%", "100%", "55%", "30%"];

  function buatBarsAudio() {
    return TINGGI_BAR_AUDIO
      .map((tinggi) => `<span style="height:${tinggi}"></span>`)
      .join("");
  }

  async function muatAudio(dataMedia) {
    const list = document.getElementById("audioList");
    if (!list) return;

    const audio = (dataMedia.audio || []);

    if (!audio.length) {
      tampilkanPesanKosong(list, "Belum ada audio untuk ditampilkan.");
      return;
    }

    list.innerHTML = audio.map((a) => `
      <li class="audio-item">
        <a class="audio-play" href="${escapeHTML(a.tautanSoundcloud || "#")}" target="_blank" rel="noopener noreferrer" aria-label="Dengarkan di SoundCloud">${IKON_PLAY}</a>
        <span class="audio-bars" aria-hidden="true">${buatBarsAudio()}</span>
        <span class="audio-body">
          <span class="audio-title">${escapeHTML(a.judul)}</span>
          ${labelBagianDari(a)}
        </span>
      </li>
    `).join("");
  }

  /* ---------------------------------------------------------
     4. GAMBAR
     --------------------------------------------------------- */

  async function muatGambar(dataMedia) {
    const grid = document.getElementById("gambarGrid");
    if (!grid) return;

    const gambar = (dataMedia.gambar || []);

    if (!gambar.length) {
      tampilkanPesanKosong(grid, "Belum ada gambar untuk ditampilkan.");
      return;
    }

    grid.innerHTML = gambar.map((g) => {
      const tone = [1, 2, 3, 4].includes(g.thumbTone) ? g.thumbTone : 1;
      const punyaTautan = !!(g.tautan && g.tautan.trim());
      const tag = punyaTautan ? "a" : "div";
      const atributTautan = punyaTautan
        ? `href="${escapeHTML(g.tautan)}" target="_blank" rel="noopener noreferrer"`
        : "";

      return `
        <${tag} class="media-image-item" ${atributTautan}>
          <div class="media-image-thumb media-image-thumb-${tone}">Contoh Gambar</div>
          <p class="media-image-caption">${escapeHTML(g.judul)}</p>
          ${labelBagianDari(g)}
        </${tag}>
      `;
    }).join("");
  }

  /* ---------------------------------------------------------
     5. MUAT SEMUA DATA MEDIA (satu fetch untuk seluruh halaman)
     --------------------------------------------------------- */

  async function muatMediaDien() {
    let data;
    try {
      data = await ambilData("data/media-dien.json");
    } catch (err) {
      console.error("[JAZMI][C07] Gagal memuat data Media DIEN:", err);
      tampilkanPesanKosong(document.getElementById("bukuList"), "Buku belum dapat dimuat saat ini.");
      tampilkanPesanKosong(document.getElementById("videoGrid"), "Video belum dapat dimuat saat ini.");
      tampilkanPesanKosong(document.getElementById("audioList"), "Audio belum dapat dimuat saat ini.");
      tampilkanPesanKosong(document.getElementById("gambarGrid"), "Gambar belum dapat dimuat saat ini.");
      return;
    }

    // Tiap section dirender independen — jika satu bagian data
    // bermasalah, bagian lain tetap tampil.
    try { await muatBuku(data); } catch (err) {
      console.error("[JAZMI][C07] Gagal merender Buku:", err);
      tampilkanPesanKosong(document.getElementById("bukuList"), "Buku belum dapat dimuat saat ini.");
    }
    try { await muatVideo(data); } catch (err) {
      console.error("[JAZMI][C07] Gagal merender Video:", err);
      tampilkanPesanKosong(document.getElementById("videoGrid"), "Video belum dapat dimuat saat ini.");
    }
    try { await muatAudio(data); } catch (err) {
      console.error("[JAZMI][C07] Gagal merender Audio:", err);
      tampilkanPesanKosong(document.getElementById("audioList"), "Audio belum dapat dimuat saat ini.");
    }
    try { await muatGambar(data); } catch (err) {
      console.error("[JAZMI][C07] Gagal merender Gambar:", err);
      tampilkanPesanKosong(document.getElementById("gambarGrid"), "Gambar belum dapat dimuat saat ini.");
    }
  }

  /* ---------------------------------------------------------
     6. NAVIGASI MOBILE (implementasi ringan, terisolasi C07)
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
     7. REVEAL ON SCROLL (ringan, terisolasi C07)
     --------------------------------------------------------- */

  function initRevealOnScroll() {
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const target = document.querySelectorAll(".media-intro, .section");

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
     Jalankan semuanya
     --------------------------------------------------------- */

  function init() {
    initNavigasiMobile();
    initRevealOnScroll();
    muatMediaDien();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
