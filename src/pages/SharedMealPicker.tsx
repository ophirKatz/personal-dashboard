import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Check, Shuffle, UtensilsCrossed } from 'lucide-react'
import { supabase } from '../supabase'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import MealImage from '../features/meals/MealImage'
import { MEAL_TAGS, MEAL_TAG_LABELS, pickRandomMeal } from '../features/meals/meals'
import { formatTimeLeft, shareTagLabel } from '../features/meals/mealShares'
import type { SharedMeal, SharedMealList } from '../features/meals/mealShares'

type LoadState = 'loading' | 'ready' | 'invalid' | 'error'

// Public, no-login page behind /pick/:token. Loads the link's meals once, then
// shuffles locally; the only write is "This one!", which records the pick so
// the owner gets a notification.
export default function SharedMealPicker() {
  const { token } = useParams()
  const [state, setState] = useState<LoadState>('loading')
  const [list, setList] = useState<SharedMealList | null>(null)
  const [current, setCurrent] = useState<SharedMeal | null>(null)
  const [pickedId, setPickedId] = useState<string | null>(null)
  const [picking, setPicking] = useState(false)
  const [pickError, setPickError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!token) {
      setState('invalid')
      return
    }
    const { data, error } = await supabase.rpc('get_meal_share', { p_token: token })
    if (error) {
      setState('error')
      return
    }
    // The RPC answers null for an unknown or expired link.
    if (!data) {
      setState('invalid')
      return
    }
    const next = data as SharedMealList
    setList(next)
    setPickedId(next.picked_meal_id)
    // Come back to an earlier pick if there was one; otherwise start on a random meal.
    setCurrent(next.meals.find(m => m.id === next.picked_meal_id) ?? pickRandomMeal(next.meals))
    setState('ready')
  }, [token])

  useEffect(() => { load() }, [load])

  function shuffle() {
    if (!list) return
    setPickError(null)
    setCurrent(pickRandomMeal(list.meals, current?.id))
  }

  async function pick() {
    if (!token || !current || picking) return
    setPicking(true)
    setPickError(null)
    const { data, error } = await supabase.rpc('pick_meal_share', { p_token: token, p_meal_id: current.id })
    setPicking(false)
    if (error) {
      setPickError('Could not send your pick. Try again.')
    } else if (data === 'ok') {
      setPickedId(current.id)
    } else if (data === 'expired') {
      setState('invalid')
    } else {
      // The meal was removed since this page loaded - show the fresh list.
      setPickError('That one is no longer available.')
      load()
    }
  }

  if (state === 'loading') {
    return (
      <Shell>
        <div className="flex justify-center py-24">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      </Shell>
    )
  }

  if (state === 'invalid' || state === 'error') {
    return (
      <Shell>
        <div className="space-y-3 py-24 text-center text-muted-foreground">
          <UtensilsCrossed className="mx-auto h-10 w-10" />
          {state === 'invalid' ? (
            <>
              <p className="text-lg font-semibold text-foreground">This link has expired</p>
              <p className="text-sm">Ask for a new one.</p>
            </>
          ) : (
            <>
              <p className="text-lg font-semibold text-foreground">Could not load the meals</p>
              <Button variant="outline" onClick={() => { setState('loading'); load() }}>Try again</Button>
            </>
          )}
        </div>
      </Shell>
    )
  }

  const meals = list?.meals ?? []
  if (!list || meals.length === 0 || !current) {
    return (
      <Shell>
        <div className="space-y-3 py-24 text-center text-muted-foreground">
          <UtensilsCrossed className="mx-auto h-10 w-10" />
          <p className="text-lg font-semibold text-foreground">No meals here yet</p>
        </div>
      </Shell>
    )
  }

  // Canonical order (breakfast → dessert) regardless of how the row stored them.
  const tags = MEAL_TAGS.filter(tag => current.tags.includes(tag))
  const isPicked = pickedId === current.id

  return (
    <Shell
      actions={
        <>
          <Button
            onClick={pick}
            disabled={picking || isPicked}
            className="h-12 w-full rounded-xl text-base font-semibold disabled:opacity-100"
          >
            {isPicked ? <><Check className="h-5 w-5" /> Sent</> : picking ? 'Sending…' : 'This one!'}
          </Button>
          {meals.length > 1 && (
            <Button variant="outline" onClick={shuffle} className="h-12 w-full rounded-xl text-base">
              <Shuffle className="h-4 w-4" />
              Another one
            </Button>
          )}
          {pickError && <p className="text-center text-sm text-destructive">{pickError}</p>}
          <p className="pt-1 text-center text-xs text-muted-foreground">
            {shareTagLabel(list.tag)} · link {formatTimeLeft(list.expires_at)}
          </p>
        </>
      }
    >
      <p className="text-center text-sm font-medium text-muted-foreground">How about…</p>
      <MealImage url={current.image_url} className="aspect-video w-full rounded-2xl" iconClassName="h-12 w-12" />
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-bold leading-tight">{current.name}</h1>
        {tags.length > 0 && (
          <div className="flex flex-wrap justify-center gap-1.5">
            {tags.map(tag => <Badge key={tag} variant="secondary">{MEAL_TAG_LABELS[tag]}</Badge>)}
          </div>
        )}
        {current.description && (
          <p className="whitespace-pre-line text-sm text-muted-foreground">{current.description}</p>
        )}
      </div>
    </Shell>
  )
}

// With `actions` the buttons are pinned to the bottom and the card sits at the
// top, so the buttons stay put while the card's height changes between meals.
// Without them (loading, expired, empty) the message is centered.
function Shell({ children, actions }: { children: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col px-4">
      <div className={`flex flex-1 flex-col gap-5 py-8 ${actions ? 'pt-10' : 'justify-center'}`}>{children}</div>
      {actions && <div className="sticky bottom-0 space-y-2 bg-background pb-6 pt-3">{actions}</div>}
    </div>
  )
}
