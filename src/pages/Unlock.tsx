import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import type { Location } from 'react-router-dom'
import { Lock } from 'lucide-react'
import { NAV_ITEMS } from '../lib/navItems'
import { pageKeyForPath } from '../lib/pageLock'
import { useLock } from '../features/lock/LockProvider'
import { LockError, LockSpinner } from '../features/lock/LockGate'
import PinPad from '../features/lock/PinPad'

// Where a locked page sends you to type the code. A correct code opens the page
// you asked for (passed along as `state.from` by LockGate).
export default function Unlock() {
  const lock = useLock()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: Location } | null)?.from
  const key = from ? pageKeyForPath(from.pathname) : null

  // Opened directly, or for a page that isn't lockable: nothing to unlock.
  const nothingToUnlock = !from || !key
  // Either the code was just accepted, or the page has since been unlocked in Settings.
  const open = !nothingToUnlock && lock.status === 'ready' && !lock.gatedKeyFor(from.pathname)

  useEffect(() => {
    if (nothingToUnlock) navigate('/', { replace: true })
    else if (open) navigate(`${from.pathname}${from.search}${from.hash}`, { replace: true })
  }, [nothingToUnlock, open, from, navigate])

  if (nothingToUnlock || open) return null
  if (lock.status === 'loading') return <LockSpinner />
  if (lock.status === 'error') return <LockError onRetry={lock.retry} />

  return (
    <div className="flex min-h-[75dvh] flex-col items-center justify-center p-4">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
        <Lock className="h-5 w-5 text-muted-foreground" />
      </div>
      <PinPad
        title="Enter your code"
        subtitle={`to open ${NAV_ITEMS[key].label}`}
        lockedUntil={lock.lockedUntil}
        onSubmit={code => lock.submitCode(code, key)}
        onCancel={() => navigate('/', { replace: true })}
        cancelLabel="Home"
      />
    </div>
  )
}
