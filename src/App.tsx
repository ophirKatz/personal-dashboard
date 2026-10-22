import { Routes, Route, Navigate } from 'react-router-dom'
import { useEffect, useState, lazy, Suspense } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from './supabase'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Unlock from './pages/Unlock'
import { LockProvider } from './features/lock/LockProvider'
import LockGate from './features/lock/LockGate'
import { checkStockAlerts, checkCurrencyAlerts, checkFriendReminders } from './features/notifications/notifications'
import { syncPushSubscription } from './lib/push'
import { upsertPrimaryGoogleAccount } from './lib/googleAccounts'

// Lazy-loaded so their dependencies (recharts, pdfjs/react-pdf, etc.) stay out
// of the bundle needed for the initial Home Screen load.
const Habits = lazy(() => import('./pages/Habits'))
const Todos = lazy(() => import('./pages/Todos'))
const Climbing = lazy(() => import('./pages/Climbing'))
const Shopping = lazy(() => import('./pages/Shopping'))
const Calendar = lazy(() => import('./pages/Calendar'))
const Files = lazy(() => import('./pages/Files'))
const Converter = lazy(() => import('./pages/Converter'))
const Stocks = lazy(() => import('./pages/Stocks'))
const Wealth = lazy(() => import('./pages/Wealth'))
const Settings = lazy(() => import('./pages/Settings'))
const About = lazy(() => import('./pages/About'))
const Friends = lazy(() => import('./pages/Friends'))
const Recipes = lazy(() => import('./pages/Recipes'))
const Reading = lazy(() => import('./pages/Reading'))
const RuneScape = lazy(() => import('./pages/RuneScape'))
const QuestGuide = lazy(() => import('./pages/QuestGuide'))
const Archaeology = lazy(() => import('./pages/Archaeology'))
const Pvm = lazy(() => import('./pages/Pvm'))
const PvmBars = lazy(() => import('./pages/PvmBars'))
const RecipeDetail = lazy(() => import('./pages/RecipeDetail'))
const RecipeEditor = lazy(() => import('./pages/RecipeEditor'))
const MealIdeas = lazy(() => import('./pages/MealIdeas'))
const MealDetail = lazy(() => import('./pages/MealDetail'))
const Games = lazy(() => import('./pages/Games'))
const Workout = lazy(() => import('./pages/Workout'))
const DiceRoller = lazy(() => import('./pages/DiceRoller'))
const PdfTools = lazy(() => import('./pages/PdfTools'))

function PageFallback() {
  return (
    <div className="flex justify-center pt-20">
      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

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
      if (event === 'SIGNED_IN' && session?.provider_refresh_token && session.user?.email) {
        upsertPrimaryGoogleAccount({
          userId: session.user.id,
          email: session.user.email,
          refreshToken: session.provider_refresh_token,
          accessToken: session.provider_token ?? null,
        }).then()
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (user) {
      checkStockAlerts(user.id)
      checkCurrencyAlerts(user.id)
      checkFriendReminders(user.id)
      syncPushSubscription()
    }
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
    <LockProvider>
      <Suspense fallback={<PageFallback />}>
        <Routes>
          <Route element={<Layout />}>
            {/* The code screen sits outside the gate; every other page goes through it. */}
            <Route path="unlock" element={<Unlock />} />
            <Route element={<LockGate />}>
              <Route index element={<Dashboard />} />
              <Route path="habits" element={<Habits />} />
              <Route path="todos" element={<Todos />} />
              <Route path="climbing" element={<Climbing />} />
              <Route path="shopping" element={<Shopping />} />
              <Route path="calendar" element={<Calendar />} />
              <Route path="files" element={<Files />} />
              <Route path="converter" element={<Converter />} />
              <Route path="stocks" element={<Stocks />} />
              <Route path="wealth" element={<Wealth />} />
              {/* Finance was split into Converter + Stocks; keep old links working. */}
              <Route path="finance" element={<Navigate to="/converter" replace />} />
              <Route path="settings" element={<Settings />} />
              <Route path="about" element={<About />} />
              <Route path="friends" element={<Friends />} />
              <Route path="recipes" element={<Recipes />} />
              <Route path="reading" element={<Reading />} />
              <Route path="runescape" element={<RuneScape />} />
              <Route path="runescape/quests/:name" element={<QuestGuide />} />
              <Route path="runescape/archaeology" element={<Archaeology />} />
              <Route path="runescape/pvm" element={<Pvm />} />
              <Route path="runescape/pvm/bars" element={<PvmBars />} />
              <Route path="recipes/new" element={<RecipeEditor />} />
              <Route path="recipes/:id" element={<RecipeDetail />} />
              <Route path="recipes/:id/edit" element={<RecipeEditor />} />
              <Route path="meals" element={<MealIdeas />} />
              <Route path="meals/:id" element={<MealDetail />} />
              <Route path="workout" element={<Workout />} />
              <Route path="games" element={<Games />} />
              <Route path="pdf-tools" element={<PdfTools />} />
              <Route path="games/dice" element={<DiceRoller />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Route>
        </Routes>
      </Suspense>
    </LockProvider>
  )
}
