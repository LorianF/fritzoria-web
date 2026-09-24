begin;

-- Anonymous visitors only need the public rows. Keep the privileged branch in a
-- separate authenticated policy so is_admin() no longer needs anonymous access.
drop policy "Public can read active books" on public.books;
create policy "Public can read active books" on public.books
  for select to anon, authenticated using (not hidden);
create policy "Admins can read hidden books" on public.books
  for select to authenticated using ((select public.is_admin()));

drop policy "Public reads visible reviews" on public.reviews;
create policy "Public reads visible reviews" on public.reviews
  for select to anon, authenticated using (not hidden);
create policy "Admins can read hidden reviews" on public.reviews
  for select to authenticated using ((select public.is_admin()));

revoke all on function public.handle_new_user() from public, anon, authenticated;
grant execute on function public.handle_new_user() to supabase_auth_admin, service_role;

revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated, service_role;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.server_rate_limits (
  scope text not null,
  subject_key text not null,
  window_start timestamptz not null,
  request_count integer not null check (request_count > 0),
  primary key (scope, subject_key, window_start)
);

revoke all on private.server_rate_limits from public, anon, authenticated;

create index if not exists server_rate_limits_window_idx
  on private.server_rate_limits(window_start);

create or replace function public.consume_server_rate_limit(
  p_scope text,
  p_key text,
  p_limit integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_window timestamptz;
  v_count integer;
begin
  if p_scope !~ '^[a-z0-9_]{1,64}$'
    or char_length(p_key) not between 1 and 200
    or p_limit not between 1 and 1000
    or p_window_seconds not between 1 and 86400 then
    raise exception 'Parameter pembatas permintaan tidak valid';
  end if;

  v_window := to_timestamp(
    floor(extract(epoch from statement_timestamp()) / p_window_seconds)
      * p_window_seconds
  );

  insert into private.server_rate_limits(scope, subject_key, window_start, request_count)
  values (p_scope, p_key, v_window, 1)
  on conflict (scope, subject_key, window_start) do update
    set request_count = private.server_rate_limits.request_count + 1
    where private.server_rate_limits.request_count < p_limit
  returning request_count into v_count;

  return v_count is not null;
end;
$$;

revoke all on function public.consume_server_rate_limit(text, text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.consume_server_rate_limit(text, text, integer, integer)
  to service_role;

create index if not exists support_messages_sender_created_idx
  on public.support_messages(sender_id, created_at desc);

create or replace function public.start_support_thread(p_topic text, p_subject text, p_body text)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_thread uuid;
begin
  if v_user is null then raise exception 'Silakan masuk untuk menghubungi CS'; end if;
  if p_topic not in ('Pesanan', 'Pembayaran', 'Pengiriman', 'Retur', 'Akun', 'Katalog', 'Lainnya')
    or char_length(trim(p_subject)) not between 3 and 120
    or char_length(trim(p_body)) not between 1 and 2000 then
    raise exception 'Pesan bantuan tidak valid';
  end if;
  if (
    select count(*) from public.support_threads
    where user_id = v_user and created_at > now() - interval '1 hour'
  ) >= 5 then
    raise exception 'Batas 5 percakapan bantuan per jam telah tercapai';
  end if;

  insert into public.support_threads(user_id, topic, subject)
  values(v_user, p_topic, trim(p_subject))
  returning id into v_thread;

  insert into public.support_messages(thread_id, sender_id, sender_role, body)
  values(v_thread, v_user, 'customer', trim(p_body));

  return v_thread;
end;
$$;

create or replace function public.send_support_message(p_thread uuid, p_body text)
returns bigint
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_admin boolean := public.is_admin();
  v_message bigint;
begin
  if v_user is null then raise exception 'Silakan masuk untuk menghubungi CS'; end if;
  if char_length(trim(p_body)) not between 1 and 2000 then raise exception 'Pesan tidak valid'; end if;
  if (
    select count(*) from public.support_messages
    where sender_id = v_user and created_at > now() - interval '1 hour'
  ) >= 30 then
    raise exception 'Batas 30 pesan bantuan per jam telah tercapai';
  end if;

  insert into public.support_messages(thread_id, sender_id, sender_role, body)
  values(p_thread, v_user, case when v_admin then 'admin'::public.support_sender_role else 'customer'::public.support_sender_role end, trim(p_body))
  returning id into v_message;

  update public.support_threads
  set status = case when v_admin then 'waiting_customer'::public.support_status else 'open'::public.support_status end,
      updated_at = now()
  where id = p_thread;

  return v_message;
end;
$$;

revoke all on function public.start_support_thread(text, text, text) from public, anon;
revoke all on function public.send_support_message(uuid, text) from public, anon;
grant execute on function public.start_support_thread(text, text, text) to authenticated;
grant execute on function public.send_support_message(uuid, text) to authenticated;

commit;
