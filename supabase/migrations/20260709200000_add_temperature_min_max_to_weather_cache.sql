-- Add temperature_min and temperature_max columns to weather_cache
-- These columns support the weather temperature toggle feature to display
-- today's low/high temperatures alongside the current temperature

ALTER TABLE weather_cache
ADD COLUMN temperature_min numeric,
ADD COLUMN temperature_max numeric;
