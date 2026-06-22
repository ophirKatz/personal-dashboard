import { useEffect, useState } from 'react'
import { Plus, Link2 } from 'lucide-react'
import { supabase } from '../supabase'
import type { Todo } from '../supabase'
import type { User } from '@supabase/supabase-js'
import TodoItem from '../features/todos/TodoItem'
import TodoForm from '../features/todos/TodoForm'
import GoogleTaskItem from '../features/todos/GoogleTaskItem'
import { fetchGoogleTasks } from '../features/todos/googleTasks'
import type { GoogleTask } from '../features/todos/googleTasks'
import { connectGoogle } from '../lib/googleAuth'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { today } from '../utils'

type Filter = 'today' | 'upcoming' | 'all' | 'completed'

type MergedTodo =
  | { source: 'local'; todo: Todo }
  | { source: 'google'; todo: GoogleTask }

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'all', label: 'All' },
  { key: 'completed', label: 'Done' },
]

export default function Todos() {
  const [user, setUser] = useState<User | null>(null)
  const [todos, setTodos] = useState<Todo[]>([])
  const [googleTasks, setGoogleTasks] = useState<GoogleTask[]>([])
  const [googleConnected, setGoogleConnected] = useState(true)
  const [filter, setFilter] = useState<Filter>('today')
  const [showForm, setShowForm] = useState(false)
  const [editingTodo, setEditingTodo] = useState<Todo | undefined>()
  const [loading, setLoading] = useState(true)
  const [newTitle, setNewTitle] = useState('')

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user))
  }, [])

  async function load() {
    const [localRes, googleRes] = await Promise.all([
      supabase.from('todos').select('*').eq('source', 'local').order('created_at', { ascending: false }),
      fetchGoogleTasks(),
    ])
    setTodos(localRes.data ?? [])
    setGoogleTasks(googleRes.tasks)
    setGoogleConnected(googleRes.connected)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function deleteTodo(id: string) {
    await supabase.from('todos').delete().eq('id', id)
    load()
  }

  async function addTodo(e: React.FormEvent) {
    e.preventDefault()
    if (!newTitle.trim() || !user) return
    const { data } = await supabase.from('todos').insert({
      title: newTitle.trim(), user_id: user.id,
    }).select().single()
    if (data) { setTodos(prev => [data, ...prev]); setNewTitle('') }
  }

  const t = today()
  const merged: MergedTodo[] = [
    ...todos.map(todo => ({ source: 'local' as const, todo })),
    ...googleTasks.map(todo => ({ source: 'google' as const, todo })),
  ]

  function dueDate(item: MergedTodo) {
    return item.source === 'local' ? item.todo.due_date : item.todo.due
  }

  const filtered = merged.filter(item => {
    if (filter === 'completed') return item.todo.completed
    if (item.todo.completed) return false
    const due = dueDate(item)
    if (filter === 'today') return due === t || !due
    if (filter === 'upcoming') return due && due > t
    return true
  })

  const sorted = [...filtered].sort((a, b) => {
    if (filter !== 'completed') {
      const priorityRank = { high: 0, medium: 1, low: 2 }
      const pa = a.source === 'local' ? priorityRank[a.todo.priority] : 1
      const pb = b.source === 'local' ? priorityRank[b.todo.priority] : 1
      if (pa !== pb) return pa - pb
    }
    return 0
  })

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Tasks</h1>

      <form onSubmit={addTodo} className="flex gap-2 mb-5">
        <Input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="Add task…" className="flex-1" />
        <Button type="submit" size="icon" disabled={!newTitle.trim()}>
          <Plus className="h-4 w-4" />
        </Button>
      </form>

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

      {!loading && !googleConnected && (
        <button
          onClick={connectGoogle}
          className="w-full flex items-center justify-center gap-2 mb-5 p-3 rounded-xl border border-dashed border-border text-sm font-medium text-muted-foreground hover:bg-accent transition-colors"
        >
          <Link2 className="h-4 w-4" />
          Connect Google Tasks
        </button>
      )}

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
          {sorted.map(item => item.source === 'local' ? (
            <TodoItem
              key={`local-${item.todo.id}`}
              todo={item.todo}
              onEdit={() => { setEditingTodo(item.todo); setShowForm(true) }}
              onDelete={() => deleteTodo(item.todo.id)}
              onChange={load}
            />
          ) : (
            <GoogleTaskItem key={`google-${item.todo.id}`} task={item.todo} onChange={load} />
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
