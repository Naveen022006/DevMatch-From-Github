-- ─── Admin Posts in Activity Feed ────────────────────────────────────────────
-- Extend the action_type check constraint to include 'admin_post'

alter table public.activity_feed
  drop constraint if exists activity_feed_action_type_check;

alter table public.activity_feed
  add constraint activity_feed_action_type_check
  check (action_type in ('joined', 'connected', 'achievement', 'challenge', 'admin_post'));

-- Allow the service role to delete feed entries (needed for admin post removal)
do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'activity_feed'
      and policyname = 'Service role can delete feed entries'
  ) then
    execute 'create policy "Service role can delete feed entries"
      on public.activity_feed for delete
      using (true)';
  end if;
end $$;
