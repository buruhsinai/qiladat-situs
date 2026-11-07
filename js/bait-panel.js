/* =========================================================
   JAZMI — HOME
   bait-panel.js

   Menggantikan sumber data "Bait Syair Hari Ini" dari
   data/syair.json (demo) menjadi Bank Syair sungguhan di
   /syair-bank/*.json (lihat SYAIR_SCHEMA.md v2).

   Prinsip:
   - BANK SUMBER ≠ KONTEN PUBLIK: hanya bait berstatus
     "dipublikasikan" yang boleh terpilih tampil di panel ini.
   - Pemilihan tetap memakai mekanisme yang sudah ada di
     main.js (pilihBaitHariIni): deterministik berdasarkan
     tanggal lokal pengunjung, bukan localStorage/per-kunjungan.
     Karena indeksnya adalah (hariLokal % jumlahBait), setiap
     bait pasti tampil tepat sekali sebelum ada bait yang
     berulang — satu putaran penuh = sejumlah hari sebanyak
     total bait yang dipublikasikan.
   - Menambah bait baru ke Bank cukup dengan menambah file
     /syair-bank/kitab-[id].json baru ke daftar KITAB_FILES di
     bawah — tidak perlu mengubah index.html atau logika ini.

   Tidak mengubah pilihBaitHariIni() di main.js — file ini
   berjalan setelah main.js, mengambil alih pengisian elemen
   #baitCard dengan sumber data Bank yang sudah difilter.
   ========================================================= */

