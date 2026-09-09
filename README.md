# Fritzoria

Frontend toko buku navy dan putih, dibuat dengan React, TypeScript, Vinext, serta komponen Shadcn/Radix.

## Menjalankan dan memeriksa

Gunakan alur Sites yang sudah dikonfigurasi dalam `.openai/hosting.json`. `npm run check:frontend` memeriksa tipe frontend. `npm run test:store` menjalankan pengujian perhitungan harga, stok, metadata katalog, dan reader. `npm run build` menghasilkan Worker melalui skrip build terverifikasi.

## Halaman

Beranda, katalog dengan filter dan pagination, detail `/buku/:slug`, penulis, wishlist, keranjang, checkout, pembayaran, pesanan, invoice, akun/alamat/pengaturan, rak digital, reader, promo, layanan pembaca, dan studio admin. Setiap kartu buku membuka URL detail tersendiri.

## Data

`lib/store/catalog.json` memuat 60 judul buku nyata dengan tautan sumber dan sampul lokal. Metadata yang tidak terverifikasi dibiarkan kosong atau ditandai. Harga, stok, rating dari pengujian, pelanggan, serta transaksi merupakan data demonstrasi. Sumber katalog juga tersedia di `/sumber`. E-book komersial hanya memiliki akses simulasi; tidak ada naskah berhak cipta disertakan. Reader menyediakan Pride and Prejudice lengkap dari Project Gutenberg (61 bab, 321 bagian baca), dengan lisensi asli pada berkas teks. Admin dapat menambahkan naskah .txt milik sendiri atau domain publik.

## Supabase

Supabase Auth sudah terhubung untuk daftar, masuk, keluar, session lintas perangkat, dan email pemulihan sandi. Katalog membaca 60 buku dari Supabase dengan fallback JSON. Profil, alamat, dan wishlist pengguna tersinkron ke database, sedangkan `/admin` memeriksa role dari tabel `profiles`. Schema PostgreSQL dan RLS tersedia di `supabase/migrations/202609090001_fritzoria_core.sql`. Ikuti `SUPABASE-SETUP.md` untuk konfigurasi akun admin.

## Batas frontend

CRUD buku, pengarsipan, penghapusan, dan perubahan kategori admin kini terhubung ke Supabase. Jalankan `supabase/migrations/202609090002_admin_books.sql` untuk izin tulis dan bucket sampul. Upload sampul mendukung JPG/PNG/WebP maksimal 2 MB. Katalog remote menjadi sumber utama dan tidak ditimpa perubahan demo lokal.

Keranjang, pesanan, voucher, ulasan, progres baca, dan operasi admin selain katalog masih bersifat lokal. Checkout simulasi belum mengurangi stok Supabase. Upload naskah e-book privat belum tersedia pada editor baru. Belum ada payment gateway atau pengiriman nyata. Gunakan data contoh sampai seluruh alur bisnis dipindahkan ke tabel Supabase.

## Perilaku transaksi

Harga dan alamat disalin ke snapshot pesanan. Stok fisik dicadangkan saat pesanan dibuat, dipulihkan pada pembatalan atau retur yang disetujui. Voucher menerapkan minimum pembelian serta maksimum potongan. Ongkir dihitung setelah diskon: reguler Rp18.000, ekspres Rp30.000, gratis mulai Rp250.000. E-book tidak dikenai ongkir. Pembayaran gagal dapat dicoba ulang. Retur berlaku untuk seluruh nilai pesanan, termasuk pencabutan akses e-book dari pesanan tersebut.

## Pemeriksaan versi ini

- Pemeriksaan TypeScript frontend lulus.
- Delapan pengujian logika lulus: ongkir, voucher, stok, format digital, metadata/sampul/ISBN, rating, dan kelengkapan reader.
- Browser: halaman buku terpisah, wishlist/keranjang, alamat demo, diskon, ongkir reguler/ekspres, pembayaran gagal/ulang/berhasil, invoice, pengiriman admin, konfirmasi diterima, ulasan, pembelian e-book, rak digital, progres/bookmark setelah refresh, pencarian reader, dan menu mobile diperiksa.
- Alur persetujuan retur belum selesai diuji melalui browser karena pemeriksaan otomatis menolak tindakan setelah batas penggunaan tercapai.
- Preview HTTP memiliki keterbatasan Web Crypto pada navigasi RSC Vinext dan menggunakan fallback navigasi dokumen; produksi menggunakan HTTPS. Tidak ada perubahan pada dependensi Vinext untuk menghindari masalah preview ini.
