# Fritzoria di VS Code

## Persiapan

Pasang Node.js 24 dan VS Code. Ekstrak ZIP ini, lalu buka folder **Fritzoria** melalui File → Open Folder. Pastikan package.json terlihat langsung di folder yang dibuka.

Buka Terminal → New Terminal. Jalankan satu per satu:

```bash
node --version
npm ci
npm run dev
```

Buka http://localhost:5173 di browser. Jika port tersebut sudah dipakai, gunakan alamat yang ditampilkan terminal. Biarkan terminal berjalan; Ctrl+C untuk berhenti. Jangan membuka index.html atau menggunakan Live Server: project ini membutuhkan server React/Vinext.

Di Windows, apabila PowerShell menolak npm.ps1, pilih terminal Command Prompt di VS Code, atau gunakan npm.cmd ci dan npm.cmd run dev. Tidak perlu mengubah execution policy Windows.

## Pemeriksaan

```bash
npm run check:frontend
npm run test:store
npm run build
```

Pengujian tipe frontend dan delapan pengujian logika sudah lulus pada source asal di Linux. Instalasi baru dan eksekusi native Windows belum diuji di komputer Windows. Perintah salinan ini sudah disesuaikan agar tidak bergantung pada Bash. Jika runtime Cloudflare mengeluhkan platform Windows, gunakan WSL2 dengan Node.js terpasang di dalam WSL; jangan memakai node_modules Windows di WSL.

## Lokasi yang biasa diedit

- components/store/: beranda, katalog, detail buku, checkout, akun, reader, dan admin.
- app/globals.css: tema navy-putih dan tampilan responsif.
- lib/store/catalog.json: 60 judul buku dan sumber metadata.
- public/covers/: sampul buku.
- app/[...path]/page.tsx: routing halaman, termasuk /buku/:slug.

Simpan file untuk melihat perubahan melalui hot reload. Tidak perlu API key, akun Cloudflare, atau database untuk fitur demo lokal ini. Internet diperlukan saat npm ci mengunduh dependency.

## Batas dan perbedaan salinan

Ini source versi website Fritzoria yang sudah dibuat, bukan hanya hasil build. Dependency, aset, dan fitur dipertahankan. Hanya perintah npm untuk pengembangan lokal yang disesuaikan. Source aslinya memakai React + TypeScript, dengan Vinext/Vite dan runtime Cloudflare; bukan Next.js standar yang dijalankan memakai next dev.

node_modules, cache, hasil build, kredensial, dan riwayat Git tidak disertakan. npm ci memasang dependency berdasarkan package-lock.json. Jangan hapus file konfigurasi tersembunyi yang ikut dalam ZIP.

Perubahan salinan lokal tidak otomatis memperbarui website online. Data wishlist, akun, keranjang, dan pesanan dari website online juga tidak ikut berpindah karena disimpan per alamat browser. Pembayaran, stok, akun, serta admin tetap demonstrasi lokal, bukan layanan produksi. Naskah komersial berhak cipta tidak disertakan; reader lengkap menggunakan bacaan klasik domain publik.

README.md mempertahankan catatan project asal. Untuk menjalankan salinan ZIP ini, ikuti dokumen MULAI-DI-VSCODE.md ini.
