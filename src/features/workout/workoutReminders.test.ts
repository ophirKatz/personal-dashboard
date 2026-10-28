import { describe, expect, it } from 'vitest'
import { dueReminderSlot } from '../../../supabase/functions/_shared/workoutReminders'
import { timeInTZ } from '../../../supabase/functions/_shared/time'

const day = '2026-10-28'

describe('dueReminderSlot', () => {
  it('fires at the configured minute', () => {
    expect(dueReminderSlot(['18:00'], '18:00', day, null)).toBe(`${day} 18:00`)
  })

  it('does not fire before the time', () => {
    expect(dueReminderSlot(['18:00'], '17:59', day, null)).toBeNull()
  })

  it('still fires if a cron tick was late, within the grace window', () => {
    expect(dueReminderSlot(['18:00'], '18:07', day, null)).toBe(`${day} 18:00`)
  })

  it('does not replay an old slot after the grace window', () => {
    expect(dueReminderSlot(['18:00'], '18:31', day, null)).toBeNull()
  })

  it('fires each slot once', () => {
    expect(dueReminderSlot(['18:00'], '18:01', day, `${day} 18:00`)).toBeNull()
  })

  it('fires a later slot the same day after an earlier one was handled', () => {
    expect(dueReminderSlot(['18:00', '21:00'], '21:00', day, `${day} 18:00`)).toBe(`${day} 21:00`)
  })

  it('fires the same time again on a new day', () => {
    expect(dueReminderSlot(['18:00'], '18:00', day, '2026-10-27 18:00')).toBe(`${day} 18:00`)
  })

  it('sends one reminder when several times fall in the window', () => {
    expect(dueReminderSlot(['18:00', '18:20'], '18:25', day, null)).toBe(`${day} 18:20`)
  })

  it('accepts Postgres HH:MM:SS times and skips malformed ones', () => {
    expect(dueReminderSlot(['bogus', '18:00:00'], '18:00', day, null)).toBe(`${day} 18:00`)
  })

  it('does nothing without times', () => {
    expect(dueReminderSlot([], '18:00', day, null)).toBeNull()
  })
})

describe('timeInTZ', () => {
  it('reads wall-clock time in Israel, following daylight saving', () => {
    expect(timeInTZ('Asia/Jerusalem', new Date('2026-07-01T15:00:00Z'))).toBe('18:00') // UTC+3
    expect(timeInTZ('Asia/Jerusalem', new Date('2026-12-01T16:00:00Z'))).toBe('18:00') // UTC+2
  })

  it('uses 00:xx at midnight, not 24:xx', () => {
    expect(timeInTZ('Asia/Jerusalem', new Date('2026-12-01T22:05:00Z'))).toBe('00:05')
  })
})
