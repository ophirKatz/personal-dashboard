import { Link } from 'react-router-dom'
import type { Meal } from '../../supabase'
import MealImage from './MealImage'
import { MEAL_TAGS, MEAL_TAG_LABELS, mealImageUrl } from './meals'

export default function MealCard({ meal }: { meal: Meal }) {
  // Canonical order (breakfast → dessert) regardless of how the row stored them.
  const tags = MEAL_TAGS.filter(tag => meal.tags.includes(tag))

  return (
    <Link
      to={`/meals/${meal.id}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card transition-colors hover:border-primary/50"
    >
      <MealImage url={mealImageUrl(meal)} className="aspect-square w-full" iconClassName="h-6 w-6 sm:h-8 sm:w-8" />
      <div className="flex flex-1 flex-col gap-1.5 p-2 sm:p-3">
        <p className="text-sm font-medium leading-tight line-clamp-2 sm:text-base">{meal.name}</p>
        {tags.length > 0 && (
          <div className="mt-auto flex flex-wrap gap-1">
            {tags.map(tag => (
              <span
                key={tag}
                className="rounded-full bg-secondary px-1.5 py-1 text-[10px] font-medium leading-none text-secondary-foreground sm:px-2 sm:text-xs"
              >
                {MEAL_TAG_LABELS[tag]}
              </span>
            ))}
          </div>
        )}
      </div>
    </Link>
  )
}
