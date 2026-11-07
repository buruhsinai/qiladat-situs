/* =========================================================
   JAZMI — HOME
   bait-export.js  (v2 — "Studio Kartu Bait")

   Fitur "Simpan sebagai gambar" untuk kartu Bait Syair Hari Ini.

   Versi sebelumnya memotret kartu di layar lewat html2canvas
   (hasil mengikuti lebar layar pengunjung, dan huruf Arab kadang
   rusak). Versi ini MELUKIS gambar sendiri di <canvas> dengan
   ukuran baku, sehingga hasilnya selalu rapi, tajam, dan sama di
   semua perangkat — dan tidak lagi butuh library eksternal.

   Alur:
   1. Klik "Simpan sebagai gambar" -> panel studio terbuka berisi
      pratinjau langsung + pilihan: Ukuran, Tema, Motif, Hiasan.
   2. Setiap pilihan langsung memperbarui pratinjau (hasil nyata,
      bukan simulasi — kanvas yang sama yang akan diunduh).
   3. "Unduh PNG" menyimpan gambar. "Bagikan" (bila perangkat
      mendukung, umumnya HP) membuka menu bagikan ke WhatsApp,
      Instagram, dst. langsung dengan berkas gambarnya.

   Sumber data: dibaca dari elemen kartu di halaman
   (#baitArab, #baitTerjemahan, #baitPenyair, #baitSumber), jadi
   otomatis sama dengan bait yang tampil hari ini — baik dari Bank
   Syair (js/bait-panel.js) maupun fallback demo (js/main.js).

   Bergantung pada (opsional): window.JAZMI_pilihLatarHariIni dari
   js/bait-panel.js, untuk mengetahui motif "hari ini" sebagai
   pilihan awal. Tanpa itu, motif awal = bintang delapan.

   Aset motif dibaca dari assets/motif/*.svg (diwarnai ulang sesuai
   tema). Jika gagal dimuat (mis. dibuka via file://), gambar tetap
   jadi, hanya tanpa tekstur motif.
   ========================================================= */

