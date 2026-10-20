// Building blocks shared by the desktop and VS Code surfaces (VS Code imports them from
// here): DSL rows drawn natively, a small Markdown renderer, tool-result summaries, the
// spinner row and the scroller that keeps the newest message in view.
//
// Native rows: proportional text and rounded buttons, as the apps draw a mod's Text and
// Button. A preview row group that is aligned by character cells (box frames, block-pixel
// art, columns padded with spaces) stays monospace, otherwise its columns fall apart.
import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from 'react'
import type { Row, Segment } from '../../../data/types'
import { resolveColor, themeVars, type TerminalTheme } from '../dsl/colors'
import { inlineMd } from '../dsl/markdown'
import { isBar, isSpark, rowText, Seg } from '../dsl/Segments'
import { formatElapsed, formatTokens } from '../scenes'
import { Shimmer, SpinnerGlyph } from '../terminal/atoms'
import type { Frame, MockModel, ModelItem } from '../types'
import './native.css'

export type ToolItem = Extract<ModelItem, { kind: 'tool' }>

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ')

// ── cells or text ──────────────────────────────────────────────────────────────────────

/** Box drawing, block elements, braille: characters that only line up on a cell grid. */
const CELL_CHARS = /[─-▟⠀-⣿]/

/** A row laid out by cells: frame or block characters, or columns padded with spaces. */
function isAligned(text: string): boolean {
  return CELL_CHARS.test(text) || /\S {3,}\S/.test(text) || /^ {4,}\S/.test(text)
}

/** True when a group of rows only reads on a monospace grid. */
export function isCellArt(rows: readonly Row[]): boolean {
  if (rows.length < 2) return false
  return rows.some((r) => isAligned(rowText(r)))
}

/** A bar segment as a real progress bar (native only). */
function NativeBar({ value, width = 12, color }: { value: number; width?: number; color?: string }) {
  const v = Math.min(1, Math.max(0, value))
  return (
    <span className="nv-bar" role="img" aria-label={`${Math.round(v * 100)}%`} style={{ width: `${Math.max(3, width * 0.42)}em` }}>
      <i style={{ width: `${v * 100}%`, background: resolveColor(color) ?? 'var(--t-claude)' }} />
    </span>
  )
}

/** A sparkline segment as small bars (native only). */
function NativeSpark({ values, color }: { values: number[]; color?: string }) {
  if (!values.length) return null
  const min = Math.min(...values)
  const span = Math.max(...values) - min || 1
  const w = values.length * 3
  return (
    <svg className="nv-spark" viewBox={`0 0 ${w} 10`} width={`${values.length * 0.32}em`} height="0.9em" aria-hidden="true" focusable="false">
      {values.map((v, i) => {
        const h = 1.5 + ((v - min) / span) * 8.5
        return <rect key={i} x={i * 3 + 0.4} y={10 - h} width={2.2} height={h} rx={0.6} fill={resolveColor(color) ?? 'currentColor'} />
      })}
    </svg>
  )
}

function NSeg({ seg, cells }: { seg: Segment; cells: boolean }) {
  if (!cells && isBar(seg)) return <NativeBar value={seg.bar} width={seg.width} color={seg.color} />
  if (!cells && isSpark(seg)) return <NativeSpark values={seg.spark} color={seg.color} />
  return <Seg seg={seg} variant="native" />
}

export function NativeRow({ row, cells = false, className }: { row: Row; cells?: boolean; className?: string }) {
  const text = rowText(row)
  const empty = row.length === 0 || text.trim() === ''
  // On the grid, aligned rows keep their cells (and clip); prose rows still wrap.
  return (
    <div className={cx('nv-row', cells && isAligned(text) && 'is-pre', className)}>
      {empty ? ' ' : row.map((s, i) => <NSeg key={i} seg={s} cells={cells} />)}
    </div>
  )
}

/** One row's segments inline (hint and mode labels inside a footer row). */
export function NativeInline({ row, className }: { row: Row; className?: string }) {
  return (
    <span className={cx('nv-inline', className)}>
      {row.map((s, i) => (
        <NSeg key={i} seg={s} cells={false} />
      ))}
    </span>
  )
}

/** DSL rows drawn natively; cell-aligned groups stay on the monospace grid. */
export function NativeRows({ rows, className, forceCells }: { rows: readonly Row[]; className?: string; forceCells?: boolean }) {
  const cells = forceCells ?? isCellArt(rows)
  return (
    <div className={cx('nv-rows', cells && 'is-cells', className)}>
      {rows.map((r, i) => (
        <NativeRow key={i} row={r} cells={cells} />
      ))}
    </div>
  )
}

// ── Markdown (assistant text, command output) ──────────────────────────────────────────

function splitCells(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((c) => c.trim())
}

const LIST = /^\s*([-*•]|\d+[.)])\s+/

