// The terminal surface: Claude Code's TUI in classic or fullscreen layout.
//   classic:    header, transcript, spinner, then the bottom zone right under it; the
//               whole screen scrolls like a terminal when it fills up.
//   fullscreen: transcript scrolls on its own; the bottom zone is pinned to the bottom;
//               a pane docks at the right behind a 1-column │ rule; toasts stack at the
//               transcript's top-right.
import { m } from 'motion/react'
import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { themeVars } from '../dsl/colors'
import type { SurfaceProps } from '../types'
import { HEADER } from '../scenes'
import { BottomZone, DockedPane, ToastStack } from './BottomZone'
import { InfoNotices, SessionHeader, SpinnerLine, TranscriptItems } from './Transcript'
import './terminal.css'

/** Mock-scale dock threshold, in columns (the client docks from 110; the mock is smaller). */
const DOCK_MIN_COLUMNS = 74

/** Keeps the newest rows in view: pins scrollTop to the bottom whenever the content grows. */
function StickToBottom({ className, children }: { className: string; children: ReactNode }) {
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
    return () => ro.disconnect()
  }, [])
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

  const style = {
    ...themeVars(terminalTheme),
    ['--rows' as string]: rows,
  } as CSSProperties

  const transcript = (
    <>
      {compact ? null : <SessionHeader />}
      <InfoNotices model={model} frame={frame} />
      <TranscriptItems model={model} frame={frame} />
      <SpinnerLine model={model} frame={frame} animate={animate} />
    </>
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
      <m.div
        key={cycle}
        className="tm-screen"
        initial={cycle === 0 ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        {isFull ? (
          <>
            <div className="tm-main">
              <div className="tm-transcript-col">
                <StickToBottom className="tm-scroll">{transcript}</StickToBottom>
                <ToastStack model={model} frame={frame} />
              </div>
              {dock ? <DockedPane panes={panes} wide={wide} /> : null}
            </div>
            <BottomZone model={model} frame={frame} animate={animate} inlinePanes={dock ? [] : panes} classicToasts={false} />
          </>
        ) : (
          <StickToBottom className="tm-scroll">
            {transcript}
            <BottomZone model={model} frame={frame} animate={animate} inlinePanes={panes} classicToasts />
          </StickToBottom>
        )}
      </m.div>
    </div>
  )
}
