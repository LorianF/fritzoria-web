import type {Metadata} from 'next';
import {notFound} from 'next/navigation';
import Storefront from '@/components/store/storefront';
import catalog from '@/lib/store/catalog.json';
type Props={params:Promise<{path:string[]}>};
const singles=['katalog','wishlist','penulis','keranjang','checkout','pesanan','akun','masuk','daftar','lupa-sandi','rak-digital','promo','bantuan','kontak','sumber','tentang','pengiriman','pembayaran','pengembalian','privasi','syarat','admin'];
const admin=['produk','kategori','pesanan','pelanggan','promo','ulasan','bantuan'];
function valid(path:string[]){if(path.length===1)return singles.includes(path[0]);if(path.length!==2)return false;if(['buku','penulis','pesanan','pembayaran','invoice','baca'].includes(path[0]))return true;if(path[0]==='akun')return ['alamat','pengaturan','notifikasi'].includes(path[1]);return path[0]==='admin'&&admin.includes(path[1]);}
export async function generateMetadata({params}:Props):Promise<Metadata>{const {path}=await params;const book=path[0]==='buku'?catalog.find(b=>b.slug===path[1]):undefined;return {title:book?`${book.title} — ${book.author} | Fritzoria`:`${path[0].replaceAll('-',' ')} | Fritzoria`,description:book?.summary||'Jelajahi buku fisik dan e-book di Fritzoria.'};}
export default async function Page({params}:Props){const {path}=await params;if(!valid(path))notFound();return <Storefront path={path}/>;}
