import { createClient, SupabaseClient } from 'npm:@supabase/supabase-js@2'

type HabitRow = { id: string; debt: number; debt_checked_date: string | null; created_at: string }

// Returns the current Asia/Jerusalem calendar date as YYYY-MM-DD, robust across
// DST (this app has a single user, based in Israel).
function israelDate(date: Date): string {
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem', year: 'numeric', month: '2-digit', day: '2-digit' })
  return fmt.format(date) // en-CA formats as YYYY-MM-DD
}

function dayBefore(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() - 1)
  return d.toISOString().slice(0, 10)
}

// Each daily habit accrues 1 unit of "debt" for every calendar day (Israel time)
// it wasn't logged. Debt is paid down 1-for-1 when the habit is later marked
// complete (see habit_logs.paid_debt / HabitCard.tsx). Idempotent per habit via
// debt_checked_date, since this runs on a recurring daily cron.
async function accrueDebt(supabase: SupabaseClient, checkDate: string): Promise<{ checked: number; accrued: number }> {
  const { data: habits } = await supabase
    .from('habits')
    .select('id, debt, debt_checked_date, created_at')
    .eq('frequency', 'daily')
  // Filtered in JS, not in the query — debt_checked_date is nullable and
  // PostgREST's .neq() silently drops NULL rows instead of matching them.
  const rows = ((habits ?? []) as HabitRow[]).filter(h => h.debt_checked_date !== checkDate)

  let accrued = 0
  for (const habit of rows) {
    const createdDate = habit.created_at.slice(0, 10)
    if (createdDate > checkDate) {
      await supabase.from('habits').update({ debt_checked_date: checkDate }).eq('id', habit.id)
      continue
    }

    const { data: log } = await supabase
      .from('habit_logs')
      .select('id')
      .eq('habit_id', habit.id)
      .eq('logged_date', checkDate)
      .maybeSingle()

    if (!log) {
      await supabase.from('habits').update({ debt: habit.debt + 1, debt_checked_date: checkDate }).eq('id', habit.id)
      accrued++
    } else {
      await supabase.from('habits').update({ debt_checked_date: checkDate }).eq('id', habit.id)
    }
  }

  return { checked: rows.length, accrued }
}

Deno.serve(async (req: Request) => {
  const cronSecret = Deno.env.get('CRON_SECRET')
  if (!cronSecret || req.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return new Response(JSON.stringify({ error: 'UNAUTHORIZED' }), { status: 401 })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(JSON.stringify({ error: 'MISSING_CONFIG' }), { status: 500 })
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey)
  const checkDate = dayBefore(israelDate(new Date()))
  const result = await accrueDebt(supabase, checkDate)
  return new Response(JSON.stringify({ checkDate, ...result }), { status: 200 })
})
