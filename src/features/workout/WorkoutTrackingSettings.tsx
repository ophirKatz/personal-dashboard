import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { format, parseISO } from 'date-fns'
import { Bell, Plus, Trash2 } from 'lucide-react'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { haptic } from '../../lib/haptics'
import { getPushSubscription, isPushSupported } from '../../lib/push'
import { cn, today } from '../../utils'
import { loadWorkoutTracking, updateWorkoutSettings, type WorkoutTracking } from './workout'
import { missedWorkouts, normalizeReminderTimes } from './workoutTracking'

const MAX_REMINDERS = 6
const DEFAULT_REMINDER_TIME = '19:00'
const VALID_TIME = /^([01]\d|2[0-3]):[0-5]\d$/

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
      className={cn('relative h-6 w-11 shrink-0 rounded-full transition-colors', checked ? 'bg-primary' : 'bg-muted')}
    >
      <span className={cn('absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform', checked && 'translate-x-5')} />
    </button>
  )
}

/** Reminders (a push every day at set times) and the carry-over of missed workouts. */
export default function WorkoutTrackingSettings() {
  const [tracking, setTracking] = useState<WorkoutTracking | null>(null)
  const [enabled, setEnabled] = useState(false)
  // Edited in place and kept in entry order; only the valid, sorted set is persisted.
  const [times, setTimes] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  // null until known; the warning only shows once we're sure push is off on this device.
  const [pushOn, setPushOn] = useState<boolean | null>(null)

  const todayStr = today()

  useEffect(() => {
    loadWorkoutTracking(todayStr).then(t => {
      setTracking(t)
      setEnabled(t.settings?.reminder_enabled ?? false)
      setTimes(t.settings?.reminder_times ?? [])
    })
    if (isPushSupported()) getPushSubscription().then(sub => setPushOn(!!sub))
    else setPushOn(false)
  }, [todayStr])

  const settings = tracking?.settings ?? null

  async function save(patch: Parameters<typeof updateWorkoutSettings>[1]) {
    if (!settings) return false
    setError(null)
    const message = await updateWorkoutSettings(settings.user_id, patch)
    if (message) setError(message)
    return !message
  }

  function toggleEnabled() {
    haptic('selection')
    const next = !enabled
    // Turning reminders on with nothing scheduled would do nothing, so start with a time.
    const nextTimes = next && times.filter(t => VALID_TIME.test(t)).length === 0 ? [DEFAULT_REMINDER_TIME] : times
    setEnabled(next)
    setTimes(nextTimes)
    save({ reminder_enabled: next, reminder_times: normalizeReminderTimes(nextTimes) })
  }

  function changeTime(index: number, value: string) {
    const next = times.map((t, i) => (i === index ? value : t))
    setTimes(next)
    if (VALID_TIME.test(value)) save({ reminder_times: normalizeReminderTimes(next) })
  }

  function addTime() {
    haptic('selection')
    const next = [...times, DEFAULT_REMINDER_TIME]
    setTimes(next)
    save({ reminder_times: normalizeReminderTimes(next) })
  }

  function removeTime(index: number) {
    haptic('selection')
    const next = times.filter((_, i) => i !== index)
    setTimes(next)
    save({ reminder_times: normalizeReminderTimes(next) })
  }

  async function startFresh() {
    if (!settings) return
    if (!confirm('Clear your missed workouts? Tracking restarts from today.')) return
    haptic('warning')
    const ok = await save({ tracking_start_date: todayStr })
    if (ok && tracking) setTracking({ ...tracking, settings: { ...settings, tracking_start_date: todayStr } })
  }

  if (!tracking) return null

  if (!settings) {
    return (
      <section className="space-y-2">
        <h2 className="text-base font-semibold">Reminders & tracking</h2>
        <p className="text-sm text-muted-foreground">Not available yet — the database update for workout tracking hasn't been applied.</p>
      </section>
    )
  }

  const missed = missedWorkouts(tracking.days, settings.tracking_start_date, todayStr)

  return (
    <section className="space-y-6">
      <div className="space-y-3">
        <h2 className="text-base font-semibold">Reminders</h2>
        <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
          <Bell className="h-4 w-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">Workout reminders</p>
            <p className="text-xs text-muted-foreground">A push every day at each time below</p>
          </div>
          <Toggle checked={enabled} onChange={toggleEnabled} label="Workout reminders" />
        </div>

        {enabled && (
          <div className="space-y-2">
            {times.map((time, index) => (
              <div key={index} className="flex items-center gap-2">
                <Input
                  type="time"
                  value={time}
                  onChange={e => changeTime(index, e.target.value)}
                  aria-label={`Reminder time ${index + 1}`}
                  className="w-auto"
                />
                <button
                  type="button"
                  onClick={() => removeTime(index)}
                  aria-label={`Remove reminder time ${index + 1}`}
                  className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
            {times.length < MAX_REMINDERS && (
              <Button type="button" size="sm" variant="outline" onClick={addTime}>
                <Plus className="mr-1 h-4 w-4" /> Add time
              </Button>
            )}
            <p className="text-xs text-muted-foreground">Times are Israel time.</p>
            {pushOn === false && (
              <p className="text-xs text-destructive">
                Push notifications are off on this device, so reminders won't reach it.{' '}
                <Link to="/settings" className="underline">Turn them on in Settings</Link>
              </p>
            )}
          </div>
        )}
      </div>

      <div className="space-y-3">
        <h2 className="text-base font-semibold">Tracking</h2>
        <div className="space-y-2 rounded-xl border border-border bg-card p-3">
          <p className="text-sm">
            {missed > 0 ? `${missed} missed ${missed === 1 ? 'workout' : 'workouts'} to make up` : 'No missed workouts'}
          </p>
          <p className="text-xs text-muted-foreground">
            A day without a workout carries over to the next one. Extra workouts pay it back.
            Tracking since {format(parseISO(settings.tracking_start_date), 'MMM d, yyyy')}.
          </p>
          {missed > 0 && (
            <Button type="button" size="sm" variant="outline" onClick={startFresh}>Start fresh</Button>
          )}
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
    </section>
  )
}
