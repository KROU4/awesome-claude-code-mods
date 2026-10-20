// TreeRenderer — draws a captured `ui.render` tree (the engine's RenderElement JSON) in
// terminal style, cell for cell, as Claude Code's Ink renderer would (api-0.md §2,
// visual-4.md §3.7):
//   Box     flexDirection / gap (column, row) / padding* / margin* / width, height (cells
//           or %) / flexGrow·Shrink·Wrap / align* / justifyContent / overflow / display /
//           position absolute; borderStyle single round double bold dashed classic quote
//           (singleDouble, doubleSingle, arrow fall back to the nearest frame; any other
//           value draws no frame), borderColor, borderDimColor, backgroundColor.
//   Text    color, backgroundColor, dimColor, bold / weight, italic, underline,
//           strikethrough, inverse, wrap="truncate*".
//   Button  `[ label ]`, primary brackets in the accent, `[ h: Hide ]` with a hotkey,
//           `1: label` when plain.
//   Link    the label, then the URL dimmed.
//   Markdown, Code (startLine gutter, format="diff" with diffAdded / diffRemoved rows),
//   Raster  (base64 u32 triples [codePoint, fg, bg]; 0x01000000 = the terminal's color),
//   Image   (its alt text, as terminals without the kitty protocol show it),
//   Input, Select.
// Svg and Client do not draw in a terminal (the engine rejects such trees): a dim mark.
//
// Contract: <TreeRenderer tree={RenderElement} inline? /> renders inside a `.tm` terminal
// root (it uses the --t-* theme variables, 1ch cells and the --row height).
// The desktop and VS Code counterpart is ./desktop/NativeTree.tsx.
import type { CSSProperties, ReactNode } from 'react'
import type { RenderElement } from '../../data/types'
import { resolveColor } from './dsl/colors'
import { Markdown } from './dsl/markdown'
import { cells as cellText } from './terminal/cells'

export type TreeRendererProps = {
  tree: RenderElement
  /** Render as inline spans (inside a single row, e.g. the hint line). */
  inline?: boolean
}

type P = Record<string, unknown>

/** Space steps (d.ts:12326): horizontal xs/sm 1, md 2, lg 3, xl 4; vertical xs/sm 0, md/lg 1, xl 2. */
const SPACE_X: Record<string, number> = { xs: 1, sm: 1, md: 2, lg: 3, xl: 4 }
const SPACE_Y: Record<string, number> = { xs: 0, sm: 0, md: 1, lg: 1, xl: 2 }

function cells(v: unknown, axis: 'x' | 'y'): number | undefined {
  if (typeof v === 'number') return v
  if (typeof v === 'string') return axis === 'x' ? SPACE_X[v] : SPACE_Y[v]
  return undefined
}

const cx = (n: number | undefined) => (n === undefined ? undefined : `${n}ch`)
const cy = (n: number | undefined) => (n === undefined ? undefined : `calc(${n} * var(--row))`)

/** Width / height: a number of cells (rows), or a CSS string such as "50%". */
function dim(v: unknown, axis: 'x' | 'y'): string | undefined {
  if (typeof v === 'number') return axis === 'x' ? cx(v) : cy(v)
  if (typeof v === 'string' && /^\d+(\.\d+)?%$/.test(v)) return v
  return undefined
}

/** Frame styles the terminal CSS draws (.tm-box[data-border]); the rest map to the nearest. */
const BORDER: Record<string, string> = {
  single: 'single',
  round: 'round',
  double: 'double',
  bold: 'bold',
  dashed: 'dashed',
  classic: 'classic',
  quote: 'quote',
  singleDouble: 'single',
  doubleSingle: 'double',
  arrow: 'dashed',
}

function textStyle(p: P): CSSProperties {
  const style: CSSProperties = {}
  const fg = resolveColor(p.color as string | undefined)
  const bg = resolveColor(p.backgroundColor as string | undefined)
  if (p.inverse) {
    style.color = bg ?? 'var(--t-canvas)'
    style.backgroundColor = fg ?? 'var(--t-text)'
  } else {
    if (fg) style.color = fg
    if (bg) style.backgroundColor = bg
  }
  if (p.bold || p.weight === 'bold' || p.weight === 'semibold') style.fontWeight = 700
  if (p.italic) style.fontStyle = 'italic'
  const deco = [p.underline && 'underline', p.strikethrough && 'line-through'].filter(Boolean).join(' ')
  if (deco) style.textDecorationLine = deco
  if (p.dimColor) style.opacity = 0.6
  if (typeof p.wrap === 'string' && p.wrap.startsWith('truncate')) {
    style.display = 'inline-block'
    style.maxWidth = '100%'
    style.overflow = 'hidden'
    style.whiteSpace = 'pre'
    style.textOverflow = 'ellipsis'
    style.verticalAlign = 'top'
    if (p.wrap === 'truncate-start') style.direction = 'rtl'
  }
  return style
}

