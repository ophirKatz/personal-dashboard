import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { cn } from '../utils'
import { haptic } from '../lib/haptics'
import { Button } from '../components/ui/button'
import Die3D, { FACE_ORIENTATION, type DieRotation } from '../features/games/Die3D'
import type { DieValue } from '../features/games/DieFace'
import { fetchGameUtilities, GAME_UTILITIES } from '../features/games/utilities'

type DieCount = 1 | 2
type DieState = { value: DieValue; spins: { x: number; y: number; z: number } }

const DIE_COUNT_KEY = 'games.dice.count'
const ROLL_MS = 1100
const REDUCED_ROLL_MS = 250

function randomInt(maxExclusive: number): number {
  const buf = new Uint32Array(1)
  crypto.getRandomValues(buf)
  return buf[0] % maxExclusive
}

function randomDieValue(): DieValue {
  return (randomInt(6) + 1) as DieValue
}

function rotationFor(die: DieState): DieRotation {
  const o = FACE_ORIENTATION[die.value]
  return { x: die.spins.x * 360 + o.x, y: die.spins.y * 360 + o.y, z: die.spins.z * 360 }
}

function readStoredCount(): DieCount {
  try {
    return localStorage.getItem(DIE_COUNT_KEY) === '1' ? 1 : 2
  } catch {
    return 2
  }
}

export default function DiceRoller() {
  const defaultTitle = GAME_UTILITIES.find(u => u.key === 'dice')!.defaultName
  const [title, setTitle] = useState(defaultTitle)
  const [count, setCount] = useState<DieCount>(readStoredCount)
  const [dice, setDice] = useState<DieState[]>(() =>
    [0, 1].map(() => ({ value: randomDieValue(), spins: { x: 0, y: 0, z: 0 } })),
  )
  const [rolling, setRolling] = useState(false)
  const [hasRolled, setHasRolled] = useState(false)
  const hopRefs = useRef<Array<HTMLDivElement | null>>([])
  const shadowRefs = useRef<Array<HTMLDivElement | null>>([])
  const reducedMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const rollMs = reducedMotion ? REDUCED_ROLL_MS : ROLL_MS

  useEffect(() => {
    fetchGameUtilities().then(list => {
      const dice = list.find(u => u.key === 'dice')
      if (dice) setTitle(dice.name)
    })
  }, [])

  function changeCount(next: DieCount) {
    if (rolling || next === count) return
    haptic('selection')
    setCount(next)
    setHasRolled(false)
    try { localStorage.setItem(DIE_COUNT_KEY, String(next)) } catch { /* private mode */ }
  }

  function roll() {
    if (rolling) return
    haptic('medium')
    setRolling(true)
    setDice(prev => prev.map((die, i) => {
      if (i >= count) return die
      // 2–3 extra full turns per axis so every roll visibly tumbles, even
      // when the new value matches the old one.
      return {
        value: randomDieValue(),
        spins: {
          x: die.spins.x + 2 + randomInt(2),
          y: die.spins.y + 2 + randomInt(2),
          z: die.spins.z + (randomInt(2) === 0 ? 1 : -1),
        },
      }
    }))

    if (!reducedMotion) {
      for (let i = 0; i < count; i++) {
        const delay = i * 60
        hopRefs.current[i]?.animate(
          [
            { transform: 'translateY(0) scale(1)' },
            { transform: 'translateY(-70px) scale(1.08)', offset: 0.3 },
            { transform: 'translateY(0) scale(1)', offset: 0.6 },
            { transform: 'translateY(-14px) scale(1.02)', offset: 0.75 },
            { transform: 'translateY(0) scale(1)' },
          ],
          { duration: rollMs, delay, easing: 'ease-out' },
        )
        shadowRefs.current[i]?.animate(
          [
            { transform: 'scale(1)', opacity: 0.35 },
            { transform: 'scale(0.55)', opacity: 0.15, offset: 0.3 },
            { transform: 'scale(1)', opacity: 0.35, offset: 0.6 },
            { transform: 'scale(0.9)', opacity: 0.3, offset: 0.75 },
            { transform: 'scale(1)', opacity: 0.35 },
          ],
          { duration: rollMs, delay, easing: 'ease-out' },
        )
      }
    }

    setTimeout(() => {
      setRolling(false)
      setHasRolled(true)
      haptic('light')
    }, rollMs + (count - 1) * 60)
  }

  const active = dice.slice(0, count)
  const total = active.reduce((sum, d) => sum + d.value, 0)
  const dieSize = count === 1 ? 132 : 108

  return (
    <div className="p-4 max-w-2xl mx-auto flex flex-col min-h-[calc(100dvh-7rem)] md:min-h-[calc(100dvh-3rem)]">
      <div className="flex items-center gap-2 mb-6">
        <Link to="/games" className="p-2 -ml-2 rounded-full hover:bg-accent" aria-label="Back to games">
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-2xl font-bold truncate">{title}</h1>
      </div>

      <div className="flex justify-center">
        <div className="inline-flex p-1 rounded-xl bg-muted">
          {([1, 2] as const).map(n => (
            <button
              key={n}
              onClick={() => changeCount(n)}
              disabled={rolling}
              className={cn(
                'px-5 py-2 rounded-lg text-sm font-medium transition-colors',
                count === n ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground',
              )}
            >
              {n} {n === 1 ? 'die' : 'dice'}
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={roll}
        disabled={rolling}
        aria-label="Roll"
        className="flex-1 flex items-center justify-center gap-12 py-16 select-none outline-none"
        style={{ WebkitTapHighlightColor: 'transparent' }}
      >
        {active.map((die, i) => (
          <div key={i} className="relative flex flex-col items-center">
            <div ref={el => { hopRefs.current[i] = el }}>
              <Die3D rotation={rotationFor(die)} size={dieSize} durationMs={rollMs} />
            </div>
            <div
              ref={el => { shadowRefs.current[i] = el }}
              className="mt-5 h-3 rounded-[50%] bg-black opacity-35 blur-sm"
              style={{ width: dieSize * 0.9 }}
            />
          </div>
        ))}
      </button>

      <div className="h-16 flex flex-col items-center justify-center" aria-live="polite">
        {hasRolled && !rolling && (
          <div className="text-center animate-in fade-in-0 zoom-in-95 duration-200">
            {count === 2 ? (
              <>
                <div className="text-4xl font-bold tabular-nums">{total}</div>
                <div className="text-xs text-muted-foreground">{active.map(d => d.value).join(' + ')}</div>
              </>
            ) : (
              <div className="text-4xl font-bold tabular-nums">{total}</div>
            )}
          </div>
        )}
      </div>

      <Button size="lg" className="w-full mt-4 text-base" onClick={roll} disabled={rolling}>
        {rolling ? 'Rolling…' : 'Roll'}
      </Button>
    </div>
  )
}
