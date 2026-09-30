-- Attendees (name/email/RSVP status) synced from Google Calendar events.
ALTER TABLE events ADD COLUMN IF NOT EXISTS attendees jsonb;
