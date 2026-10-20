// Mod descriptions in site type: paragraphs on blank lines, inline `code`, **bold** and
// [links](https://…). Anything else stays plain text.
import { Fragment, type ReactNode } from 'react'

const MARK = '\u0000'

/**
 * A translated sentence with React nodes in its placeholders:
 * withNodes((v) => t('catalog.detail.trust.hosted', v), { cmd: <code>…</code> }).
 */
export function withNodes(translate: (vars: Record<string, string>) => string, nodes: Record<string, ReactNode>): ReactNode {
  const vars = Object.fromEntries(Object.keys(nodes).map((k) => [k, `${MARK}${k}${MARK}`]))
  const parts = translate(vars).split(MARK)
  return parts.map((part, i) => (i % 2 === 1 && part in nodes ? <Fragment key={i}>{nodes[part]}</Fragment> : part))
}

function inline(text: string, base: string): ReactNode[] {
  const out: ReactNode[] = []
  const re = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\[[^\]]+\]\((https?:\/\/[^)\s]+)\))/g
  let last = 0
  let k = 0
  let mt: RegExpExecArray | null
  while ((mt = re.exec(text))) {
    if (mt.index > last) out.push(text.slice(last, mt.index))
    const key = `${base}-${k++}`
    if (mt[1]) out.push(<code key={key}>{mt[1].slice(1, -1)}</code>)
    else if (mt[2]) out.push(<strong key={key}>{mt[2].slice(2, -2)}</strong>)
    else if (mt[3] && mt[4]) {
      const label = /^\[([^\]]+)\]/.exec(mt[3])?.[1] ?? mt[4]
      out.push(
        <a key={key} href={mt[4]} target="_blank" rel="noopener noreferrer">
          {label}
        </a>,
      )
    }
    last = mt.index + mt[0].length
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}

export function RichText({ text, className }: { text: string; className?: string }) {
  const paras = text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
  return (
    <div className={className}>
      {paras.map((p, i) => (
        <p key={i}>{inline(p.replace(/\s*\n\s*/g, ' '), `p${i}`)}</p>
      ))}
    </div>
  )
}
