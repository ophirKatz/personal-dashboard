import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'
import {
  Home, CheckSquare, TrendingUp, Mountain, MoreHorizontal,
  X, ShoppingCart, Bell, Calendar, Folder, LogOut, DollarSign, Settings,
} from 'lucide-react'
import { supabase } from '../supabase'
import { cn } from '../utils'

const primaryNav = [
  { to: '/', icon: Home, label: 'Home' },
  { to: '/todos', icon: CheckSquare, label: 'Tasks' },
  { to: '/calendar', icon: Calendar, label: 'Calendar' },
  { to: '/files', icon: Folder, label: 'Files' },
]

const moreNav = [
  { to: '/habits', icon: TrendingUp, label: 'Habits' },
  { to: '/climbing', icon: Mountain, label: 'Climbing' },
  { to: '/reminders', icon: Bell, label: 'Reminders' },
  { to: '/shopping', icon: ShoppingCart, label: 'Shopping' },
  { to: '/finance', icon: DollarSign, label: 'Finance' },
  { to: '/settings', icon: Settings, label: 'Settings' },
]

export default function Layout() {
  const [showMore, setShowMore] = useState(false)
  const navigate = useNavigate()
  const tabBarRef = useRef<HTMLElement>(null)

  // The FAB needs to float above this bar, so publish its real measured
  // height (incl. safe-area inset) as a CSS var instead of hardcoding a
  // pixel guess that drifts out of sync whenever this bar's layout changes.
  useEffect(() => {
    const tabBar = tabBarRef.current
    if (!tabBar) return
    const updateHeight = () => {
      document.documentElement.style.setProperty('--tabbar-height', `${tabBar.offsetHeight}px`)
    }
    updateHeight()
    const observer = new ResizeObserver(updateHeight)
    observer.observe(tabBar)
    return () => observer.disconnect()
  }, [])

  async function handleSignOut() {
    await supabase.auth.signOut()
  }

  return (
    <div className="flex h-dvh overflow-hidden bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-52 border-r border-border shrink-0 p-3 gap-1">
        <div className="flex items-center gap-2 px-3 py-3 mb-2">
          <Mountain className="h-5 w-5 text-primary" />
          <span className="font-semibold">Dashboard</span>
        </div>
        {[...primaryNav, ...moreNav].map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground font-medium'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground',
              )
            }
          >
            <Icon className="h-4 w-4 shrink-0" />
            {label}
          </NavLink>
        ))}
        <div className="mt-auto">
          <button
            onClick={handleSignOut}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm w-full text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <div className="pb-24 md:pb-6">
          <Outlet />
        </div>
      </main>

      {/* Mobile bottom nav */}
      <nav
        ref={tabBarRef}
        className="md:hidden fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur border-t border-border flex items-center justify-around px-1 pt-1 pb-safe z-40"
      >
        {primaryNav.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              cn(
                'flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl min-w-[60px] transition-colors',
                isActive ? 'text-primary' : 'text-muted-foreground',
              )
            }
          >
            <Icon className="h-5 w-5" />
            <span className="text-[10px] font-medium">{label}</span>
          </NavLink>
        ))}
        <button
          onClick={() => setShowMore(true)}
          className="flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl min-w-[60px] text-muted-foreground"
        >
          <MoreHorizontal className="h-5 w-5" />
          <span className="text-[10px] font-medium">More</span>
        </button>
      </nav>

      {/* More drawer overlay */}
      {showMore && (
        <div className="md:hidden fixed inset-0 z-50 bg-background flex flex-col">
          <div className="flex items-center justify-between px-4 py-4 border-b border-border">
            <span className="font-semibold text-lg">More</span>
            <button
              onClick={() => setShowMore(false)}
              className="p-2 rounded-lg hover:bg-accent"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-1">
            {moreNav.map(({ to, icon: Icon, label }) => (
              <button
                key={to}
                onClick={() => { navigate(to); setShowMore(false) }}
                className="flex items-center gap-4 w-full px-4 py-4 rounded-xl hover:bg-accent text-left transition-colors"
              >
                <Icon className="h-5 w-5 text-muted-foreground" />
                <span className="font-medium">{label}</span>
              </button>
            ))}
          </div>
          <div className="border-t border-border p-4">
            <button
              onClick={handleSignOut}
              className="flex items-center gap-4 w-full px-4 py-4 rounded-xl hover:bg-accent text-left text-muted-foreground transition-colors"
            >
              <LogOut className="h-5 w-5" />
              <span>Sign out</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
