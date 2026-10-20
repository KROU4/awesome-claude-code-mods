// A command to paste into Claude Code or a shell, with a Copy button; and `rich()`, which
// turns `backtick` spans of a translated string into <code>.
import { Fragment, useRef, type ReactNode } from 'react'
import { useOverflowEdge } from '../../lib/hooks'
import CopyButton from '../ui/CopyButton'
import './how.css'

export function rich(text: string): ReactNode {
  const parts = text.split('`')
  return parts.map((p, i) =>
    i % 2 === 1 ? (
      // short code stays on one line: browsers would break `KROU4/claude-code-…` after a hyphen
      <code key={i} className={p.length <= 34 ? 'nowrap' : undefined}>
        {p}
      </code>
    ) : (
      <Fragment key={i}>{p}</Fragment>
    ),
  )
}

/**
 * A command line that wraps only between words: browsers also break after "-" and "/",
 * which splits `KROU4/claude-code-mod-showroom` mid-name. Very long tokens may still wrap.
 */
export function CommandText({ command }: { command: string }) {
  const tokens = command.split(' ')
  return (
    <>
      {tokens.map((tok, i) => (
        <Fragment key={i}>
          {i > 0 ? ' ' : null}
          {tok.length <= 34 ? <span className="nowrap">{tok}</span> : tok}
        </Fragment>
      ))}
    </>
  )
}

export type CommandProps = {
  command: string
  /** What is copied, for the button's accessible name ("Copy: add the marketplace"). */
  what: string
  className?: string
}

export default function Command({ command, what, className }: CommandProps) {
  const ref = useRef<HTMLElement>(null)
  useOverflowEdge(ref)
  return (
    <div className={['how-cmd', className].filter(Boolean).join(' ')}>
      <code ref={ref} className="how-cmd-text">
        <CommandText command={command} />
      </code>
      <CopyButton text={command} what={what} label={null} selectTarget={ref} className="how-cmd-copy" />
    </div>
  )
}
