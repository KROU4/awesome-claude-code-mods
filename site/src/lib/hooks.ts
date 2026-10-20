import { useLayoutEffect, useSyncExternalStore, type RefObject } from 'react'

/** matchMedia as state. */
export function useMediaQuery(query: string, fallback = false): boolean {
  return useSyncExternalStore(
    (cb) => {
      if (typeof window === 'undefined' || !window.matchMedia) return () => {}
      const mq = window.matchMedia(query)
      mq.addEventListener('change', cb)
      return () => mq.removeEventListener('change', cb)
    },
    () => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(query).matches : fallback),
    () => fallback,
  )
}

/**
 * Marks a sideways-scrolling box while its content runs past an edge: data-overflow="start"
 * (more to the right), "end" (scrolled to the end, more to the left) or "both". CSS fades
 * that edge, so a cut command reads as "scroll", not as a bug.
 */
export function useOverflowEdge(ref: RefObject<HTMLElement | null>): void {
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const check = () => {
      const more = el.scrollWidth - el.clientWidth > 2
      if (!more) {
        delete el.dataset.overflow
        return
      }
      const atStart = el.scrollLeft <= 2
      const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 2
      el.dataset.overflow = atStart ? 'start' : atEnd ? 'end' : 'both'
    }
    check()
    const ro = new ResizeObserver(check)
    ro.observe(el)
    el.addEventListener('scroll', check, { passive: true })
    return () => {
      ro.disconnect()
      el.removeEventListener('scroll', check)
    }
  }, [ref])
}

/** False while the tab is hidden. */
export function usePageVisible(): boolean {
  return useSyncExternalStore(
    (cb) => {
      document.addEventListener('visibilitychange', cb)
      return () => document.removeEventListener('visibilitychange', cb)
    },
    () => document.visibilityState !== 'hidden',
    () => true,
  )
}
