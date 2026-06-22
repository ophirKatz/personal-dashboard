import { supabase } from '../../supabase'

export async function refreshGoogleCalendarEvents(): Promise<void> {
  await supabase.functions.invoke('fetch-google-calendar')
}
