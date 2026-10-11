import type { MealTag } from '../../supabase'
import { cn } from '../../utils'
import { MEAL_TAGS, MEAL_TAG_LABELS, toggleTag } from './meals'

type Props = {
  value: MealTag[]
  onChange: (next: MealTag[]) => void
}

// Multi-select toggle pills: a meal can be, say, both lunch and dinner.
export default function MealTagPicker({ value, onChange }: Props) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {MEAL_TAGS.map(tag => {
        const on = value.includes(tag)
        return (
          <button
            key={tag}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(toggleTag(value, tag))}
            className={cn(
              'h-10 rounded-full border px-3 text-sm font-medium transition-colors',
              on
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-input bg-background text-muted-foreground hover:bg-accent',
            )}
          >
            {MEAL_TAG_LABELS[tag]}
          </button>
        )
      })}
    </div>
  )
}
