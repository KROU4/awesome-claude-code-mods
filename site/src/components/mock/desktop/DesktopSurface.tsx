// Desktop surface — the Claude desktop app's Code tab (site-spec "Desktop mock — exact look",
// visual-4.md §4). STUB: renders a "coming" frame. The Desktop owner replaces the body and
// keeps the signature: `export default function DesktopSurface(props: SurfaceProps)`.
//
// What it must draw from `props.model` / `props.frame` (same data as the terminal):
//   top tabs Chat · Cowork · Code (Code active); sidebar with "+ New" and 3 sessions; session
//   title bar with Terminal / Changes / Browser; chat column (user bubble right-aligned on sunk,
//   assistant plain, tool calls as compact rounded rows); prompt box (radius ~.75rem, + left,
//   model chip and usage ring right) with environment · folder · permission mode under it.
//   Mod panes: a pane beside the chat with a header; band: a row above the prompt box with
//   native-looking buttons (Segments variant="native"); status entries: a thin row under the
//   prompt box; toasts top-right inside the window. Slots not drawn here (availability.ts):
//   show <NotDrawnNote/> instead of faking them (MockClient already does when `notes`).
import ComingFrame from '../ComingFrame'
import type { SurfaceProps } from '../types'

export default function DesktopSurface({ rows, onSurfaceChange }: SurfaceProps) {
  return <ComingFrame surface="desktop" rows={rows} onSurfaceChange={onSurfaceChange} />
}
