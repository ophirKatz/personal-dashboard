-- Meeting room booked on a Google Calendar event (a "resource" attendee), kept
-- separate from `location`, which is often a video-call link instead.
ALTER TABLE events ADD COLUMN IF NOT EXISTS room text;
