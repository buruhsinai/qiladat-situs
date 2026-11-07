#!/usr/bin/env python3
# =============================================================
# JAZMI — Arsip Gambar
# generate-manifest.py
#
# CARA PAKAI:
#   1. Taruh gambar baru ke folder sumber yang sesuai di dalam
#      arsip/gambar/ (boleh folder baru juga, ikuti pola nama
#      "N. Nama Seri" atau "N. Nama Seri (I)" / "N. Nama Seri (S)").
#   2. Jalankan dari folder ini:  python3 generate-manifest.py
#   3. Skrip akan:
#        a) mengecilkan/mengoptimasi ukuran file gambar yang
#           masih berukuran besar (di tempat, menimpa file asli
#           dengan versi web-friendly — resolusi & kompresi
#           diturunkan, tapi TIDAK mengubah nama/format file),
#        b) menulis ulang arsip/gambar/data/gambar.json,
#           menyisipkan file-file BARU sebagai entri terbaru
#           (paling atas), dan MEMPERTAHANKAN urutan file lama
#           yang sudah pernah ada di manifest (supaya galeri
#           dan panel Home tidak "loncat acak" tiap kali
#           dijalankan ulang).
#   4. Upload ulang folder arsip/gambar/ (termasuk data/gambar.json
#      yang baru) ke server/hosting.
#
# Tidak perlu mengedit gambar.json secara manual — kalau memang
# perlu urutan khusus, field "urutan" boleh diubah manual dan
# tidak akan ditimpa skrip ini selama file itu masih ada di
# manifest lama (lihat MAX_DIMENSI/JPEG_QUALITY di bawah untuk
# pengaturan optimasi).
# =============================================================

import json
import re
import sys
from pathlib import Path
from datetime import datetime, timezone

try:
    from PIL import Image
except ImportError:
    print("Pillow belum terpasang. Jalankan: pip install Pillow --break-system-packages")
    sys.exit(1)

ROOT = Path(__file__).resolve().parent
DATA_DIR = ROOT / "data"
MANIFEST_PATH = DATA_DIR / "gambar.json"

EXT_GAMBAR = {".png", ".jpg", ".jpeg", ".webp"}
MAX_DIMENSI = 1600       # px, sisi terpanjang gambar setelah dioptimasi
JPEG_QUALITY = 82
PNG_MAKS_UKURAN = 500_000  # byte — PNG di atas ini akan dikonversi jadi JPEG (foto, bukan grafis transparan)
URUTAN_OFFSET = int(datetime(2099, 1, 1, tzinfo=timezone.utc).timestamp() * 1000)


def urai_nama_folder(nama_folder):
    """'6. Sains & Eksperimen (I)' -> (sumber_no='6', seri='Sains & Eksperimen', tipe='infografik')"""
    m = re.match(r"^(\d+)\.\s*(.+)$", nama_folder)
    sumber_no = m.group(1) if m else None
    sisa = m.group(2) if m else nama_folder

    tipe = None
    m2 = re.match(r"^(.*)\s+\((I|S)\)\s*$", sisa)
    if m2:
        sisa = m2.group(1).strip()
        tipe = "infografik" if m2.group(2) == "I" else "sinematik"

    return sumber_no, sisa.strip(), tipe


def kunci_urut_alami(nama_file):
    """Urutan alami untuk nama seperti '001.png', '001.2.png', '002.png'."""
    stem = Path(nama_file).stem
    bagian = re.split(r"[.\-_]", stem)
    hasil = []
    for b in bagian:
        hasil.append(int(b)) if b.isdigit() else hasil.append(b)
    return hasil


def coba_tanggal_dari_nama(nama_file):
    """Kalau nama file adalah angka panjang (timestamp epoch ms ala ekspor
    Facebook), kembalikan tanggal ISO. Kalau bukan, None."""
    stem = Path(nama_file).stem
    if stem.isdigit() and len(stem) >= 12:
        try:
            ms = int(stem)
            dt = datetime.fromtimestamp(ms / 1000, tz=timezone.utc)
            if 2015 <= dt.year <= 2035:
                return dt.strftime("%Y-%m-%d")
        except (ValueError, OSError):
            pass
    return None


def optimasi_gambar(path):
    """Resize + kompres di tempat kalau file lebih besar dari ambang batas.
    Aman dipanggil berulang kali — file yang sudah kecil dilewati."""
    try:
        ukuran_sebelum = path.stat().st_size
        with Image.open(path) as im:
            lebar, tinggi = im.size
            perlu_resize = max(lebar, tinggi) > MAX_DIMENSI
            perlu_kompres_png = path.suffix.lower() == ".png" and ukuran_sebelum > PNG_MAKS_UKURAN

            if not perlu_resize and not perlu_kompres_png:
                return False

            if perlu_resize:
                rasio = MAX_DIMENSI / max(lebar, tinggi)
                im = im.resize((round(lebar * rasio), round(tinggi * rasio)), Image.LANCZOS)

            if perlu_kompres_png:
                # PNG besar biasanya foto, bukan grafis dengan transparansi —
                # simpan ulang sebagai JPEG jauh lebih kecil kalau memang
                # tidak pakai kanal alpha; kalau pakai alpha, tetap PNG.
                if im.mode in ("RGBA", "LA") and im.getchannel("A").getextrema()[0] < 255:
                    im.save(path, "PNG", optimize=True)
                else:
                    rgb = im.convert("RGB")
                    jpg_path = path.with_suffix(".jpg")
                    rgb.save(jpg_path, "JPEG", quality=JPEG_QUALITY, optimize=True)
                    if jpg_path != path:
                        path.unlink()
                    return True  # nama file berubah — biar caller tahu
            else:
                im.save(path, quality=JPEG_QUALITY, optimize=True) if path.suffix.lower() in (".jpg", ".jpeg") else im.save(path, optimize=True)

        return False
    except Exception as e:
        print(f"  ! Gagal optimasi {path}: {e}")
        return False


