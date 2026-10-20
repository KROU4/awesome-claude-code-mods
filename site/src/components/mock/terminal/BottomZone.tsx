// The bottom of the screen, top to bottom (visual-4.md §3.4): inline pane → band above the
// prompt → the prompt between two ─ lines → status line → hint line. Plus the docked pane
// and the toast stack used by the fullscreen layout. Mod elements arrive with motion:
// the band grows up out of the input, panes slide in from the right, toasts rise,
// status entries fade in place.
import { AnimatePresence, m } from 'motion/react'
import type { Row } from '../../../data/types'
import { enter, exit } from '../../../lib/motion'
import { RowView, Segs } from '../dsl/Segments'
import TreeRenderer from '../TreeRenderer'
import type { Frame, MockModel, ModelChrome } from '../types'
import { Box, Caret, CLOSE_MARK, HRule, POINTER } from './atoms'

type Pane = ModelChrome['panes'][number]

const grow = {
  initial: { height: 0, opacity: 0 },
  animate: { height: 'auto', opacity: 1, transition: { height: enter, opacity: { duration: 0.2, delay: 0.06 } } },
  exit: { height: 0, opacity: 0, transition: exit },
}
const fade = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: enter },
  exit: { opacity: 0, transition: exit },
}
const rise = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0, transition: enter },
  exit: { opacity: 0, y: -6, transition: exit },
}
const slideIn = {
  initial: { opacity: 0, x: 28 },
  animate: { opacity: 1, x: 0, transition: enter },
  exit: { opacity: 0, x: 16, transition: exit },
}

function visible<T extends { id: string }>(list: T[], frame: Frame): T[] {
  return list.filter((x) => frame.chrome[x.id])
}

function PaneBody({ panes }: { panes: Pane[] }) {
  const [first] = panes
  return (
    <>
      {panes.length > 1 ? (
        <div className="tl tm-tabs">
          {panes.map((p, i) => (
            <span key={p.id} className={i === 0 ? 'is-bold' : 'is-dim'}>
              {i + 1}: {p.title}
              {i < panes.length - 1 ? '  ' : ''}
            </span>
          ))}
        </div>
      ) : null}
      {first.tree && first.tree.surface === 'terminal' ? (
        <TreeRenderer tree={first.tree.tree} />
      ) : (
        first.rows.map((r, i) => <RowView key={i} row={r} className="is-clip" />)
      )}
    </>
  )
}

/** Inline pane (classic layout or a narrow fullscreen): framed box, title tab, ✕ in the top border. */
export function InlinePane({ panes }: { panes: Pane[] }) {
  return (
    <AnimatePresence initial>
      {panes.length ? (
        <m.div key="pane" className="tm-anim-clip" {...grow}>
          <Box title={panes[0].title} close className="tm-pane">
            <PaneBody panes={panes} />
          </Box>
        </m.div>
      ) : null}
    </AnimatePresence>
  )
}

/** Docked pane (fullscreen ≥ the dock width): ✕ row at the top, rows below. */
export function DockedPane({ panes, wide }: { panes: Pane[]; wide: boolean }) {
  return (
    <AnimatePresence initial>
      {panes.length ? (
        <m.aside key="dock" className="tm-dock" data-wide={wide || undefined} {...slideIn}>
          <div className="tm-dock-rule" aria-hidden="true" />
          <div className="tm-dock-inner">
            <div className="tl tm-dock-head">
              <span className="is-bold">{panes[0].title}</span>
              <span className="is-dim">{CLOSE_MARK}</span>
            </div>
            <PaneBody panes={panes} />
          </div>
        </m.aside>
      ) : null}
    </AnimatePresence>
  )
}

function Band({ model, frame }: { model: MockModel; frame: Frame }) {
  const bands = visible(model.chrome.bands, frame)
  const rows: { key: string; row?: Row; tree?: (typeof bands)[number]['tree'] }[] = []
  for (const b of bands) {
    if (b.tree && b.tree.surface === 'terminal') rows.push({ key: b.id, tree: b.tree })
    else b.rows.forEach((r, i) => rows.push({ key: `${b.id}:${i}`, row: r }))
  }
  return (
    <AnimatePresence initial>
      {rows.length ? (
        <m.div key="band" className="tm-anim-clip" {...grow}>
          <div className="tm-band">
            {rows.map((r, i) => (
              <div className="tm-band-row" key={r.key}>
                <div className="tm-band-body">{r.tree ? <TreeRenderer tree={r.tree.tree} /> : <RowView row={r.row as Row} />}</div>
                <span className="tm-band-handle is-dim">{i === 0 ? '[-]' : ''}</span>
              </div>
            ))}
          </div>
        </m.div>
      ) : null}
    </AnimatePresence>
  )
}

