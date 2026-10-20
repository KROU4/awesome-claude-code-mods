// NativeTree — a captured `ui.render` tree (RenderElement JSON) drawn the way the desktop
// app and the VS Code panel draw a mod's elements: proportional text, rounded buttons,
// 1px rounded frames. The terminal counterpart is ../TreeRenderer.tsx. Used for captured
// trees whose `surface` is 'desktop' or 'vscode'. Raster and Image draw in the terminal
// only: here they become a short note instead of a fake picture.
import type { CSSProperties, ReactNode } from 'react'
import type { RenderElement } from '../../../data/types'
import { resolveColor } from '../dsl/colors'
import { IChevronDown, IClose } from './icons'
import { NativeMarkdown } from './native'

type P = Record<string, unknown>

/** Space steps in em (the apps space by points, not cells). */
const SPACE: Record<string, number> = { xs: 0.25, sm: 0.5, md: 0.75, lg: 1, xl: 1.5 }

function space(v: unknown): string | undefined {
  if (typeof v === 'number') return `${v * 0.5}em`
  if (typeof v === 'string' && v in SPACE) return `${SPACE[v]}em`
  return undefined
}

function size(v: unknown, unit: 'w' | 'h'): string | undefined {
  if (typeof v === 'number') return unit === 'w' ? `${v * 0.6}em` : `${v * 1.5}em`
  if (typeof v === 'string') return v
  return undefined
}

const TEXT_SIZE: Record<string, string> = { caption: '0.78em', footnote: '0.86em', body: '1em', heading: '1.12em', title: '1.3em' }
const WEIGHT: Record<string, number> = { regular: 400, medium: 500, semibold: 600, bold: 700 }

function textStyle(p: P): CSSProperties {
  const s: CSSProperties = {}
  const fg = resolveColor(p.color as string | undefined)
  const bg = resolveColor(p.backgroundColor as string | undefined)
  if (p.inverse) {
    s.color = bg ?? 'var(--t-canvas)'
    s.backgroundColor = fg ?? 'var(--t-text)'
  } else {
    if (fg) s.color = fg
    if (bg) s.backgroundColor = bg
  }
  if (typeof p.size === 'string' && TEXT_SIZE[p.size]) s.fontSize = TEXT_SIZE[p.size]
  const w = typeof p.weight === 'string' ? WEIGHT[p.weight] : p.bold ? 600 : undefined
  if (w) s.fontWeight = w
  if (p.italic) s.fontStyle = 'italic'
  const deco = [p.underline && 'underline', p.strikethrough && 'line-through'].filter(Boolean).join(' ')
  if (deco) s.textDecorationLine = deco
  if (p.dimColor) s.opacity = 0.72
  if (p.mono) s.fontFamily = 'var(--nv-mono)'
  if (p.tabular) s.fontVariantNumeric = 'tabular-nums'
  if (typeof p.wrap === 'string' && p.wrap.startsWith('truncate')) {
    s.display = 'inline-block'
    s.maxWidth = '100%'
    s.overflow = 'hidden'
    s.textOverflow = 'ellipsis'
    s.whiteSpace = 'nowrap'
    s.verticalAlign = 'bottom'
  }
  return s
}

function kids(el: RenderElement): ReactNode[] {
  return (el.children ?? []).map((c, i) => (typeof c === 'string' ? c : <Node key={i} el={c} />))
}

function plain(el: RenderElement): string {
  return (el.children ?? []).map((c) => (typeof c === 'string' ? c : plain(c))).join('')
}

function boxStyle(p: P): CSSProperties {
  const dir = (p.flexDirection as string | undefined) ?? 'row'
  const s: CSSProperties = {
    display: p.display === 'none' ? 'none' : 'flex',
    flexDirection: dir as CSSProperties['flexDirection'],
    flexWrap: p.flexWrap as CSSProperties['flexWrap'],
    flexGrow: p.flexGrow as number | undefined,
    flexShrink: p.flexShrink as number | undefined,
    alignItems: p.alignItems as CSSProperties['alignItems'],
    alignSelf: p.alignSelf as CSSProperties['alignSelf'],
    justifyContent: p.justifyContent as CSSProperties['justifyContent'],
    rowGap: space(p.rowGap ?? p.gap),
    columnGap: space(p.columnGap ?? p.gap) ?? (dir.startsWith('row') ? '0.35em' : undefined),
    paddingTop: space(p.paddingTop ?? p.paddingY ?? p.padding),
    paddingBottom: space(p.paddingBottom ?? p.paddingY ?? p.padding),
    paddingLeft: space(p.paddingLeft ?? p.paddingX ?? p.padding),
    paddingRight: space(p.paddingRight ?? p.paddingX ?? p.padding),
    marginTop: space(p.marginTop ?? p.marginY ?? p.margin),
    marginBottom: space(p.marginBottom ?? p.marginY ?? p.margin),
    marginLeft: space(p.marginLeft ?? p.marginX ?? p.margin),
    marginRight: space(p.marginRight ?? p.marginX ?? p.margin),
    width: size(p.width, 'w'),
    height: size(p.height, 'h'),
    minWidth: size(p.minWidth, 'w') ?? 0,
    minHeight: size(p.minHeight, 'h'),
    overflow: p.overflow === 'hidden' ? 'hidden' : undefined,
    backgroundColor: resolveColor(p.backgroundColor as string | undefined),
  }
  if (p.position === 'absolute') {
    s.position = 'absolute'
    s.top = size(p.top, 'h')
    s.left = size(p.left, 'w')
    s.right = size(p.right, 'w')
    s.bottom = size(p.bottom, 'h')
  }
  const border = p.borderStyle as string | undefined
  if (border && border !== 'none') {
    const c = resolveColor(p.borderColor as string | undefined) ?? 'var(--nv-line-strong, var(--nv-line))'
    s.border = `1px ${border === 'dashed' ? 'dashed' : 'solid'} ${p.borderDimColor ? `color-mix(in srgb, ${c} 55%, transparent)` : c}`
    s.borderRadius = 'var(--nv-radius, 0.5em)'
    if (border === 'quote') {
      s.border = 'none'
      s.borderLeft = `2px solid ${c}`
      s.borderRadius = 0
    }
    if (!s.paddingTop && !s.paddingBottom) s.padding = '0.45em 0.7em'
  }
  return s
}

