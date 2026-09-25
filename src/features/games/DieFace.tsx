import type { CSSProperties } from 'react'

export type DieValue = 1 | 2 | 3 | 4 | 5 | 6

const PIP_POSITIONS = {
  tl: [27, 27], tr: [73, 27],
  ml: [27, 50], c: [50, 50], mr: [73, 50],
  bl: [27, 73], br: [73, 73],
} as const

const FACE_PIPS: Record<DieValue, Array<keyof typeof PIP_POSITIONS>> = {
  1: ['c'],
  2: ['tl', 'br'],
  3: ['tl', 'c', 'br'],
  4: ['tl', 'tr', 'bl', 'br'],
  5: ['tl', 'tr', 'c', 'bl', 'br'],
  6: ['tl', 'tr', 'ml', 'mr', 'bl', 'br'],
}

// One face of a classic ivory die, drawn on a 100×100 grid. The single pip
// on the 1 face is larger and red, like most casino dice.
export default function DieFace({ value, className, style }: { value: DieValue; className?: string; style?: CSSProperties }) {
  const id = `die-face-${value}`
  return (
    <svg viewBox="0 0 100 100" className={className} style={style} aria-hidden="true">
      <defs>
        <radialGradient id={`${id}-bg`} cx="35%" cy="30%" r="85%">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.7" stopColor="#f5f5f4" />
          <stop offset="1" stopColor="#d6d3d1" />
        </radialGradient>
        <radialGradient id={`${id}-pip`} cx="40%" cy="35%" r="70%">
          <stop offset="0" stopColor={value === 1 ? '#ef4444' : '#44403c'} />
          <stop offset="1" stopColor={value === 1 ? '#991b1b' : '#0c0a09'} />
        </radialGradient>
      </defs>
      <rect x="0" y="0" width="100" height="100" rx="14" fill={`url(#${id}-bg)`} />
      <rect x="1.5" y="1.5" width="97" height="97" rx="13" fill="none" stroke="#a8a29e" strokeOpacity="0.5" strokeWidth="1.5" />
      {FACE_PIPS[value].map(pos => {
        const [cx, cy] = PIP_POSITIONS[pos]
        return <circle key={pos} cx={cx} cy={cy} r={value === 1 ? 12 : 9} fill={`url(#${id}-pip)`} />
      })}
    </svg>
  )
}
