/* =========================================================
   JAZMI — ALAT — Tombol Navigasi Kembali (melayang)
   alat-nav-kembali.js

   Disuntikkan ke SETIAP halaman alat interaktif (561 halaman)
   lewat satu baris <script src="../alat-nav-kembali.js" defer></script>
   di akhir <body>. TIDAK perlu diubah manual per halaman.

   Yang dilakukan:
   1) Membuat tombol bulat melayang (FAB) yang SELALU tampil di
      manapun pengguna scroll, berisi 3 tautan:
        - kembali ke sub-menu / kategori saat ini (dideteksi dari URL)
        - kembali ke menu utama /alat/
        - kembali ke beranda situs
   2) Nama kategori diambil otomatis dari data/alat-manifest.json
      (manifest yang sama dipakai alat.js), jadi tidak perlu di-hardcode.
   3) Semua markup & gaya dirender di dalam Shadow DOM tertutup
      agar TIDAK bentrok dengan CSS/JS unik di masing-masing dari
      561 halaman (yang masing-masing dibangun sendiri-sendiri).
   4) Jika halaman itu KEBETULAN sudah punya tombol WhatsApp
      melayang sendiri (posisi fixed, terlihat, mengarah ke wa.me),
      maka tombol ini otomatis menggeser posisinya ke ATAS tombol
      WA tersebut, di sisi yang sama, membentuk satu kelompok yang
      berdekatan -- bukan dua tombol terpisah/tertimpa.
   ========================================================= */
