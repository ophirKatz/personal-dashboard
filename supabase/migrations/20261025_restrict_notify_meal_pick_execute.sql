-- Supabase grants EXECUTE on new public functions to anon/authenticated directly,
-- so revoking from PUBLIC alone doesn't close it. notify_meal_pick() is only ever
-- run by the meal_shares_notify_pick trigger and must not be callable by API roles.
revoke execute on function public.notify_meal_pick() from anon, authenticated;
