// Where each preview slot can appear, from the official mods reference (render sites):
// Pane, messages, tool rows and the spinner draw on every surface; the band above the prompt,
// command output, the mode label, the hint line, status entries, toasts and notifications draw
// in the terminal and the desktop app; the turn duration line and info notices only in the terminal.
// Mirrored as a comment in schema/registry.d.ts (`SurfacesBySlot`) and published in registry.json.

export const DRAWING_SURFACES = ['terminal', 'desktop', 'vscode']

const EVERYWHERE = ['terminal', 'desktop', 'vscode']
const TERMINAL_DESKTOP = ['terminal', 'desktop']
const TERMINAL = ['terminal']

/** Slots in schema order. */
export const SLOTS = [
  'above-prompt', 'pane', 'status', 'toast', 'notification', 'command', 'tool-deny',
  'prompt-rewrite', 'spinner', 'prompt-hint', 'session-mode', 'turn-duration', 'tool-row',
  'message', 'info-notice', 'model-tool', 'background',
]

export const SURFACES_BY_SLOT = {
  'above-prompt': TERMINAL_DESKTOP,
  pane: EVERYWHERE,
  status: TERMINAL_DESKTOP,
  toast: TERMINAL_DESKTOP,
  notification: TERMINAL_DESKTOP,
  command: TERMINAL_DESKTOP,
  // A refused call shows as a tool row with an error result: every surface draws it.
  'tool-deny': EVERYWHERE,
  // Behaviour: the rewritten prompt is sent wherever the session runs.
  'prompt-rewrite': EVERYWHERE,
  spinner: EVERYWHERE,
  'prompt-hint': TERMINAL_DESKTOP,
  'session-mode': TERMINAL_DESKTOP,
  'turn-duration': TERMINAL,
  'tool-row': EVERYWHERE,
  message: EVERYWHERE,
  'info-notice': TERMINAL,
  'model-tool': EVERYWHERE,
  background: EVERYWHERE,
}

/**
 * Surfaces where every visible element of the mod draws, plus the surfaces its entry says it
 * was tried on (only the three drawing surfaces count). `background` is not visible.
 */
export function drawsOn(slots, declared = []) {
  const visible = slots.filter(s => s !== 'background' && SURFACES_BY_SLOT[s])
  const everywhere = DRAWING_SURFACES.filter(surface => visible.every(s => SURFACES_BY_SLOT[s].includes(surface)))
  const extra = (declared || []).filter(s => DRAWING_SURFACES.includes(s))
  return DRAWING_SURFACES.filter(s => everywhere.includes(s) || extra.includes(s))
}
