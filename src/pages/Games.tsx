import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../supabase'
import GameUtilityCard from '../features/games/GameUtilityCard'
import EditGameUtilityDrawer from '../features/games/EditGameUtilityDrawer'
import { fetchGameUtilities, resolveGameUtilities, type GameUtility } from '../features/games/utilities'

export default function Games() {
  const [user, setUser] = useState<User | null>(null)
  // Start from the built-in defaults so the grid renders immediately; user
  // overrides replace them once loaded.
  const [utilities, setUtilities] = useState<GameUtility[]>(() => resolveGameUtilities([]))
  const [editing, setEditing] = useState<GameUtility | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user))
  }, [])

  async function load() {
    setUtilities(await fetchGameUtilities())
  }

  useEffect(() => { load() }, [])

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Games</h1>
        <p className="text-sm text-muted-foreground">Tap to open · long press to edit</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {utilities.map(utility => (
          <GameUtilityCard key={utility.key} utility={utility} onEdit={() => setEditing(utility)} />
        ))}
      </div>

      <EditGameUtilityDrawer
        utility={editing}
        userId={user?.id ?? null}
        onClose={() => setEditing(null)}
        onSaved={load}
      />
    </div>
  )
}
