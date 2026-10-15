import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { ShieldAlert } from 'lucide-react'
import { UNLOCK_PATH, pageKeyForPath } from '../../lib/pageLock'
import { Button } from '../../components/ui/button'
import { useLock } from './LockProvider'

export function LockSpinner() {
  return (
    <div className="flex justify-center pt-20">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  )
}

export function LockError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="mx-auto max-w-xs space-y-3 px-4 pt-20 text-center">
      <ShieldAlert className="mx-auto h-10 w-10 text-muted-foreground" />
      <p className="font-medium">Couldn't check the page lock</p>
      <p className="text-sm text-muted-foreground">This page stays closed until the lock settings load.</p>
      <Button onClick={onRetry} variant="outline" className="rounded-xl">Try again</Button>
    </div>
  )
}

/**
 * Layout route that wraps every page. A locked page that hasn't been unlocked
 * redirects to the code screen instead of rendering - so its component (and
 * its data fetching) never mounts. Pages that can't be locked (Home, Settings)
 * render immediately, without waiting on the lock settings.
 */
export default function LockGate() {
  const lock = useLock()
  const location = useLocation()

  if (pageKeyForPath(location.pathname) === null) return <Outlet />

  // Fail closed: until we know which pages are locked, none of the lockable ones open.
  if (lock.status === 'loading') return <LockSpinner />
  if (lock.status === 'error') return <LockError onRetry={lock.retry} />

  if (lock.gatedKeyFor(location.pathname)) {
    return <Navigate to={UNLOCK_PATH} replace state={{ from: location }} />
  }
  return <Outlet />
}
