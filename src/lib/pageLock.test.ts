import { describe, it, expect } from 'vitest'
import {
  AUTO_LOCK_AFTER_HIDDEN_MS,
  ATTEMPTS_PER_ROUND,
  DEFAULT_LOCKED_PAGES,
  DEFAULT_LOCK_CODE,
  NO_ATTEMPTS,
  attemptsLeft,
  formatCooldown,
  isValidCode,
  lockedKeyForPath,
  lockoutRemainingMs,
  normalizeLockCode,
  normalizeLockedPages,
  normalizePath,
  pageKeyForPath,
  parseAttemptState,
  registerFailedAttempt,
  shouldRelockAfterHidden,
} from './pageLock'
import type { AttemptState } from './pageLock'

describe('codes', () => {
  it('accepts exactly four digits', () => {
    expect(isValidCode('0000')).toBe(true)
    expect(isValidCode('1234')).toBe(true)
    expect(isValidCode('123')).toBe(false)
    expect(isValidCode('12345')).toBe(false)
    expect(isValidCode('12a4')).toBe(false)
    expect(isValidCode('１２３４')).toBe(false) // full-width digits
    expect(isValidCode('')).toBe(false)
    expect(isValidCode(1234)).toBe(false)
    expect(isValidCode(null)).toBe(false)
  })

  it('falls back to the default for a missing or malformed stored code', () => {
    expect(normalizeLockCode('4821')).toBe('4821')
    expect(normalizeLockCode(null)).toBe(DEFAULT_LOCK_CODE)
    expect(normalizeLockCode('abcd')).toBe(DEFAULT_LOCK_CODE)
  })
})

describe('locked pages setting', () => {
  it('keeps known keys in canonical order, de-duplicated', () => {
    expect(normalizeLockedPages(['wealth', 'todos', 'wealth'])).toEqual(['todos', 'wealth'])
  })

  it('drops unknown keys and non-strings', () => {
    expect(normalizeLockedPages(['wealth', 'bogus', 5, null])).toEqual(['wealth'])
  })

  it('treats an explicitly empty list as "nothing locked", but a missing value as the default', () => {
    expect(normalizeLockedPages([])).toEqual([])
    expect(normalizeLockedPages(null)).toEqual(DEFAULT_LOCKED_PAGES)
    expect(normalizeLockedPages(undefined)).toEqual(DEFAULT_LOCKED_PAGES)
  })

  it('locks Wealth out of the box', () => {
    expect(DEFAULT_LOCKED_PAGES).toEqual(['wealth'])
  })
})

describe('path matching', () => {
  it('maps a path to its page, including nested routes', () => {
    expect(pageKeyForPath('/wealth')).toBe('wealth')
    expect(pageKeyForPath('/recipes')).toBe('recipes')
    expect(pageKeyForPath('/recipes/abc-123/edit')).toBe('recipes')
    expect(pageKeyForPath('/runescape/quests/Dragon%20Slayer')).toBe('runescape')
    expect(pageKeyForPath('/games/dice')).toBe('games')
    expect(pageKeyForPath('/pdf-tools')).toBe('pdf')
  })

  it('does not match unrelated pages that merely share a prefix', () => {
    expect(pageKeyForPath('/wealthy')).toBeNull()
    expect(pageKeyForPath('/gamesx')).toBeNull()
    expect(pageKeyForPath('/meal')).toBeNull()
  })

  it('leaves Home, Settings, About and the unlock page alone', () => {
    expect(pageKeyForPath('/')).toBeNull()
    expect(pageKeyForPath('/settings')).toBeNull()
    expect(pageKeyForPath('/about')).toBeNull()
    expect(pageKeyForPath('/unlock')).toBeNull()
  })

  it('cannot be bypassed with URL variants the router also accepts', () => {
    for (const variant of ['/WEALTH', '/Wealth', '/wealth/', '//wealth', '/wealth//', '/%77ealth', '/%57EALTH', '/wealth/%2e']) {
      expect(pageKeyForPath(variant), variant).toBe('wealth')
    }
  })

  it('survives a malformed escape sequence', () => {
    expect(pageKeyForPath('/wealth/%E0%A4%A')).toBe('wealth')
    expect(normalizePath('/%zz')).toBe('/%zz')
  })

  it('reports a page as locked only when it is in the locked list', () => {
    expect(lockedKeyForPath('/wealth', ['wealth'])).toBe('wealth')
    expect(lockedKeyForPath('/WEALTH/', ['wealth'])).toBe('wealth')
    expect(lockedKeyForPath('/wealth', [])).toBeNull()
    expect(lockedKeyForPath('/stocks', ['wealth'])).toBeNull()
    expect(lockedKeyForPath('/', ['wealth'])).toBeNull()
  })

  it('normalizes paths', () => {
    expect(normalizePath('/')).toBe('/')
    expect(normalizePath('/Wealth/')).toBe('/wealth')
    expect(normalizePath('//a///b')).toBe('/a/b')
  })
})

