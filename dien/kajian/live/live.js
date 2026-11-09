/* JAZMI — Ruang Kajian (penonton). Sinkron halaman lewat polling 4 detik (tanpa WebSocket). */
(function () {
  var c = window.JAZMI_AUTH || {}, $ = function (i) { return document.getElementById(i); };
  var H = { apikey: c.anonKey }, id = new URLSearchParams(location.search).get('s');
  var sesi = null, ikut = true, hal = 1, pdfUrl = null, tampil = 0, sibuk = false;
  function api(q) { return fetch(c.url + '/rest/v1/live_sesi?' + q, { headers: H }).then(function (r) { return r.ok ? r.json() : []; }).catch(function () { return null; }); }
  function pesanPdf(t) { $('pdfErr').textContent = t || ''; $('pdfErr').hidden = !t; }
  function gambar(n) {
    if (sibuk || n === tampil) return; sibuk = true; pesanPdf('');
    LivePdf.render($('cv'), n).then(function () { tampil = n; $('pg').textContent = 'Halaman ' + n + (sesi.total ? ' / ' + sesi.total : ''); })
      .catch(function () { pesanPdf('Halaman tidak dapat ditampilkan.'); }).then(function () { sibuk = false; if (ikut && hal !== tampil) gambar(hal); });
  }
  function terapkan(s) {
    sesi = s; $('judul').textContent = s.judul; $('sub').textContent = s.pengajar_nama || '';
    $('status').textContent = s.status === 'live' ? '● Sedang live' : 'Kajian ini sudah selesai';
    if (s.fb_url) $('fbBtn').href = s.fb_url;
    if (!s.pdf_url) { $('pdfBox').hidden = true; return; }
    $('pdfBox').hidden = false; $('pdfJudul').textContent = s.pdf_judul || '';
    hal = s.halaman;
    if (s.pdf_url !== pdfUrl) {
      pdfUrl = s.pdf_url; tampil = 0; pesanPdf('Memuat kitab…');
      LivePdf.open(pdfUrl).then(function (n) { sesi.total = sesi.total || n; pesanPdf(''); gambar(ikut ? hal : 1); })
        .catch(function (e) { pesanPdf(e.message || 'Kitab gagal dimuat.'); });
    } else if (ikut) gambar(hal);
  }
  function geser(d) { ikut = false; $('ikuti').hidden = false; var n = Math.max(1, Math.min(sesi && sesi.total || 9999, (tampil || hal) + d)); hal = n; gambar(n); }
  $('prev').onclick = function () { geser(-1); }; $('next').onclick = function () { geser(1); };
  $('ikuti').onclick = function () { ikut = true; $('ikuti').hidden = true; if (sesi) { hal = sesi.halaman; gambar(hal); } };
  function putaran() {
    if (document.hidden) return;
    var q = id ? 'id=eq.' + encodeURIComponent(id) + '&limit=1'
      : 'status=eq.live&mulai=gte.' + encodeURIComponent(new Date(Date.now() - 6 * 3600e3).toISOString()) + '&order=mulai.desc&limit=1';
    api('select=*&' + q).then(function (a) {
      if (a === null) { if (!sesi) $('status').textContent = 'Tidak dapat terhubung. Mencoba lagi…'; return; }
      if (!a[0]) { if (!sesi) { $('status').textContent = 'Belum ada kajian langsung saat ini.'; $('judul').textContent = 'Ruang Kajian'; $('sub').textContent = 'Kajian rutin: Selasa 16.45 · Rabu Maghrib–Isya · Kamis sore'; } return; }
      id = a[0].id; terapkan(a[0]);
    });
  }
  addEventListener('resize', function () { var t = tampil; tampil = 0; if (sesi && pdfUrl) gambar(t || hal); });
  putaran(); setInterval(putaran, 4000);
})();
