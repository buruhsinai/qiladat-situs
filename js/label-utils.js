/* =========================================================
   JAZMI — Lapisan Label Taksonomi Artikel
   js/label-utils.js

   Modul bersama (helper), dipakai oleh artikel/js/detail.js dan
   arsip/label/label.js. Berdiri sendiri, tidak memuat main.js.

   TUJUAN
   Label adalah lapisan taksonomi topik yang LEBIH UMUM daripada
   tag relasi (lihat js/relasi-artikel.js) — tidak terikat struktur
   seri/ranah, tujuannya membantu orang menemukan "pembicaraan"
   (topik) yang sama lintas seluruh artikel, apa pun ranahnya.

   Daftar label disimpan di data/labels.json (murni DATA, bukan
   .js/.css, sesuai permintaan user) dan akan diperbarui sendiri
   oleh user dari waktu ke waktu. Pencocokan artikel ↔ label
   dilakukan OTOMATIS lewat pemindaian kata kunci pada judul +
   ringkasan + isi artikel — BUKAN penandaan manual per artikel —
   supaya begitu user mengirim labels.json versi baru, seluruh
   situs langsung menyesuaikan tanpa perlu menyunting
   articles.json satu per satu.
   ========================================================= */

(function (global) {
  "use strict";

  async function ambilData(path) {
    const res = await fetch(path, { cache: "no-store" });
    if (!res.ok) {
      throw new Error(`Gagal memuat ${path} (status ${res.status})`);
    }
    return res.json();
  }

  /**
   * Memuat daftar label dari data/labels.json.
   * @param {string} path - path relatif ke labels.json dari halaman pemanggil.
   * @returns {Promise<Object[]>} array objek label ({id, nama, slug, kataKunci}).
   */
  async function muatLabel(path) {
    const data = await ambilData(path);
    return Array.isArray(data.label) ? data.label : [];
  }

  // Gabungan teks artikel yang dipindai untuk pencocokan kata kunci:
  // judul + ringkasan + seluruh paragraf isi (bila ada), huruf kecil
  // semua supaya pencocokan tidak peka huruf besar/kecil.
  function teksPencarianArtikel(artikel) {
    const bagian = [artikel.judul || "", artikel.ringkasan || ""];
    if (Array.isArray(artikel.isi)) bagian.push(artikel.isi.join(" "));
    return bagian.join(" ").toLowerCase();
  }

  // Satu label cocok dengan satu artikel bila SALAH SATU kata kunci
  // labelnya muncul sebagai substring di teks pencarian artikel.
  function artikelCocokDenganLabel(artikel, label) {
    if (!artikel || !label || !Array.isArray(label.kataKunci)) return false;
    const teks = teksPencarianArtikel(artikel);
    return label.kataKunci.some((kw) => {
      const k = String(kw || "").trim().toLowerCase();
      return k && teks.includes(k);
    });
  }

  /**
   * Semua label yang cocok untuk satu artikel.
   * @param {Object} artikel
   * @param {Object[]} daftarLabel
   * @returns {Object[]} label yang cocok (subset daftarLabel).
   */
  function cariLabelUntukArtikel(artikel, daftarLabel) {
    if (!artikel || !Array.isArray(daftarLabel)) return [];
    return daftarLabel.filter((lbl) => artikelCocokDenganLabel(artikel, lbl));
  }

  /**
   * Semua artikel yang cocok untuk satu label.
   * @param {Object} label
   * @param {Object[]} semuaArtikel
   * @returns {Object[]} artikel yang cocok (subset semuaArtikel).
   */
  function cariArtikelUntukLabel(label, semuaArtikel) {
    if (!label || !Array.isArray(semuaArtikel)) return [];
    return semuaArtikel.filter((a) => artikelCocokDenganLabel(a, label));
  }

  function cariLabelBerdasarkanSlug(daftarLabel, slug) {
    if (!Array.isArray(daftarLabel) || !slug) return null;
    return daftarLabel.find((lbl) => lbl.slug === slug) || null;
  }

  global.JazmiLabel = {
    muatLabel,
    cariLabelUntukArtikel,
    cariArtikelUntukLabel,
    cariLabelBerdasarkanSlug,
    artikelCocokDenganLabel,
  };
})(window);
