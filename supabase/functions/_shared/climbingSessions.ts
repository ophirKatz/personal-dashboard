// Event times from the calendar sync are plain wall-clock strings in the app timezone, so "has it
// ended" is a string comparison against the current wall clock (todayInTZ / timeInTZ) with no
// offset maths. Mirrors hasEnded in src/features/climbing/nextClimbingSession.ts.
export type SessionTimes = {
  eventDate: string
  eventTime: string | null
  eventEndDate: string | null
  eventEndTime: string | null
}

function hasEnded(s: SessionTimes, todayStr: string, nowTime: string): boolean {
  // All-day events have no time of day, so they count as over once their date is past.
  if (!s.eventTime) return s.eventDate < todayStr
  const endDate = s.eventEndDate ?? s.eventDate
  const endTime = (s.eventEndTime ?? s.eventTime).slice(0, 5)
  return endDate < todayStr || (endDate === todayStr && endTime <= nowTime)
}

/**
 * The date of the latest session that has finished, or null if none has. Dated by when the session
 * started, so a log made any time after it began counts as logging that session.
 * `nowTime` is "HH:MM" in the app timezone.
 */
export function latestEndedSessionDate(sessions: readonly SessionTimes[], todayStr: string, nowTime: string): string | null {
  let latest: string | null = null
  for (const s of sessions) {
    if (hasEnded(s, todayStr, nowTime) && (latest === null || s.eventDate > latest)) latest = s.eventDate
  }
  return latest
}
