export type TimelineStatus = 'running' | 'done' | 'error' | 'denied'

export type TimelineCall = {
  id: string
  tool: string
  /** The path, command or pattern the call was about, on one line. */
  summary: string
  /** The summary is a path: cut from its start, so the file name stays. */
  isPath: boolean
  status: TimelineStatus
  startedAt: number
  /** Set once the call settled. */
  durationMs?: number
  /** Which load of the hooks module watches the call: a reload drops the old load's hooks. */
  load: string
}

declare module 'claude-code' {
  interface PluginState {
    'tool-timeline': {
      calls: TimelineCall[]
      /** The person closed the pane: it no longer opens unasked this session. */
      dismissed: boolean
    }
  }
}
