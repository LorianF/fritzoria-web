import type {Metadata} from 'next';
import {notFound} from 'next/navigation';
import Storefront from '@/components/store/storefront';
import {loadPublicBook} from '@/lib/supabase/public-book';

export const dynamic = 'force-dynamic';

type Props={params:Promise<{path:string[]}>};
const singles=['katalog','wishlist','penulis','keranjang','checkout','pesanan','akun','masuk','daftar','lupa-sandi','rak-digital','promo','bantuan','kontak','sumber','tentang','pengiriman','pembayaran','pengembalian','privasi','syarat','admin'];
const admin=['produk','kategori','pesanan','pelanggan','promo','ulasan','bantuan'];
const pageTitles:Record<string,string>={katalog:'Katalog',wishlist:'Wishlist',penulis:'Penulis',keranjang:'Keranjang',checkout:'Checkout',pesanan:'Pesanan',akun:'Akun',masuk:'Masuk',daftar:'Daftar','rak-digital':'Rak digital',promo:'Promo',bantuan:'Bantuan',kontak:'Kontak',sumber:'Sumber katalog',tentang:'Tentang Fritzoria',pengiriman:'Informasi pengiriman',pembayaran:'Informasi pembayaran',pengembalian:'Pengembalian pesanan',privasi:'Privasi',syarat:'Syarat penggunaan',admin:'Admin'};

function valid(path:string[]){if(path.length===1)return singles.includes(path[0]);if(path.length!==2)return false;if(['buku','penulis','pesanan','pembayaran','invoice','baca'].includes(path[0]))return true;if(path[0]==='akun')return ['alamat','pengaturan','notifikasi'].includes(path[1]);return path[0]==='admin'&&admin.includes(path[1]);}
function decodeSegment(value=''){try{return decodeURIComponent(value);}catch{return value;}}

export async function generateMetadata({params}:Props):Promise<Metadata>{
  const {path}=await params;
  const id=decodeSegment(path[1]);
  const book=path[0]==='buku'?await loadPublicBook(id):undefined;
  if(!valid(path)||(path[0]==='buku'&&!book))return {title:'Halaman tidak ditemukan | Fritzoria',robots:{index:false,follow:false}};
  const title=book?`${book.title} — ${book.author}`:path[0]==='penulis'&&id?`${id} — Penulis`:pageTitles[path[0]]||'Fritzoria';
  return {title:`${title} | Fritzoria`,description:book?.summary||'Jelajahi buku fisik dan e-book di Fritzoria.'};
}

export default async function Page({params}:Props){const {path}=await params;if(!valid(path))notFound();if(path[0]==='buku'&&!await loadPublicBook(decodeSegment(path[1])))notFound();return <Storefront path={path}/>;}
