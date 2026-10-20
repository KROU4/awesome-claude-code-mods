// Small terminal building blocks: the message marker, the result connector, the box frame,
// the spinner glyph and the caret.
import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react'
import { SPINNER_FRAMES } from '../scenes'

/** ● on Windows/Linux (⏺ on macOS). The mock uses ●: the site has no idea of the visitor's OS. */
export const MARKER = '●'
/** Drawn at weight 700, as the client's heavy chevron (the 400 cut reads as a thin ")"). */
export const POINTER = '❯'
export const CLOSE_MARK = '✕'

const NBSP = ' '

/**
 * The result connector: two NBSP, ⎿, space, NBSP, all dim (5 cells). The ⎿ is drawn as two
 * 1px strokes: no bundled font has it, and the fallback (Cambria Math on Windows) reads as a
 * small "L" squeezed into its cell.
 */
export function Connector() {
  return (
    <>
      {NBSP + NBSP}
      <span className="tm-elbow" aria-hidden="true" />
      {' ' + NBSP}
    </>
  )
}

/** ❯ of the user row and the prompt. */
export function Pointer({ className }: { className?: string }) {
  return <span className={className ? `tm-pointer ${className}` : 'tm-pointer'}>{POINTER}</span>
}

/** Marker column (2 cells) + content, continuation lines indented. */
export function Gutter({ mark, children, className }: { mark: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={className ? `tm-gutter ${className}` : 'tm-gutter'}>
      <span className="tm-mark">{mark}</span>
      <div className="tm-gutter-body">{children}</div>
    </div>
  )
}

/** `  ⎿  ` + rows; only the first row carries the connector. */
export function Result({ children, tone }: { children: ReactNode[]; tone?: 'error' }) {
  return (
    <div className="tm-result" data-tone={tone}>
      {children.map((c, i) => (
        <div className="tm-result-row" key={i}>
          <span className="tm-conn is-dim">{i === 0 ? <Connector /> : ' '.repeat(5)}</span>
          <div className="tm-result-body">{c}</div>
        </div>
      ))}
    </div>
  )
}

export type BoxStyle = 'single' | 'round' | 'double' | 'bold' | 'dashed' | 'quote' | 'classic' | 'none'

/** A box-drawing frame: the border runs through the middle of the first/last row and column. */
export function Box({
  children,
  title,
  close,
  borderStyle = 'round',
  color,
  className,
  src,
}: {
  children: ReactNode
  title?: ReactNode
  close?: boolean
  borderStyle?: BoxStyle
  color?: string
  className?: string
  /** The mod that draws it (data-src: the hero highlights a mod's elements). */
  src?: string
}) {
  return (
    <div
      className={className ? `tm-box ${className}` : 'tm-box'}
      data-border={borderStyle}
      data-src={src}
      style={color ? ({ ['--box-color' as string]: color } as CSSProperties) : undefined}
    >
      {title ? <span className="tm-box-title">{title}</span> : null}
      {close ? <span className="tm-box-close is-dim">{CLOSE_MARK}</span> : null}
      <div className="tm-box-body">{children}</div>
    </div>
  )
}

/** The spinner glyph, cycling · ✢ * ✶ ✻ ✽ and back (or the mod's glyphs) without re-rendering React. */
export function SpinnerGlyph({ frames = SPINNER_FRAMES, animate, color }: { frames?: readonly string[]; animate: boolean; color?: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const still = frames.includes('✻') ? '✻' : frames[0]
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (!animate || frames.length < 2) {
      el.textContent = still
      return
    }
    let i = 0
    const id = window.setInterval(() => {
      i = (i + 1) % frames.length
      el.textContent = frames[i]
    }, 110)
    return () => window.clearInterval(id)
  }, [animate, frames, still])
  return (
    <span ref={ref} className="tm-spin-glyph" style={color ? { color } : undefined} aria-hidden="true">
      {still}
    </span>
  )
}

/** The spinner message with the claudeShimmer sweep (CSS, per character). */
export function Shimmer({ text, color }: { text: string; color?: string }) {
  return (
    <span className="tm-shimmer" style={color ? ({ ['--shim-base' as string]: color } as CSSProperties) : undefined}>
      {Array.from(text).map((ch, i) => (
        <span key={i} style={{ ['--i' as string]: i } as CSSProperties}>
          {ch}
        </span>
      ))}
    </span>
  )
}

/** Block caret (inverse cell). Blinks unless `steady`. */
export function Caret({ steady }: { steady?: boolean }) {
  return <span className={steady ? 'tm-caret' : 'tm-caret is-blink'} aria-hidden="true">{' '}</span>
}

/** A row-tall horizontal rule through the middle of the row (the prompt's ─ lines). */
export function HRule({ className }: { className?: string }) {
  return <div className={className ? `tm-hr ${className}` : 'tm-hr'} aria-hidden="true" />
}
