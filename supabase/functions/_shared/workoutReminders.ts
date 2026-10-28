// How far past a reminder time it can still fire. Wide enough to ride out a delayed cron tick,
// narrow enough that saving a settings change late in the day doesn't replay an old slot.
export const REMINDER_GRACE_MINUTES = 30

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/

function minutes(hhmm: string): number {
  return Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5))
}

/**
 * The reminder slot ("YYYY-MM-DD HH:MM") that should fire now, or null.
 *
 * A slot is due once its time has passed (within the grace window) and it hasn't been handled yet,
 * judged by `lastSlot`. If several times are in the window only the latest fires, so a user never
 * gets two pushes for one cron tick. `times` may be Postgres `HH:MM:SS` strings.
 */
export function dueReminderSlot(
  times: readonly string[],
  nowTime: string,
  todayStr: string,
  lastSlot: string | null,
  graceMinutes = REMINDER_GRACE_MINUTES,
): string | null {
  const now = minutes(nowTime)
  let latest: string | null = null
  for (const raw of times) {
    const t = raw.slice(0, 5)
    if (!HHMM.test(t)) continue
    const age = now - minutes(t)
    if (age < 0 || age > graceMinutes) continue
    if (latest === null || t > latest) latest = t
  }
  if (latest === null) return null
  const slot = `${todayStr} ${latest}`
  return lastSlot !== null && lastSlot >= slot ? null : slot
}
