drop index public.friend_interactions_friend_source_todo_key;

create unique index friend_interactions_friend_source_todo_key
  on public.friend_interactions (friend_id, source_todo_id);
