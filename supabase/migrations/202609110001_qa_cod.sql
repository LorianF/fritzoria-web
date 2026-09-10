begin;
alter table public.orders add column if not exists return_reason text not null default '';

create or replace function public.transition_cod_order(
  p_number text, p_expected public.order_status, p_status public.order_status, p_reason text default ''
) returns void language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_admin boolean := public.is_admin();
  v_order public.orders%rowtype;
  v_item record;
  v_allowed boolean := false;
begin
  if v_user is null then raise exception 'Masuk terlebih dahulu.'; end if;
  select * into v_order from public.orders where order_number=p_number for update;
  if not found or (not v_admin and v_order.user_id<>v_user) then
    raise exception 'Pesanan tidak ditemukan atau akses ditolak.';
  end if;
  if v_order.payment_method<>'COD' then raise exception 'Pesanan ini bukan COD.'; end if;
  if p_status is null or p_expected is null then raise exception 'Status wajib diisi.'; end if;
  -- Only duplicate requests by the same actor are idempotent; stale changes fail.
  if v_order.status=p_status and exists (
    select 1 from public.order_status_history where order_id=v_order.id and status=p_status and changed_by=v_user
  ) then return; end if;
  if v_order.status<>p_expected then raise exception 'Status sudah berubah. Muat ulang pesanan.'; end if;
  if v_admin then
    v_allowed := (v_order.status='Menunggu pembayaran' and p_status in ('Diproses','Dibatalkan'))
      or (v_order.status='Diproses' and p_status in ('Dikirim','Dibatalkan'))
      or (v_order.status='Dikirim' and p_status='Selesai')
      or (v_order.status='Retur diajukan' and p_status in ('Dikembalikan','Selesai'));
  end if;
  if v_order.user_id=v_user then
    v_allowed := v_allowed or (v_order.status='Menunggu pembayaran' and p_status='Dibatalkan')
      or (v_order.status='Dikirim' and p_status='Selesai')
      or (v_order.status='Selesai' and p_status='Retur diajukan');
  end if;
  if not v_allowed then raise exception 'Perubahan status tidak diizinkan.'; end if;
  if p_status='Retur diajukan' and (p_reason is null or length(trim(p_reason)) not between 10 and 1000) then
    raise exception 'Alasan retur harus 10–1000 karakter.';
  end if;
  if p_status in ('Dibatalkan','Dikembalikan') then
    -- Same slug ordering as checkout; the locked order prevents double restocks.
    for v_item in select book_id,quantity from public.order_items
      where order_id=v_order.id and format='fisik' order by slug loop
      update public.books set stock=stock+v_item.quantity where id=v_item.book_id;
    end loop;
  end if;
  update public.orders set status=p_status, updated_at=now(),
    return_reason=case when p_status='Retur diajukan' then trim(p_reason) else return_reason end
    where id=v_order.id;
  insert into public.order_status_history(order_id,status,changed_by) values(v_order.id,p_status,v_user);
end;
$$;
revoke all on function public.transition_cod_order(text,public.order_status,public.order_status,text) from public, anon;
grant execute on function public.transition_cod_order(text,public.order_status,public.order_status,text) to authenticated;
commit;
