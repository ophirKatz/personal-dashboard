import { createClient, SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { todayInTZ, addDaysUTC } from '../_shared/time.ts'

type HabitRow = {
  id: string
  debt: number
  debt_checked_date: string | null
  created_at: string
  frequency: 'daily' | 'weekly'
  times_per_week: number | null
}

function dayBefore(dateStr: string): string {
  return addDaysUTC(dateStr, -1)
}

function daysBetween(fromDateStr: string, toDateStr: string): number {
  const from = new Date(`${fromDateStr}T00:00:00Z`).getTime()
  const to = new Date(`${toDateStr}T00:00:00Z`).getTime()
  return Math.round((to - from) / 86_400_000)
}

// Daily habits use a 1-day period (debt accrues per missed day). Weekly
// habits use a period of floor(7 / times_per_week) days — e.g. "2x/week" is
// one missed occurrence per 3-day window — so debt increments once per
// missed period instead of once per missed day. Mirrors isHabitDueToday in
// src/utils.ts so debt and the "due today" UI never disagree about which
// period is current.
function periodLengthDays(habit: HabitRow): number {
  if (habit.frequency === 'daily') return 1
  return Math.max(1, Math.floor(7 / (habit.times_per_week ?? 1)))
}

// Each habit accrues 1 unit of "debt" for every period (Asia/Jerusalem
// calendar days) it wasn't logged at least once. Debt is paid down 1-for-1
// when the habit is later marked complete (see habit_logs.paid_debt /
// HabitCard.tsx). Idempotent per habit via debt_checked_date, since this
// runs on a recurring daily cron — periods that haven't ended yet on
// checkDate are simply skipped until the cron run where they do.
async function accrueDebt(supabase: SupabaseClient, checkDate: string): Promise<{ checked: number; accrued: number }> {
  const { data: habits } = await supabase
    .from('habits')
    .select('id, debt, debt_checked_date, created_at, frequency, times_per_week')
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

    const periodLength = periodLengthDays(habit)
    const daysSinceCreation = daysBetween(createdDate, checkDate)
    const isPeriodEnd = (daysSinceCreation + 1) % periodLength === 0
    if (!isPeriodEnd) {
      await supabase.from('habits').update({ debt_checked_date: checkDate }).eq('id', habit.id)
      continue
    }

    const periodStart = addDaysUTC(checkDate, -(periodLength - 1))
    const { data: log } = await supabase
      .from('habit_logs')
      .select('id')
      .eq('habit_id', habit.id)
      .gte('logged_date', periodStart)
      .lte('logged_date', checkDate)
      .limit(1)
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
  const checkDate = dayBefore(todayInTZ())

  try {
    const result = await accrueDebt(supabase, checkDate)
    return new Response(JSON.stringify({ checkDate, ...result }), { status: 200 })
  } catch (err) {
    console.error('accrue-habit-debt: failed for checkDate', checkDate, err)
    return new Response(JSON.stringify({ error: 'ACCRUE_FAILED' }), { status: 500 })
  }
})