(function () {
  "use strict";

  /* ---------- Konstanta ---------- */

  var FONT_ARAB = '"Amiri","Traditional Arabic","Scheherazade New","Noto Naskh Arabic",serif';
  var FONT_JUDUL = '"Fraunces",Georgia,"Times New Roman",serif';
  var FONT_BADAN = '"Karla",-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif';

  var DIR_MOTIF = "assets/motif/";
  var BERKAS_MOTIF = { 1: "bintang-delapan.svg", 2: "bunga-arabesk.svg", 3: "anyaman-geometri.svg" };
  var UKURAN_UBIN_MOTIF = { 1: 120, 2: 140, 3: 100 };
  var NAMA_MOTIF = { 1: "Bintang", 2: "Bunga", 3: "Anyaman", 0: "Polos" };

  var FORMAT = {
    persegi: { nama: "Persegi 1:1", w: 1080, h: 1080 },
    potret: { nama: "Potret 4:5", w: 1080, h: 1350 },
    story: { nama: "Story 9:16", w: 1080, h: 1920 }
  };

  var TEMA = {
    zamrud: {
      nama: "Zamrud", swatch: "#0F3D2E",
      bg: ["#14513D", "#0F3D2E", "#0A2B20"], glow: "rgba(216,192,138,0.16)",
      teks: "#FBF6E8", lembut: "#E4DCC3",
      emas: "#D8C08A", emas2: "#A9812F", motif: "#D8C08A", motifAlpha: 0.26,
      lengkungIsi: "rgba(216,192,138,0.07)", medalionBg: "#0F3D2E", medalionFg: "#D8C08A"
    },
    gading: {
      nama: "Gading", swatch: "#EDE3C8",
      bg: ["#FCF8EE", "#F4EDD9", "#EADFC1"], glow: "rgba(169,129,47,0.12)",
      teks: "#0F3D2E", lembut: "#3E5247",
      emas: "#A9812F", emas2: "#7A5C1C", motif: "#A9812F", motifAlpha: 0.30,
      lengkungIsi: "rgba(15,61,46,0.045)", medalionBg: "#0F3D2E", medalionFg: "#E6CF98"
    },
    malam: {
      nama: "Malam", swatch: "#09150F",
      bg: ["#11261F", "#08140F", "#040A07"], glow: "rgba(227,199,121,0.12)",
      teks: "#F7F0DB", lembut: "#CDC5AB",
      emas: "#E3C779", emas2: "#B8913A", motif: "#E3C779", motifAlpha: 0.22,
      lengkungIsi: "rgba(227,199,121,0.06)", medalionBg: "#08140F", medalionFg: "#E3C779"
    },
    lazuardi: {
      nama: "Lazuardi", swatch: "#1A2F5C",
      bg: ["#26427A", "#18305E", "#0C1A38"], glow: "rgba(216,192,138,0.15)",
      teks: "#FBF6E8", lembut: "#DCD8CC",
      emas: "#D8C08A", emas2: "#A9812F", motif: "#D8C08A", motifAlpha: 0.30,
      lengkungIsi: "rgba(216,192,138,0.07)", medalionBg: "#0C1A38", medalionFg: "#D8C08A"
    }
  };

  var state = { format: "potret", tema: "zamrud", motif: 1, hiasan: "lengkung" };

  var el = {};            // referensi elemen panel
  var kanvas = null;      // <canvas> pratinjau = hasil unduh
  var tokenRender = 0;    // pembatal render yang sudah usang
  var cacheMotif = {};    // "nomor|warna|ukuran" -> Image

  /* ---------- Utilitas data ---------- */

  function teksDari(id) {
    var n = document.getElementById(id);
    return n ? (n.textContent || "").trim() : "";
  }

  // Tatwil (kashida, U+0640) sering dipakai di data untuk perenggangan
  // huruf; di gambar justru membuat huruf tampak bolong-bolong, jadi
  // dibuang. Tidak mengubah makna/harakat.
  function bersihkanArab(s) {
    return s.replace(/\u0640/g, "").replace(/\s+/g, " ").trim();
  }

  function pecahBait(arab) {
    var bagian = arab.split(/\s*(?:\.{3}|\u2026)\s*/).filter(function (x) { return x; });
    if (bagian.length >= 2) return [bagian[0], bagian.slice(1).join(" ")];
    return [arab];
  }

  function ambilData() {
    return {
      arab: bersihkanArab(teksDari("baitArab")),
      terjemahan: teksDari("baitTerjemahan"),
      penyair: teksDari("baitPenyair"),
      sumber: teksDari("baitSumber")
    };
  }

  function tanggalPanjang() {
    try {
      return new Date().toLocaleDateString("id-ID", {
        weekday: "long", day: "numeric", month: "long", year: "numeric"
      });
    } catch (e) {
      return new Date().toDateString();
    }
  }

  function tanggalBerkas() {
    var d = new Date();
    var p = function (n) { return (n < 10 ? "0" : "") + n; };
    return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate());
  }

  /* ---------- Utilitas kanvas ---------- */

  function setFont(ctx, bobot, ukuran, keluarga) {
    ctx.font = bobot + " " + Math.round(ukuran) + "px " + keluarga;
  }

  function bungkusBaris(ctx, teks, lebarMaks) {
    var kata = teks.split(/\s+/).filter(function (x) { return x; });
    var baris = [];
    var kini = "";
    kata.forEach(function (k) {
      var uji = kini ? kini + " " + k : k;
      if (!kini || ctx.measureText(uji).width <= lebarMaks) {
        kini = uji;
      } else {
        baris.push(kini);
        kini = k;
      }
    });
    if (kini) baris.push(kini);
    return baris;
  }

  // Tulis teks Latin dengan jarak antarhuruf (tanpa bergantung pada
  // ctx.letterSpacing yang belum ada di semua peramban).
  function tulisRenggang(ctx, teks, cx, y, jarak) {
    var lebar = 0;
    var i;
    for (i = 0; i < teks.length; i++) lebar += ctx.measureText(teks[i]).width + jarak;
    lebar -= jarak;
    var x = cx - lebar / 2;
    var alignAsli = ctx.textAlign;
    ctx.textAlign = "left";
    for (i = 0; i < teks.length; i++) {
      ctx.fillText(teks[i], x, y);
      x += ctx.measureText(teks[i]).width + jarak;
    }
    ctx.textAlign = alignAsli;
  }

  // Bintang delapan titik (khatam). R = jari-jari ujung, r = lekuk.
  function jalurBintang(ctx, cx, cy, R, r, rot) {
    var n = 8;
    ctx.beginPath();
    for (var i = 0; i < n * 2; i++) {
      var rad = i % 2 === 0 ? R : r;
      var a = rot + (Math.PI * i) / n - Math.PI / 2;
      var x = cx + Math.cos(a) * rad;
      var y = cy + Math.sin(a) * rad;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
  }

  // Bingkai persegi panjang dengan sudut cekung (gaya bingkai Islami).
  function jalurBingkai(ctx, x, y, w, h, r) {
    var PI = Math.PI;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arc(x + w, y, r, PI, PI / 2, true);
    ctx.lineTo(x + w, y + h - r);
    ctx.arc(x + w, y + h, r, 1.5 * PI, PI, true);
    ctx.lineTo(x + r, y + h);
    ctx.arc(x, y + h, r, 0, -PI / 2, true);
    ctx.lineTo(x, y + r);
    ctx.arc(x, y, r, PI / 2, 0, true);
    ctx.closePath();
  }

  // Lengkung runcing (mihrab). ys = garis pegas, aw = setengah lebar,
  // ht = tinggi dari garis pegas ke puncak, yb = dasar.
  function jalurLengkung(ctx, cx, aw, ys, ht, yb) {
    var e = Math.max(0, (ht * ht - aw * aw) / (2 * aw));
    var R = aw + e;
    var sudut = Math.acos(e / R);
    var PI = Math.PI;
    ctx.beginPath();
    ctx.moveTo(cx - aw, yb);
    ctx.lineTo(cx - aw, ys);
    ctx.arc(cx + e, ys, R, PI, PI + sudut, false);
    ctx.arc(cx - e, ys, R, 2 * PI - sudut, 2 * PI, false);
    ctx.lineTo(cx + aw, yb);
    ctx.closePath();
  }

  // Garis hias: ——✦—— dengan bintang kecil di tengah.
  function gambarPemisah(ctx, tema, cx, y, setengah, rBintang) {
    var celah = rBintang * 2.4;
    ctx.save();
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = tema.emas;
    ctx.globalAlpha = 0.75;
    ctx.beginPath();
    ctx.moveTo(cx - setengah, y);
    ctx.lineTo(cx - celah, y);
    ctx.moveTo(cx + celah, y);
    ctx.lineTo(cx + setengah, y);
    ctx.stroke();
    ctx.globalAlpha = 1;
    [-1, 1].forEach(function (s) {
      ctx.beginPath();
      ctx.arc(cx + s * setengah, y, 3, 0, 2 * Math.PI);
      ctx.fillStyle = tema.emas;
      ctx.fill();
    });
    jalurBintang(ctx, cx, y, rBintang, rBintang * 0.58, 0);
    ctx.fillStyle = tema.emas;
    ctx.fill();
    ctx.restore();
  }

  /* ---------- Motif latar & font ---------- */

  function muatMotif(nomor, warna, ubin) {
    if (!BERKAS_MOTIF[nomor]) return Promise.resolve(null);
    var kunci = nomor + "|" + warna + "|" + ubin;
    if (cacheMotif[kunci]) return Promise.resolve(cacheMotif[kunci]);

    return fetch(DIR_MOTIF + BERKAS_MOTIF[nomor])
      .then(function (r) {
        if (!r.ok) throw new Error("motif " + r.status);
        return r.text();
      })
      .then(function (svg) {
        svg = svg.replace(/#D8C08A/gi, warna);
        svg = svg.replace(/(<svg[^>]*?)\swidth="[^"]*"/, '$1 width="' + ubin + '"');
        svg = svg.replace(/(<svg[^>]*?)\sheight="[^"]*"/, '$1 height="' + ubin + '"');
        var url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
        return new Promise(function (ok, gagal) {
          var img = new Image();
          img.onload = function () { cacheMotif[kunci] = img; ok(img); };
          img.onerror = function () { gagal(new Error("motif tak terbaca")); };
          img.src = url;
        });
      })
      .catch(function (err) {
        console.warn("[JAZMI] Motif latar tidak dimuat:", err);
        return null;
      });
  }

  function muatFont() {
    if (!document.fonts || !document.fonts.load) return Promise.resolve();
    return Promise.all([
      document.fonts.load("400 60px Amiri", "\u0628\u0633\u0645"),
      document.fonts.load("700 30px Fraunces", "JAZMI"),
      document.fonts.load("400 30px Karla", "Abc"),
      document.fonts.load("700 24px Karla", "ABC")
    ]).catch(function () { /* lanjut dengan font cadangan */ });
  }

  /* ---------- Tata letak & lukisan ---------- */

  function hitungTataLetak(ctx, W, H, data, k, lengkung) {
    var pad = 44;
    var lebarIsi = W - 2 * (pad + 82);
    var atas = pad + 64;
    var bawah = H - pad - 34;

    var L = { k: k, W: W, H: H, pad: pad, lengkung: lengkung };

    L.footerTinggi = 150 * k;
    L.footerTop = bawah - L.footerTinggi;

    L.eyebrowY = atas + 22 * k;
    L.tanggalY = L.eyebrowY + 38 * k;
    L.kepalaBawah = L.tanggalY + 14 * k;

    var aw = Math.min(400, (W - 2 * (pad + 70)) / 2);
    var maxArab = lengkung ? aw * 2 - 96 : lebarIsi;
    var fsMaks = (lengkung ? 74 : 82) * k;
    var fsMin = 34 * k;
    ctx.direction = "rtl";
    var baris = pecahBait(data.arab);
    var fs = fsMaks;
    while (fs > fsMin) {
      setFont(ctx, 400, fs, FONT_ARAB);
      var ok = baris.every(function (b) { return ctx.measureText(b).width <= maxArab; });
      if (ok) break;
      fs -= 2;
    }
    setFont(ctx, 400, fs, FONT_ARAB);
    L.arabFs = fs;
    L.arabBaris = [];
    baris.forEach(function (b) {
      bungkusBaris(ctx, b, maxArab).forEach(function (x) { L.arabBaris.push(x); });
    });
    L.arabLh = fs * 1.95;
    L.arabTinggi = L.arabBaris.length * L.arabLh;
    ctx.direction = "ltr";

    L.terjFs = 35 * k;
    setFont(ctx, 400, L.terjFs, FONT_BADAN);
    L.terjBaris = data.terjemahan ? bungkusBaris(ctx, data.terjemahan, lebarIsi - 20) : [];
    L.terjLh = L.terjFs * 1.5;
    L.terjTinggi = L.terjBaris.length * L.terjLh;

    L.metaFs = 26 * k;
    var meta = [data.penyair, data.sumber].filter(function (x) { return x; }).join("  \u00B7  ");
    setFont(ctx, 700, L.metaFs, FONT_BADAN);
    L.metaBaris = meta ? bungkusBaris(ctx, meta, lebarIsi) : [];
    L.metaLh = L.metaFs * 1.4;
    L.metaTinggi = L.metaBaris.length * L.metaLh;

    L.aw = aw;
    L.cx = W / 2;
    L.lebarIsi = lebarIsi;
    L.jarakBlok = 30 * k;

    var ekor = L.terjTinggi + (L.metaTinggi ? 16 * k + L.metaTinggi : 0);
    if (lengkung) {
      L.ht = aw * (H >= 1800 ? 1.45 : 1.28);
      L.antaraLengkungTeks = 34 * k;
      L.bawahLengkung = 40 * k;
      L.badanTinggi = L.ht + L.antaraLengkungTeks + L.arabTinggi + L.bawahLengkung + L.jarakBlok + ekor;
    } else {
      L.pemisah = 58 * k;
      L.badanTinggi = L.arabTinggi + L.pemisah + ekor;
    }

    L.ruang = L.footerTop - L.kepalaBawah - 26 * k;
    L.muat = L.badanTinggi <= L.ruang;
    return L;
  }

  function lukisKartu(ctx, W, H, data, tema, motifImg, lengkungDiminta) {
    var lengkung = lengkungDiminta && H > W;   // lengkung hanya untuk potret/story

    // Format tinggi (Story) punya ruang lebih: mulai dari skala >1 agar
    // huruf dan hiasan mengisi kartu, lalu turunkan sampai muat.
    var k = H >= 1800 ? (lengkung ? 1.2 : 1.3) : (H >= 1300 ? (lengkung ? 1 : 1.12) : 1);
    var L = hitungTataLetak(ctx, W, H, data, k, lengkung);
    while (!L.muat && k > 0.5) {
      k -= 0.04;
      L = hitungTataLetak(ctx, W, H, data, k, lengkung);
    }

    var cx = W / 2;

    /* --- Latar --- */
    var g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, tema.bg[0]);
    g.addColorStop(0.55, tema.bg[1]);
    g.addColorStop(1, tema.bg[2]);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    var rg = ctx.createRadialGradient(cx, H * 0.18, 20, cx, H * 0.18, W * 0.95);
    rg.addColorStop(0, tema.glow);
    rg.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = rg;
    ctx.fillRect(0, 0, W, H);

    if (motifImg) {
      var pola = ctx.createPattern(motifImg, "repeat");
      if (pola) {
        ctx.globalAlpha = tema.motifAlpha;
        ctx.fillStyle = pola;
        ctx.fillRect(0, 0, W, H);
        ctx.globalAlpha = 1;
      }
    }

    // Bintang raksasa samar di belakang (mode bingkai)
    if (!lengkung) {
      ctx.save();
      ctx.globalAlpha = 0.07;
      ctx.strokeStyle = tema.emas;
      ctx.lineWidth = 2;
      var pusatY = L.kepalaBawah + (L.footerTop - L.kepalaBawah) / 2;
      var R0 = Math.min(W * 0.46, (L.footerTop - L.kepalaBawah) * 0.5);
      jalurBintang(ctx, cx, pusatY, R0, R0 * 0.72, 0);
      ctx.stroke();
      jalurBintang(ctx, cx, pusatY, R0 * 0.78, R0 * 0.56, Math.PI / 8);
      ctx.stroke();
      ctx.restore();
    }

    /* --- Bingkai --- */
    var emasGrad = ctx.createLinearGradient(0, 0, W, H);
    emasGrad.addColorStop(0, tema.emas);
    emasGrad.addColorStop(0.5, tema.emas2);
    emasGrad.addColorStop(1, tema.emas);

    var p = L.pad;
    ctx.lineJoin = "round";
    jalurBingkai(ctx, p, p, W - 2 * p, H - 2 * p, 34);
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = emasGrad;
    ctx.stroke();

    jalurBingkai(ctx, p + 14, p + 14, W - 2 * (p + 14), H - 2 * (p + 14), 22);
    ctx.lineWidth = 1.4;
    ctx.globalAlpha = 0.55;
    ctx.strokeStyle = tema.emas;
    ctx.stroke();
    ctx.globalAlpha = 1;

    [[p, p], [W - p, p], [p, H - p], [W - p, H - p]].forEach(function (t) {
      jalurBintang(ctx, t[0], t[1], 21, 12, 0);
      ctx.fillStyle = emasGrad;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(t[0], t[1], 4.2, 0, 2 * Math.PI);
      ctx.fillStyle = tema.bg[1];
      ctx.fill();
    });

    /* --- Kepala --- */
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = tema.emas;
    setFont(ctx, 700, 23 * L.k, FONT_BADAN);
    tulisRenggang(ctx, "BAIT SYAIR HARI INI", cx, L.eyebrowY, 6 * L.k);

    ctx.fillStyle = tema.lembut;
    ctx.globalAlpha = 0.85;
    setFont(ctx, 400, 21 * L.k, FONT_BADAN);
    ctx.fillText(tanggalPanjang(), cx, L.tanggalY);
    ctx.globalAlpha = 1;

    /* --- Badan --- */
    var bebas = Math.max(0, L.ruang - L.badanTinggi);
    var y = L.kepalaBawah + bebas * (lengkung ? 0.4 : 0.5) + 6 * L.k;

    if (lengkung) {
      var aw = L.aw;
      var ys = y + L.ht;
      var yb = ys + L.antaraLengkungTeks + L.arabTinggi + L.bawahLengkung;

      jalurLengkung(ctx, cx, aw, ys, L.ht, yb);
      ctx.fillStyle = tema.lengkungIsi;
      ctx.fill();

      jalurLengkung(ctx, cx, aw, ys, L.ht, yb);
      ctx.lineWidth = 3;
      ctx.strokeStyle = emasGrad;
      ctx.stroke();

      jalurLengkung(ctx, cx, aw - 15, ys, L.ht - 12, yb - 15);
      ctx.lineWidth = 1.3;
      ctx.globalAlpha = 0.6;
      ctx.strokeStyle = tema.emas;
      ctx.stroke();
      ctx.globalAlpha = 1;

      // medali "ز" di ruang lengkung bagian atas
      var my = y + L.ht * 0.55;
      var mr = 56 * L.k;
      ctx.save();
      jalurBintang(ctx, cx, my, mr * 1.55, mr * 1.12, 0);
      ctx.lineWidth = 2.2;
      ctx.strokeStyle = emasGrad;
      ctx.stroke();
      ctx.restore();

      ctx.beginPath();
      ctx.arc(cx, my, mr, 0, 2 * Math.PI);
      ctx.fillStyle = tema.medalionBg;
      ctx.fill();
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = emasGrad;
      ctx.stroke();
      ctx.fillStyle = tema.medalionFg;
      ctx.direction = "rtl";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      setFont(ctx, 400, 70 * L.k, FONT_ARAB);
      ctx.fillText("\u0632", cx, my + 6 * L.k);
      ctx.textBaseline = "alphabetic";
      ctx.direction = "ltr";

      lukisArab(ctx, L, tema, cx, ys + L.antaraLengkungTeks);
      lukisTerjemahanMeta(ctx, L, tema, cx, yb + L.jarakBlok);
    } else {
      lukisArab(ctx, L, tema, cx, y);
      var yP = y + L.arabTinggi + L.pemisah * 0.5;
      gambarPemisah(ctx, tema, cx, yP, Math.min(190, W * 0.18), 10 * L.k + 3);
      lukisTerjemahanMeta(ctx, L, tema, cx, yP + L.pemisah * 0.5 + 6 * L.k);
    }

    lukisFooter(ctx, L, tema, cx, emasGrad);
  }

  function lukisArab(ctx, L, tema, cx, yAtas) {
    ctx.save();
    ctx.direction = "rtl";
    ctx.textAlign = "center";
    ctx.fillStyle = tema.teks;
    setFont(ctx, 400, L.arabFs, FONT_ARAB);
    ctx.shadowColor = "rgba(0,0,0,0.22)";
    ctx.shadowBlur = 6;
    ctx.shadowOffsetY = 2;
    ctx.textBaseline = "middle";
    L.arabBaris.forEach(function (b, i) {
      ctx.fillText(b, cx, yAtas + L.arabLh * (i + 0.5));
    });
    ctx.restore();
  }

  function lukisTerjemahanMeta(ctx, L, tema, cx, yAwal) {
    var y = yAwal;
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";

    if (L.terjBaris.length) {
      ctx.fillStyle = tema.lembut;
      setFont(ctx, 400, L.terjFs, FONT_BADAN);
      L.terjBaris.forEach(function (b, i) {
        ctx.fillText(b, cx, y + L.terjFs + L.terjLh * i);
      });
      y += L.terjTinggi;
    }
    if (L.metaBaris.length) {
      y += 16 * L.k;
      ctx.fillStyle = tema.emas;
      setFont(ctx, 700, L.metaFs, FONT_BADAN);
      L.metaBaris.forEach(function (b, i) {
        ctx.fillText(b, cx, y + L.metaFs + L.metaLh * i);
      });
      y += L.metaTinggi;
    }
    return y;
  }

  function lukisFooter(ctx, L, tema, cx, emasGrad) {
    var y0 = L.footerTop;
    var k = L.k;

    ctx.save();
    ctx.globalAlpha = 0.4;
    ctx.strokeStyle = tema.emas;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(cx - 150, y0);
    ctx.lineTo(cx + 150, y0);
    ctx.stroke();
    ctx.restore();

    var ey = y0 + 46 * k;
    var er = 25 * k;
    ctx.beginPath();
    ctx.arc(cx, ey, er, 0, 2 * Math.PI);
    ctx.fillStyle = tema.medalionBg;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = emasGrad;
    ctx.stroke();
    ctx.fillStyle = tema.medalionFg;
    ctx.direction = "rtl";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    setFont(ctx, 400, 34 * k, FONT_ARAB);
    ctx.fillText("\u0632", cx, ey + 3 * k);
    ctx.direction = "ltr";
    ctx.textBaseline = "alphabetic";

    ctx.fillStyle = tema.teks;
    setFont(ctx, 700, 27 * k, FONT_JUDUL);
    tulisRenggang(ctx, "JAZMI", cx, y0 + 101 * k, 5 * k);

    ctx.fillStyle = tema.lembut;
    ctx.globalAlpha = 0.85;
    setFont(ctx, 400, 19 * k, FONT_BADAN);
    ctx.fillText("Jalinan Zamrud Islamiah  \u00B7  qiladat.com", cx, y0 + 130 * k);
    ctx.globalAlpha = 1;
  }

  /* ---------- Render, unduh, bagikan ---------- */

  function render() {
    if (!kanvas) return Promise.resolve();
    var saya = ++tokenRender;
    var f = FORMAT[state.format];
    var tema = TEMA[state.tema];
    var data = ambilData();
    var ubin = Math.round((UKURAN_UBIN_MOTIF[state.motif] || 120) * 1.25);

    return Promise.all([muatFont(), muatMotif(state.motif, tema.motif, ubin)]).then(function (hasil) {
      if (saya !== tokenRender) return;
      kanvas.width = f.w;
      kanvas.height = f.h;
      var ctx = kanvas.getContext("2d");
      ctx.clearRect(0, 0, f.w, f.h);
      lukisKartu(ctx, f.w, f.h, data, tema, hasil[1], state.hiasan === "lengkung");
      kanvas.setAttribute("aria-label", "Pratinjau gambar bait syair hari ini, " + f.nama);
    });
  }

  function bikinBlob() {
    return new Promise(function (ok) { kanvas.toBlob(ok, "image/png"); });
  }

  function namaBerkas() {
    return "jazmi-bait-syair-" + tanggalBerkas() + "-" + state.format + ".png";
  }

  function unduh() {
    var labelAsli = el.btnUnduh.textContent;
    el.btnUnduh.disabled = true;
    el.btnUnduh.textContent = "Menyiapkan…";
    render()
      .then(bikinBlob)
      .then(function (blob) {
        if (!blob) throw new Error("kanvas kosong");
        var url = URL.createObjectURL(blob);
        var a = document.createElement("a");
        a.href = url;
        a.download = namaBerkas();
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
      })
      .catch(function (err) {
        console.error("[JAZMI] Gagal membuat gambar kartu bait:", err);
        window.alert("Maaf, gambar gagal dibuat. Coba lagi sesaat lagi.");
      })
      .then(function () {
        el.btnUnduh.disabled = false;
        el.btnUnduh.textContent = labelAsli;
      });
  }

  function bagikan() {
    render()
      .then(bikinBlob)
      .then(function (blob) {
        if (!blob) throw new Error("kanvas kosong");
        var berkas = new File([blob], namaBerkas(), { type: "image/png" });
        if (navigator.canShare && !navigator.canShare({ files: [berkas] })) {
          throw new Error("perangkat tidak mendukung berbagi berkas");
        }
        return navigator.share({
          files: [berkas],
          title: "Bait Syair Hari Ini \u2014 JAZMI",
          text: "Bait Syair Hari Ini \u00B7 qiladat.com"
        });
      })
      .catch(function (err) {
        if (err && err.name === "AbortError") return;   // menu bagikan ditutup pengguna
        console.error("[JAZMI] Gagal membagikan gambar:", err);
        window.alert("Maaf, gambar belum bisa dibagikan dari sini. Gunakan tombol Unduh PNG.");
      });
  }

  /* ---------- Antarmuka panel ---------- */

  function buat(tag, kelas, teks) {
    var n = document.createElement(tag);
    if (kelas) n.className = kelas;
    if (teks) n.textContent = teks;
    return n;
  }

  function buatGrupPilihan(judul, kunci, pilihan) {
    var set = buat("fieldset", "bait-opsi");
    set.appendChild(buat("legend", "bait-opsi-judul", judul));
    var baris = buat("div", "bait-chips");
    pilihan.forEach(function (p) {
      var b = buat("button", "bait-chip");
      b.type = "button";
      b.setAttribute("data-opsi", kunci);
      b.setAttribute("data-nilai", String(p.nilai));
      if (p.swatch) {
        var s = buat("span", "bait-chip-swatch");
        s.style.background = p.swatch;
        b.appendChild(s);
      }
      b.appendChild(document.createTextNode(p.label));
      baris.appendChild(b);
    });
    set.appendChild(baris);
    return set;
  }

  function tandaiChip() {
    var chips = el.panel.querySelectorAll(".bait-chip");
    Array.prototype.forEach.call(chips, function (c) {
      var kunci = c.getAttribute("data-opsi");
      var nilaiEfektif = state[kunci];
      // Persegi selalu memakai bingkai (lengkung hanya untuk Potret/Story)
      if (kunci === "hiasan" && state.format === "persegi") nilaiEfektif = "bingkai";
      var aktif = String(nilaiEfektif) === c.getAttribute("data-nilai");
      c.classList.toggle("aktif", aktif);
      c.setAttribute("aria-pressed", aktif ? "true" : "false");
    });
    var chipLengkung = el.panel.querySelector('[data-opsi="hiasan"][data-nilai="lengkung"]');
    if (chipLengkung) {
      var persegi = state.format === "persegi";
      chipLengkung.disabled = persegi;
      chipLengkung.title = persegi ? "Lengkung tersedia untuk ukuran Potret dan Story" : "";
    }
  }

  function bangunPanel() {
    el.panel.innerHTML = "";

    var pratinjau = buat("div", "bait-studio-pratinjau");
    kanvas = buat("canvas", "bait-studio-kanvas");
    kanvas.setAttribute("role", "img");
    pratinjau.appendChild(kanvas);

    var kontrol = buat("div", "bait-studio-kontrol");
    kontrol.appendChild(buatGrupPilihan("Ukuran", "format", Object.keys(FORMAT).map(function (k) {
      return { nilai: k, label: FORMAT[k].nama };
    })));
    kontrol.appendChild(buatGrupPilihan("Tema", "tema", Object.keys(TEMA).map(function (k) {
      return { nilai: k, label: TEMA[k].nama, swatch: TEMA[k].swatch };
    })));
    kontrol.appendChild(buatGrupPilihan("Motif latar", "motif", [1, 2, 3, 0].map(function (n) {
      return { nilai: n, label: NAMA_MOTIF[n] };
    })));
    kontrol.appendChild(buatGrupPilihan("Hiasan", "hiasan", [
      { nilai: "lengkung", label: "Lengkung" },
      { nilai: "bingkai", label: "Bingkai" }
    ]));

    var aksi = buat("div", "bait-studio-aksi");
    el.btnUnduh = buat("button", "bait-btn bait-btn-utama", "Unduh PNG");
    el.btnUnduh.type = "button";
    el.btnUnduh.addEventListener("click", unduh);
    aksi.appendChild(el.btnUnduh);

    if (navigator.share && navigator.canShare) {
      el.btnBagikan = buat("button", "bait-btn bait-btn-kedua", "Bagikan");
      el.btnBagikan.type = "button";
      el.btnBagikan.addEventListener("click", bagikan);
      aksi.appendChild(el.btnBagikan);
    }
    kontrol.appendChild(aksi);
    kontrol.appendChild(buat("p", "bait-studio-catatan",
      "Gambar dibuat langsung di perangkat Anda. Teks Arab tetap berupa huruf asli, bukan tangkapan layar."));

    el.panel.appendChild(pratinjau);
    el.panel.appendChild(kontrol);

    el.panel.addEventListener("click", function (e) {
      var c = e.target.closest ? e.target.closest(".bait-chip") : null;
      if (!c || c.disabled) return;
      var kunci = c.getAttribute("data-opsi");
      var nilai = c.getAttribute("data-nilai");
      if (kunci === "motif") nilai = parseInt(nilai, 10);
      state[kunci] = nilai;
      tandaiChip();
      render();
    });
  }

  function motifHariIni() {
    var elCard = document.getElementById("baitCard");
    if (!elCard) return 1;
    if (typeof window.JAZMI_pilihLatarHariIni === "function") {
      window.JAZMI_pilihLatarHariIni();
    }
    for (var i = 1; i <= 3; i++) {
      if (elCard.classList.contains("bait-bg-" + i)) return i;
    }
    return 1;
  }

  function pasang() {
    el.btnBuka = document.getElementById("baitUnduhBtn");
    el.panel = document.getElementById("baitStudio");
    if (!el.btnBuka || !el.panel) return;

    var dibangun = false;
    el.btnBuka.addEventListener("click", function () {
      var buka = el.panel.hasAttribute("hidden");
      if (buka) {
        if (!dibangun) {
          state.motif = motifHariIni();
          bangunPanel();
          dibangun = true;
        }
        el.panel.removeAttribute("hidden");
        tandaiChip();
        render();
        el.btnBuka.textContent = "Tutup studio gambar";
        el.btnBuka.setAttribute("aria-expanded", "true");
      } else {
        el.panel.setAttribute("hidden", "");
        el.btnBuka.textContent = "Simpan sebagai gambar";
        el.btnBuka.setAttribute("aria-expanded", "false");
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", pasang);
  } else {
    pasang();
  }
})();
