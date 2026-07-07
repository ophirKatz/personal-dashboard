create table public.google_drive_folders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  folder_id text not null,
  folder_name text not null,
  created_at timestamptz not null default now(),
  unique (user_id, folder_id)
);

alter table public.google_drive_folders enable row level security;

create policy "google_drive_folders_owner" on public.google_drive_folders
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
