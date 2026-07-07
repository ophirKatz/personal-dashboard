
ALTER TABLE friends
  ADD COLUMN goal_mode text NOT NULL DEFAULT 'interval'
  CHECK (goal_mode IN ('interval', 'frequency'));
