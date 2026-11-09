/* JAZMI — Audio Kajian Langsung (tanpa SFU/TURN).
   Pengajar: mikrofon → 16 kHz mono → IMA-ADPCM 4-bit (±64 kbps) → WebSocket → relay (Cloudflare Durable Object).
   Penonton: WebSocket → decode ADPCM → Web Audio (jadwal tanpa celah). Tidak bergantung pada codec browser,
   sehingga jalan di Chrome, Firefox, dan Safari/iPhone. Tiap blok 250 ms berdiri sendiri (punya kondisi awal),
   jadi penonton boleh masuk kapan saja dan paket hilang tidak merusak blok berikutnya. */
(function (root) {
  'use strict';
  var RATE = 16000, BLOK = 4000, VER = 1; // 4000 sampel = 250 ms
  var ST = [7, 8, 9, 10, 11, 12, 13, 14, 16, 17, 19, 21, 23, 25, 28, 31, 34, 37, 41, 45, 50, 55, 60, 66, 73, 80, 88, 97, 107, 118, 130, 143, 157, 173, 190, 209, 230, 253, 279, 307, 337, 371, 408, 449, 494, 544, 598, 658, 724, 796, 876, 963, 1060, 1166, 1282, 1411, 1552, 1707, 1878, 2066, 2272, 2499, 2749, 3024, 3327, 3660, 4026, 4428, 4871, 5358, 5894, 6484, 7132, 7845, 8630, 9493, 10442, 11487, 12635, 13899, 15289, 16818, 18500, 20350, 22385, 24623, 27086, 29794, 32767];
  var IT = [-1, -1, -1, -1, 2, 4, 6, 8, -1, -1, -1, -1, 2, 4, 6, 8];

  /* ---------- codec ---------- */
  function enkode(s, seq) { // s: Int16Array → Uint8Array (10 byte kepala + nibble)
    var n = s.length, out = new Uint8Array(10 + Math.ceil((n - 1) / 2)), dv = new DataView(out.buffer);
    var pred = s[0], idx = 0, p = 10, tinggi = false, cur = 0;
    out[0] = VER; dv.setUint32(1, seq >>> 0, true); dv.setUint16(5, n, true); dv.setInt16(7, pred, true); out[9] = 0;
    for (var i = 1; i < n; i++) {
      var step = ST[idx], diff = s[i] - pred, code = 0;
      if (diff < 0) { code = 8; diff = -diff; }
      var vp = step >> 3;
      if (diff >= step) { code |= 4; diff -= step; vp += step; }
      step >>= 1; if (diff >= step) { code |= 2; diff -= step; vp += step; }
      step >>= 1; if (diff >= step) { code |= 1; vp += step; }
      pred += (code & 8) ? -vp : vp; if (pred > 32767) pred = 32767; else if (pred < -32768) pred = -32768;
      idx += IT[code]; if (idx < 0) idx = 0; else if (idx > 88) idx = 88;
      if (!tinggi) { cur = code; tinggi = true; } else { out[p++] = cur | (code << 4); tinggi = false; }
    }
    if (tinggi) out[p++] = cur;
    return out;
  }
  function dekode(u8) { // Uint8Array → { seq, pcm: Float32Array } atau null bila rusak
    if (!u8 || u8.length < 10 || u8[0] !== VER) return null;
    var dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength), n = dv.getUint16(5, true);
    if (n < 2 || n > 16000 || u8.length < 10 + Math.ceil((n - 1) / 2)) return null;
    var pred = dv.getInt16(7, true), idx = u8[9]; if (idx > 88) return null;
    var out = new Float32Array(n); out[0] = pred / 32768;
    for (var i = 1; i < n; i++) {
      var b = u8[10 + ((i - 1) >> 1)], code = ((i - 1) & 1) ? (b >> 4) : (b & 15);
      var step = ST[idx], vp = step >> 3;
      if (code & 4) vp += step; if (code & 2) vp += step >> 1; if (code & 1) vp += step >> 2;
      pred += (code & 8) ? -vp : vp; if (pred > 32767) pred = 32767; else if (pred < -32768) pred = -32768;
      idx += IT[code]; if (idx < 0) idx = 0; else if (idx > 88) idx = 88;
      out[i] = pred / 32768;
    }
    return { seq: dv.getUint32(1, true), pcm: out };
  }

  /* ---------- pengubah laju sampel (rata-rata berbobot = penapis kotak; cukup untuk suara) ---------- */
  function Resampler(inRate, outRate) {
    this.r = inRate / outRate; this.pos = 0; this.sisa = new Float32Array(0);
  }
  Resampler.prototype.proses = function (inp) {
    var x = new Float32Array(this.sisa.length + inp.length); x.set(this.sisa); x.set(inp, this.sisa.length);
    var out = [], r = this.r, pos = this.pos;
    if (r === 1) { this.sisa = new Float32Array(0); return inp; }
    while (pos + r <= x.length) {
      var a = pos, b = pos + r, sum = 0;
      for (var i = Math.floor(a), e = Math.ceil(b); i < e; i++) sum += x[i] * (Math.min(b, i + 1) - Math.max(a, i));
      out.push(sum / r); pos = b;
    }
    var k = Math.floor(pos); this.sisa = x.slice(k); this.pos = pos - k;
    return Float32Array.from(out);
  };

  /* ---------- PENGAJAR ---------- */
  var WORKLET = "class P extends AudioWorkletProcessor{constructor(){super();this.b=new Float32Array(1024);this.i=0}" +
    "process(inp){var c=inp[0]&&inp[0][0];if(!c)return true;for(var k=0;k<c.length;k++){this.b[this.i++]=c[k];" +
    "if(this.i===1024){this.port.postMessage(this.b.slice(0));this.i=0}}return true}}registerProcessor('cap',P)";

  async function siar(o) { // o: { url, getToken(): Promise<string>, onStatus(t), onLevel(0..1), onPendengar(n) }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error('Peramban tidak mendukung mikrofon (butuh HTTPS).');
    var stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: false, noiseSuppression: true, autoGainControl: true } });
    var AC = root.AudioContext || root.webkitAudioContext, ctx = new AC();
    if (ctx.state === 'suspended') await ctx.resume();
    var sumber = ctx.createMediaStreamSource(stream), node = null, sp = null, mati = false, jeda = false, seq = 0;
    var rs = new Resampler(ctx.sampleRate, RATE), antre = new Int16Array(BLOK), isi = 0, ws = null, coba = 0, wake = null, tmrSambung = null;
    var senyap = ctx.createGain(); senyap.gain.value = 0; senyap.connect(ctx.destination); // agar graf aktif tanpa suara keluar
    function status(t) { if (o.onStatus) o.onStatus(t); }
    function kirimBlok() { // antre penuh → enkode & kirim
      var f = enkode(antre, seq++); isi = 0;
      if (ws && ws.readyState === 1 && ws.bufferedAmount < 65536) ws.send(f);
    }
    function terima(f32) {
      var tot = 0, i;
      for (i = 0; i < f32.length; i++) tot += f32[i] * f32[i];
      if (o.onLevel) o.onLevel(Math.min(1, Math.sqrt(tot / f32.length) * 4));
      if (jeda) return;
      var m = rs.proses(f32);
      for (i = 0; i < m.length; i++) {
        var v = Math.max(-1, Math.min(1, m[i])); antre[isi++] = v < 0 ? v * 32768 : v * 32767;
        if (isi === BLOK) kirimBlok();
      }
    }
    if (ctx.audioWorklet && root.Blob && root.URL) {
      var url = URL.createObjectURL(new Blob([WORKLET], { type: 'application/javascript' }));
      await ctx.audioWorklet.addModule(url); URL.revokeObjectURL(url);
      node = new AudioWorkletNode(ctx, 'cap'); node.port.onmessage = function (e) { terima(e.data); };
      sumber.connect(node); node.connect(senyap);
    } else { // cadangan untuk peramban lama
      sp = ctx.createScriptProcessor(2048, 1, 1); sp.onaudioprocess = function (e) { terima(new Float32Array(e.inputBuffer.getChannelData(0))); };
      sumber.connect(sp); sp.connect(senyap);
    }
    function sambung() {
      if (mati) return; status(coba ? 'Menyambung ulang…' : 'Menyambung ke relay…');
      Promise.resolve(o.getToken()).then(function (tok) {
        if (mati) return;
        ws = new WebSocket(o.url, ['jazmi', tok]); ws.binaryType = 'arraybuffer';
        ws.onopen = function () { coba = 0; status(jeda ? 'Terhubung — dibisukan' : '● Mengudara'); if (jeda) ws.send(JSON.stringify({ t: 'jeda', v: true })); };
        ws.onmessage = function (e) {
          if (typeof e.data !== 'string') return;
          try { var j = JSON.parse(e.data); if (j.t === 'n' && o.onPendengar) o.onPendengar(j.n); } catch (x) { }
        };
        ws.onclose = function (e) {
          if (mati) return;
          if (e.code === 4003) { status('Ditolak: akun bukan pengajar atau sesi sudah berakhir.'); mati = true; selesai(); return; }
          if (e.code === 4000) { status('Dipakai siaran lain (studio lain dibuka). Audio dihentikan.'); mati = true; selesai(); return; }
          coba++; status('Terputus. Mencoba lagi…'); tmrSambung = setTimeout(sambung, Math.min(10000, 1000 * coba));
        };
        ws.onerror = function () { };
      }).catch(function () { coba++; status('Gagal mengambil sesi masuk. Mencoba lagi…'); tmrSambung = setTimeout(sambung, 3000); });
    }
    function selesai() {
      mati = true; clearTimeout(tmrSambung);
      try { if (ws) ws.close(1000); } catch (e) { }
      try { stream.getTracks().forEach(function (t) { t.stop(); }); } catch (e) { }
      try { ctx.close(); } catch (e) { }
      try { if (wake) wake.release(); } catch (e) { }
      if (o.onLevel) o.onLevel(0);
    }
    if (navigator.wakeLock && navigator.wakeLock.request) { try { wake = await navigator.wakeLock.request('screen'); } catch (e) { } }
    document.addEventListener('visibilitychange', function re() { // Wake Lock lepas bila tab disembunyikan; minta lagi
      if (mati) { document.removeEventListener('visibilitychange', re); return; }
      if (!document.hidden && navigator.wakeLock) navigator.wakeLock.request('screen').then(function (w) { wake = w; }).catch(function () { });
    });
    sambung();
    return {
      stop: function () { selesai(); status('Audio dimatikan'); },
      bisu: function (v) { jeda = !!v; isi = 0; if (ws && ws.readyState === 1) ws.send(JSON.stringify({ t: 'jeda', v: jeda })); status(jeda ? 'Terhubung — dibisukan' : '● Mengudara'); }
    };
  }

  /* iPhone iOS <= 16.3: Web Audio ikut dibisukan tombol senyap fisik. Memutar <audio> (berkas WAV senyap, berulang)
     dari ketukan pengguna memindahkan sesi audio ke kategori "playback" sehingga tetap bunyi. */
  function bukaSenyap() {
    try {
      if (typeof document === 'undefined') return null;
      var n = 4000, b = new Uint8Array(44 + n), v = new DataView(b.buffer);
      function s(o, x) { for (var i = 0; i < x.length; i++) b[o + i] = x.charCodeAt(i); }
      s(0, 'RIFF'); v.setUint32(4, 36 + n, true); s(8, 'WAVEfmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
      v.setUint32(24, 8000, true); v.setUint32(28, 8000, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true); s(36, 'data'); v.setUint32(40, n, true);
      for (var i = 44; i < b.length; i++) b[i] = 128; // 8-bit tanpa tanda: 128 = hening
      var bin = ''; for (var j = 0; j < b.length; j++) bin += String.fromCharCode(b[j]);
      var a = document.createElement('audio');
      a.setAttribute('playsinline', ''); a.setAttribute('aria-hidden', 'true');
      a.loop = true; a.src = 'data:audio/wav;base64,' + btoa(bin);
      var pr = a.play(); if (pr && pr.catch) pr.catch(function () { });
      return a;
    } catch (e) { return null; }
  }

  /* ---------- PENONTON ---------- */
  function dengar(o) { // o: { url, onStatus(kode, teks) } — HARUS dipanggil dari ketukan pengguna (aturan autoplay)
    var senyapEl = bukaSenyap(); // harus sinkron di dalam ketukan pengguna
    var AC = root.AudioContext || root.webkitAudioContext, ctx = new AC();
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) { } // iPhone: tetap bunyi saat tombol senyap aktif (bila didukung)
    if (ctx.state === 'suspended') ctx.resume();
    var ws = null, mati = false, coba = 0, tmr = null, jaga = null, nextT = 0, terakhir = 0, hadir = false, jeda = false, pakai16 = true, tmrSambung = null;
    var TARGET = 0.7, MAKS = 2.5; // detik: penyangga awal; di atasnya blok dibuang agar tidak makin tertinggal
    function st(k, t) { if (o.onStatus) o.onStatus(k, t); }
    function putar(pcm) {
      var now = ctx.currentTime;
      if (nextT < now + 0.03) nextT = now + TARGET;       // kehabisan / awal: isi penyangga lagi
      else if (nextT - now > MAKS) return;                 // terlalu jauh di depan (setelah macet): lewati blok ini
      var buf;
      try { buf = ctx.createBuffer(1, pcm.length, pakai16 ? RATE : 48000); }
      catch (e) { pakai16 = false; buf = null; }
      var data = pcm;
      if (!pakai16) { // cadangan: naikkan ke 48 kHz (interpolasi linear) bila peramban menolak buffer 16 kHz
        data = new Float32Array(pcm.length * 3);
        for (var i = 0; i < pcm.length; i++) { var a = pcm[i], b = i + 1 < pcm.length ? pcm[i + 1] : a; data[i * 3] = a; data[i * 3 + 1] = a + (b - a) / 3; data[i * 3 + 2] = a + (b - a) * 2 / 3; }
        buf = ctx.createBuffer(1, data.length, 48000);
      }
      buf.copyToChannel(data, 0);
      var s = ctx.createBufferSource(); s.buffer = buf; s.connect(ctx.destination); s.start(nextT); nextT += buf.duration;
    }
    function sambung() {
      if (mati) return;
      st('menyambung', coba ? 'Menyambung ulang…' : 'Menyambung…');
      ws = new WebSocket(o.url); ws.binaryType = 'arraybuffer';
      ws.onopen = function () { coba = 0; terakhir = Date.now(); };
      ws.onmessage = function (e) {
        if (typeof e.data === 'string') {
          if (e.data === 'pong') return;
          try {
            var j = JSON.parse(e.data);
            if (j.t === 's') {
              hadir = !!j.h; jeda = !!j.jeda;
              if (!hadir) st('menunggu', 'Menunggu pengajar menyalakan audio…');
              else if (jeda) st('jeda', 'Pengajar sedang jeda sejenak…');
              else st('mengudara', '● Mendengarkan');
            }
          } catch (x) { }
          return;
        }
        var d = dekode(new Uint8Array(e.data)); if (!d) return;
        terakhir = Date.now(); if (hadir && !jeda) putar(d.pcm);
      };
      ws.onclose = function (e) {
        clearInterval(jaga); if (mati) return;
        if (e.code === 4001) { st('penuh', 'Majelis penuh. Mencoba lagi otomatis…'); tmrSambung = setTimeout(sambung, 15000); return; }
        coba++; st('menyambung', 'Terputus. Menyambung ulang…'); tmrSambung = setTimeout(sambung, Math.min(10000, 1000 * coba));
      };
      ws.onerror = function () { };
      jaga = setInterval(function () { // denyut + deteksi sambungan "mati suri" (umum di jaringan seluler)
        if (!ws || ws.readyState !== 1) return;
        try { ws.send('ping'); } catch (x) { }
        if (hadir && !jeda) {
          var diam = Date.now() - terakhir;
          if (diam > 15000) { try { ws.close(); } catch (x) { } }
          else if (diam > 4000) st('tersendat', 'Sinyal tersendat…');
        }
      }, 5000);
    }
    sambung();
    return { stop: function () { mati = true; clearInterval(jaga); clearTimeout(tmrSambung); try { ws.close(1000); } catch (e) { } try { ctx.close(); } catch (e) { } try { if (senyapEl) { senyapEl.pause(); senyapEl.removeAttribute('src'); senyapEl.load(); } } catch (e) { } st('berhenti', 'Audio dihentikan.'); } };
  }

  var api = { enkode: enkode, dekode: dekode, Resampler: Resampler, siar: siar, dengar: dengar, RATE: RATE, BLOK: BLOK };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.LiveAudio = api;
})(typeof window !== 'undefined' ? window : globalThis);
