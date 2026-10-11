import { useNavigate } from 'react-router-dom'
import { Shuffle } from 'lucide-react'
import type { Meal } from '../../supabase'
import { Badge } from '../../components/ui/badge'
import { Button } from '../../components/ui/button'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerBody } from '../../components/ui/drawer'
import MealImage from './MealImage'
import { MEAL_TAG_LABELS, mealImageUrl } from './meals'

type Props = {
  open: boolean
  meal: Meal | null
  /** False when the current filter only has one meal, so re-rolling can't change it. */
  canReroll: boolean
  onReroll: () => void
  onClose: () => void
}

export default function RandomMealDrawer({ open, meal, canReroll, onReroll, onClose }: Props) {
  const navigate = useNavigate()

  return (
    <Drawer open={open} onOpenChange={v => !v && onClose()}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>How about…</DrawerTitle>
        </DrawerHeader>
        <DrawerBody className="space-y-4">
          {meal && (
            <>
              <MealImage url={mealImageUrl(meal)} className="aspect-video w-full rounded-2xl" iconClassName="h-12 w-12" />
              <div className="space-y-2 text-center">
                <p className="text-2xl font-bold leading-tight">{meal.name}</p>
                {meal.tags.length > 0 && (
                  <div className="flex flex-wrap justify-center gap-1.5">
                    {meal.tags.map(tag => (
                      <Badge key={tag} variant="secondary">{MEAL_TAG_LABELS[tag]}</Badge>
                    ))}
                  </div>
                )}
                {meal.description && <p className="text-sm text-muted-foreground line-clamp-3">{meal.description}</p>}
              </div>
              <div className="flex gap-2">
                {canReroll && (
                  <Button variant="outline" onClick={onReroll} className="h-12 flex-1 rounded-xl text-base">
                    <Shuffle className="h-4 w-4" />
                    Another one
                  </Button>
                )}
                <Button
                  onClick={() => { onClose(); navigate(`/meals/${meal.id}`) }}
                  className="h-12 flex-1 rounded-xl text-base font-semibold"
                >
                  View meal
                </Button>
              </div>
            </>
          )}
        </DrawerBody>
      </DrawerContent>
    </Drawer>
  )
}
