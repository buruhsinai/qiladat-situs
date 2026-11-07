/* =========================================================
   JAZMI — ALAT (menu baru)
   alat.js
   Pola nav mobile & reveal-on-scroll disalin PERSIS dari
   produk-global.js (kontrak 4.2 / 3.3). Pola fetch data +
   state loading/error/empty disalin dari pola yang sama
   (showState) yang dipakai produk-global.js.

   MODEL DATA (sesuai permintaan user — fleksibilitas tinggi):
   Seluruh isi & komposisi kategori Alat dibaca dari SATU file
   data/alat-manifest.json saat halaman dimuat. Memindahkan
   sebuah alat ke kategori lain, menambah, atau menghapus alat
   TIDAK memerlukan membangun ulang HTML apa pun -- cukup ubah
   entri di alat-manifest.json (dan pindahkan/tambah/hapus file
   HTML alatnya) langsung di repository (mis. GitHub). Jumlah
   total & jumlah per kategori dihitung ulang otomatis dari isi
   manifest setiap kali halaman dibuka, bukan angka yang
   ditulis tetap di HTML.

   Halaman kategori (/alat/<slug>/index.html) tidak perlu tahu
   namanya sendiri lewat teks yang ditulis manual -- slug-nya
   dideteksi otomatis dari URL, sehingga file index.html di
   SETIAP folder kategori bisa identik (template yang sama).
   ========================================================= */
