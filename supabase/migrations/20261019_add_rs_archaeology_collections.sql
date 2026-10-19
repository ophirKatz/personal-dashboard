-- RuneScape 3 Archaeology collections: how many of each artefact a character has found.
-- The artefact list and required counts are static data in the app
-- (src/features/runescape/archaeology-data.ts), so only the found count is stored,
-- keyed by the artefact's slug. An artefact is complete when found >= its required count.

create table if not exists public.rs_archaeology_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  character_id uuid not null references public.rs_characters(id) on delete cascade,
  artefact_key text not null,
  found int not null default 0 check (found >= 0),
  updated_at timestamptz not null default now(),
  unique (character_id, artefact_key)
);

create index if not exists rs_archaeology_progress_character_idx on public.rs_archaeology_progress (character_id);

alter table public.rs_archaeology_progress enable row level security;

drop policy if exists "user owns rs_archaeology_progress" on public.rs_archaeology_progress;
create policy "user owns rs_archaeology_progress" on public.rs_archaeology_progress
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
