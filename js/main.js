/* =========================================================
   JAZMI — HOME
   main.js
   Vanilla JavaScript. Tidak menggunakan framework.
   Mengisi elemen dinamis pada index.html menggunakan data
   dari folder /data. Tidak membuat ID/class baru di luar
   yang sudah tersedia di index.html dan style.css.
   ========================================================= */

(function () {
  "use strict";

  /* ---------------------------------------------------------
     0. util kecil
     --------------------------------------------------------- */

  // Batasi jumlah item yang ditampilkan per section (etalase,
  // bukan gudang — lihat MASTER HOMEPAGE & CONTENT ECOSYSTEM).
  const LIMIT = {
    artikel: 5,
    bahan: 3,
    visual: 6,
    videoPilihan: 2,
    video: 8,
    audio: 3
  };

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

  // Pesan wajar untuk section yang gagal memuat data, tanpa
  // merusak seluruh halaman.
  function tampilkanPesanKosong(container, pesan) {
    if (!container) return;
    container.innerHTML = `<p class="data-empty-note">${escapeHTML(pesan)}</p>`;
  }

  /* ---------------------------------------------------------
     1. BAIT SYAIR HARI INI
     --------------------------------------------------------- */

  function pilihBaitHariIni(daftarBait) {
    // Deterministik berdasarkan TANGGAL LOKAL perangkat pengunjung
    // (bukan UTC): tanggal lokal yang sama selalu menghasilkan
    // bait yang sama, dan bait berganti tepat saat tanggal lokal
    // berganti (misal 23:59 -> 00:01 di zona waktu pengunjung
    // mana pun). Tidak perlu server, tidak dikunci ke zona waktu
    // tertentu seperti WIB.
    const sekarang = new Date();
    // Date.UTC() di sini hanya dipakai sebagai kalkulator hari
    // yang stabil, dibangun dari komponen tanggal LOKAL
    // (getFullYear/getMonth/getDate) — bukan konversi ke UTC.
    const hariLokal = Math.floor(
      Date.UTC(sekarang.getFullYear(), sekarang.getMonth(), sekarang.getDate()) / 86400000
    );
    const indeks = hariLokal % daftarBait.length;
    return daftarBait[indeks];
  }

  async function muatBaitHarian() {
    const elArab = document.getElementById("baitArab");
    const elTerjemahan = document.getElementById("baitTerjemahan");
    const elPenyair = document.getElementById("baitPenyair");
    const elSumber = document.getElementById("baitSumber");
    const elTautan = document.getElementById("baitTautan");

    try {
      const data = await ambilData("data/syair.json");
      const daftarBait = data.bait || [];
      if (!daftarBait.length) throw new Error("Data syair kosong.");

      const bait = pilihBaitHariIni(daftarBait);

      if (elArab) elArab.textContent = bait.arab || "";
      if (elTerjemahan) elTerjemahan.textContent = bait.terjemahan || "";
      if (elPenyair) elPenyair.textContent = bait.penyair || "";

      // Sumber bersifat opsional — sembunyikan pemisah jika tidak ada.
      const pemisah = document.querySelector(".bait-meta-sep");
      if (bait.sumber) {
        if (elSumber) elSumber.textContent = bait.sumber;
        if (pemisah) pemisah.style.display = "";
      } else {
        if (elSumber) elSumber.textContent = "";
        if (pemisah) pemisah.style.display = "none";
      }

      // Selalu menuju Penjelasan Hari Ini di dien/syair.html — TIDAK
      // lagi memakai bait.tautanDetail per-bait, karena mekanisme
      // penjelasan sekarang berbasis tanggal (satu penjelasan per
      // hari untuk bait yang tampil hari itu), bukan per-ID bait.
      // Lihat dien/data/penjelasan-syair.json & dien/syair.js.
      if (elTautan) elTautan.href = "dien/syair.html#penjelasan-hari-ini";
    } catch (err) {
      console.error("[JAZMI] Gagal memuat Bait Syair Hari Ini:", err);
      if (elArab) elArab.textContent = "";
      if (elTerjemahan) {
        elTerjemahan.textContent = "Bait hari ini belum dapat dimuat. Silakan coba muat ulang halaman.";
      }
      if (elPenyair) elPenyair.textContent = "";
      if (elSumber) elSumber.textContent = "";
      if (elTautan) elTautan.style.display = "none";
    }
  }

  /* ---------------------------------------------------------
     2. ARTIKEL TERBARU
     --------------------------------------------------------- */

  // Kunci pengurutan artikel: utamakan tanggal asli bila ada (makin baru
  // makin besar). Kalau artikel belum diberi tanggal publikasi resmi
  // (field "tanggal" kosong/null), pakai field "urutan" (angka manual,
  // makin besar = makin baru) sebagai cadangan, ditambah offset jauh ke
  // depan supaya konten yang memang belum bertanggal tetap tampil sebagai
  // yang terbaru dibanding artikel lama yang sudah bertanggal. Disamakan
  // dengan kunciUrutanArtikel() di artikel/js/artikel.js supaya urutan
  // "Artikel Terbaru" di Home konsisten dengan halaman Artikel.
  const URUTAN_OFFSET = new Date("2099-01-01T00:00:00").getTime();
  function kunciUrutanArtikel(a) {
    if (a && a.tanggal) {
      const t = new Date(a.tanggal + "T00:00:00").getTime();
      if (!isNaN(t)) return t;
    }
    if (a && typeof a.urutan === "number") return URUTAN_OFFSET + a.urutan;
    return 0;
  }

  // Label waktu/rubrik: tanggal asli bila ada, kalau tidak pakai nama
  // seri sebagai gantinya (bukan tanggal palsu) — sama seperti di
  // artikel/js/artikel.js.
  function labelWaktuArtikel(a) {
    if (a && a.tanggal) return formatTanggalIndonesia(a.tanggal);
    if (a && a.seri) return a.seri;
    return "";
  }

  // Kunci urutan generik untuk item bertanggal (video, audio, dll):
  // sama seperti kunciUrutanArtikel — utamakan "tanggal", fallback ke
  // "urutan" (angka manual, makin besar makin baru) bila tanggal belum
  // diisi. Dipakai supaya "Video Terbaru"/"Audio Terbaru" otomatis
  // urut terbaru-dulu HANYA dengan mengisi field tanggal di JSON —
  // tidak perlu menaruh entri baru di posisi teratas array secara manual.
  function kunciUrutanItem(item) {
    if (item && item.tanggal) {
      const t = new Date(item.tanggal + "T00:00:00").getTime();
      if (!isNaN(t)) return t;
    }
    if (item && typeof item.urutan === "number") return URUTAN_OFFSET + item.urutan;
    return 0;
  }

  // Link artikel dari HOME (root) harus diarahkan ke folder /artikel/,
  // karena detail.html hanya ada di sana — beda dengan link yang sama
  // dipakai di dalam /artikel/index.html sendiri (sudah benar tanpa
  // prefix, lihat artikel/js/artikel.js). Pola sama dipakai dien.js
  // (prefix "../artikel/") untuk kasus dari folder satu tingkat.
  function tautanArtikelDariHome(a) {
    if (!a || !a.tautan) return "#";
    return "artikel/" + a.tautan;
  }

  async function muatArtikelTerbaru() {
    const list = document.getElementById("articleList");
    if (!list) return;

    try {
      const data = await ambilData("data/articles.json");
      let artikel = (data.artikel || []).slice();

      // Urutkan berdasarkan tanggal/urutan, terbaru di atas.
      artikel.sort((a, b) => kunciUrutanArtikel(b) - kunciUrutanArtikel(a));
      artikel = artikel.slice(0, LIMIT.artikel);

      if (!artikel.length) {
        tampilkanPesanKosong(list, "Belum ada artikel untuk ditampilkan.");
        return;
      }

      list.innerHTML = artikel.map((a) => `
        <li class="article-item">
          <span class="article-date">${escapeHTML(labelWaktuArtikel(a))}</span>
          <div class="article-body">
            <a class="article-title" href="${escapeHTML(tautanArtikelDariHome(a))}">${escapeHTML(a.judul)}</a>
            ${a.kategori ? `<span class="article-category">${escapeHTML(a.kategori)}</span>` : ""}
          </div>
        </li>
      `).join("");
    } catch (err) {
      console.error("[JAZMI] Gagal memuat Artikel Terbaru:", err);
      tampilkanPesanKosong(list, "Artikel terbaru belum dapat dimuat saat ini.");
    }
  }

  /* ---------------------------------------------------------
     3. KARYA VISUAL TERBARU (slider)
     --------------------------------------------------------- */

  function labelTipeVisual(tipe) {
    if (tipe === "infografik") return "Infografik";
    if (tipe === "sinematik") return "Sinematik";
    return "";
  }

  async function muatKaryaVisual() {
    const slider = document.getElementById("visualSlider");
    if (!slider) return;

    try {
      const data = await ambilData("arsip/gambar/data/gambar.json");
      const visual = (data.gambar || []).slice(0, LIMIT.visual);

      if (!visual.length) {
        tampilkanPesanKosong(slider, "Belum ada karya visual untuk ditampilkan.");
        return;
      }

      slider.innerHTML = visual.map((v) => {
        const label = labelTipeVisual(v.tipe);
        return `
          <a class="visual-card" href="/arsip/gambar/">
            <div class="visual-thumb visual-thumb-img">
              <img src="${escapeHTML("arsip/gambar/" + v.file)}" alt="${escapeHTML(v.alt || v.seri)}" loading="lazy">
              ${label ? `<span class="visual-thumb-tipe">${escapeHTML(label)}</span>` : ""}
            </div>
            <p class="visual-caption">${escapeHTML(v.seri)}</p>
          </a>
        `;
      }).join("");
    } catch (err) {
      console.error("[JAZMI] Gagal memuat Karya Visual Terbaru:", err);
      tampilkanPesanKosong(slider, "Karya visual belum dapat dimuat saat ini.");
    }
  }

  /* ---------------------------------------------------------
     4. BAHAN TERBARU
     --------------------------------------------------------- */

  function labelTipeBahan(tipe) {
    const label = { rangkuman: "Rangkuman", modul: "Modul", pdf: "PDF" };
    return label[tipe] || tipe;
  }

  async function muatBahanTerbaru() {
    const list = document.getElementById("materialList");
    if (!list) return;

    try {
      const data = await ambilData("data/bahan.json");
      const bahan = (data.bahan || []).slice(0, LIMIT.bahan);

      if (!bahan.length) {
        tampilkanPesanKosong(list, "Belum ada bahan untuk ditampilkan.");
        return;
      }

      list.innerHTML = bahan.map((b) => `
        <li class="material-item">
          <span class="material-tag">${escapeHTML(labelTipeBahan(b.tipe))}</span>
          <span class="material-title">${escapeHTML(b.judul)}</span>
          <a class="material-link" href="${escapeHTML(b.tautan || "#")}">Buka</a>
        </li>
      `).join("");
    } catch (err) {
      console.error("[JAZMI] Gagal memuat Bahan Terbaru:", err);
      tampilkanPesanKosong(list, "Bahan terbaru belum dapat dimuat saat ini.");
    }
  }

  /* ---------------------------------------------------------
     5. KHUTBAH JUMAT TERBARU
     --------------------------------------------------------- */

  function buatTautanWhatsApp(pesan) {
    // Website hanya MEMBUKA WhatsApp dengan pesan yang sudah
    // disiapkan — tidak ada pesan yang dikirim secara otomatis.
    const teks = `${pesan}\n${window.location.href}`;
    return `https://wa.me/?text=${encodeURIComponent(teks)}`;
  }

  async function muatKhutbahTerbaru() {
    const card = document.getElementById("khutbahCard");
    if (!card) return;

    try {
      const data = await ambilData("data/khutbah.json");
      const daftar = data.khutbah || [];
      if (!daftar.length) throw new Error("Data khutbah kosong.");

      // Terbaru berdasarkan tanggal.
      daftar.sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal));
      const k = daftar[0];

      const tombolBaca = k.tautanBaca
        ? `<a class="chip-btn" href="${escapeHTML(k.tautanBaca)}">Baca</a>` : "";
      const tombolPdf = k.tautanPdf
        ? `<a class="chip-btn" href="${escapeHTML(k.tautanPdf)}">PDF</a>` : "";
      const tombolWa = k.pesanWhatsApp
        ? `<a class="chip-btn chip-btn-whatsapp" href="${escapeHTML(buatTautanWhatsApp(k.pesanWhatsApp))}" target="_blank" rel="noopener">Bagikan ke WhatsApp</a>`
        : "";

      card.innerHTML = `
        <h3 class="khutbah-title">${escapeHTML(k.judul)}</h3>
        <p class="khutbah-date">${escapeHTML(formatTanggalIndonesia(k.tanggal))}</p>
        <div class="khutbah-actions">
          ${tombolBaca}${tombolPdf}${tombolWa}
        </div>
      `;
    } catch (err) {
      console.error("[JAZMI] Gagal memuat Khutbah Jumat Terbaru:", err);
      tampilkanPesanKosong(card, "Khutbah Jumat terbaru belum dapat dimuat saat ini.");
    }
  }

  /* ---------------------------------------------------------
     6. KAJIAN & TAKLIM
     --------------------------------------------------------- */

  async function muatKajianTerbaru() {
    const card = document.getElementById("kajianCard");
    if (!card) return;

    try {
      const data = await ambilData("data/kajian.json");
      const daftar = data.kajian || [];
      if (!daftar.length) throw new Error("Data kajian kosong.");

      daftar.sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal));
      const kj = daftar[0];
      const output = kj.output || {};

      const labelOutput = [
        ["rangkuman", "Rangkuman"],
        ["pdf", "PDF"],
        ["video", "Video"],
        ["audio", "Audio"]
      ];

      const outputHTML = labelOutput.map(([key, label]) => {
        const aktif = !!output[key];
        return `<span class="${aktif ? "" : "is-off"}">${escapeHTML(label)}</span>`;
      }).join("");

      card.innerHTML = `
        <h3 class="kajian-title">${escapeHTML(kj.judul)}</h3>
        <p class="kajian-date">${escapeHTML(formatTanggalIndonesia(kj.tanggal))}</p>
        <p class="kajian-desc">${escapeHTML(kj.deskripsi || "")}</p>
        <div class="kajian-outputs">${outputHTML}</div>
        <a class="chip-btn" href="${escapeHTML(kj.tautan || "#")}">Lihat Kajian</a>
      `;
    } catch (err) {
      console.error("[JAZMI] Gagal memuat Kajian & Taklim:", err);
      tampilkanPesanKosong(card, "Kajian &amp; Taklim terbaru belum dapat dimuat saat ini.");
    }
  }

  /* ---------------------------------------------------------
     7. VIDEO PILIHAN, VIDEO TERBARU & AUDIO TERBARU
     (satu sumber data — data/media.json — diambil sekali)
     --------------------------------------------------------- */

  const IKON_PLAY = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>`;

  // Ambil ID video dari berbagai bentuk URL YouTube yang lazim
  // dipakai (youtu.be/ID, youtube.com/watch?v=ID, .../embed/ID).
  // Mengembalikan null kalau bentuknya tidak dikenali, supaya
  // pemanggil bisa jatuh kembali ke perilaku lama (buka tab baru).
  function ambilIdYoutube(url) {
    if (!url) return null;
    try {
      const u = new URL(url, window.location.href);
      const host = u.hostname.replace(/^www\./, "");
      if (host === "youtu.be") {
        return u.pathname.split("/").filter(Boolean)[0] || null;
      }
      if (host === "youtube.com" || host === "m.youtube.com") {
        if (u.searchParams.get("v")) return u.searchParams.get("v");
        const cocok = u.pathname.match(/\/(?:embed|shorts)\/([^/?]+)/);
        if (cocok) return cocok[1];
      }
    } catch (e) {
      // URL tidak valid — biarkan kembalikan null di bawah.
    }
    return null;
  }

  // Kartu video dipakai bersama oleh Video Pilihan & Video Terbaru.
  // Berupa <div>, BUKAN <a> lagi — supaya klik pada tombol putar
  // tidak berpindah halaman, melainkan memuat pemutar YouTube
  // langsung di tempat (lihat initPemutarVideoInline). Thumbnail
  // diambil otomatis dari ID video (img.i.ytimg.com), bukan lagi
  // placeholder gradasi — gradasi tetap jadi latar cadangan kalau
  // ID tidak berhasil dikenali dari tautan.
  function buatKartuVideo(v, kelasEkstra) {
    const id = ambilIdYoutube(v.tautanYoutube);
    const kelas = kelasEkstra ? `video-card ${kelasEkstra}` : "video-card";
    const thumbImg = id
      ? `<img class="video-thumb-img" src="https://i.ytimg.com/vi/${id}/hqdefault.jpg" alt="" loading="lazy">`
      : "";

    return `
      <div class="${kelas}" data-youtube-id="${escapeHTML(id || "")}" data-youtube-url="${escapeHTML(v.tautanYoutube || "#")}">
        <div class="video-thumb">
          ${thumbImg}
          <button type="button" class="video-play" aria-label="Putar video: ${escapeHTML(v.judul)}">${IKON_PLAY}</button>
        </div>
        <p class="video-title">${escapeHTML(v.judul)}</p>
      </div>
    `;
  }

  // Video Pilihan: video yang ditandai "unggulan": true pada
  // media.json. TIDAK mengeluarkan video itu dari daftar Video
  // Terbaru — keduanya membaca array "video" yang sama, cuma
  // disaring/diurutkan berbeda. Kalau tidak ada yang ditandai
  // unggulan, panel ini disembunyikan dengan rapi (tidak ada
  // kotak kosong).
  function renderVideoPilihan(daftarVideo) {
    const container = document.getElementById("videoPilihan");
    if (!container) return;

    const pilihan = daftarVideo
      .filter((v) => v && v.unggulan === true)
      .sort((a, b) => kunciUrutanItem(b) - kunciUrutanItem(a))
      .slice(0, LIMIT.videoPilihan);

    if (!pilihan.length) {
      container.hidden = true;
      container.innerHTML = "";
      return;
    }

    container.hidden = false;
    const kartu = pilihan.map((v) => buatKartuVideo(v, "video-card-pilihan")).join("");

    container.innerHTML = `
      <p class="video-pilihan-label">Video Pilihan</p>
      <div class="video-pilihan-grid">${kartu}</div>
    `;
  }

  // Video Terbaru: SELURUH video, diurutkan tanggal terbaru dulu,
  // dipotong ke LIMIT.video — termasuk video yang juga tampil di
  // Video Pilihan.
  function renderVideoTerbaru(daftarVideo) {
    const grid = document.getElementById("videoGrid");
    if (!grid) return;

    const video = daftarVideo
      .slice()
      .sort((a, b) => kunciUrutanItem(b) - kunciUrutanItem(a))
      .slice(0, LIMIT.video);

    if (!video.length) {
      tampilkanPesanKosong(grid, "Belum ada video untuk ditampilkan.");
      return;
    }

    grid.innerHTML = video.map((v) => buatKartuVideo(v)).join("");
  }

  // Klik tombol putar → ganti isi .video-thumb dengan <iframe>
  // YouTube yang autoplay, TANPA pindah halaman. Satu delegasi
  // event di document supaya berlaku untuk kartu Video Pilihan
  // maupun Video Terbaru, termasuk yang dirender ulang nanti.
  // Kalau ID video tidak berhasil dikenali dari tautan, jatuh
  // kembali ke perilaku lama: buka tautan YouTube di tab baru.
  function initPemutarVideoInline() {
    document.addEventListener("click", (e) => {
      const tombol = e.target.closest(".video-play");
      if (!tombol) return;
      const kartu = tombol.closest(".video-card");
      const thumb = kartu ? kartu.querySelector(".video-thumb") : null;
      if (!kartu || !thumb) return;

      e.preventDefault();

      const id = kartu.getAttribute("data-youtube-id");
      if (!id) {
        const url = kartu.getAttribute("data-youtube-url");
        if (url && url !== "#") window.open(url, "_blank", "noopener");
        return;
      }

      const judulEl = kartu.querySelector(".video-title");
      const judul = judulEl ? judulEl.textContent : "Video";
      thumb.innerHTML = `<iframe src="https://www.youtube.com/embed/${id}?autoplay=1&rel=0" title="${escapeHTML(judul)}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;
    });
  }

  const TINGGI_BAR_AUDIO = ["40%", "70%", "100%", "55%", "30%"];

  function buatBarsAudio() {
    return TINGGI_BAR_AUDIO
      .map((tinggi) => `<span style="height:${tinggi}"></span>`)
      .join("");
  }

  function renderAudioTerbaru(daftarAudio) {
    const list = document.getElementById("audioList");
    if (!list) return;

    const audio = daftarAudio
      .slice()
      .sort((a, b) => kunciUrutanItem(b) - kunciUrutanItem(a))
      .slice(0, LIMIT.audio);

    if (!audio.length) {
      tampilkanPesanKosong(list, "Belum ada audio untuk ditampilkan.");
      return;
    }

    list.innerHTML = audio.map((a) => `
      <li class="audio-item">
        <a class="audio-play" href="${escapeHTML(a.tautanSoundcloud || "#")}" target="_blank" rel="noopener" aria-label="Dengarkan di SoundCloud">${IKON_PLAY}</a>
        <span class="audio-bars" aria-hidden="true">${buatBarsAudio()}</span>
        <span class="audio-title">${escapeHTML(a.judul)}</span>
      </li>
    `).join("");
  }

  async function muatVideoDanAudio() {
    const videoPilihanEl = document.getElementById("videoPilihan");
    const videoGridEl = document.getElementById("videoGrid");
    const audioListEl = document.getElementById("audioList");

    let data;
    try {
      data = await ambilData("data/media.json");
    } catch (err) {
      console.error("[JAZMI] Gagal memuat data/media.json (Video Pilihan, Video Terbaru, Audio Terbaru):", err);
      if (videoPilihanEl) { videoPilihanEl.hidden = true; videoPilihanEl.innerHTML = ""; }
      tampilkanPesanKosong(videoGridEl, "Video terbaru belum dapat dimuat saat ini.");
      tampilkanPesanKosong(audioListEl, "Audio terbaru belum dapat dimuat saat ini.");
      return;
    }

    try {
      renderVideoPilihan(data.video || []);
    } catch (err) {
      console.error("[JAZMI] Gagal menampilkan Video Pilihan:", err);
    }
    try {
      renderVideoTerbaru(data.video || []);
    } catch (err) {
      console.error("[JAZMI] Gagal menampilkan Video Terbaru:", err);
      tampilkanPesanKosong(videoGridEl, "Video terbaru belum dapat dimuat saat ini.");
    }
    try {
      renderAudioTerbaru(data.audio || []);
    } catch (err) {
      console.error("[JAZMI] Gagal menampilkan Audio Terbaru:", err);
      tampilkanPesanKosong(audioListEl, "Audio terbaru belum dapat dimuat saat ini.");
    }
  }

  /* ---------------------------------------------------------
     9. NAVIGASI MOBILE
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
     10. REVEAL ON SCROLL (halus, menghormati prefers-reduced-motion)
     --------------------------------------------------------- */

  function initRevealOnScroll() {
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const target = document.querySelectorAll(
      ".identity, .bait-harian, .section, .explore"
    );

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
    initPemutarVideoInline();

    // Setiap bagian dimuat independen — jika satu gagal,
    // bagian lain tetap tampil (lihat try/catch di masing-masing).
    muatBaitHarian();
    muatArtikelTerbaru();
    muatKaryaVisual();
    muatBahanTerbaru();
    muatKhutbahTerbaru();
    muatKajianTerbaru();
    muatVideoDanAudio();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
