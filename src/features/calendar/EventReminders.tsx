import { useState } from 'react'
import { X, Plus, Bell } from 'lucide-react'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'

const PRESET_OPTIONS = [
  { days: 1, label: '1 day' },
  { days: 2, label: '2 days' },
  { days: 7, label: '1 week' },
]

export interface EventReminder {
  days: number
}

export default function EventReminders({
  reminders,
  onRemindersChange,
  disabled = false,
}: {
  reminders: EventReminder[]
  onRemindersChange: (reminders: EventReminder[]) => void
  disabled?: boolean
}) {
  const [customInput, setCustomInput] = useState('')
  const [customError, setCustomError] = useState('')

  function addReminder(days: number) {
    if (reminders.some(r => r.days === days)) {
      setCustomError(`Reminder for ${days} day${days > 1 ? 's' : ''} already exists`)
      return
    }
    onRemindersChange([...reminders, { days }])
    setCustomError('')
  }

  function removeReminder(days: number) {
    onRemindersChange(reminders.filter(r => r.days !== days))
    setCustomError('')
  }

  function handleAddCustom() {
    const days = parseInt(customInput, 10)
    if (!customInput.trim() || isNaN(days) || days <= 0) {
      setCustomError('Enter a positive number of days')
      return
    }
    if (days > 365) {
      setCustomError('Maximum 365 days allowed')
      return
    }
    addReminder(days)
    setCustomInput('')
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1.5">
        <Bell className="h-4 w-4 text-muted-foreground" />
        <Label className="text-sm font-medium">Reminders (optional)</Label>
      </div>

      {/* Preset buttons */}
      <div className="flex flex-wrap gap-2">
        {PRESET_OPTIONS.map(({ days, label }) => (
          <button
            key={days}
            type="button"
            disabled={disabled}
            onClick={() => addReminder(days)}
            className="px-3 py-1.5 text-sm rounded-lg border border-input bg-background hover:bg-accent hover:border-border transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            + {label}
          </button>
        ))}
      </div>

      {/* Custom reminder input */}
      <div className="flex gap-2">
        <Input
          type="number"
          placeholder="Custom days..."
          value={customInput}
          onChange={e => {
            setCustomInput(e.target.value)
            setCustomError('')
          }}
          disabled={disabled}
          min="1"
          max="365"
          className="h-9"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleAddCustom}
          disabled={disabled || !customInput.trim()}
          className="h-9"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {customError && <p className="text-xs text-destructive">{customError}</p>}

      {/* Display active reminders */}
      {reminders.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
          {reminders
            .sort((a, b) => a.days - b.days)
            .map(reminder => (
              <div
                key={reminder.days}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-primary/10 text-primary rounded-lg text-sm font-medium"
              >
                <Bell className="h-3.5 w-3.5" />
                <span>{reminder.days} day{reminder.days > 1 ? 's' : ''} before</span>
                <button
                  type="button"
                  onClick={() => removeReminder(reminder.days)}
                  disabled={disabled}
                  className="ml-1 p-0.5 hover:bg-primary/20 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
        </div>
      )}
    </div>
  )
}
