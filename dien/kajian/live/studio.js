/* JAZMI — Studio Kajian (pengajar). Tulis ke live_sesi; RLS hanya mengizinkan akun di tabel pengajar. */
(function () {
  var $ = function (i) { return document.getElementById(i); }, cfg = window.JAZMI_AUTH || {};
  function pesan(t, err) { $('pesan').textContent = t; $('pesan').style.color = err ? '#a12a1f' : ''; }
  if (!window.supabase || !cfg.url) { pesan('Sistem belum dikonfigurasi (js/auth-config.js).', true); return; }
  var sb = window.supabase.createClient(cfg.url, cfg.anonKey), sesi = null, tmr = null, daftar = [];
  function isiPilihan(sel) { daftar.forEach(function (p, i) { var o = document.createElement('option'); o.value = i; o.textContent = p.judul; sel.appendChild(o); }); }
  function gagal(e) { pesan('Gagal: ' + (e && e.message || 'coba lagi') , true); }
  async function gambar() {
    $('pg').textContent = 'Halaman ' + sesi.halaman + (sesi.total ? ' / ' + sesi.total : ''); $('goto').value = sesi.halaman;
    if (sesi.pdf_url) { try { await LivePdf.render($('cv'), sesi.halaman); } catch (e) { pesan('Pratinjau PDF gagal.', true); } }
  }
  function simpan(patch) { // tulis dengan jeda 300 ms agar loncatan cepat tidak membanjiri server
    Object.assign(sesi, patch); gambar(); clearTimeout(tmr);
    tmr = setTimeout(async function () { var r = await sb.from('live_sesi').update(patch).eq('id', sesi.id); if (r.error) gagal(r.error); else pesan('● Live — halaman ' + sesi.halaman); }, 300);
  }
  function lompat(n) { if (!sesi) return; var mx = sesi.total || 9999; n = Math.max(1, Math.min(mx, n | 0)); if (n !== sesi.halaman) simpan({ halaman: n }); }
  async function bukaPdf() { if (!sesi.pdf_url) return; try { var n = await LivePdf.open(sesi.pdf_url); if (!sesi.total) { sesi.total = n; await sb.from('live_sesi').update({ total: n }).eq('id', sesi.id); } } catch (e) { pesan('Kitab gagal dimuat: ' + e.message, true); } }
  async function masuk(s) {
    sesi = s; $('formMulai').hidden = true; $('kendali').hidden = false; $('kJudul').textContent = s.judul;
    $('tautPenonton').href = 'index.html?s=' + encodeURIComponent(s.id); await bukaPdf(); await gambar(); pesan('● Live — halaman ' + s.halaman);
  }
  $('prev').onclick = function () { lompat(sesi.halaman - 1); }; $('next').onclick = function () { lompat(sesi.halaman + 1); };
  $('goto').onchange = function () { lompat(+$('goto').value); };
  addEventListener('keydown', function (e) { if (!sesi || /INPUT|SELECT/.test(e.target.tagName)) return; if (e.key === 'ArrowRight') lompat(sesi.halaman + 1); if (e.key === 'ArrowLeft') lompat(sesi.halaman - 1); });
  $('gantiPdf').onchange = async function () {
    var p = daftar[$('gantiPdf').value]; if (!p) return;
    var r = await sb.from('live_sesi').update({ pdf_url: p.url, pdf_judul: p.judul, halaman: 1, total: null }).eq('id', sesi.id);
    if (r.error) return gagal(r.error); Object.assign(sesi, { pdf_url: p.url, pdf_judul: p.judul, halaman: 1, total: null }); await bukaPdf(); await gambar();
  };
  $('mulai').onclick = async function () {
    var judul = $('fJudul').value.trim(); if (judul.length < 3) return pesan('Isi judul kajian.', true);
    var p = daftar[$('fPdf').value], fb = $('fFb').value.trim();
    if (fb && !/^https:\/\//.test(fb)) return pesan('Tautan Facebook harus diawali https://', true);
    $('mulai').disabled = true;
    var r = await sb.from('live_sesi').insert({ judul: judul, pengajar_nama: $('fNama').value.trim() || null, pdf_url: p ? p.url : null, pdf_judul: p ? p.judul : null, fb_url: fb || null }).select().single();
    $('mulai').disabled = false;
    if (r.error) return pesan(/duplicate|unique/i.test(r.error.message) ? 'Masih ada sesi live. Muat ulang halaman ini untuk melanjutkannya.' : 'Gagal memulai: ' + r.error.message, true);
    masuk(r.data);
  };
  /* ---- audio langsung (relay Cloudflare, tanpa SFU/TURN) ---- */
  var au = null, RELAY = (window.JAZMI_LIVE || {}).relay;
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
  $('selesai').onclick = async function () {
    if (!confirm('Akhiri kajian ini untuk semua penonton?')) return;
    auMati();
    var r = await sb.from('live_sesi').update({ status: 'selesai', selesai: new Date().toISOString() }).eq('id', sesi.id);
    if (r.error) return gagal(r.error); sesi = null; $('kendali').hidden = true; $('formMulai').hidden = false; pesan('Kajian diakhiri.');
  };
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
