// The playback clock. Runs on requestAnimationFrame but re-renders only when the frame
// changes (at the schedule's event times). Pauses off-screen, in a hidden tab and when
// `play` is off; `still` (reduced motion, "Stop animations", compact cards) jumps to the end.
import { useEffect, useRef, useState } from 'react'
import { HOLD_MS, type Schedule } from './timeline'

export type PlaybackOptions = {
  /** Wanted by the host (the `play` prop). */
  play: boolean
  /** On screen and the tab is visible. */
  visible: boolean
  /** Show the final frame, no clock. */
  still: boolean
  loop: boolean
  replayKey: number
}

export type Playback = {
  /** Current time in ms (quantized to the last event); +Infinity = final frame. */
  t: number
  /** Increments on every loop and replay. */
  cycle: number
  /** The clock is running right now. */
  running: boolean
}

function lastEventAtOrBefore(events: number[], t: number): number {
  let lo = 0
  let hi = events.length - 1
  if (hi < 0 || t < events[0]) return 0
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if (events[mid] <= t) lo = mid
    else hi = mid - 1
  }
  return events[lo]
}

export function usePlayback(schedule: Schedule, opts: PlaybackOptions): Playback {
  const { play, visible, still, loop, replayKey } = opts
  const [t, setT] = useState(0)
  const [cycle, setCycle] = useState(0)
  const acc = useRef(0)
  const startedAt = useRef<number | null>(null)
  const hasPlayed = useRef(false)
  const lastQ = useRef(0)
  const scheduleRef = useRef(schedule)
  scheduleRef.current = schedule

  const running = play && visible && !still

  // Replay: back to the start.
  const firstReplay = useRef(true)
  useEffect(() => {
    if (firstReplay.current) {
      firstReplay.current = false
      return
    }
    acc.current = 0
    lastQ.current = 0
    startedAt.current = running ? performance.now() : null
    setT(0)
    setCycle((c) => c + 1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [replayKey])

  useEffect(() => {
    if (!running) return
    hasPlayed.current = true
    startedAt.current = performance.now()
    let raf = 0
    const tick = (now: number) => {
      const s = scheduleRef.current
      const elapsed = acc.current + (now - (startedAt.current ?? now))
      if (elapsed >= s.duration + HOLD_MS) {
        if (loop) {
          acc.current = 0
          startedAt.current = now
          lastQ.current = 0
          setT(0)
          setCycle((c) => c + 1)
        } else {
          acc.current = s.duration
          startedAt.current = now
          if (lastQ.current !== s.duration) {
            lastQ.current = s.duration
            setT(s.duration)
          }
          return
        }
      } else {
        const q = elapsed >= s.duration ? s.duration : lastEventAtOrBefore(s.events, elapsed)
        if (q !== lastQ.current) {
          lastQ.current = q
          setT(q)
        }
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      if (startedAt.current !== null) acc.current += performance.now() - startedAt.current
      startedAt.current = null
    }
  }, [running, loop])

  if (still) return { t: Number.POSITIVE_INFINITY, cycle, running: false }
  // Asked not to play and never played: show the finished session, not an empty one.
  if (!play && !hasPlayed.current) return { t: Number.POSITIVE_INFINITY, cycle, running: false }
  return { t, cycle, running }
}
