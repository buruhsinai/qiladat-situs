/* JAZMI — PDF untuk Ruang Kajian (PDF.js 3.11.174, pola sama dengan papan tulis kelas).
   Dua cara pakai:
   • Pengajar: bukaBerkas(file) lalu jpeg(n) → Blob JPEG halaman n (dikirim ke Worker; penonton hanya menerima gambar).
   • open(url)/render(canvas,n): cara lama (PDF dari alamat URL, dirender di tiap penonton) — dipertahankan sebagai pilihan kedua. */
window.LivePdf = (function () {
  var V = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/', doc = null, url = null, task = null;
  function lib() {
    if (window.pdfjsLib) return Promise.resolve();
    return new Promise(function (ok, no) {
      var s = document.createElement('script'); s.src = V + 'pdf.min.js';
      s.onload = function () {
        pdfjsLib.GlobalWorkerOptions.workerSrc = URL.createObjectURL(new Blob(['importScripts("' + V + 'pdf.worker.min.js")'], { type: 'text/javascript' }));
        ok();
      };
      s.onerror = function () { no(new Error('Pustaka PDF gagal dimuat. Periksa koneksi internet.')); };
      document.head.appendChild(s);
    });
  }
  function open(u) {
    if (u === url && doc) return Promise.resolve(doc.numPages);
    url = u; doc = null;
    return lib().then(function () { return pdfjsLib.getDocument({ url: u }).promise; })
      .then(function (d) { doc = d; return d.numPages; });
  }
  function render(canvas, n) {
    if (!doc) return Promise.resolve();
    n = Math.max(1, Math.min(doc.numPages, n));
    if (task) { try { task.cancel(); } catch (e) {} }
    return doc.getPage(n).then(function (p) {
      var v = p.getViewport({ scale: 1 }), dpr = Math.min(window.devicePixelRatio || 1, 2),
          w = Math.min(canvas.parentNode.clientWidth || 600, 1100), vp = p.getViewport({ scale: (w / v.width) * dpr });
      canvas.width = vp.width; canvas.height = vp.height; canvas.style.width = (vp.width / dpr) + 'px';
      task = p.render({ canvasContext: canvas.getContext('2d'), viewport: vp });
      return task.promise.catch(function (e) { if (!e || e.name !== 'RenderingCancelledException') throw e; });
    });
  }
  /* ---- pengajar: berkas dari perangkat → gambar JPEG per halaman ---- */
  var lokal = null;
  function bukaBerkas(file) {
    if (file.size > 40e6) return Promise.reject(new Error('PDF terlalu besar (maksimal 40 MB).'));
    return lib().then(function () { return file.arrayBuffer(); })
      .then(function (buf) { return pdfjsLib.getDocument({ data: buf }).promise; })
      .then(function (d) { if (lokal) { try { lokal.destroy(); } catch (e) {} } lokal = d; return d.numPages; });
  }
  function tutupBerkas() { if (lokal) { try { lokal.destroy(); } catch (e) {} lokal = null; } }
  function adaBerkas() { return !!lokal; }
  function toBlob(c, q) { return new Promise(function (r) { c.toBlob(r, 'image/jpeg', q); }); }
  function jpeg(n) { // sisi panjang ≤ 1500×2200 px, JPEG ≤ 1,4 MB (sama dengan papan tulis kelas)
    if (!lokal) return Promise.reject(new Error('Berkas PDF belum dibuka.'));
    n = Math.max(1, Math.min(lokal.numPages, n));
    return lokal.getPage(n).then(function (p) {
      var v = p.getViewport({ scale: 1 }), vp = p.getViewport({ scale: Math.min(1500 / v.width, 2200 / v.height) }),
          c = document.createElement('canvas'), g;
      c.width = Math.round(vp.width); c.height = Math.round(vp.height);
      g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
      return p.render({ canvasContext: g, viewport: vp }).promise.then(function () {
        var qs = [0.85, 0.7, 0.55, 0.4], i = 0;
        function coba() {
          if (i >= qs.length) { c.width = 0; throw new Error('Halaman ' + n + ' terlalu besar untuk dikirim.'); }
          return toBlob(c, qs[i++]).then(function (b) { if (b && b.size <= 1400000) { c.width = 0; return b; } return coba(); });
        }
        return coba();
      });
    });
  }
  return { open: open, render: render, bukaBerkas: bukaBerkas, tutupBerkas: tutupBerkas, adaBerkas: adaBerkas, jpeg: jpeg };
})();
