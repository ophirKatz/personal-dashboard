import { describe, expect, it, vi } from 'vitest'

vi.mock('../../supabase', () => ({ supabase: { from: vi.fn() } }))

const { isClimbingSessionTitle, pickNextClimbingSession, nextSessionLabel } = await import('./nextClimbingSession')

type Ev = Parameters<typeof pickNextClimbingSession>[0][number]

function ev(title: string, date: string, time: string | null, endTime: string | null = null): Ev {
  return { title, event_date: date, event_time: time, event_end_date: endTime ? date : null, event_end_time: endTime }
}

// Thursday, local time
const NOW = new Date('2026-10-15T12:00:00')

describe('isClimbingSessionTitle', () => {
  it('matches the training and climbing keywords anywhere in the title', () => {
    expect(isClimbingSessionTitle('טיפוס')).toBe(true)
    expect(isClimbingSessionTitle('אימון בוקר')).toBe(true)
    expect(isClimbingSessionTitle('קבוצת טיפוס בקיר')).toBe(true)
  })

  it('ignores other events', () => {
    expect(isClimbingSessionTitle('Dentist')).toBe(false)
    expect(isClimbingSessionTitle('climbing')).toBe(false)
  })
})

describe('pickNextClimbingSession', () => {
  it('returns null when nothing matches', () => {
    expect(pickNextClimbingSession([ev('Dentist', '2026-10-16', '10:00:00', '11:00:00')], NOW)).toBeNull()
    expect(pickNextClimbingSession([], NOW)).toBeNull()
  })

  it('picks the soonest matching session regardless of input order', () => {
    const later = ev('טיפוס', '2026-10-20', '18:00:00', '19:30:00')
    const sooner = ev('אימון', '2026-10-17', '18:00:00', '19:30:00')
    const other = ev('Dentist', '2026-10-16', '10:00:00', '11:00:00')
    expect(pickNextClimbingSession([later, other, sooner], NOW)).toBe(sooner)
  })

  it('skips a session earlier today that already ended', () => {
    const ended = ev('טיפוס', '2026-10-15', '08:00:00', '09:30:00')
    const tomorrow = ev('טיפוס', '2026-10-16', '18:00:00', '19:30:00')
    expect(pickNextClimbingSession([ended, tomorrow], NOW)).toBe(tomorrow)
  })

  it('keeps a session that is in progress or later today', () => {
    const inProgress = ev('טיפוס', '2026-10-15', '11:30:00', '13:00:00')
    const evening = ev('אימון', '2026-10-15', '19:00:00', '20:30:00')
    expect(pickNextClimbingSession([evening, inProgress], NOW)).toBe(inProgress)
    expect(pickNextClimbingSession([evening], NOW)).toBe(evening)
  })

  it('treats an all-day event as upcoming through its date, after timed ones the same day', () => {
    const allDay = ev('טיפוס', '2026-10-15', null)
    const evening = ev('טיפוס', '2026-10-15', '19:00:00', '20:00:00')
    expect(pickNextClimbingSession([allDay], NOW)).toBe(allDay)
    expect(pickNextClimbingSession([allDay, evening], NOW)).toBe(evening)
  })
})

describe('nextSessionLabel', () => {
  it('says so when there is no session', () => {
    expect(nextSessionLabel(null, NOW)).toBe('No session scheduled')
  })

  it('uses Today / Tomorrow, then weekday within a week, then date', () => {
    expect(nextSessionLabel(ev('טיפוס', '2026-10-15', '18:00:00'), NOW)).toBe('Today · 6:00 PM')
    expect(nextSessionLabel(ev('טיפוס', '2026-10-16', '07:30:00'), NOW)).toBe('Tomorrow · 7:30 AM')
    expect(nextSessionLabel(ev('טיפוס', '2026-10-18', '18:00:00'), NOW)).toBe('Sun · 6:00 PM')
    expect(nextSessionLabel(ev('טיפוס', '2026-10-21', '18:00:00'), NOW)).toBe('Wed · 6:00 PM')
    expect(nextSessionLabel(ev('טיפוס', '2026-10-22', '18:00:00'), NOW)).toBe('Oct 22 · 6:00 PM')
  })

  it('labels all-day events', () => {
    expect(nextSessionLabel(ev('טיפוס', '2026-10-16', null), NOW)).toBe('Tomorrow · All day')
  })
})
