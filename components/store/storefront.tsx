'use client';
import {Suspense,useEffect} from 'react';
import {Shell,Blank} from './shared';
import {Home,Catalog,Product,Authors} from './catalog';
import {Account,Auth,UpdatePassword} from './account';
import {Cart,Checkout,Orders,OrderDetail} from './commerce';
import {DigitalShelf,Reader} from './reader';
import {Info,Help,Contact,Promos,Sources} from './info';
import {Admin} from './admin';
import {useStore} from './provider';

function decodePathSegment(value:string){try{return decodeURIComponent(value);}catch{return value;}}

function Routed({path}:{path:string[]}){
  const {books}=useStore();
  const [root='',rawId='']=path;
  const id=decodePathSegment(rawId);
  useEffect(()=>{
    const book=root==='buku'?books.find(b=>b.slug===id):undefined;
    const title=book?`${book.title} — ${book.author}`:root==='penulis'&&id?`${id} — Penulis`:root?root.replaceAll('-',' ').replace(/^./,c=>c.toUpperCase()):'Toko Buku Fisik & Digital';
    document.title=`${title||'Halaman tidak ditemukan'} | Fritzoria`;
  },[root,id,books]);
  if(root==='admin')return <Admin section={id}/>;
  let page;
  if(!root)page=<Home/>;
  else if(root==='katalog')page=<Catalog/>;
  else if(root==='buku'&&id&&path.length===2)page=<Product key={id} slug={id}/>;
  else if(root==='wishlist')page=<Catalog wish/>;
  else if(root==='penulis')page=id?<Catalog author={id}/>:<Authors/>;
  else if(root==='keranjang')page=<Cart/>;
  else if(root==='checkout')page=<Checkout/>;
  else if(root==='pesanan')page=id?<OrderDetail id={id}/>:<Orders/>;
  else if(root==='pembayaran'&&id)page=<OrderDetail id={id} payment/>;
  else if(root==='invoice'&&id)page=<OrderDetail id={id} invoice/>;
  else if(root==='akun')page=<Account section={id||'ringkasan'}/>;
  else if(['masuk','daftar','lupa-sandi'].includes(root))page=<Auth key={root} mode={root}/>;
  else if(root==='atur-ulang-sandi')page=<UpdatePassword/>;
  else if(root==='rak-digital')page=<DigitalShelf/>;
  else if(root==='baca'&&id)page=<Reader key={id} slug={id}/>;
  else if(root==='promo')page=<Promos/>;
  else if(root==='bantuan')page=<Help/>;
  else if(root==='kontak')page=<Contact/>;
  else if(root==='sumber')page=<Sources/>;
  else if(['tentang','pengiriman','pembayaran','pengembalian','privasi','syarat'].includes(root))page=<Info page={root}/>;
  else page=<div className="wrap"><Blank title="Halaman tidak ditemukan" text="Alamat ini belum tersedia. Kembali ke rak buku Fritzoria."/></div>;
  return <Shell>{page}</Shell>;
}

export default function Storefront({path}:{path:string[]}){return <Suspense fallback={<div className="loading-state" role="status">Memuat Fritzoria…</div>}><Routed path={path}/></Suspense>}
