-- ─── Messages ─────────────────────────────────────────────────────────────────
create table if not exists public.messages (
  id uuid default uuid_generate_v4() primary key,
  sender_id uuid references public.user_profiles(id) on delete cascade not null,
  receiver_id uuid references public.user_profiles(id) on delete cascade not null,
  content text not null,
  read boolean default false not null,
  created_at timestamptz default now() not null
);

alter table public.messages enable row level security;

create policy "Users can read their own messages"
  on public.messages for select
  using (auth.uid() = sender_id or auth.uid() = receiver_id);

create policy "Users can send messages"
  on public.messages for insert
  with check (auth.uid() = sender_id);

create policy "Receivers can mark messages read"
  on public.messages for update
  using (auth.uid() = receiver_id);

-- ─── Connection Requests ──────────────────────────────────────────────────────
create table if not exists public.connection_requests (
  id uuid default uuid_generate_v4() primary key,
  from_user_id uuid references public.user_profiles(id) on delete cascade not null,
  to_user_id uuid references public.user_profiles(id) on delete cascade not null,
  status text default 'pending' not null check (status in ('pending','accepted','declined')),
  compatibility_score integer,
  compatibility_data jsonb,
  created_at timestamptz default now() not null,
  unique (from_user_id, to_user_id)
);

alter table public.connection_requests enable row level security;

create policy "Users can view requests they sent or received"
  on public.connection_requests for select
  using (auth.uid() = from_user_id or auth.uid() = to_user_id);

create policy "Users can send connection requests"
  on public.connection_requests for insert
  with check (auth.uid() = from_user_id);

create policy "Service role can update connection requests"
  on public.connection_requests for update
  using (true);

-- ─── Activity Feed ────────────────────────────────────────────────────────────
create table if not exists public.activity_feed (
  id uuid default uuid_generate_v4() primary key,
  actor_id uuid references public.user_profiles(id) on delete cascade not null,
  action_type text not null check (action_type in ('joined','connected','achievement','challenge')),
  target_id uuid references public.user_profiles(id) on delete set null,
  metadata jsonb,
  created_at timestamptz default now() not null
);

alter table public.activity_feed enable row level security;

create policy "Activity feed is publicly readable"
  on public.activity_feed for select
  using (true);

create policy "Service role can insert feed entries"
  on public.activity_feed for insert
  with check (true);

-- ─── User Profiles: add is_public column ─────────────────────────────────────
alter table public.user_profiles
  add column if not exists is_public boolean not null default true;

-- ─── Leaderboard Resets ───────────────────────────────────────────────────────
create table if not exists public.leaderboard_resets (
  id uuid default uuid_generate_v4() primary key,
  challenge_id uuid references public.challenges(id) on delete cascade,
  reset_at timestamptz default now() not null
);

alter table public.leaderboard_resets enable row level security;

create policy "Leaderboard resets public read"
  on public.leaderboard_resets for select using (true);

create policy "Service role inserts leaderboard resets"
  on public.leaderboard_resets for insert with check (true);

-- ─── Notifications ────────────────────────────────────────────────────────────
create table if not exists public.notifications (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.user_profiles(id) on delete cascade not null,
  type text not null check (type in (
    'connection_request', 'connection_accepted', 'message', 'achievement', 'challenge_result'
  )),
  message text not null,
  link text not null,
  read boolean default false not null,
  created_at timestamptz default now() not null
);

alter table public.notifications enable row level security;

create policy "Users can view own notifications"
  on public.notifications for select
  using (auth.uid() = user_id);

create policy "Service role can insert notifications"
  on public.notifications for insert with check (true);

create policy "Users can mark own notifications read"
  on public.notifications for update
  using (auth.uid() = user_id);
