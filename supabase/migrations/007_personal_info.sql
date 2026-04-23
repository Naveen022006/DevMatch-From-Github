-- ─── Personal Info Fields ────────────────────────────────────────────────────
-- Basic user details collected during onboarding and editable in settings

alter table public.user_profiles
  add column if not exists age          integer check (age >= 13 and age <= 120),
  add column if not exists place        text,
  add column if not exists role         text,
  add column if not exists gender       text check (gender in ('male','female','non-binary','prefer-not-to-say')),
  add column if not exists contact_email text,
  add column if not exists phone        text;
