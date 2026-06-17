import { useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import { supabase } from '../supabase'
import type { Habit, HabitLog } from '../supabase'
import type { User } from '@supabase/supabase-js'
import HabitCard from '../features/habits/HabitCard'
import HabitForm from '../features/habits/HabitForm'
import { Button } from '../components/ui/button'

export default function Habits() {
  const [user, setUser] = useState<User | null>(null)
  const [habits, setHabits] = useState<Habit[]>([])
  const [logs, setLogs] = useState<HabitLog[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editingHabit, setEditingHabit] = useState<Habit | undefined>()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user))
  }, [])

  async function load() {
    const [habitsRes, logsRes] = await Promise.all([
      supabase.from('habits').select('*').order('created_at'),
      supabase.from('habit_logs').select('*').gte('logged_date', new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]),
    ])
    setHabits(habitsRes.data ?? [])
    setLogs(logsRes.data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function deleteHabit(id: string) {
    if (!confirm('Delete this habit and all its logs?')) return
    await supabase.from('habits').delete().eq('id', id)
    load()
  }

  function logsForHabit(habitId: string) {
    return logs.filter(l => l.habit_id === habitId)
  }

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Habits</h1>
          <p className="text-sm text-muted-foreground">{habits.length} habit{habits.length !== 1 ? 's' : ''} tracked</p>
        </div>
        <Button onClick={() => { setEditingHabit(undefined); setShowForm(true) }} size="icon" className="rounded-xl h-11 w-11">
          <Plus className="h-5 w-5" />
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : habits.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <div className="text-4xl mb-3">🌱</div>
          <p className="font-medium">No habits yet</p>
          <p className="text-sm mt-1">Tap + to create your first habit</p>
        </div>
      ) : (
        <div className="space-y-3">
          {habits.map(habit => (
            <HabitCard
              key={habit.id}
              habit={habit}
              logs={logsForHabit(habit.id)}
              onEdit={() => { setEditingHabit(habit); setShowForm(true) }}
              onDelete={() => deleteHabit(habit.id)}
              onLogChange={load}
            />
          ))}
        </div>
      )}

      {user && showForm && (
        <HabitForm
          open={showForm}
          onClose={() => setShowForm(false)}
          onSave={load}
          habit={editingHabit}
          userId={user.id}
        />
      )}
    </div>
  )
}
