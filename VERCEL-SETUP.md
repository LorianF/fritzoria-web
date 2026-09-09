# Deploy Fritzoria ke Vercel

Proyek menggunakan Next.js standar: `npm run build` menghasilkan `.next`.
Konfigurasi Cloudflare/Vinext lama masih disimpan, tetapi tidak digunakan oleh build Vercel.

1. Import repository GitHub `LorianF/fritzoria-bookstore` ke Vercel.
2. Pilih framework Next.js dan root directory `./`.
3. Gunakan build command `npm run build`, output `.next` (atau default Next.js), dan Node.js 22.x.
4. Tambahkan `NEXT_PUBLIC_SUPABASE_URL` dan `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` dari environment lokal ke environment Production dan Preview yang digunakan.
5. Deploy commit terbaru. Jika sebelumnya ada override build `vinext build` atau output `dist` di dashboard, hapus override tersebut.
6. Di Supabase Authentication → URL Configuration, atur Site URL ke domain deployment dan tambahkan URL redirect untuk domain tersebut. Pertahankan URL localhost untuk development.

Jangan upload `.env.local` atau `recovery-codes.txt`. Perubahan environment memerlukan deployment baru.
Development lokal tetap di port 5173 melalui `npm run dev`; produksi lokal dapat diuji dengan `npm start`.
