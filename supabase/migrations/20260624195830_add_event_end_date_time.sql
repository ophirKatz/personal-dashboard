ALTER TABLE public.events
  ADD COLUMN event_end_date date NULL,
  ADD COLUMN event_end_time time without time zone NULL;
