alter table public.events add column location text;

-- Google-synced events previously smuggled their location into "notes" since
-- there was no dedicated column; move that data into the new location field.
update public.events set location = notes, notes = null where source = 'google' and notes is not null;
