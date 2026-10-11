-- Meal ideas: meals the user usually makes at home, tagged by meal type, with
-- an optional photo and an optional link to a recipe from the Recipes feature.
create table if not exists public.meals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  image_url text,
  recipe_id uuid references public.recipes(id) on delete set null,
  tags text[] not null default '{}'
    check (tags <@ array['breakfast', 'lunch', 'dinner', 'dessert']),
  created_at timestamptz not null default now()
);

create index if not exists meals_user_id_idx on public.meals (user_id);

alter table public.meals enable row level security;

drop policy if exists "user owns meals" on public.meals;
create policy "user owns meals"
  on public.meals
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

insert into storage.buckets (id, name, public)
values ('meal-images', 'meal-images', true)
on conflict (id) do nothing;

drop policy if exists "user owns meal image files" on storage.objects;
create policy "user owns meal image files"
  on storage.objects
  for all
  using (bucket_id = 'meal-images' and (auth.uid())::text = (storage.foldername(name))[1])
  with check (bucket_id = 'meal-images' and (auth.uid())::text = (storage.foldername(name))[1]);
