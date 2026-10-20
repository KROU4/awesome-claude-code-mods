// Basic terminal Markdown, the way Claude Code draws assistant text and command output:
// bold headings without '#', inline code in a color, quotes in italics with a bar on the
// left, tables with box-drawing borders. Enough for previews; not a full CommonMark parser.
import type { ReactNode } from 'react'

/** Inline: `code`, **bold**, *italic*, [label](url). */
export function inlineMd(text: string, keyBase = 'i'): ReactNode[] {
  const out: ReactNode[] = []
  const re = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*\s][^*]*\*)|(\[[^\]]+\]\([^)]+\))/g
  let last = 0
  let m: RegExpExecArray | null
  let k = 0
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index))
    const tok = m[0]
    const key = `${keyBase}${k++}`
    if (m[1]) out.push(<span key={key} className="md-code">{tok.slice(1, -1)}</span>)
    else if (m[2]) out.push(<span key={key} className="is-bold">{tok.slice(2, -2)}</span>)
    else if (m[3]) out.push(<span key={key} className="is-italic">{tok.slice(1, -1)}</span>)
    else {
      const lm = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(tok)
      out.push(
        <span key={key} className="tseg-link" title={lm?.[2]}>
          {lm?.[1] ?? tok}
        </span>,
      )
    }
    last = m.index + tok.length
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}

/** Text without inline markers, for column widths. */
export function plainMd(text: string): string {
  return text
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*\s][^*]*)\*/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
}

function splitRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((c) => c.trim())
}

function Table({ lines, k }: { lines: string[]; k: string }) {
  const rows = lines.filter((l) => !/^\s*\|?\s*:?-{2,}/.test(l)).map(splitRow)
  const cols = Math.max(...rows.map((r) => r.length))
  const widths = Array.from({ length: cols }, (_, c) => Math.max(...rows.map((r) => plainMd(r[c] ?? '').length)))
  const border = (l: string, m: string, r: string) => l + widths.map((w) => '─'.repeat(w + 2)).join(m) + r
  const body: ReactNode[] = []
  body.push(<div key="top" className="tl md-rule">{border('┌', '┬', '┐')}</div>)
  rows.forEach((r, ri) => {
    body.push(
      <div key={`r${ri}`} className="tl">
        {widths.map((w, c) => {
          const cell = r[c] ?? ''
          const pad = ' '.repeat(Math.max(0, w - plainMd(cell).length))
          return (
            <span key={c}>
              <span className="md-rule">│</span> <span className={ri === 0 ? 'is-bold' : undefined}>{inlineMd(cell, `${k}${ri}${c}`)}</span>
              {pad}{' '}
              {c === widths.length - 1 ? <span className="md-rule">│</span> : null}
            </span>
          )
        })}
      </div>,
    )
    if (ri === 0 && rows.length > 1) body.push(<div key="mid" className="tl md-rule">{border('├', '┼', '┤')}</div>)
  })
  body.push(<div key="bot" className="tl md-rule">{border('└', '┴', '┘')}</div>)
  return <div className="md-table">{body}</div>
}

/** Block Markdown → terminal rows. */
export function Markdown({ text }: { text: string }) {
  const lines = text.replace(/\r\n/g, '\n').split('\n')
  const out: ReactNode[] = []
  let i = 0
  let k = 0
  while (i < lines.length) {
    const line = lines[i]
    const key = `b${k++}`
    if (/^\s*\|/.test(line)) {
      const tbl: string[] = []
      while (i < lines.length && /^\s*\|/.test(lines[i])) tbl.push(lines[i++])
      out.push(<Table key={key} lines={tbl} k={key} />)
      continue
    }
    if (/^```/.test(line)) {
      i++
      const code: string[] = []
      while (i < lines.length && !/^```/.test(lines[i])) code.push(lines[i++])
      i++
      out.push(
        <div key={key} className="md-pre">
          {code.map((c, ci) => (
            <div key={ci} className="tl md-code">
              {c || ' '}
            </div>
          ))}
        </div>,
      )
      continue
    }
    const h = /^(#{1,6})\s+(.*)$/.exec(line)
    if (h) {
      out.push(
        <div key={key} className="tl is-bold">
          {inlineMd(h[2], key)}
        </div>,
      )
    } else if (/^>\s?/.test(line)) {
      out.push(
        <div key={key} className="tl is-italic md-quote">
          <span className="is-dim">▎ </span>
          {inlineMd(line.replace(/^>\s?/, ''), key)}
        </div>,
      )
    } else if (line.trim() === '') {
      out.push(<div key={key} className="tl" aria-hidden="true">{' '}</div>)
    } else {
      out.push(
        <div key={key} className="tl">
          {inlineMd(line, key)}
        </div>,
      )
    }
    i++
  }
  return <>{out}</>
}
