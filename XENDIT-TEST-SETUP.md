# Xendit — checkout pelanggan Mode Tes

## Cakupan

Pelanggan yang login dapat memilih COD atau **VA / e-wallet — Mode Tes** di `/checkout`.
COD tetap pesanan asli. Pembayaran online memakai API Xendit sungguhan dengan key Mode Tes;
tidak menerima uang asli, mengirim barang, memotong stok, atau menambah pendapatan.
13 channel: DANA, OVO, ShopeePay, LinkAja, AstraPay, GoPay, serta VA BNI,
BRI, BCA, Mandiri, Permata, CIMB, dan BSI. QRIS tidak termasuk. Ketersediaan tergantung akun Xendit.
`/uji-pembayaran` tetap alat diagnostik khusus admin.

## Konfigurasi server

- Terapkan migrasi `20260911092022_simulation_orders.sql` dan `20260923111051_customer_sandbox_payments.sql`.
- `NEXT_PUBLIC_SUPABASE_URL` dan `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` untuk autentikasi.
- `SUPABASE_SERVICE_ROLE_KEY` hanya server, untuk menulis hasil pembayaran terverifikasi.
- `XENDIT_SECRET_KEY` hanya key `xnd_development_...`; key Live ditolak.
- `XENDIT_SANDBOX_ENABLED=true` diperlukan untuk membuka sandbox di Production.
- `XENDIT_WEBHOOK_TOKEN` adalah callback verification token dari dashboard Xendit Mode Tes.
- Daftarkan webhook Payment Session completed/expired Mode Tes ke
  `https://fritzoria-web.vercel.app/api/payments/webhook`.
- Deploy ulang setelah perubahan environment variables. Jangan menyimpan secret dalam Git atau laporan.

## Alur dan keamanan

1. Login pelanggan, tambah buku fisik, buka checkout dan pilih Mode Tes.
2. Pilih channel, konfirmasi bahwa tidak memakai uang asli, lalu buat pesanan.
3. Buka checkout sandbox Xendit dan gunakan simulator resmi, bukan transfer sungguhan.
4. Kembali ke `/pesanan-simulasi`. Status diperiksa otomatis selama halaman terbuka
   (maksimum 20 kali per pembukaan status ACTIVE), atau gunakan tombol pemeriksaan.
5. Webhook terautentikasi mengambil ulang sesi dari Xendit sebelum menyimpan status.
   Redirect saja tidak pernah dianggap bukti pembayaran. Tanpa webhook terkonfigurasi,
   pemeriksaan manual/polling tetap berfungsi tetapi sinkronisasi saat halaman ditutup tidak tersedia.

- RLS membatasi riwayat pada pemilik. Pelanggan tidak boleh menulis status, nominal, atau sesi langsung.
- Harga, stok, dan ongkir diperiksa ulang server. Tidak mengirim alamat/nomor HP pribadi ke Xendit.
- Percobaan menggunakan UUID yang dipertahankan saat reload/retry. Reservasi atomik mencegah
  permintaan bersamaan membuat dua sesi untuk UUID yang sama; maksimum 20 percobaan/jam/akun.
- Hasil pembuatan sesi yang tidak pasti tidak otomatis dicoba ulang; periksa dashboard Mode Tes.
- Reservasi 30 menit berada di tabel sandbox sendiri, bukan `books.stock`. Kapasitas bebas
  setelah terminal atau batas waktu lewat. Sesi selesai tidak pernah menjadi pesanan COD/asli.
- Notifikasi duplikat/out-of-order aman; status COMPLETED tidak dapat diturunkan.
- Riwayat menampilkan 50 percobaan terakhir. Keranjang dipertahankan. Pesanan kedaluwarsa/batal
  menyediakan tindakan membuat percobaan baru.

## Verifikasi

```sh
npm run build
node --experimental-strip-types --test tests/xendit-test.test.mjs tests/simulation-order.test.mjs tests/sandbox-db.test.mjs tests/simulation-http.test.mjs tests/checkout-db.test.mjs
```

Uji Edge dengan akun non-admin: satu DANA dan satu VA BCA sampai COMPLETED; cek persistensi
riwayat, webhook, akses lintas akun, console/network, serta jumlah pesanan asli dan fingerprint stok.
Tes fixture bukan bukti bahwa webhook dashboard sudah dikonfigurasi.

Referensi: https://docs.xendit.co/apidocs/create-session,
https://docs.xendit.co/apidocs/get-session, https://docs.xendit.co/docs/handling-webhooks