function PromptInput({ frame, animate }: { frame: Frame; animate: boolean }) {
  const typing = frame.prompt.length > 0
  return (
    <div className="tm-prompt">
      <HRule />
      <div className="tl tm-input">
        <span className="is-dim">{POINTER}&nbsp;</span>
        {frame.prompt}
        <Caret steady={typing || !animate} />
      </div>
      <HRule />
    </div>
  )
}

function StatusLine({ model, frame, classicToasts }: { model: MockModel; frame: Frame; classicToasts: boolean }) {
  const statuses = visible(model.chrome.statuses, frame)
  const toasts = classicToasts ? visible(model.chrome.toasts, frame) : []
  if (!statuses.length && !toasts.length) return null
  return (
    <div className="tm-status">
      <div className="tm-status-left">
        <AnimatePresence initial>
          {statuses.map((s, i) => (
            <m.span key={s.id} className="tm-status-entry" {...fade}>
              {i > 0 ? '  ' : ''}
              {s.text}
            </m.span>
          ))}
        </AnimatePresence>
      </div>
      <div className="tm-status-right">
        <AnimatePresence initial>
          {toasts.slice(-1).map((t) => (
            <m.span key={t.id} className="tm-notice" {...slideIn}>
              <span className="is-dim">{t.source} · </span>
              {t.text}
            </m.span>
          ))}
        </AnimatePresence>
      </div>
    </div>
  )
}

function HintLine({ model, frame }: { model: MockModel; frame: Frame }) {
  const hints = visible(model.chrome.hints, frame)
  const modes = visible(model.chrome.modes, frame)
  return (
    <div className="tm-hint">
      <div className="tm-hint-left">
        <AnimatePresence initial mode="wait">
          {hints.length ? (
            <m.span key={hints.map((h) => h.id).join('|')} {...fade}>
              {hints.map((h, i) => (
                <span key={h.id}>
                  {i > 0 ? '  ' : ''}
                  {h.tree && h.tree.surface === 'terminal' ? <TreeRenderer tree={h.tree.tree} inline /> : <Segs row={h.row} />}
                </span>
              ))}
            </m.span>
          ) : (
            <m.span key="default" className="is-dim" {...fade}>
              ? for shortcuts
            </m.span>
          )}
        </AnimatePresence>
      </div>
      <div className="tm-hint-right">
        <AnimatePresence initial>
          {modes.map((md, i) => (
            <m.span key={md.id} className="is-dim" {...fade}>
              {i > 0 ? ' & ' : ''}
              <Segs row={md.row} />
            </m.span>
          ))}
        </AnimatePresence>
      </div>
    </div>
  )
}

/** Toasts in fullscreen: a stack of small boxes at the top-right of the transcript. */
export function ToastStack({ model, frame }: { model: MockModel; frame: Frame }) {
  const toasts = visible(model.chrome.toasts, frame)
  return (
    <div className="tm-toasts">
      <AnimatePresence initial>
        {toasts.map((t) => (
          <m.div key={t.id} {...rise}>
            <Box title={<span className="is-dim">{t.source}</span>} className="tm-toast">
              <div className="tl">{t.text}</div>
            </Box>
          </m.div>
        ))}
      </AnimatePresence>
    </div>
  )
}

export function BottomZone({
  model,
  frame,
  animate,
  inlinePanes,
  classicToasts,
}: {
  model: MockModel
  frame: Frame
  animate: boolean
  /** Panes drawn inline above the band (classic layout, or fullscreen too narrow to dock). */
  inlinePanes: Pane[]
  /** Toasts as one line at the right of the status row (classic layout). */
  classicToasts: boolean
}) {
  return (
    <div className="tm-bottom">
      <InlinePane panes={inlinePanes} />
      <Band model={model} frame={frame} />
      <PromptInput frame={frame} animate={animate} />
      <StatusLine model={model} frame={frame} classicToasts={classicToasts} />
      <HintLine model={model} frame={frame} />
    </div>
  )
}
