/* JAZMI — Studio Kajian (pengajar). Tulis ke live_sesi; RLS hanya mengizinkan akun di tabel pengajar. */
(function () {
  var $ = function (i) { return document.getElementById(i); }, cfg = window.JAZMI_AUTH || {};
  function pesan(t, err) { $('pesan').textContent = t; $('pesan').style.color = err ? '#a12a1f' : ''; }
  if (!window.supabase || !cfg.url) { pesan('Sistem belum dikonfigurasi (js/auth-config.js).', true); return; }
  var sb = window.supabase.createClient(cfg.url, cfg.anonKey), sesi = null, tmr = null, daftar = [];
  function isiPilihan(sel) { daftar.forEach(function (p, i) { var o = document.createElement('option'); o.value = i; o.textContent = p.judul; sel.appendChild(o); }); }
  function gagal(e) { pesan('Gagal: ' + (e && e.message || 'coba lagi') , true); }
  var RELAY = (window.JAZMI_LIVE || {}).relay, HTTP = RELAY ? RELAY.replace(/^ws/, 'http') : '';
  function tunggu(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  async function token() { var r = await sb.auth.getSession(); if (!r.data.session) throw new Error('belum masuk'); return r.data.session.access_token; }
  function kodeAcak() { return Array.prototype.map.call(crypto.getRandomValues(new Uint8Array(8)), function (b) { return ('0' + b.toString(16)).slice(-2); }).join(''); }
  function urlGambar(n) { return HTTP + '/gambar?s=' + encodeURIComponent(sesi.id) + '&v=' + encodeURIComponent(sesi.pdf_kunci) + '&n=' + n; }

  /* ---- PDF dari perangkat → gambar halaman → Worker ---- */
  var blobs = new Map(), ada = new Set(), sedang = {}, rantai = Promise.resolve(), tokPindah = 0, urlPrat = null;
  function lupakanGambar() { blobs.clear(); ada = new Set(); sedang = {}; if (urlPrat) { URL.revokeObjectURL(urlPrat); urlPrat = null; } }
  async function kirim(n, b) {
    for (var i = 0; i < 3; i++) {
      var r = null, err = null;
      try { r = await fetch(urlGambar(n), { method: 'POST', headers: { Authorization: 'Bearer ' + await token(), 'Content-Type': 'image/jpeg' }, body: b }); } catch (e) { err = e; }
      if (r && r.ok) return;
      if (r && r.status < 500) throw new Error((await r.text().catch(function () { return ''; })) || 'Unggah ditolak (' + r.status + ')');
      if (i === 2) throw err || new Error('Unggah gagal (' + (r && r.status) + '). Periksa koneksi.');
      await tunggu(800 * (i + 1));
    }
  }
  /* pastikan halaman n sudah ada di Worker; kembalikan Blob-nya */
  function siapkan(n) {
    if (sedang[n]) return sedang[n];
    var kunci = sesi.pdf_kunci;
    sedang[n] = (async function () {
      var b = blobs.get(n);
      if (!b) { b = await LivePdf.jpeg(n); blobs.set(n, b); if (blobs.size > 6) blobs.delete(blobs.keys().next().value); }
      if (!ada.has(n)) { await kirim(n, b); if (sesi && sesi.pdf_kunci === kunci) ada.add(n); }
      return b;
    })();
    var p = sedang[n]; p.then(function () { delete sedang[n]; }, function () { delete sedang[n]; });
    return p;
  }
  function prefetch(n) { // halaman berikutnya disiapkan di latar, satu per satu
    if (!sesi || !sesi.pdf_kunci || !LivePdf.adaBerkas() || !sesi.total || n > sesi.total || ada.has(n)) return;
    rantai = rantai.then(function () { if (sesi && sesi.pdf_kunci && LivePdf.adaBerkas() && !ada.has(n)) return siapkan(n).catch(function () {}); });
  }
  function tampilBlob(b) { var u = URL.createObjectURL(b); $('gb').src = u; if (urlPrat) URL.revokeObjectURL(urlPrat); urlPrat = u; }
  async function gambar() {
    $('pg').textContent = 'Halaman ' + sesi.halaman + (sesi.total ? ' / ' + sesi.total : ''); $('goto').value = sesi.halaman;
    $('cv').hidden = !!sesi.pdf_kunci || !sesi.pdf_url; $('gb').hidden = !sesi.pdf_kunci;
    if (sesi.pdf_kunci) {
      var b = blobs.get(sesi.halaman);
      if (b) tampilBlob(b); else if (HTTP) $('gb').src = urlGambar(sesi.halaman); // sesudah muat ulang studio: lihat apa yang dilihat penonton
    } else if (sesi.pdf_url) { try { await LivePdf.render($('cv'), sesi.halaman); } catch (e) { pesan('Pratinjau PDF gagal.', true); } }
  }
  function info(t) { $('berkasInfo').textContent = t || ''; }
  function simpan(patch) { // tulis dengan jeda 300 ms agar loncatan cepat tidak membanjiri server
    Object.assign(sesi, patch); gambar(); clearTimeout(tmr);
    if ('halaman' in patch) { $('kanvas').scrollTop = 0; $('kanvas').scrollLeft = 0; kgKirim(true); }   // halaman baru: peserta ikut pindah dan kembali ke atas
    tmr = setTimeout(async function () { var r = await sb.from('live_sesi').update(patch).eq('id', sesi.id); if (r.error) gagal(r.error); else pesan('● Live — halaman ' + sesi.halaman); }, 300);
  }
  /* mode gambar: halaman harus ada di Worker SEBELUM nomornya diumumkan ke penonton */
  async function pindah(n) {
    var tok = ++tokPindah; info('Menyiapkan halaman ' + n + '…');
    try { await siapkan(n); } catch (e) { if (tok === tokPindah) { info(''); pesan('Halaman ' + n + ' gagal dikirim: ' + (e && e.message || e), true); } return; }
    if (tok !== tokPindah) return; // pengajar sudah loncat ke halaman lain
    info(''); simpan({ halaman: n }); prefetch(n + 1);
  }
  function lompat(n) {
    if (!sesi) return; var mx = sesi.total || 9999; n = Math.max(1, Math.min(mx, n | 0)); if (n === sesi.halaman) return;
    if (sesi.pdf_kunci) {
      if (!LivePdf.adaBerkas()) { pesan('Untuk memindah halaman, pilih ulang berkas PDF yang sama lewat tombol “Pilih PDF dari perangkat”.', true); return; }
      pindah(n);
    } else simpan({ halaman: n });
  }
  async function hapusGambar() { // sebaiknya dipanggil saat sesi masih live (Worker memeriksanya); gagal pun tak apa, ada penghapusan otomatis 12 jam
    if (!HTTP || !sesi) return; try { await fetch(HTTP + '/gambar?s=' + encodeURIComponent(sesi.id), { method: 'DELETE', headers: { Authorization: 'Bearer ' + await token() } }); } catch (e) { }
  }
  async function pakaiBerkas(file) {
    if (!file) return;
    if (!HTTP) return pesan('Alamat relay belum diisi (js/live-config.js), jadi PDF dari perangkat belum bisa dipakai.', true);
    var judul = file.name.replace(/\.pdf$/i, '').slice(0, 160) || 'Kitab', sebelum = { kunci: sesi.pdf_kunci, url: sesi.pdf_url, judul: sesi.pdf_judul, hal: sesi.halaman, total: sesi.total };
    $('pilihBerkas').disabled = true; info('Membuka PDF…');
    try {
      var n = await LivePdf.bukaBerkas(file);
      var sama = !!sebelum.kunci && sebelum.judul === judul && sebelum.total === n;   // berkas yang sama dipilih ulang (mis. sesudah muat ulang studio) → lanjut dari halaman terakhir
      var kunci = sama ? sebelum.kunci : kodeAcak(), h = sama ? Math.max(1, Math.min(n, sebelum.hal)) : 1;
      lupakanGambar(); sesi.pdf_kunci = kunci; sesi.total = n; info('Mengirim halaman ' + h + '…');
      await siapkan(h);
      var r = await sb.from('live_sesi').update({ pdf_kunci: kunci, pdf_url: null, pdf_judul: judul, halaman: h, total: n }).eq('id', sesi.id);
      if (r.error) throw r.error;
      Object.assign(sesi, { pdf_kunci: kunci, pdf_url: null, pdf_judul: judul, halaman: h, total: n });
      $('kJudul').textContent = sesi.judul; info('PDF siap: ' + judul + ' (' + n + ' halaman). Halaman berikutnya dikirim otomatis di latar.');
      await gambar(); pesan('● Live — halaman ' + h); prefetch(h + 1); kgKirim(true);
    } catch (e) {
      LivePdf.tutupBerkas(); lupakanGambar();
      Object.assign(sesi, { pdf_kunci: sebelum.kunci, pdf_url: sebelum.url, pdf_judul: sebelum.judul, halaman: sebelum.hal, total: sebelum.total });
      info(''); pesan('PDF gagal dipakai: ' + (e && e.message || e) + (sebelum.kunci || sebelum.url ? ' Penonton tetap melihat halaman sebelumnya.' : ''), true);
    }
    $('pilihBerkas').disabled = false;
  }
  async function bukaPdf() { if (!sesi.pdf_url || sesi.pdf_kunci) return; try { var n = await LivePdf.open(sesi.pdf_url); if (!sesi.total) { sesi.total = n; await sb.from('live_sesi').update({ total: n }).eq('id', sesi.id); } } catch (e) { pesan('Kitab gagal dimuat: ' + e.message, true); } }
  async function masuk(s) {
    sesi = s; $('formMulai').hidden = true; $('kendali').hidden = false; $('kJudul').textContent = s.judul;
    $('tautPenonton').href = 'index.html?s=' + encodeURIComponent(s.id); await bukaPdf(); await gambar(); pesan('● Live — halaman ' + s.halaman);
    kanalSiap(); kunciTampil(); pulihAlat(s); kursiTampil(); kursiPeriksa(); tData = []; tanyaTampilTombol(); tanyaMuat();
    if (s.pdf_kunci && !LivePdf.adaBerkas()) info('Kitab “' + (s.pdf_judul || '') + '” sedang tampil untuk penonton. Untuk memindah halaman, pilih ulang berkas PDF yang sama.');
  }
  $('prev').onclick = function () { lompat(sesi.halaman - 1); }; $('next').onclick = function () { lompat(sesi.halaman + 1); };
  $('goto').onchange = function () { lompat(+$('goto').value); };
  addEventListener('keydown', function (e) { if (!sesi || /INPUT|SELECT/.test(e.target.tagName)) return; if (e.key === 'ArrowRight') lompat(sesi.halaman + 1); if (e.key === 'ArrowLeft') lompat(sesi.halaman - 1); });
  $('pilihBerkas').onclick = function () { $('inBerkas').click(); };
  $('inBerkas').onchange = function () { var f = $('inBerkas').files[0]; $('inBerkas').value = ''; pakaiBerkas(f); };
  $('gantiPdf').onchange = async function () {
    var p = daftar[$('gantiPdf').value]; if (!p) return;
    var r = await sb.from('live_sesi').update({ pdf_url: p.url, pdf_judul: p.judul, halaman: 1, total: null, pdf_kunci: null }).eq('id', sesi.id);
    if (r.error) return gagal(r.error);
    hapusGambar(); LivePdf.tutupBerkas(); lupakanGambar(); info('');
    Object.assign(sesi, { pdf_url: p.url, pdf_judul: p.judul, halaman: 1, total: null, pdf_kunci: null }); await bukaPdf(); await gambar(); kgKirim(true);
  };
  $('mulai').onclick = async function () {
    var judul = $('fJudul').value.trim(); if (judul.length < 3) return pesan('Isi judul kajian.', true);
    var p = daftar[$('fPdf').value], fb = $('fFb').value.trim(), berkas = $('fBerkas').files[0];
    if (fb && !/^https:\/\//.test(fb)) return pesan('Tautan Facebook harus diawali https://', true);
    if (berkas && !HTTP) return pesan('Alamat relay belum diisi (js/live-config.js), jadi PDF dari perangkat belum bisa dipakai.', true);
    $('mulai').disabled = true;
    var r = await sb.from('live_sesi').insert({ judul: judul, pengajar_nama: $('fNama').value.trim() || null, pdf_url: !berkas && p ? p.url : null, pdf_judul: !berkas && p ? p.judul : null, fb_url: fb || null }).select().single();
    $('mulai').disabled = false;
    if (r.error) return pesan(/duplicate|unique/i.test(r.error.message) ? 'Masih ada sesi live. Muat ulang halaman ini untuk melanjutkannya.' : 'Gagal memulai: ' + r.error.message, true);
    await masuk(r.data); if (berkas) { $('fBerkas').value = ''; pakaiBerkas(berkas); }
  };
  /* ---- audio langsung (relay Cloudflare, tanpa SFU/TURN) ---- */
  var au = null;
  function auSt(t) { $('audioSt').textContent = t; }
  function auMati() { if (au) { au.stop(); au = null; } $('audioMulai').textContent = '🎙 Mulai audio'; $('audioJeda').hidden = true; $('audioJeda').textContent = 'Bisukan'; $('meter').style.width = '0'; $('audioPend').textContent = ''; }
  $('audioMulai').onclick = async function () {
    if (au) { auMati(); auSt('dimatikan'); return; }
    if (!RELAY) return pesan('Alamat relay belum diisi (js/live-config.js).', true);
    if (!sesi) return;
    $('audioMulai').disabled = true;
    try {
      au = await LiveAudio.siar({
        url: RELAY + '/siar?s=' + encodeURIComponent(sesi.id),
        getToken: async function () { var r = await sb.auth.getSession(); if (!r.data.session) throw new Error('belum masuk'); return r.data.session.access_token; },
        onStatus: auSt,
        onLevel: function (v) { $('meter').style.width = Math.round(v * 100) + '%'; },
        onPendengar: function (n) { $('audioPend').textContent = 'Pendengar saat ini: ' + n; }
      });
      $('audioMulai').textContent = '■ Hentikan audio'; $('audioJeda').hidden = false;
    } catch (e) { pesan('Mikrofon/audio gagal: ' + (e && e.message || e), true); au = null; }
    $('audioMulai').disabled = false;
  };
  $('audioJeda').onclick = function () { if (!au) return; var b = $('audioJeda').textContent === 'Bisukan'; au.bisu(b); $('audioJeda').textContent = b ? 'Lanjutkan' : 'Bisukan'; };
  /* ---- alat peraga: peserta memuat alat sendiri; yang dikirim hanya peristiwa kecil lewat relay (js/live-alat.js) ---- */
  var LA = window.LiveAlat, kanalAlat = null, hentiTangkap = null, batalMuat = null, alatNow = null, tmrCari = null;
  function alatSt(t) { $('alatSt').textContent = t; }
  var kanalOk = false;
  function kanalSiap() {
    if (kanalAlat || !RELAY || !sesi) return;
    kanalAlat = LA.siar({ url: RELAY + '/alat-siar?s=' + encodeURIComponent(sesi.id), getToken: token,
      onStatus: function (k) { kanalOk = k === 'tersambung'; if (k === 'ditolak') alatSt('relay menolak: akun bukan pengajar atau sesi tidak sedang live'); } });
  }
  async function kanalTunggu() { for (var i = 0; i < 40 && !kanalOk; i++) await tunggu(200); }
  /* posisi kitab (halaman + gulir) untuk layar peserta yang terkunci / "Ikuti pengajar" */
  function kgKirim(final) {
    if (!kanalAlat || !sesi || !(sesi.pdf_kunci || sesi.pdf_url)) return;
    var k = $('kanvas'), mx = k.scrollWidth - k.clientWidth, my = k.scrollHeight - k.clientHeight;
    var o = { t: 'kg', h: sesi.halaman | 0, x: mx > 0 ? +(k.scrollLeft / mx).toFixed(4) : 0, y: my > 0 ? +(k.scrollTop / my).toFixed(4) : 0 };
    if (sesi.pdf_kunci) o.v = sesi.pdf_kunci; if (final) o.f = 1;
    kanalAlat.kirim(o);
  }
  var kgT = 0, kgF = null;
  $('kanvas').addEventListener('scroll', function () {
    var n = Date.now(); if (n - kgT > 80) { kgT = n; kgKirim(false); }
    clearTimeout(kgF); kgF = setTimeout(function () { kgKirim(true); }, 300);
  });
  function alatStatus() {
    if (!alatNow) return alatSt('belum ada yang ditampilkan');
    var e = alatNow.e;
    alatSt('● tampil untuk peserta: ' + e.judul + (!e.terkunci ? '' : sesi && sesi.alat_umum ? ' 🔒 (tampil juga untuk non-anggota: isi alat dititipkan di relay)' : ' 🔒 (hanya anggota aktif yang melihatnya; peserta umum akan melihat "khusus anggota")'));
  }
  /* alat terkunci → titipkan HTML-nya ke relay supaya peserta non-anggota bisa melihatnya (hanya bila pengajar menyalakan "untuk umum") */
  async function titipIsi(e, n) {
    var d = await sb.storage.from(cfg.bucket || 'alat-privat').download(e.id + '.html');
    if (d.error || !d.data) throw new Error('berkas alat tidak dapat diunduh (pastikan akun ini anggota aktif)');
    var html = (await d.data.text()).replace(/<script[^>]*alat-nav-kembali\.js[^>]*>\s*<\/script>/gi, ''), b = new TextEncoder().encode(html);
    if (b.length > 4000000) throw new Error('alat terlalu besar (' + Math.round(b.length / 1e5) / 10 + ' MB; batas 4 MB)');
    for (var i = 0; i < 5; i++) {
      var r = await fetch(HTTP + '/alat-isi?s=' + encodeURIComponent(sesi.id) + '&n=' + encodeURIComponent(n), { method: 'POST', headers: { Authorization: 'Bearer ' + await token(), 'Content-Type': 'text/plain; charset=utf-8' }, body: b });
      if (r.ok) return;
      if ((r.status === 404 || r.status === 409) && i < 4) { await tunggu(700); continue; }   // pesan "baru" lewat WebSocket mungkin belum diproses relay
      throw new Error('relay menolak (' + r.status + ')');
    }
  }
  function bersihAlat() {
    if (batalMuat) { batalMuat(); batalMuat = null; }
    if (hentiTangkap) { hentiTangkap(); hentiTangkap = null; }
    $('alatBingkai').removeAttribute('src'); $('alatWadah').hidden = true;
  }
  function tampilAlat(e, nonce) {
    bersihAlat(); alatNow = { e: e, n: nonce }; $('alatWadah').hidden = false; $('alatTutup').hidden = false; $('alatReset').hidden = false; alatSt('memuat ' + e.judul + '…');
    batalMuat = LA.muat($('alatBingkai'), e, function (doc) {
      batalMuat = null;
      if (!alatNow || alatNow.n !== nonce) return;
      if (!doc) { alatSt('alat tidak dapat dimuat di studio' + (e.terkunci ? ' (alat terkunci: pastikan akun ini anggota aktif)' : '')); return; }
      hentiTangkap = LA.tangkap(doc, function (o) { o.n = nonce; if (kanalAlat) kanalAlat.kirim(o); });
      alatStatus();
    });
  }
  async function bukaAlat(e) {
    if (!sesi) return;
    if (!RELAY) return pesan('Alamat relay belum diisi (js/live-config.js).', true);
    var n = kodeAcak(); kanalSiap(); if (e.terkunci && sesi.alat_umum) await kanalTunggu();
    kanalAlat.kirim({ t: 'baru', n: n });
    if (e.terkunci && sesi.alat_umum) {
      try { alatSt('menitipkan isi alat ke relay…'); await titipIsi(e, n); }
      catch (x) { kanalAlat.kirim({ t: 'tutup' }); alatSt('belum ada yang ditampilkan'); return pesan('Alat terkunci tidak bisa dibagikan ke non-anggota: ' + (x && x.message || x) + '. Alat tidak ditampilkan.', true); }
    }
    var r = await sb.from('live_sesi').update({ alat_ref: e.id, alat_nonce: n }).eq('id', sesi.id);
    if (r.error) { kanalAlat.kirim({ t: 'tutup' }); return pesan(/alat_ref|alat_nonce/.test(r.error.message) ? 'Kolom alat belum ada: jalankan supabase-live-alat.sql di Supabase dulu.' : 'Gagal: ' + r.error.message, true); }
    Object.assign(sesi, { alat_ref: e.id, alat_nonce: n }); $('alatHasil').innerHTML = ''; $('alatCari').value = '';
    tampilAlat(e, n);
  }
  async function tutupAlat() {
    if (!sesi) return;
    if (kanalAlat) kanalAlat.kirim({ t: 'tutup' });
    var r = await sb.from('live_sesi').update({ alat_ref: null, alat_nonce: null }).eq('id', sesi.id);
    if (r.error) return gagal(r.error);
    Object.assign(sesi, { alat_ref: null, alat_nonce: null }); alatNow = null; bersihAlat(); $('alatTutup').hidden = true; $('alatReset').hidden = true; alatSt('belum ada yang ditampilkan');
  }
  $('alatCari').oninput = function () {
    clearTimeout(tmrCari);
    tmrCari = setTimeout(function () {
      var q = $('alatCari').value.trim(), ul = $('alatHasil'); ul.innerHTML = ''; if (q.length < 2) return;
      LA.muatManifest().then(function (m) {
        LA.cari(m, q, 20).forEach(function (e) {
          var li = document.createElement('li'), b = document.createElement('button'); b.type = 'button'; b.className = 'btn btn-outline';
          b.textContent = (e.terkunci ? '🔒 ' : '') + e.judul; b.onclick = function () { bukaAlat(e); }; li.appendChild(b); ul.appendChild(li);
        });
        if (!ul.children.length) { var li = document.createElement('li'); li.className = 'lv-hint'; li.textContent = 'Tidak ada alat yang cocok.'; ul.appendChild(li); }
      }).catch(function (e) { alatSt(e.message || 'daftar alat gagal dimuat'); });
    }, 150);
  };
  $('alatTutup').onclick = tutupAlat;
  /* ---- mode kunci layar peserta (supabase-live-kunci.sql) ---- */
  function kunciTampil() {
    if (!sesi) return;
    var a = !!sesi.kunci_kitab, b = !!sesi.kunci_alat, u = !!sesi.alat_umum;
    $('kunciKitab').textContent = a ? '🔒 Layar kitab peserta: TERKUNCI' : '🔓 Kunci layar kitab peserta'; $('kunciKitab').setAttribute('aria-pressed', a);
    $('kunciAlat').textContent = b ? '🔒 Alat peserta: TERKUNCI' : '🔓 Kunci alat peserta'; $('kunciAlat').setAttribute('aria-pressed', b);
    $('alatUmum').textContent = u ? '🌐 Alat terkunci: tampil untuk umum' : '🔒 Alat terkunci: hanya anggota'; $('alatUmum').setAttribute('aria-pressed', u);
    $('kunciSt').textContent = (a ? 'kitab dikunci' : 'kitab bebas') + ' · ' + (b ? 'alat dikunci' : 'alat bebas') + ' · alat 🔒 ' + (u ? 'terbuka untuk umum' : 'khusus anggota');
  }
  async function kunciUbah(patch) {
    if (!sesi) return false;
    var r = await sb.from('live_sesi').update(patch).eq('id', sesi.id);
    if (r.error) { pesan(/kunci_kitab|kunci_alat|alat_umum|schema cache/.test(r.error.message) ? 'Kolom kunci belum ada: jalankan supabase-live-kunci.sql di Supabase dulu.' : 'Gagal: ' + r.error.message, true); return false; }
    Object.assign(sesi, patch); kunciTampil(); kanalSiap();
    if (kanalAlat) {
      if ('kunci_kitab' in patch || 'kunci_alat' in patch) { kanalAlat.kirim({ t: 'mode', a: !!sesi.kunci_kitab, b: !!sesi.kunci_alat }); if (patch.kunci_kitab) kgKirim(true); }
      if ('alat_umum' in patch) kanalAlat.kirim({ t: 'umum', v: !!sesi.alat_umum });
    }
    return true;
  }
  $('kunciKitab').onclick = function () { if (sesi) kunciUbah({ kunci_kitab: !sesi.kunci_kitab }).then(function (ok) { if (ok) pesan(sesi.kunci_kitab ? 'Layar kitab peserta dikunci: mengikuti halaman dan gulir Anda.' : 'Layar kitab peserta dibuka: peserta boleh menjelajah sendiri.'); }); };
  $('kunciAlat').onclick = function () { if (sesi) kunciUbah({ kunci_alat: !sesi.kunci_alat }).then(function (ok) { if (ok) pesan(sesi.kunci_alat ? 'Alat peserta dikunci: peserta hanya menonton gerakan Anda.' : 'Alat peserta dibuka: peserta boleh mencoba sendiri.'); }); };
  $('alatUmum').onclick = async function () {
    if (!sesi) return; var baru = !sesi.alat_umum;
    if (baru) {
      if (!RELAY) return pesan('Alamat relay belum diisi (js/live-config.js).', true);
      if (!confirm('Alat terkunci (🔒) yang Anda tampilkan akan terlihat juga oleh peserta yang BUKAN anggota.\n\nKonsekuensinya: isi HTML alat itu dititipkan sementara di relay dan dikirim ke setiap peserta yang memegang kursi, sehingga peserta yang teknis bisa menyimpannya. Titipan dihapus saat alat ditutup, saat ini dimatikan, dan saat kajian berakhir.\n\nLanjutkan?')) return;
      if (alatNow && alatNow.e.terkunci) {   // alat terkunci sedang tampil: titipkan dulu sebelum peserta diberi tahu
        try { kanalSiap(); await kanalTunggu(); alatSt('menitipkan isi alat ke relay…'); await titipIsi(alatNow.e, alatNow.n); }
        catch (x) { alatStatus(); return pesan('Gagal menitipkan isi alat: ' + (x && x.message || x), true); }
      }
    }
    if (await kunciUbah({ alat_umum: baru })) { alatStatus(); pesan(baru ? 'Alat terkunci kini tampil untuk umum.' : 'Alat terkunci kembali khusus anggota.'); }
  };
  $('alatReset').onclick = function () { if (alatNow) bukaAlat(alatNow.e); };
  function pulihAlat(s) {   // studio dimuat ulang saat alat masih tampil: peserta tidak terganggu, alat dimuat ulang di studio
    if (!s.alat_ref || !s.alat_nonce || !window.LiveAlat) return;
    LA.muatManifest().then(function (m) { var e = m.per[s.alat_ref]; if (e && sesi && sesi.id === s.id) { kanalSiap(); tampilAlat(e, s.alat_nonce); } }).catch(function () { });
  }
  $('selesai').onclick = async function () {
    if (!confirm('Akhiri kajian ini untuk semua penonton?')) return;
    auMati(); if (kanalAlat) { kanalAlat.kirim({ t: 'tutup' }); await tunggu(150); kanalAlat.stop(); kanalAlat = null; } alatNow = null; bersihAlat(); $('alatTutup').hidden = true; $('alatReset').hidden = true; alatSt('belum ada yang ditampilkan');
    if (sesi.pdf_kunci) await hapusGambar();
    var r = await sb.from('live_sesi').update({ status: 'selesai', selesai: new Date().toISOString() }).eq('id', sesi.id);
    if (r.error) return gagal(r.error);
    sesi = null; $('kunciSt').textContent = 'memeriksa…'; LivePdf.tutupBerkas(); lupakanGambar(); info(''); $('gb').hidden = true; $('kendali').hidden = true; $('formMulai').hidden = false; pesan('Kajian diakhiri.');
  };

  /* ---- majelis: kapasitas, kunci, jumlah terisi (supabase-live-kursi.sql) ---- */
  var kursiTmr = null;
  function kursiTampil(st) {
    if (!sesi) return;
    var kap = sesi.kapasitas, kunci = !!sesi.majelis_kunci;
    $('kapNilai').textContent = kap === undefined ? '–' : kap;
    $('kursiKunci').textContent = kunci ? '🔓 Buka majelis' : '🔒 Kunci majelis';
    if (st) $('kursiSt').textContent = st.terisi + ' / ' + st.kapasitas + ' kursi terisi' + (st.dikunci ? ' · dikunci' : st.terisi >= st.kapasitas ? ' · penuh' : '');
  }
  async function kursiPeriksa() {
    if (!sesi) return;
    var r = await sb.rpc('status_kursi', { p_sesi: sesi.id });
    if (r.error) { $('kursiSt').textContent = /status_kursi|schema cache/i.test(r.error.message) ? 'belum aktif: jalankan supabase-live-kursi.sql di Supabase' : 'gagal membaca'; return; }
    if (r.data) { if (sesi.kapasitas === undefined || sesi.kapasitas !== r.data.kapasitas) sesi.kapasitas = r.data.kapasitas; sesi.majelis_kunci = r.data.dikunci; kursiTampil(r.data); }
  }
  async function kursiUbah(patch) {
    if (!sesi) return;
    var r = await sb.from('live_sesi').update(patch).eq('id', sesi.id);
    if (r.error) return pesan(/kapasitas|majelis_kunci/.test(r.error.message) ? 'Kolom majelis belum ada: jalankan supabase-live-kursi.sql di Supabase dulu.' : 'Gagal: ' + r.error.message, true);
    Object.assign(sesi, patch); kursiPeriksa();
  }
  $('kapKurang').onclick = function () { kursiUbah({ kapasitas: Math.max(1, (sesi.kapasitas || 40) - 5) }); };
  $('kapTambah').onclick = function () { kursiUbah({ kapasitas: Math.min(80, (sesi.kapasitas || 40) + 5) }); };
  $('kursiKunci').onclick = function () { kursiUbah({ majelis_kunci: !sesi.majelis_kunci }); };
  $('kursiKosong').onclick = async function () {
    if (!sesi || !confirm('Kosongkan semua kursi? Peserta yang masih aktif akan masuk lagi sendiri dalam beberapa detik, sesuai kapasitas.')) return;
    var r = await sb.from('live_kursi').delete().eq('sesi_id', sesi.id);
    if (r.error) return pesan('Gagal mengosongkan: ' + r.error.message, true);
    pesan('Kursi dikosongkan.'); kursiPeriksa();
  };
  clearInterval(kursiTmr); kursiTmr = setInterval(function () { if (sesi && !document.hidden) kursiPeriksa(); }, 5000);

  /* ---- sesi pertanyaan (supabase-live-tanya.sql): pengajar membaca dan mengatur semua pertanyaan lewat RLS ---- */
  var tData = [], tTmr = null;
  function tanyaTampilTombol() { $('tanyaToggle').textContent = sesi && sesi.tanya_buka ? '✕ Tutup sesi tanya' : '❓ Buka sesi tanya'; }
  function tanyaGagal(m) { return pesan(/live_tanya|tanya_buka|schema cache/i.test(m) ? 'Fitur tanya belum aktif: jalankan supabase-live-tanya.sql di Supabase dulu.' : 'Gagal: ' + m, true); }
  async function tanyaMuat() {
    if (!sesi) return; var sid = sesi.id;
    var r = await sb.from('live_tanya').select('id,nama,isi,tampil,status,prioritas,dibuat').eq('sesi_id', sid).order('dibuat', { ascending: true }).order('id', { ascending: true }).limit(400);
    if (!sesi || sesi.id !== sid) return;
    if (r.error) { $('tanyaSt').textContent = /live_tanya|schema cache/i.test(r.error.message) ? 'belum aktif: jalankan supabase-live-tanya.sql di Supabase' : 'gagal membaca'; return; }
    tData = r.data || []; tanyaGambar();
  }
  function tUrut(a, b) { return (b.prioritas - a.prioritas) || (a.dibuat < b.dibuat ? -1 : a.dibuat > b.dibuat ? 1 : a.id - b.id); }
  function tanyaGambar() {
    tanyaTampilTombol();
    var sedang = tData.filter(function (q) { return q.status === 'sedang'; }), tunggu = tData.filter(function (q) { return q.status === 'menunggu'; }).sort(tUrut),
        selesai = tData.filter(function (q) { return q.status === 'dijawab' || q.status === 'dilewati'; }).sort(function (a, b) { return b.id - a.id; }).slice(0, 15);
    var tut = tunggu.filter(function (q) { return !q.tampil; }).length;
    $('tanyaSt').textContent = (sesi && sesi.tanya_buka ? '● dibuka' : 'ditutup') + ' · ' + tunggu.length + ' menunggu (' + tut + ' tertutup, ' + (tunggu.length - tut) + ' ditampakkan)';
    var ul = $('tanyaDaftar'); ul.textContent = '';
    function baris(q, no) {
      var li = document.createElement('li'), a = document.createElement('span'), m = document.createElement('span'), ak = document.createElement('div');
      li.className = q.status === 'sedang' ? 'sedang' : '';
      a.textContent = q.isi; m.className = 'lv-meta';
      m.textContent = (q.tampil ? '👁 ' : '🔒 ') + (q.nama || 'Anonim') + ' · ' + (q.status === 'menunggu' ? 'antrean ke-' + no + (q.prioritas ? ' (dinaikkan)' : '') : q.status === 'sedang' ? 'sedang dijawab' : q.status);
      ak.className = 'lv-aksi';
      if (q.status === 'menunggu') ak.appendChild(tombolT('Sedang dijawab', function () { tSedang(q.id); }));
      if (q.status === 'menunggu' || q.status === 'sedang') { ak.appendChild(tombolT('Dijawab', function () { tUbah(q.id, { status: 'dijawab' }); })); ak.appendChild(tombolT('Lewati', function () { tUbah(q.id, { status: 'dilewati' }); })); }
      if (q.status === 'menunggu') ak.appendChild(tombolT('↑ Naikkan', function () { tUbah(q.id, { prioritas: tData.reduce(function (x, y) { return Math.max(x, y.prioritas); }, 0) + 1 }); }));
      if (q.status !== 'menunggu') ak.appendChild(tombolT('Kembalikan ke antrean', function () { tUbah(q.id, { status: 'menunggu' }); }));
      ak.appendChild(tombolT('Hapus', function () { if (confirm('Hapus pertanyaan ini?')) tHapus(q.id); }));
      li.appendChild(a); li.appendChild(m); li.appendChild(ak); ul.appendChild(li);
    }
    sedang.forEach(function (q) { baris(q); }); tunggu.forEach(function (q, i) { baris(q, i + 1); }); selesai.forEach(function (q) { baris(q); });
    if (!ul.children.length) { var e = document.createElement('li'); e.className = 'lv-hint'; e.textContent = 'Belum ada pertanyaan.'; ul.appendChild(e); }
  }
  function tombolT(t, f) { var b = document.createElement('button'); b.type = 'button'; b.className = 'btn btn-outline'; b.textContent = t; b.onclick = f; return b; }
  async function tUbah(qid, patch) {
    if (!sesi) return;
    var r = await sb.from('live_tanya').update(patch).eq('id', qid).eq('sesi_id', sesi.id);
    if (r.error) return /duplicate|unique/i.test(r.error.message) ? pesan('Sudah ada pertanyaan yang sedang dijawab.', true) : tanyaGagal(r.error.message);
    tanyaMuat();
  }
  async function tSedang(qid) {   // yang sebelumnya sedang dijawab otomatis menjadi "dijawab" (indeks unik: hanya satu yang sedang)
    if (!sesi) return;
    var lama = tData.filter(function (q) { return q.status === 'sedang' && q.id !== qid; });
    if (lama.length) { var r0 = await sb.from('live_tanya').update({ status: 'dijawab' }).in('id', lama.map(function (q) { return q.id; })).eq('sesi_id', sesi.id); if (r0.error) return tanyaGagal(r0.error.message); }
    tUbah(qid, { status: 'sedang' });
  }
  async function tHapus(qid) {
    if (!sesi) return; var r = await sb.from('live_tanya').delete().eq('id', qid).eq('sesi_id', sesi.id);
    if (r.error) return tanyaGagal(r.error.message); tanyaMuat();
  }
  $('tanyaToggle').onclick = async function () {
    if (!sesi) return; var baru = !sesi.tanya_buka;
    var r = await sb.from('live_sesi').update({ tanya_buka: baru }).eq('id', sesi.id);
    if (r.error) return tanyaGagal(r.error.message);
    sesi.tanya_buka = baru; tanyaGambar(); pesan(baru ? 'Sesi tanya dibuka.' : 'Sesi tanya ditutup.');
  };
  clearInterval(tTmr); tTmr = setInterval(function () { if (sesi && !document.hidden) tanyaMuat(); }, 5000);
  (async function () {
    var s = (await sb.auth.getSession()).data.session;
    if (!s) { pesan('Belum masuk. Masuk lewat halaman /masuk/ lalu kembali ke halaman ini.', true); return; }
    var pj = await sb.from('pengajar').select('user_id').maybeSingle();
    if (!pj.data) { pesan('Akun ini belum terdaftar sebagai pengajar (lihat supabase-live.sql).', true); return; }
    try { daftar = (await (await fetch('pustaka.json')).json()).pustaka || []; } catch (e) { daftar = []; }
    isiPilihan($('fPdf')); isiPilihan($('gantiPdf'));
    var a = await sb.from('live_sesi').select('*').eq('status', 'live').order('mulai', { ascending: false }).limit(1);
    if (a.data && a.data[0]) masuk(a.data[0]); else { $('formMulai').hidden = false; pesan('Siap memulai kajian.'); }
  })();
})();
