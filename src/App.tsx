import { Routes, Route, Navigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from './supabase'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Habits from './pages/Habits'
import Todos from './pages/Todos'
import Reminders from './pages/Reminders'
import Climbing from './pages/Climbing'
import Shopping from './pages/Shopping'
import Calendar from './pages/Calendar'
import Files from './pages/Files'
import Finance from './pages/Finance'
import { checkStockAlerts } from './features/notifications/notifications'

export default function App() {
  const [user, setUser] = useState<User | null | undefined>(undefined)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null)
      // provider_refresh_token is only present right after the OAuth redirect,
      // never on later session reads, so it must be persisted here.
      if (event === 'SIGNED_IN' && session?.provider_refresh_token && session.user) {
        supabase.from('google_oauth_tokens').upsert({
          user_id: session.user.id,
          refresh_token: session.provider_refresh_token,
          access_token: session.provider_token ?? null,
          access_token_expires_at: new Date(Date.now() + 3500 * 1000).toISOString(),
          updated_at: new Date().toISOString(),
        }).then()
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (user) checkStockAlerts(user.id)
  }, [user])

  if (user === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!user) return <Login />

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="habits" element={<Habits />} />
        <Route path="todos" element={<Todos />} />
        <Route path="reminders" element={<Reminders />} />
        <Route path="climbing" element={<Climbing />} />
        <Route path="shopping" element={<Shopping />} />
        <Route path="calendar" element={<Calendar />} />
        <Route path="files" element={<Files />} />
        <Route path="finance" element={<Finance />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
