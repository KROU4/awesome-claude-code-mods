// Public types of the mock client. See src/CONTRACTS.md for the full contract.
import type { CapturedTree, Row, SitePreview, Slot, Turn } from '../../data/types'
import type { MockSurface } from './availability'
import type { TerminalTheme } from './dsl/colors'
import type { SceneName } from './scenes'

export type { MockSurface } from './availability'
export type { TerminalTheme } from './dsl/colors'
export type { SceneName } from './scenes'

/**
 * One mod's preview as MockClient takes it. `id` keys its elements (so toggling a mod
 * animates exactly its elements in and out) and names the plugin on toasts; pass the
 * mod's `name`. Without `id` the index is used.
 */
export type PreviewInput = SitePreview & { id?: string; label?: string }

export type MockClientProps = {
  /** Several mods' previews, merged into one session in this order. */
  previews: PreviewInput[]

  /** Controlled surface. Omit to let the toolbar manage it (starts at `defaultSurface`). */
  surface?: MockSurface
  /** Default: the first preview's `surface`, else 'terminal'. */
  defaultSurface?: MockSurface
  onSurfaceChange?: (surface: MockSurface) => void

  /** Controlled terminal theme. Omit to follow the site theme until the person picks one. */
  terminalTheme?: TerminalTheme
  onTerminalThemeChange?: (theme: TerminalTheme) => void

  /**
   * Terminal layout: classic (false) or fullscreen (true: prompt pinned to the bottom,
   * pane docked right, toasts top-right). 'auto' (default) = on when the viewport is
   * ≥ 960px wide. Ignored in `compact`.
   */
  fullscreen?: boolean | 'auto'
  onFullscreenChange?: (fullscreen: boolean) => void

  /** Play the scripted session (controlled). False pauses; if it never played, shows the final frame. */
  play?: boolean
  onPlayChange?: (play: boolean) => void
  /**
   * Uncontrolled play: start playing on mount (default true). False shows the finished
   * session until the person presses Play or Replay (the detail and loadout sheets).
   */
  autoPlay?: boolean
  /** Loop with a hold at the end (default true). */
  loop?: boolean
  /** How long the final frame holds before the loop restarts, ms (default 4000). */
  holdMs?: number
  /**
   * Where a loop restarts: 'start' (the empty session, default) or 'first-tool' (just before the
   * first tool call, so persistent mod UI stays on screen across loops). Replay always starts at 0.
   */
  loopFrom?: 'start' | 'first-tool'
  /** Change the number to restart playback from the beginning (external Replay button). */
  replayKey?: number

  /** Override the conversation drawn behind the mods (default: the first preview's scene/transcript). */
  scene?: SceneName | Turn[]

  /**
   * Chrome of these slots is on screen from the start of the session (persistent UI such as a
   * status entry or a band showing the previous turn) instead of arriving after the mod's last
   * transcript element. The hero uses it so mods are visible the moment the page opens.
   */
  arriveAtStart?: readonly Slot[]

  /**
   * Preview ids just switched on (a new array each time): their elements show from this
   * moment instead of waiting for their anchor (until the session loops).
   */
  arriveNow?: readonly string[]

  /** Mods (preview ids) whose pane lists the session's tool calls: its rows appear one per call. */
  paneFollowsTools?: readonly string[]

  /** Outline every element this mod (preview id) draws, e.g. while its chip is hovered. */
  highlight?: string | null

  /**
   * Card mode: no window chrome, no toolbar, no loop (a single entrance), cropped to the
   * bottom of the session where the mod's elements are, ~10 rows tall.
   */
  compact?: boolean
  /** Screen height in terminal rows (default 26; compact 10). */
  rows?: number

  /** Built-in toolbar: surface tabs, terminal theme, fullscreen, pause/play, replay (default true, false in compact). */
  toolbar?: boolean
  /** Show the "Not drawn in …" note when the surface skips some of the mod's elements (default true). */
  notes?: boolean

  /** Motion layoutId on the window frame (catalog card → detail sheet). Needs domMax features loaded. */
  layoutId?: string
  className?: string
  /** Accessible name; default describes the surface and the mods. */
  label?: string
}

