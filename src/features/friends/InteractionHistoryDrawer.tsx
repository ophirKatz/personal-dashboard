import { useState, useMemo } from 'react'
import { format, parseISO, startOfMonth, startOfYear } from 'date-fns'
import { Sparkles, Trash2 } from 'lucide-react'
import { supabase } from '../../supabase'
import type { Friend, FriendInteraction } from '../../supabase'
import { formatFriendGoal } from '../../utils'
import { Button } from '../../components/ui/button'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerBody } from '../../components/ui/drawer'
import { haptic } from '../../lib/haptics'
import { initials } from './friends'

type Period = 'month' | 'year' | 'all'

const PERIODS: Array<{ key: Period; label: string }> = [
  { key: 'month', label: 'This Month' },
  { key: 'year', label: 'This Year' },
  { key: 'all', label: 'All Time' },
]

type Props = {
  open: boolean
  onClose: () => void
  friend: Friend
  interactions: FriendInteraction[]
  userId: string
  onInteractionChanged: () => void
}

export default function InteractionHistoryDrawer({
  open, onClose, friend, interactions, userId, onInteractionChanged,
}: Props) {
  const [period, setPeriod] = useState<Period>('month')
  const [summary, setSummary] = useState<string | null>(null)
  const [summarizing, setSummarizing] = useState(false)
  const [summaryError, setSummaryError] = useState(false)

  const friendInteractions = useMemo(() =>
    interactions
      .filter(i => i.friend_id === friend.id)
      .sort((a, b) => b.interaction_date.localeCompare(a.interaction_date)),
    [interactions, friend.id],
  )

  const filtered = useMemo(() => {
    if (period === 'all') return friendInteractions
    const now = new Date()
    const cutoffStr = period === 'month'
      ? startOfMonth(now).toISOString().slice(0, 10)
      : startOfYear(now).toISOString().slice(0, 10)
    return friendInteractions.filter(i => i.interaction_date >= cutoffStr)
  }, [friendInteractions, period])

  const periodLabel = useMemo(() => {
    const now = new Date()
    if (period === 'month') return format(now, 'MMMM yyyy')
    if (period === 'year') return String(now.getFullYear())
    return 'all time'
  }, [period])

  function handlePeriodChange(p: Period) {
    setPeriod(p)
    setSummary(null)
    setSummaryError(false)
  }

  async function generateSummary() {
    setSummarizing(true)
    setSummary(null)
    setSummaryError(false)

    const invoke = () =>
      supabase.functions.invoke<{ summary?: string }>(
        'summarize-friend-interactions',
        { body: { friend_id: friend.id, period } },
      )

    try {
      let { data, error } = await invoke()

      // On transient failure (relay error, network hiccup), retry once.
      if (error || !data?.summary) {
        await new Promise<void>(r => setTimeout(r, 2000))
        ;({ data, error } = await invoke())
      }

      if (error || !data?.summary) {
        setSummaryError(true)
      } else {
        setSummary(data.summary)
      }
    } catch {
      setSummaryError(true)
    }
    setSummarizing(false)
  }

  async function deleteInteraction(id: string) {
    haptic('warning')
    await supabase.from('friend_interactions').delete().eq('id', id).eq('user_id', userId)
    onInteractionChanged()
  }

  return (
    <Drawer open={open} onOpenChange={onClose}>
      <DrawerContent>
        <DrawerHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full overflow-hidden shrink-0 flex items-center justify-center bg-muted text-sm font-semibold text-muted-foreground">
              {friend.avatar_url ? (
                <img src={friend.avatar_url} alt="" className="w-full h-full object-cover" />
              ) : (
                initials(friend.name)
              )}
            </div>
            <div>
              <DrawerTitle>{friend.name}</DrawerTitle>
              <p className="text-xs text-muted-foreground">{formatFriendGoal(friend.goal_count, friend.goal_unit, friend.goal_mode)}</p>
            </div>
          </div>
        </DrawerHeader>

        <DrawerBody className="space-y-4">
          {friend.details && (
            <div className="rounded-xl bg-muted/50 p-3 text-sm">
              <p className="text-xs font-medium text-foreground mb-1">About</p>
              <p className="whitespace-pre-wrap text-muted-foreground">{friend.details}</p>
            </div>
          )}

          {friend.notes && (
            <div className="rounded-xl bg-primary/5 border border-primary/20 p-3 text-sm">
              <p className="text-xs font-medium text-primary mb-1">Reminder note</p>
              <p className="whitespace-pre-wrap text-foreground">{friend.notes}</p>
            </div>
          )}

          <div className="flex gap-1.5">
            {PERIODS.map(p => (
              <button
                key={p.key}
                onClick={() => handlePeriodChange(p.key)}
                className={`flex-1 py-1.5 rounded-lg border text-sm font-medium transition-colors ${
                  period === p.key
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'border-input hover:bg-accent'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="rounded-xl bg-muted/50 p-3">
            <p className="text-sm font-medium">
              {filtered.length} interaction{filtered.length !== 1 ? 's' : ''}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">in {periodLabel}</p>
          </div>

          {filtered.length > 0 && (
            <div className="space-y-2">
              <Button
                variant="outline"
                size="sm"
                className="w-full gap-2"
                onClick={generateSummary}
                disabled={summarizing}
              >
                <Sparkles className="h-4 w-4" />
                {summarizing ? 'Generating summary…' : 'Generate AI Summary'}
              </Button>
              {summaryError && (
                <p className="text-xs text-destructive text-center">Could not generate summary. Try again.</p>
              )}
              {summary && (
                <div className="rounded-xl bg-muted/50 border p-3 text-sm leading-relaxed whitespace-pre-wrap">
                  {summary}
                </div>
              )}
            </div>
          )}

          {filtered.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              <p>No interactions recorded for {periodLabel}.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map(i => (
                <div key={i.id} className="flex items-start gap-2 rounded-xl border bg-card p-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-muted-foreground">
                      {format(parseISO(i.interaction_date), 'MMM d, yyyy')}
                    </p>
                    {i.note ? (
                      <p className="text-sm mt-0.5">{i.note}</p>
                    ) : (
                      <p className="text-sm mt-0.5 text-muted-foreground italic">No note</p>
                    )}
                  </div>
                  <button
                    onClick={() => deleteInteraction(i.id)}
                    className="shrink-0 p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-destructive"
                    title="Delete"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </DrawerBody>
      </DrawerContent>
    </Drawer>
  )
}
