alter table todos
  add column source text not null default 'local',
  add column google_task_id text;

alter table todos
  add constraint todos_source_check check (source = any (array['local'::text, 'google'::text]));

alter table todos
  add constraint todos_user_google_task_unique unique (user_id, google_task_id);
