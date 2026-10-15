-- Page lock: a 4-digit code you have to type before opening certain pages.
--
-- lock_code    the code (default 0000 until you change it in Settings).
-- locked_pages NavItemKey values (see src/lib/navItems.ts) of the pages that
--              ask for the code. Validated in the app, so adding a new lockable
--              page needs no migration. Wealth is locked by default.
--
-- This is a screen lock, not data security: the code is checked in the browser
-- and the data stays readable through the API under your login.

alter table public.user_settings
  add column if not exists lock_code text not null default '0000'
    check (lock_code ~ '^[0-9]{4}$');

alter table public.user_settings
  add column if not exists locked_pages text[] not null default '{wealth}';
