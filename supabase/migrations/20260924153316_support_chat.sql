begin;

create type public.support_status as enum ('open', 'waiting_customer', 'resolved');
create type public.support_sender_role as enum ('customer', 'admin');

create table public.support_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  topic text not null check (topic in ('Pesanan', 'Pembayaran', 'Pengiriman', 'Retur', 'Akun', 'Katalog', 'Lainnya')),
  subject text not null check (char_length(subject) between 3 and 120),
  status public.support_status not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.support_messages (
  id bigint generated always as identity primary key,
  thread_id uuid not null references public.support_threads(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  sender_role public.support_sender_role not null,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index support_threads_user_created_idx
  on public.support_threads(user_id, created_at desc);
create index support_threads_status_updated_idx
  on public.support_threads(status, updated_at desc);
create index support_messages_thread_created_idx
  on public.support_messages(thread_id, created_at);

alter table public.support_threads enable row level security;
alter table public.support_messages enable row level security;

revoke all on public.support_threads, public.support_messages from public, anon, authenticated;
grant select, insert on public.support_threads to authenticated;
grant update(status, updated_at) on public.support_threads to authenticated;
grant select, insert on public.support_messages to authenticated;
grant usage, select on sequence public.support_messages_id_seq to authenticated;

create policy support_threads_read on public.support_threads
  for select to authenticated
  using (user_id = (select auth.uid()) or public.is_admin());

create policy support_threads_create on public.support_threads
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy support_threads_customer_update on public.support_threads
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy support_threads_admin_update on public.support_threads
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy support_messages_read on public.support_messages
  for select to authenticated
  using (
    exists (
      select 1 from public.support_threads t
      where t.id = thread_id
        and (t.user_id = (select auth.uid()) or public.is_admin())
    )
  );

create policy support_messages_create on public.support_messages
  for insert to authenticated
  with check (
    sender_id = (select auth.uid())
    and (
      (
        sender_role = 'customer'
        and exists (
          select 1 from public.support_threads t
          where t.id = thread_id and t.user_id = (select auth.uid())
        )
      )
      or (sender_role = 'admin' and public.is_admin())
    )
  );

create function public.start_support_thread(p_topic text, p_subject text, p_body text)
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

  insert into public.support_threads(user_id, topic, subject)
  values(v_user, p_topic, trim(p_subject))
  returning id into v_thread;

  insert into public.support_messages(thread_id, sender_id, sender_role, body)
  values(v_thread, v_user, 'customer', trim(p_body));

  return v_thread;
end;
$$;

create function public.send_support_message(p_thread uuid, p_body text)
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

alter publication supabase_realtime add table public.support_threads;
alter publication supabase_realtime add table public.support_messages;

commit;
