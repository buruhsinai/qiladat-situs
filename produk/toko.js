/* =========================================================
   JAZMI — TOKO (toko.js)
   Keranjang, etalase, checkout, status pesanan, daftar tunggu.
   Vanilla JS, tanpa framework. Data produk dari data/produk.json.
   Supabase dimuat hanya saat dibutuhkan (checkout, status, daftar tunggu).
   Jika Supabase belum siap, pembeli tetap bisa memesan lewat WhatsApp.
   ========================================================= */
(function () {
  "use strict";

  var CFG = window.JAZMI_TOKO_CONFIG || {};
  var KEY = "jz_keranjang_v1";
  var DATA = { produk: [], map: {}, testimoni: [] };
  var SB = null; // klien Supabase (dimuat malas)
  var SUPABASE_CDN = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js";

  /* ---------- util ---------- */
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  }
  function rupiah(n) {
    return "Rp" + String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  }
  function $(id) { return document.getElementById(id); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function simpan(k, v, sesi) {
    try { (sesi ? sessionStorage : localStorage).setItem(k, JSON.stringify(v)); } catch (e) { /* abaikan */ }
  }
  function baca(k, d, sesi) {
    try {
      var v = (sesi ? sessionStorage : localStorage).getItem(k);
      return v ? JSON.parse(v) : d;
    } catch (e) { return d; }
  }
  function klem(n, a, b) { return Math.max(a, Math.min(b, n)); }

  /* ---------- data produk ---------- */
  function muatData() {
    return fetch(CFG.dataProduk || "/produk/data/produk.json", { cache: "no-cache" })
      .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
      .then(function (j) {
        DATA.produk = Array.isArray(j.produk) ? j.produk : [];
        DATA.testimoni = Array.isArray(j.testimoni) ? j.testimoni : [];
        DATA.map = {};
        DATA.produk.forEach(function (p) { DATA.map[p.id] = p; });
        return DATA;
      });
  }
  function bisaDibeli(p) {
    return !!p && p.status === "tersedia" && typeof p.harga === "number" && p.harga > 0;
  }
  function maksQty(p) { return p.tipe === "fisik" ? klem(parseInt(p.maks_qty, 10) || 5, 1, 20) : 1; }
  function jenisLabel(p) {
    return p.tipe === "paket" ? "Paket e-book" : p.tipe === "fisik" ? "Buku cetak" : "E-book";
  }
  function hargaNormal(id) {
    var p = DATA.map[id];
    if (!p || !p.isi_paket) return null;
    var total = 0;
    for (var i = 0; i < p.isi_paket.length; i++) {
      var q = DATA.map[p.isi_paket[i]];
      if (!q || typeof q.harga !== "number") return null;
      total += q.harga;
    }
    return total;
  }

  /* ---------- sumber kunjungan (iklan) ---------- */
  function sumber() {
    var q = new URLSearchParams(location.search), d = {};
    ["utm_source", "utm_campaign", "utm_content"].forEach(function (k) { if (q.get(k)) d[k] = q.get(k); });
    if (!d.utm_source && q.get("fbclid")) d.utm_source = "facebook";
    if (Object.keys(d).length) simpan("jz_src", d, true);
    else d = baca("jz_src", {}, true);
    return d;
  }
  function tagSumber() {
    var d = sumber();
    if (!d.utm_source) return "";
    return " [sumber: " + d.utm_source + (d.utm_campaign ? " / " + d.utm_campaign : "") + (d.utm_content ? " / " + d.utm_content : "") + "]";
  }
  function tandaiWA() {
    var tag = tagSumber();
    if (!tag) return;
    $$('a[href^="https://wa.me/"]').forEach(function (a) {
      try {
        var u = new URL(a.href), t = u.searchParams.get("text") || "";
        if (t.indexOf("[sumber:") !== -1) return;
        u.searchParams.set("text", t + tag);
        a.href = u.toString();
      } catch (e) { /* abaikan */ }
    });
  }
  function linkWA(teks) {
    return "https://wa.me/" + (CFG.waNomor || "") + "?text=" + encodeURIComponent(teks + tagSumber());
  }

  /* ---------- Meta Pixel (opsional, mati jika pixelId kosong) ---------- */
  function mulaiPixel() {
    if (!CFG.pixelId || window.fbq) return;
    /* eslint-disable */
    !function (f, b, e, v, n, t, s) {
      if (f.fbq) return; n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); };
      if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = "2.0"; n.queue = [];
      t = b.createElement(e); t.async = !0; t.src = v; s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s);
    }(window, document, "script", "https://connect.facebook.net/en_US/fbevents.js");
    /* eslint-enable */
    window.fbq("init", CFG.pixelId);
    window.fbq("track", "PageView");
  }
  function pixel(nama, param) {
    try { if (CFG.pixelId && window.fbq) window.fbq("track", nama, param || {}); } catch (e) { /* abaikan */ }
  }

  /* ---------- keranjang ---------- */
  function bacaKeranjang() {
    var mentah = baca(KEY, []);
    if (!Array.isArray(mentah)) mentah = [];
    var hasil = [];
    mentah.forEach(function (it) {
      var p = DATA.map[it && it.id];
      if (!p || !bisaDibeli(p)) return;
      if (hasil.some(function (x) { return x.id === p.id; })) return;
      hasil.push({ id: p.id, qty: klem(parseInt(it.qty, 10) || 1, 1, maksQty(p)) });
    });
    return hasil;
  }
  function simpanKeranjang(k) {
    simpan(KEY, k);
    perbaruiLencana();
    document.dispatchEvent(new Event("jz:keranjang"));
  }
  function jumlahMentah() {
    var m = baca(KEY, []);
    if (!Array.isArray(m)) return 0;
    return m.reduce(function (s, it) { return s + (parseInt(it && it.qty, 10) || 0); }, 0);
  }
  function perbaruiLencana() {
    var n = DATA.produk.length ? bacaKeranjang().reduce(function (s, it) { return s + it.qty; }, 0) : jumlahMentah();
    $$(".cart-count").forEach(function (e) { e.textContent = n; e.hidden = n === 0; });
    $$(".cart-link").forEach(function (a) {
      a.setAttribute("aria-label", "Keranjang belanja, " + n + " item");
    });
  }
  function tambah(id) {
    var p = DATA.map[id];
    if (!p) return { ok: false, pesan: "Produk tidak ditemukan." };
    if (!bisaDibeli(p)) return { ok: false, pesan: "Produk ini belum bisa dipesan." };
    var k = bacaKeranjang(), ganti = false;
    var paketAda = k.filter(function (it) {
      var q = DATA.map[it.id];
      return q.tipe === "paket" && (q.isi_paket || []).indexOf(id) > -1;
    })[0];
    if (paketAda) return { ok: true, sudah: true, pesan: "Sudah termasuk dalam " + DATA.map[paketAda.id].nama + "." };
    if (p.tipe === "paket") {
      var sebelum = k.length;
      k = k.filter(function (it) { return (p.isi_paket || []).indexOf(it.id) === -1; });
      ganti = k.length !== sebelum;
    }
    var ada = k.filter(function (it) { return it.id === id; })[0];
    if (ada) {
      if (ada.qty >= maksQty(p)) return { ok: true, sudah: true, pesan: "Sudah ada di keranjang." };
      ada.qty += 1;
    } else {
      k.push({ id: id, qty: 1 });
    }
    simpanKeranjang(k);
    pixel("AddToCart", { content_ids: [id], content_type: "product", value: p.harga, currency: "IDR" });
    return { ok: true, pesan: ganti ? "Judul satuan diganti dengan paket." : "Ditambahkan ke keranjang." };
  }
  function ubahQty(id, qty) {
    var p = DATA.map[id], k = bacaKeranjang();
    k.forEach(function (it) { if (it.id === id && p) it.qty = klem(qty, 1, maksQty(p)); });
    simpanKeranjang(k);
  }
  function hapus(id) {
    simpanKeranjang(bacaKeranjang().filter(function (it) { return it.id !== id; }));
  }
  function kosongkan() { simpanKeranjang([]); }

  function saranPaket(k) {
    var ids = k.map(function (i) { return i.id; }), hasil = null;
    DATA.produk.forEach(function (p) {
      if (p.tipe !== "paket" || !bisaDibeli(p) || ids.indexOf(p.id) > -1) return;
      var isi = p.isi_paket || [];
      var dalam = isi.filter(function (x) { return ids.indexOf(x) > -1; });
      if (!dalam.length) return;
      var normal = hargaNormal(p.id);
      if (normal == null || normal <= p.harga) return;
      var sudah = dalam.reduce(function (s, x) { return s + (DATA.map[x].harga || 0); }, 0);
      var kand = { paket: p, dalam: dalam, selisih: p.harga - sudah, hemat: normal - p.harga, jumlah: isi.length };
      if (!hasil || kand.dalam.length > hasil.dalam.length) hasil = kand;
    });
    return hasil;
  }
  function hitung() {
    var k = bacaKeranjang(), baris = [], subtotal = 0, fisik = false, digital = false;
    k.forEach(function (it) {
      var p = DATA.map[it.id], sub = p.harga * it.qty;
      subtotal += sub;
      if (p.tipe === "fisik") fisik = true; else digital = true;
      baris.push({ p: p, qty: it.qty, sub: sub });
    });
    return { baris: baris, subtotal: subtotal, fisik: fisik, digital: digital, saran: saranPaket(k) };
  }

  /* ---------- tampilan bersama ---------- */
  function coverMini(p) {
    var c = p.cover || {};
    return '<span class="cover-mini cover--' + esc(c.warna || "zamrud") + '" aria-hidden="true"><span>' + esc(c.arab || "") + "</span></span>";
  }
  function toast(pesan, tautan, label) {
    var t = $("tokoToast");
    if (!t) {
      t = document.createElement("div");
      t.id = "tokoToast"; t.className = "toko-toast"; t.setAttribute("role", "status"); t.setAttribute("aria-live", "polite");
      document.body.appendChild(t);
    }
    t.innerHTML = "<span>" + esc(pesan) + "</span>" + (tautan ? ' <a href="' + esc(tautan) + '">' + esc(label || "Lihat") + "</a>" : "");
    t.classList.add("tampil");
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { t.classList.remove("tampil"); }, 4200);
  }

  function isiHarga() {
    $$("[data-harga]").forEach(function (e) {
      var p = DATA.map[e.getAttribute("data-harga")];
      if (p && typeof p.harga === "number") e.textContent = rupiah(p.harga);
    });
    $$("[data-harga-normal]").forEach(function (e) {
      var n = hargaNormal(e.getAttribute("data-harga-normal"));
      if (n != null) e.textContent = rupiah(n);
    });
    $$("[data-hemat]").forEach(function (e) {
      var id = e.getAttribute("data-hemat"), n = hargaNormal(id), p = DATA.map[id];
      if (n != null && p && typeof p.harga === "number") e.textContent = rupiah(n - p.harga);
    });
    $$("[data-persen]").forEach(function (e) {
      var id = e.getAttribute("data-persen"), n = hargaNormal(id), p = DATA.map[id];
      if (n && p && typeof p.harga === "number") e.textContent = Math.round((n - p.harga) / n * 100) + "%";
    });
  }

  function klikAksi(e) {
    var b = e.target.closest ? e.target.closest("[data-beli],[data-tambah]") : null;
    if (!b) return;
    e.preventDefault();
    var langsung = b.hasAttribute("data-beli");
    var id = b.getAttribute(langsung ? "data-beli" : "data-tambah");
    T.siap.then(function () {
      var r = tambah(id);
      if (!r.ok) { toast(r.pesan); return; }
      if (langsung) { location.href = "/produk/keranjang/"; return; }
      toast(r.pesan, "/produk/keranjang/", "Lihat keranjang");
    }).catch(function () {
      toast("Data produk belum termuat. Muat ulang halaman atau pesan lewat WhatsApp.");
    });
  }

  function navMobile() {
    if (!document.body.hasAttribute("data-toko-nav")) return;
    var t = $("navToggle"), n = $("primaryNav");
    if (!t || !n) return;
    function set(o) {
      n.classList.toggle("is-open", o);
      t.setAttribute("aria-expanded", o ? "true" : "false");
      t.setAttribute("aria-label", o ? "Tutup menu navigasi" : "Buka menu navigasi");
    }
    t.addEventListener("click", function () { set(t.getAttribute("aria-expanded") !== "true"); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") set(false); });
  }

  /* ---------- Supabase (malas) ---------- */
  function siapkanSupabase() {
    if (SB) return Promise.resolve(SB);
    var A = window.JAZMI_AUTH || {};
    if (!A.url || !A.anonKey || A.url.indexOf("GANTI-") !== -1) return Promise.reject(new Error("konfigurasi"));
    return new Promise(function (ok, gagal) {
      function buat() {
        try { SB = window.supabase.createClient(A.url, A.anonKey); ok(SB); } catch (e) { gagal(e); }
      }
      if (window.supabase && window.supabase.createClient) { buat(); return; }
      var s = document.createElement("script");
      s.src = SUPABASE_CDN; s.async = true;
      s.onload = buat; s.onerror = function () { gagal(new Error("cdn")); };
      document.head.appendChild(s);
    });
  }
  function pesanGalat(err, cadangan) {
    var m = err && err.message ? String(err.message) : "";
    if (!m || m.length > 220 || /JWT|PGRST|fetch|Failed|NetworkError|schema cache|function public/i.test(m)) return cadangan;
    return m;
  }

  /* ---------- etalase ---------- */
  function initEtalase() {
    var bar = $("etalaseFilter");
    if (!bar) return;
    var kartu = $$(".toko-card");
    function terapkan(jenis) {
      kartu.forEach(function (k) { k.hidden = !(jenis === "semua" || k.getAttribute("data-jenis") === jenis); });
      $$(".filter-btn", bar).forEach(function (b) { b.setAttribute("aria-pressed", b.getAttribute("data-filter") === jenis ? "true" : "false"); });
      var ada = kartu.some(function (k) { return !k.hidden; });
      var kosong = $("etalaseKosong");
      if (kosong) kosong.hidden = ada;
    }
    bar.addEventListener("click", function (e) {
      var b = e.target.closest(".filter-btn");
      if (b) terapkan(b.getAttribute("data-filter"));
    });
  }

  /* ---------- keranjang & checkout ---------- */
  var HASIL_PESANAN = null;

  function normalisasiWA(s) {
    var d = String(s || "").replace(/\D+/g, "");
    if (d.indexOf("0") === 0) d = "62" + d.slice(1);
    else if (d.indexOf("8") === 0) d = "62" + d;
    return d;
  }
  function pesanWA(h, f) {
    var t = "Assalamu'alaikum, saya ingin memesan:\n";
    h.baris.forEach(function (b) { t += "- " + b.p.nama + " (" + jenisLabel(b.p) + ") x" + b.qty + " = " + rupiah(b.sub) + "\n"; });
    t += "Subtotal: " + rupiah(h.subtotal) + (h.fisik ? " (belum termasuk ongkos kirim)" : "") + "\n";
    if (f && f.nama) t += "Nama: " + f.nama + "\n";
    if (f && f.alamatTeks) t += "Alamat: " + f.alamatTeks + "\n";
    return t.trim();
  }
  function bacaForm() {
    function v(id) { var e = $(id); return e ? e.value.trim() : ""; }
    var alamat = { jalan: v("fJalan"), kota: v("fKota"), provinsi: v("fProvinsi"), kodepos: v("fKodepos") };
    return {
      nama: v("fNama"), email: v("fEmail"), whatsapp: normalisasiWA(v("fWA")),
      alamat: alamat, catatan: v("fCatatan"), jebakan: v("fWebsite"),
      setuju: !!($("fSetuju") && $("fSetuju").checked),
      alamatTeks: [alamat.jalan, alamat.kota, alamat.provinsi, alamat.kodepos].filter(Boolean).join(", ")
    };
  }
  function validasi(f, fisik) {
    if (f.nama.length < 2) return ["fNama", "Isi nama Anda (minimal 2 huruf)."];
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email)) return ["fEmail", "Email belum valid. Email dipakai untuk mengecek status pesanan."];
    if (f.whatsapp.length < 9 || f.whatsapp.length > 15) return ["fWA", "Nomor WhatsApp belum valid."];
    if (fisik) {
      if (f.alamat.jalan.length < 5) return ["fJalan", "Isi alamat lengkap (jalan, nomor, RT/RW)."];
      if (f.alamat.kota.length < 2) return ["fKota", "Isi kota atau kabupaten."];
      if (f.alamat.provinsi.length < 2) return ["fProvinsi", "Isi provinsi."];
      if (!/^\d{5}$/.test(f.alamat.kodepos)) return ["fKodepos", "Kode pos harus 5 angka."];
    }
    if (!f.setuju) return ["fSetuju", "Centang persetujuan penggunaan data untuk melanjutkan."];
    return null;
  }

  function renderKeranjang() {
    var root = $("keranjangRoot");
    if (!root) return;
    var h = hitung();
    var kosong = h.baris.length === 0;
    $("kKosong").hidden = !kosong;
    $("kIsi").hidden = kosong;
    $("kRingkas").hidden = kosong;
    if (kosong) return;

    $("kList").innerHTML = h.baris.map(function (b) {
      var p = b.p;
      var qty = p.tipe === "fisik"
        ? '<div class="k-qty" role="group" aria-label="Jumlah ' + esc(p.nama) + '">' +
          '<button type="button" data-qty="' + esc(p.id) + '" data-delta="-1" aria-label="Kurangi"' + (b.qty <= 1 ? " disabled" : "") + ">−</button>" +
          "<span>" + b.qty + "</span>" +
          '<button type="button" data-qty="' + esc(p.id) + '" data-delta="1" aria-label="Tambah"' + (b.qty >= maksQty(p) ? " disabled" : "") + ">+</button></div>"
        : "";
      return '<li class="k-item">' + coverMini(p) +
        '<div class="k-info"><a href="' + esc(p.halaman || ("/produk/" + p.id + "/")) + '">' + esc(p.nama) + "</a>" +
        '<p class="k-seri">' + esc(jenisLabel(p)) + (p.seri ? " · " + esc(p.seri) : "") + "</p>" + qty + "</div>" +
        '<div class="k-harga">' + rupiah(b.sub) + "</div>" +
        '<button type="button" class="k-hapus" data-hapus="' + esc(p.id) + '" aria-label="Hapus ' + esc(p.nama) + ' dari keranjang">Hapus</button></li>';
    }).join("");

    var sr = h.saran, box = $("kSaran");
    if (sr) {
      var teks = sr.selisih <= 0
        ? "Ganti dengan <strong>" + esc(sr.paket.nama) + "</strong> dan hemat " + rupiah(-sr.selisih) + " dari keranjang sekarang."
        : "Tambah <strong>" + rupiah(sr.selisih) + "</strong> untuk mendapat seluruh " + sr.jumlah + " judul di <strong>" + esc(sr.paket.nama) + "</strong> (hemat " + rupiah(sr.hemat) + " dibanding beli satuan).";
      box.innerHTML = '<div class="k-saran"><p>' + teks + '</p><button type="button" class="btn btn-line" data-pakai-paket="' + esc(sr.paket.id) + '">Pakai paket</button></div>';
    } else { box.innerHTML = ""; }

    $("kAlamat").hidden = !h.fisik;
    $("kSubtotal").textContent = rupiah(h.subtotal);
    $("kOngkirBaris").hidden = !h.fisik;
    $("kTotalLabel").textContent = h.fisik ? "Total sementara" : "Total";
    $("kTotal").textContent = rupiah(h.subtotal);
    $("kCatatanRingkas").textContent = h.fisik
      ? "Ongkos kirim dihitung admin sesuai alamat dan diberitahukan lewat WhatsApp sebelum Anda membayar."
      : "Produk digital: tidak ada ongkos kirim. Unduhan aktif setelah pembayaran dikonfirmasi.";
    var wa = $("kWA");
    if (wa) wa.href = linkWA(pesanWA(h, bacaForm()));
  }

  function tampilGalat(id, pesan) {
    var g = $("kGalat");
    if (g) { g.textContent = pesan || ""; g.hidden = !pesan; }
    var f = id && $(id);
    if (f && f.focus) f.focus();
  }

  function rincianBayar() {
    var p = CFG.pembayaran || {}, metode = p.metode || [];
    var lengkap = metode.length && metode.every(function (m) { return String(m.rinci || "").indexOf("[") === -1; });
    if (!lengkap) {
      return '<p>Rincian pembayaran akan dikirim admin lewat WhatsApp setelah Anda mengonfirmasi pesanan.</p>';
    }
    return "<ul class=\"bayar-list\">" + metode.map(function (m) {
      return "<li><strong>" + esc(m.nama) + "</strong><span>" + esc(m.rinci) + "</span></li>";
    }).join("") + "</ul>" + (p.catatan ? '<p class="bayar-catatan">' + esc(p.catatan) + "</p>" : "");
  }

  function tampilSukses(hasil, f, h) {
    $("kIsi").hidden = true; $("kRingkas").hidden = true; $("kKosong").hidden = true;
    var s = $("kSukses");
    s.hidden = false;
    var h1 = document.querySelector("main h1");
    if (h1) h1.textContent = "Pesanan Anda";
    var konfirm = "Assalamu'alaikum, saya sudah memesan. Kode pesanan: " + hasil.kode + ". Total: " + rupiah(hasil.total) + (hasil.butuh_ongkir ? " (belum termasuk ongkir)" : "") + ".";
    s.innerHTML =
      '<div class="sukses-kartu">' +
      '<p class="sukses-label">Pesanan diterima</p>' +
      '<h2>Terima kasih, ' + esc(f.nama) + ".</h2>" +
      '<p>Simpan kode pesanan ini. Kode dan email Anda dipakai untuk mengecek status dan mengunduh e-book.</p>' +
      '<div class="kode-box"><strong id="kodeTeks">' + esc(hasil.kode) + '</strong><button type="button" class="btn btn-line" id="salinKode">Salin kode</button></div>' +
      '<dl class="sukses-rinci"><div><dt>' + (hasil.butuh_ongkir ? "Subtotal" : "Total") + "</dt><dd>" + rupiah(hasil.total) + "</dd></div>" +
      (hasil.butuh_ongkir ? "<div><dt>Ongkos kirim</dt><dd>Dihitung admin, diberitahukan lewat WhatsApp</dd></div>" : "") + "</dl>" +
      '<h3>Langkah berikutnya</h3><ol class="langkah">' +
      "<li><strong>Bayar.</strong> " + (hasil.butuh_ongkir ? "Tunggu admin mengirim total akhir termasuk ongkir, lalu bayar." : "Lakukan pembayaran sesuai rincian di bawah.") + "</li>" +
      "<li><strong>Konfirmasi.</strong> Kirim bukti bayar lewat WhatsApp dengan menyebut kode pesanan.</li>" +
      "<li><strong>" + (h.digital ? "Unduh / terima." : "Terima.") + "</strong> " +
      (h.digital ? "Setelah pembayaran dikonfirmasi, buka halaman Status Pesanan untuk mengunduh." : "Admin mengirim buku dan memberi nomor resi.") + "</li></ol>" +
      '<h3>Cara pembayaran</h3>' + rincianBayar() +
      '<div class="btn-row">' +
      '<a class="btn btn-solid" target="_blank" rel="noopener noreferrer" href="' + esc(linkWA(konfirm)) + '">Konfirmasi lewat WhatsApp</a>' +
      '<a class="btn btn-line" href="/produk/status/?kode=' + encodeURIComponent(hasil.kode) + '">Cek status pesanan</a></div></div>';
    var salin = $("salinKode");
    if (salin) salin.addEventListener("click", function () {
      try { navigator.clipboard.writeText(hasil.kode).then(function () { salin.textContent = "Tersalin"; }); } catch (e) { salin.textContent = "Salin manual"; }
    });
    s.scrollIntoView({ behavior: "smooth", block: "start" });
    if (s.focus) { s.setAttribute("tabindex", "-1"); s.focus({ preventScroll: true }); }
  }

  function kirimPesanan(e) {
    e.preventDefault();
    var h = hitung();
    if (!h.baris.length) return;
    var f = bacaForm(), g = validasi(f, h.fisik);
    if (f.jebakan) { // bot: pura-pura sukses, tidak mengirim apa pun
      tampilSukses({ kode: "JZ-00000000", total: h.subtotal, butuh_ongkir: h.fisik }, f, h); return;
    }
    if (g) { tampilGalat(g[0], g[1]); return; }
    tampilGalat(null, "");
    var tombol = $("kKirim"), semula = tombol.textContent;
    tombol.disabled = true; tombol.textContent = "Mengirim…";
    pixel("InitiateCheckout", { value: h.subtotal, currency: "IDR", num_items: h.baris.length });
    siapkanSupabase().then(function (sb) {
      return sb.rpc("buat_pesanan", {
        p_nama: f.nama, p_email: f.email, p_whatsapp: f.whatsapp,
        p_alamat: h.fisik ? f.alamat : null, p_catatan: f.catatan || null,
        p_items: h.baris.map(function (b) { return { id: b.p.id, qty: b.qty }; }),
        p_sumber: sumber(), p_jebakan: f.jebakan || null
      });
    }).then(function (r) {
      if (r.error) throw r.error;
      HASIL_PESANAN = r.data;
      simpan("jz_pesanan_terakhir", { kode: r.data.kode, email: f.email }, true);
      pixel("Lead", { value: h.subtotal, currency: "IDR" });
      kosongkan();
      tampilSukses(r.data, f, h);
    }).catch(function (err) {
      tombol.disabled = false; tombol.textContent = semula;
      var cad = "Pesanan belum bisa dikirim. Coba lagi, atau pesan lewat WhatsApp dengan tombol di bawah.";
      tampilGalat(null, err && err.message === "konfigurasi" ? cad : pesanGalat(err, cad));
    });
  }

  function initKeranjang() {
    var root = $("keranjangRoot");
    if (!root) return;
    root.addEventListener("click", function (e) {
      var t = e.target.closest("button");
      if (!t) return;
      if (t.hasAttribute("data-hapus")) hapus(t.getAttribute("data-hapus"));
      else if (t.hasAttribute("data-qty")) {
        var id = t.getAttribute("data-qty"), it = bacaKeranjang().filter(function (x) { return x.id === id; })[0];
        if (it) ubahQty(id, it.qty + parseInt(t.getAttribute("data-delta"), 10));
      } else if (t.hasAttribute("data-pakai-paket")) {
        var r = tambah(t.getAttribute("data-pakai-paket"));
        toast(r.pesan);
      }
    });
    $("kForm").addEventListener("submit", kirimPesanan);
    $("kForm").addEventListener("input", function () {
      var wa = $("kWA"), h = hitung();
      if (wa && h.baris.length) wa.href = linkWA(pesanWA(h, bacaForm()));
    });
    document.addEventListener("jz:keranjang", renderKeranjang);
    renderKeranjang();
    var h = hitung();
    if (h.baris.length) pixel("ViewCart", { value: h.subtotal, currency: "IDR" });
  }

  /* ---------- status pesanan & unduhan ---------- */
  var LANGKAH = [
    { k: "menunggu", t: "Menunggu pembayaran" },
    { k: "lunas", t: "Pembayaran dikonfirmasi" },
    { k: "dikirim", t: "Dikirim" },
    { k: "selesai", t: "Selesai" }
  ];
  function renderStatus(d) {
    var box = $("sHasil");
    var idx = d.status === "batal" ? -1 : Math.max(0, LANGKAH.map(function (l) { return l.k; }).indexOf(d.status));
    var langkah = d.status === "batal"
      ? '<p class="status-batal">Pesanan ini dibatalkan.</p>'
      : '<ol class="stepper">' + LANGKAH.filter(function (l) {
        return d.ada_fisik || (l.k !== "dikirim");
      }).map(function (l, i, arr) {
        var kelas = LANGKAH.map(function (x) { return x.k; }).indexOf(l.k) <= idx ? "selesai" : "";
        return '<li class="' + kelas + '"><span class="titik" aria-hidden="true"></span>' + esc(l.t) + "</li>";
      }).join("") + "</ol>";
    var items = (d.items || []).map(function (i) {
      return "<li><span>" + esc(i.nama) + " × " + esc(i.qty) + "</span><span>" + rupiah(i.harga * i.qty) + "</span></li>";
    }).join("");
    var total = d.butuh_ongkir && !(d.ongkir > 0)
      ? "<div><dt>Subtotal</dt><dd>" + rupiah(d.subtotal) + "</dd></div><div><dt>Ongkos kirim</dt><dd>Menunggu kabar dari admin</dd></div>"
      : (d.ongkir > 0 ? "<div><dt>Subtotal</dt><dd>" + rupiah(d.subtotal) + "</dd></div><div><dt>Ongkos kirim</dt><dd>" + rupiah(d.ongkir) + "</dd></div>" : "") +
        "<div><dt>Total</dt><dd>" + rupiah(d.total) + "</dd></div>";
    var bayar = d.status === "menunggu"
      ? "<h3>Cara pembayaran</h3>" + rincianBayar() + '<div class="btn-row"><a class="btn btn-solid" target="_blank" rel="noopener noreferrer" href="' + esc(linkWA("Assalamu'alaikum, saya ingin konfirmasi pesanan " + d.kode + ".")) + '">Konfirmasi lewat WhatsApp</a></div>'
      : "";
    var bolehUnduh = ["lunas", "dikirim", "selesai"].indexOf(d.status) > -1 && d.ada_digital;
    var unduh = bolehUnduh && CFG.fungsiUnduh
      ? '<h3>Unduh e-book</h3><p>Tautan unduhan berlaku singkat dan dibuat setiap kali Anda menekan tombol. Jumlah unduhan per pesanan dibatasi.</p>' +
        '<div class="btn-row"><button type="button" class="btn btn-solid" id="sUnduh">Siapkan unduhan</button></div><div id="sUnduhHasil" aria-live="polite"></div>'
      : (bolehUnduh ? '<h3>Unduh e-book</h3><p>Admin akan mengirim berkas lewat WhatsApp.</p>' : "");
    var fisik = d.ada_fisik && ["lunas", "dikirim", "selesai"].indexOf(d.status) > -1 && d.resi
      ? "<p><strong>Nomor resi:</strong> " + esc(d.resi) + "</p>" : "";
    box.innerHTML = '<div class="sukses-kartu"><p class="sukses-label">Pesanan ' + esc(d.kode) + "</p><h2>" + esc(d.nama) + "</h2>" + langkah +
      '<ul class="s-items">' + items + "</ul><dl class=\"sukses-rinci\">" + total + "</dl>" + fisik + bayar + unduh + "</div>";
    box.hidden = false;
    var u = $("sUnduh");
    if (u) u.addEventListener("click", function () { unduhBerkas(d.kode, $("sEmail").value.trim(), u); });
  }
  function unduhBerkas(kode, email, tombol) {
    var out = $("sUnduhHasil"), semula = tombol.textContent;
    tombol.disabled = true; tombol.textContent = "Menyiapkan…";
    siapkanSupabase().then(function (sb) {
      return sb.functions.invoke(CFG.fungsiUnduh, { body: { kode: kode, email: email } });
    }).then(function (r) {
      if (r.error) {
        var c = r.error.context;
        if (c && typeof c.json === "function") return c.json().then(function (j) { throw new Error(j && j.galat ? j.galat : "gagal"); });
        throw r.error;
      }
      var b = r.data && r.data.berkas ? r.data.berkas : [];
      if (!b.length) throw new Error("Tidak ada berkas yang dapat diunduh saat ini.");
      out.innerHTML = '<ul class="unduh-list">' + b.map(function (x) {
        return '<li><span>' + esc(x.nama) + '</span><a class="btn btn-line" href="' + esc(x.url) + '" rel="noopener">Unduh PDF</a></li>';
      }).join("") + "</ul>" + (r.data.sisa != null ? '<p class="catatan">Sisa jatah unduhan: ' + esc(r.data.sisa) + ".</p>" : "");
      pixel("Purchase", { currency: "IDR" });
    }).catch(function (err) {
      out.innerHTML = '<p class="status-batal">' + esc(pesanGalat(err, "Unduhan belum bisa disiapkan. Hubungi admin lewat WhatsApp, berkas akan dikirim manual.")) + "</p>";
    }).then(function () { tombol.disabled = false; tombol.textContent = semula; });
  }
  function initStatus() {
    var form = $("sForm");
    if (!form) return;
    var q = new URLSearchParams(location.search), terakhir = baca("jz_pesanan_terakhir", null, true);
    $("sKode").value = (q.get("kode") || (terakhir && terakhir.kode) || "").toUpperCase();
    if (terakhir && terakhir.email) $("sEmail").value = terakhir.email;
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var kode = $("sKode").value.trim().toUpperCase(), email = $("sEmail").value.trim();
      var g = $("sGalat"); g.hidden = true; $("sHasil").hidden = true;
      if (!/^JZ-[A-Z0-9]{8}$/.test(kode)) { g.textContent = "Kode pesanan berbentuk JZ-XXXXXXXX."; g.hidden = false; $("sKode").focus(); return; }
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { g.textContent = "Isi email yang dipakai saat memesan."; g.hidden = false; $("sEmail").focus(); return; }
      var tombol = form.querySelector("button[type=submit]"), semula = tombol.textContent;
      tombol.disabled = true; tombol.textContent = "Memeriksa…";
      siapkanSupabase().then(function (sb) { return sb.rpc("cek_pesanan", { p_kode: kode, p_email: email }); })
        .then(function (r) {
          if (r.error) throw r.error;
          if (!r.data) { g.textContent = "Pesanan tidak ditemukan. Periksa kode dan email yang dipakai saat memesan."; g.hidden = false; return; }
          renderStatus(r.data);
        }).catch(function (err) {
          g.textContent = pesanGalat(err, "Status belum bisa dimuat. Coba lagi sebentar lagi."); g.hidden = false;
        }).then(function () { tombol.disabled = false; tombol.textContent = semula; });
    });
    if ($("sKode").value && $("sEmail").value) form.dispatchEvent(new Event("submit", { cancelable: true }));
  }

  /* ---------- daftar tunggu (produk "segera") ---------- */
  function initTunggu() {
    var form = $("tungguForm");
    if (!form) return;
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var id = form.getAttribute("data-produk"), nama = $("tNama").value.trim(), kontak = $("tKontak").value.trim();
      var g = $("tGalat"); g.hidden = true;
      if ($("tWebsite").value) { form.hidden = true; $("tSukses").hidden = false; return; }
      var emailOk = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(kontak), wa = normalisasiWA(kontak);
      var waOk = !emailOk && wa.length >= 9 && wa.length <= 15;
      if (!emailOk && !waOk) { g.textContent = "Isi email atau nomor WhatsApp yang aktif."; g.hidden = false; $("tKontak").focus(); return; }
      var tombol = form.querySelector("button[type=submit]"), semula = tombol.textContent;
      tombol.disabled = true; tombol.textContent = "Mengirim…";
      siapkanSupabase().then(function (sb) {
        return sb.rpc("daftar_tunggu", { p_produk: id, p_nama: nama || null, p_kontak: emailOk ? kontak : wa, p_jebakan: null });
      }).then(function (r) {
        if (r.error) throw r.error;
        form.hidden = true; $("tSukses").hidden = false;
        pixel("Lead", { content_name: id });
      }).catch(function (err) {
        tombol.disabled = false; tombol.textContent = semula;
        g.textContent = pesanGalat(err, "Belum terkirim. Coba lagi, atau tanyakan lewat WhatsApp."); g.hidden = false;
      });
    });
  }

  /* ---------- inisialisasi ---------- */
  var T = window.JAZMI_TOKO = {
    rupiah: rupiah, produk: function (id) { return DATA.map[id]; }, hargaNormal: hargaNormal,
    tambah: tambah, hapus: hapus, ubahQty: ubahQty, kosongkan: kosongkan, keranjang: bacaKeranjang, hitung: hitung,
    linkWA: linkWA, normalisasiWA: normalisasiWA
  };
  T.siap = muatData();
  T.siap.catch(function () { /* halaman statis tetap dapat dibaca */ });

  function mulai() {
    mulaiPixel();
    perbaruiLencana();
    navMobile();
    tandaiWA();
    document.addEventListener("click", klikAksi);
    initEtalase();
    initTunggu();
    initStatus();
    T.siap.then(function () {
      isiHarga();
      perbaruiLencana();
      initKeranjang();
      pixel("ViewContent", {});
    }).catch(function () {
      var r = $("keranjangRoot");
      if (r) r.innerHTML = '<p class="data-empty-note">Data produk belum dapat dimuat. Muat ulang halaman ini, atau pesan lewat WhatsApp.</p>';
    });
    document.addEventListener("jz:keranjang", perbaruiLencana);
    window.addEventListener("storage", perbaruiLencana);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mulai); else mulai();
})();