describe('wrong-code lockout', () => {
  const t0 = 1_000_000

  it('counts down attempts within a round without locking', () => {
    let s: AttemptState = NO_ATTEMPTS
    expect(attemptsLeft(s)).toBe(ATTEMPTS_PER_ROUND)
    s = registerFailedAttempt(s, t0)
    expect(s).toEqual({ failures: 1, lockedUntil: 0 })
    expect(attemptsLeft(s)).toBe(4)
    expect(lockoutRemainingMs(s, t0)).toBe(0)
  })

  it('starts a 30s cooldown on the 5th wrong code', () => {
    let s: AttemptState = NO_ATTEMPTS
    for (let i = 0; i < 5; i++) s = registerFailedAttempt(s, t0)
    expect(s.failures).toBe(5)
    expect(lockoutRemainingMs(s, t0)).toBe(30_000)
    expect(lockoutRemainingMs(s, t0 + 10_000)).toBe(20_000)
    expect(lockoutRemainingMs(s, t0 + 30_000)).toBe(0)
    expect(attemptsLeft(s)).toBe(5) // a fresh round of 5 after the cooldown
  })

  it('doubles the cooldown each round, capped at 10 minutes', () => {
    let s: AttemptState = NO_ATTEMPTS
    const cooldowns: number[] = []
    for (let i = 1; i <= 40; i++) {
      s = registerFailedAttempt(s, t0)
      if (i % 5 === 0) cooldowns.push(lockoutRemainingMs(s, t0))
    }
    expect(cooldowns.slice(0, 5)).toEqual([30_000, 60_000, 120_000, 240_000, 480_000])
    expect(cooldowns.slice(5)).toEqual([600_000, 600_000, 600_000])
  })

  it('keeps an active cooldown while counting further failures', () => {
    const locked: AttemptState = { failures: 5, lockedUntil: t0 + 30_000 }
    expect(registerFailedAttempt(locked, t0 + 1_000)).toEqual({ failures: 6, lockedUntil: t0 + 30_000 })
  })

  it('parses stored state defensively', () => {
    expect(parseAttemptState(null)).toEqual(NO_ATTEMPTS)
    expect(parseAttemptState('not json')).toEqual(NO_ATTEMPTS)
    expect(parseAttemptState('{"failures":3,"lockedUntil":99}')).toEqual({ failures: 3, lockedUntil: 99 })
    expect(parseAttemptState('{"failures":-1,"lockedUntil":0}')).toEqual(NO_ATTEMPTS)
    expect(parseAttemptState('{"failures":"x"}')).toEqual(NO_ATTEMPTS)
    expect(parseAttemptState('{"failures":1.5,"lockedUntil":0}')).toEqual(NO_ATTEMPTS)
  })

  it('formats the remaining time', () => {
    expect(formatCooldown(1)).toBe('1s')
    expect(formatCooldown(29_100)).toBe('30s')
    expect(formatCooldown(60_000)).toBe('1m')
    expect(formatCooldown(125_000)).toBe('2m 5s')
  })
})

describe('auto re-lock', () => {
  it('re-locks after the app was hidden long enough, not for a quick app switch', () => {
    expect(shouldRelockAfterHidden(null, 1000)).toBe(false)
    expect(shouldRelockAfterHidden(1000, 1000 + AUTO_LOCK_AFTER_HIDDEN_MS - 1)).toBe(false)
    expect(shouldRelockAfterHidden(1000, 1000 + AUTO_LOCK_AFTER_HIDDEN_MS)).toBe(true)
  })
})
