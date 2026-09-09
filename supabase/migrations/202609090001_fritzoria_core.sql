-- Fritzoria core schema for Supabase PostgreSQL.
-- Run this migration once from the Supabase SQL Editor.

create extension if not exists pgcrypto;

create type public.app_role as enum ('customer', 'admin');
create type public.book_format as enum ('fisik', 'ebook');
create type public.order_status as enum (
  'Menunggu pembayaran',
  'Menunggu verifikasi',
  'Pembayaran gagal',
  'Diproses',
  'Dikirim',
  'Selesai',
  'Dibatalkan',
  'Retur diajukan',
  'Dikembalikan'
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  name text not null default '',
  phone text not null default '',
  role public.app_role not null default 'customer',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.books (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  author text not null,
  category text not null,
  language text not null,
  isbn text,
  publisher text,
  pages integer check (pages is null or pages > 0),
  publication_year text,
  cover_url text not null,
  source_url text not null,
  summary text not null,
  physical_price integer not null check (physical_price >= 0),
  original_price integer not null check (original_price >= physical_price),
  stock integer not null default 0 check (stock >= 0),
  ebook_price integer check (ebook_price is null or ebook_price >= 0),
  reader_path text,
  featured boolean not null default false,
  hidden boolean not null default false,
  preorder boolean not null default false,
  release_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  label text not null,
  recipient_name text not null,
  phone text not null,
  city text not null,
  province text not null,
  postal_code text not null,
  street text not null,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.wishlists (
  user_id uuid not null references public.profiles(id) on delete cascade,
  book_id uuid not null references public.books(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, book_id)
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique default ('FR-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12))),
  user_id uuid not null references public.profiles(id),
  address_snapshot jsonb,
  subtotal integer not null check (subtotal >= 0),
  discount integer not null default 0 check (discount >= 0),
  shipping integer not null default 0 check (shipping >= 0),
  total integer not null check (total >= 0),
  voucher_code text,
  courier text not null,
  payment_method text not null,
  payment_proof_path text,
  status public.order_status not null default 'Menunggu pembayaran',
  customer_note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  book_id uuid references public.books(id),
  slug text not null,
  title text not null,
  author text not null,
  cover_url text not null,
  format public.book_format not null,
  quantity integer not null check (quantity > 0),
  unit_price integer not null check (unit_price >= 0)
);

create table public.order_status_history (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders(id) on delete cascade,
  status public.order_status not null,
  changed_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  book_id uuid not null references public.books(id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  body text not null check (char_length(body) between 3 and 1500),
  hidden boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, book_id)
);

create table public.reading_progress (
  user_id uuid not null references public.profiles(id) on delete cascade,
  book_id uuid not null references public.books(id) on delete cascade,
  page integer not null default 0 check (page >= 0),
  bookmarks integer[] not null default '{}',
  updated_at timestamptz not null default now(),
  primary key (user_id, book_id)
);

create index addresses_user_id_idx on public.addresses(user_id);
create index orders_user_id_created_at_idx on public.orders(user_id, created_at desc);
create index order_items_order_id_idx on public.order_items(order_id);
create index reviews_book_id_idx on public.reviews(book_id);
create unique index one_primary_address_per_user
  on public.addresses(user_id) where is_primary;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, name)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'name', '')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.books enable row level security;
alter table public.addresses enable row level security;
alter table public.wishlists enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_status_history enable row level security;
alter table public.reviews enable row level security;
alter table public.reading_progress enable row level security;

create policy "Public can read active books" on public.books
  for select to anon, authenticated using (not hidden or public.is_admin());
create policy "Admins manage books" on public.books
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "Users read own profile" on public.profiles
  for select to authenticated using (id = auth.uid() or public.is_admin());
create policy "Users update own profile" on public.profiles
  for update to authenticated using (id = auth.uid())
  with check (id = auth.uid());
create policy "Admins manage profiles" on public.profiles
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "Users manage own addresses" on public.addresses
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Admins read addresses" on public.addresses
  for select to authenticated using (public.is_admin());

create policy "Users manage own wishlist" on public.wishlists
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "Users read own orders" on public.orders
  for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy "Admins update orders" on public.orders
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "Users read own order items" on public.order_items
  for select to authenticated using (
    exists (select 1 from public.orders o where o.id = order_id and (o.user_id = auth.uid() or public.is_admin()))
  );
create policy "Admins manage order items" on public.order_items
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "Users read own order history" on public.order_status_history
  for select to authenticated using (
    exists (select 1 from public.orders o where o.id = order_id and (o.user_id = auth.uid() or public.is_admin()))
  );
create policy "Admins manage order history" on public.order_status_history
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "Public reads visible reviews" on public.reviews
  for select to anon, authenticated using (not hidden or public.is_admin());
create policy "Users create own reviews" on public.reviews
  for insert to authenticated with check (user_id = auth.uid());
create policy "Users update own reviews" on public.reviews
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Admins moderate reviews" on public.reviews
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "Users manage reading progress" on public.reading_progress
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

revoke all on all tables in schema public from anon, authenticated;
grant select on public.books, public.reviews to anon;
grant select on public.books, public.reviews to authenticated;
grant select on public.profiles to authenticated;
grant update(name, phone, updated_at) on public.profiles to authenticated;
grant select, insert, update, delete on public.addresses, public.wishlists, public.reading_progress to authenticated;
grant select on public.orders to authenticated;
grant select on public.order_items, public.order_status_history to authenticated;
grant usage, select on all sequences in schema public to authenticated;
grant execute on function public.is_admin() to anon, authenticated;