(function () {
  "use strict";

  // Daftar file kitab di Bank Syair. Tambah baris baru di sini
  // setiap kali ada kitab baru masuk Bank (lihat SYAIR_INGESTION_SOP.md
  // Tahap 18) — tidak perlu ubah apa pun yang lain di file ini.
  var KITAB_FILES = [
    "syair-bank/kitab-almusid-adabalmasjid.json",
    "syair-bank/kitab-manair-alisad.json",
    "syair-bank/diwan-amr-bin-kultsum.json",
    "syair-bank/diwan-aus-bin-hajar.json",
    "syair-bank/diwan-penyair-lain-001.json"
  ];

  function pilihIndeksHariIni(panjang) {
    var sekarang = new Date();
    var hariLokal = Math.floor(
      Date.UTC(sekarang.getFullYear(), sekarang.getMonth(), sekarang.getDate()) / 86400000
    );
    return hariLokal % panjang;
  }

  // Jumlah motif latar yang tersedia (lihat assets/motif/*.svg dan
  // kelas .bait-bg-1/2/3 di css/style.css). Menambah motif baru
  // cukup dengan menambah aset SVG + kelas CSS, lalu naikkan angka
  // ini — tidak perlu ubah logika di bawah.
  var JUMLAH_LATAR = 3;

  // Latar bergilir per hari, independen dari siklus pemilihan bait
  // (jangka waktunya berbeda: bait bisa puluhan hari, latar hanya
  // sejumlah JUMLAH_LATAR hari sebelum berulang). Dipanggil dari
  // tampilkanBaitDariBank() supaya kartu selalu tampil dengan latar
  // "hari ini" begitu halaman dimuat, dan dibaca ulang oleh
  // js/bait-export.js sebagai pilihan default sebelum diunduh.
  function terapkanLatarHariIni() {
    var elCard = document.getElementById("baitCard");
    if (!elCard) return;
    var sekarang = new Date();
    var hariLokal = Math.floor(
      Date.UTC(sekarang.getFullYear(), sekarang.getMonth(), sekarang.getDate()) / 86400000
    );
    var nomorLatar = (hariLokal % JUMLAH_LATAR) + 1;
    for (var i = 1; i <= JUMLAH_LATAR; i++) {
      elCard.classList.remove("bait-bg-" + i);
    }
    elCard.classList.add("bait-bg-" + nomorLatar);
  }

  // Diekspos supaya js/bait-export.js bisa membaca latar "hari ini"
  // tanpa duplikasi logika tanggal.
  window.JAZMI_pilihLatarHariIni = terapkanLatarHariIni;

  async function ambilJSON(path) {
    var res = await fetch(path, { cache: "no-store" });
    if (!res.ok) throw new Error("Gagal memuat " + path + " (status " + res.status + ")");
    return res.json();
  }

  // Gabungkan seluruh file kitab jadi satu daftar BAIT publik,
  // masing-masing sudah dilengkapi info penyair & kitab induknya.
  async function muatBaitPublikDariBank() {
    var hasil = await Promise.allSettled(KITAB_FILES.map(ambilJSON));

    var baitPublik = [];

    hasil.forEach(function (r, i) {
      if (r.status !== "fulfilled") {
        console.error("[JAZMI] Gagal memuat Bank Syair:", KITAB_FILES[i], r.reason);
        return;
      }
      var data = r.value;
      var kitabList = data.kitab || [];
      var penyairList = data.penyair || [];

      var kitabById = {};
      kitabList.forEach(function (k) { kitabById[k.id] = k; });
      var penyairById = {};
      penyairList.forEach(function (p) { penyairById[p.id] = p; });

      (data.bait || []).forEach(function (b) {
        // Gate: hanya bait yang benar-benar sudah dipublikasikan
        // yang boleh masuk daftar seleksi panel HOME.
        if (b.status !== "dipublikasikan") return;

        var kitab = kitabById[b.kitabId] || {};
        var penyair = penyairById[b.penyairId] || null;

        var namaPenyair = penyair
          ? (penyair.namaLatin || penyair.namaArab || "")
          : (b.jenis === "syahid" ? "Penyair lain (syahid)" : "");

        baitPublik.push({
          arab: b.teksArab || "",
          terjemahan: b.terjemahan || "",
          penyair: namaPenyair,
          sumber: kitab.judulLatin || kitab.judulArab || "",
          tautanDetail: (b.outputTerkait && b.outputTerkait.halamanDetail) || "#"
        });
      });
    });

    return baitPublik;
  }

  async function tampilkanBaitDariBank() {
    var elArab = document.getElementById("baitArab");
    var elTerjemahan = document.getElementById("baitTerjemahan");
    var elPenyair = document.getElementById("baitPenyair");
    var elSumber = document.getElementById("baitSumber");
    var elTautan = document.getElementById("baitTautan");
    var elNote = document.querySelector(".bait-note");

    try {
      var baitPublik = await muatBaitPublikDariBank();
      if (!baitPublik.length) {
        throw new Error("Belum ada bait berstatus dipublikasikan di Bank Syair.");
      }

      var idx = pilihIndeksHariIni(baitPublik.length);
      var bait = baitPublik[idx];

      if (elArab) elArab.textContent = bait.arab;
      if (elTerjemahan) elTerjemahan.textContent = bait.terjemahan;
      if (elPenyair) elPenyair.textContent = bait.penyair;

      var pemisah = document.querySelector(".bait-meta-sep");
      if (bait.sumber) {
        if (elSumber) elSumber.textContent = bait.sumber;
        if (pemisah) pemisah.style.display = "";
      } else {
        if (elSumber) elSumber.textContent = "";
        if (pemisah) pemisah.style.display = "none";
      }

      // Selalu menuju Penjelasan Hari Ini di dien/syair.html — sama
      // seperti fallback demo di js/main.js (lihat catatan di sana).
      // bait.tautanDetail (outputTerkait.halamanDetail) tidak lagi
      // dipakai untuk tombol ini.
      if (elTautan) elTautan.href = "dien/syair.html#penjelasan-hari-ini";

      // Bank sudah aktif — catatan "contoh/demo" di bawah kartu
      // tidak relevan lagi begitu ada bait sungguhan yang tampil.
      if (elNote) elNote.style.display = "none";

      terapkanLatarHariIni();
    } catch (err) {
      console.error("[JAZMI] bait-panel.js gagal memuat dari Bank Syair:", err);
      // Sengaja TIDAK menyentuh isi kartu di sini — biarkan hasil
      // muatBaitHarian() (data/syair.json, demo) di main.js tetap
      // tampil sebagai fallback, supaya panel tidak pernah kosong.
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", tampilkanBaitDariBank);
  } else {
    tampilkanBaitDariBank();
  }
})();
