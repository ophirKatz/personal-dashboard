import { Link } from 'react-router-dom'
import type { Meal } from '../../supabase'
import MealImage from './MealImage'
import { mealImageUrl } from './meals'

export default function MealCard({ meal }: { meal: Meal }) {
  return (
    <Link
      to={`/meals/${meal.id}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card transition-colors hover:border-primary/50"
    >
      <MealImage url={mealImageUrl(meal)} className="aspect-square w-full" />
      <div className="p-3">
        <p className="font-medium leading-tight line-clamp-2">{meal.name}</p>
      </div>
    </Link>
  )
}
