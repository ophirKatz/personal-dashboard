alter table public.events
  add column source text not null default 'local' check (source in ('local', 'google')),
  add column google_event_id text,
  add column html_link text;

create unique index events_user_google_event_unique on public.events (user_id, google_event_id);
