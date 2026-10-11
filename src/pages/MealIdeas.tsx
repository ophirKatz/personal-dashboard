import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Plus, Search, Shuffle, UtensilsCrossed, X } from 'lucide-react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../supabase'
import type { Meal } from '../supabase'
import { Input } from '../components/ui/input'
import { Button } from '../components/ui/button'
import { Fab } from '../components/ui/fab'
import MealCard from '../features/meals/MealCard'
import AddMealDrawer from '../features/meals/AddMealDrawer'
import RandomMealDrawer from '../features/meals/RandomMealDrawer'
import {
  MEAL_TAGS,
  MEAL_TAG_LABELS,
  filterMeals,
  parseTagFilter,
  pickRandomMeal,
  tagFilterToParam,
} from '../features/meals/meals'
import type { TagFilter } from '../features/meals/meals'

const FILTERS: TagFilter[] = ['all', ...MEAL_TAGS]

export default function MealIdeas() {
  // Filter + search live in the URL so going back from a meal's profile restores them.
  const [searchParams, setSearchParams] = useSearchParams()
  const tag = parseTagFilter(searchParams.get('tag'))
  const [search, setSearch] = useState(searchParams.get('q') ?? '')

  const [user, setUser] = useState<User | null>(null)
  const [meals, setMeals] = useState<Meal[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [randomMeal, setRandomMeal] = useState<Meal | null>(null)
  const [randomOpen, setRandomOpen] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user))
  }, [])

  async function load() {
    const { data, error } = await supabase
      .from('meals')
      .select('*, recipe:recipes(id,title,image_url)')
      .order('name')
    if (error) setError(error.message)
    else setMeals((data ?? []) as Meal[])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function setTag(next: TagFilter) {
    const params = new URLSearchParams(searchParams)
    const value = tagFilterToParam(next)
    if (value) params.set('tag', value)
    else params.delete('tag')
    setSearchParams(params, { replace: true })
  }

  function handleSearchChange(value: string) {
    setSearch(value)
    const params = new URLSearchParams(searchParams)
    if (value) params.set('q', value)
    else params.delete('q')
    setSearchParams(params, { replace: true })
  }

  const filtered = useMemo(() => filterMeals(meals, tag, search), [meals, tag, search])

  function rollRandom() {
    const pick = pickRandomMeal(filtered, randomMeal?.id)
    if (!pick) return
    setRandomMeal(pick)
    setRandomOpen(true)
  }

  const tagLabel = tag === 'all' ? null : MEAL_TAG_LABELS[tag].toLowerCase()

  return (
    <div className="mx-auto max-w-4xl space-y-5 p-4 pb-28">
      <div className="flex items-center gap-3">
        <h1 className="flex-1 text-2xl font-bold">Meal ideas</h1>
        <Button variant="outline" onClick={rollRandom} disabled={loading || filtered.length === 0}>
          <Shuffle className="h-4 w-4" />
          Random
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={e => handleSearchChange(e.target.value)}
          placeholder="Search meals…"
          className="pl-9"
        />
      </div>

      <div className="flex gap-1 overflow-x-auto rounded-xl bg-muted p-1" role="group" aria-label="Filter by meal type">
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

      {error && (
        <div className="flex items-center justify-between gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} aria-label="Dismiss"><X className="h-4 w-4" /></button>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12"><div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center text-muted-foreground">
          <UtensilsCrossed className="mx-auto mb-3 h-10 w-10" />
          {meals.length === 0 ? (
            <p className="font-medium">No meals yet — tap + to add your first one</p>
          ) : search.trim() ? (
            <>
              <p className="font-medium">
                No {tagLabel ? `${tagLabel} ` : ''}meals match “{search.trim()}”
              </p>
              {tag !== 'all' && (
                <button type="button" onClick={() => setTag('all')} className="mt-2 text-sm font-medium text-primary">
                  Search all meals
                </button>
              )}
            </>
          ) : (
            <>
              <p className="font-medium">No {tagLabel} ideas yet</p>
              <button type="button" onClick={() => setTag('all')} className="mt-2 text-sm font-medium text-primary">
                Show all meals
              </button>
            </>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {filtered.map(meal => <MealCard key={meal.id} meal={meal} />)}
        </div>
      )}

      {user && (
        <Fab onClick={() => setShowAdd(true)} aria-label="Add meal">
          <Plus className="h-6 w-6" />
        </Fab>
      )}

      {user && showAdd && (
        <AddMealDrawer
          open={showAdd}
          onClose={() => setShowAdd(false)}
          userId={user.id}
          defaultTags={tag === 'all' ? [] : [tag]}
        />
      )}

      <RandomMealDrawer
        open={randomOpen}
        meal={randomMeal}
        canReroll={filtered.length > 1}
        onReroll={rollRandom}
        onClose={() => setRandomOpen(false)}
      />
    </div>
  )
}
