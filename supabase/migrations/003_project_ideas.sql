-- ─── Project Ideas ────────────────────────────────────────────────────────────
create table if not exists public.project_ideas (
  id uuid default uuid_generate_v4() primary key,
  match_id uuid references public.matches(id) on delete cascade not null,
  ideas_json jsonb not null default '[]',
  saved_idea_index integer,      -- which idea index was saved (0, 1, 2 or null)
  created_at timestamptz default now() not null,
  unique (match_id)
);

alter table public.project_ideas enable row level security;

create policy "Match users can read project ideas"
  on public.project_ideas for select
  using (
    exists (
      select 1 from public.matches m
      where m.id = match_id
        and (auth.uid() = m.user_id_1 or auth.uid() = m.user_id_2)
    )
  );

create policy "Service role can upsert project ideas"
  on public.project_ideas for insert
  with check (true);

create policy "Service role can update project ideas"
  on public.project_ideas for update
  using (true);
