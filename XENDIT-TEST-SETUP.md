# Xendit sandbox — tahap 1

Halaman `/uji-pembayaran` hanya tersedia pada deployment Vercel Preview dan hanya admin terverifikasi yang dapat membuat/membaca sesi. Production tetap COD.

## Konfigurasi

- `XENDIT_SECRET_KEY`: Secret, Preview saja, key Mode Tes (`xnd_development_...`).
- Supabase URL + publishable key diperlukan untuk memverifikasi identitas dan role admin. Tidak memakai service-role key.
- Buat deployment Preview baru setelah mengubah environment variables.
- API key Xendit perlu akses membuat dan membaca Payment Sessions. Channel bergantung pada akun.

## Alur

Masuk admin pada URL Preview → `/uji-pembayaran` → pilih VA/e-wallet → buat simulasi Rp10.000 → buka halaman Xendit di tab baru → lakukan simulasi sesuai petunjuk Mode Tes → kembali dan periksa status.

Simpan ID sesi untuk memeriksa kembali setelah reload. Jika pembuatan sesi timeout, periksa dashboard Xendit sebelum mengulangi; retry POST belum dijamin idempotent dan bisa membuat sesi tes tambahan.

## Batas keamanan dan cakupan

- Tidak ada uang sungguhan, pesanan produksi, pengurangan stok, perubahan keranjang, pengiriman, atau pencatatan pendapatan.
- Nominal tetap di server; channel memakai allowlist tanpa QRIS.
- API ditutup di semua environment selain Preview, dan menolak key Live.
- Status diperoleh dari API Xendit dengan pemeriksaan kepemilikan metadata, bukan query string redirect.
- Tidak ada akses tulis Supabase. Preview yang memakai database produksi tetap hanya membaca auth/profile untuk fitur ini.
- Belum mengintegrasikan checkout buku, penyimpanan riwayat lintas perangkat di Fritzoria, webhook, atau transfer bank manual. Ini tahap koneksi sandbox, bukan payment gateway produksi selesai.
- Jangan gunakan data identitas/rekening sungguhan untuk simulasi; ikuti fixture resmi channel Xendit.

Dokumentasi: https://docs.xendit.co/apidocs/create-session dan https://docs.xendit.co/apidocs/get-session