// ── The merged session (built by model.ts) ─────────────────────────────────────────────

export type ToolStatus = 'done' | 'running' | 'error'

export type ModelItem =
  | { kind: 'user'; id: string; text: string; source?: string }
  | { kind: 'assistant'; id: string; text?: string; rows?: Row[]; markdown?: string; source?: string }
  | {
      kind: 'tool'
      id: string
      tool: string
      input: string
      status: ToolStatus
      /** Redrawn tool line (tool-row `row`), drawn after the marker instead of Tool(input). */
      row?: Row
      result?: Row[]
      /** tool-deny: the result is the refusal, typed in the error color. */
      deny?: boolean
      /** model-tool: a tool the mod registered for Claude. */
      modelTool?: boolean
      source?: string
    }
  | { kind: 'command'; id: string; command: string; args?: string; output?: Row[]; markdown?: string; source: string }
  | { kind: 'rewrite'; id: string; before: string; after: string; source: string }
  | { kind: 'note'; id: string; rows?: Row[]; markdown?: string; source: string }
  | { kind: 'turn-end'; id: string; text: string; source?: string }

export type ChromeBase = { id: string; source: string; slot: Slot }

export type ModelChrome = {
  bands: (ChromeBase & { rows: Row[]; tree?: CapturedTree })[]
  panes: (ChromeBase & { title: string; rows: Row[]; width: 'narrow' | 'wide'; tree?: CapturedTree; followTools?: boolean })[]
  statuses: (ChromeBase & { text: string })[]
  toasts: (ChromeBase & { text: string })[]
  notifications: (ChromeBase & { title?: string; text: string })[]
  hints: (ChromeBase & { row: Row; tree?: CapturedTree })[]
  modes: (ChromeBase & { row: Row; tree?: CapturedTree })[]
  infoNotices: (ChromeBase & { row: Row })[]
  backgrounds: (ChromeBase & { text: string })[]
}

export type MockModel = {
  items: ModelItem[]
  chrome: ModelChrome
  /** Where every chrome element arrives: after this item id, or at the turn end / start. */
  anchors: Record<string, string | 'start' | 'turn-end' | 'end'>
  spinner: { verb: string; glyphs?: string[]; color?: string; source?: string; tree?: CapturedTree }
  /** working: the spinner stays on in the final frame; done: the turn ended; idle: no turn. */
  finalPhase: 'working' | 'done' | 'idle'
  /** Index range [start, end) of the work turn in `items` (the spinner runs during it). */
  turn: { start: number; end: number } | null
  seconds: number
  tokens: number
  /** Every element of every preview, for availability notes. */
  elements: { id: string; source: string; slot: Slot }[]
  /** Preview ids in order, with labels. */
  sources: { id: string; label: string }[]
}

// ── Playback (timeline.ts) ─────────────────────────────────────────────────────────────

export type ItemFrame = { phase: 'running' | 'done'; /** chars of a typed result (deny) */ chars?: number }

export type Frame = {
  /** True once everything has arrived (also for reduced motion and for still mocks). */
  final: boolean
  /** Text in the prompt input right now. */
  prompt: string
  /** Visible transcript items (absent = not yet). */
  items: Record<string, ItemFrame>
  /** Visible chrome element ids. */
  chrome: Record<string, true>
  /** Panes that fill in as tools run: how many of their rows show (absent = all). */
  paneRows: Record<string, number>
  spinner: { seconds: number; tokens: number } | null
}

/** What every surface renderer (terminal, desktop, vscode) receives. */
export type SurfaceProps = {
  model: MockModel
  frame: Frame
  /** Terminal surface: the terminal theme. Desktop and VS Code: the app theme. */
  terminalTheme: TerminalTheme
  fullscreen: boolean
  compact: boolean
  rows: number
  /** Animations allowed right now (playing, on screen, no reduced motion). */
  animate: boolean
  /** Changes on every loop / replay; surfaces may key a fade on it. */
  cycle: number
}
