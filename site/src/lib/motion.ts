// Motion tokens for `motion/react`, mirroring the CSS tokens in styles/tokens.css.
// Springs only for small things (toggles, chips, toasts); no bounce or elastic.
import type { Transition } from 'motion/react'

export const spring = {
  snappy: { type: 'spring', stiffness: 500, damping: 34 },
  soft: { type: 'spring', stiffness: 300, damping: 30 },
  gentle: { type: 'spring', stiffness: 170, damping: 26 },
} as const satisfies Record<string, Transition>

/** Seconds. Exit is faster than enter. */
export const duration = {
  instant: 0.08,
  exit: 0.14,
  enter: 0.26,
  slow: 0.42,
} as const

export const ease = {
  /** ease-out expo, for entrances */
  out: [0.16, 1, 0.3, 1],
  in: [0.5, 0, 0.75, 0],
  inOut: [0.65, 0, 0.35, 1],
} as const satisfies Record<string, [number, number, number, number]>

export const enter: Transition = { duration: duration.enter, ease: ease.out }
export const exit: Transition = { duration: duration.exit, ease: ease.in }
