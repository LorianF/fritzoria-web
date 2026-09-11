begin;
-- Isolated sandbox receipts: no relationship to orders, order_items, or stock triggers.
create table public.simulation_orders (
  id uuid primary key,
  user_id uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  channel text not null,
  courier text not null check (courier in ('Reguler','Ekspres')),
  items jsonb not null check (jsonb_typeof(items)='array' and jsonb_array_length(items) between 1 and 50),
  subtotal integer not null check (subtotal>0),
  shipping integer not null check (shipping>=0),
  total integer not null check (total=subtotal+shipping and total<=10000000),
  session_id text unique check (session_id ~ '^ps-[A-Za-z0-9-]{20,64}$'),
  setup_error text not null default ''
);
create index simulation_orders_owner_created on public.simulation_orders(user_id,created_at desc);
alter table public.simulation_orders enable row level security;
revoke all on public.simulation_orders from public, anon, authenticated;
grant select, insert on public.simulation_orders to authenticated;
grant update(session_id,setup_error) on public.simulation_orders to authenticated;
create policy simulation_orders_read on public.simulation_orders for select to authenticated
  using (user_id=(select auth.uid()) and (select public.is_admin()));
create policy simulation_orders_insert on public.simulation_orders for insert to authenticated
  with check (user_id=(select auth.uid()) and (select public.is_admin()));
create policy simulation_orders_update on public.simulation_orders for update to authenticated
  using (user_id=(select auth.uid()) and (select public.is_admin()))
  with check (user_id=(select auth.uid()) and (select public.is_admin()));
comment on table public.simulation_orders is 'SANDBOX ONLY. Never include in revenue, fulfillment, stock, or customer order queries. Status is verified from Xendit, not accepted from clients.';
commit;
