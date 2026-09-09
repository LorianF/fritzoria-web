begin;
alter table public.orders add column if not exists checkout_key uuid;
create unique index if not exists orders_checkout_key on public.orders(user_id, checkout_key);

create or replace function public.create_cod_order(p_key uuid, p_address uuid, p_lines jsonb, p_courier text, p_note text, p_expected_total integer)
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_address public.addresses%rowtype;
  v_book public.books%rowtype;
  v_line jsonb;
  v_order uuid;
  v_number text;
  v_subtotal bigint := 0;
  v_shipping integer;
  v_qty integer;
begin
  if v_user is null then raise exception 'Masuk terlebih dahulu.'; end if;
  if p_key is null then raise exception 'Kunci checkout wajib tersedia.'; end if;
  -- Serialize retries by user/key before checking an existing committed result.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_user::text || p_key::text, 0));
  select order_number into v_number from public.orders where user_id = v_user and checkout_key = p_key;
  if found then return v_number; end if;
  if p_courier is null or p_courier not in ('Reguler','Ekspres') or p_note is null or length(p_note) > 300 then
    raise exception 'Pengiriman atau catatan tidak valid.';
  end if;
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' then raise exception 'Keranjang tidak valid.'; end if;
  if jsonb_array_length(p_lines) not between 1 and 100 then raise exception 'Keranjang harus berisi 1–100 judul.'; end if;
  if exists(select 1 from jsonb_array_elements(p_lines) l group by l->>'slug' having count(*) > 1) then
    raise exception 'Buku duplikat dalam keranjang.';
  end if;
  select * into v_address from public.addresses where id = p_address and user_id = v_user;
  if not found then raise exception 'Alamat belum tersimpan di akun. Muat ulang alamat lalu coba lagi.'; end if;
  -- Stable locking order avoids deadlocks between carts containing the same books.
  for v_line in select value from jsonb_array_elements(p_lines) order by value->>'slug' loop
    if (v_line->>'format') is distinct from 'fisik' or coalesce(v_line->>'qty','') !~ '^[1-9][0-9]{0,2}$' then
      raise exception 'COD hanya untuk buku fisik dengan jumlah 1–999.';
    end if;
    v_qty := (v_line->>'qty')::integer;
    select * into v_book from public.books where slug = v_line->>'slug' for update;
    if not found then raise exception 'Buku tidak ditemukan.'; end if;
    if v_book.hidden or v_book.preorder then raise exception 'Buku tidak tersedia untuk checkout COD: %', v_book.title; end if;
    if v_book.stock < v_qty then raise exception 'Stok tidak cukup: %', v_book.title; end if;
    v_subtotal := v_subtotal + v_book.physical_price::bigint * v_qty;
  end loop;
  v_shipping := case when v_subtotal >= 250000 then 0 when p_courier = 'Ekspres' then 30000 else 18000 end;
  if v_subtotal + v_shipping > 2147483647 then raise exception 'Total pesanan terlalu besar.'; end if;
  if p_expected_total is null or p_expected_total <> v_subtotal + v_shipping then
    raise exception 'Harga buku berubah. Muat ulang keranjang dan periksa total terbaru.';
  end if;
  insert into public.orders(user_id,checkout_key,address_snapshot,subtotal,discount,shipping,total,courier,payment_method,customer_note,status)
  values(v_user,p_key,to_jsonb(v_address),v_subtotal,0,v_shipping,v_subtotal+v_shipping,p_courier,'COD',p_note,'Menunggu pembayaran')
  returning id,order_number into v_order,v_number;
  for v_line in select value from jsonb_array_elements(p_lines) loop
    select * into v_book from public.books where slug = v_line->>'slug';
    v_qty := (v_line->>'qty')::integer;
    insert into public.order_items(order_id,book_id,slug,title,author,cover_url,format,quantity,unit_price)
    values(v_order,v_book.id,v_book.slug,v_book.title,v_book.author,v_book.cover_url,'fisik',v_qty,v_book.physical_price);
    update public.books set stock = stock - v_qty where id = v_book.id;
  end loop;
  insert into public.order_status_history(order_id,status,changed_by) values(v_order,'Menunggu pembayaran',v_user);
  return v_number;
end;
$$;
revoke all on function public.create_cod_order(uuid,uuid,jsonb,text,text,integer) from public, anon;
grant execute on function public.create_cod_order(uuid,uuid,jsonb,text,text,integer) to authenticated;
commit;
