-- RuneScape 3 PvM path: which of the guide's goals a character has completed.
-- The goals themselves are static data in the app (src/features/runescape/pvm-data.ts),
-- so only completed ones are stored, keyed by the goal's stable key (e.g. 'arch-glacor:intro-1').
-- A row means the goal is done; un-ticking a goal deletes its row.

create table if not exists public.rs_pvm_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  character_id uuid not null references public.rs_characters(id) on delete cascade,
  goal_key text not null,
  completed_at timestamptz not null default now(),
  unique (character_id, goal_key)
);

create index if not exists rs_pvm_progress_character_idx on public.rs_pvm_progress (character_id);

alter table public.rs_pvm_progress enable row level security;

drop policy if exists "user owns rs_pvm_progress" on public.rs_pvm_progress;
create policy "user owns rs_pvm_progress" on public.rs_pvm_progress
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
