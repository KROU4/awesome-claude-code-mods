import { createContext, useCallback, useContext, useLayoutEffect, useMemo, useState, type ReactNode } from 'react'
import { MotionConfig, useReducedMotion } from 'motion/react'
import { readPref, writePref } from './storage'

// Site-wide "Stop animations" (footer link, WCAG 2.2.2) on top of prefers-reduced-motion.
// When stopped: <html data-motion="off"> kills CSS animations, motion runs with
// reducedMotion="always" (opacity only) and every MockClient renders its final frame.

type MotionPrefValue = {
  /** The person pressed "Stop animations". */
  stopped: boolean
  setStopped: (v: boolean) => void
  toggle: () => void
  /** prefers-reduced-motion: reduce */
  reduced: boolean
  /** Nothing may loop or play by itself: stopped || reduced. */
  still: boolean
}

const Ctx = createContext<MotionPrefValue | null>(null)

export function MotionPrefProvider({ children }: { children: ReactNode }) {
  const [stopped, setStoppedState] = useState(() => readPref('motion') === 'off')
  const reduced = useReducedMotion() ?? false

  useLayoutEffect(() => {
    const html = document.documentElement
    if (stopped) html.setAttribute('data-motion', 'off')
    else html.removeAttribute('data-motion')
  }, [stopped])

  const setStopped = useCallback((v: boolean) => {
    setStoppedState(v)
    writePref('motion', v ? 'off' : null)
  }, [])
  const toggle = useCallback(() => {
    setStoppedState((cur) => {
      writePref('motion', cur ? null : 'off')
      return !cur
    })
  }, [])

  const value = useMemo(
    () => ({ stopped, setStopped, toggle, reduced, still: stopped || reduced }),
    [stopped, setStopped, toggle, reduced],
  )
  return (
    <Ctx.Provider value={value}>
      <MotionConfig reducedMotion={stopped ? 'always' : 'user'}>{children}</MotionConfig>
    </Ctx.Provider>
  )
}

export function useMotionPref(): MotionPrefValue {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useMotionPref() needs <MotionPrefProvider>')
  return ctx
}
