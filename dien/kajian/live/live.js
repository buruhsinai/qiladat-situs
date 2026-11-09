/* JAZMI — Ruang Kajian (penonton). Sinkron halaman lewat polling 4 detik (tanpa WebSocket). */
(function () {
  var c = window.JAZMI_AUTH || {}, $ = function (i) { return document.getElementById(i); };
  var H = { apikey: c.anonKey }, id = new URLSearchParams(location.search).get('s');
  var sesi = null, ikut = true, hal = 1, pdfUrl = null, kunci = null, tampil = 0, sibuk = false;
  var RELAY = (window.JAZMI_LIVE || {}).relay, HTTP = RELAY ? RELAY.replace(/^ws/, 'http') : '', au = null;
  /* Fase 3: kunci acak peserta (hanya hash-nya yang sampai ke database); satu kunci = satu kursi, juga di beberapa tab */
  function kunciPeserta() {
    var k = null; try { k = localStorage.getItem('jazmi_live_kunci'); } catch (e) { }
    if (!/^[0-9a-f]{32}$/.test(k || '')) {
      var b = new Uint8Array(16); try { crypto.getRandomValues(b); } catch (e) { for (var i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256); }
      k = Array.prototype.map.call(b, function (x) { return ('0' + x.toString(16)).slice(-2); }).join('');
      try { localStorage.setItem('jazmi_live_kunci', k); } catch (e) { }
    }
    return k;
  }
  var KUNCI = kunciPeserta(), lama = false, tmrPutar = null;
  /* ---- mode kunci (supabase-live-kunci.sql): kKitab = halaman+gulir kitab hanya mengikuti pengajar; kAlat = alat hanya ditonton;
     umum = alat terkunci tampil juga untuk non-anggota. Relay (cepat) menang atas polling DB (lambat) selama < 5 detik. kg = posisi kitab pengajar. ---- */
  var kKitab = false, kAlat = false, umum = false, kg = null, kgAt = 0, modeAt = 0, umumAt = 0, progGulir = 0, kanal = null;
  function prog() { progGulir = Date.now(); }
  /* {tak:true} = fungsi belum dipasang di Supabase (pakai cara lama); null = gangguan jaringan/galat; {j:…} = hasil */
  function rpc(fn, body, keep) {
    return fetch(c.url + '/rest/v1/rpc/' + fn, { method: 'POST', headers: { apikey: c.anonKey, 'Content-Type': 'application/json' }, body: JSON.stringify(body), keepalive: !!keep })
      .then(function (r) { if (r.status === 404) return { tak: true }; return r.ok ? r.json().then(function (j) { return { j: j }; }) : null; }).catch(function () { return null; });
  }
  function api(q) { return fetch(c.url + '/rest/v1/live_sesi?' + q, { headers: H }).then(function (r) { return r.ok ? r.json() : []; }).catch(function () { return null; }); }
  function pesanPdf(t) { $('pdfErr').textContent = t || ''; $('pdfErr').hidden = !t; }
  function label(n) { $('pg').textContent = 'Halaman ' + n + (sesi.total ? ' / ' + sesi.total : ''); }
  /* mode gambar: kitab diunggah pengajar ke Worker per halaman (sesi.pdf_kunci terisi) */
  function urlGambar(n) { return HTTP + '/gambar?s=' + encodeURIComponent(sesi.id) + '&v=' + encodeURIComponent(kunci) + '&n=' + n; }
  function gambarImg(n) {
    if (sibuk || n === tampil) return; sibuk = true; pesanPdf('');
    var u = urlGambar(n), coba = 0, kk = kunci;
    function selesai(ok) { sibuk = false; if (ok && kk === kunci && hal !== tampil) gambar(hal); }
    (function muat() {
      if (kk !== kunci || hal !== n) return selesai(true);   // pengajar/penonton sudah pindah halaman: tinggalkan yang ini
      var im = new Image();
      im.onload = function () {
        if (kk !== kunci) return selesai(false);
        prog(); $('kanvas').scrollTop = 0; $('gb').src = u; tampil = n; label(n); pesanPdf('');   // gulir dikembalikan ke atas; bila pengajar punya posisi untuk halaman ini, gulirTerapkan() menyusul saat gambar termuat
        if (sesi.total && n < sesi.total) { var nx = new Image(); nx.src = urlGambar(n + 1); }   // hangatkan cache peramban untuk halaman berikutnya
        selesai(true);
      };
      im.onerror = function () {
        if (++coba < 6) { pesanPdf('Memuat halaman ' + n + '…'); setTimeout(muat, 1500); }
        else { pesanPdf('Halaman ' + n + ' belum tersedia atau gagal dimuat. Dicoba lagi otomatis.'); selesai(false); }
      };
      im.src = u;
    })();
  }
  /* mode lama: PDF dari alamat URL, dirender di perangkat penonton */
  function gambarPdf(n) {
    if (sibuk || n === tampil) return; sibuk = true; pesanPdf('');
    LivePdf.render($('cv'), n).then(function () { tampil = n; label(n); gulirTerapkan(); })
      .catch(function () { pesanPdf('Halaman tidak dapat ditampilkan.'); }).then(function () { sibuk = false; if ((ikut || kKitab) && hal !== tampil) gambar(hal); });
  }
  function gambar(n) { if (kunci) gambarImg(n); else gambarPdf(n); }
  /* ---- kitab terkunci / gulir tersinkron ---- */
  function kgCocok() { return !!kg && (kg.v || null) === (kunci || null); }
  function kgSegar() { return kgCocok() && Date.now() - kgAt < 6000; }   // posisi dari relay lebih dipercaya daripada polling DB yang bisa tertinggal beberapa detik
  function gulirTerapkan() {
    var k = $('kanvas'); if (!k || !kg || !kgCocok() || kg.h !== tampil || !(ikut || kKitab)) return;
    var mx = k.scrollWidth - k.clientWidth, my = k.scrollHeight - k.clientHeight;
    prog(); if (my > 0) k.scrollTop = Math.round((+kg.y || 0) * my); if (mx > 0) k.scrollLeft = Math.round((+kg.x || 0) * mx);
  }
  function kgTerima(m) {
    if (!m || !Number.isInteger(m.h)) return;
    kg = { h: m.h, x: +m.x || 0, y: +m.y || 0, v: m.v }; kgAt = Date.now();
    if (!kgCocok() || !(ikut || kKitab)) return;
    if (m.h !== hal) { hal = m.h; gambar(hal); } else gulirTerapkan();
  }
  function modeTampil() {
    $('prev').hidden = $('next').hidden = kKitab; $('ikuti').hidden = kKitab || ikut;
    $('kitabKunciInfo').hidden = !kKitab; $('kanvas').classList.toggle('kunci', kKitab);
    $('alatLapis').hidden = !kAlat; $('alatSamakan').hidden = kAlat;
    if (kAlat) $('alatBingkai').setAttribute('inert', ''); else $('alatBingkai').removeAttribute('inert');
    $('alatHint').textContent = kAlat ? 'Pengajar sedang memegang kendali: gerakannya tampil di sini secara langsung.' : 'Gerakan pengajar tampil di sini secara langsung. Anda juga boleh mencoba sendiri; bila terasa berbeda dari pengajar, ketuk “Samakan dengan pengajar”.';
  }
  function modeSet(a, b, dariRelay) {
    a = !!a; b = !!b; if (dariRelay) modeAt = Date.now();
    var baruKunci = a && !kKitab; kKitab = a; kAlat = b;
    if (baruKunci) { ikut = true; hal = kgSegar() ? kg.h : (sesi ? sesi.halaman : hal); if (sesi && (kunci || pdfUrl)) gambar(hal); gulirTerapkan(); }
    modeTampil();
  }
  function umumSet(v, dariRelay) {
    v = !!v; if (dariRelay) umumAt = Date.now();
    if (v === umum) return; umum = v;
    if (aRef && aEntry && aEntry.terkunci) alatMuatUlang();   // jalur muat alat terkunci berubah (isi titipan ↔ khusus anggota)
  }
  /* ---- audio langsung (relay) ---- */
  function auMati() { if (au) { au.stop(); au = null; } $('audioMain').textContent = '▶ Dengarkan di sini'; }
  if ($('audioMain')) $('audioMain').onclick = function () {
    if (au) { auMati(); $('audioInfo').textContent = 'Audio dihentikan. Ketuk tombol untuk mendengarkan lagi.'; return; }
    if (!sesi || !RELAY) return;
    $('audioMain').textContent = '■ Hentikan';
    au = LiveAudio.dengar({ url: RELAY + '/dengar?s=' + encodeURIComponent(sesi.id) + '&k=' + KUNCI, onStatus: function (k, t) { $('audioInfo').textContent = t; } });
  };
  /* ---- alat peraga: dimuat sendiri oleh tiap peserta; gerakan pengajar diputar ulang dari relay ---- */
  var LA = window.LiveAlat, aRef = null, aNonce = null, aEntry = null, aDoc = null, aBatal = null, aTunda = {}, aMulai = null, aQ = 0, aTry = 0, aTmr = null;
  function aInfo(t) { $('alatInfo').textContent = t || ''; }
  function aPutar(e) {
    if (!e || typeof e !== 'object' || typeof e.n !== 'string') return;
    if (aDoc && e.n === aNonce) { LA.putar(aDoc, e); return; }
    var l = aTunda[e.n] || (aTunda[e.n] = []); if (l.length < 400) l.push(e);
    var k = Object.keys(aTunda); if (k.length > 3) delete aTunda[k[0]];
  }
  function aPesan(m) {
    if (m.t === 'e') { if (m.q > aQ) aQ = m.q; aPutar(m); }
    else if (m.t === 'mulai' && m.n) {
      // pertama kali (atau alat baru): putar seluruh log. Sambung ulang pada alat yang sama: hanya yang tertinggal (nomor urut q > yang sudah diterapkan)
      var baru = m.n !== aMulai; if (baru) { aMulai = m.n; aQ = 0; }
      (m.log || []).forEach(function (x) { try { var o = JSON.parse(x); if (baru || !(o.q <= aQ)) { if (o.q > aQ) aQ = o.q; aPutar(o); } } catch (e) { } });
    }
  }
  function aTutup() {   // menutup alat saja; saluran relay tetap hidup (membawa juga mode kunci dan posisi kitab)
    if (aBatal) { aBatal(); aBatal = null; }
    clearTimeout(aTmr);
    aRef = aNonce = aEntry = aDoc = aMulai = null; aQ = 0; aTunda = {}; $('alatBingkai').removeAttribute('src'); $('alatBingkai').removeAttribute('srcdoc'); aInfo('');
  }
  /* saluran relay persisten: peristiwa alat, mode kunci, izin umum, posisi kitab */
  function kPesan(m) {
    if (!m || typeof m !== 'object') return;
    if (m.t === 'e') aPesan(m);
    else if (m.t === 'mulai') {
      if (m.mode) modeSet(m.mode.a, m.mode.b, true);
      if (typeof m.umum === 'boolean') umumSet(m.umum, true);
      if (m.kg) kgTerima(m.kg);
      aPesan(m);
    }
    else if (m.t === 'mode') modeSet(m.a, m.b, true);
    else if (m.t === 'umum') umumSet(m.v, true);
    else if (m.t === 'kg') kgTerima(m);
    else if (m.t === 'baru' || m.t === 'tutup') setTimeout(segarkan, 400);   // alat berganti: tak perlu menunggu polling berikutnya
    else if (m.t === 'isi') { if (m.n === aNonce && !aDoc && aEntry && aEntry.terkunci && umum) { aTry = 0; aMuatIsi(aEntry, aNonce); } }
  }
  function kanalMulai() {
    if (kanal || !RELAY || !sesi || !LA) return;
    kanal = LA.dengar({ url: RELAY + '/alat-dengar?s=' + encodeURIComponent(sesi.id) + '&k=' + KUNCI, onPesan: kPesan,
      onStatus: function (k) { if (k === 'penuh') aInfo('Peragaan langsung penuh; alat tetap bisa dicoba sendiri.'); } });
  }
  function kanalStop() { if (kanal) { kanal.stop(); kanal = null; } }
  function kanalUlang() { kanalStop(); kanalMulai(); }   // soket baru = relay mengirim ulang log lengkap
  /* jalur biasa: alat publik dimuat sendiri; alat terkunci lewat buka.html (peserta non-anggota melihat "khusus anggota") */
  function aMuatNormal(e, n) {
    aBatal = LA.muat($('alatBingkai'), e, function (doc) {
      aBatal = null; if (aNonce !== n) return;
      if (!doc) { aInfo(e.terkunci ? 'Alat ini khusus anggota. Masuk sebagai anggota (di tab baru) lalu muat ulang halaman ini.' : 'Alat tidak dapat dimuat.'); return; }
      aSiap(doc, n);
    });
  }
  function aSiap(doc, n) {
    aDoc = doc; aInfo('');
    (aTunda[n] || []).forEach(function (x) { LA.putar(doc, x); }); delete aTunda[n];
  }
  /* alat terkunci + pengajar menyalakan "untuk umum": isi HTML-nya diambil dari relay (butuh kursi); belum ada → tunggu, lalu cadangan jalur biasa */
  function aMuatIsi(e, n) {
    clearTimeout(aTmr);
    if (aNonce !== n) return;
    fetch(HTTP + '/alat-isi?s=' + encodeURIComponent(sesi.id) + '&n=' + encodeURIComponent(n) + '&k=' + KUNCI, { cache: 'no-store' }).then(function (r) {
      if (aNonce !== n) return;
      if (r.ok) return r.text().then(function (html) {
        if (aNonce !== n) return;
        aBatal = LA.muatTeks($('alatBingkai'), html, function (doc) { aBatal = null; if (aNonce !== n) return; if (doc) aSiap(doc, n); else aInfo('Alat tidak dapat dimuat.'); });
      });
      if (r.status === 404 && ++aTry < 6) { aInfo('Menunggu pengajar menyiapkan alat…'); aTmr = setTimeout(function () { aMuatIsi(e, n); }, 1500); return; }
      aMuatNormal(e, n);
    }).catch(function () { if (aNonce !== n) return; if (++aTry < 6) aTmr = setTimeout(function () { aMuatIsi(e, n); }, 1500); else aMuatNormal(e, n); });
  }
  function aMuatAlat(e, n) { aTry = 0; if (e.terkunci && umum && HTTP) aMuatIsi(e, n); else aMuatNormal(e, n); }
  function alatMuatUlang() {   // "Samakan dengan pengajar" dan perubahan izin umum: muat ulang alat + putar ulang seluruh gerakan pengajar
    if (!sesi) return; var s0 = sesi;
    aTutup(); kanalUlang(); alatTerapkan(s0);
  }
  function alatTerapkan(s) {   // true = alat sedang ditampilkan (menggantikan kitab)
    if (!s.alat_ref || !s.alat_nonce || s.status !== 'live') { if (aRef) aTutup(); $('alatBox').hidden = true; return false; }
    $('alatBox').hidden = false; $('pdfBox').hidden = true;
    if (s.alat_ref === aRef && s.alat_nonce === aNonce) return true;
    aTutup(); aRef = s.alat_ref; aNonce = s.alat_nonce; aInfo('Memuat alat…');
    var n = aNonce, r = aRef;
    LA.muatManifest().then(function (m) {
      if (aNonce !== n) return;
      var e = m.per[r]; if (!e) { aInfo('Alat tidak dikenal.'); return; }
      aEntry = e; $('alatJudul').textContent = e.judul + (e.terkunci ? ' 🔒' : '');
      aMuatAlat(e, n);
      kanalMulai();
    }).catch(function () { if (aNonce === n) aInfo('Daftar alat gagal dimuat.'); });
    return true;
  }
  function terapkan(s) {
    sesi = s;
    if (s.status === 'live') kanalMulai(); else { kanalStop(); if (kKitab || kAlat) modeSet(false, false); }
    if ('kunci_kitab' in s && Date.now() - modeAt > 5000) modeSet(s.kunci_kitab, s.kunci_alat, false);
    if ('alat_umum' in s && Date.now() - umumAt > 5000) umumSet(s.alat_umum, false);
    if ($('audioMain')) { $('audioMain').hidden = !(RELAY && s.status === 'live'); if (RELAY && s.status === 'live' && !au) $('audioInfo').textContent = 'Ketuk “Dengarkan di sini” untuk audio langsung. Cadangan: Facebook Live.'; if (s.status !== 'live' && au) { auMati(); $('audioInfo').textContent = 'Kajian ini sudah selesai.'; } } $('judul').textContent = s.judul; $('sub').textContent = s.pengajar_nama || '';
    $('status').textContent = s.status === 'live' ? '● Sedang live' : 'Kajian ini sudah selesai';
    if (s.fb_url) $('fbBtn').href = s.fb_url;
    if (LA && alatTerapkan(s)) return;
    if (!s.pdf_url && !s.pdf_kunci) { $('pdfBox').hidden = true; return; }
    $('pdfBox').hidden = false; $('pdfJudul').textContent = s.pdf_judul || '';
    if (ikut || kKitab) hal = kgSegar() ? kg.h : s.halaman;   // penonton yang sedang membuka halaman sendiri tidak diseret
    if (s.pdf_kunci) {
      if (!HTTP) { pesanPdf('Kitab belum bisa ditampilkan (alamat relay belum diisi).'); return; }
      $('cv').hidden = true; $('gb').hidden = false;
      if (s.pdf_kunci !== kunci) { kunci = s.pdf_kunci; pdfUrl = null; tampil = 0; ikut = true; $('ikuti').hidden = true; if (kg && !kgCocok()) kg = null; if (kgCocok()) hal = kg.h; }
      if (ikut) gambar(hal); return;
    }
    $('cv').hidden = false; $('gb').hidden = true; kunci = null;
    if (s.pdf_url !== pdfUrl) {
      pdfUrl = s.pdf_url; tampil = 0; pesanPdf('Memuat kitab…');
      LivePdf.open(pdfUrl).then(function (n) { sesi.total = sesi.total || n; pesanPdf(''); gambar(ikut ? hal : 1); })
        .catch(function (e) { pesanPdf(e.message || 'Kitab gagal dimuat.'); });
    } else if (ikut) gambar(hal);
  }
  function geser(d) { if (kKitab) return; ikut = false; $('ikuti').hidden = false; var n = Math.max(1, Math.min(sesi && sesi.total || 9999, (tampil || hal) + d)); hal = n; gambar(n); }
  $('prev').onclick = function () { geser(-1); }; $('next').onclick = function () { geser(1); };
  $('ikuti').onclick = function () { ikut = true; $('ikuti').hidden = true; if (sesi) { hal = kgCocok() ? kg.h : sesi.halaman; gambar(hal); gulirTerapkan(); } };
  $('alatSamakan').onclick = alatMuatUlang;
  $('kanvas').addEventListener('scroll', function () {   // peserta menggulir sendiri (bukan program) → lepas dari pengajar
    if (kKitab || Date.now() - progGulir < 400 || !sesi) return;
    if (ikut) { ikut = false; modeTampil(); }
  });
  $('gb').addEventListener('load', function () { gulirTerapkan(); });
  /* ---- sesi pertanyaan (supabase-live-tanya.sql): hanya muncul bila ruang_keadaan mengembalikan 'tanya' ---- */
  var tanyaSig = '', tanyaTunda = 0, tanyaData = null;
  function pesanT(t) { $('tanyaPesan').textContent = t || ''; }
  function segarkan() { clearTimeout(tmrPutar); putaran(); }
  function tanyaAksi(fn, body) {
    if (!id) return Promise.resolve(null);
    return rpc(fn, Object.assign({ p_sesi: id, p_kunci: KUNCI }, body)).then(function (r) {
      if (r && r.tak) { pesanT('Fitur tanya belum aktif di server.'); return null; }
      if (!r) { pesanT('Jaringan bermasalah. Coba lagi.'); return null; }
      return r.j;
    });
  }
  function tombol(teks, fn) { var b = document.createElement('button'); b.type = 'button'; b.className = 'btn btn-outline'; b.textContent = teks; b.onclick = fn; return b; }
  var STATUS_T = { sedang: 'Sedang dijawab pengajar', dijawab: 'Sudah dijawab', dilewati: 'Dilewati pengajar' };
  function tanyaTerapkan(t) {
    var box = $('tanyaBox');
    if (!t) { box.hidden = true; tanyaSig = ''; tanyaData = null; return; }
    box.hidden = false; tanyaData = t;
    var sig = JSON.stringify(t); if (sig === tanyaSig) return; tanyaSig = sig;
    box.classList.toggle('buka', !!t.buka);
    $('tanyaRingkas').textContent = 'Tanya pengajar' + (t.buka ? ' · dibuka' : ' · ditutup') + (t.menunggu ? ' (' + t.menunggu + ' dalam antrean)' : '');
    $('tanyaBaru').hidden = !t.buka; $('tanyaTutupInfo').hidden = !!t.buka;
    var us = $('tanyaSaya'); us.textContent = ''; $('tanyaSayaJudul').hidden = !t.saya.length;
    t.saya.forEach(function (q) {
      var li = document.createElement('li'), a = document.createElement('span'), m = document.createElement('span'), ak = document.createElement('div');
      a.textContent = q.isi; m.className = 'lv-meta';
      m.textContent = (q.status === 'menunggu' ? 'Antrean Anda: ke-' + q.no + ' dari ' + t.menunggu : STATUS_T[q.status]) + ' · ' + (q.tampil ? 'ditampakkan ke peserta lain' : 'tertutup');
      ak.className = 'lv-aksi';
      if (q.status === 'menunggu' || q.status === 'sedang') ak.appendChild(tombol(q.tampil ? 'Tutup dari peserta lain' : 'Tampakkan ke peserta lain', function () {
        tanyaAksi('tanya_ubah_tampil', { p_id: q.id, p_tampil: !q.tampil }).then(function (j) { if (j === false) pesanT('Pertanyaan tidak bisa diubah lagi.'); if (j !== null) segarkan(); });
      }));
      if (q.status === 'menunggu') ak.appendChild(tombol('Tarik', function () {
        tanyaAksi('tanya_tarik', { p_id: q.id }).then(function (j) { if (j === false) pesanT('Pertanyaan sudah tidak bisa ditarik.'); if (j !== null) segarkan(); });
      }));
      li.className = 'saya'; li.appendChild(a); li.appendChild(m); if (ak.children.length) li.appendChild(ak); us.appendChild(li);
    });
    var up = $('tanyaPublik'); up.textContent = '';
    t.publik.forEach(function (q) {
      var li = document.createElement('li'), a = document.createElement('span'), m = document.createElement('span');
      a.textContent = q.isi; m.className = 'lv-meta';
      m.textContent = (q.status === 'sedang' ? 'Sedang dijawab' : 'Antrean ke-' + q.no) + ' · ' + q.nama + (q.saya ? ' (Anda)' : '');
      if (q.status === 'sedang') li.className = 'sedang'; li.appendChild(a); li.appendChild(m); up.appendChild(li);
    });
    if (!t.publik.length) { var e = document.createElement('li'); e.className = 'lv-hint'; e.textContent = 'Belum ada pertanyaan yang ditampakkan.'; up.appendChild(e); }
    $('tanyaTertutup').textContent = t.tertutup ? '+' + t.tertutup + ' pertanyaan tertutup (tidak ditampilkan di sini).' : '';
  }
  var ALASAN_T = { kunci: 'Kunci peserta tidak sah. Muat ulang halaman ini.', tutup: 'Sesi tanya sedang ditutup.', kursi: 'Anda belum memegang kursi. Tunggu sebentar lalu coba lagi.',
    isi: 'Pertanyaan harus 3–300 huruf.', batas: 'Anda sudah punya 3 pertanyaan yang menunggu. Tunggu dijawab atau tarik salah satunya.', penuh: 'Antrean pertanyaan sudah penuh.' };
  try { $('tanyaNama').value = localStorage.getItem('jazmi_live_nama') || ''; } catch (e) { }
  $('tanyaIsi').oninput = function () { $('tanyaHitung').textContent = $('tanyaIsi').value.length; };
  $('tanyaKirim').onclick = function () {
    var isi = $('tanyaIsi').value.trim(), nama = $('tanyaNama').value.trim();
    if (isi.length < 3) return pesanT('Tulis pertanyaan minimal 3 huruf.');
    if (Date.now() < tanyaTunda) return pesanT('Tunggu ' + Math.ceil((tanyaTunda - Date.now()) / 1000) + ' detik sebelum mengirim lagi.');
    try { localStorage.setItem('jazmi_live_nama', nama); } catch (e) { }
    $('tanyaKirim').disabled = true; pesanT('Mengirim…');
    tanyaAksi('tanya_kirim', { p_nama: nama, p_isi: isi, p_tampil: $('tanyaTampil').checked }).then(function (j) {
      $('tanyaKirim').disabled = false;
      if (!j) return;
      if (j.ok) { $('tanyaIsi').value = ''; $('tanyaHitung').textContent = '0'; tanyaTunda = Date.now() + 20000; pesanT('Pertanyaan terkirim.'); segarkan(); return; }
      if (j.alasan === 'jeda') { tanyaTunda = Date.now() + (j.detik || 20) * 1000; return pesanT('Tunggu ' + (j.detik || 20) + ' detik sebelum mengirim lagi.'); }
      pesanT(ALASAN_T[j.alasan] || 'Pertanyaan tidak bisa dikirim.'); segarkan();
    });
  };
  /* ---- kursi: layar "Majelis penuh" ---- */
  function tinggalkan() {   // kursi tidak dipegang: hentikan audio dan alat, sembunyikan kitab
    auMati(); aTutup(); kanalStop(); kg = null; modeSet(false, false); sesi = null; kunci = null; pdfUrl = null; tampil = 0; tanyaTerapkan(null);
    $('alatBox').hidden = true; $('pdfBox').hidden = true;
  }
  function tampilPenuh(k, s) {
    tinggalkan();
    var t = k.alasan === 'dikunci' ? ['Majelis ditutup', 'Pengajar menutup majelis untuk peserta baru.']
          : k.alasan === 'penuh' ? ['Majelis penuh (' + k.terisi + '/' + k.kapasitas + ')', 'Semua kursi terisi. Bila ada yang keluar, Anda masuk otomatis.']
          : ['Belum bisa bergabung', 'Muat ulang halaman ini. Bila tetap begini, hubungi pengelola.'];
    $('penuhJudul').textContent = t[0]; $('penuhIsi').textContent = t[1];
    $('judul').textContent = s.judul || 'Ruang Kajian'; $('sub').textContent = s.pengajar_nama || ''; $('status').textContent = '● Sedang live';
    if (s.fb_url) $('penuhFb').href = s.fb_url;
    $('penuh').hidden = false; document.querySelector('.lv-audio').hidden = true;
  }
  function adaKursi() { $('penuh').hidden = true; document.querySelector('.lv-audio').hidden = false; }
  function jadwal(ms) { clearTimeout(tmrPutar); tmrPutar = setTimeout(putaran, ms); }
  function belumAda() { if (!sesi) { $('status').textContent = 'Belum ada kajian langsung saat ini.'; $('judul').textContent = 'Ruang Kajian'; $('sub').textContent = 'Kajian rutin: Selasa 16.45 · Rabu Maghrib–Isya · Kamis sore'; } }
  /* cara lama (sebelum supabase-live-kursi.sql dipasang): baca tabel langsung, tanpa kursi */
  function putaranLama() {
    var q = id ? 'id=eq.' + encodeURIComponent(id) + '&limit=1'
      : 'status=eq.live&mulai=gte.' + encodeURIComponent(new Date(Date.now() - 6 * 3600e3).toISOString()) + '&order=mulai.desc&limit=1';
    api('select=*&' + q).then(function (a) {
      if (a === null) { if (!sesi) $('status').textContent = 'Tidak dapat terhubung. Mencoba lagi…'; return; }
      if (!a[0]) { belumAda(); return; }
      id = a[0].id; terapkan(a[0]); tanyaTerapkan(null);
    }).then(function () { jadwal(4000); });
  }
  function putaran() {
    if (document.hidden && !au) return jadwal(4000);      // tab di latar tanpa audio: tidak perlu; dengan audio, kursi tetap diperpanjang
    if (lama) return putaranLama();
    if (!id) {   // belum tahu sesi mana: cari yang sedang live, lalu langsung minta kursi
      api('select=id&status=eq.live&mulai=gte.' + encodeURIComponent(new Date(Date.now() - 6 * 3600e3).toISOString()) + '&order=mulai.desc&limit=1').then(function (a) {
        if (a === null) { $('status').textContent = 'Tidak dapat terhubung. Mencoba lagi…'; return jadwal(4000); }
        if (!a[0]) { belumAda(); return jadwal(4000); }
        id = a[0].id; putaran();
      });
      return;
    }
    rpc('ruang_keadaan', { p_sesi: id, p_kunci: KUNCI }).then(function (r) {
      if (r && r.tak) { lama = true; return putaranLama(); }
      if (!r) { if (!sesi) $('status').textContent = 'Tidak dapat terhubung. Mencoba lagi…'; return jadwal(4000); }
      if (!r.j) { belumAda(); return jadwal(15000); }
      if (!r.j.kursi.punya) { tampilPenuh(r.j.kursi, r.j.sesi); return jadwal(15000); }   // percobaan ulang otomatis tiap 15 detik
      adaKursi(); terapkan(r.j.sesi); tanyaTerapkan(r.j.sesi.status === 'live' ? (r.j.tanya || null) : null); jadwal(4000);
    });
  }
  addEventListener('pagehide', function () { if (id && !lama) rpc('kursi_keluar', { p_sesi: id, p_kunci: KUNCI }, true); });
  addEventListener('resize', function () { if (kunci) return; var t = tampil; tampil = 0; if (sesi && pdfUrl) gambar(t || hal); });
  putaran();
})();
