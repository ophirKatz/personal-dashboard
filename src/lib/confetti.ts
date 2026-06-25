import confetti from 'canvas-confetti'

export function celebrate(origin?: { x: number; y: number }) {
  confetti({
    particleCount: 60,
    spread: 70,
    startVelocity: 35,
    gravity: 1.1,
    ticks: 150,
    origin: origin ?? { x: 0.5, y: 0.4 },
    zIndex: 9999,
  })
}

export function celebrateFromElement(el: HTMLElement) {
  const rect = el.getBoundingClientRect()
  celebrate({
    x: (rect.left + rect.width / 2) / window.innerWidth,
    y: (rect.top + rect.height / 2) / window.innerHeight,
  })
}
