# Photobooth

Aplikasi photobooth berbasis web: ambil 4 foto dengan countdown dan prompt pose, lalu otomatis
dibuat **lembar cetak 4x6"** (2 strip identik), **foto story 9:16**, dan **GIF animasi**.
Hasilnya di-upload ke Cloudinary, dan tamu cukup scan QR code untuk mengambil fotonya di
halaman galeri.

Dibuat dengan **Vite + TypeScript** tanpa framework, jadi ringan dan bisa di-host sebagai
file statis di mana saja.

## Fitur

**Booth (operator)** — `index.html`
- Pilih kamera: webcam Mac, iPhone (Continuity Camera), atau DSLR lewat capture card HDMI
- 5 deck prompt pose: Bestie, Couple, Chaos, Corporate, Anak Kuliahan
- Countdown, efek flash, dan indikator progres foto
- Mirror on/off untuk preview dan hasil foto
- Komposisi otomatis: lembar cetak 1200×1800 (300dpi), story 1080×1920, GIF 480×320
- Kode sesi 6 karakter dicetak di strip (tanpa huruf yang mirip seperti 0/O dan 1/I/L)
- Upload ke Cloudinary; kalau cloud belum diatur atau upload gagal, file di-download lokal
- Lembar cetak selalu di-download ke komputer untuk dicetak
- QR code besar di layar setelah sesi selesai, supaya tamu bisa langsung scan
- Pengaturan tersimpan otomatis di browser (tetap ada setelah reload)
- Shortcut keyboard: `Space` mulai sesi, `Esc` batal/reset, `F` fullscreen
- Log aktivitas

**Galeri (tamu)** — `gallery.html`
- Buka lewat QR (`?s=KODE`) atau ketik kode secara manual
- Preview strip dan GIF, tombol download foto / GIF / lembar cetak
- Tombol **Bagikan** (share sheet bawaan HP) jika browser mendukung

## Menjalankan

Butuh Node.js 20+.

```bash
npm install
npm run dev        # http://localhost:5173 (booth) dan /gallery.html
```

> Kamera hanya bisa diakses lewat `http://localhost` atau `https://`, tidak bisa dari `file://`.

Perintah lain:

```bash
npm run build      # build produksi ke folder dist/
npm run preview    # jalankan hasil build
npm test           # unit test
npm run typecheck  # cek TypeScript
```

## Konfigurasi

1. **Cloudinary**: buat akun gratis, lalu buka Settings → Upload → *Add upload preset* dengan
   mode **Unsigned**. Isi *cloud name* dan nama preset di panel Pengaturan booth.
2. **Galeri**: salin `.env.example` menjadi `.env` dan isi `VITE_CLOUDINARY_CLOUD_NAME` dengan
   cloud name yang sama (default: `fbhrxtkn`). Build, lalu host folder `dist/` (misalnya Netlify,
   Vercel, GitHub Pages, atau Cloudflare Pages).
3. Isi **URL halaman galeri** di booth, misalnya `https://domainkamu.com/gallery.html`. QR code
   akan mengarah ke URL itu ditambah kode sesi.

## Struktur

```
index.html, gallery.html     halaman booth & galeri
src/booth/
  main.ts                    alur sesi & UI
  camera.ts                  akses kamera (getUserMedia)
  compose.ts                 gambar strip, sheet, story, GIF
  layout.ts                  perhitungan crop/fit (diuji)
  config.ts                  ukuran cetak, timing, deck prompt
  settings.ts                pengaturan yang disimpan di localStorage
  logger.ts
src/gallery/main.ts          halaman galeri tamu
src/shared/                  kode sesi & URL Cloudinary (dipakai booth dan galeri)
src/styles/                  CSS
tests/                       unit test (Vitest)
```

## Mengganti desain frame

Desain strip saat ini masih placeholder (`drawStrip` di `src/booth/compose.ts`). Setelah
desainer mengekspor PNG 600×1800 dengan lubang transparan untuk foto, ganti bagian itu dengan
`ctx.drawImage(framePng, ...)`.

## Catatan keamanan

Upload preset *unsigned* dan cloud name terlihat di sisi browser, jadi siapa pun yang tahu
bisa upload ke akun Cloudinary tersebut. Cukup untuk prototype/event; untuk produksi sebaiknya
pakai signed upload lewat backend kecil, dan batasi preset (format, ukuran, folder `booth/`).
