-- Customizable order of the Home "Today" widget sections: an ordered list of
-- section keys. NULL means use the app default.
alter table public.user_settings
  add column if not exists today_sections_order text[];
