// What a catalog card draws: the mod's most characteristic element, alone, in a compact
// terminal crop. The detail sheet shows the whole preview.
import type { PreviewElement, Row, SiteMod, Slot, Turn } from '../../data/types'
import { rowText, SCENES, type PreviewInput, type SceneName } from '../mock'

/**
 * Terminal rows of a card's mock. The prompt takes two of them (its top rule and the ❯ line),
 * the mod's element the rest; a taller element shows from its first row (TerminalSurface).
 */
export const CARD_ROWS = 10

/** Elements that rarely say what a mod is about when they come first. */
const WEAK_FIRST = new Set<Slot>(['command', 'background', 'toast', 'prompt-rewrite'])

/** When the first element is weak: the most visible slot wins. */
const PRIORITY: Slot[] = [
  'above-prompt',
  'pane',
  'tool-deny',
  'spinner',
  'prompt-hint',
  'session-mode',
  'status',
  'tool-row',
  'model-tool',
  'notification',
  'message',
  'toast',
  'command',
  'prompt-rewrite',
  'turn-duration',
  'info-notice',
]

export function primaryElement(elements: readonly PreviewElement[]): PreviewElement | undefined {
  const first = elements.find((e) => !WEAK_FIRST.has(e.slot))
  if (first) return first
  for (const slot of PRIORITY) {
    const el = elements.find((e) => e.slot === slot)
    if (el) return el
  }
  return elements[0]
}

const hasButton = (row: Row) => row.some((s) => typeof s === 'object' && 'button' in s)

/**
 * A pane taller than the card keeps its top rows (title, the point of it) and its last
 * row when that row holds the buttons; a dim ellipsis marks the cut.
 */
function cropPane(el: Extract<PreviewElement, { slot: 'pane' }>, budget: number): PreviewElement {
  if (el.rows.length <= budget) return el
  const last = el.rows[el.rows.length - 1]
  const keepLast = hasButton(last)
  const head = el.rows.slice(0, budget - (keepLast ? 2 : 1))
  const cut: Row = [{ text: '  …', dim: true }]
  return { ...el, rows: keepLast ? [...head, cut, last] : [...head, cut] }
}

/** Elements drawn inside the transcript: the card ends the conversation on them. */
const IN_TRANSCRIPT = new Set<Slot>(['tool-deny', 'tool-row', 'model-tool', 'message'])

function sceneTurns(name: SceneName): Turn[] {
  return SCENES[name].turns.map((t): Turn =>
    t.role === 'tool' ? { role: 'tool', tool: t.tool, input: t.input, status: t.status, result: t.result?.map(rowText).join('\n') } : t,
  )
}

/**
 * The conversation up to its last tool call: the closing summary would push a transcript
 * element out of a 12-row crop, so the card ends on the element itself.
 */
function leadIn(p: SiteMod['preview']): Turn[] {
  const turns = p.transcript?.length ? [...p.transcript] : sceneTurns(p.scene ?? 'coding')
  while (turns.length > 1 && turns[turns.length - 1].role === 'assistant') turns.pop()
  return turns
}

/** The card's preview: one element, cropped to fit, with the mod's own conversation behind it. */
export function cardPreview(mod: SiteMod): PreviewInput {
  const p = mod.preview
  const el = primaryElement(p.elements)
  // pane frame (2) + the prompt's rule and ❯ line (2)
  const paneBudget = CARD_ROWS - 4
  const elements = el ? [el.slot === 'pane' ? cropPane(el, paneBudget) : el] : []
  const transcript = el && IN_TRANSCRIPT.has(el.slot) ? leadIn(p) : p.transcript
  return { ...p, transcript, elements, id: mod.name, label: mod.title }
}

/** The full preview, as the detail sheet and the loadout show it. */
export function fullPreview(mod: SiteMod): PreviewInput {
  return { ...mod.preview, id: mod.name, label: mod.title }
}
