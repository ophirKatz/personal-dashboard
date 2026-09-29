import { useEffect, useMemo, useState } from 'react'
import { Check, Search, Loader2 } from 'lucide-react'
import { supabase } from '../../supabase'
import type { RsGoalType, RsQuest } from '../../supabase'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerBody } from '../../components/ui/drawer'
import { cn } from '../../utils'
import { SKILLS, SKILL_BY_ID, VIRTUAL_MAX } from './skills'
import type { QuestStatus } from './api'
import { questKey } from './goals'

type Props = {
  open: boolean
  onClose: () => void
  onSaved: () => void
  userId: string
  characterId: string
  quests: RsQuest[]
  questStatus: Map<string, QuestStatus> | null
  /** Quest ids that already have a goal, hidden from the picker. */
  takenQuestIds: Set<string>
  onRefreshQuests: () => Promise<void>
  refreshingQuests: boolean
}

const TYPES: { value: RsGoalType; label: string }[] = [
  { value: 'skill', label: 'Skill' },
  { value: 'quest', label: 'Quest' },
  { value: 'arbitrary', label: 'Other' },
]

export default function GoalDrawer({
  open, onClose, onSaved, userId, characterId, quests, questStatus, takenQuestIds, onRefreshQuests, refreshingQuests,
}: Props) {
  const [type, setType] = useState<RsGoalType>('skill')
  const [skillId, setSkillId] = useState<string>('')
  const [targetLevel, setTargetLevel] = useState('')
  const [questId, setQuestId] = useState<string | null>(null)
  const [questSearch, setQuestSearch] = useState('')
  const [title, setTitle] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setType('skill'); setSkillId(''); setTargetLevel(''); setQuestId(null); setQuestSearch(''); setTitle(''); setError(null)
  }, [open])

  const skill = skillId ? SKILL_BY_ID.get(Number(skillId)) : undefined
  const level = Number(targetLevel)

  const visibleQuests = useMemo(() => {
    const term = questSearch.trim().toLowerCase()
    return quests
      .filter(q => !takenQuestIds.has(q.id))
      .filter(q => questStatus?.get(questKey(q.name)) !== 'COMPLETED')
      .filter(q => !term || q.name.toLowerCase().includes(term))
  }, [quests, questSearch, takenQuestIds, questStatus])

  const valid =
    (type === 'skill' && !!skill && Number.isInteger(level) && level >= 2 && level <= VIRTUAL_MAX) ||
    (type === 'quest' && !!questId) ||
    (type === 'arbitrary' && title.trim().length > 0)

  async function save() {
    if (!valid) return
    setSaving(true)
    setError(null)
    const base = { user_id: userId, character_id: characterId, type }
    const payload: Record<string, unknown> =
      type === 'skill' ? { ...base, skill_id: skill!.id, target_level: level }
      : type === 'quest' ? { ...base, quest_id: questId }
      : { ...base, title: title.trim() }
    const { error } = await supabase.from('rs_goals').insert(payload)
    setSaving(false)
    if (error) { setError('Could not save the goal.'); return }
    onSaved()
    onClose()
  }

  return (
    <Drawer open={open} onOpenChange={o => { if (!o) onClose() }}>
      <DrawerContent>
        <DrawerHeader><DrawerTitle>New goal</DrawerTitle></DrawerHeader>
        <DrawerBody className="space-y-4">
          <div className="grid grid-cols-3 gap-1 rounded-xl bg-muted p-1">
            {TYPES.map(t => (
              <button
                key={t.value}
                type="button"
                onClick={() => setType(t.value)}
                className={cn(
                  'rounded-lg py-2 text-sm font-medium transition-all',
                  type === t.value ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground',
                )}
              >
                {t.label}
              </button>
            ))}
          </div>

          {type === 'skill' && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Skill</Label>
                <Select value={skillId} onValueChange={setSkillId}>
                  <SelectTrigger><SelectValue placeholder="Choose a skill" /></SelectTrigger>
                  <SelectContent className="max-h-72">
                    {SKILLS.map(s => (
                      <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Target level (up to {VIRTUAL_MAX})</Label>
                <Input
                  type="number" inputMode="numeric" min={2} max={VIRTUAL_MAX}
                  value={targetLevel} onChange={e => setTargetLevel(e.target.value)} placeholder="e.g. 99"
                />
              </div>
            </div>
          )}

          {type === 'quest' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Quest</Label>
                <Button type="button" variant="ghost" size="sm" onClick={onRefreshQuests} disabled={refreshingQuests}>
                  {refreshingQuests && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Refresh list
                </Button>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input className="pl-9" placeholder="Search quests" value={questSearch} onChange={e => setQuestSearch(e.target.value)} />
              </div>
              <div className="max-h-56 overflow-y-auto rounded-xl border border-border divide-y divide-border">
                {quests.length === 0 ? (
                  <p className="p-4 text-sm text-muted-foreground text-center">No quests yet. Tap "Refresh list" to load them.</p>
                ) : visibleQuests.length === 0 ? (
                  <p className="p-4 text-sm text-muted-foreground text-center">No matching quests.</p>
                ) : visibleQuests.map(q => (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => setQuestId(q.id)}
                    className={cn('flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm hover:bg-accent', questId === q.id && 'bg-accent')}
                  >
                    <span className="min-w-0 truncate">{q.name}</span>
                    {questId === q.id
                      ? <Check className="h-4 w-4 shrink-0 text-primary" />
                      : q.difficulty && <span className="shrink-0 text-xs text-muted-foreground">{q.difficulty}</span>}
                  </button>
                ))}
              </div>
            </div>
          )}

          {type === 'arbitrary' && (
            <div className="space-y-1.5">
              <Label>Goal</Label>
              <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Get the Kalphite King pet" maxLength={200} />
            </div>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button className="w-full h-11 rounded-xl" onClick={save} disabled={!valid || saving}>
            {saving ? 'Saving…' : 'Add goal'}
          </Button>
        </DrawerBody>
      </DrawerContent>
    </Drawer>
  )
}
