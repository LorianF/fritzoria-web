begin;
revoke insert, update on public.simulation_orders from authenticated;
revoke update(session_id, setup_error) on public.simulation_orders from authenticated;
drop policy simulation_orders_read on public.simulation_orders;
drop policy simulation_orders_insert on public.simulation_orders;
drop policy simulation_orders_update on public.simulation_orders;
create policy simulation_orders_read on public.simulation_orders for select to authenticated
  using (user_id = (select auth.uid()));
grant all on public.simulation_orders to service_role;
alter table public.simulation_orders
  add column status text not null default 'PENDING' check (status in ('PENDING','ACTIVE','COMPLETED','EXPIRED','CANCELED')),
  add column payment_url text,
  add column expires_at timestamptz,
  add column verified_at timestamptz,
  add column inventory_reserved boolean not null default false;
-- Isolated stock holds: never update books.stock or real orders.
create table public.sandbox_stock_holds (
  order_id uuid not null references public.simulation_orders(id),
  slug text not null references public.books(slug),
  quantity integer not null check (quantity between 1 and 99),
  primary key(order_id, slug)
);
create index sandbox_stock_holds_slug on public.sandbox_stock_holds(slug);
alter table public.sandbox_stock_holds enable row level security;
revoke all on public.sandbox_stock_holds from public, anon, authenticated;
grant all on public.sandbox_stock_holds to service_role;
create table public.sandbox_payment_events (
  session_id text not null,
  status text not null check (status in ('ACTIVE','COMPLETED','EXPIRED','CANCELED')),
  received_at timestamptz not null default now(),
  primary key(session_id, status)
);
alter table public.sandbox_payment_events enable row level security;
revoke all on public.sandbox_payment_events from public, anon, authenticated;
grant all on public.sandbox_payment_events to service_role;

create function public.reserve_sandbox_order(p_id uuid, p_user uuid, p_channel text,
  p_courier text, p_items jsonb, p_subtotal integer, p_shipping integer, p_total integer)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare item jsonb; b public.books; held integer; existing public.simulation_orders;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user::text, 0));
  select * into existing from public.simulation_orders where id=p_id;
  if found then
    if existing.user_id <> p_user then raise exception 'Percobaan tidak tersedia'; end if;
    return jsonb_build_object('created', false, 'order', to_jsonb(existing));
  end if;
  if (select count(*) from public.simulation_orders where user_id=p_user and created_at>now()-interval '1 hour') >= 20 then
    raise exception 'Batas 20 percobaan per jam tercapai';
  end if;
  if jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items) not between 1 and 50
    or p_courier not in ('Reguler','Ekspres') then raise exception 'Keranjang tidak valid'; end if;
  if (select count(distinct x->>'slug') from jsonb_array_elements(p_items) x) <> jsonb_array_length(p_items) then raise exception 'Buku duplikat'; end if;
  for item in select value from jsonb_array_elements(p_items) order by value->>'slug' loop
    select * into b from public.books where slug=item->>'slug' for update;
    if not found or b.hidden or b.preorder or b.physical_price<>(item->>'unit_price')::integer
      or (item->>'quantity')::integer not between 1 and 99 then raise exception 'Harga atau buku berubah'; end if;
    select coalesce(sum(h.quantity),0) into held from public.sandbox_stock_holds h
      join public.simulation_orders o on o.id=h.order_id
      where h.slug=b.slug and o.status in ('PENDING','ACTIVE') and o.expires_at>now();
    if b.stock-held<(item->>'quantity')::integer then raise exception 'Stok sandbox sedang direservasi'; end if;
  end loop;
  if p_subtotal<>(select sum((x->>'quantity')::integer*(x->>'unit_price')::integer) from jsonb_array_elements(p_items) x)
    or p_shipping<>(case when p_subtotal>=250000 then 0 when p_courier='Ekspres' then 30000 else 18000 end)
    or p_total<>p_subtotal+p_shipping then raise exception 'Total tidak sesuai'; end if;
  insert into public.simulation_orders(id,user_id,channel,courier,items,subtotal,shipping,total,expires_at,inventory_reserved)
    values(p_id,p_user,p_channel,p_courier,p_items,p_subtotal,p_shipping,p_total,now()+interval '30 minutes',true)
    returning * into existing;
  insert into public.sandbox_stock_holds(order_id,slug,quantity)
    select p_id,x->>'slug',(x->>'quantity')::integer from jsonb_array_elements(p_items) x;
  return jsonb_build_object('created',true,'order',to_jsonb(existing));
end;
$$;
revoke all on function public.reserve_sandbox_order(uuid,uuid,text,text,jsonb,integer,integer,integer) from public,anon,authenticated;
grant execute on function public.reserve_sandbox_order(uuid,uuid,text,text,jsonb,integer,integer,integer) to service_role;

-- Completed is sticky; duplicate and out-of-order notifications are harmless.
create function public.reconcile_sandbox_payment(p_id uuid,p_user uuid,p_session text,
  p_status text,p_url text,p_expires timestamptz)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare r public.simulation_orders;
begin
  select * into r from public.simulation_orders where id=p_id and user_id=p_user for update;
  if not found or (r.session_id is not null and r.session_id<>p_session) then raise exception 'Sesi tidak cocok'; end if;
  if p_status not in ('ACTIVE','COMPLETED','EXPIRED','CANCELED') then raise exception 'Status tidak valid'; end if;
  if r.status='COMPLETED' or (r.status in ('EXPIRED','CANCELED') and p_status='ACTIVE') then p_status:=r.status; end if;
  update public.simulation_orders set session_id=p_session,status=p_status,payment_url=p_url,
    expires_at=coalesce(p_expires,expires_at),verified_at=now(),setup_error='',
    inventory_reserved=inventory_reserved and p_status='ACTIVE'
    where id=p_id returning * into r;
  insert into public.sandbox_payment_events(session_id,status) values(p_session,p_status) on conflict do nothing;
  return to_jsonb(r);
end;
$$;
revoke all on function public.reconcile_sandbox_payment(uuid,uuid,text,text,text,timestamptz) from public,anon,authenticated;
grant execute on function public.reconcile_sandbox_payment(uuid,uuid,text,text,text,timestamptz) to service_role;
commit;
