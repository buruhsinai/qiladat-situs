/* JAZMI — penampil PDF bersama untuk Ruang Kajian (PDF.js 3.11.174, pola sama dengan papan tulis kelas) */
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
  return { open: open, render: render };
})();
