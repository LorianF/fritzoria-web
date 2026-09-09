-- Run after migrations 001 and 002. Existing books remain linked by category name.
begin;
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (length(trim(name)) between 1 and 500 and name = trim(name)),
  created_at timestamptz not null default now()
);
create unique index if not exists categories_name_normalized_key on public.categories (lower(name));

-- Merge existing case/outer-whitespace variants into one canonical spelling.
insert into public.categories(name)
select min(trim(category)) from public.books group by lower(trim(category))
on conflict do nothing;
update public.books b set category = c.name from public.categories c
where lower(trim(b.category)) = lower(c.name) and b.category <> c.name;

alter table public.categories enable row level security;
drop policy if exists "Read categories" on public.categories;
create policy "Read categories" on public.categories for select to anon, authenticated using (true);
drop policy if exists "Admins manage categories" on public.categories;
create policy "Admins manage categories" on public.categories for all to authenticated
using (public.is_admin()) with check (public.is_admin());
revoke all on public.categories from anon, authenticated;
grant select on public.categories to anon;
grant select, insert, update, delete on public.categories to authenticated;

-- Renaming a category updates every linked book in the same transaction.
-- Referenced categories cannot be deleted, and arbitrary book categories are rejected.
alter table public.books drop constraint if exists books_category_fkey;
alter table public.books add constraint books_category_fkey foreign key (category)
references public.categories(name) on update cascade on delete restrict;
commit;
