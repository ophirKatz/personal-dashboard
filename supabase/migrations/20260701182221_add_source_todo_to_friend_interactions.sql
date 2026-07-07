alter table public.friend_interactions
  add column source_todo_id uuid references public.todos(id) on delete set null;

create unique index friend_interactions_friend_source_todo_key
  on public.friend_interactions (friend_id, source_todo_id)
  where source_todo_id is not null;
