import type { Book } from "../store/types";
import { getSupabaseBrowserClient } from "./client";
import { fromDatabaseBook, validateBook, type DatabaseBook } from "./books";

export function bookError(error: unknown): string {
  const e = error as { code?: string; message?: string };
  if (e.code === "23505")
    return "URL buku sudah digunakan. Gunakan judul berbeda.";
  if (e.code === "23503")
    return "Buku terkait pesanan. Arsipkan buku agar riwayat tetap tersedia.";
  if (
    e.code === "42501" ||
    /row-level|permission denied/i.test(e.message || "")
  )
    return "Izin ditolak. Pastikan akun admin dan migrasi CRUD buku sudah dijalankan.";
  if (/bucket not found/i.test(e.message || ""))
    return "Penyimpanan sampul belum siap. Jalankan migrasi CRUD buku.";
  return (
    e.message || "Perubahan gagal disimpan. Periksa koneksi dan coba lagi."
  );
}

export async function saveBook(
  book: Book,
  existing: boolean,
  coverFile?: File,
) {
  validateBook(book);
  if (!coverFile && !/^(https?:\/\/|\/[^/])/.test(book.cover))
    throw Error("Unggah sampul buku yang valid.");
  const db = getSupabaseBrowserClient();
  const { data: category, error: categoryFailure } = await db.from('categories').select('id').eq('name', book.category).maybeSingle();
  if (categoryFailure) throw Error('Kategori tidak dapat diperiksa. Pastikan migrasi kategori sudah dijalankan.');
  if (!category) throw Error('Kategori sudah berubah atau tidak tersedia. Muat ulang pilihan kategori.');
  let cover = book.cover;
  if (coverFile) {
    if (
      !["image/jpeg", "image/png", "image/webp"].includes(coverFile.type) ||
      coverFile.size > 2 * 1024 * 1024
    )
      throw Error("Gunakan JPG, PNG, atau WebP maksimal 2 MB.");
    const extension = {
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
    }[coverFile.type];
    const path = `${book.slug}/${crypto.randomUUID()}.${extension}`;
    const { error } = await db.storage
      .from("book-covers")
      .upload(path, coverFile, { upsert: false, contentType: coverFile.type });
    if (error) throw error;
    cover = db.storage.from("book-covers").getPublicUrl(path).data.publicUrl;
  }
  // Never publish reader manuscripts in the publicly readable books table.
  const values = {
    slug: book.slug,
    title: book.title,
    author: book.author,
    category: book.category,
    language: book.language,
    isbn: book.isbn || null,
    publisher: book.publisher || null,
    pages: book.pages || null,
    publication_year: book.year || null,
    cover_url: cover,
    source_url: book.source,
    summary: book.summary,
    physical_price: book.price,
    original_price: book.originalPrice,
    stock: book.stock,
    ebook_price: book.ebookPrice ?? null,
    featured: !!book.featured,
    hidden: !!book.hidden,
    preorder: !!book.preorder,
    release_date: book.preorder ? book.releaseDate : null,
  };
  const query = existing
    ? db.from("books").update(values).eq("slug", book.slug)
    : db.from("books").insert(values);
  const { data, error } = await query.select("*").single();
  // Keep uploaded assets on ambiguous network failures: the write may have committed.
  if (error) throw error;
  return fromDatabaseBook(data as DatabaseBook);
}

export async function setBookHidden(slug: string, hidden: boolean) {
  const { data, error } = await getSupabaseBrowserClient()
    .from("books")
    .update({ hidden })
    .eq("slug", slug)
    .select("*")
    .single();
  if (error) throw error;
  return fromDatabaseBook(data as DatabaseBook);
}

export async function deleteBook(slug: string) {
  const { data, error } = await getSupabaseBrowserClient()
    .from("books")
    .delete()
    .eq("slug", slug)
    .select("slug")
    .single();
  if (error) throw error;
  return data.slug as string;
}