(function () {
  "use strict";

  const MANIFEST_URL_DARI_ROOT_ALAT = "data/alat-manifest.json";

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

  function titleCaseDariSlug(slug) {
    return slug
      .split("-")
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
  }

  // Mendeteksi slug kategori dari path URL, mis:
  // /alat/fisika/  atau /alat/fisika/index.html -> "fisika"
  // Mengembalikan null jika berada persis di /alat/ (halaman utama).
  function deteksiSlugKategoriDariPath() {
    const parts = window.location.pathname.split("/").filter(Boolean);
    const i = parts.indexOf("alat");
    if (i === -1) return null;
    const sisanya = parts.slice(i + 1).filter((p) => p !== "index.html");
    if (sisanya.length === 0) return null;
    return sisanya[0];
  }

  // Alat terkunci ("akses": "login" di manifest) tidak lagi berada sebagai file
  // publik di repo. Tautannya diarahkan ke pemuat /alat/buka.html?id=<nama-file-tanpa-.html>,
  // yang meminta login lalu mengambil HTML-nya dari penyimpanan privat Supabase.
  // Akses bawaan seluruh alat dibaca dari "akses_default" di manifest ("login" atau "publik").
  // Satu alat bisa menyimpang dengan menulis "akses": "publik" / "login" pada entrinya.
  let AKSES_DEFAULT = "publik";

  function alatTerkunci(t) {
    return !!t && (t.akses || AKSES_DEFAULT) === "login";
  }

  // id alat = nama file tanpa .html, dibuat aman untuk nama objek di penyimpanan:
  // huruf kecil, angka, tanda hubung. Harus SAMA dengan yang dipakai skrip unggah-alat.py.
  function idAlatDariFile(file) {
    return String(file || "")
      .replace(/\.html?$/i, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  // Tautan absolut menuju sebuah alat (dipakai oleh pencarian).
  function urlAlatAbsolut(t) {
    if (alatTerkunci(t)) {
      return "/alat/buka.html?id=" + encodeURIComponent(idAlatDariFile(t.file));
    }
    return "/alat/" + encodeURIComponent(t.kategori) + "/" + encodeURI(t.file);
  }

  // Tautan dari dalam halaman kategori (/alat/<slug>/): relatif untuk alat biasa.
  function urlAlatDiKategori(t) {
    if (alatTerkunci(t)) return urlAlatAbsolut(t);
    return encodeURI(t.file);
  }

  const LENCANA_TERKUNCI = ' <span class="tool-lock" title="Khusus anggota">\uD83D\uDD12 Anggota</span>';

  function showState(prefix, id) {
    ["Loading", "Error", "Empty"].forEach((s) => {
      const el = document.getElementById(prefix + "State" + s);
      if (el) el.hidden = "State" + s !== id;
    });
  }

  /* ---------------------------------------------------------
     1. NAVIGASI MOBILE (disalin persis dari produk-global.js)
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
    nav.querySelectorAll("a").forEach((a) => a.addEventListener("click", () => tutupMenu()));
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") tutupMenu(); });

    let lebarSebelumnya = window.innerWidth;
    window.addEventListener("resize", () => {
      const lebarSekarang = window.innerWidth;
      if (lebarSekarang >= 860 && lebarSebelumnya < 860) tutupMenu();
      lebarSebelumnya = lebarSekarang;
    });
  }

  /* ---------------------------------------------------------
     2. REVEAL ON SCROLL (disalin persis dari produk-global.js)
     --------------------------------------------------------- */

  function initRevealOnScroll() {
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const target = document.querySelectorAll(".domain-hero, .section");
    if (prefersReduced || !("IntersectionObserver" in window)) return;

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
     3. AMBIL MANIFEST (satu kali, dipakai kedua jenis halaman)
     --------------------------------------------------------- */

  function ambilManifest() {
    const slug = deteksiSlugKategoriDariPath();
    const url = slug ? "../" + MANIFEST_URL_DARI_ROOT_ALAT : MANIFEST_URL_DARI_ROOT_ALAT;
    return fetch(url).then((res) => {
      if (!res.ok) throw new Error("Gagal memuat manifest: " + res.status);
      return res.json();
    }).then((manifest) => {
      AKSES_DEFAULT = (manifest && manifest.akses_default) || "publik";
      return manifest;
    });
  }

  // Mengelompokkan tools per kategori & menghitung jumlahnya,
  // menjaga urutan kategori_meta lalu menambahkan kategori baru
  // (yang muncul di tools tapi belum ada di kategori_meta) di akhir.
  function kelompokkanKategori(manifest) {
    const tools = manifest.tools || [];
    const meta = manifest.kategori_meta || [];

    const metaBySlug = {};
    meta.forEach((m) => { metaBySlug[m.slug] = m; });

    const jumlahPerSlug = {};
    tools.forEach((t) => {
      jumlahPerSlug[t.kategori] = (jumlahPerSlug[t.kategori] || 0) + 1;
    });

    const urutanSlug = [];
    meta.forEach((m) => { if (jumlahPerSlug[m.slug]) urutanSlug.push(m.slug); });
    Object.keys(jumlahPerSlug).sort().forEach((slug) => {
      if (urutanSlug.indexOf(slug) === -1) urutanSlug.push(slug);
    });

    return urutanSlug.map((slug) => ({
      slug: slug,
      nama: (metaBySlug[slug] && metaBySlug[slug].nama) || titleCaseDariSlug(slug),
      deskripsi: (metaBySlug[slug] && metaBySlug[slug].deskripsi) || "",
      jumlah: jumlahPerSlug[slug] || 0
    }));
  }

  /* ---------------------------------------------------------
     4. RENDER HALAMAN UTAMA ALAT (/alat/index.html)
     --------------------------------------------------------- */

  function renderHalamanUtamaAlat(manifest) {
    const totalEl = document.getElementById("statTotalAlat");
    const totalKategoriEl = document.getElementById("statTotalKategori");
    const grid = document.getElementById("kategoriGrid");
    if (!grid) return; // bukan halaman utama Alat

    showState("kategori", "StateLoading");

    const totalTools = (manifest.tools || []).length;
    const kelompok = kelompokkanKategori(manifest);

    if (totalEl) totalEl.textContent = totalTools;
    if (totalKategoriEl) totalKategoriEl.textContent = kelompok.length;

    if (totalTools === 0) {
      showState("kategori", "StateEmpty");
      return;
    }

    grid.innerHTML = kelompok.map((k) => (
      '<a class="kategori-card" href="/alat/' + encodeURIComponent(k.slug) + '/">' +
        '<div class="kategori-card-head">' +
          '<h3 class="kategori-card-title">' + escapeHTML(k.nama) + '</h3>' +
          '<span class="kategori-card-count">' + k.jumlah + ' alat</span>' +
        '</div>' +
        '<p class="kategori-card-desc">' + escapeHTML(k.deskripsi) + '</p>' +
        '<span class="kategori-card-link">Buka kategori →</span>' +
      '</a>'
    )).join("");

    grid.hidden = false;
    showState("kategori", "StateLoaded");
  }

  /* ---------------------------------------------------------
     4b. PENCARIAN ALAT (hanya di /alat/)
     Mencari sepotong kata pada judul alat di manifest. Tidak peka
     huruf besar/kecil, tanda hubung dianggap spasi, dan jika
     kata kunci lebih dari satu, SEMUA kata harus ada di judul.
     --------------------------------------------------------- */

  function normalisasiCari(str) {
    return String(str || "")
      .toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[-_]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function sorotKata(teks, tokens) {
    const aman = escapeHTML(teks);
    const pola = tokens
      .filter(Boolean)
      .sort((a, b) => b.length - a.length)
      .map((t) => escapeHTML(t).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    if (!pola.length) return aman;
    return aman.replace(new RegExp("(" + pola.join("|") + ")", "gi"), "<mark>$1</mark>");
  }

  function initPencarianAlat(manifest) {
    const input = document.getElementById("cariInput");
    const hasil = document.getElementById("cariHasil");
    const status = document.getElementById("cariStatus");
    const clearBtn = document.getElementById("cariClear");
    if (!input || !hasil || !status) return; // bukan halaman utama Alat

    const namaKategori = {};
    (manifest.kategori_meta || []).forEach((m) => { namaKategori[m.slug] = m.nama; });

    const indeks = (manifest.tools || []).map((t) => ({
      judul: t.judul || t.file,
      file: t.file,
      kategori: t.kategori,
      akses: t.akses,
      kunci: normalisasiCari(t.judul || t.file)
    }));

    function cari() {
      const mentah = input.value;
      if (clearBtn) clearBtn.hidden = mentah.length === 0;

      const tokens = normalisasiCari(mentah).split(" ").filter(Boolean);
      if (tokens.length === 0) {
        hasil.hidden = true;
        hasil.innerHTML = "";
        status.textContent = "";
        return;
      }

      const cocok = indeks.filter((t) => tokens.every((k) => t.kunci.indexOf(k) !== -1));

      // Urutan: yang judulnya diawali kata pertama lebih dulu, lalu abjad.
      cocok.sort((a, b) => {
        const aw = a.kunci.indexOf(tokens[0]) === 0 ? 0 : 1;
        const bw = b.kunci.indexOf(tokens[0]) === 0 ? 0 : 1;
        return aw - bw || a.judul.localeCompare(b.judul, "id");
      });

      if (cocok.length === 0) {
        hasil.innerHTML = "";
        hasil.hidden = true;
        status.textContent = "Tidak ada alat yang namanya memuat \u201c" + mentah.trim() + "\u201d.";
        return;
      }

      status.textContent = cocok.length + " alat ditemukan.";
      hasil.innerHTML = cocok.map((t) => (
        '<li class="cari-item"><a href="' + urlAlatAbsolut(t) + '">' +
          '<span class="cari-item-judul">' + sorotKata(t.judul, tokens) + (alatTerkunci(t) ? LENCANA_TERKUNCI : '') + '</span>' +
          '<span class="cari-item-kategori">' + escapeHTML(namaKategori[t.kategori] || titleCaseDariSlug(t.kategori)) + '</span>' +
        '</a></li>'
      )).join("");
      hasil.hidden = false;
    }

    input.disabled = false;
    input.addEventListener("input", cari);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && input.value) { input.value = ""; cari(); }
    });
    if (clearBtn) {
      clearBtn.addEventListener("click", () => { input.value = ""; cari(); input.focus(); });
    }

    // Mendukung tautan langsung, mis. /alat/?cari=kurir
    const q = new URLSearchParams(window.location.search).get("cari");
    if (q) { input.value = q; cari(); }
  }

  /* ---------------------------------------------------------
     5. RENDER HALAMAN KATEGORI (/alat/<slug>/index.html)
     --------------------------------------------------------- */

  function renderHalamanKategori(manifest, slug) {
    const daftar = document.getElementById("toolList");
    if (!daftar) return; // bukan halaman kategori

    showState("tool", "StateLoading");

    const meta = (manifest.kategori_meta || []).find((m) => m.slug === slug);
    const toolsKategori = (manifest.tools || []).filter((t) => t.kategori === slug);

    const namaEl = document.getElementById("kategoriNama");
    const descEl = document.getElementById("kategoriDeskripsi");
    const breadcrumbEl = document.getElementById("breadcrumbKategori");
    const jumlahEl = document.getElementById("statJumlahKategori");
    const titleTag = document.querySelector("title");

    const nama = (meta && meta.nama) || titleCaseDariSlug(slug);
    const deskripsi = (meta && meta.deskripsi) || "";

    if (namaEl) namaEl.textContent = nama;
    if (descEl) descEl.textContent = deskripsi;
    if (breadcrumbEl) breadcrumbEl.textContent = nama;
    if (jumlahEl) jumlahEl.textContent = toolsKategori.length;
    if (titleTag) titleTag.textContent = nama + " — Alat — JAZMI";

    if (toolsKategori.length === 0) {
      showState("tool", "StateEmpty");
      return;
    }

    daftar.innerHTML = toolsKategori
      .slice()
      .sort((a, b) => a.judul.localeCompare(b.judul, "id"))
      .map((t) => (
        '<li class="tool-item"><a href="' + urlAlatDiKategori(t) + '">' + escapeHTML(t.judul) + (alatTerkunci(t) ? LENCANA_TERKUNCI : '') + '</a></li>'
      ))
      .join("");

    daftar.hidden = false;
    showState("tool", "StateLoaded");
  }

  /* ---------------------------------------------------------
     INIT
     --------------------------------------------------------- */
  document.addEventListener("DOMContentLoaded", function () {
    initNavigasiMobile();
    initRevealOnScroll();

    const slug = deteksiSlugKategoriDariPath();

    ambilManifest()
      .then((manifest) => {
        if (slug) {
          renderHalamanKategori(manifest, slug);
        } else {
          renderHalamanUtamaAlat(manifest);
          initPencarianAlat(manifest);
        }
      })
      .catch(() => {
        if (slug) showState("tool", "StateError");
        else showState("kategori", "StateError");
      });
  });
})();
