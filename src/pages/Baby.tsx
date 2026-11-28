import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../supabase'
import BabySetup from '../features/baby/BabySetup'
import BabyTracker from '../features/baby/BabyTracker'
import { loadMyBabies, type MyBaby } from '../features/baby/babyApi'
import type { Baby as BabyRecord } from '../features/baby/babyEvents'
import { ageLabel } from '../features/baby/babyEvents'

type State =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; userId: string; suggestedName: string; babies: MyBaby[] }

// The signed-in person's first name from their Google profile, to save typing it.
function firstName(meta: Record<string, unknown> | undefined): string {
  const full = meta?.full_name ?? meta?.name
  return typeof full === 'string' ? (full.trim().split(/\s+/)[0] ?? '') : ''
}

export default function Baby() {
  const [state, setState] = useState<State>({ status: 'loading' })

  const load = useCallback(async () => {
    try {
      const { data, error } = await supabase.auth.getUser()
      if (error || !data.user) throw error ?? new Error('Not signed in')
      const babies = await loadMyBabies(data.user.id)
      setState({ status: 'ready', userId: data.user.id, suggestedName: firstName(data.user.user_metadata), babies })
    } catch {
      setState({ status: 'error' })
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const current = state.status === 'ready' ? state.babies[0] : undefined

  function handleBabyChanged(baby: BabyRecord) {
    setState(s => (s.status === 'ready' ? { ...s, babies: s.babies.map(b => (b.baby.id === baby.id ? { ...b, baby } : b)) } : s))
  }

  return (
    <div className="mx-auto max-w-2xl p-4">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">{current ? current.baby.name : 'Baby'}</h1>
        <p className="text-sm text-muted-foreground">
          {current ? (ageLabel(current.baby.birth_date, new Date()) ?? 'Feeds, diapers and sleep, shared with your partner') : 'Feeds, diapers and sleep, shared with your partner'}
        </p>
      </div>

      {state.status === 'loading' && (
        <div className="flex justify-center pt-16">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      )}

      {state.status === 'error' && (
        <div className="mx-auto max-w-xs space-y-3 pt-16 text-center">
          <p className="font-medium">Couldn't load the baby tracker</p>
          <button type="button" onClick={load} className="rounded-xl border border-border px-4 py-2 text-sm font-medium hover:bg-accent">
            Try again
          </button>
        </div>
      )}

      {state.status === 'ready' && !current && <BabySetup suggestedName={state.suggestedName} onCreated={load} />}

      {state.status === 'ready' && current && (
        <BabyTracker key={current.baby.id} me={current} userId={state.userId} onBabyChanged={handleBabyChanged} onLeft={load} />
      )}
    </div>
  )
}
