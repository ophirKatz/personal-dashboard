ALTER TABLE climbing_attempts DROP CONSTRAINT climbing_attempts_result_check;
ALTER TABLE climbing_attempts ADD CONSTRAINT climbing_attempts_result_check
  CHECK (result = ANY (ARRAY['sent'::text, 'project'::text, 'completed_project'::text]));
