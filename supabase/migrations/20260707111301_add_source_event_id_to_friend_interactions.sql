alter table public.friend_interactions
  add column source_event_id uuid references public.events(id) on delete set null;

create unique index friend_interactions_friend_source_event_key
  on public.friend_interactions (friend_id, source_event_id)
  where (source_event_id is not null);
