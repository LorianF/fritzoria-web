begin;

create index support_messages_sender_idx
  on public.support_messages(sender_id);

drop policy support_threads_customer_update on public.support_threads;
drop policy support_threads_admin_update on public.support_threads;

create policy support_threads_update on public.support_threads
  for update to authenticated
  using (user_id = (select auth.uid()) or public.is_admin())
  with check (user_id = (select auth.uid()) or public.is_admin());

commit;
