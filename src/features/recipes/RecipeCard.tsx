import { Link } from 'react-router-dom'
import { ChefHat } from 'lucide-react'
import type { Recipe } from '../../supabase'

type Props = {
  recipe: Recipe
  collectionNames?: string[]
}

export default function RecipeCard({ recipe, collectionNames = [] }: Props) {
  return (
    <Link
      to={`/recipes/${recipe.id}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card transition-colors hover:border-primary/50"
    >
      <div className="aspect-square w-full bg-muted flex items-center justify-center overflow-hidden">
        {recipe.image_url ? (
          <img src={recipe.image_url} alt="" className="w-full h-full object-cover" />
        ) : (
          <ChefHat className="h-8 w-8 text-muted-foreground" />
        )}
      </div>
      <div className="p-3 space-y-1">
        <p className="font-medium leading-tight line-clamp-2">{recipe.title}</p>
        {collectionNames.length > 0 && (
          <p className="text-xs text-muted-foreground truncate">{collectionNames[0]}</p>
        )}
      </div>
    </Link>
  )
}
