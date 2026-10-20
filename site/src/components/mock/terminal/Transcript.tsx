// Transcript rows, drawn as Claude Code draws them (visual-4.md §3.1–3.3).
import type { ReactNode } from 'react'
import type { Row } from '../../../data/types'
import { resolveColor } from '../dsl/colors'
import { inlineMd, Markdown } from '../dsl/markdown'
import { RowView, Segs } from '../dsl/Segments'
import { formatElapsed, formatTokens, HEADER } from '../scenes'
import type { Frame, MockModel, ModelItem } from '../types'
import { Gutter, MARKER, Pointer, Result, Shimmer, SpinnerGlyph } from './atoms'

export function SessionHeader() {
  return (
    <div className="tm-header">
      <div className="tl">
        <span className="is-bold">{HEADER.product}</span> <span className="is-dim">{HEADER.version}</span>
      </div>
      <div className="tl is-dim">{HEADER.model}</div>
      <div className="tl is-dim">{HEADER.cwd}</div>
    </div>
  )
}

function textRows(text: string, key: string): ReactNode[] {
  return text.split('\n').map((line, i) => (
    <div className="tl" key={`${key}${i}`}>
      {inlineMd(line, `${key}${i}-`)}
    </div>
  ))
}

function UserRow({ text, className, src }: { text: ReactNode; className?: string; src?: string }) {
  return (
    <div className={className ? `tm-user ${className}` : 'tm-user'} data-src={src}>
      <span className="tm-mark" style={{ color: 'var(--t-inactive)' }} aria-label="you:">
        <Pointer />
      </span>
      <div className="tm-gutter-body">{text}</div>
    </div>
  )
}

function rowsOrMd(rows: Row[] | undefined, markdown: string | undefined, key: string): ReactNode {
  if (markdown) return <Markdown text={markdown} />
  return (rows ?? []).map((r, i) => <RowView key={`${key}${i}`} row={r} />)
}

function ToolItem({ it, phase, chars }: { it: Extract<ModelItem, { kind: 'tool' }>; phase: 'running' | 'done'; chars?: number }) {
  const status = phase === 'running' ? 'running' : it.status
  const markColor = status === 'running' ? undefined : status === 'error' ? 'var(--t-error)' : 'var(--t-success)'
  const line = it.row ? (
    <Segs row={it.row} />
  ) : (
    <>
      <span className="is-bold">{it.tool}</span>
      {it.input ? `(${it.input})` : null}
    </>
  )
  let result: ReactNode[] | null = null
  if (status !== 'running' && it.result && it.result.length) {
    if (it.deny) {
      const full = it.result[0].map((s) => (typeof s === 'string' ? s : 'text' in s ? s.text : '')).join('')
      const shown = chars === undefined ? full : full.slice(0, chars)
      result = [
        <div className="tl" key="d" style={{ color: 'var(--t-error)' }}>
          {shown}
        </div>,
      ]
    } else {
      result = it.result.map((r, i) => <RowView key={i} row={r} className={it.status === 'error' && !it.row ? 'is-errorish' : undefined} />)
    }
  }
  return (
    <div className="tm-item" data-src={it.source}>
      <Gutter
        mark={
          <span className={status === 'running' ? 'is-dim tm-blink' : undefined} style={markColor ? { color: markColor } : undefined}>
            {MARKER}
          </span>
        }
      >
        <div className="tl">{line}</div>
      </Gutter>
      {result ? <Result>{result}</Result> : null}
    </div>
  )
}

function Item({ it, frame, model }: { it: ModelItem; frame: Frame; model: MockModel }) {
  const f = frame.items[it.id]
  if (!f) return null
  switch (it.kind) {
    case 'user':
      return <UserRow text={textRows(it.text, it.id)} src={it.source} />
    case 'assistant':
      return (
        <div className="tm-item" data-src={it.source}>
          <Gutter mark={<span style={{ color: 'var(--t-text)' }}>{MARKER}</span>}>
            {it.text ? textRows(it.text, it.id) : rowsOrMd(it.rows, it.markdown, it.id)}
          </Gutter>
        </div>
      )
    case 'tool':
      return <ToolItem it={it} phase={f.phase} chars={f.chars} />
    case 'command':
      return (
        <div className="tm-item-group" data-src={it.source}>
          <UserRow text={<div className="tl">{[it.command, it.args].filter(Boolean).join(' ')}</div>} />
          {f.phase === 'done' && (it.output || it.markdown) ? (
            <Result>{[<div key="o">{rowsOrMd(it.output, it.markdown, it.id)}</div>]}</Result>
          ) : null}
        </div>
      )
    case 'rewrite': {
      const label = model.sources.find((s) => s.id === it.source)?.id ?? it.source
      return (
        <div className="tm-item-group" data-src={it.source}>
          <UserRow className="is-rewritten" text={<div className="tl">{it.before}</div>} />
          {f.phase === 'done' ? (
            <>
              <Result>{[<div className="tl is-dim" key="r">rewritten by {label}</div>]}</Result>
              <UserRow text={textRows(it.after, it.id)} />
            </>
          ) : null}
        </div>
      )
    }
    case 'note':
      return (
        <div className="tm-item tm-note is-dim" data-src={it.source}>
          {rowsOrMd(it.rows, it.markdown, it.id)}
        </div>
      )
    case 'turn-end':
      return (
        <div className="tm-item" data-src={it.source}>
          <div className="tl is-dim">
            <span aria-hidden="true">
              <span className="tm-cell">✻</span>{' '}
            </span>
            {it.text}
          </div>
        </div>
      )
  }
}

/** The transcript. Cards (compact) leave out the client's own line that closes the turn
 *  (unless a mod redraws it): a card has few rows, and they belong to the mod. */
export function TranscriptItems({ model, frame, compact = false }: { model: MockModel; frame: Frame; compact?: boolean }) {
  return (
    <>
      {model.items.map((it) =>
        compact && it.kind === 'turn-end' && !it.source ? null : <Item key={it.id} it={it} frame={frame} model={model} />,
      )}
    </>
  )
}

export function InfoNotices({ model, frame }: { model: MockModel; frame: Frame }) {
  const list = model.chrome.infoNotices.filter((n) => frame.chrome[n.id])
  if (!list.length) return null
  return (
    <div className="tm-info">
      {list.map((n) => (
        <RowView key={n.id} row={n.row} className="is-dim" />
      ))}
    </div>
  )
}

/** `✻ Architecting… (12s · ↓ 1.2k tokens · esc to interrupt)` */
export function SpinnerLine({ model, frame, animate }: { model: MockModel; frame: Frame; animate: boolean }) {
  if (!frame.spinner) return null
  const { verb, glyphs, color } = model.spinner
  const c = resolveColor(color) ?? 'var(--t-claude)'
  return (
    <div className="tm-item tm-spinner" data-src={model.spinner.source}>
      <Gutter mark={<SpinnerGlyph frames={glyphs && glyphs.length ? glyphs : undefined} animate={animate} color={c} />}>
        <div className="tl">
          <Shimmer text={`${verb}…`} color={c} />{' '}
          <span className="is-dim">
            ({formatElapsed(frame.spinner.seconds)} · ↓ {formatTokens(frame.spinner.tokens)} tokens · esc to interrupt)
          </span>
        </div>
      </Gutter>
    </div>
  )
}
