-- RuneScape 3 tracker: characters, shared quest catalogue, structured goals
create table if not exists public.rs_characters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create unique index if not exists rs_characters_user_name_idx
  on public.rs_characters (user_id, lower(name));

-- Quest catalogue is game data, not user data: shared and refreshable from the app.
create table if not exists public.rs_quests (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  difficulty text,
  members boolean,
  quest_points int,
  updated_at timestamptz not null default now()
);

create table if not exists public.rs_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  character_id uuid not null references public.rs_characters(id) on delete cascade,
  type text not null check (type in ('skill', 'quest', 'arbitrary')),
  skill_id int check (skill_id between 0 and 28),
  target_level int check (target_level between 2 and 120),
  quest_id uuid references public.rs_quests(id) on delete cascade,
  title text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint rs_goals_shape check (
    (type = 'skill' and skill_id is not null and target_level is not null and quest_id is null)
    or (type = 'quest' and quest_id is not null and skill_id is null and target_level is null)
    or (type = 'arbitrary' and title is not null and skill_id is null and target_level is null and quest_id is null)
  )
);

create index if not exists rs_goals_character_idx on public.rs_goals (character_id);

alter table public.rs_characters enable row level security;
alter table public.rs_quests enable row level security;
alter table public.rs_goals enable row level security;

create policy "user owns rs_characters" on public.rs_characters
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "user owns rs_goals" on public.rs_goals
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "authenticated read rs_quests" on public.rs_quests
  for select to authenticated using (true);
create policy "authenticated insert rs_quests" on public.rs_quests
  for insert to authenticated with check (true);
create policy "authenticated update rs_quests" on public.rs_quests
  for update to authenticated using (true) with check (true);
