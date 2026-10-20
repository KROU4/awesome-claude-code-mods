// Where each preview slot (and each ui.render element type) is drawn, per surface.
// SLOT_SURFACES mirrors the repository's scripts/lib/surfaces.mjs exactly (published as
// registry.json `surfacesBySlot`, used for each mod's `drawsOn`), so the mock and the
// "Works on" chips never disagree. Sources: the official mods reference (render sites),
// site-spec "Surfaces", _specs/research/visual-4.md §3.7, api-0.md §1–3.
import type { PreviewElement, Slot, Surface } from '../../data/types'

/** Surfaces the mock can show. ('mobile' exists in the API but has no mock.) */
export type MockSurface = 'terminal' | 'desktop' | 'vscode'
export const MOCK_SURFACES: readonly MockSurface[] = ['terminal', 'desktop', 'vscode']

const ALL: readonly MockSurface[] = ['terminal', 'desktop', 'vscode']
const TD: readonly MockSurface[] = ['terminal', 'desktop']
const T: readonly MockSurface[] = ['terminal']

/**
 * Slot → surfaces that draw it.
 * - everywhere: Pane, User/AssistantMessage, ToolUse/ToolResult (a refused call is a tool row
 *   with an error result), Spinner, and behaviour with no drawing of its own (prompt rewrite,
 *   a tool for Claude, background work).
 * - terminal + desktop: AbovePrompt, CommandOutput, SessionMode, PromptHint, $.ui.status,
 *   $.ui.toast, $.ui.notify.
 * - terminal only: TurnDuration, InfoNotice.
 * Caveat from research (api-0.md §3): on desktop `$.ui.notify` answers `no-surface` and mods
 * such as done-ping fall back to a toast; the desktop renderer may draw it as that toast.
 */
export const SLOT_SURFACES: Record<Slot, readonly MockSurface[]> = {
  'above-prompt': TD,
  pane: ALL,
  status: TD,
  toast: TD,
  notification: TD,
  command: TD,
  'tool-deny': ALL,
  'prompt-rewrite': ALL,
  spinner: ALL,
  'prompt-hint': TD,
  'session-mode': TD,
  'turn-duration': T,
  'tool-row': ALL,
  message: ALL,
  'info-notice': T,
  'model-tool': ALL,
  background: ALL,
}

/**
 * Slots the VS Code mock shows in another form instead of the "Not drawn" note:
 * toasts appear as VS Code notifications at the bottom-right (site-spec "Surfaces").
 */
export const VSCODE_AS_NOTIFICATION: ReadonlySet<Slot> = new Set<Slot>(['toast'])

/** ui.render element types → surfaces (Raster/Image terminal only; Svg everywhere but the terminal). */
export const ELEMENT_SURFACES: Record<string, readonly Surface[]> = {
  Box: ['terminal', 'desktop', 'vscode', 'mobile'],
  Text: ['terminal', 'desktop', 'vscode', 'mobile'],
  Button: ['terminal', 'desktop', 'vscode', 'mobile'],
  Link: ['terminal', 'desktop', 'vscode', 'mobile'],
  Code: ['terminal', 'desktop', 'vscode', 'mobile'],
  Markdown: ['terminal', 'desktop', 'vscode', 'mobile'],
  Input: ['terminal', 'desktop', 'vscode'],
  Select: ['terminal', 'desktop', 'vscode'],
  Svg: ['desktop', 'vscode', 'mobile'],
  Client: ['terminal', 'desktop'],
  Raster: ['terminal'],
  Image: ['terminal'],
}

export function isDrawnOn(slot: Slot, surface: MockSurface): boolean {
  return SLOT_SURFACES[slot].includes(surface)
}

/**
 * The distinct slots of `elements` that `surface` does not draw — for the "Not drawn in …"
 * note under the mock. Slots VS Code shows in another form are not listed for VS Code.
 */
export function undrawnSlots(elements: readonly Pick<PreviewElement, 'slot'>[], surface: MockSurface): Slot[] {
  return [...new Set(elements.map((e) => e.slot))].filter(
    (s) => !isDrawnOn(s, surface) && !(surface === 'vscode' && VSCODE_AS_NOTIFICATION.has(s)),
  )
}

export type SurfaceSupport = 'full' | 'partial' | 'none'

/**
 * Per surface: every visible element is drawn there ('full'), some are ('partial') or none
 * ('none'). `background` is not visible and does not count. Same rule as the registry's
 * `drawsOn` (which is the list of 'full' surfaces plus declared ones); prefer `mod.drawsOn`
 * for the chips and use this for the finer partial/none distinction.
 */
export function worksOn(
  elements: readonly Pick<PreviewElement, 'slot'>[],
  declared?: readonly Surface[],
): Record<MockSurface, SurfaceSupport> {
  const out = {} as Record<MockSurface, SurfaceSupport>
  const slots = [...new Set(elements.map((e) => e.slot))].filter((s) => s !== 'background')
  for (const s of MOCK_SURFACES) {
    const drawn = slots.filter((slot) => isDrawnOn(slot, s)).length
    let v: SurfaceSupport = slots.length === 0 ? 'full' : drawn === slots.length ? 'full' : drawn > 0 ? 'partial' : 'none'
    if (declared?.includes(s) && v !== 'full') v = 'full'
    out[s] = v
  }
  return out
}
