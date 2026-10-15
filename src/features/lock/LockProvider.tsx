import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import type { NavItemKey } from '../../lib/navItems'
import {
  DEFAULT_LOCKED_PAGES,
  DEFAULT_LOCK_CODE,
  NO_ATTEMPTS,
  attemptsLeft,
  formatCooldown,
  lockedKeyForPath,
  lockoutRemainingMs,
  pageKeyForPath,
  parseAttemptState,
  registerFailedAttempt,
  shouldRelockAfterHidden,
} from '../../lib/pageLock'
import type { AttemptState } from '../../lib/pageLock'
import { getLockSettings, setLockCode, setLockedPages } from '../../lib/userSettings'
import type { LockSettings } from '../../lib/userSettings'

const ATTEMPTS_KEY = 'pageLock.attempts'

// The wrong-code counter lives in localStorage so reloading the page doesn't
// hand out a fresh set of guesses.
function loadAttempts(): AttemptState {
  try {
    return parseAttemptState(localStorage.getItem(ATTEMPTS_KEY))
  } catch {
    return NO_ATTEMPTS
  }
}

function storeAttempts(state: AttemptState) {
  try {
    localStorage.setItem(ATTEMPTS_KEY, JSON.stringify(state))
  } catch {
    // storage unavailable: the counter just won't survive a reload
  }
}

export type CodeResult = { ok: true } | { ok: false; message: string }

type LockContextValue = {
  /** 'error' means the lock settings couldn't be read - lockable pages stay closed. */
  status: 'loading' | 'ready' | 'error'
  lockedPages: NavItemKey[]
  usingDefaultCode: boolean
  /** Epoch ms until which code entry is refused after too many wrong codes; 0 = not locked out. */
  lockedUntil: number
  /** Bumps whenever everything auto-locks (app was in the background), so screens holding an unlocked view can close it. */
  relockCount: number
  /** The locked page this path belongs to if it hasn't been unlocked yet, else null. */
  gatedKeyFor: (pathname: string) => NavItemKey | null
  /**
   * Checks a typed code. Passing `unlock` also opens that page when the code is
   * right, until you navigate away from it or leave the app for a while.
   */
  submitCode: (code: string, unlock?: NavItemKey) => CodeResult
  changeLockedPages: (pages: NavItemKey[]) => Promise<void>
  changeCode: (code: string) => Promise<void>
  retry: () => void
}

const LockContext = createContext<LockContextValue | null>(null)

export function useLock(): LockContextValue {
  const ctx = useContext(LockContext)
  if (!ctx) throw new Error('useLock must be used inside <LockProvider>')
  return ctx
}

/**
 * Holds the page-lock settings and which pages are currently unlocked. The
 * unlocked set lives in memory only: it clears on reload, when you leave the
 * page, and when the app has been in the background for a minute.
 */
export function LockProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [settings, setSettings] = useState<LockSettings>({ code: DEFAULT_LOCK_CODE, lockedPages: DEFAULT_LOCKED_PAGES })
  const [unlocked, setUnlocked] = useState<NavItemKey[]>([])
  const [relockCount, setRelockCount] = useState(0)
  const [attempts, setAttempts] = useState<AttemptState>(loadAttempts)
  const attemptsRef = useRef(attempts)
  const { pathname } = useLocation()

  const load = useCallback(() => {
    setStatus('loading')
    getLockSettings()
      .then(s => {
        setSettings(s)
        setStatus('ready')
      })
      .catch(() => setStatus('error'))
  }, [])

  useEffect(() => { load() }, [load])

  // Unlocking is per visit: leaving a page locks it again.
  useEffect(() => {
    const here = pageKeyForPath(pathname)
    setUnlocked(prev => (prev.every(k => k === here) ? prev : prev.filter(k => k === here)))
  }, [pathname])

  // An installed app can sit unlocked in someone's pocket; lock everything
  // once it's been in the background for a while.
  useEffect(() => {
    let hiddenAt: number | null = null
    function onVisibilityChange() {
      if (document.visibilityState === 'hidden') {
        hiddenAt = Date.now()
        return
      }
      if (shouldRelockAfterHidden(hiddenAt, Date.now())) {
        setUnlocked([])
        setRelockCount(n => n + 1)
      }
      hiddenAt = null
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => document.removeEventListener('visibilitychange', onVisibilityChange)
  }, [])

  const commitAttempts = useCallback((next: AttemptState) => {
    attemptsRef.current = next
    setAttempts(next)
    storeAttempts(next)
  }, [])

  const gatedKeyFor = useCallback(
    (path: string) => {
      const key = lockedKeyForPath(path, settings.lockedPages)
      return key && !unlocked.includes(key) ? key : null
    },
    [settings.lockedPages, unlocked],
  )

  const submitCode = useCallback(
    (code: string, unlock?: NavItemKey): CodeResult => {
      const now = Date.now()
      const current = attemptsRef.current
      const remaining = lockoutRemainingMs(current, now)
      if (remaining > 0) return { ok: false, message: `Too many wrong codes. Try again in ${formatCooldown(remaining)}.` }

      if (code === settings.code) {
        commitAttempts(NO_ATTEMPTS)
        if (unlock) setUnlocked(prev => (prev.includes(unlock) ? prev : [...prev, unlock]))
        return { ok: true }
      }

      const next = registerFailedAttempt(current, now)
      commitAttempts(next)
      const cooldown = lockoutRemainingMs(next, now)
      if (cooldown > 0) return { ok: false, message: `Too many wrong codes. Try again in ${formatCooldown(cooldown)}.` }
      const left = attemptsLeft(next)
      return { ok: false, message: `Wrong code. ${left} ${left === 1 ? 'try' : 'tries'} left.` }
    },
    [settings.code, commitAttempts],
  )

  const changeLockedPages = useCallback(
    async (pages: NavItemKey[]) => {
      const previous = settings.lockedPages
      setSettings(s => ({ ...s, lockedPages: pages }))
      try {
        await setLockedPages(pages)
      } catch (e) {
        setSettings(s => ({ ...s, lockedPages: previous }))
        throw e
      }
    },
    [settings.lockedPages],
  )

  const changeCode = useCallback(async (code: string) => {
    await setLockCode(code)
    setSettings(s => ({ ...s, code }))
  }, [])

  const value = useMemo<LockContextValue>(
    () => ({
      status,
      lockedPages: settings.lockedPages,
      usingDefaultCode: settings.code === DEFAULT_LOCK_CODE,
      lockedUntil: attempts.lockedUntil,
      relockCount,
      gatedKeyFor,
      submitCode,
      changeLockedPages,
      changeCode,
      retry: load,
    }),
    [status, settings, attempts.lockedUntil, relockCount, gatedKeyFor, submitCode, changeLockedPages, changeCode, load],
  )

  return <LockContext.Provider value={value}>{children}</LockContext.Provider>
}
