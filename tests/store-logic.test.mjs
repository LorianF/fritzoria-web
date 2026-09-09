import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import {totals,cartError,validISBN,ratingFor} from '../lib/store/logic.ts';
const catalog=JSON.parse(fs.readFileSync(new URL('../lib/store/catalog.json',import.meta.url),'utf8'));
const book=catalog.find(b=>b.slug==='laut-bercerita');
const voucher={code:'BACA10',percent:10,max:30000,min:150000,active:true};
test('physical checkout preserves verified 2-book pricing and voucher rounding',()=>{
 assert.deepEqual(totals([{slug:book.slug,format:'fisik',qty:2}],catalog,voucher,'Reguler'),{subtotal:184000,discount:18400,shipping:18000,total:183600,physical:true});
 assert.equal(totals([{slug:book.slug,format:'fisik',qty:2}],catalog,voucher,'Ekspres').total,195600);
});
test('ebook shipping is zero and voucher minimum is respected',()=>{
 assert.deepEqual(totals([{slug:book.slug,format:'ebook',qty:1}],catalog,voucher,'Ekspres'),{subtotal:64000,discount:0,shipping:0,total:64000,physical:false});
});
test('free shipping is evaluated after discount; voucher cap enforced',()=>{
 assert.equal(totals([{slug:book.slug,format:'fisik',qty:3}],catalog,voucher,'Reguler').shipping,18000);
 const large=totals([{slug:book.slug,format:'fisik',qty:5}],catalog,voucher,'Reguler');
 assert.equal(large.discount,30000);assert.equal(large.shipping,0);assert.equal(large.total,430000);
});
test('mixed formats charge physical delivery once; inactive voucher ignored',()=>{
 const t=totals([{slug:book.slug,format:'fisik',qty:1},{slug:book.slug,format:'ebook',qty:1}],catalog,{...voucher,active:false},'Reguler');
 assert.equal(t.total,174000);assert.equal(t.shipping,18000);assert.equal(t.discount,0);
});
test('overselling, archived books, unavailable digital editions and invalid quantities are blocked',()=>{
 for(const line of [{slug:book.slug,format:'fisik',qty:book.stock+1},{slug:book.slug,format:'fisik',qty:0},{slug:book.slug,format:'fisik',qty:1.5},{slug:book.slug,format:'ebook',qty:2},{slug:'missing',format:'fisik',qty:1}]) assert.notEqual(cartError([line],catalog),'');
 assert.notEqual(cartError([{slug:book.slug,format:'fisik',qty:1}],[{...book,hidden:true}]),'');
 assert.notEqual(cartError([{slug:book.slug,format:'ebook',qty:1}],[{...book,ebookPrice:undefined}]),'');
 assert.equal(cartError([{slug:book.slug,format:'fisik',qty:book.stock}],catalog),'');
});
test('catalog identity, image assets, ISBN checksums and real sources are consistent',()=>{
 assert.equal(catalog.length,60);assert.equal(new Set(catalog.map(b=>b.slug)).size,60);
 for(const b of catalog){assert.ok(b.title&&b.author&&b.summary);assert.match(b.source,/^https:\/\//);assert.ok(fs.existsSync(new URL('../public'+b.cover,import.meta.url)));if(b.isbn)assert.ok(validISBN(b.isbn),b.title+' ISBN');assert.ok(b.price>=0&&b.originalPrice>=b.price&&Number.isInteger(b.stock));}
});
test('ratings never count moderated reviews or fabricate empty ratings',()=>{
 assert.deepEqual(ratingFor('x',[]),{count:0,rating:0});assert.deepEqual(ratingFor('x',[{slug:'x',rating:5},{slug:'x',rating:1,hidden:true}]),{count:1,rating:5});
});
test('reader contains all 61 chapters and full text license',()=>{
 const pages=JSON.parse(fs.readFileSync(new URL('../public/reader/pride-and-prejudice.json',import.meta.url),'utf8'));
 assert.equal(new Set(pages.map(p=>p.chapter)).size,61);assert.ok(pages.length>300);
 assert.match(fs.readFileSync(new URL('../public/reader/pride-and-prejudice.txt',import.meta.url),'utf8'),/PROJECT GUTENBERG/);
});
