// The playback timeline: when each part of the merged session appears.
//   prompt typed into the input (~28 ms a char, capped at 1.2 s) → submitted as a user row →
//   spinner starts → assistant rows and tool rows (running → done) → the turn ends →
//   each mod element arrives after its anchor → hold 4 s → loop.
// frameAt(schedule, t) is pure: the surfaces draw whatever it returns.
import type { Frame, ItemFrame, MockModel, ModelItem } from './types'

export const HOLD_MS = 4000
const START_MS = 700
const CHAR_MS = 28
const TYPE_CAP_MS = 1200
const SUBMIT_PAUSE_MS = 380
const CHROME_DELAY_MS = 520
const CHROME_STAGGER_MS = 420
const SPINNER_TICK_MS = 500

type Typed = { id: string; text: string; start: number; perChar: number; submit: number }
type ItemTiming = { show: number; done?: number; typeFrom?: number; typeMs?: number; len?: number }

export type Schedule = {
  typed: Typed[]
  items: Record<string, ItemTiming>
  chrome: Record<string, number>
  spinner: { start: number; end: number | null } | null
  /** When the final frame is reached (ms). */
  duration: number
  /** Every moment the frame changes, sorted, for the playback clock. */
  events: number[]
  seconds: number
  tokens: number
}

function toolMs(it: Extract<ModelItem, { kind: 'tool' }>): number {
  if (it.deny) return 520
  switch (it.tool) {
    case 'Bash':
    case 'PowerShell':
      return 1500
    case 'Read':
      return 520
    case 'Grep':
    case 'Search':
    case 'Glob':
      return 640
    default:
      return 760
  }
}

function typing(text: string) {
  const perChar = Math.min(CHAR_MS, TYPE_CAP_MS / Math.max(1, text.length))
  return { perChar, ms: perChar * text.length }
}

