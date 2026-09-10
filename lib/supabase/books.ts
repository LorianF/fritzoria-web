import type { Book } from "@/lib/store/types";

export type DatabaseBook = {
  slug: string;
  title: string;
  author: string;
  category: string;
  language: string;
  isbn: string | null;
  publisher: string | null;
  pages: number | null;
  publication_year: string | null;
  cover_url: string;
  source_url: string;
  summary: string;
  physical_price: number;
  original_price: number;
  stock: number;
  ebook_price: number | null;
  reader_path: string | null;
  featured: boolean;
  hidden: boolean;
  preorder: boolean;
  release_date: string | null;
  created_at: string;
};

export function fromDatabaseBook(book: DatabaseBook): Book {
  return {
    slug: book.slug,
    title: book.title,
    author: book.author.trim().replace(/\s+/g, " "),
    category: book.category,
    language: book.language,
    isbn: book.isbn || undefined,
    publisher: book.publisher || undefined,
    pages: book.pages || undefined,
    year: book.publication_year || undefined,
    cover: book.cover_url,
    source: book.source_url,
    summary: book.summary,
    price: book.physical_price,
    originalPrice: book.original_price,
    stock: book.stock,
    ebookPrice: book.ebook_price ?? undefined,
    readable: !!book.reader_path,
    featured: book.featured,
    hidden: book.hidden,
    preorder: book.preorder,
    releaseDate: book.release_date || undefined,
    added: new Date(book.created_at).getTime(),
  };
}

export function validateBook(book: Book): void {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(book.slug) || book.slug.length > 200)
    throw Error("URL buku tidak valid. Gunakan judul dengan huruf atau angka.");
  if (
    [book.title, book.author, book.category, book.language].some(
      (v) => !v.trim() || v.length > 500,
    )
  )
    throw Error(
      "Lengkapi judul, penulis, kategori, dan bahasa (maksimal 500 karakter).",
    );
  if (book.summary.trim().length < 20 || book.summary.length > 1500)
    throw Error("Ringkasan harus berisi 20–1.500 karakter.");
  if (
    [
      book.price,
      book.originalPrice,
      book.stock,
      ...(book.ebookPrice === undefined ? [] : [book.ebookPrice]),
    ].some((v) => !Number.isInteger(v) || v < 0 || v > 2147483647)
  )
    throw Error(
      "Harga dan stok harus bilangan bulat antara 0 dan 2.147.483.647.",
    );
  if (book.originalPrice < book.price)
    throw Error("Harga sebelum diskon tidak boleh di bawah harga jual.");
  if (
    book.pages !== undefined &&
    (!Number.isInteger(book.pages) || book.pages < 1 || book.pages > 2147483647)
  )
    throw Error("Jumlah halaman harus bilangan bulat positif.");
  try {
    if (!["http:", "https:"].includes(new URL(book.source).protocol))
      throw Error();
  } catch {
    throw Error("Sumber harus berupa URL HTTP atau HTTPS yang valid.");
  }
  if (
    book.preorder &&
    (!book.releaseDate ||
      !/^\d{4}-\d{2}-\d{2}$/.test(book.releaseDate) ||
      Number.isNaN(Date.parse(book.releaseDate)) ||
      new Date(book.releaseDate).toISOString().slice(0, 10) !==
        book.releaseDate)
  )
    throw Error("Isi tanggal tersedia yang valid untuk buku preorder.");
}
