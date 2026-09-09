import assert from 'node:assert/strict';
import test from 'node:test';
import { fromDatabaseBook, validateBook } from '../lib/supabase/books.ts';

const row = {
  slug: 'buku-uji', title: 'Buku uji', author: 'Penulis', category: 'Fiksi', language: 'Indonesia',
  isbn: null, publisher: null, pages: null, publication_year: null,
  cover_url: '/covers/uji.jpg', source_url: 'https://example.com/book', summary: 'Ringkasan buku uji dengan panjang yang cukup.',
  physical_price: 10000, original_price: 12000, stock: 0, ebook_price: 0, reader_path: null,
  featured: false, hidden: true, preorder: false, release_date: null, created_at: '2026-09-09T00:00:00Z',
};
const book = fromDatabaseBook(row);
test('database mapping preserves zero ebook price, zero stock and archived status', () => {
  assert.equal(book.ebookPrice, 0);
  assert.equal(book.stock, 0);
  assert.equal(book.hidden, true);
  assert.equal(book.readable, false);
  assert.equal(fromDatabaseBook({ ...row, ebook_price: null }).ebookPrice, undefined);
  assert.doesNotThrow(() => validateBook(book));
});
test('rejects invalid numeric data and discount inversion before upload', () => {
  for (const change of [{ stock: -1 }, { stock: 1.5 }, { price: NaN }, { price: Infinity }, { originalPrice: 9999 }, { ebookPrice: -1 }, { pages: 0 }, { stock: 2147483648 }])
    assert.throws(() => validateBook({ ...book, ...change }));
});
test('requires complete metadata, safe slug and web source', () => {
  for (const change of [{ title: ' ' }, { category: '' }, { summary: 'short' }, { slug: '../book' }, { source: 'javascript:alert(1)' }])
    assert.throws(() => validateBook({ ...book, ...change }));
});
test('preorder accepts real dates and rejects missing or impossible dates', () => {
  assert.doesNotThrow(() => validateBook({ ...book, preorder: true, releaseDate: '2026-10-10' }));
  assert.throws(() => validateBook({ ...book, preorder: true }));
  assert.throws(() => validateBook({ ...book, preorder: true, releaseDate: '2026-02-30' }));
});
