import type {Book,Line,Voucher,Order} from './types';
export const money = (n:number) => new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(n);
export const slugify = (s:string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
export const unit = (b:Book,f:string) => f==='ebook' ? (b.ebookPrice ?? b.price) : b.price;
export const available = (b:Book,f:string) => f==='ebook' ? b.ebookPrice!==undefined : b.stock>0;
export function totals(lines:Line[],books:Book[],v:Voucher|undefined,courier:string) {
 const valid=lines.map(l=>({...l,book:books.find(b=>b.slug===l.slug&&!b.hidden)}));
 const subtotal=valid.reduce((s,l)=>s+(l.book?unit(l.book,l.format)*l.qty:0),0);
 const physical=lines.some(l=>l.format==='fisik');
 const discount=v?.active&&subtotal>=v.min?Math.min(v.max,Math.floor(subtotal*v.percent/100)):0;
 const shipping=physical?(subtotal-discount>=250000?0:courier==='Ekspres'?30000:18000):0;
 return {subtotal,discount,shipping,total:subtotal-discount+shipping,physical};
}
export function cartError(lines:Line[],books:Book[]) {
 if(!lines.length)return 'Keranjang masih kosong.';
 for(const l of lines){const b=books.find(b=>b.slug===l.slug&&!b.hidden);if(!b)return 'Ada buku yang sudah tidak tersedia. Hapus dari keranjang.';if(!Number.isInteger(l.qty)||l.qty<1)return 'Jumlah buku tidak valid.';if(!available(b,l.format)|| (l.format==='fisik'&&l.qty>b.stock))return `Stok ${b.title} tidak mencukupi.`;if(l.format==='ebook'&&l.qty!==1)return 'E-book hanya dapat dibeli satu salinan.';}
 return '';
}
export const isPaid = (o:Order) => ['Diproses','Dikirim','Selesai','Retur diajukan'].includes(o.status);
export function ratingFor(slug:string,reviews:{slug:string;rating:number;hidden?:boolean}[]){const rs=reviews.filter(r=>r.slug===slug&&!r.hidden);return {count:rs.length,rating:rs.length?rs.reduce((n,r)=>n+r.rating,0)/rs.length:0};}

// Browser-local identifiers; does not require a secure context.
export function uid(){return globalThis.crypto.randomUUID();}
export function validISBN(value:string){if(/^\d{13}$/.test(value))return [...value].reduce((sum,c,i)=>sum+Number(c)*(i%2?3:1),0)%10===0;if(/^\d{9}[\dXx]$/.test(value))return [...value.toUpperCase()].reduce((sum,c,i)=>sum+(c==='X'?10:Number(c))*(10-i),0)%11===0;return false;}
