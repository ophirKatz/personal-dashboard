create table public.api_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null default 'Voice Shortcuts',
  token_hash text not null unique,
  last_used_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.api_tokens enable row level security;

create policy "Users manage their own api tokens"
  on public.api_tokens for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
