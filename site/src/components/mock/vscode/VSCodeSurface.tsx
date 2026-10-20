// VS Code surface — the Claude Code chat panel in VS Code (site-spec "Surfaces"). STUB:
// renders a "coming" frame. The VS Code owner replaces the body and keeps the signature:
// `export default function VSCodeSurface(props: SurfaceProps)`.
//
// What it must draw: a VS Code-like window (activity bar, dimmed editor area) with the
// Claude Code panel as a narrow right sidebar: messages, tool rows, the prompt box. Mod
// panes inside the panel; toasts as VS Code notifications at the bottom-right
// (availability.ts VSCODE_AS_NOTIFICATION). Band, status, hint, mode, command output,
// turn duration and info notice are not drawn in VS Code: MockClient shows the
// "Not drawn in VS Code" note for them.
import ComingFrame from '../ComingFrame'
import type { SurfaceProps } from '../types'

export default function VSCodeSurface({ rows, onSurfaceChange }: SurfaceProps) {
  return <ComingFrame surface="vscode" rows={rows} onSurfaceChange={onSurfaceChange} />
}
