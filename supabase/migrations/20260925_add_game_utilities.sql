-- Per-user overrides for the built-in Games utilities (name, description,
-- image). The utilities themselves are defined in code
-- (src/features/games/utilities.ts); a missing row means "use the defaults".
create table if not exists public.game_utilities (
  user_id uuid not null,
  utility_key text not null,
  name text,
  description text,
  image_url text,
  -- false = the user removed the image entirely (no custom, no default)
  show_image boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (user_id, utility_key)
);

alter table public.game_utilities enable row level security;

create policy "user owns game_utilities"
  on public.game_utilities
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

insert into storage.buckets (id, name, public)
values ('game-images', 'game-images', true)
on conflict (id) do nothing;

create policy "user owns game image files"
  on storage.objects
  for all
  using (bucket_id = 'game-images' and (auth.uid())::text = (storage.foldername(name))[1])
  with check (bucket_id = 'game-images' and (auth.uid())::text = (storage.foldername(name))[1]);
