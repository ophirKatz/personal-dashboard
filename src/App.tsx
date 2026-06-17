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

export default function App() {
  const [user, setUser] = useState<User | null | undefined>(undefined)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

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
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
