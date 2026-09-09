"use client";
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { Button, Input } from './shared';
import { useStore } from './provider';

export type Category = { id: string; name: string };
export function categoryError(error: unknown) {
  const e = error as { code?: string; message?: string };
  if (e.code === '23505') return 'Kategori sudah ada. Perbedaan huruf besar/kecil tidak membuat kategori baru.';
  if (e.code === '42501') return 'Hanya admin yang boleh mengelola kategori.';
  if (e.code === '42P01' || e.code === 'PGRST205') return 'Kategori belum siap. Jalankan migrasi kategori di Supabase.';
  return e.message || 'Kategori tidak dapat dimuat. Coba lagi.';
}

export function useCategories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    try {
      const { data, error } = await getSupabaseBrowserClient().from('categories').select('id,name').order('name');
      if (error) throw error;
      setCategories(data as Category[]);
      setError('');
    } catch (e) { setError(categoryError(e)); }
    finally { setLoading(false); }
  }, []);
  const reload = useCallback(async () => {
    setLoading(true);
    await load();
  }, [load]);
  // Initial fetch synchronizes with Supabase; loading starts true and result updates follow the request.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);
  return { categories, loading, error, reload };
}

export function CategoriesPanel() {
  const { categories, loading, error, reload } = useCategories();
  const { refreshBooks } = useStore();
  const [busy, setBusy] = useState(false);
  const save = async (name: string, id?: string) => {
    if (busy) return false;
    setBusy(true);
    try {
      const db = getSupabaseBrowserClient();
      const query = id ? db.from('categories').update({ name: name.trim() }).eq('id', id) : db.from('categories').insert({ name: name.trim() });
      const { error } = await query.select('id').single();
      if (error) throw error;
      toast.success(id ? 'Kategori dan buku terkait diperbarui.' : 'Kategori ditambahkan.');
      await Promise.all([reload(), refreshBooks()]);
      return true;
    } catch (e) { toast.error(categoryError(e)); return false; }
    finally { setBusy(false); }
  };
  return <div className="panel">
    <h2>Kategori katalog</h2>
    <p className="muted">Tambahkan kategori untuk pilihan di form buku. Mengganti nama akan memperbarui semua buku terkait.</p>
    {error && <p className="notice" role="alert">{error}</p>}
    {loading && <p role="status">Memuat kategori…</p>}
    <Button variant="outline" disabled={busy || loading} onClick={() => void reload()}>Muat ulang kategori</Button>
    <form className="category-edit" onSubmit={async e => {
      e.preventDefault();
      const form = e.currentTarget;
      if (await save(String(new FormData(form).get('name') || ''))) form.reset();
    }}>
      <Input name="name" placeholder="Nama kategori baru" aria-label="Nama kategori baru" required maxLength={500} disabled={busy || loading || !!error} />
      <Button type="submit" disabled={busy || loading || !!error}>Tambah kategori</Button>
    </form>
    {!loading && !error && !categories.length && <p>Belum ada kategori. Tambahkan kategori pertama untuk mulai mengisi buku.</p>}
    {categories.map(c => <form key={`${c.id}-${c.name}`} className="category-edit" onSubmit={e => {
      e.preventDefault();
      void save(String(new FormData(e.currentTarget).get('name') || ''), c.id);
    }}>
      <Input name="name" defaultValue={c.name} aria-label={`Nama kategori ${c.name}`} required maxLength={500} disabled={busy || loading || !!error} />
      <Button type="submit" variant="outline" disabled={busy || loading || !!error}>Simpan nama</Button>
    </form>)}
  </div>;
}