function Node({ el }: { el: RenderElement }): ReactNode {
  const p = (el.props ?? {}) as P
  switch (el.type) {
    case 'Text':
      return <span style={textStyle(p)}>{kids(el)}</span>
    case 'Button': {
      const variant = p.variant === 'primary' ? 'primary' : 'secondary'
      if (p.role === 'dismiss') {
        return (
          <span className="nv-tree-dismiss" title={String(p.label ?? 'Close')}>
            <IClose />
          </span>
        )
      }
      return (
        <span className="nseg-btn" data-variant={variant} style={p.dimColor ? { opacity: 0.6 } : undefined}>
          {(p.label as string | undefined) ?? null}
          {kids(el)}
          {p.hotkey ? <kbd className="nseg-key">{String(p.hotkey)}</kbd> : null}
        </span>
      )
    }
    case 'Link':
      return (
        <span className="tseg-link nv-tree-link" title={p.href as string | undefined}>
          {(p.label as string | undefined) ?? (plain(el) || String(p.href ?? ''))}
        </span>
      )
    case 'Markdown':
      return (
        <div style={p.dimColor ? { opacity: 0.72 } : undefined}>
          <NativeMarkdown text={String(p.text ?? '')} />
        </div>
      )
    case 'Code': {
      const src = String(p.source ?? '').replace(/\n$/, '')
      const diff = p.format === 'diff'
      const start = typeof p.startLine === 'number' ? p.startLine : diff ? 1 : null
      // Diff numbers: context and added lines count the new file, removed lines the old one.
      let oldN = start ?? 1
      let newN = start ?? 1
      return (
        <pre className="nv-pre nv-tree-code" data-wrap={p.wrap === 'wrap' || undefined}>
          {src.split('\n').map((l, i) => {
            let kind: 'add' | 'rem' | 'hunk' | undefined
            if (diff) {
              if (l.startsWith('@@')) {
                kind = 'hunk'
                const hm = /@@ -(\d+)(?:,\d+)? \+(\d+)/.exec(l)
                if (hm) {
                  oldN = Number(hm[1])
                  newN = Number(hm[2])
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
            return (
              <span key={i} className="nv-code-line" data-diff={kind}>
                {start !== null ? <span className="nv-code-ln">{n ?? ''}</span> : null}
                {l || ' '}
                {'\n'}
              </span>
            )
          })}
        </pre>
      )
    }
    case 'Input':
      return (
        <span className="nv-tree-input">
          {p.label ? <span className="nv-tree-label">{String(p.label)}</span> : null}
          <span className="nv-tree-field">{p.value ? String(p.value) : <span className="nv-tree-ph">{String(p.placeholder ?? '')}</span>}</span>
        </span>
      )
    case 'Select': {
      const opts = (Array.isArray(p.options) ? p.options : []) as { value: string; label?: string }[]
      const cur = opts.find((o) => o.value === p.value) ?? opts[0]
      return (
        <span className="nv-tree-input">
          {p.label ? <span className="nv-tree-label">{String(p.label)}</span> : null}
          <span className="nv-tree-field nv-tree-select">{cur ? (cur.label ?? cur.value) : ''}
            <IChevronDown />
          </span>
        </span>
      )
    }
    case 'Svg': {
      const src = String(p.source ?? '')
      // An <img> runs no script in the SVG, whatever the captured markup holds.
      const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(src)}`
      const w = typeof p.width === 'number' ? p.width : undefined
      const h = typeof p.height === 'number' ? p.height : undefined
      return <img className="nv-tree-svg" src={url} alt={String(p.alt ?? '')} width={w} height={h} />
    }
    case 'Raster':
    case 'Image':
      return <span className="nv-tree-skip">{el.type === 'Image' ? String(p.alt ?? 'Image') : 'Raster'}: terminal only</span>
    case 'Client':
      return <span className="nv-tree-skip">Client module</span>
    case 'engine':
      return <span className="nv-tree-skip">…</span>
    case 'Box':
      return <div style={boxStyle(p)}>{kids(el)}</div>
    default:
      return <>{kids(el)}</>
  }
}

export default function NativeTree({ tree }: { tree: RenderElement }) {
  return (
    <div className="nv-tree nv-rows">
      <Node el={tree} />
    </div>
  )
}
