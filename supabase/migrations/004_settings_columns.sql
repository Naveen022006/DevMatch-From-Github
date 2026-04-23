-- ─── Settings: new user_profiles columns ─────────────────────────────────────

alter table public.user_profiles
  add column if not exists hide_from_feed boolean not null default false;

alter table public.user_profiles
  add column if not exists notification_preferences jsonb not null default '{}';