export function buildSchedule(model: MockModel): Schedule {
  const typed: Typed[] = []
  const items: Record<string, ItemTiming> = {}
  let t = START_MS
  let spinnerStart: number | null = null
  let spinnerEnd: number | null = null
  const turn = model.turn

  model.items.forEach((it, index) => {
    const inTurn = !!turn && index >= turn.start && index < turn.end
    switch (it.kind) {
      case 'user':
      case 'command':
      case 'rewrite': {
        const text = it.kind === 'user' ? it.text : it.kind === 'command' ? [it.command, it.args].filter(Boolean).join(' ') : it.before
        const { perChar, ms } = typing(text)
        const start = t + 200
        const submit = start + ms + SUBMIT_PAUSE_MS
        typed.push({ id: it.id, text, start, perChar, submit })
        const timing: ItemTiming = { show: submit }
        if (it.kind === 'command') timing.done = submit + 420
        if (it.kind === 'rewrite') timing.done = submit + 650
        items[it.id] = timing
        t = (timing.done ?? submit) + 260
        if (inTurn && spinnerStart === null && it.kind !== 'command') spinnerStart = submit + 160
        break
      }
      case 'assistant': {
        if (inTurn && spinnerStart === null) spinnerStart = t + 100
        const show = t + 560
        items[it.id] = { show }
        t = show + 380 + Math.min(700, ((it.text ?? it.markdown ?? '').length || 40) * 6)
        break
      }
      case 'tool': {
        if (inTurn && spinnerStart === null) spinnerStart = t + 100
        const show = t + 460
        const timing: ItemTiming = { show }
        if (it.status !== 'running') {
          timing.done = show + toolMs(it)
          if (it.deny) {
            const msg = (it.result?.[0]?.[0] as { text?: string } | undefined)?.text ?? ''
            timing.typeFrom = timing.done
            timing.len = msg.length
            timing.typeMs = Math.min(900, msg.length * 11)
          }
        }
        items[it.id] = timing
        t = (timing.done ?? show) + (timing.typeMs ?? 0) + 240
        break
      }
      case 'note': {
        const show = t + 420
        items[it.id] = { show }
        t = show + 300
        break
      }
      case 'turn-end': {
        const show = t + 620
        items[it.id] = { show }
        spinnerEnd = show
        t = show + 300
        break
      }
    }
  })

  const end = t
  const anchorTime = (a: string): number => {
    if (a === 'start') return 0
    if (a === 'turn-end') return items['turn-end']?.show ?? end
    if (a === 'end') return end
    const it = items[a]
    if (!it) return end
    return (it.done ?? it.show) + (it.typeMs ?? 0)
  }
  const chrome: Record<string, number> = {}
  const perAnchor = new Map<string, number>()
  for (const [id, a] of Object.entries(model.anchors)) {
    const k = perAnchor.get(a) ?? 0
    perAnchor.set(a, k + 1)
    chrome[id] = a === 'start' ? 300 + k * 200 : anchorTime(a) + CHROME_DELAY_MS + k * CHROME_STAGGER_MS
  }

  const spinner =
    model.finalPhase === 'idle' || spinnerStart === null
      ? null
      : { start: spinnerStart as number, end: model.finalPhase === 'working' ? null : spinnerEnd }

  const duration = Math.max(end, ...Object.values(chrome), 0) + 300

  // Every change of the frame, so the clock re-renders only when something moves.
  const ev = new Set<number>([0, duration])
  for (const ty of typed) {
    for (let i = 0; i <= ty.text.length; i++) ev.add(Math.round(ty.start + i * ty.perChar))
    ev.add(ty.submit)
  }
  for (const it of Object.values(items)) {
    ev.add(it.show)
    if (it.done !== undefined) ev.add(it.done)
    if (it.typeFrom !== undefined && it.len && it.typeMs) {
      const step = it.typeMs / it.len
      for (let i = 1; i <= it.len; i += 2) ev.add(Math.round(it.typeFrom + i * step))
      ev.add(it.typeFrom + it.typeMs)
    }
  }
  for (const v of Object.values(chrome)) ev.add(v)
  if (spinner) {
    const stop = spinner.end ?? duration
    for (let s = spinner.start; s <= stop; s += SPINNER_TICK_MS) ev.add(Math.round(s))
    ev.add(stop)
  }

  return {
    typed,
    items,
    chrome,
    spinner,
    duration,
    events: [...ev].sort((a, b) => a - b),
    seconds: model.seconds,
    tokens: model.tokens,
  }
}

export function frameAt(s: Schedule, t: number): Frame {
  const final = t >= s.duration
  const items: Record<string, ItemFrame> = {}
  for (const [id, it] of Object.entries(s.items)) {
    if (t < it.show) continue
    if (it.done === undefined || t >= it.done) {
      const f: ItemFrame = { phase: 'done' }
      if (it.typeFrom !== undefined && it.len && it.typeMs) {
        f.chars = t >= it.typeFrom + it.typeMs ? it.len : Math.max(0, Math.floor(((t - it.typeFrom) / it.typeMs) * it.len))
      }
      items[id] = f
    } else items[id] = { phase: 'running' }
  }
  let prompt = ''
  for (const ty of s.typed) {
    if (t >= ty.start && t < ty.submit) {
      prompt = ty.text.slice(0, Math.min(ty.text.length, Math.floor((t - ty.start) / ty.perChar)))
    }
  }
  const chrome: Record<string, true> = {}
  for (const [id, at] of Object.entries(s.chrome)) if (t >= at) chrome[id] = true

  let spinner: Frame['spinner'] = null
  if (s.spinner && t >= s.spinner.start && (s.spinner.end === null || t < s.spinner.end)) {
    const stop = s.spinner.end ?? s.duration
    const p = final ? 1 : Math.min(1, (t - s.spinner.start) / Math.max(1, stop - s.spinner.start))
    spinner = { seconds: Math.max(1, Math.round(p * s.seconds)), tokens: Math.round(p * s.tokens) }
  }
  return { final, prompt, items, chrome, spinner }
}

export function finalFrame(s: Schedule): Frame {
  return frameAt(s, Number.POSITIVE_INFINITY)
}
