// The terminal surface: Claude Code's TUI in classic or fullscreen layout.
//   classic:    header, transcript, spinner, then the bottom zone right under it; the
//               whole screen scrolls like a terminal when it fills up.
//   fullscreen: transcript scrolls on its own; the bottom zone is pinned to the bottom;
//               a pane docks at the right behind a 1-column │ rule; toasts stack at the
//               transcript's top-right.
//   compact:    a card's crop: no window chrome, no header, the prompt as one rule and the
//               ❯ line, scrolled so the mod's element shows from its first row.
import { m } from 'motion/react'
import { useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import type { Row } from '../../../data/types'
import { themeVars } from '../dsl/colors'
import { rowText } from '../dsl/Segments'
import type { MockModel, SurfaceProps } from '../types'
import { HEADER } from '../scenes'
import { BottomZone, DockedPane, ToastStack } from './BottomZone'
import { columns, FRAME_STROKE } from './cells'
import { InfoNotices, SessionHeader, SpinnerLine, TranscriptItems } from './Transcript'
import './terminal.css'

/** Mock-scale dock threshold, in columns (the client docks from 110; the mock is smaller). */
const DOCK_MIN_COLUMNS = 74

/**
 * Columns the widest fixed-layout row needs: rows with a drawn frame (they clip instead of
 * wrapping) and pane rows (clipped too), plus what sits left and right of them. The font
 * shrinks, within limits, so these rows fit (terminal.css --fit).
 */
function fitColumns(model: MockModel): number {
  let max = 0
  const take = (rows: Row[] | undefined, extra: number, all = false) => {
    for (const r of rows ?? []) {
      const s = rowText(r)
      if (all || FRAME_STROKE.test(s)) max = Math.max(max, columns(s) + extra)
    }
  }
  for (const b of model.chrome.bands) take(b.rows, 6) // 1 cell of indent + the 5-cell [-] handle
  for (const p of model.chrome.panes) take(p.rows, 4, true) // inline pane: the frame and a cell of padding each side
  for (const it of model.items) {
    if (it.kind === 'assistant' || it.kind === 'note') take(it.rows, 2)
    else if (it.kind === 'tool') take(it.result, 5)
    else if (it.kind === 'command') take(it.output, 5)
  }
  return max
}

/**
 * Keeps the newest rows in view: pins scrollTop to the bottom whenever the content grows.
 * `focus` (cards): when the first mod element starts above the visible window, scroll so it
 * shows from its first row (one row of context above), even if the prompt goes out of view.
 */
function StickToBottom({ className, focus = false, children }: { className: string; focus?: boolean; children: ReactNode }) {
  const outer = useRef<HTMLDivElement>(null)
  const inner = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const o = outer.current
    const i = inner.current
    if (!o || !i) return
    const pin = () => {
      o.scrollTop = o.scrollHeight
      if (!focus) return
      const el = i.querySelector<HTMLElement>('[data-src]')
      if (!el) return
      const row = parseFloat(getComputedStyle(i).lineHeight) || 16
      const top = el.getBoundingClientRect().top - i.getBoundingClientRect().top
      if (top < o.scrollTop + row) o.scrollTop = Math.max(0, top - row)
    }
    pin()
    const ro = new ResizeObserver(pin)
    ro.observe(i)
    return () => ro.disconnect()
  }, [focus])
  return (
    <div ref={outer} className={className}>
      <div ref={inner} className="tm-flow">
        {children}
      </div>
    </div>
  )
}

function useColumns() {
  const ref = useRef<HTMLDivElement>(null)
  const [cols, setCols] = useState(80)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => {
      const fs = parseFloat(getComputedStyle(el).fontSize) || 13
      const w = el.clientWidth
      setCols(Math.floor(w / (fs * 0.6)))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, cols] as const
}

export default function TerminalSurface({ model, frame, terminalTheme, fullscreen, compact, rows, animate, cycle }: SurfaceProps) {
  const [screenRef, cols] = useColumns()
  const panes = model.chrome.panes.filter((p) => frame.chrome[p.id])
  const isFull = fullscreen && !compact
  const dock = isFull && cols >= DOCK_MIN_COLUMNS
  const wide = panes[0]?.width === 'wide'
  const fit = useMemo(() => fitColumns(model), [model])

  const style = {
    ...themeVars(terminalTheme),
    ['--rows' as string]: rows,
    ['--fit' as string]: fit,
  } as CSSProperties

  // Only the conversation fades in on a loop: the mods' band, pane and status stay put.
  const transcript = (
    <m.div
      key={cycle}
      className="tm-convo"
      initial={cycle === 0 ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      {compact ? null : <SessionHeader />}
      <InfoNotices model={model} frame={frame} />
      <TranscriptItems model={model} frame={frame} compact={compact} />
      <SpinnerLine model={model} frame={frame} animate={animate} />
    </m.div>
  )

  return (
    <div
      ref={screenRef}
      className="tm"
      data-term-theme={terminalTheme}
      data-layout={isFull ? 'fullscreen' : 'classic'}
      data-compact={compact || undefined}
      data-anim={animate ? 'on' : 'off'}
      style={style}
    >
      {compact ? null : (
        <div className="tm-titlebar" aria-hidden="true">
          <span className="tm-dots">
            <i />
            <i />
            <i />
          </span>
          <span className="tm-title">{HEADER.windowTitle}</span>
        </div>
      )}
      <div className="tm-screen">
        {isFull ? (
          <>
            <div className="tm-main">
              <div className="tm-transcript-col">
                <StickToBottom className="tm-scroll">{transcript}</StickToBottom>
                <ToastStack model={model} frame={frame} />
              </div>
              {dock ? <DockedPane panes={panes} wide={wide} frame={frame} /> : null}
            </div>
            <BottomZone model={model} frame={frame} animate={animate} inlinePanes={dock ? [] : panes} classicToasts={false} />
          </>
        ) : (
          <StickToBottom className="tm-scroll" focus={compact}>
            {transcript}
            <BottomZone model={model} frame={frame} animate={animate} inlinePanes={panes} classicToasts compact={compact} />
          </StickToBottom>
        )}
      </div>
    </div>
  )
}
