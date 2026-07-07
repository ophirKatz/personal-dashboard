ALTER TABLE public.friends
  ADD COLUMN goal_mode text NOT NULL DEFAULT 'interval'
  CHECK (goal_mode = ANY (ARRAY['interval'::text, 'frequency'::text]));
