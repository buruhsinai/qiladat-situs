/* JAZMI — status Kajian Langsung untuk beranda (#liveBanner) dan halaman Kajian (#liveRuang).
   Satu panggilan REST ringan tiap 60 detik; TIDAK membuka WebSocket (hemat kuota koneksi Supabase). */
(function () {
  var c = window.JAZMI_AUTH || {}, strip = document.getElementById('liveBanner'), ruang = document.getElementById('liveRuang');
  if (!c.url || !c.anonKey || (!strip && !ruang)) return;
  var ROOM = '/dien/kajian/live/', JADWAL = 'Kajian rutin: Selasa 16.45 · Rabu Maghrib–Isya · Kamis sore';
  function el(t, cls, txt) { var e = document.createElement(t); if (cls) e.className = cls; if (txt) e.textContent = txt; return e; }
  function ambil() {
    var sejak = new Date(Date.now() - 6 * 3600e3).toISOString();
    return fetch(c.url + '/rest/v1/live_sesi?select=id,judul,pengajar_nama&status=eq.live&mulai=gte.' + encodeURIComponent(sejak) + '&order=mulai.desc&limit=1',
      { headers: { apikey: c.anonKey } })
      .then(function (r) { return r.ok ? r.json() : []; }).then(function (a) { return a[0] || null; }).catch(function () { return null; });
  }
  function gambar(s) {
    if (strip) {
      strip.textContent = '';
      var a = el('a', 'live-strip' + (s ? ' is-live' : ''));
      a.href = s ? ROOM + '?s=' + encodeURIComponent(s.id) : '/dien/kajian/';
      if (s) { a.appendChild(el('span', 'live-dot')); a.appendChild(el('strong', '', 'Sedang live')); a.appendChild(el('span', 'live-judul', s.judul)); a.appendChild(el('span', 'live-go', 'Dengarkan →')); }
      else { a.appendChild(el('span', 'live-judul', JADWAL)); a.appendChild(el('span', 'live-go', 'Kajian →')); }
      strip.appendChild(a);
    }
    if (ruang) {
      ruang.textContent = '';
      var k = el('div', 'live-card' + (s ? ' is-live' : ''));
      var h = el('p', 'live-card-status'); if (s) h.appendChild(el('span', 'live-dot')); h.appendChild(document.createTextNode(s ? 'Sedang live sekarang' : 'Belum ada kajian langsung'));
      k.appendChild(h);
      k.appendChild(el('p', 'live-card-judul', s ? s.judul + (s.pengajar_nama ? ' — ' + s.pengajar_nama : '') : JADWAL));
      var b = el('a', 'btn btn-outline', s ? 'Masuk Ruang Kajian →' : 'Buka Ruang Kajian →'); b.href = ROOM + (s ? '?s=' + encodeURIComponent(s.id) : '');
      k.appendChild(b); ruang.appendChild(k);
    }
  }
  function segar() { if (!document.hidden) ambil().then(gambar); }
  segar(); setInterval(segar, 60000);
})();
