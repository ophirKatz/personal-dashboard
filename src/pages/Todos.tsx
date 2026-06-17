import { useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import { supabase } from '../supabase'
import type { Todo } from '../supabase'
import type { User } from '@supabase/supabase-js'
import TodoItem from '../features/todos/TodoItem'
import TodoForm from '../features/todos/TodoForm'
import { Button } from '../components/ui/button'
import { today } from '../utils'

type Filter = 'today' | 'upcoming' | 'all' | 'completed'

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'all', label: 'All' },
  { key: 'completed', label: 'Done' },
]

export default function Todos() {
  const [user, setUser] = useState<User | null>(null)
  const [todos, setTodos] = useState<Todo[]>([])
  const [filter, setFilter] = useState<Filter>('today')
  const [showForm, setShowForm] = useState(false)
  const [editingTodo, setEditingTodo] = useState<Todo | undefined>()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user))
  }, [])

  async function load() {
    const { data } = await supabase.from('todos').select('*').order('created_at', { ascending: false })
    setTodos(data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function deleteTodo(id: string) {
    await supabase.from('todos').delete().eq('id', id)
    load()
  }

  const t = today()
  const filtered = todos.filter(todo => {
    if (filter === 'completed') return todo.completed
    if (todo.completed) return false
    if (filter === 'today') return todo.due_date === t || !todo.due_date
    if (filter === 'upcoming') return todo.due_date && todo.due_date > t
    return true
  })

  const sorted = [...filtered].sort((a, b) => {
    if (filter !== 'completed') {
      const pa = { high: 0, medium: 1, low: 2 }[a.priority]
      const pb = { high: 0, medium: 1, low: 2 }[b.priority]
      if (pa !== pb) return pa - pb
    }
    return 0
  })

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-2xl font-bold">Tasks</h1>
        <Button onClick={() => { setEditingTodo(undefined); setShowForm(true) }} size="icon" className="rounded-xl h-11 w-11">
          <Plus className="h-5 w-5" />
        </Button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 bg-muted p-1 rounded-xl mb-5 overflow-x-auto">
        {FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`flex-1 px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              filter === f.key ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : sorted.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <div className="text-4xl mb-3">✅</div>
          <p className="font-medium">No tasks here</p>
          <p className="text-sm mt-1">{filter === 'completed' ? 'Complete some tasks first' : 'Tap + to add a task'}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {sorted.map(todo => (
            <TodoItem
              key={todo.id}
              todo={todo}
              onEdit={() => { setEditingTodo(todo); setShowForm(true) }}
              onDelete={() => deleteTodo(todo.id)}
              onChange={load}
            />
          ))}
        </div>
      )}

      {user && showForm && (
        <TodoForm
          open={showForm}
          onClose={() => setShowForm(false)}
          onSave={load}
          todo={editingTodo}
          userId={user.id}
        />
      )}
    </div>
  )
}
