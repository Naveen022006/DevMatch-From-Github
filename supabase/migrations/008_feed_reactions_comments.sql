-- Feed Reactions
create table if not exists feed_reactions (
  id          uuid primary key default gen_random_uuid(),
  feed_item_id uuid not null references activity_feed(id) on delete cascade,
  user_id     uuid not null references user_profiles(id) on delete cascade,
  emoji       text not null check (emoji in ('👍','❤️','🔥','🚀','💡', '🐉' , '♨️')),
  created_at  timestamptz default now(),
  unique (feed_item_id, user_id, emoji)
);

alter table feed_reactions enable row level security;

create policy "Authenticated users can read reactions"
  on feed_reactions for select
  using (auth.role() = 'authenticated');

create policy "Users manage own reactions"
  on feed_reactions for all
  using (auth.uid() = user_id);

-- Feed Comments
create table if not exists feed_comments (
  id           uuid primary key default gen_random_uuid(),
  feed_item_id uuid not null references activity_feed(id) on delete cascade,
  user_id      uuid not null references user_profiles(id) on delete cascade,
  content      text not null check (char_length(content) between 1 and 200),
  created_at   timestamptz default now()
);

alter table feed_comments enable row level security;

create policy "Authenticated users can read comments"
  on feed_comments for select
  using (auth.role() = 'authenticated');

create policy "Users manage own comments"
  on feed_comments for all
  using (auth.uid() = user_id);

-- Indexes for fast lookups
create index if not exists idx_feed_reactions_item on feed_reactions(feed_item_id);
create index if not exists idx_feed_comments_item  on feed_comments(feed_item_id);
