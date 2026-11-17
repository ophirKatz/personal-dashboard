-- Climbing widget glow: the date the latest calendar climbing session ended on.
--
-- Written by the fetch-google-calendar sync. The sync only keeps events from today onward, so an
-- ended session's event is gone by the next day; this keeps the fact that it happened. The home
-- widget glows while no climbing_sessions row is dated on or after this day (logging one is what
-- dismisses it), so nothing here needs clearing.
alter table public.user_settings
  add column if not exists climbing_session_ended_on date;
