import { cache } from "react";
import { createClient } from "@supabase/supabase-js";
import catalog from "@/lib/store/catalog.json";
import { fromDatabaseBook, type DatabaseBook } from "./books";

// No service-role key: public product routes must never disclose hidden books.
export const loadPublicBook = cache(async (slug: string) => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return catalog.find(book => book.slug === slug);
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await db.from("books").select("*").eq("slug", slug).eq("hidden", false).abortSignal(AbortSignal.timeout(10000)).maybeSingle();
  // A backend outage must not be cached or misrepresented as a missing product.
  if (error) throw new Error("Katalog tidak dapat dimuat. Silakan coba lagi.");
  return data ? fromDatabaseBook(data as DatabaseBook) : undefined;
});
