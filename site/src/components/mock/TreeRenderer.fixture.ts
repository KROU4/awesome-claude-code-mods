// Fixtures for TreeRenderer (terminal) and desktop/NativeTree: a "Test run" pane that uses
// every element type, shaped like the RenderElement JSON `claude plugin test` captures.
// TREE_FIXTURE is valid on the terminal (Raster, no Svg); NATIVE_TREE_FIXTURE is valid on
// desktop and VS Code (Svg, no Raster). Use them as `capturedTrees` in a preview:
//   { component: 'Pane', surface: 'terminal', tree: TREE_FIXTURE }
import type { RenderElement } from '../../data/types'

const el = (type: string, props: Record<string, unknown> = {}, ...children: (RenderElement | string)[]): RenderElement => ({
  type,
  props,
  children,
})

/** `cells` for a Raster: base64 of little-endian u32 triples [codePoint, fg, bg]. */
export function encodeRaster(columns: number, rows: number, cell: (c: number, r: number) => [string, number, number]): string {
  const buf = new DataView(new ArrayBuffer(columns * rows * 12))
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < columns; c++) {
      const [ch, fg, bg] = cell(c, r)
      const o = (r * columns + c) * 12
      buf.setUint32(o, ch.codePointAt(0) ?? 32, true)
      buf.setUint32(o + 4, fg, true)
      buf.setUint32(o + 8, bg, true)
    }
  }
  let bin = ''
  const bytes = new Uint8Array(buf.buffer)
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  return btoa(bin)
}

const DEFAULT = 0x01000000
/** Test durations of the last 16 runs, in tenths of the slowest: a 3-row bar chart. */
const RUNS = [4, 5, 5, 6, 4, 7, 6, 5, 9, 6, 5, 4, 5, 6, 5, 3]
const RASTER = encodeRaster(16, 3, (c, r) => {
  const h = RUNS[c] / 9 * 6 // half-rows filled
  const bottom = (2 - r) * 2 // half-rows below this row
  const fill = h - bottom
  const fg = RUNS[c] >= 9 ? 0xe5484d : 0x4eba65
  if (fill >= 2) return ['█', fg, DEFAULT]
  if (fill >= 1) return ['▄', fg, DEFAULT]
  return [' ', DEFAULT, DEFAULT]
})

const header = el(
  'Box',
  { flexDirection: 'row', justifyContent: 'space-between' },
  el('Text', { weight: 'bold' }, 'Checkout tests'),
  el('Text', { color: 'success', weight: 'semibold' }, '14 passed'),
)

const meta = el('Text', { dimColor: true, size: 'footnote' }, 'vitest · src/cart · 1.8s')

const summary = el(
  'Box',
  { borderStyle: 'round', borderColor: 'claude', paddingX: 1, flexDirection: 'column' },
  el('Markdown', { text: '**3 files** changed. `cartTotal()` now rounds once, at the end.' }),
)

const diff = el('Code', {
  format: 'diff',
  language: 'ts',
  startLine: 40,
  source: [
    '@@ -40,4 +40,4 @@',
    ' export function cartTotal(lines: CartLine[]) {',
    '-  return lines.reduce((s, l) => s + round(l.total), 0)',
    '+  return round(lines.reduce((s, l) => s + l.total, 0))',
    ' }',
  ].join('\n'),
})

const styles = el(
  'Box',
  { flexDirection: 'row', gap: 'sm' },
  el('Text', { inverse: true, color: 'success' }, ' PASS '),
  el('Text', { italic: true }, 'total.test.ts'),
  el('Text', { underline: true }, 'shared discount'),
  el('Text', { strikethrough: true, dimColor: true }, 'flaky'),
)

const actions = el(
  'Box',
  { flexDirection: 'row', gap: 'sm', alignItems: 'center', flexWrap: 'wrap' },
  el('Button', { label: 'Rerun', hotkey: 'r', variant: 'primary' }),
  el('Button', { label: 'Open report', hotkey: 'o' }),
  el('Link', { label: 'CI run #418', href: 'https://github.com/acme/shop/actions/runs/418' }),
)

const quote = el(
  'Box',
  { borderStyle: 'quote', borderColor: 'warning' },
  el('Text', { italic: true, color: 'warning' }, 'pricing.test.ts took 0.9s, the slowest run this week'),
)

const note = el('Input', { key: 'note', label: 'Note', placeholder: 'Type a note and press Enter' })
const runOn = el('Select', {
  key: 'runOn',
  label: 'Run tests on',
  value: 'commit',
  options: [
    { value: 'save', label: 'Every save' },
    { value: 'commit', label: 'Every commit' },
    { value: 'push', label: 'Before push' },
  ],
})

/** Terminal: every element the terminal draws, Raster included. */
export const TREE_FIXTURE: RenderElement = el(
  'Box',
  { flexDirection: 'column', gap: 'md' },
  el('Box', { flexDirection: 'column' }, header, meta),
  summary,
  diff,
  el(
    'Box',
    { flexDirection: 'row', gap: 'md', alignItems: 'flex-end' },
    el('Raster', { key: 'runs', columns: 16, rows: 3, cells: RASTER }),
    el('Text', { dimColor: true }, 'last 16 runs'),
  ),
  styles,
  quote,
  actions,
  el('Box', { flexDirection: 'column', gap: 'md' }, note, runOn),
)

const SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 36"><g fill="#4eba65">' +
  RUNS.map((v, i) => `<rect x="${i * 10 + 1}" y="${36 - v * 4}" width="7" height="${v * 4}" rx="1.5"${v >= 9 ? ' fill="#e5484d"' : ''}/>`).join('') +
  '</g></svg>'

/** Desktop and VS Code: the same pane with an Svg chart in place of the Raster. */
export const NATIVE_TREE_FIXTURE: RenderElement = el(
  'Box',
  { flexDirection: 'column', gap: 'md' },
  el('Box', { flexDirection: 'column' }, header, meta),
  summary,
  diff,
  el(
    'Box',
    { flexDirection: 'row', gap: 'md', alignItems: 'flex-end' },
    el('Svg', { source: SVG, alt: 'Durations of the last 16 test runs', width: 160, height: 36 }),
    el('Text', { dimColor: true, size: 'footnote' }, 'last 16 runs'),
  ),
  styles,
  quote,
  actions,
  el('Box', { flexDirection: 'column', gap: 'md' }, note, runOn),
)
