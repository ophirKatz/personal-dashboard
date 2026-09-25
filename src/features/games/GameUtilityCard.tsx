import type { MouseEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Gamepad2 } from 'lucide-react'
import { useLongPress } from '../../lib/useLongPress'
import type { GameUtility } from './utilities'

type Props = {
  utility: GameUtility
  onEdit: () => void
}

export default function GameUtilityCard({ utility, onEdit }: Props) {
  const navigate = useNavigate()
  const longPress = useLongPress(onEdit)

  function handleClick(e: MouseEvent<HTMLButtonElement>) {
    longPress.onClick(e)
    if (!e.defaultPrevented) navigate(utility.path)
  }

  return (
    <button
      {...longPress}
      onClick={handleClick}
      className="flex flex-col text-left bg-card border border-border rounded-2xl overflow-hidden active:scale-[0.98] active:bg-accent/50 transition-transform"
    >
      <div className="w-full aspect-[4/3] bg-muted flex items-center justify-center overflow-hidden">
        {utility.image ? (
          <img src={utility.image} alt="" draggable={false} className="w-full h-full object-cover pointer-events-none" />
        ) : (
          <Gamepad2 className="h-8 w-8 text-muted-foreground" />
        )}
      </div>
      <div className="p-3 min-w-0 w-full">
        <div className="font-semibold text-sm truncate">{utility.name}</div>
        {utility.description && (
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{utility.description}</p>
        )}
      </div>
    </button>
  )
}
