-- The name the home page greets you with ("Good morning, <name> 👋"). It used to be hard-coded in
-- the app, which is wrong as soon as a second person signs in. Empty means no name is shown.
--
-- The app trims it and stores NULL for a blank one; the check is the database's backstop.
-- user_settings already has an owner-only policy, so this needs no new access rules.
alter table public.user_settings
  add column display_name text
    check (display_name is null or char_length(btrim(display_name)) between 1 and 40);

-- One-time backfill so the app's original user keeps the greeting they had. It is the account
-- that was created first, and only if it hasn't set a name; every later account starts empty.
update public.user_settings
set display_name = 'Ophir'
where display_name is null
  and user_id = (select id from auth.users order by created_at asc limit 1);
