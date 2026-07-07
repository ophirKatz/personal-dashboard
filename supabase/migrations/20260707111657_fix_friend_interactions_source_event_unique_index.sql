drop index public.friend_interactions_friend_source_event_key;

create unique index friend_interactions_friend_source_event_key
  on public.friend_interactions (friend_id, source_event_id);
