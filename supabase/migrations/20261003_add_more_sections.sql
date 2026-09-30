-- Customizable layout of the mobile "More" page: an ordered list of
-- { id, title, items: [nav item keys] }. NULL means use the app default.
alter table public.user_settings
  add column if not exists more_sections jsonb;
