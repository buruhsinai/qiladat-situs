/* JAZMI — konfigurasi toko. Aman dipublikasikan (jangan taruh kunci rahasia di sini).
   Url dan kunci Supabase dibaca dari /js/auth-config.js (sudah ada di situs). */
window.JAZMI_TOKO_CONFIG = {
  // Nomor WhatsApp admin (format internasional tanpa +), dipakai untuk konfirmasi dan tanya-jawab.
  waNomor: "6281356572588",

  // Rincian pembayaran yang tampil setelah pesanan dibuat.
  // ISI dengan data yang benar. Selama masih memuat tanda "[", rincian itu disembunyikan dan
  // pembeli diberi tahu bahwa admin akan mengirim rincian lewat WhatsApp.
  pembayaran: {
    metode: [
      { nama: "Transfer bank", rinci: "BSI · 7188886811 · a.n. Alfian Muin" },
      { nama: "PayPal (Internasional)", rinci: "a.qiller.am@gmail.com" }
    ],
    catatan: "Transfer sesuai total pesanan, lalu kirim bukti bayar lewat WhatsApp dengan menyebut kode pesanan."
  },

  // Nama fungsi unduh di Supabase (Edge Function). Kosongkan jika belum dipasang:
  // pembeli tetap menerima berkas lewat WhatsApp.
  fungsiUnduh: "unduh",

  // ID Meta Pixel (Facebook/Instagram Ads). Kosong = tidak ada pelacakan sama sekali.
  pixelId: "",

  // Alamat data produk
  dataProduk: "/produk/data/produk.json"
};
