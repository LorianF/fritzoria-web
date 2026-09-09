# Menyambungkan Fritzoria ke Supabase

## 1. Jalankan migration

1. Buka Supabase Dashboard.
2. Pilih project Fritzoria.
3. Buka **SQL Editor** lalu pilih **New query**.
4. Salin seluruh isi `supabase/migrations/202609090001_fritzoria_core.sql`.
5. Tekan **Run** satu kali.

Migration membuat tabel inti, trigger profil pengguna, indeks, grants, dan Row Level Security. Jangan menjalankannya berulang karena tipe enum dan tabel memang hanya dibuat sekali.

## 2. Isi katalog awal

Setelah migration berhasil, buka query baru di SQL Editor, salin seluruh isi `supabase/seed.sql`, lalu tekan **Run**. Seed berisi 60 buku dari katalog Fritzoria dan aman dijalankan ulang karena menggunakan `upsert` berdasarkan slug.

## 3. Atur URL autentikasi

Di **Authentication → URL Configuration**:

- Isi Site URL dengan alamat website produksi.
- Tambahkan `http://127.0.0.1:5173/**` pada Redirect URLs untuk development.
- Tambahkan alamat produksi dengan akhiran `/**` ketika website sudah dipublikasikan.

## 4. Uji akun

Jalankan website, buka `/daftar`, lalu buat akun dengan email yang dapat menerima pesan. Jika email confirmation aktif, buka tautan konfirmasi sebelum masuk.

Setelah migration aktif, setiap pengguna Auth otomatis mendapat baris di `public.profiles`. Password hanya dikelola oleh Supabase Auth dan tidak disimpan dalam tabel aplikasi.

## 5. Tetapkan akun admin

Daftar dan konfirmasikan akun yang akan digunakan sebagai pengelola. Setelah profilnya muncul di **Table Editor → profiles**, jalankan query berikut di SQL Editor dengan email akun tersebut:

```sql
update public.profiles
set role = 'admin', updated_at = now()
where email = 'email-admin-anda@example.com';
```

Keluar lalu masuk kembali di Fritzoria. Route `/admin` akan membaca role dari database. Akun biasa akan mendapat halaman akses dibatasi.

## 6. Aktifkan CRUD admin dan upload sampul

Di SQL Editor, jalankan seluruh isi `supabase/migrations/202609090002_admin_books.sql`.
Migrasi ini aman dijalankan ulang; tidak perlu mengulang migrasi inti atau seed.
Migrasi memberikan izin tulis buku yang tetap dibatasi RLS khusus admin, validasi metadata,
timestamp pembaruan otomatis, dan bucket publik `book-covers` (JPG/PNG/WebP maksimal 2 MB).
Hanya admin yang boleh menulis file. Sampul memang dapat dilihat publik.

Buka **Studio admin → Buku & stok** setelah login ulang, lalu lakukan uji:

1. Tambah buku uji dengan sampul, harga, stok, dan metadata. Pastikan muncul di Table Editor → books dan Storage → book-covers.
2. Refresh halaman dan buka toko di browser lain: buku tetap tersedia.
3. Ubah harga/stok, simpan, dan refresh. Nilai baru harus tetap tersimpan.
4. Arsipkan buku: buku tetap muncul untuk admin tetapi tidak terlihat oleh pengunjung. Aktifkan kembali.
5. Hapus hanya buku uji. Buku yang dirujuk pesanan ditolak oleh foreign key; gunakan arsip untuk buku tersebut.
6. Uji akun pelanggan: halaman admin ditolak dan operasi tulis buku/Storage ditolak oleh RLS.

Pencarian, filter kategori/status, pengurutan, serta pagination tersedia di daftar buku.
Nama kategori dapat diperbarui di menu Kategori dan disimpan sekaligus ke database.
Slug buku tidak berubah setelah dibuat untuk menjaga tautan dan referensi lama.
Katalog Supabase menjadi sumber data utama; perubahan katalog dari demo lokal tidak diimpor otomatis.

Upload naskah e-book privat belum termasuk tahap CRUD ini. Harga e-book dapat dikelola,
tetapi akses baca dan pengiriman naskah akan dikerjakan bersama backend pembelian digital.
File sampul lama tidak dihapus otomatis karena mungkin dipakai dalam snapshot pesanan.
Upload yang berhasil sebelum penyimpanan buku gagal mungkin meninggalkan file tanpa referensi;
periksa referensi sebelum membersihkannya melalui Storage.

## 7. Aktifkan dropdown dan pengelolaan kategori

Jalankan seluruh isi `supabase/migrations/202609090003_categories.sql` di SQL Editor,
setelah migrasi 001 dan 002. Tidak perlu mengulang seed.

Migrasi membuat tabel `categories`, mengisi dari kategori buku yang sudah ada,
dan menyatukan variasi huruf besar/kecil serta spasi di awal/akhir. Relasi kategori
diterapkan melalui foreign key pada nama, dengan pembaruan otomatis saat nama berubah.
Semua langkah dilakukan dalam satu transaksi. Nama kategori harus unik tanpa
membedakan huruf besar/kecil, dan hanya admin yang boleh mengelolanya.

Setelah berhasil, refresh website:

1. Studio Admin → Kategori: tambahkan kategori baru, lalu refresh untuk memastikan tersimpan.
2. Buku & stok → Tambah buku: kategori baru harus muncul di dropdown meskipun belum dipakai.
3. Simpan buku dengan kategori tersebut, kemudian ubah nama kategori melalui menu Kategori.
4. Refresh katalog dan editor buku: nama kategori harus ikut berubah.
5. Coba membuat nama kategori yang sama dengan kapitalisasi berbeda: harus ditolak.

Editor buku tidak menerima kategori bebas. Jika kategori diubah admin lain saat form
terbuka, gunakan Muat ulang kategori dan pilih kembali. Menu Kelola kategori membuka
tab baru sehingga isian buku tetap tersedia di tab semula.

## Keamanan

- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` boleh digunakan oleh browser karena akses data tetap dibatasi oleh RLS.
- Jangan pernah memasukkan secret key atau service-role key ke variabel `NEXT_PUBLIC_*`.
- Role admin hanya boleh diberikan secara manual dari SQL Editor atau proses server yang dipercaya.
