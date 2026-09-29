-- "Currently reading": at most one flagged book per user
alter table public.reading_books
  add column if not exists is_current boolean not null default false;

create unique index if not exists reading_books_one_current_idx
  on public.reading_books (user_id) where is_current;
