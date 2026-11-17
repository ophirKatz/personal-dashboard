import { describe, expect, it, vi } from 'vitest'

vi.mock('../../supabase', () => ({ supabase: { from: vi.fn() } }))

const { isClimbLogPending } = await import('./climbLogPending')
const { latestEndedSessionDate } = await import('../../../supabase/functions/_shared/climbingSessions')

describe('isClimbLogPending', () => {
  it('is off until a session has ended', () => {
    expect(isClimbLogPending(null, null)).toBe(false)
    expect(isClimbLogPending(null, '2026-11-10')).toBe(false)
  })

  it('is on when a session ended and nothing has ever been logged', () => {
    expect(isClimbLogPending('2026-11-16', null)).toBe(true)
  })

  it('stays on while the latest log is older than the ended session', () => {
    expect(isClimbLogPending('2026-11-16', '2026-11-12')).toBe(true)
  })

  it('is dismissed by a log on the day of the session or any day after', () => {
    expect(isClimbLogPending('2026-11-16', '2026-11-16')).toBe(false)
    expect(isClimbLogPending('2026-11-16', '2026-11-17')).toBe(false)
  })

  it('comes back when a later session ends after the last log', () => {
    expect(isClimbLogPending('2026-11-16', '2026-11-16')).toBe(false)
    expect(isClimbLogPending('2026-11-19', '2026-11-16')).toBe(true)
  })
})

describe('latestEndedSessionDate', () => {
  const session = (date: string, time: string | null, endTime: string | null, endDate: string | null = date) => ({
    eventDate: date, eventTime: time, eventEndDate: endDate, eventEndTime: endTime,
  })
  const TODAY = '2026-11-17'

  it('is null with no sessions or none finished', () => {
    expect(latestEndedSessionDate([], TODAY, '20:00')).toBeNull()
    expect(latestEndedSessionDate([session('2026-11-17', '18:00:00', '19:30:00')], TODAY, '19:00')).toBeNull()
    expect(latestEndedSessionDate([session('2026-11-18', '18:00:00', '19:30:00')], TODAY, '23:59')).toBeNull()
  })

  it('counts a session from the minute it ends', () => {
    const s = [session('2026-11-17', '18:00:00', '19:30:00')]
    expect(latestEndedSessionDate(s, TODAY, '19:29')).toBeNull()
    expect(latestEndedSessionDate(s, TODAY, '19:30')).toBe('2026-11-17')
  })

  it('counts an earlier day regardless of the time of day', () => {
    expect(latestEndedSessionDate([session('2026-11-16', '18:00:00', '19:30:00')], TODAY, '00:05')).toBe('2026-11-16')
  })

  it('picks the latest finished session and ignores upcoming ones', () => {
    const s = [
      session('2026-11-12', '18:00:00', '19:30:00'),
      session('2026-11-16', '18:00:00', '19:30:00'),
      session('2026-11-20', '18:00:00', '19:30:00'),
    ]
    expect(latestEndedSessionDate(s, TODAY, '12:00')).toBe('2026-11-16')
  })

  it('treats a session that runs past midnight as over only after its end date/time', () => {
    const overnight = [session('2026-11-16', '23:00:00', '00:30:00', '2026-11-17')]
    expect(latestEndedSessionDate(overnight, TODAY, '00:10')).toBeNull()
    expect(latestEndedSessionDate(overnight, TODAY, '00:30')).toBe('2026-11-16')
  })

  it('treats an all-day event as over once its date has passed', () => {
    expect(latestEndedSessionDate([session('2026-11-17', null, null, '2026-11-18')], TODAY, '23:59')).toBeNull()
    expect(latestEndedSessionDate([session('2026-11-16', null, null, '2026-11-17')], TODAY, '08:00')).toBe('2026-11-16')
  })
})
