// The preview DSL's segments → spans, drawn in terminal style (1 cell = 1ch).
// Shared by every surface: desktop and VS Code may pass `variant="native"` to get
// native-looking buttons and links instead of terminal glyphs.
import type { CSSProperties, ReactNode } from 'react'
import type {
  BarSegment,
  ButtonSegment,
  KbdSegment,
  LinkSegment,
  Row,
  Segment,
  SparkSegment,
  TextSegment,
} from '../../../data/types'
import { cells, FRAME_STROKE } from '../terminal/cells'
import { resolveColor } from './colors'

export type SegmentVariant = 'terminal' | 'native'

export const isText = (s: Segment): s is TextSegment => typeof s === 'object' && 'text' in s
export const isButton = (s: Segment): s is ButtonSegment => typeof s === 'object' && 'button' in s
export const isBar = (s: Segment): s is BarSegment => typeof s === 'object' && 'bar' in s
export const isSpark = (s: Segment): s is SparkSegment => typeof s === 'object' && 'spark' in s
export const isLink = (s: Segment): s is LinkSegment => typeof s === 'object' && 'link' in s
export const isKbd = (s: Segment): s is KbdSegment => typeof s === 'object' && 'kbd' in s

const NBSP = '\u00A0'
const SPARK = '▁▂▃▄▅▆▇█'

export function sparkline(values: readonly number[]): string {
  if (!values.length) return ''
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  return values.map((v) => SPARK[Math.round(((v - min) / span) * (SPARK.length - 1))]).join('')
}

export function barCells(value: number, width = 12): [string, string] {
  const w = Math.max(1, Math.round(width))
  const filled = Math.round(Math.min(1, Math.max(0, value)) * w)
  return ['█'.repeat(filled), '░'.repeat(w - filled)]
}

/** Plain text of a segment (for widths, aria labels and the desktop surface). */
export function segmentText(s: Segment): string {
  if (typeof s === 'string') return s
  if (isText(s)) return s.text
  if (isButton(s)) return `[ ${s.hotkey ? `${s.hotkey}: ` : ''}${s.button} ]`
  if (isBar(s)) return barCells(s.bar, s.width).join('')
  if (isSpark(s)) return sparkline(s.spark)
  if (isLink(s)) return s.link
  if (isKbd(s)) return s.kbd
  return ''
}

export function rowText(row: Row): string {
  return row.map(segmentText).join('')
}

function textStyle(s: TextSegment): { className: string; style: CSSProperties } {
  const cls = ['tseg']
  if (s.bold) cls.push('is-bold')
  if (s.dim) cls.push('is-dim')
  if (s.italic) cls.push('is-italic')
  if (s.underline) cls.push('is-underline')
  const fg = resolveColor(s.color)
  const bg = resolveColor(s.bg)
  const style: CSSProperties = {}
  if (s.inverse) {
    style.color = bg ?? 'var(--t-canvas)'
    style.backgroundColor = fg ?? 'var(--t-text)'
  } else {
    if (fg) style.color = fg
    if (bg) style.backgroundColor = bg
  }
  return { className: cls.join(' '), style }
}

export function Seg({ seg, variant = 'terminal' }: { seg: Segment; variant?: SegmentVariant }): ReactNode {
  // the terminal holds glyphs its fonts lack to one cell each (terminal/cells.tsx)
  const cell = variant === 'terminal' ? cells : (x: string) => x
  if (typeof seg === 'string') return cell(seg)
  if (isText(seg)) {
    const { className, style } = textStyle(seg)
    return (
      <span className={className} style={style}>
        {cell(seg.text)}
      </span>
    )
  }
  if (isButton(seg)) {
    if (variant === 'native') {
      return (
        <span className="nseg-btn" data-variant={seg.variant ?? 'secondary'}>
          {seg.button}
          {seg.hotkey ? <kbd className="nseg-key">{seg.hotkey}</kbd> : null}
        </span>
      )
    }
    const primary = seg.variant === 'primary'
    return (
      <span className="tseg-btn" data-variant={primary ? 'primary' : 'secondary'}>
        {/* NBSP inside the brackets: a wrap never leaves a lone "]" on the next row */}
        <span className="tseg-brk">[</span>{NBSP}{seg.hotkey ? <span className="is-dim">{seg.hotkey}: </span> : null}
        {cell(seg.button)}
        {NBSP}
        <span className="tseg-brk">]</span>
      </span>
    )
  }
  if (isBar(seg)) {
    const [on, off] = barCells(seg.bar, seg.width)
    return (
      <span className="tseg-bar" role="img" aria-label={`${Math.round(seg.bar * 100)}%`}>
        <span style={{ color: resolveColor(seg.color) ?? 'var(--t-claude)' }}>{on}</span>
        <span className="is-dim">{off}</span>
      </span>
    )
  }
  if (isSpark(seg)) {
    return <span style={{ color: resolveColor(seg.color) }}>{sparkline(seg.spark)}</span>
  }
  if (isLink(seg)) {
    return (
      <span className="tseg-link" title={seg.href}>
        {cell(seg.link)}
      </span>
    )
  }
  if (isKbd(seg)) {
    return <span className="tseg-kbd">{cell(seg.kbd)}</span>
  }
  return null
}

/**
 * One terminal row of segments. A row with a vertical frame stroke (│ ╭ ├ …) is part of a
 * drawn box: it keeps its columns and is clipped at the edge instead of wrapping, which
 * would break the frame into pieces.
 */
export function RowView({
  row,
  className,
  variant,
}: {
  row: Row
  className?: string
  variant?: SegmentVariant
}) {
  const frame = variant !== 'native' && FRAME_STROKE.test(rowText(row))
  const cls = ['tl', frame ? 'is-frame' : null, className].filter(Boolean).join(' ')
  return (
    <div className={cls}>
      {row.map((s, i) => (
        <Seg key={i} seg={s} variant={variant} />
      ))}
    </div>
  )
}

/** Inline segments without the row wrapper. */
export function Segs({ row, variant }: { row: Row; variant?: SegmentVariant }) {
  return (
    <>
      {row.map((s, i) => (
        <Seg key={i} seg={s} variant={variant} />
      ))}
    </>
  )
}
