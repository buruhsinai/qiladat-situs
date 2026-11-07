/* =========================================================
   JAZMI — Lapisan Tag Relasi Otomatis Antar-Artikel
   js/relasi-artikel.js

   Modul bersama (helper), dipakai oleh artikel/js/detail.js.
   Tidak memuat main.js, berdiri sendiri seperti modul lain di
   proyek ini (lihat js/main.js, artikel/js/artikel.js).

   TUJUAN
   Menghitung maksimal 5 "tag" relasi antar-artikel — SEPENUHNYA
   LIVE dari data/articles.json yang sedang aktif, TIDAK disimpan
   di data. Karena situs ini statis tanpa proses build, ini satu-
   satunya cara agar tag otomatis mengikuti setiap kali
   articles.json diedit/ditambah entri baru: begitu artikel baru
   ditambahkan, artikel-artikel lama yang terkait langsung
   mendapat tag yang sesuai pada kunjungan berikutnya, tanpa perlu
   disunting ulang secara manual.

   ATURAN TAG (maksimal 5, lihat HANDOFF-TAG-LABEL-ARTIKEL.md §0):
   1. "sebelumnya"  — artikel sebelumnya dalam seri yang sama
                       (hanya ada bila artikel ini BUKAN yang
                       pertama dalam serinya).
   2. "selanjutnya" — artikel berikutnya dalam seri yang sama
                       (hanya ada bila seri masih berlanjut
                       setelah artikel ini).
   3. "serial-lain" — 1 artikel dari SERI LAIN tapi ranah/kategori
                       yang sama (lintas-seri, satu ranah).
   4-5. "ranah-lain" — masing-masing 1 artikel dari SATU ranah lain
                       (dari total 3 ranah: Dien/Kesehatan/Sains),
                       jadi maksimal 2 tag jenis ini.

   Urutan dalam seri memakai kunciUrutanArtikel() — logika yang
   SAMA seperti di artikel/js/artikel.js dan artikel/js/detail.js
   (tanggal asli bila ada, kalau tidak field "urutan"). Disalin
   ulang di sini karena situs ini tidak punya mekanisme import/
   bundling lintas file — lihat catatan yang sama di modul lain.
   ========================================================= */

(function (global) {
  "use strict";

  // Pemetaan kategori artikel -> ranah (dipakai untuk tag lintas-ranah
  // dan tag lintas-seri-satu-ranah). Ranah "Dien" menaungi dua kategori
  // (Agama, Pendidikan) karena keduanya konten ranah Dien di JAZMI.
  const PETA_RANAH = {
    Agama: "Dien",
    Pendidikan: "Dien",
    Sains: "Sains",
    Astronomi: "Sains",
    Kesehatan: "Kesehatan",
  };
  const SEMUA_RANAH = ["Dien", "Kesehatan", "Sains"];

  function petakanRanah(kategori) {
    return PETA_RANAH[kategori] || null;
  }

  // Sama persis dengan kunciUrutanArtikel() di artikel/js/artikel.js —
  // tanggal asli (makin baru makin besar), kalau kosong pakai field
  // "urutan" + offset jauh ke depan.
  const URUTAN_OFFSET = new Date("2099-01-01T00:00:00").getTime();
  function kunciUrutanArtikel(a) {
    if (a && a.tanggal) {
      const t = new Date(a.tanggal + "T00:00:00").getTime();
      if (!isNaN(t)) return t;
    }
    if (a && typeof a.urutan === "number") return URUTAN_OFFSET + a.urutan;
    return 0;
  }

  /**
   * Menghitung maksimal 5 tag relasi otomatis untuk satu artikel.
   * @param {Object} artikelIni - artikel yang sedang dibuka (detail).
   * @param {Object[]} semuaArtikel - seluruh isi data/articles.json.
   * @returns {{tipe: string, artikel: Object}[]} maksimal 5 entri.
   */
  function hitungTagRelasiArtikel(artikelIni, semuaArtikel) {
    if (!artikelIni || !Array.isArray(semuaArtikel)) return [];

    const hasil = [];
    const terpakai = new Set([artikelIni.id]);

    // --- 1 & 2: sebelumnya / selanjutnya dalam seri yang sama ---
    // Seri diidentifikasi lewat kesamaan field "seri" (harus terisi
    // dan sama persis). Artikel tanpa "seri" dianggap berdiri sendiri
    // (tidak dapat tag sebelumnya/selanjutnya).
    if (artikelIni.seri) {
      const seriSama = semuaArtikel
        .filter((a) => a.seri === artikelIni.seri)
        .sort((a, b) => kunciUrutanArtikel(a) - kunciUrutanArtikel(b));

      const idx = seriSama.findIndex((a) => a.id === artikelIni.id);
      if (idx > 0) {
        hasil.push({ tipe: "sebelumnya", artikel: seriSama[idx - 1] });
        terpakai.add(seriSama[idx - 1].id);
      }
      if (idx !== -1 && idx < seriSama.length - 1) {
        hasil.push({ tipe: "selanjutnya", artikel: seriSama[idx + 1] });
        terpakai.add(seriSama[idx + 1].id);
      }
    }

    const ranahIni = petakanRanah(artikelIni.kategori);

    // --- 3: lintas-seri, masih satu ranah ---
    // Kandidat: ranah sama, TAPI bukan dari seri yang sama dengan
    // artikel ini (baik seri lain maupun tanpa seri), dan belum
    // terpakai di atas. Dipilih yang paling baru (kunciUrutanArtikel
    // terbesar) supaya hasilnya stabil & relevan.
    if (ranahIni) {
      const kandidatSatuRanah = semuaArtikel
        .filter((a) => !terpakai.has(a.id))
        .filter((a) => petakanRanah(a.kategori) === ranahIni)
        .filter((a) => (a.seri || null) !== (artikelIni.seri || null))
        .sort((a, b) => kunciUrutanArtikel(b) - kunciUrutanArtikel(a));

      if (kandidatSatuRanah.length) {
        hasil.push({ tipe: "serial-lain", artikel: kandidatSatuRanah[0] });
        terpakai.add(kandidatSatuRanah[0].id);
      }
    }

    // --- 4-5: lintas-ranah (2 ranah lain) ---
    const ranahLain = SEMUA_RANAH.filter((r) => r !== ranahIni);
    ranahLain.forEach((r) => {
      const kandidat = semuaArtikel
        .filter((a) => !terpakai.has(a.id))
        .filter((a) => petakanRanah(a.kategori) === r)
        .sort((a, b) => kunciUrutanArtikel(b) - kunciUrutanArtikel(a));

      if (kandidat.length) {
        hasil.push({ tipe: "ranah-lain", artikel: kandidat[0] });
        terpakai.add(kandidat[0].id);
      }
    });

    return hasil.slice(0, 5);
  }

  // Label tampilan untuk tiap tipe tag (dipakai UI, boleh disesuaikan
  // tanpa mengubah logika perhitungan di atas).
  const LABEL_TIPE_TAG = {
    sebelumnya: "← Sebelumnya dalam seri",
    selanjutnya: "Selanjutnya dalam seri →",
    "serial-lain": "Seri lain, ranah sama",
    "ranah-lain": "Ranah lain",
  };

  global.JazmiRelasi = {
    petakanRanah,
    kunciUrutanArtikel,
    hitungTagRelasiArtikel,
    LABEL_TIPE_TAG,
  };
})(window);
