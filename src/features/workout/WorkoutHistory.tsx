import { useEffect, useState } from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import { formatDate } from '../../utils'
import { haptic } from '../../lib/haptics'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerBody } from '../../components/ui/drawer'
import { exerciseIcon } from './exerciseIcons'
import { deleteLog, loadLogs, type LogWithExercises } from './workout'
import WorkoutForm from './WorkoutForm'

export default function WorkoutHistory() {
  const [logs, setLogs] = useState<LogWithExercises[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<LogWithExercises | null>(null)

  async function load() {
    setLogs(await loadLogs())
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function handleDelete(log: LogWithExercises) {
    if (!confirm('Delete this workout?')) return
    haptic('warning')
    await deleteLog(log.id)
    load()
  }

  if (loading) return <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>

  if (!logs.length) return (
    <div className="text-center py-12 text-muted-foreground">
      <div className="text-4xl mb-3">💪</div>
      <p className="font-medium">No workouts yet</p>
    </div>
  )

  return (
    <div className="space-y-3">
      {logs.map(log => (
        <div key={log.id} className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <div className="font-medium">{formatDate(log.log_date)}</div>
              {log.preset_name && <div className="text-xs text-muted-foreground">{log.preset_name}</div>}
            </div>
            <button onClick={() => setEditing(log)} aria-label="Edit workout" className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground">
              <Pencil className="h-4 w-4" />
            </button>
            <button onClick={() => handleDelete(log)} aria-label="Delete workout" className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-destructive">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-2 space-y-1">
            {log.items.map(item => {
              const Icon = exerciseIcon(item.icon)
              return (
                <div key={item.id} className="flex items-center gap-2 text-sm">
                  <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="flex-1 truncate">{item.exercise_name}</span>
                  <span className="text-muted-foreground tabular-nums">{item.sets}×{item.reps}</span>
                </div>
              )
            })}
          </div>
          {log.notes && <p className="text-xs text-muted-foreground mt-2 italic">"{log.notes}"</p>}
        </div>
      ))}

      {editing && (
        <Drawer open onOpenChange={v => !v && setEditing(null)}>
          <DrawerContent>
            <DrawerHeader><DrawerTitle>Edit workout</DrawerTitle></DrawerHeader>
            <DrawerBody>
              <WorkoutForm editing={editing} onSaved={() => { setEditing(null); load() }} />
            </DrawerBody>
          </DrawerContent>
        </Drawer>
      )}
    </div>
  )
}
