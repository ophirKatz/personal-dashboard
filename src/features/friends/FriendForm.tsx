import { useRef, useState } from 'react'
import { Camera, Bell } from 'lucide-react'
import { supabase } from '../../supabase'
import type { Friend } from '../../supabase'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'
import { Textarea } from '../../components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter } from '../../components/ui/dialog'
import { haptic } from '../../lib/haptics'
import { ALLOWED_AVATAR_TYPES, MAX_AVATAR_BYTES, initials, uploadFriendAvatar } from './friends'

type GoalUnit = Friend['goal_unit']
type GoalMode = Friend['goal_mode']

const INTERVAL_UNITS: GoalUnit[] = ['day', 'week', 'month', 'year']
const FREQUENCY_UNITS: GoalUnit[] = ['day', 'week', 'month']

const MAX_INTERVAL_COUNT: Record<GoalUnit, number> = {
  day: 30,
  week: 26,
  month: 24,
  year: 10,
}

const MAX_FREQUENCY_COUNT: Record<GoalUnit, number> = {
  day: 10,
  week: 7,
  month: 30,
  year: 1,
}

type Props = {
  open: boolean
  onClose: () => void
  onSave: () => void
  friend?: Friend
  userId: string
}

export default function FriendForm({ open, onClose, onSave, friend, userId }: Props) {
  const [name, setName] = useState(friend?.name ?? '')
  const [notes, setNotes] = useState(friend?.notes ?? '')
  const [goalMode, setGoalMode] = useState<GoalMode>(friend?.goal_mode ?? 'interval')
  const [goalCount, setGoalCount] = useState(friend?.goal_count ?? 1)
  const [goalUnit, setGoalUnit] = useState<GoalUnit>(friend?.goal_unit ?? 'month')
  const [reminderEnabled, setReminderEnabled] = useState(friend?.reminder_enabled ?? true)
  const [avatarPreview, setAvatarPreview] = useState(friend?.avatar_url ?? null)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarError, setAvatarError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const availableUnits = goalMode === 'interval' ? INTERVAL_UNITS : FREQUENCY_UNITS
  const maxCount = goalMode === 'interval' ? MAX_INTERVAL_COUNT[goalUnit] : MAX_FREQUENCY_COUNT[goalUnit]

  function handleAvatarSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!ALLOWED_AVATAR_TYPES.has(file.type)) {
      setAvatarError('Please choose a JPEG, PNG, WebP, or GIF image.')
      return
    }
    if (file.size > MAX_AVATAR_BYTES) {
      setAvatarError('Image must be under 5 MB.')
      return
    }
    setAvatarError(null)
    setAvatarFile(file)
    setAvatarPreview(URL.createObjectURL(file))
  }

  function handleModeChange(mode: GoalMode) {
    haptic('selection')
    setGoalMode(mode)
    setGoalCount(1)
    if (mode === 'frequency' && goalUnit === 'year') {
      setGoalUnit('month')
    }
  }

  function handleUnitChange(u: GoalUnit) {
    haptic('selection')
    setGoalUnit(u)
    const max = goalMode === 'interval' ? MAX_INTERVAL_COUNT[u] : MAX_FREQUENCY_COUNT[u]
    setGoalCount(c => Math.min(c, max))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)

    const id = friend?.id ?? crypto.randomUUID()
    let avatarUrl = friend?.avatar_url ?? null
    if (avatarFile) {
      try {
        avatarUrl = await uploadFriendAvatar(userId, id, avatarFile)
      } catch {
        setAvatarError('Could not upload photo.')
        setSaving(false)
        return
      }
    }

    const payload = {
      id,
      name: name.trim(),
      notes: notes.trim() || null,
      avatar_url: avatarUrl,
      goal_count: goalCount,
      goal_unit: goalUnit,
      goal_mode: goalMode,
      reminder_enabled: reminderEnabled,
      user_id: userId,
    }
    if (friend) {
      await supabase.from('friends').update(payload).eq('id', friend.id)
    } else {
      await supabase.from('friends').insert(payload)
    }
    haptic('success')
    setSaving(false)
    onSave()
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{friend ? 'Edit Friend' : 'New Friend'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <DialogBody className="space-y-5">
            <div className="flex flex-col items-center gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="group relative w-20 h-20 rounded-full overflow-hidden border-2 border-border flex items-center justify-center bg-muted text-lg font-semibold text-muted-foreground"
              >
                {avatarPreview ? (
                  <img src={avatarPreview} alt="" className="w-full h-full object-cover" />
                ) : (
                  initials(name || '?')
                )}
                <span className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Camera className="h-5 w-5 text-white" />
                </span>
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarSelect} />
              {avatarError && <p className="text-xs text-destructive">{avatarError}</p>}
            </div>

            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Alex" autoFocus />
            </div>

            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional" rows={2} />
            </div>

            <div className="space-y-3">
              <Label>Goal</Label>
              <div className="flex rounded-lg border border-input p-0.5 gap-0.5">
                {(['interval', 'frequency'] as GoalMode[]).map(mode => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => handleModeChange(mode)}
                    className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${goalMode === mode ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                  >
                    {mode === 'interval' ? 'Every N' : 'N times per'}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {goalMode === 'interval' && (
                  <span className="text-sm text-muted-foreground">Every</span>
                )}
                <button type="button" onClick={() => setGoalCount(c => Math.max(1, c - 1))} className="w-8 h-8 rounded-lg border flex items-center justify-center hover:bg-accent">−</button>
                <span className="w-6 text-center font-medium">{goalCount}</span>
                <button type="button" onClick={() => setGoalCount(c => Math.min(maxCount, c + 1))} className="w-8 h-8 rounded-lg border flex items-center justify-center hover:bg-accent">+</button>
                {goalMode === 'frequency' && (
                  <span className="text-sm text-muted-foreground">times per</span>
                )}
                <div className="flex gap-1 flex-wrap">
                  {availableUnits.map(u => (
                    <button
                      key={u}
                      type="button"
                      onClick={() => handleUnitChange(u)}
                      className={`px-3 py-1.5 rounded-lg border text-sm font-medium capitalize transition-colors ${goalUnit === u ? 'bg-primary text-primary-foreground border-primary' : 'border-input hover:bg-accent'}`}
                    >
                      {goalMode === 'interval'
                        ? (goalCount === 1 ? u : u + 's')
                        : u}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-1.5"><Bell className="h-3.5 w-3.5" />Reminders</Label>
              <button
                type="button"
                onClick={() => { haptic('selection'); setReminderEnabled(r => !r) }}
                className={`relative w-11 h-6 rounded-full transition-colors ${reminderEnabled ? 'bg-primary' : 'bg-muted'}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${reminderEnabled ? 'translate-x-5' : ''}`} />
              </button>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving || !name.trim()}>
              {saving ? 'Saving…' : friend ? 'Save' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
