// What the hero's live client plays: one conversation, a default loadout of first-party mods,
// and which catalog mods can be toggled in and out of it.
import type { PreviewElement, SiteMod, Slot, Turn } from '../../data/types'
import type { PreviewInput } from '../mock'

/** Switched on when the page opens, in this order (missing ones are skipped). */
export const DEFAULT_LOADOUT: readonly string[] = ['turn-meter', 'git-glance', 'tool-timeline', 'spinner-pack', 'context-gauge']

/**
 * The conversation behind the mods. It is the same work tool-timeline's pane lists, so the
 * pane and the transcript agree, and it ends with a tool still running, so the spinner stays
 * on and every mod has something to say. Text inside the mock is the client's own English.
 */
export const HERO_SCENE: Turn[] = [
  { role: 'user', text: 'Add percentage discount codes to the cart total and make the tests pass.' },
  { role: 'assistant', text: 'I’ll read the checkout first and find where discounts are applied.' },
  { role: 'tool', tool: 'Read', input: 'src/checkout.ts' },
  { role: 'tool', tool: 'Grep', input: 'applyDiscount' },
  { role: 'tool', tool: 'Edit', input: 'src/cart/total.ts' },
  { role: 'tool', tool: 'Read', input: '.env', status: 'error', result: 'Denied by a permission rule.' },
  { role: 'tool', tool: 'Write', input: 'src/cart/total.test.ts' },
  { role: 'tool', tool: 'Bash', input: 'npm test', status: 'error', result: 'Tests  1 failed | 13 passed (14)' },
  { role: 'assistant', text: 'One case rounds the discount before tax. I’ll round once, on the total.' },
  { role: 'tool', tool: 'Edit', input: 'src/cart/total.ts' },
  { role: 'tool', tool: 'Bash', input: 'npm test', status: 'running' },
]

/**
 * Persistent UI is already there when the page opens, so the first thing a visitor sees is
 * mods at work: the band with the previous turn, the status entry, the hint line, the mode.
 * Panes, toasts and notifications still arrive as the session plays.
 */
export const ON_SCREEN_FROM_START: readonly Slot[] = ['above-prompt', 'status', 'prompt-hint', 'session-mode']

/**
 * The hero opens on its best frame: the persistent UI and the docked pane are there from the
 * first second. Only toasts and notifications wait for the end of the turn.
 */
export const HERO_ON_SCREEN: readonly Slot[] = [...ON_SCREEN_FROM_START, 'pane']

/** Tool Timeline's pane lists this session's tool calls: its rows fill in as the calls happen. */
export const HERO_PANE_FOLLOWS_TOOLS: readonly string[] = ['tool-timeline']

/** The finished session holds this long before the loop restarts at the first tool call. */
export const HERO_HOLD_MS = 9000

/** Slots that draw around the conversation without changing it, so toggling never reflows it. */
const AROUND: ReadonlySet<Slot> = new Set<Slot>([
  'above-prompt',
  'pane',
  'status',
  'toast',
  'notification',
  'prompt-hint',
  'session-mode',
  'spinner',
])

/**
 * Slash commands are left out of the hero: typing one would shift the whole session each
 * time a chip is pressed. The mod's own page shows its commands.
 */
function aroundElements(mod: SiteMod): PreviewElement[] {
  return mod.preview.elements.filter((e) => e.slot !== 'command' && e.slot !== 'background')
}

/** First-party mods whose elements all draw around the conversation. */
export function heroEligible(mod: SiteMod): boolean {
  if (!mod.hosted) return false
  const els = aroundElements(mod)
  return els.length > 0 && els.every((e) => AROUND.has(e.slot))
}

/** The slot a chip names: the mod's first visible element. */
export function leadSlot(mod: SiteMod): Slot | undefined {
  return aroundElements(mod)[0]?.slot ?? mod.preview.elements[0]?.slot
}

/** The mod as the hero client takes it: its elements without commands, keyed by name. */
export function heroPreview(mod: SiteMod): PreviewInput {
  const els = mod.preview.elements.filter((e) => e.slot !== 'command')
  return { elements: els.length ? els : mod.preview.elements, id: mod.name, label: mod.title }
}

/** Chips in a stable order: the default loadout first, then the other eligible mods by title. */
export function heroChips(mods: readonly SiteMod[], extra: readonly string[] = []): SiteMod[] {
  const byName = new Map(mods.map((m) => [m.name, m]))
  const out: SiteMod[] = []
  const seen = new Set<string>()
  const push = (m: SiteMod | undefined) => {
    if (m && !seen.has(m.name)) {
      seen.add(m.name)
      out.push(m)
    }
  }
  for (const n of DEFAULT_LOADOUT) {
    const m = byName.get(n)
    if (m && heroEligible(m)) push(m)
  }
  ;[...mods]
    .filter(heroEligible)
    .sort((a, b) => a.title.localeCompare(b.title))
    .forEach(push)
  for (const n of extra) push(byName.get(n))
  return out
}

// ── "Show together": other parts of the page can ask the hero to play a set of mods ──────

const EVENT = 'showroom:hero-show'

/**
 * Plays these mods together in the hero client and scrolls to it, e.g. from the loadout bar:
 * `showInHero(loadout.names)`. Unknown names are ignored.
 */
export function showInHero(names: readonly string[]): void {
  window.dispatchEvent(new CustomEvent<string[]>(EVENT, { detail: [...names] }))
}

export function onShowInHero(cb: (names: string[]) => void): () => void {
  const handler = (e: Event) => {
    const detail = (e as CustomEvent<unknown>).detail
    if (Array.isArray(detail)) cb(detail.filter((x): x is string => typeof x === 'string'))
  }
  window.addEventListener(EVENT, handler)
  return () => window.removeEventListener(EVENT, handler)
}
