// A small, line-based highlighter for the code the site shows (TSX and JSON): comments,
// strings, keywords, JSX tags, numbers and JSON keys. Not a parser; good enough for excerpts.
import type { ReactNode } from 'react'

export type Lang = 'tsx' | 'json'

const KEYWORDS = new Set([
  'import',
  'from',
  'export',
  'const',
  'let',
  'var',
  'function',
  'return',
  'if',
  'else',
  'async',
  'await',
  'type',
  'as',
  'new',
  'typeof',
  'for',
  'of',
  'in',
  'true',
  'false',
  'null',
  'undefined',
])

// comment | string | template | jsx tag | number | word | other
const TOKEN =
  /(\/\/.*$)|('(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*")|(`(?:\\.|[^`\\])*`)|(<\/?[A-Z][A-Za-z0-9.]*)|(\b0x[0-9a-fA-F]+\b|\b\d[\d_]*(?:\.\d+)?\b)|([A-Za-z_$][\w$]*)|(\s+|.)/g

export function highlightLine(line: string, lang: Lang): ReactNode[] {
  const out: ReactNode[] = []
  let k = 0
  let m: RegExpExecArray | null
  TOKEN.lastIndex = 0
  while ((m = TOKEN.exec(line))) {
    const [text, comment, str, tpl, tag, num, word] = m
    if (comment && lang === 'tsx') out.push(<span key={k++} className="hl-comment">{text}</span>)
    else if (str) {
      // a JSON key is a string followed by a colon
      const isKey = lang === 'json' && /^\s*:/.test(line.slice(TOKEN.lastIndex))
      out.push(
        <span key={k++} className={isKey ? 'hl-key' : 'hl-string'}>
          {text}
        </span>,
      )
    } else if (tpl) out.push(<span key={k++} className="hl-string">{text}</span>)
    else if (tag && lang === 'tsx') out.push(<span key={k++} className="hl-tag">{text}</span>)
    else if (num) out.push(<span key={k++} className="hl-number">{text}</span>)
    else if (word && KEYWORDS.has(word)) out.push(<span key={k++} className="hl-keyword">{text}</span>)
    else out.push(text)
    if (text === '') TOKEN.lastIndex++
  }
  return out
}
