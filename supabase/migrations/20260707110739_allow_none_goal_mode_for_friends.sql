ALTER TABLE public.friends DROP CONSTRAINT friends_goal_mode_check;
ALTER TABLE public.friends ADD CONSTRAINT friends_goal_mode_check CHECK (goal_mode = ANY (ARRAY['interval'::text, 'frequency'::text, 'none'::text]));
