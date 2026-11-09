/* JAZMI — Alat peraga di kajian langsung (pustaka bersama studio dan ruang penonton).
   Prinsip: kode alat TIDAK PERNAH lewat Worker. Tiap peserta memuat alat itu sendiri dengan cara yang sama seperti
   membukanya di /alat/ (alat publik: berkas biasa; alat terkunci: lewat alat/buka.html, yang meminta login anggota).
   Pengajar hanya mengirim peristiwa kecil (klik, nilai slider, gerak penunjuk) lewat relay; peserta memutarnya ulang
   di salinan alat mereka sendiri. Peserta yang bukan anggota melihat tampilan "khusus anggota" dari buka.html. */
(function (g) {
  'use strict';
  var MANIFEST = '/alat/data/alat-manifest.json';

  function idDariFile(f) { return String(f || '').replace(/\.html?$/i, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''); }

  /* ---------- daftar alat (manifest yang sama dengan halaman /alat/) ---------- */
  var man = null;
  function muatManifest() {
    if (!man) man = fetch(MANIFEST, { cache: 'no-cache' }).then(function (r) { if (!r.ok) throw new Error('Daftar alat tidak dapat dimuat'); return r.json(); }).then(function (j) {
      var d = j.akses_default || 'publik', po = [], per = {};
      (j.tools || []).forEach(function (t) {
        var id = idDariFile(t.file); if (!id || per[id]) return;
        var e = { id: id, file: t.file, kategori: t.kategori, judul: t.judul || id, terkunci: (t.akses || d) === 'login' };
        po.push(e); per[id] = e;
      });
      return { daftar: po, per: per };
    }).catch(function (e) { man = null; throw e; });
    return man;
  }
  function alamat(e) {
    return e.terkunci ? '/alat/buka.html?id=' + encodeURIComponent(e.id) + '&embed=1'
                      : '/alat/' + encodeURIComponent(e.kategori) + '/' + encodeURI(e.file);
  }
  /* cari alat berdasarkan kata (semua kata harus ada di judul, id, atau kategori) */
  function cari(m, q, maks) {
    var k = String(q || '').toLowerCase().split(/\s+/).filter(Boolean), out = [];
    for (var i = 0; i < m.daftar.length && out.length < (maks || 30); i++) {
      var e = m.daftar[i], h = (e.judul + ' ' + e.id + ' ' + e.kategori).toLowerCase();
      if (k.every(function (w) { return h.indexOf(w) >= 0; })) out.push(e);
    }
    return out;
  }

  /* ---------- memuat alat ke dalam iframe; panggil cb(dokumenAlat) bila siap, atau cb(null) bila tidak bisa ---------- */
  function muat(frame, e, cb) {
    var selesai = false, batal = false;
    function ok(doc) { if (!selesai && !batal) { selesai = true; cb(doc); } }
    function tunggu(mulaiMs) {
      // alat terkunci: buka.html memuat HTML-nya sendiri (setelah cek login) ke dalam iframe #bingkai
      var t0 = Date.now();
      (function ulang() {
        if (selesai || batal) return;
        try {
          var d = frame.contentDocument, b = d && d.getElementById('bingkai');
          if (b && !b.hidden && b.contentDocument && b.contentDocument.readyState === 'complete' && b.contentDocument.body && b.contentDocument.body.children.length) return ok(b.contentDocument);
          // buka.html menampilkan status (belum masuk / bukan anggota / dst.) alih-alih alat
          if (d && d.getElementById('status') && !d.getElementById('status').hidden && d.getElementById('statusJudul') && !/^Memuat/.test(d.getElementById('statusJudul').textContent) && Date.now() - t0 > 600) return ok(null);
        } catch (x) { return ok(null); }
        if (Date.now() - t0 > 25000) return ok(null);
        setTimeout(ulang, 200);
      })();
    }
    frame.onload = function () {
      if (batal) return;
      if (e.terkunci) return tunggu();
      try { var d = frame.contentDocument; if (d && d.getElementById('jazmi-nav-kembali-host')) d.getElementById('jazmi-nav-kembali-host').remove(); /* tombol navigasi melayang bawaan alat: tautannya akan membawa bingkai keluar dari kajian */ ok(d && d.body ? d : null); } catch (x) { ok(null); }
    };
    frame.removeAttribute('srcdoc');   // srcdoc mengalahkan src: buang sisa muatan teks sebelumnya
    frame.src = alamat(e);
    return function () { batal = true; };
  }

  /* ---------- alat terkunci yang isinya dititipkan pengajar di relay (hanya bila pengajar menyalakan "tampil untuk umum"):
     HTML dimuat langsung lewat srcdoc; tautan relatif ke alat lain tidak boleh membawa bingkai keluar dari kajian ---------- */
  function muatTeks(frame, html, cb) {
    var selesai = false, batal = false;
    function ok(doc) { if (!selesai && !batal) { selesai = true; cb(doc); } }
    html = String(html).replace(/<script[^>]*alat-nav-kembali\.js[^>]*>\s*<\/script>/gi, '');
    frame.onload = function () {
      if (batal) return;
      try {
        var d = frame.contentDocument; if (!d || !d.body) return ok(null);
        d.addEventListener('click', function (ev) {
          var a = ev.target && ev.target.closest ? ev.target.closest('a[href]') : null; if (!a) return;
          if (/^(?:\.\/)?[^\/#?:]+\.html?(?:[#?].*)?$/i.test(a.getAttribute('href') || '')) ev.preventDefault();
        });
        ok(d);
      } catch (x) { ok(null); }
    };
    frame.removeAttribute('src'); frame.srcdoc = html;
    return function () { batal = true; };
  }

  /* ---------- alamat elemen yang stabil antar peramban: #id atau urutan anak dari <html> ---------- */
  function jalur(el, doc) {
    var p = [];
    while (el && el !== doc.documentElement) {
      if (el.id && /^[\w:.\-]{1,60}$/.test(el.id) && doc.getElementById(el.id) === el) { p.unshift('#' + el.id); break; }
      var par = el.parentElement; if (!par) return null;
      p.unshift(Array.prototype.indexOf.call(par.children, el)); el = par;
    }
    return p.join('/');
  }
  function elemen(doc, j) {
    if (typeof j !== 'string') return null;
    var s = j.split('/'), el = doc.documentElement, i = 0;
    if (s[0] && s[0].charAt(0) === '#') { el = doc.getElementById(s[0].slice(1)); i = 1; }
    for (; el && i < s.length; i++) { var n = Number(s[i]); if (!(n >= 0)) return null; el = el.children[n]; }
    return el || null;
  }
  var TEKS = /^(text|search|url|tel|email|number|range|color|date|time|datetime-local|month|week)$/i;
  function kontrol(el) { return /^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName); }
  function rahasia(el) { return el.tagName === 'INPUT' && /^(password|file|hidden)$/i.test(el.type); }
  function tombolBiasa(el) { return el.tagName === 'INPUT' && /^(button|submit|reset|image)$/i.test(el.type); }

  /* ---------- pengajar: tangkap peristiwa di dokumen alat dan kirim lewat fungsi kirim(obj) ---------- */
  function tangkap(doc, kirim) {
    var w = doc.defaultView, buf = [], tm = null, mati = false;
    function alirkan() { tm = null; var b = buf; buf = []; b.forEach(function (o) { delete o.g; kirim(o); }); }
    function dorong(o, gabung) {
      if (mati) return;
      var l = buf[buf.length - 1];
      if (gabung && l && l.g === gabung) buf[buf.length - 1] = o; else buf.push(o);
      if (gabung) o.g = gabung;
      if (!tm) tm = setTimeout(alirkan, 40);
    }
    function a(tipe, fn) { doc.addEventListener(tipe, function (ev) { if (ev.isTrusted && !mati) { try { fn(ev); } catch (x) { } } }, true); }
    function nilai(ev) {
      var el = ev.target; if (!el || !kontrol(el) || rahasia(el)) return;
      var p = jalur(el, doc); if (p === null) return;
      var o = { t: 'e', k: 'i', p: p };
      if (el.type === 'checkbox' || el.type === 'radio') o.c = !!el.checked;
      else if (el.tagName === 'SELECT' && el.multiple) o.m = Array.prototype.map.call(el.options, function (x) { return x.selected ? 1 : 0; });
      else o.v = String(el.value).slice(0, 1500);
      dorong(o, 'i|' + p);
    }
    a('input', nilai); a('change', nilai);
    a('click', function (ev) {
      var el = ev.target; if (!el || !el.closest) return;
      if (kontrol(el) && !tombolBiasa(el)) return;          // ditangani oleh peristiwa nilai (menghindari kebalik dua kali)
      if (el.closest('label') && !el.closest('button,a,summary')) return;
      var p = jalur(el, doc); if (p === null) return;
      var r = el.getBoundingClientRect();   // posisi klik ikut dikirim: alat berbasis kanvas membacanya (clientX/clientY)
      dorong({ t: 'e', k: 'c', p: p, x: +((ev.clientX - r.left) / (r.width || 1)).toFixed(4), y: +((ev.clientY - r.top) / (r.height || 1)).toFixed(4) });
    });
    function titik(ev, k) {
      var el = ev.target; if (!el || !el.getBoundingClientRect) return;
      var p = jalur(el, doc); if (p === null) return;
      var r = el.getBoundingClientRect(), o = { t: 'e', k: k, p: p, x: +((ev.clientX - r.left) / (r.width || 1)).toFixed(4), y: +((ev.clientY - r.top) / (r.height || 1)).toFixed(4), b: ev.button | 0, s: ev.buttons | 0 };
      if (ev.pointerType) o.pt = ev.pointerType;
      if (k.charAt(1) === 'm') dorong(o, k); else dorong(o);
    }
    [['pointerdown', 'pd'], ['pointermove', 'pm'], ['pointerup', 'pu'], ['mousedown', 'md'], ['mousemove', 'mm'], ['mouseup', 'mu']].forEach(function (x) { a(x[0], function (ev) { titik(ev, x[1]); }); });
    [['touchstart', 'td'], ['touchmove', 'tm'], ['touchend', 'tu']].forEach(function (x) {
      a(x[0], function (ev) {
        var tc = ev.changedTouches && ev.changedTouches[0], el = ev.target; if (!tc || !el || !el.getBoundingClientRect) return;
        var p = jalur(el, doc); if (p === null) return; var r = el.getBoundingClientRect();
        var o = { t: 'e', k: x[1], p: p, x: +((tc.clientX - r.left) / (r.width || 1)).toFixed(4), y: +((tc.clientY - r.top) / (r.height || 1)).toFixed(4), id: tc.identifier | 0 };
        if (x[1] === 'tm') dorong(o, 'tm'); else dorong(o);
      });
    });
    function tombol(k) {
      return function (ev) {
        var el = ev.target; if (el && el.tagName && kontrol(el) && !tombolBiasa(el)) return;     // ketikan di kolom isian sudah terwakili nilainya
        var p = el && el !== doc.body && el !== doc.documentElement ? jalur(el, doc) : '';
        dorong({ t: 'e', k: k, p: p || '', y: ev.key, c: ev.code, f: (ev.shiftKey ? 1 : 0) | (ev.ctrlKey ? 2 : 0) | (ev.altKey ? 4 : 0) | (ev.metaKey ? 8 : 0), r: ev.repeat ? 1 : 0 });
      };
    }
    a('keydown', tombol('d')); a('keyup', tombol('u'));
    /* gulir (tidak menggelembung, tapi tertangkap di fase tangkap): kirim pecahan 0..1; sesudah 250 ms diam kirim sekali lagi sebagai posisi akhir (f:1) yang disimpan relay */
    var akhir = {};
    a('scroll', function (ev) {
      var el = ev.target, isDoc = el === doc, tgt = isDoc ? (doc.scrollingElement || doc.documentElement) : el;
      if (!tgt || !tgt.scrollHeight) return;
      var p = isDoc ? '' : jalur(el, doc); if (p === null) return;
      var mx = tgt.scrollWidth - tgt.clientWidth, my = tgt.scrollHeight - tgt.clientHeight;
      var o = { t: 'e', k: 's', p: p, x: mx > 0 ? +Math.min(1, Math.max(0, tgt.scrollLeft / mx)).toFixed(4) : 0, y: my > 0 ? +Math.min(1, Math.max(0, tgt.scrollTop / my)).toFixed(4) : 0 };
      dorong(o, 's|' + p); clearTimeout(akhir[p]);
      akhir[p] = setTimeout(function () { if (!mati) dorong({ t: 'e', k: 's', p: p, x: o.x, y: o.y, f: 1 }); }, 250);
    });
    return function henti() { mati = true; clearTimeout(tm); buf = []; Object.keys(akhir).forEach(function (k) { clearTimeout(akhir[k]); }); };
  }

  /* ---------- penonton: putar ulang satu peristiwa di dokumen alat ---------- */
  function putar(doc, e) {
    var w = doc.defaultView, el;
    try {
      if (e.k === 'd' || e.k === 'u') {
        el = (e.p && elemen(doc, e.p)) || doc.body; if (!el) return;
        el.dispatchEvent(new w.KeyboardEvent(e.k === 'd' ? 'keydown' : 'keyup', { key: e.y, code: e.c, repeat: !!e.r, shiftKey: !!(e.f & 1), ctrlKey: !!(e.f & 2), altKey: !!(e.f & 4), metaKey: !!(e.f & 8), bubbles: true, cancelable: true, view: w }));
        return;
      }
      if (e.k === 's') {
        var sc = e.p === '' ? (doc.scrollingElement || doc.documentElement) : elemen(doc, e.p); if (!sc) return;
        var mx = sc.scrollWidth - sc.clientWidth, my = sc.scrollHeight - sc.clientHeight;
        if (mx > 0) sc.scrollLeft = Math.round((+e.x || 0) * mx); if (my > 0) sc.scrollTop = Math.round((+e.y || 0) * my);
        return;
      }
      el = elemen(doc, e.p); if (!el) return;
      if (e.k === 'i') {
        if (e.c !== undefined) { if (el.checked !== !!e.c) { el.checked = !!e.c; } }
        else if (e.m && el.options) { Array.prototype.forEach.call(el.options, function (o, i) { o.selected = !!e.m[i]; }); }
        else if (e.v !== undefined) el.value = e.v;
        el.dispatchEvent(new w.Event('input', { bubbles: true })); el.dispatchEvent(new w.Event('change', { bubbles: true }));
        return;
      }
      if (e.k === 'c') {
        var rc = el.getBoundingClientRect(), kx = rc.left + (+e.x || 0) * rc.width, ky = rc.top + (+e.y || 0) * rc.height;
        el.dispatchEvent(new w.MouseEvent('click', { bubbles: true, cancelable: true, view: w, clientX: kx, clientY: ky, screenX: kx, screenY: ky, button: 0 }));
        return;
      }
      var r = el.getBoundingClientRect(), cx = r.left + (+e.x || 0) * r.width, cy = r.top + (+e.y || 0) * r.height;
      var tipe = { pd: 'pointerdown', pm: 'pointermove', pu: 'pointerup', md: 'mousedown', mm: 'mousemove', mu: 'mouseup' }[e.k];
      if (tipe) {
        var dasar = { bubbles: true, cancelable: true, view: w, clientX: cx, clientY: cy, screenX: cx, screenY: cy, button: e.b | 0, buttons: e.s | 0 };
        if (e.k.charAt(0) === 'p' && w.PointerEvent) { dasar.pointerId = 1; dasar.pointerType = e.pt || 'mouse'; dasar.isPrimary = true; el.dispatchEvent(new w.PointerEvent(tipe, dasar)); }
        else if (e.k.charAt(0) === 'm') el.dispatchEvent(new w.MouseEvent(tipe, dasar));
        return;
      }
      var tt = { td: 'touchstart', tm: 'touchmove', tu: 'touchend' }[e.k];
      if (tt) {
        var tu = e.k === 'tu', t = null, ev = null;
        if (w.Touch && w.TouchEvent) {
          try {
            t = new w.Touch({ identifier: e.id | 0, target: el, clientX: cx, clientY: cy, screenX: cx, screenY: cy, pageX: cx, pageY: cy });
            ev = new w.TouchEvent(tt, { bubbles: true, cancelable: true, view: w, touches: tu ? [] : [t], targetTouches: tu ? [] : [t], changedTouches: [t] });
          } catch (x) { t = ev = null; }
        }
        if (!ev) {   // Safari/iPhone tidak punya konstruktor Touch: buat peristiwa biasa dengan daftar sentuhan sederhana (cukup untuk alat yang membaca touches[0].clientX/clientY)
          t = { identifier: e.id | 0, target: el, clientX: cx, clientY: cy, screenX: cx, screenY: cy, pageX: cx + (w.pageXOffset || 0), pageY: cy + (w.pageYOffset || 0), radiusX: 1, radiusY: 1, rotationAngle: 0, force: 1 };
          ev = new w.Event(tt, { bubbles: true, cancelable: true });
          var kosong = [], ada = [t];
          Object.defineProperty(ev, 'touches', { value: tu ? kosong : ada });
          Object.defineProperty(ev, 'targetTouches', { value: tu ? kosong : ada });
          Object.defineProperty(ev, 'changedTouches', { value: ada });
        }
        el.dispatchEvent(ev);
      }
    } catch (x) { /* satu peristiwa gagal tidak boleh menghentikan yang lain */ }
  }

  /* ---------- relay WebSocket (sambung ulang otomatis) ---------- */
  function sambung(url, protokol, onPesan, onStatus) {
    var ws = null, tutup = false, jeda = 1000, antri = [], tmr = null;
    function buka() {
      if (tutup) return;
      Promise.resolve(typeof protokol === 'function' ? protokol() : protokol).then(function (pr) {
        if (tutup) return;
        try { ws = pr ? new WebSocket(url, pr) : new WebSocket(url); } catch (x) { return ulang(); }
        ws.onopen = function () { jeda = 1000; onStatus && onStatus('tersambung'); antri.splice(0).forEach(function (s) { try { ws.send(s); } catch (x) { } }); };
        ws.onmessage = function (m) { if (typeof m.data === 'string' && m.data !== 'pong') { try { onPesan(JSON.parse(m.data)); } catch (x) { } } };
        ws.onclose = function (ev) {
          onStatus && onStatus('putus', ev.code);
          if (ev.code === 4001) { tutup = true; onStatus && onStatus('penuh'); return; }      // majelis penuh: jangan membanjiri
          if (ev.code === 4003) { tutup = true; onStatus && onStatus('ditolak'); return; }    // bukan pengajar / sesi tidak live
          ulang();
        };
      }).catch(function () { ulang(); });
    }
    function ulang() { if (tutup) return; clearTimeout(tmr); tmr = setTimeout(buka, jeda); jeda = Math.min(jeda * 2, 15000); }
    buka();
    return {
      kirim: function (o) { var s = typeof o === 'string' ? o : JSON.stringify(o); if (ws && ws.readyState === 1) { try { ws.send(s); } catch (x) { } } else if (antri.length < 50) antri.push(s); },
      stop: function () { tutup = true; clearTimeout(tmr); try { ws && ws.close(1000, 'selesai'); } catch (x) { } }
    };
  }
  function siar(o) {   // pengajar: o = { url (wss://…/alat-siar?s=…), getToken(), onStatus }
    var s = sambung(o.url, function () { return o.getToken().then(function (t) { return ['jazmi', t]; }); }, function () { }, o.onStatus);
    return s;
  }
  function dengar(o) { // penonton: o = { url (wss://…/alat-dengar?s=…), onPesan(obj), onStatus }
    var s = sambung(o.url, null, o.onPesan, o.onStatus), ping = setInterval(function () { s.kirim('ping'); }, 45000);
    return { stop: function () { clearInterval(ping); s.stop(); } };
  }

  g.LiveAlat = { idDariFile: idDariFile, muatManifest: muatManifest, cari: cari, alamat: alamat, muat: muat, muatTeks: muatTeks, tangkap: tangkap, putar: putar, jalur: jalur, elemen: elemen, siar: siar, dengar: dengar };
})(window);
