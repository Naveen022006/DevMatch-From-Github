-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ─── User Profiles ───────────────────────────────────────────────────────────
create table public.user_profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  github_username text not null unique,
  github_id bigint not null unique,
  avatar_url text not null,
  display_name text,

  -- Analyzed fields
  languages text[] default '{}',
  coding_identity text check (coding_identity in ('builder','learner','maintainer','explorer')),
  passion_areas text[] default '{}',
  peak_hours text,
  commit_style text,
  experience_level text check (experience_level in ('beginner','intermediate','senior','expert')),
  ghost_repos integer default 0,
  collaboration_style text check (collaboration_style in ('solo','pair','team-lead','contributor')),
  human_description text,

  -- Stats
  total_repos integer default 0,
  total_stars integer default 0,
  total_commits_estimate integer default 0,

  -- Cache control
  analysis_cached_at timestamptz,

  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- ─── Matches ─────────────────────────────────────────────────────────────────
create table public.matches (
  id uuid default uuid_generate_v4() primary key,
  user_id_1 uuid references public.user_profiles(id) on delete cascade not null,
  user_id_2 uuid references public.user_profiles(id) on delete cascade not null,
  compatibility_total integer not null,
  technical_synergy integer not null,
  learning_potential integer not null,
  collaboration_score integer not null,
  personality_fit integer not null,
  match_reason text,
  created_at timestamptz default now() not null,
  unique (user_id_1, user_id_2)
);

-- ─── Achievements ─────────────────────────────────────────────────────────────
create table public.user_achievements (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.user_profiles(id) on delete cascade not null,
  achievement_slug text not null check (achievement_slug in (
    'first_connection','code_twins','ghost_whisperer','night_owls','challenge_complete'
  )),
  unlock_message text not null,
  related_user_id uuid references public.user_profiles(id) on delete set null,
  unlocked_at timestamptz default now() not null,
  unique (user_id, achievement_slug)
);

-- ─── Story Cards Cache ────────────────────────────────────────────────────────
create table public.story_cards (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.user_profiles(id) on delete cascade not null unique,
  line1 text not null,
  line2 text not null,
  line3 text not null,
  line4 text not null,
  primary_color text not null default '#6366f1',
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- ─── RLS Policies ─────────────────────────────────────────────────────────────
alter table public.user_profiles enable row level security;
alter table public.matches enable row level security;
alter table public.user_achievements enable row level security;
alter table public.story_cards enable row level security;

-- Profiles: public read, owner write
create policy "Public profiles viewable by everyone"
  on public.user_profiles for select using (true);
create policy "Users can insert own profile"
  on public.user_profiles for insert with check (auth.uid() = id);
create policy "Users can update own profile"
  on public.user_profiles for update using (auth.uid() = id);

-- Matches: visible to either party
create policy "Matches visible to participants"
  on public.matches for select
  using (auth.uid() = user_id_1 or auth.uid() = user_id_2);
create policy "Service role can insert matches"
  on public.matches for insert with check (true);

-- Achievements: owner read
create policy "Users see own achievements"
  on public.user_achievements for select using (auth.uid() = user_id);
create policy "Service role inserts achievements"
  on public.user_achievements for insert with check (true);

-- Story cards: public read
create policy "Story cards public"
  on public.story_cards for select using (true);
create policy "Service role upserts story cards"
  on public.story_cards for all with check (true);

-- ─── Updated_at trigger ──────────────────────────────────────────────────────
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger set_updated_at_profiles
  before update on public.user_profiles
  for each row execute function public.handle_updated_at();

create trigger set_updated_at_story_cards
  before update on public.story_cards
  for each row execute function public.handle_updated_at();
