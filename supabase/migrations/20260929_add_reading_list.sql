-- Reading list: nested folders + saved books
create table if not exists public.reading_folders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  parent_id uuid references public.reading_folders(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.reading_books (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  folder_id uuid references public.reading_folders(id) on delete cascade,
  ol_key text,
  title text not null,
  author text,
  cover_url text,
  first_publish_year int,
  is_read boolean not null default false,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index if not exists reading_books_user_ol_key_idx
  on public.reading_books (user_id, ol_key) where ol_key is not null;
create index if not exists reading_books_folder_idx on public.reading_books (folder_id);
create index if not exists reading_folders_parent_idx on public.reading_folders (parent_id);

alter table public.reading_folders enable row level security;
alter table public.reading_books enable row level security;

create policy "user owns reading_folders" on public.reading_folders
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "user owns reading_books" on public.reading_books
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Reject moving a folder into itself or one of its own descendants
create or replace function public.reading_folders_prevent_cycle()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.parent_id is null then
    return new;
  end if;
  if new.parent_id = new.id then
    raise exception 'A folder cannot be its own parent';
  end if;
  if exists (
    with recursive ancestors as (
      select id, parent_id from public.reading_folders where id = new.parent_id
      union all
      select f.id, f.parent_id from public.reading_folders f join ancestors a on f.id = a.parent_id
    )
    select 1 from ancestors where id = new.id
  ) then
    raise exception 'A folder cannot be moved into its own subfolder';
  end if;
  return new;
end;
$$;

create trigger reading_folders_prevent_cycle
  before insert or update of parent_id on public.reading_folders
  for each row execute function public.reading_folders_prevent_cycle();
