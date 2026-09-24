import Link from "next/link";
import { ArrowLeft, BookOpen, Headphones, Search } from "lucide-react";

export const metadata = { title: "Halaman tidak ditemukan | Fritzoria" };

export default function NotFound() {
  return (
    <main className="not-found-page">
      <Link href="/" className="brand not-found-brand">
        <span className="brand-mark">f.</span>
        <span>Fritzoria<span className="brand-caption">BOOKSTORE</span></span>
      </Link>
      <section>
        <div className="not-found-number">404</div>
        <div className="not-found-copy">
          <p className="eyebrow">HALAMAN TIDAK DITEMUKAN</p>
          <h1>Sepertinya halaman ini terselip di antara rak.</h1>
          <p>Alamat yang Anda buka tidak tersedia atau telah dipindahkan. Mulai lagi dari katalog, cari judul, atau hubungi CS bila Anda mengikuti tautan pesanan.</p>
          <div className="button-row">
            <Link href="/katalog" className="not-found-primary"><BookOpen size={17}/> Jelajahi katalog</Link>
            <Link href="/" className="not-found-secondary"><ArrowLeft size={17}/> Kembali ke beranda</Link>
          </div>
        </div>
      </section>
      <nav aria-label="Pilihan bantuan">
        <Link href="/katalog"><Search size={17}/><span><strong>Cari buku</strong><small>Telusuri seluruh koleksi</small></span></Link>
        <Link href="/kontak"><Headphones size={17}/><span><strong>Chat CS</strong><small>Tanyakan tautan atau pesanan</small></span></Link>
      </nav>
    </main>
  );
}
