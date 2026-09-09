-- Run after 202609090001_fritzoria_core.sql in Supabase SQL Editor.
begin;

-- Grants alone do not authorize customers: existing admin-only RLS applies.
grant insert, update, delete on public.books to authenticated;

create or replace function public.validate_book_write()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
     or length(new.slug) > 200
     or length(trim(new.title)) not between 1 and 500
     or length(trim(new.author)) not between 1 and 500
     or length(trim(new.category)) not between 1 and 500
     or length(trim(new.language)) not between 1 and 500
     or length(trim(new.summary)) not between 20 and 1500
     or new.source_url !~ '^https?://'
     or (new.cover_url !~ '^https?://' and new.cover_url !~ '^/[^/]')
     or (new.preorder and new.release_date is null) then
    raise exception 'Metadata buku tidak valid.' using errcode = '23514';
  end if;
  if TG_OP = 'UPDATE' and new.slug <> old.slug then
    raise exception 'URL buku tidak boleh berubah setelah dibuat.' using errcode = '23514';
  end if;
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists validate_book_write on public.books;
create trigger validate_book_write before insert or update on public.books
for each row execute function public.validate_book_write();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('book-covers', 'book-covers', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit,
allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Admins manage book covers" on storage.objects;
create policy "Admins manage book covers" on storage.objects
for all to authenticated
using (bucket_id = 'book-covers' and public.is_admin())
with check (bucket_id = 'book-covers' and public.is_admin());

commit;
