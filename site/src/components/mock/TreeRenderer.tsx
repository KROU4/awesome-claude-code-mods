// TreeRenderer — draws a captured `ui.render` tree (the engine's RenderElement JSON) in
// terminal style. STUB with a working basic subset; the TreeRenderer owner extends it
// (see src/CONTRACTS.md): Box flex/gap/padding/borders, Text styles, Button, Link,
// Markdown, Code (diff), Raster cells.
//
// Contract: <TreeRenderer tree={RenderElement} inline? /> renders inside a `.tm` terminal
// root (it uses the --t-* theme variables and 1ch cells).
import type { CSSProperties, ReactNode } from 'react'
import type { RenderElement } from '../../data/types'
import { resolveColor } from './dsl/colors'
import { Markdown } from './dsl/markdown'

export type TreeRendererProps = {
  tree: RenderElement
  /** Render as inline spans (inside a single row, e.g. the hint line). */
  inline?: boolean
}

type P = Record<string, unknown>

const SPACE: Record<string, number> = { xs: 1, sm: 1, md: 2, lg: 3, xl: 4 }
const SPACE_Y: Record<string, number> = { xs: 0, sm: 0, md: 1, lg: 1, xl: 2 }

function cells(v: unknown, axis: 'x' | 'y'): number | undefined {
  if (typeof v === 'number') return v
  if (typeof v === 'string') return axis === 'x' ? SPACE[v] : SPACE_Y[v]
  return undefined
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
  if (p.underline || p.strikethrough) style.textDecorationLine = [p.underline && 'underline', p.strikethrough && 'line-through'].filter(Boolean).join(' ')
  if (p.dimColor) style.opacity = 0.6
  return style
}

function kids(el: RenderElement, inline: boolean): ReactNode[] {
  return (el.children ?? []).map((c, i) => (typeof c === 'string' ? c : <Node key={i} el={c} inline={inline} />))
}

function Node({ el, inline }: { el: RenderElement; inline: boolean }): ReactNode {
  const p = (el.props ?? {}) as P
  switch (el.type) {
    case 'Text':
      return <span style={textStyle(p)}>{kids(el, true)}</span>
    case 'Button': {
      const label = (p.label as string | undefined) ?? null
      return (
        <span className="tseg-btn" data-variant={p.variant === 'primary' ? 'primary' : 'secondary'} style={p.dimColor ? { opacity: 0.6 } : undefined}>
          {p.plain ? null : <span className="tseg-brk">[ </span>}
          {p.hotkey ? <span className="is-dim">{String(p.hotkey)}: </span> : null}
          {label}
          {kids(el, true)}
          {p.plain ? null : <span className="tseg-brk"> ]</span>}
        </span>
      )
    }
    case 'Link':
      return (
        <span className="tseg-link" title={p.href as string | undefined}>
          {(p.label as string | undefined) ?? kids(el, true)}
        </span>
      )
    case 'Markdown':
      return inline ? <span>{String(p.text ?? '')}</span> : <Markdown text={String(p.text ?? '')} />
    case 'Code':
      return (
        <div className="md-pre">
          {String(p.source ?? '')
            .split('\n')
            .map((l, i) => (
              <div className="tl md-code" key={i}>
                {l || ' '}
              </div>
            ))}
        </div>
      )
    case 'Box': {
      if (inline) return <span>{kids(el, true)}</span>
      const dir = (p.flexDirection as string | undefined) ?? 'row'
      const gap = cells(p.gap, dir.startsWith('row') ? 'x' : 'y') ?? 0
      const px = cells(p.paddingX ?? p.padding, 'x') ?? 0
      const py = cells(p.paddingY ?? p.padding, 'y') ?? 0
      const style: CSSProperties = {
        display: p.display === 'none' ? 'none' : 'flex',
        flexDirection: dir as CSSProperties['flexDirection'],
        gap: dir.startsWith('row') ? `0 ${gap}ch` : `calc(${gap} * var(--row)) 0`,
        padding: `calc(${py} * var(--row)) ${px}ch`,
        justifyContent: p.justifyContent as CSSProperties['justifyContent'],
        alignItems: p.alignItems as CSSProperties['alignItems'],
        flexGrow: p.flexGrow as number | undefined,
        backgroundColor: resolveColor(p.backgroundColor as string | undefined),
      }
      const border = p.borderStyle as string | undefined
      if (border) {
        return (
          <div className="tm-box" data-border={border} style={{ ['--box-color' as string]: resolveColor(p.borderColor as string | undefined) ?? 'currentColor' } as CSSProperties}>
            <div className="tm-box-body" style={style}>
              {kids(el, false)}
            </div>
          </div>
        )
      }
      return <div style={style}>{kids(el, false)}</div>
    }
    case 'engine':
      return <span className="is-dim">…</span>
    default:
      return <span>{kids(el, inline)}</span>
  }
}

export default function TreeRenderer({ tree, inline = false }: TreeRendererProps) {
  return inline ? <Node el={tree} inline /> : <div className="tm-tree">{<Node el={tree} inline={false} />}</div>
}
