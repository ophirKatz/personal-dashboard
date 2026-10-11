import { useEffect, useState } from 'react'
import { UtensilsCrossed } from 'lucide-react'
import { cn } from '../../utils'

type Props = {
  url: string | null
  className?: string
  iconClassName?: string
}

// Image with a placeholder for "no photo" and for photos that fail to load.
export default function MealImage({ url, className, iconClassName }: Props) {
  const [failed, setFailed] = useState(false)
  useEffect(() => setFailed(false), [url])

  return (
    <div className={cn('flex items-center justify-center overflow-hidden bg-muted', className)}>
      {url && !failed ? (
        <img src={url} alt="" loading="lazy" onError={() => setFailed(true)} className="h-full w-full object-cover" />
      ) : (
        <UtensilsCrossed className={cn('h-8 w-8 text-muted-foreground', iconClassName)} />
      )}
    </div>
  )
}
