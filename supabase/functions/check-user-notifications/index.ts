import { createClient, SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { todayInTZ } from '../_shared/time.ts'

// Cron-driven replacement for the client-side checkStockAlerts/checkFriendReminders
// that used to run in a useEffect on every app mount (src/App.tsx) — that meant a
// stock crossing its threshold while the app wasn't open never notified, and
// concurrent tabs/devices could race on the same triggered_at/reminder_notified_at
// guard. This function computes both and writes the same `notifications` rows
// those did, on a schedule, using the service-role key so it's a single writer.
// (Separate from send-notifications, which delivers already-decided web push —
// this function only decides/writes in-app notification banners.)

type StockAlertRow = { id: string; user_id: string; symbol: string; target_price: number; triggered_at: string | null }
type FriendRow = {
  id: string
  user_id: string
  name: string
  notes: string | null
  goal_count: number
  goal_unit: string
  goal_mode: string
  reminder_enabled: boolean
  reminder_notified_at: string | null
  created_at: string
}
type InteractionRow = { friend_id: string; interaction_date: string }

const FRIEND_GOAL_UNIT_DAYS: Record<string, number> = { day: 1, week: 7, month: 30, year: 365 }

// Mirrors src/utils.ts's friendTargetIntervalDays/friendDaysSinceLastInteraction/
// isFriendOverdue/formatFriendGoal — duplicated rather than imported since Deno
// Edge Functions can't import from src/ (same constraint noted in import-recipe).
function friendTargetIntervalDays(friend: FriendRow): number {
  if (friend.goal_mode === 'none') return Infinity
  const days = FRIEND_GOAL_UNIT_DAYS[friend.goal_unit] ?? 30
  return friend.goal_mode === 'frequency'
    ? Math.max(1, Math.round(days / friend.goal_count))
    : friend.goal_count * days
}

function calendarDaysBetween(fromDateStr: string, toDateStr: string): number {
  const from = new Date(`${fromDateStr}T00:00:00Z`).getTime()
  const to = new Date(`${toDateStr}T00:00:00Z`).getTime()
  return Math.round((to - from) / 86_400_000)
}

function friendDaysSinceLastInteraction(friend: FriendRow, interactions: InteractionRow[], today: string): number {
  const dates = interactions.filter(i => i.friend_id === friend.id).map(i => i.interaction_date).sort()
  const last = dates.length ? dates[dates.length - 1] : friend.created_at.slice(0, 10)
  return calendarDaysBetween(last, today)
}

function isFriendOverdue(friend: FriendRow, interactions: InteractionRow[], today: string): boolean {
  return friendDaysSinceLastInteraction(friend, interactions, today) >= friendTargetIntervalDays(friend)
}

function formatFriendGoal(count: number, unit: string, mode: string): string {
  if (mode === 'none') return 'Not tracked'
  if (mode === 'frequency') return count === 1 ? `Once a ${unit}` : `${count}x a ${unit}`
  return count === 1 ? `Every ${unit}` : `Every ${count} ${unit}s`
}

// Reaches the same Finnhub-backed quote the client uses via /api/stock-quote,
// but that's a Vercel function on a different host than this Edge Function, so
// it's called by absolute URL (APP_URL) rather than duplicating FINNHUB_API_KEY
// and the quote-parsing logic into a second place — same pattern
// google-connect-callback already uses to reach the deployed app.
async function fetchStockQuote(appUrl: string, symbol: string): Promise<{ current: number } | null> {
  try {
    const res = await fetch(`${appUrl}/api/stock-quote?symbol=${encodeURIComponent(symbol)}`)
    if (!res.ok) {
      console.error('check-user-notifications: stock-quote request failed for', symbol, res.status, await res.text())
      return null
    }
    return await res.json()
  } catch (err) {
    console.error('check-user-notifications: stock-quote fetch failed for', symbol, err)
    return null
  }
}

async function checkStockAlerts(supabase: SupabaseClient, appUrl: string): Promise<number> {
  const { data: alerts } = await supabase.from('stock_alerts').select('id, user_id, symbol, target_price, triggered_at')
  let notified = 0
  for (const alert of (alerts ?? []) as StockAlertRow[]) {
    const quote = await fetchStockQuote(appUrl, alert.symbol)
    if (!quote) continue // one bad symbol/upstream hiccup shouldn't abort the run

    if (quote.current >= alert.target_price && !alert.triggered_at) {
      await supabase.from('notifications').insert({
        user_id: alert.user_id,
        type: 'stock_alert',
        title: `${alert.symbol} hit your target`,
        message: `${alert.symbol} is now $${quote.current.toFixed(2)}, above your alert level of $${alert.target_price.toFixed(2)}.`,
      })
      await supabase.from('stock_alerts').update({ triggered_at: new Date().toISOString() }).eq('id', alert.id)
      notified++
    } else if (quote.current < alert.target_price && alert.triggered_at) {
      await supabase.from('stock_alerts').update({ triggered_at: null }).eq('id', alert.id)
    }
  }
  return notified
}

async function checkFriendReminders(supabase: SupabaseClient): Promise<number> {
  const today = todayInTZ()
  const { data: friends } = await supabase
    .from('friends')
    .select('id, user_id, name, notes, goal_count, goal_unit, goal_mode, reminder_enabled, reminder_notified_at, created_at')
    .eq('reminder_enabled', true)
  const friendRows = (friends ?? []) as FriendRow[]
  if (friendRows.length === 0) return 0

  const { data: interactions } = await supabase
    .from('friend_interactions')
    .select('friend_id, interaction_date')
    .in('friend_id', friendRows.map(f => f.id))
  const interactionRows = (interactions ?? []) as InteractionRow[]

  let notified = 0
  for (const friend of friendRows) {
    const overdue = isFriendOverdue(friend, interactionRows, today)
    if (overdue && !friend.reminder_notified_at) {
      const noteClause = friend.notes ? ` Note: ${friend.notes}` : ''
      await supabase.from('notifications').insert({
        user_id: friend.user_id,
        type: 'friend_reminder',
        title: `Stay in touch with ${friend.name}`,
        message: `You haven't connected in a while — your goal is ${formatFriendGoal(friend.goal_count, friend.goal_unit, friend.goal_mode)}.${noteClause}`,
      })
      await supabase.from('friends').update({ reminder_notified_at: new Date().toISOString() }).eq('id', friend.id)
      notified++
    } else if (!overdue && friend.reminder_notified_at) {
      await supabase.from('friends').update({ reminder_notified_at: null }).eq('id', friend.id)
    }
  }
  return notified
}

Deno.serve(async (req: Request) => {
  const cronSecret = Deno.env.get('CRON_SECRET')
  if (!cronSecret || req.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return new Response(JSON.stringify({ error: 'UNAUTHORIZED' }), { status: 401 })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const appUrl = Deno.env.get('APP_URL')
  if (!supabaseUrl || !serviceRoleKey || !appUrl) {
    return new Response(JSON.stringify({ error: 'MISSING_CONFIG' }), { status: 500 })
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey)

  try {
    const [stockNotified, friendNotified] = await Promise.all([
      checkStockAlerts(supabase, appUrl),
      checkFriendReminders(supabase),
    ])
    return new Response(JSON.stringify({ stockNotified, friendNotified }), { status: 200 })
  } catch (err) {
    console.error('check-user-notifications: run failed', err)
    return new Response(JSON.stringify({ error: 'CHECK_FAILED' }), { status: 500 })
  }
})
