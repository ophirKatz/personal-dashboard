
create table public.recipes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  servings integer not null default 4,
  image_url text,
  source_url text,
  import_method text not null default 'manual' check (import_method in ('manual', 'prompt', 'paste', 'link')),
  last_viewed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.recipes enable row level security;
create policy "recipes_owner_all" on public.recipes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table public.recipe_ingredients (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  quantity numeric,
  unit text,
  name text not null,
  note text,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.recipe_ingredients enable row level security;
create policy "recipe_ingredients_owner_all" on public.recipe_ingredients
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index recipe_ingredients_recipe_id_idx on public.recipe_ingredients(recipe_id);

create table public.recipe_steps (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  position integer not null default 0,
  instruction text not null,
  created_at timestamptz not null default now()
);

alter table public.recipe_steps enable row level security;
create policy "recipe_steps_owner_all" on public.recipe_steps
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index recipe_steps_recipe_id_idx on public.recipe_steps(recipe_id);

create table public.recipe_collections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  emoji text not null default '🍽️',
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

alter table public.recipe_collections enable row level security;
create policy "recipe_collections_owner_all" on public.recipe_collections
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table public.recipe_collection_items (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  collection_id uuid not null references public.recipe_collections(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (recipe_id, collection_id)
);

alter table public.recipe_collection_items enable row level security;
create policy "recipe_collection_items_owner_all" on public.recipe_collection_items
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index recipe_collection_items_recipe_id_idx on public.recipe_collection_items(recipe_id);
create index recipe_collection_items_collection_id_idx on public.recipe_collection_items(collection_id);
