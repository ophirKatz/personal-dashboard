import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, Copy, Share2, Trash2 } from 'lucide-react'
import { supabase } from '../../supabase'
import type { MealShare } from '../../supabase'
import { Button } from '../../components/ui/button'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerBody } from '../../components/ui/drawer'
import { haptic } from '../../lib/haptics'
import { MEAL_TAGS, MEAL_TAG_LABELS } from './meals'
import type { TagFilter } from './meals'
import { formatTimeLeft, mealShareUrl, shareTagLabel } from './mealShares'

type Props = {
  open: boolean
  onClose: () => void
  userId: string
  /** Prefilled from the list's active tag filter. */
  defaultTag: TagFilter
}

const FILTERS: TagFilter[] = ['all', ...MEAL_TAGS]
const canNativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function'

// Create and manage the public picker links: a link offers one meal type (fixed
// when it's created) and stops working 24 hours later.
export default function ShareMealsDrawer({ open, onClose, userId, defaultTag }: Props) {
  const [tag, setTag] = useState<TagFilter>(defaultTag)
  const [shares, setShares] = useState<MealShare[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('meal_shares')
      .select('*, picked:meals!picked_meal_id(id,name)')
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
    if (error) setError(error.message)
    else setShares((data ?? []) as MealShare[])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function handleCreate() {
    if (creating) return
    setCreating(true)
    setError(null)
    // Expired links are dead weight; sweep them whenever a new one is made.
    await supabase.from('meal_shares').delete().lte('expires_at', new Date().toISOString())
    const { error } = await supabase.from('meal_shares').insert({ user_id: userId, tag })
    setCreating(false)
    if (error) {
      setError(error.message)
      return
    }
    haptic('success')
    load()
  }

  async function handleRevoke(id: string) {
    haptic('light')
    const { error } = await supabase.from('meal_shares').delete().eq('id', id)
    if (error) setError(error.message)
    else setShares(prev => prev.filter(s => s.id !== id))
  }

  async function handleCopy(share: MealShare) {
    await navigator.clipboard.writeText(mealShareUrl(window.location.origin, share.token))
    setCopiedId(share.id)
    setTimeout(() => setCopiedId(id => (id === share.id ? null : id)), 1500)
  }

  async function handleShare(share: MealShare) {
    try {
      await navigator.share({
        title: 'Meal ideas',
        text: 'Pick something to eat:',
        url: mealShareUrl(window.location.origin, share.token),
      })
    } catch {
      // Dismissing the share sheet rejects with AbortError; nothing to report.
    }
  }

  return (
    <Drawer open={open} onOpenChange={v => !v && onClose()}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Share meal ideas</DrawerTitle>
        </DrawerHeader>
        <DrawerBody className="space-y-5">
          <div className="space-y-2">
            <p className="px-1 text-xs font-medium text-muted-foreground">
              Anyone with the link can shuffle through these meals, no login needed. It stops working after 24 hours.
            </p>
            <div className="flex gap-1 overflow-x-auto rounded-xl bg-muted p-1" role="group" aria-label="Meals to share">
              {FILTERS.map(f => (
                <button
                  key={f}
                  type="button"
                  aria-pressed={tag === f}
                  onClick={() => setTag(f)}
                  className={`flex-1 whitespace-nowrap rounded-lg px-2 py-1.5 text-sm font-medium transition-colors ${
                    tag === f ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'
                  }`}
                >
                  {f === 'all' ? 'All' : MEAL_TAG_LABELS[f]}
                </button>
              ))}
            </div>
            <Button onClick={handleCreate} disabled={creating} className="h-12 w-full rounded-xl text-base font-semibold">
              {creating ? 'Creating…' : 'Create 24-hour link'}
            </Button>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          {!loading && shares.length > 0 && (
            <div className="space-y-2">
              <p className="px-1 text-xs font-medium text-muted-foreground">Active links</p>
              {shares.map(share => (
                <div key={share.id} className="flex items-center gap-2 rounded-xl border border-border bg-card p-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">
                      {shareTagLabel(share.tag)}
                      <span className="font-normal text-muted-foreground"> · {formatTimeLeft(share.expires_at)}</span>
                    </p>
                    {share.picked ? (
                      <Link
                        to={`/meals/${share.picked.id}`}
                        onClick={onClose}
                        className="block text-sm font-medium leading-snug text-primary line-clamp-2"
                      >
                        Picked: {share.picked.name}
                      </Link>
                    ) : (
                      <p className="text-sm text-muted-foreground">No pick yet</p>
                    )}
                  </div>
                  {canNativeShare && (
                    <Button variant="outline" size="icon" aria-label="Share link" onClick={() => handleShare(share)}>
                      <Share2 className="h-4 w-4" />
                    </Button>
                  )}
                  <Button variant="outline" size="icon" aria-label="Copy link" onClick={() => handleCopy(share)}>
                    {copiedId === share.id ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                  <Button variant="ghost" size="icon" aria-label="Revoke link" onClick={() => handleRevoke(share.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </DrawerBody>
      </DrawerContent>
    </Drawer>
  )
}