/** Paragraphs, headings, lists, quotes, code fences and tables, drawn as an app draws them. */
export function NativeMarkdown({ text, className }: { text: string; className?: string }) {
  const lines = text.replace(/\r\n/g, '\n').split('\n')
  const out: ReactNode[] = []
  let i = 0
  let k = 0
  while (i < lines.length) {
    const line = lines[i]
    const key = `m${k++}`
    if (!line.trim()) {
      i++
      continue
    }
    if (/^```/.test(line)) {
      i++
      const code: string[] = []
      while (i < lines.length && !/^```/.test(lines[i])) code.push(lines[i++])
      i++
      out.push(
        <pre key={key} className="nv-pre">
          {code.join('\n')}
        </pre>,
      )
      continue
    }
    if (/^\s*\|/.test(line)) {
      const tbl: string[] = []
      while (i < lines.length && /^\s*\|/.test(lines[i])) tbl.push(lines[i++])
      const rows = tbl.filter((l) => !/^\s*\|?\s*:?-{2,}/.test(l)).map(splitCells)
      const [head, ...body] = rows
      out.push(
        <table key={key} className="nv-table">
          <thead>
            <tr>
              {head.map((c, ci) => (
                <th key={ci}>{inlineMd(c, `${key}h${ci}`)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {body.map((r, ri) => (
              <tr key={ri}>
                {r.map((c, ci) => (
                  <td key={ci}>{inlineMd(c, `${key}${ri}-${ci}`)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>,
      )
      continue
    }
    const h = /^(#{1,6})\s+(.*)$/.exec(line)
    if (h) {
      out.push(
        <p key={key} className="nv-h" data-level={Math.min(3, h[1].length)}>
          {inlineMd(h[2], key)}
        </p>,
      )
      i++
      continue
    }
    if (/^>\s?/.test(line)) {
      const q: string[] = []
      while (i < lines.length && /^>\s?/.test(lines[i])) q.push(lines[i++].replace(/^>\s?/, ''))
      out.push(
        <blockquote key={key} className="nv-quote">
          {q.map((l, qi) => (
            <p key={qi}>{inlineMd(l, `${key}${qi}`)}</p>
          ))}
        </blockquote>,
      )
      continue
    }
    const lm = LIST.exec(line)
    if (lm) {
      const ordered = /\d/.test(lm[1])
      const items: string[] = []
      while (i < lines.length && LIST.test(lines[i]) && /\d/.test(LIST.exec(lines[i])![1]) === ordered) {
        items.push(lines[i++].replace(LIST, ''))
      }
      const Tag = ordered ? 'ol' : 'ul'
      out.push(
        <Tag key={key} className="nv-list">
          {items.map((it, ii) => (
            <li key={ii}>{inlineMd(it, `${key}${ii}`)}</li>
          ))}
        </Tag>,
      )
      continue
    }
    const para: string[] = []
    while (i < lines.length && lines[i].trim() && !/^```|^\s*\||^#{1,6}\s|^>\s?/.test(lines[i]) && !LIST.test(lines[i])) para.push(lines[i++])
    out.push(
      <p key={key}>
        {para.map((l, pi) => (
          <span key={pi}>
            {pi > 0 ? <br /> : null}
            {inlineMd(l, `${key}${pi}-`)}
          </span>
        ))}
      </p>,
    )
  }
  return <div className={cx('nv-md', className)}>{out}</div>
}

/** Assistant / command / note body: Markdown, plain text or DSL rows. */
export function NativeBody({ text, markdown, rows }: { text?: string; markdown?: string; rows?: Row[] }) {
  if (text) return <NativeMarkdown text={text} />
  if (markdown) return <NativeMarkdown text={markdown} />
  if (rows && rows.length) return <NativeRows rows={rows} />
  return null
}

// ── tool rows ──────────────────────────────────────────────────────────────────────────

export type ToolKind = 'read' | 'edit' | 'shell' | 'search' | 'web' | 'other'

export function toolKind(tool: string): ToolKind {
  if (/^(Read|NotebookRead|View)$/.test(tool)) return 'read'
  if (/^(Edit|Update|MultiEdit|Write|NotebookEdit)$/.test(tool)) return 'edit'
  if (/^(Bash|PowerShell|Shell|BashOutput)$/.test(tool)) return 'shell'
  if (/^(Grep|Glob|Search|LS)$/.test(tool)) return 'search'
  if (/^(WebFetch|WebSearch|Fetch)$/.test(tool)) return 'web'
  return 'other'
}

export function plainRows(rows?: readonly Row[]): string {
  return (rows ?? []).map(rowText).join('\n')
}

/** "with 24 additions and 3 removals" → { add: 24, rem: 3 }. */
export function editCounts(text: string): { add: number; rem: number } | null {
  const add = /(\d+)\s+additions?/.exec(text)
  const rem = /(\d+)\s+removals?/.exec(text)
  if (!add && !rem) return null
  return { add: add ? Number(add[1]) : 0, rem: rem ? Number(rem[1]) : 0 }
}

/** A short summary for the right end of a tool row: "142 lines", "4 files". */
export function toolSummary(it: ToolItem): string | null {
  const t = plainRows(it.result).split('\n')[0] ?? ''
  if (!t) return null
  let m = /^Read (\d+) lines?/.exec(t)
  if (m) return `${m[1]} lines`
  m = /^Wrote (\d+) lines?/.exec(t)
  if (m) return `${m[1]} lines`
  m = /^Found (\d+) (files?|matches?|lines?)/.exec(t)
  if (m) return `${m[1]} ${m[2]}`
  return null
}

/** Display path: the file name, with the folder kept for context when it fits. */
export function splitPath(input: string): { dir: string; base: string } | null {
  if (!/^[\w.~@/\\-]+\.[\w]+$/.test(input) && !/^[\w.~@-]+\/[\w./-]+$/.test(input)) return null
  const i = Math.max(input.lastIndexOf('/'), input.lastIndexOf('\\'))
  return i < 0 ? { dir: '', base: input } : { dir: input.slice(0, i + 1), base: input.slice(i + 1) }
}

/** The deny message typed so far (frame.items[id].chars). */
export function denyText(it: ToolItem, chars: number | undefined): string {
  const full = plainRows(it.result)
  return chars === undefined ? full : full.slice(0, chars)
}

// ── spinner ────────────────────────────────────────────────────────────────────────────

/** The working row: the client's glyph cycle, the verb with its shimmer, elapsed and tokens. */
export function SpinnerRow({ model, frame, animate, className }: { model: MockModel; frame: Frame; animate: boolean; className: string }) {
  if (!frame.spinner) return null
  const { verb, glyphs, color } = model.spinner
  const c = resolveColor(color) ?? 'var(--t-claude)'
  return (
    <div className={className}>
      <span className="nv-spin-glyph">
        <SpinnerGlyph frames={glyphs && glyphs.length ? glyphs : undefined} animate={animate} color={c} />
      </span>
      <Shimmer text={`${verb}…`} color={c} />
      <span className="nv-spin-meta">
        {formatElapsed(frame.spinner.seconds)} · ↓ {formatTokens(frame.spinner.tokens)} tokens
      </span>
    </div>
  )
}

// ── layout helpers ─────────────────────────────────────────────────────────────────────

/** Keeps the newest rows in view: pins scrollTop to the bottom whenever the content grows. */
export function StickToBottom({ className, innerClassName, children }: { className: string; innerClassName?: string; children: ReactNode }) {
  const outer = useRef<HTMLDivElement>(null)
  const inner = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const o = outer.current
    const i = inner.current
    if (!o || !i) return
    const pin = () => {
      o.scrollTop = o.scrollHeight
    }
    pin()
    const ro = new ResizeObserver(pin)
    ro.observe(i)
    ro.observe(o)
    return () => ro.disconnect()
  }, [])
  return (
    <div ref={outer} className={className}>
      <div ref={inner} className={innerClassName}>
        {children}
      </div>
    </div>
  )
}

/** Element width in CSS px, kept current with a ResizeObserver. */
export function useWidth<T extends HTMLElement>(): [RefObject<T | null>, number] {
  const ref = useRef<T>(null)
  const [w, setW] = useState(0)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => setW(el.clientWidth)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, w]
}

/**
 * The --t-* variables a mod's colors resolve to (dsl/colors.ts), retuned for an app
 * surface: the terminal's tokens, with text, canvas and the few colors that would miss
 * 4.5:1 on the app's background swapped for the app's own.
 */
export function surfaceVars(theme: TerminalTheme, overrides: Record<string, string>): CSSProperties {
  const vars = themeVars(theme) as Record<string, string>
  for (const [k, v] of Object.entries(overrides)) vars[`--t-${k}`] = v
  return vars as CSSProperties
}

/** Items a surface draws, in order: the turn-end line is terminal-only everywhere else. */
export function drawnItems(model: MockModel, frame: Frame, skip?: (it: ModelItem) => boolean): ModelItem[] {
  return model.items.filter((it) => it.kind !== 'turn-end' && frame.items[it.id] && !(skip && skip(it)))
}

export function sourceLabel(model: MockModel, source: string): string {
  return model.sources.find((s) => s.id === source)?.label ?? source
}

/** A short session title from the first prompt, as the apps name sessions. */
export function sessionTitle(model: MockModel): string {
  const first = model.items.find((it) => it.kind === 'user' || it.kind === 'rewrite')
  const text = first ? (first.kind === 'user' ? first.text : first.kind === 'rewrite' ? first.after : '') : ''
  if (!text) return 'New session'
  const words = text.replace(/[.?!]+$/, '').split(/\s+/)
  let out = ''
  for (const w of words) {
    if ((out + ' ' + w).trim().length > 38) {
      out += '…'
      break
    }
    out = (out + ' ' + w).trim()
  }
  return out
}