(function () {
  "use strict";

  var MANIFEST_RELATIF = "../data/alat-manifest.json";

  /* ---------------------------------------------------------
     1. DETEKSI LOKASI: slug kategori, path /alat/ dan /alat/<slug>/
     --------------------------------------------------------- */
  function deteksiPath() {
    var parts = window.location.pathname.split("/").filter(Boolean);
    var i = parts.indexOf("alat");
    if (i === -1) return null;
    var slug = parts[i + 1] || null;
    if (!slug || slug.toLowerCase() === "index.html") return null;
    var alatRootPath = "/" + parts.slice(0, i + 1).join("/") + "/";
    var kategoriPath = "/" + parts.slice(0, i + 2).join("/") + "/";
    return { slug: slug, alatRootPath: alatRootPath, kategoriPath: kategoriPath };
  }

  function titleCaseDariSlug(slug) {
    return slug
      .split("-")
      .filter(Boolean)
      .map(function (w) { return w.charAt(0).toUpperCase() + w.slice(1); })
      .join(" ");
  }

  /* ---------------------------------------------------------
     2. DETEKSI TOMBOL WA MELAYANG YANG SUDAH ADA DI HALAMAN
        (kurang dari 5 dari 561 halaman punya ini sejak awal)
     --------------------------------------------------------- */
  function cariTombolWaMelayang() {
    var kandidat = document.querySelectorAll("a, button, div");
    for (var k = 0; k < kandidat.length; k++) {
      var el = kandidat[k];
      var cs = window.getComputedStyle(el);
      if (cs.position !== "fixed") continue;
      if (cs.display === "none" || cs.visibility === "hidden") continue;

      var rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      // Abaikan elemen besar (kemungkinan overlay/modal layar penuh),
      // tombol melayang biasanya kecil.
      if (rect.width > 320 || rect.height > 140) continue;

      var petunjuk = (el.getAttribute("href") || "") + " " + (el.className || "") + " " + (el.id || "");
      if (/wa\.me|api\.whatsapp|whatsapp/i.test(petunjuk)) {
        return rect;
      }
    }
    return null;
  }

  /* ---------------------------------------------------------
     3. BANGUN WIDGET (Shadow DOM, terisolasi penuh)
     --------------------------------------------------------- */
  function bangunWidget(info) {
    var host = document.createElement("div");
    host.id = "jazmi-nav-kembali-host";
    host.style.all = "initial";
    document.body.appendChild(host);

    var root = host.attachShadow({ mode: "open" });

    var style = document.createElement("style");
    style.textContent = [
      ":host{ all:initial; }",
      "*{ box-sizing:border-box; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Karla,Roboto,Arial,sans-serif; }",
      ".wrap{",
      "  position:fixed; left:14px; bottom:14px; z-index:2147483000;",
      "  display:flex; flex-direction:column-reverse; align-items:flex-start; gap:8px;",
      "  padding-bottom:env(safe-area-inset-bottom,0px);",
      "}",
      ".fab{",
      "  width:50px; height:50px; border-radius:50%; border:none; cursor:pointer;",
      "  background:#1f2937; color:#F2C14E; box-shadow:0 4px 16px rgba(0,0,0,.45);",
      "  display:flex; align-items:center; justify-content:center; padding:0;",
      "  transition:transform .15s ease, background .15s ease;",
      "}",
      ".fab:hover{ background:#2b3648; transform:scale(1.05); }",
      ".fab:focus-visible{ outline:2px solid #F2C14E; outline-offset:2px; }",
      ".fab svg{ width:24px; height:24px; }",
      ".menu{",
      "  display:flex; flex-direction:column; gap:6px;",
      "  opacity:0; transform:translateY(6px) scale(.98); pointer-events:none;",
      "  transition:opacity .15s ease, transform .15s ease;",
      "}",
      ".menu.open{ opacity:1; transform:translateY(0) scale(1); pointer-events:auto; }",
      ".item{",
      "  display:flex; align-items:center; gap:9px; text-decoration:none;",
      "  background:#1f2937; color:#F5F1E6; font-size:13px; font-weight:600;",
      "  padding:10px 16px 10px 12px; border-radius:999px; white-space:nowrap;",
      "  box-shadow:0 4px 14px rgba(0,0,0,.4); border:1px solid rgba(242,193,78,.25);",
      "}",
      ".item:hover{ background:#2b3648; }",
      ".item svg{ width:16px; height:16px; flex:none; color:#F2C14E; }",
      "@media (max-width:480px){",
      "  .wrap{ left:10px; bottom:10px; }",
      "  .item{ font-size:12.5px; padding:9px 14px 9px 11px; }",
      "}"
    ].join("\n");
    root.appendChild(style);

    var wrap = document.createElement("div");
    wrap.className = "wrap";

    var svgArrow = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5"/><path d="M11 18l-6-6 6-6"/></svg>';
    var svgGrid = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>';
    var svgHome = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/></svg>';
    var svgClose = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M6 6l12 12"/><path d="M18 6L6 18"/></svg>';

    var namaKategoriAwal = titleCaseDariSlug(info.slug);

    var menu = document.createElement("div");
    menu.className = "menu";
    menu.innerHTML =
      '<a class="item" id="itemBeranda" href="/">' + svgHome + '<span>Beranda JAZMI</span></a>' +
      '<a class="item" id="itemAlat" href="' + info.alatRootPath + '">' + svgGrid + '<span>Semua Alat</span></a>' +
      '<a class="item" id="itemKategori" href="' + info.kategoriPath + '">' + svgArrow + '<span id="labelKategori">' + namaKategoriAwal + '</span></a>';

    var fab = document.createElement("button");
    fab.className = "fab";
    fab.type = "button";
    fab.setAttribute("aria-label", "Buka navigasi kembali");
    fab.setAttribute("aria-expanded", "false");
    fab.innerHTML = svgArrow;

    wrap.appendChild(menu);
    wrap.appendChild(fab);
    root.appendChild(wrap);

    var terbuka = false;
    function buka() {
      terbuka = true;
      menu.classList.add("open");
      fab.setAttribute("aria-expanded", "true");
      fab.innerHTML = svgClose;
    }
    function tutup() {
      terbuka = false;
      menu.classList.remove("open");
      fab.setAttribute("aria-expanded", "false");
      fab.innerHTML = svgArrow;
    }
    fab.addEventListener("click", function (e) {
      e.stopPropagation();
      terbuka ? tutup() : buka();
    });
    document.addEventListener("click", function (e) {
      if (terbuka && !host.contains(e.target)) tutup();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && terbuka) { tutup(); fab.focus(); }
    });

    // Perbarui nama kategori dari manifest resmi begitu berhasil dimuat
    fetch(MANIFEST_RELATIF)
      .then(function (res) { if (!res.ok) throw new Error("gagal"); return res.json(); })
      .then(function (manifest) {
        var meta = (manifest.kategori_meta || []).filter(function (m) { return m.slug === info.slug; })[0];
        if (meta && meta.nama) {
          var label = root.getElementById("labelKategori");
          if (label) label.textContent = meta.nama;
        }
      })
      .catch(function () { /* diamkan; label fallback tetap dipakai */ });

    // Jika halaman ini sudah punya tombol WA melayang sendiri,
    // dekatkan widget ini tepat di atasnya (kelompok yang sama, sisi yang sama).
    var rectWa = cariTombolWaMelayang();
    if (rectWa) {
      var jarakDariBawah = Math.max(14, window.innerHeight - rectWa.top + 10);
      wrap.style.bottom = jarakDariBawah + "px";
      // Jika tombol WA itu ternyata di sisi kanan, ikut pindah ke kanan
      // supaya benar-benar berkelompok, bukan menyilang layar.
      if (rectWa.left > window.innerWidth / 2) {
        wrap.style.left = "auto";
        wrap.style.right = "14px";
        wrap.style.alignItems = "flex-end";
      }
    }
  }

  function mulai() {
    var info = deteksiPath();
    if (!info) return; // bukan halaman alat kategori/tool, jangan pasang apa pun
    bangunWidget(info);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mulai);
  } else {
    mulai();
  }
})();