function plain(el: RenderElement): string {
  return (el.children ?? []).map((c) => (typeof c === 'string' ? c : plain(c))).join('')
}

function kids(el: RenderElement, inline: boolean): ReactNode[] {
  return (el.children ?? []).map((c, i) => (typeof c === 'string' ? cellText(c) : <Node key={i} el={c} inline={inline} />))
}

// ── Raster ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_COLOR = 0x01000000

function hex(c: number): string | undefined {
  if (c === DEFAULT_COLOR || c > 0xffffff) return undefined
  return `#${c.toString(16).padStart(6, '0')}`
}

/** Decode `cells` (base64 of little-endian u32 triples) into rows of [char, fg, bg]. */
export function decodeRaster(b64: string, columns: number, rows: number): [string, number, number][][] {
  let bytes: Uint8Array
  try {
    const bin = atob(b64)
    bytes = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  } catch {
    return []
  }
  const view = new DataView(bytes.buffer)
  const out: [string, number, number][][] = []
  for (let r = 0; r < rows; r++) {
    const row: [string, number, number][] = []
    for (let c = 0; c < columns; c++) {
      const o = (r * columns + c) * 12
      if (o + 12 > bytes.length) {
        row.push([' ', DEFAULT_COLOR, DEFAULT_COLOR])
        continue
      }
      const cp = view.getUint32(o, true)
      row.push([cp ? String.fromCodePoint(cp) : ' ', view.getUint32(o + 4, true), view.getUint32(o + 8, true)])
    }
    out.push(row)
  }
  return out
}

function Raster({ p }: { p: P }) {
  const columns = Math.max(1, Math.min(512, Number(p.columns) || 1))
  const rows = Math.max(1, Math.min(256, Number(p.rows) || 1))
  const grid = decodeRaster(String(p.cells ?? ''), columns, rows)
  return (
    <div className="tm-raster" style={{ width: `${columns}ch` }}>
      {grid.map((row, ri) => {
        // Runs of the same colors become one span.
        const runs: { text: string; fg: number; bg: number }[] = []
        for (const [ch, fg, bg] of row) {
          const last = runs[runs.length - 1]
          if (last && last.fg === fg && last.bg === bg) last.text += ch
          else runs.push({ text: ch, fg, bg })
        }
        return (
          <div className="tl is-clip" key={ri}>
            {runs.map((r, i) => (
              <span key={i} style={{ color: hex(r.fg), backgroundColor: hex(r.bg) }}>
                {cellText(r.text)}
              </span>
            ))}
          </div>
        )
      })}
    </div>
  )
}

// ── Code ───────────────────────────────────────────────────────────────────────────────

function Code({ p }: { p: P }) {
  const src = String(p.source ?? '').replace(/\n$/, '')
  const lines = src.split('\n')
  const diff = p.format === 'diff'
  const start = typeof p.startLine === 'number' ? p.startLine : diff ? 1 : null
  const truncate = p.wrap === 'truncate-end'
  // Diff numbers: context and added lines count the new file, removed lines the old one.
  let oldN = start ?? 1
  let newN = start ?? 1
  const rows = lines.map((l) => {
    let kind: 'add' | 'rem' | 'hunk' | 'ctx' = 'ctx'
    if (diff) {
      if (l.startsWith('@@')) {
        kind = 'hunk'
        const m = /@@ -(\d+)(?:,\d+)? \+(\d+)/.exec(l)
        if (m) {
          oldN = Number(m[1])
          newN = Number(m[2])
        }
      } else if (l.startsWith('+')) kind = 'add'
      else if (l.startsWith('-')) kind = 'rem'
    }
    let n: number | null = null
    if (start !== null && kind !== 'hunk') {
      if (kind === 'rem') n = oldN++
      else if (kind === 'add') n = newN++
      else {
        n = newN++
        oldN++
      }
    }
    return { l, kind, n }
  })
  const gutter = start === null ? 0 : String(Math.max(...rows.map((r) => r.n ?? 0), 1)).length
  return (
    <div className="tm-code">
      {rows.map(({ l, kind, n }, i) => (
        <div
          key={i}
          className={truncate ? 'tl is-clip' : 'tl'}
          style={
            kind === 'add'
              ? { backgroundColor: 'var(--t-diffAdded)' }
              : kind === 'rem'
                ? { backgroundColor: 'var(--t-diffRemoved)' }
                : undefined
          }
        >
          {gutter ? (
            <span className="is-dim">
              {(n === null ? '' : String(n)).padStart(gutter)}
              {' '}
            </span>
          ) : null}
          <span className={kind === 'hunk' ? 'is-dim' : diff ? undefined : 'md-code'}>{l || ' '}</span>
        </div>
      ))}
    </div>
  )
}

