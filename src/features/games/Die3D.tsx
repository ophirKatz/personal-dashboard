import type { CSSProperties } from 'react'
import DieFace, { type DieValue } from './DieFace'

// Cube face placement: each face is rotated out from the center and pushed
// forward by half the cube's size. Opposite faces sum to 7, like a real die.
const FACES: Array<{ value: DieValue; transform: string }> = [
  { value: 1, transform: 'rotateY(0deg)' },
  { value: 6, transform: 'rotateY(180deg)' },
  { value: 2, transform: 'rotateY(90deg)' },
  { value: 5, transform: 'rotateY(-90deg)' },
  { value: 3, transform: 'rotateX(90deg)' },
  { value: 4, transform: 'rotateX(-90deg)' },
]

// Cube rotation that brings each value's face to the front.
export const FACE_ORIENTATION: Record<DieValue, { x: number; y: number }> = {
  1: { x: 0, y: 0 },
  6: { x: 0, y: 180 },
  2: { x: 0, y: -90 },
  5: { x: 0, y: 90 },
  3: { x: -90, y: 0 },
  4: { x: 90, y: 0 },
}

export type DieRotation = { x: number; y: number; z: number }

type Props = {
  rotation: DieRotation
  size: number
  durationMs: number
  onSettled?: () => void
}

export default function Die3D({ rotation, size, durationMs, onSettled }: Props) {
  const half = size / 2
  const cubeStyle: CSSProperties = {
    width: size,
    height: size,
    transformStyle: 'preserve-3d',
    transform: `rotateZ(${rotation.z}deg) rotateX(${rotation.x}deg) rotateY(${rotation.y}deg)`,
    transition: `transform ${durationMs}ms cubic-bezier(0.2, 0.7, 0.25, 1)`,
  }

  return (
    // pointer-events-none: edge-on 3D planes can project to degenerate hit
    // areas that swallow taps meant for neighboring controls.
    <div className="pointer-events-none" style={{ width: size, height: size, perspective: size * 6 }}>
      <div
        className="relative"
        style={cubeStyle}
        onTransitionEnd={e => { if (e.target === e.currentTarget) onSettled?.() }}
      >
        {/* Inner planes fill the hollow corners left by the faces' rounded edges. */}
        {['rotateX(0deg)', 'rotateX(90deg)', 'rotateY(90deg)'].map(t => (
          <div
            key={t}
            className="absolute inset-[3%] bg-stone-300"
            style={{ transform: t, backfaceVisibility: 'visible' }}
          />
        ))}
        {FACES.map(face => (
          <DieFace
            key={face.value}
            value={face.value}
            className="absolute inset-0 w-full h-full"
            // backface hidden keeps the far faces from bleeding through mid-spin
            style={{ transform: `${face.transform} translateZ(${half}px)`, backfaceVisibility: 'hidden' }}
          />
        ))}
      </div>
    </div>
  )
}