def main():
    manifest_lama = {}
    if MANIFEST_PATH.exists():
        try:
            data_lama = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
            for g in data_lama.get("gambar", []):
                manifest_lama[(g["sumber"], g["file"])] = g
        except Exception as e:
            print(f"Peringatan: gagal baca manifest lama ({e}), mulai dari kosong.")

    urutan_maks_lama = max([g.get("urutan", 0) for g in manifest_lama.values()] + [0])

    folder_sumber = sorted(
        [p for p in ROOT.iterdir() if p.is_dir() and p.name != "data"],
        key=lambda p: p.name
    )

    entri_lama, entri_baru = [], []
    counter_baru = 0

    for folder in folder_sumber:
        sumber_no, seri, tipe = urai_nama_folder(folder.name)
        file_gambar = sorted(
            [f for f in folder.iterdir() if f.is_file() and f.suffix.lower() in EXT_GAMBAR],
            key=lambda f: kunci_urut_alami(f.name)
        )

        for f in file_gambar:
            berubah_nama = optimasi_gambar(f)
            if berubah_nama:
                f = f.with_suffix(".jpg")

            rel_path = f"{folder.name}/{f.name}"
            key = (folder.name, rel_path)

            if key in manifest_lama:
                entri_lama.append(manifest_lama[key])
                continue

            counter_baru += 1
            tanggal = coba_tanggal_dari_nama(f.name)
            entri_baru.append({
                "id": f"gbr-{len(manifest_lama) + counter_baru:04d}",
                "sumber": folder.name,
                "sumberNo": sumber_no,
                "seri": seri,
                "tipe": tipe,
                "file": rel_path,
                "tanggal": tanggal,
                "urutan": None,  # diisi di bawah, urutan_maks_lama + n
                "alt": f"{seri}{' — ' + tipe if tipe else ''}",
            })

    # Entri baru: yang punya tanggal asli diurutkan berdasarkan tanggal
    # (lebih baru = urutan lebih tinggi), sisanya ikut urutan pemindaian.
    entri_baru.sort(key=lambda g: (g["tanggal"] is None, g["tanggal"] or "", g["file"]))
    for i, g in enumerate(entri_baru):
        g["urutan"] = urutan_maks_lama + i + 1

    semua = entri_lama + entri_baru

    def kunci_sort_tampil(g):
        # Gambar yang tanggal aslinya diketahui (dari nama file timestamp
        # ekspor Facebook) SELALU ditampilkan lebih dulu daripada yang
        # tidak diketahui tanggalnya — beda dengan artikel (yang memang
        # sengaja menganggap "belum bertanggal" = draf terbaru). Di sini
        # kita tidak tahu urutan asli folder yang bernomor 001/002/003
        # tanpa timestamp, jadi mereka ditaruh di bawah kelompok
        # bertanggal, diurutkan pakai "urutan" (angka kecil, boleh
        # diedit manual kalau pengelola tahu urutan aslinya).
        if g.get("tanggal"):
            try:
                return datetime.strptime(g["tanggal"], "%Y-%m-%d").timestamp()
            except ValueError:
                pass
        return g.get("urutan") or 0

    semua.sort(key=kunci_sort_tampil, reverse=True)

    manifest = {
        "_catatan": (
            "Dihasilkan otomatis oleh generate-manifest.py — JANGAN diedit manual kecuali "
            "untuk menyesuaikan field 'urutan' (angka manual, makin besar = makin baru) atau "
            "'tanggal' (YYYY-MM-DD). Jalankan ulang skrip setiap kali menambah gambar baru ke "
            "folder-folder di arsip/gambar/. Field 'tipe' berisi 'infografik', 'sinematik', "
            "atau null (folder tanpa varian I/S). Field 'sumber' adalah nama folder asal "
            "(salah satu dari 6 akun/halaman sumber)."
        ),
        "gambar": semua,
    }

    DATA_DIR.mkdir(exist_ok=True)
    MANIFEST_PATH.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )

    print(f"Selesai. Total gambar: {len(semua)} (baru: {len(entri_baru)}, sudah ada sebelumnya: {len(entri_lama)})")
    print(f"Manifest ditulis ke: {MANIFEST_PATH}")


if __name__ == "__main__":
    main()
