create table public.google_calendar_tokens (
  user_id uuid primary key references auth.users(id) on delete cascade,
  refresh_token text not null,
  access_token text,
  access_token_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.google_calendar_tokens enable row level security;

create policy "google_calendar_tokens_owner" on public.google_calendar_tokens
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
