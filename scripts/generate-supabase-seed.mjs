import {readFile,writeFile,mkdir} from 'node:fs/promises';

const catalog=JSON.parse(await readFile(new URL('../lib/store/catalog.json',import.meta.url),'utf8'));
const quote=value=>value==null?'null':`'${String(value).replaceAll("'","''")}'`;
const boolean=value=>value?'true':'false';
const rows=catalog.map(book=>`(
  ${quote(book.slug)}, ${quote(book.title)}, ${quote(book.author)}, ${quote(book.category)},
  ${quote(book.language)}, ${quote(book.isbn)}, ${quote(book.publisher)}, ${book.pages??'null'},
  ${quote(book.year)}, ${quote(book.cover)}, ${quote(book.source)}, ${quote(book.summary)},
  ${book.price}, ${book.originalPrice}, ${book.stock}, ${book.ebookPrice??'null'},
  ${boolean(book.featured)}, ${boolean(book.hidden)}, ${boolean(book.preorder)}, ${quote(book.releaseDate)}
)`).join(',\n');

const sql=`-- Generated from lib/store/catalog.json. Safe to run again.\ninsert into public.books (\n  slug, title, author, category, language, isbn, publisher, pages, publication_year,\n  cover_url, source_url, summary, physical_price, original_price, stock, ebook_price,\n  featured, hidden, preorder, release_date\n) values\n${rows}\non conflict (slug) do update set\n  title=excluded.title, author=excluded.author, category=excluded.category,\n  language=excluded.language, isbn=excluded.isbn, publisher=excluded.publisher,\n  pages=excluded.pages, publication_year=excluded.publication_year, cover_url=excluded.cover_url,\n  source_url=excluded.source_url, summary=excluded.summary, physical_price=excluded.physical_price,\n  original_price=excluded.original_price, stock=excluded.stock, ebook_price=excluded.ebook_price,\n  featured=excluded.featured, hidden=excluded.hidden, preorder=excluded.preorder,\n  release_date=excluded.release_date, updated_at=now();\n`;

await mkdir(new URL('../supabase/',import.meta.url),{recursive:true});
await writeFile(new URL('../supabase/seed.sql',import.meta.url),sql);
console.log(`Generated supabase/seed.sql with ${catalog.length} books.`);
