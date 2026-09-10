import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {cleanReaderText} from '../lib/store/reader-text.ts';
import {fromDatabaseBook} from '../lib/supabase/books.ts';
import {isPaid,totals} from '../lib/store/logic.ts';

test('COD is not counted paid while processing or shipping',()=>{
  for(const status of ['Menunggu pembayaran','Diproses','Dikirim','Dibatalkan','Dikembalikan']) assert.equal(isPaid({method:'COD',status}),false);
  for(const status of ['Selesai','Retur diajukan']) assert.equal(isPaid({method:'COD',status}),true);
});
test('reader removes isolated brackets without losing pages, chapters or bracketed prose',()=>{
  const pages=JSON.parse(fs.readFileSync(new URL('../public/reader/pride-and-prejudice.json',import.meta.url),'utf8'));
  const cleaned=pages.map(p=>({...p,text:cleanReaderText(p.text)}));
  assert.equal(cleaned.length,pages.length);
  assert.equal(new Set(cleaned.map(p=>p.chapter)).size,61);
  assert.ok(cleaned.every(p=>!p.text.split('\n\n').includes(']')));
  assert.equal(cleanReaderText('Before\n\n]\n\nAfter [word]'),'Before\n\nAfter [word]');
});
test('remote author whitespace is normalized for links and metadata',()=>{
  const book=fromDatabaseBook({author:'  Asato  Asato ',created_at:'2026-01-01'});
  assert.equal(book.author,'Asato Asato');
});
test('COD free shipping boundary, both couriers',()=>{
  for(const courier of ['Reguler','Ekspres']) {
    const book={slug:'x',price:250000};
    assert.equal(totals([{slug:'x',qty:1,format:'fisik'}],[book],undefined,courier).shipping,0);
    assert.equal(totals([{slug:'x',qty:1,format:'fisik'}],[{...book,price:249999}],undefined,courier).shipping,courier==='Ekspres'?30000:18000);
  }
});
