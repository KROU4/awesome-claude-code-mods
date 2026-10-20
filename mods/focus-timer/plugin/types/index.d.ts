export type FocusTimer = {
  /** The session's length, in milliseconds. */
  totalMs: number
  /** When the session ends, in `$.clock.now()` milliseconds; read while running. */
  endsAt: number
  /** Milliseconds left while paused; null while running. */
  pausedRemaining: number | null
  /** True once the session ran out, until dismissed or the next prompt. */
  isDone: boolean
}

declare module 'claude-code' {
  interface PluginState {
    'focus-timer': { timer: FocusTimer | null }
  }
}