// ── the tree ───────────────────────────────────────────────────────────────────────────

function Node({ el, inline }: { el: RenderElement; inline: boolean }): ReactNode {
  const p = (el.props ?? {}) as P
  switch (el.type) {
    case 'Text':
      return <span style={textStyle(p)}>{kids(el, true)}</span>
    case 'Button': {
      const label = (p.label as string | undefined) ?? null
      const style = p.dimColor ? { opacity: 0.6 } : undefined
      if (p.plain) {
        return (
          <span className="tseg-btn" style={style}>
            {p.hotkey ? `${String(p.hotkey)}: ` : null}
            {label}
            {kids(el, true)}
          </span>
        )
      }
      return (
        <span className="tseg-btn" data-variant={p.variant === 'primary' ? 'primary' : 'secondary'} style={style}>
          <span className="tseg-brk">[ </span>
          {p.hotkey ? <span className="is-dim">{String(p.hotkey)}: </span> : null}
          {label}
          {kids(el, true)}
          <span className="tseg-brk"> ]</span>
        </span>
      )
    }
    case 'Link': {
      const href = (p.href as string | undefined) ?? ''
      const label = (p.label as string | undefined) ?? plain(el)
      if (!label || label === href) return <span className="tseg-link">{href}</span>
      return (
        <span>
          <span className="tseg-link">{label}</span> <span className="is-dim">{href}</span>
        </span>
      )
    }
    case 'Markdown':
      if (inline) return <span style={p.dimColor ? { opacity: 0.6 } : undefined}>{String(p.text ?? '')}</span>
      return (
        <div style={p.dimColor ? { opacity: 0.6 } : undefined}>
          <Markdown text={String(p.text ?? '')} />
        </div>
      )
    case 'Code':
      return <Code p={p} />
    case 'Raster':
      return inline ? <span className="is-dim">▚</span> : <Raster p={p} />
    case 'Image': {
      const cols = Number(p.columns) || 0
      return (
        <span className="is-dim" style={cols ? { display: 'inline-block', minWidth: `${cols}ch` } : undefined}>
          {String(p.alt ?? 'image')}
        </span>
      )
    }
    case 'Input': {
      const value = p.value ? String(p.value) : ''
      return (
        <span>
          {p.label ? <span className="is-bold">{String(p.label)}: </span> : null}
          {value ? value : <span className="is-dim">{String(p.placeholder ?? '')}</span>}
        </span>
      )
    }
    case 'Select': {
      const opts = (Array.isArray(p.options) ? p.options : []) as { value: string; label?: string }[]
      if (inline) {
        const cur = opts.find((o) => o.value === p.value) ?? opts[0]
        return <span>{cur ? (cur.label ?? cur.value) : ''}</span>
      }
      return (
        <div>
          {p.label ? <div className="tl is-bold">{String(p.label)}</div> : null}
          {opts.map((o, i) => {
            const on = o.value === p.value || (p.value === undefined && i === 0)
            return (
              <div className="tl" key={o.value} style={on ? { color: 'var(--t-suggestion)' } : undefined}>
                {on ? '❯ ' : '  '}
                {i + 1}. {o.label ?? o.value}
              </div>
            )
          })}
        </div>
      )
    }
    case 'Svg':
    case 'Client':
      return <span className="is-dim">{p.alt ? String(p.alt) : '…'}</span>
    case 'Box': {
      if (inline) return <span>{kids(el, true)}</span>
      const dir = (p.flexDirection as string | undefined) ?? 'row'
      const isRow = dir.startsWith('row')
      const gap = cells(p.gap, isRow ? 'x' : 'y')
      const colGap = cells(p.columnGap, 'x') ?? (isRow ? gap : undefined)
      const rowGap = cells(p.rowGap, 'y') ?? (isRow ? undefined : gap)
      const style: CSSProperties = {
        display: p.display === 'none' ? 'none' : 'flex',
        flexDirection: dir as CSSProperties['flexDirection'],
        flexWrap: p.flexWrap as CSSProperties['flexWrap'],
        columnGap: cx(colGap),
        rowGap: cy(rowGap),
        paddingTop: cy(cells(p.paddingTop ?? p.paddingY ?? p.padding, 'y')),
        paddingBottom: cy(cells(p.paddingBottom ?? p.paddingY ?? p.padding, 'y')),
        paddingLeft: cx(cells(p.paddingLeft ?? p.paddingX ?? p.padding, 'x')),
        paddingRight: cx(cells(p.paddingRight ?? p.paddingX ?? p.padding, 'x')),
        marginTop: cy(cells(p.marginTop ?? p.marginY ?? p.margin, 'y')),
        marginBottom: cy(cells(p.marginBottom ?? p.marginY ?? p.margin, 'y')),
        marginLeft: cx(cells(p.marginLeft ?? p.marginX ?? p.margin, 'x')),
        marginRight: cx(cells(p.marginRight ?? p.marginX ?? p.margin, 'x')),
        width: dim(p.width, 'x'),
        height: dim(p.height, 'y'),
        minWidth: dim(p.minWidth, 'x') ?? 0,
        minHeight: dim(p.minHeight, 'y'),
        justifyContent: p.justifyContent as CSSProperties['justifyContent'],
        alignItems: p.alignItems as CSSProperties['alignItems'],
        alignSelf: p.alignSelf as CSSProperties['alignSelf'],
        flexGrow: p.flexGrow as number | undefined,
        flexShrink: p.flexShrink as number | undefined,
        overflow: p.overflow === 'hidden' ? 'hidden' : undefined,
        backgroundColor: resolveColor(p.backgroundColor as string | undefined),
      }
      style.position = 'relative'
      if (p.position === 'absolute') {
        style.position = 'absolute'
        style.top = cy(p.top as number | undefined)
        style.left = cx(p.left as number | undefined)
        style.right = cx(p.right as number | undefined)
        style.bottom = cy(p.bottom as number | undefined)
      }
      const border = BORDER[(p.borderStyle as string | undefined) ?? '']
      if (!border) return <div style={style}>{kids(el, false)}</div>
      // A frame takes one cell on each side; the Box's own padding goes inside it.
      const frame = resolveColor(p.borderColor as string | undefined) ?? 'var(--t-promptBorder)'
      const color = p.borderDimColor ? `color-mix(in srgb, ${frame} 55%, transparent)` : frame
      const quote = border === 'quote'
      const outer: CSSProperties = {
        ['--box-color' as string]: color,
        padding: quote ? '0 0 0 2ch' : 'var(--row) 1ch',
        display: style.display === 'none' ? 'none' : undefined,
        width: style.width,
        height: style.height,
        minWidth: style.minWidth,
        flexGrow: style.flexGrow,
        flexShrink: style.flexShrink,
        alignSelf: style.alignSelf,
        marginTop: style.marginTop,
        marginBottom: style.marginBottom,
        marginLeft: style.marginLeft,
        marginRight: style.marginRight,
        backgroundColor: style.backgroundColor,
        position: style.position,
        top: style.top,
        left: style.left,
        right: style.right,
        bottom: style.bottom,
      }
      const inner: CSSProperties = { ...style, width: undefined, height: undefined, flexGrow: undefined, flexShrink: undefined, alignSelf: undefined, margin: 0, marginTop: undefined, marginBottom: undefined, marginLeft: undefined, marginRight: undefined, backgroundColor: undefined, position: undefined, top: undefined, left: undefined, right: undefined, bottom: undefined }
      if (style.height) inner.height = '100%'
      return (
        <div className="tm-box tm-tree-box" data-border={border} style={outer}>
          <div className="tm-box-body" style={inner}>
            {kids(el, false)}
          </div>
        </div>
      )
    }
    case 'engine':
      return <span className="is-dim">…</span>
    default:
      return inline ? <span>{kids(el, true)}</span> : <div>{kids(el, false)}</div>
  }
}

export default function TreeRenderer({ tree, inline = false }: TreeRendererProps) {
  return inline ? <Node el={tree} inline /> : <div className="tm-tree">{<Node el={tree} inline={false} />}</div>
}
