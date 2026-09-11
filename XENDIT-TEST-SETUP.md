# Xendit sandbox — checkout Mode Tes

## Pembaruan checkout 2026-09-11

Preview/admin saja; Production tetap COD. Terapkan migrasi `20260911092022_simulation_orders.sql` sebelum mencoba checkout.

Masuk admin pada Preview, tambah buku fisik, buka `/checkout`, pilih **VA / e-wallet — Mode Tes**, pilih channel dan konfirmasi simulasi. Setelah simulasi Xendit, klik **Periksa status dari Xendit**. `/pesanan-simulasi` memuat 50 percobaan terbaru milik admin tersebut, tersimpan lintas perangkat.

- Tabel `simulation_orders` terpisah dari pesanan asli, stok, pendapatan dan pengiriman. Harga dihitung ulang server; tidak mengirim alamat, email atau nomor HP ke Xendit. Tanpa QRIS.
- ID percobaan disimpan sebelum menghubungi Xendit. Retry/reload memakai ID yang sama sehingga tidak membuat sesi ganda. Hasil pembuatan yang belum pasti harus diperiksa di dashboard Mode Tes sebelum mencoba ulang.
- RLS hanya mengizinkan admin pemilik mengakses barisnya. Total tidak dapat diperbarui klien. Tidak memakai service-role key.
- Status diverifikasi langsung dari Xendit beserta pemilik, order, nominal dan channel. Belum ada webhook/sinkronisasi latar belakang.
- Keranjang tetap dipertahankan. Selesainya simulasi tidak membuat pesanan asli.
- Halaman diagnostik `/uji-pembayaran` di bawah tetap nominal Rp10.000, tanpa riwayat pesanan buku. Gunakan checkout untuk riwayat persisten.
- DANA diagnostik berhasil end-to-end melalui Microsoft Edge pada 2026-09-11; API mengonfirmasi COMPLETED untuk `ps-6aa3ca28d9fcab275ea93acc`.

Tes: `node --experimental-strip-types --test tests/simulation-order.test.mjs tests/xendit-test.test.mjs`; setelah build, `node --test tests/simulation-http.test.mjs` (provider/database fixture terisolasi).

## Cakupan halaman diagnostik tahap 1 (bukan checkout baru)

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
