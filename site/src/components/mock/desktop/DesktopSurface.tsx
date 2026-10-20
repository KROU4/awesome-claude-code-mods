// Desktop surface — the Claude desktop app's Code tab (site-spec "Desktop mock — exact
// look", visual-4.md §4): top tabs Chat · Cowork · Code, the session list, the session
// title bar with Terminal / Changes / Browser, the chat column in the app's proportional
// font, the prompt box with + on the left and the model chip and usage ring on the right,
// and the environment · folder · permission row under it. claude.ai palette (§4.2).
//
// Where the mods draw: panes beside the chat behind a header (above the prompt when the
// window is narrow), the band as a tray above the prompt box with native buttons, status
// entries as a thin row under it, toasts (and notifications, which the desktop app turns
// into toasts: api-0.md §3) at the top-right of the chat. Turn duration and info notices
// are terminal-only: MockClient shows the "Not drawn" note for them.
import { AnimatePresence, m } from 'motion/react'
import type { CSSProperties, ReactNode } from 'react'
import type { Row } from '../../../data/types'
import { enter, exit } from '../../../lib/motion'
import type { Frame, MockModel, ModelChrome, ModelItem, SurfaceProps } from '../types'
import {
  IArrowUp,
  IBlock,
  IAlert,
  IChevronDown,
  IChevronRight,
  IClose,
  IDiff,
  IFile,
  IFolder,
  IGlobe,
  IInfo,
  ILaptop,
  IMore,
  IPencil,
  IPlug,
  IPlus,
  ISearch,
  IShield,
  ISidebar,
  ISliders,
  IStop,
  ITerminal,
  UsageRing,
} from './icons'
import {
  denyText,
  drawnItems,
  editCounts,
  NativeBody,
  NativeInline,
  NativeRows,
  plainRows,
  sessionTitle,
  sourceLabel,
  SpinnerRow,
  splitPath,
  StickToBottom,
  surfaceVars,
  toolKind,
  toolSummary,
  useWidth,
  type ToolItem,
} from './native'
import NativeTree from './NativeTree'
import './desktop.css'

type Pane = ModelChrome['panes'][number]

/** Window width (px) from which the session list shows in full… */
const SIDEBAR_MIN = 900
/** …and from which a slim one shows (150px, truncated titles): it is what says "desktop app". */
const SIDEBAR_SLIM_MIN = 700
const SIDEBAR_SLIM_PX = 150
/** Window width (px) from which a pane docks beside the chat instead of above the prompt. */
const DOCK_MIN = 620

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
const slideIn = {
  initial: { opacity: 0, x: 28 },
  animate: { opacity: 1, x: 0, transition: enter },
  exit: { opacity: 0, x: 16, transition: exit },
}
const drop = {
  initial: { opacity: 0, y: -8, scale: 0.98 },
  animate: { opacity: 1, y: 0, scale: 1, transition: enter },
  exit: { opacity: 0, y: -6, transition: exit },
}

/** Mod colors on the app background: the terminal tokens, with the ones that would miss 4.5:1 retuned. */
const VARS = {
  light: {
    text: '#141413',
    canvas: '#faf9f5',
    inactive: '#6b6a65',
    subtle: '#b0aea5',
    claude: '#a94e2f',
    claudeShimmer: '#d97757',
    success: '#2f7613',
    error: '#b53333',
    warning: '#875a08',
    permission: '#1b67b2',
    suggestion: '#1b67b2',
    remember: '#1b67b2',
    ide: '#1b67b2',
  },
  dark: {
    text: '#faf9f5',
    canvas: '#262624',
    inactive: '#9c9a92',
    subtle: '#5d5c58',
    claude: '#d97757',
    claudeShimmer: '#eb9f7f',
    success: '#6cb33f',
    error: '#e86b6b',
  },
} as const

const OTHER_SESSIONS = [
  { title: 'Fix the flaky checkout e2e test', meta: '1h' },
  { title: 'Upgrade the build to Vite 8', meta: 'Yesterday' },
]

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ')

function visible<T extends { id: string }>(list: T[], frame: Frame): T[] {
  return list.filter((x) => frame.chrome[x.id])
}

// ── window chrome ──────────────────────────────────────────────────────────────────────

function AppBar() {
  return (
    <div className="dk-appbar" aria-hidden="true">
      <span className="dk-dots">
        <i />
        <i />
        <i />
      </span>
      <span className="dk-tabs">
        <span className="dk-tab">Chat</span>
        <span className="dk-tab">Cowork</span>
        <span className="dk-tab is-active">Code</span>
      </span>
    </div>
  )
}

function Sidebar({ title, working, slim }: { title: string; working: boolean; slim: boolean }) {
  return (
    <nav className="dk-side" data-slim={slim || undefined} aria-hidden="true">
      <span className="dk-new">
        <IPlus />
        {slim ? 'New' : 'New session'}
        {slim ? null : <kbd className="dk-kbd">Ctrl N</kbd>}
      </span>
      <span className="dk-side-label">Sessions</span>
      <span className="dk-session is-active">
        <span className="dk-session-title">{title}</span>
        <span className="dk-session-meta">
          {working ? <span className="dk-session-dot nv-blink" /> : null}
          {working ? 'Working' : 'now'}
        </span>
      </span>
      {OTHER_SESSIONS.map((s) => (
        <span className="dk-session" key={s.title}>
          <span className="dk-session-title">{s.title}</span>
          <span className="dk-session-meta">{s.meta}</span>
        </span>
      ))}
      <span className="dk-side-foot">
        <ISliders />
        Customize
      </span>
    </nav>
  )
}

function SessionBar({ title, changes, labels, sidebar }: { title: string; changes: { add: number; rem: number }; labels: boolean; sidebar: boolean }) {
  return (
    <div className="dk-sessbar" aria-hidden="true">
      <span className="dk-sessbar-l">
        {sidebar ? null : (
          <span className="dk-iconbtn">
            <ISidebar />
          </span>
        )}
        <span className="dk-sess-title">{title}</span>
        <span className="dk-sess-folder">
          <IFolder />
          shop
        </span>
      </span>
      <span className="dk-sessbar-r">
        <span className="dk-hbtn">
          <ITerminal />
          {labels ? 'Terminal' : null}
        </span>
        <span className="dk-hbtn">
          <IDiff />
          {labels ? 'Changes' : null}
          {changes.add || changes.rem ? (
            <span className="dk-counts">
              <span className="is-add">+{changes.add}</span>
              <span className="is-rem">−{changes.rem}</span>
            </span>
          ) : null}
        </span>
        <span className="dk-hbtn">
          <IGlobe />
          {labels ? 'Browser' : null}
        </span>
        <span className="dk-iconbtn">
          <IMore />
        </span>
      </span>
    </div>
  )
}

// ── transcript ─────────────────────────────────────────────────────────────────────────

function lines(text: string): ReactNode {
  return text.split('\n').map((l, i) => (
    <span key={i}>
      {i > 0 ? <br /> : null}
      {l}
    </span>
  ))
}

function ToolIcon({ it, status }: { it: ToolItem; status: string }) {
  if (status === 'running') return <span className="dk-tool-run nv-blink" />
  if (it.deny) return <IBlock />
  if (status === 'error') return <IAlert />
  if (it.modelTool) return <IPlug />
  switch (toolKind(it.tool)) {
    case 'read':
      return <IFile />
    case 'edit':
      return <IPencil />
    case 'shell':
      return <ITerminal />
    case 'search':
      return <ISearch />
    case 'web':
      return <IGlobe />
    default:
      return <IPlug />
  }
}

function ToolArg({ input }: { input: string }) {
  if (!input) return null
  const p = splitPath(input)
  return (
    <span className="dk-tool-arg">
      {p ? (
        <>
          <span className="dk-arg-dir">{p.dir}</span>
          {p.base}
        </>
      ) : (
        input
      )}
    </span>
  )
}

/** A tool call: a compact rounded row; results stay folded except output worth reading. */
function ToolRow({ it, phase, chars }: { it: ToolItem; phase: 'running' | 'done'; chars?: number }) {
  const status = phase === 'running' ? 'running' : it.status
  const kind = toolKind(it.tool)
  const done = status !== 'running'
  const hasResult = done && !!it.result?.length
  const counts = kind === 'edit' && hasResult ? editCounts(plainRows(it.result)) : null
  const summary = hasResult ? toolSummary(it) : null
  const open = hasResult && (!!it.deny || status === 'error' || kind === 'shell' || !!it.row || (!counts && !summary))

  let right: ReactNode = null
  if (!done) right = <span className="dk-tool-sum">Running…</span>
  else if (it.deny) right = <span className="dk-tool-sum is-error">Denied</span>
  else if (counts)
    right = (
      <span className="dk-counts">
        <span className="is-add">+{counts.add}</span>
        {counts.rem ? <span className="is-rem">−{counts.rem}</span> : null}
      </span>
    )
  else if (summary) right = <span className="dk-tool-sum">{summary}</span>

  let body: ReactNode = null
  if (open && it.result) {
    if (it.deny) body = <div className="dk-tool-deny">{denyText(it, chars)}</div>
    else if (it.row) body = <NativeRows rows={it.result} className="dk-tool-custom" />
    else body = <NativeRows rows={it.result} forceCells={kind === 'shell'} className={cx('dk-tool-out', status === 'error' && 'is-error')} />
  }

  return (
    <div className="dk-tool" data-status={status} data-open={open || undefined}>
      {it.row ? (
        <div className="dk-tool-head is-custom">
          <NativeRows rows={[it.row]} />
        </div>
      ) : (
        <div className="dk-tool-head">
          <span className="dk-tool-icon">
            <ToolIcon it={it} status={status} />
          </span>
          <span className="dk-tool-name">{it.tool}</span>
          <ToolArg input={it.input} />
          <span className="dk-tool-right">
            {right}
            {hasResult ? <span className="dk-tool-chev">{open ? <IChevronDown /> : <IChevronRight />}</span> : null}
          </span>
        </div>
      )}
      {body ? <div className="dk-tool-body">{body}</div> : null}
    </div>
  )
}

function itemClass(it: ModelItem): string {
  switch (it.kind) {
    case 'user':
    case 'command':
    case 'rewrite':
      return 'dk-turn-user'
    case 'tool':
      return 'dk-turn-tool'
    case 'note':
      return 'dk-turn-note'
    default:
      return 'dk-turn-asst'
  }
}

function ItemBody({ it, frame, model }: { it: ModelItem; frame: Frame; model: MockModel }) {
  const f = frame.items[it.id]
  switch (it.kind) {
    case 'user':
      return (
        <div className="dk-user">
          <div className="dk-bubble">{lines(it.text)}</div>
        </div>
      )
    case 'assistant':
      return <NativeBody text={it.text} markdown={it.markdown} rows={it.rows} />
    case 'tool':
      return <ToolRow it={it} phase={f.phase} chars={f.chars} />
    case 'command':
      return (
        <>
          <div className="dk-user">
            <div className="dk-bubble is-command">{[it.command, it.args].filter(Boolean).join(' ')}</div>
          </div>
          {f.phase === 'done' && (it.output?.length || it.markdown) ? (
            <div className="dk-cmdout">
              <span className="dk-cmdout-label">{it.command}</span>
              <NativeBody markdown={it.markdown} rows={it.output} />
            </div>
          ) : null}
        </>
      )
    case 'rewrite':
      return (
        <>
          <div className="dk-user is-rewritten">
            <div className="dk-bubble">{lines(it.before)}</div>
          </div>
          {f.phase === 'done' ? (
            <>
              <p className="dk-rewrite-note">Rewritten by {sourceLabel(model, it.source)}</p>
              <div className="dk-user">
                <div className="dk-bubble">{lines(it.after)}</div>
              </div>
            </>
          ) : null}
        </>
      )
    case 'note':
      return (
        <div className="dk-note">
          <IInfo />
          <NativeBody markdown={it.markdown} rows={it.rows} />
        </div>
      )
    default:
      return null
  }
}

function Thread({ model, frame, animate }: { model: MockModel; frame: Frame; animate: boolean }) {
  const items = drawnItems(model, frame)
  return (
    <>
      {items.map((it) => (
        <m.div
          key={it.id}
          className={itemClass(it)}
          initial={animate ? { opacity: 0, y: 6 } : false}
          animate={{ opacity: 1, y: 0, transition: enter }}
        >
          <ItemBody it={it} frame={frame} model={model} />
        </m.div>
      ))}
      <SpinnerRow model={model} frame={frame} animate={animate} className="dk-turn-asst dk-spin" />
    </>
  )
}

// ── mod chrome ─────────────────────────────────────────────────────────────────────────

function PaneContent({ pane }: { pane: Pane }) {
  if (pane.tree && pane.tree.surface === 'desktop') return <NativeTree tree={pane.tree.tree} />
  return <NativeRows rows={pane.rows} />
}

function PaneHead({ panes }: { panes: Pane[] }) {
  return (
    <div className="dk-pane-head">
      {panes.length > 1 ? (
        <span className="dk-pane-tabs">
          {panes.map((p, i) => (
            <span key={p.id} className={cx('dk-pane-tab', i === 0 && 'is-active')}>
              {p.title}
            </span>
          ))}
        </span>
      ) : (
        <span className="dk-pane-title">{panes[0].title}</span>
      )}
      <span className="dk-iconbtn dk-pane-close" aria-hidden="true">
        <IClose />
      </span>
    </div>
  )
}

function DockedPane({ panes }: { panes: Pane[] }) {
  const wide = panes[0]?.width === 'wide'
  return (
    <AnimatePresence initial>
      {panes.length ? (
        <m.aside key="pane" className="dk-pane" data-wide={wide || undefined} data-src={panes[0].source} {...slideIn}>
          <PaneHead panes={panes} />
          <div className="dk-pane-body">
            <PaneContent pane={panes[0]} />
          </div>
        </m.aside>
      ) : null}
    </AnimatePresence>
  )
}

function InlinePane({ panes }: { panes: Pane[] }) {
  return (
    <AnimatePresence initial>
      {panes.length ? (
        <m.div key="pane" className="nv-clip" {...grow}>
          <div className="dk-pane is-inline" data-src={panes[0].source}>
            <PaneHead panes={panes} />
            <div className="dk-pane-body">
              <PaneContent pane={panes[0]} />
            </div>
          </div>
        </m.div>
      ) : null}
    </AnimatePresence>
  )
}

function Band({ model, frame }: { model: MockModel; frame: Frame }) {
  const bands = visible(model.chrome.bands, frame)
  return (
    <AnimatePresence initial>
      {bands.length ? (
        <m.div key="band" className="nv-clip dk-band-clip" {...grow}>
          <div className="dk-band">
            <AnimatePresence initial={false}>
              {bands.map((b) => (
                <m.div key={b.id} className="nv-clip" {...grow}>
                  <div className="dk-band-item" data-src={b.source}>
                    {b.tree && b.tree.surface === 'desktop' ? <NativeTree tree={b.tree.tree} /> : <NativeRows rows={b.rows} />}
                  </div>
                </m.div>
              ))}
            </AnimatePresence>
          </div>
        </m.div>
      ) : null}
    </AnimatePresence>
  )
}

function Composer({ frame, animate, placeholder }: { frame: Frame; animate: boolean; placeholder: string }) {
  const typing = frame.prompt.length > 0
  const working = !!frame.spinner && !typing
  return (
    <div className="dk-composer">
      <div className="dk-input">
        {typing ? (
          <>
            {frame.prompt}
            <span className="nv-caret is-steady" aria-hidden="true" />
          </>
        ) : (
          <>
            <span className={cx('nv-caret', !animate && 'is-steady')} aria-hidden="true" />
            <span className="dk-ph">{placeholder}</span>
          </>
        )}
      </div>
      <div className="dk-composer-foot" aria-hidden="true">
        <span className="dk-iconbtn dk-plus">
          <IPlus />
        </span>
        <span className="dk-composer-r">
          <span className="dk-model">
            Opus 5.5
            <IChevronDown />
          </span>
          <span className="dk-usage" title="Usage">
            <UsageRing value={0.38} />
          </span>
          <span className="dk-send" data-state={typing ? 'ready' : working ? 'stop' : 'idle'}>
            {working ? <IStop /> : <IArrowUp />}
          </span>
        </span>
      </div>
    </div>
  )
}

/** Under the prompt box: environment · folder · permission mode, session-mode labels at the right. */
function UnderRow({ model, frame, compact }: { model: MockModel; frame: Frame; compact: boolean }) {
  const modes = visible(model.chrome.modes, frame)
  if (compact && !modes.length) return null
  return (
    <div className="dk-under">
      {compact ? null : (
        <span className="dk-under-l" aria-hidden="true">
          <span className="dk-pick">
            <ILaptop />
            Local
            <IChevronDown />
          </span>
          <span className="dk-pick">
            <IFolder />
            shop
            <IChevronDown />
          </span>
          <span className="dk-pick">
            <IShield />
            Accept edits
            <IChevronDown />
          </span>
        </span>
      )}
      <span className="dk-under-r">
        <AnimatePresence initial>
          {modes.map((md, i) => (
            <m.span key={md.id} className="dk-mode" data-src={md.source} {...fade}>
              {i > 0 ? <span className="dk-amp">&amp;</span> : null}
              {md.tree && md.tree.surface === 'desktop' ? <NativeTree tree={md.tree.tree} /> : <NativeInline row={md.row} />}
            </m.span>
          ))}
        </AnimatePresence>
      </span>
    </div>
  )
}

const segText = (s: Row[number]): string | null => (typeof s === 'string' ? s : 'text' in s ? s.text : null)

/**
 * A mod's hint row that keeps the terminal's own "? for shortcuts" in front: the desktop app
 * has no such hint, so it goes (with the gap after it).
 */
function withoutShortcutsHint(row: Row): Row {
  const i = row.findIndex((s) => segText(s)?.trim() === '? for shortcuts')
  if (i < 0) return row
  let j = i + 1
  while (j < row.length && segText(row[j])?.trim() === '') j++
  return [...row.slice(0, i), ...row.slice(j)]
}

/** A thin row under that: the prompt hint (PromptHint) and the mods' status entries. */
function StatusRow({ model, frame }: { model: MockModel; frame: Frame }) {
  const hints = visible(model.chrome.hints, frame)
  const list = visible(model.chrome.statuses, frame)
  if (!list.length && !hints.length) return null
  return (
    <div className="dk-status">
      <AnimatePresence initial>
        {hints.map((h) => (
          <m.span key={h.id} className="dk-hint" data-src={h.source} {...fade}>
            {h.tree && h.tree.surface === 'desktop' ? <NativeTree tree={h.tree.tree} /> : <NativeInline row={withoutShortcutsHint(h.row)} />}
          </m.span>
        ))}
        {list.map((s) => (
          <m.span key={s.id} className="dk-status-entry" data-src={s.source} {...fade}>
            {s.text}
          </m.span>
        ))}
      </AnimatePresence>
    </div>
  )
}

function Toasts({ model, frame }: { model: MockModel; frame: Frame }) {
  const list = [
    ...visible(model.chrome.toasts, frame).map((t) => ({ id: t.id, source: t.source, title: undefined as string | undefined, text: t.text })),
    ...visible(model.chrome.notifications, frame).map((n) => ({ id: n.id, source: n.source, title: n.title, text: n.text })),
  ]
  return (
    <div className="dk-toasts">
      <AnimatePresence initial>
        {list.map((t) => (
          <m.div key={t.id} className="dk-toast" data-src={t.source} {...drop}>
            <span className="dk-toast-body">
              <span className="dk-toast-src">{sourceLabel(model, t.source)}</span>
              {t.title ? <span className="dk-toast-title">{t.title}</span> : null}
              <span className="dk-toast-text">{t.text}</span>
            </span>
            <span className="dk-toast-close" aria-hidden="true">
              <IClose />
            </span>
          </m.div>
        ))}
      </AnimatePresence>
    </div>
  )
}

// ── the surface ────────────────────────────────────────────────────────────────────────

export default function DesktopSurface({ model, frame, terminalTheme, compact, rows, animate, cycle }: SurfaceProps) {
  const [ref, width] = useWidth<HTMLDivElement>()
  const theme = terminalTheme
  const sidebar = !compact && width >= SIDEBAR_SLIM_MIN
  const slim = width < SIDEBAR_MIN
  // the pane docks when the chat column (beside the session list) has room for it
  const dock = width - (sidebar && slim ? SIDEBAR_SLIM_PX : 0) >= DOCK_MIN
  const panes = visible(model.chrome.panes, frame)
  const title = sessionTitle(model)

  const changes = { add: 0, rem: 0 }
  for (const it of model.items) {
    if (it.kind !== 'tool' || frame.items[it.id]?.phase !== 'done' || toolKind(it.tool) !== 'edit') continue
    const c = editCounts(plainRows(it.result))
    if (c) {
      changes.add += c.add
      changes.rem += c.rem
    }
  }

  const style = {
    ...surfaceVars(theme, VARS[theme]),
    ['--rows' as string]: rows,
  } as CSSProperties

  const placeholder = model.items.length ? 'Reply to Claude…' : 'Describe a task for Claude…'

  return (
    <div
      ref={ref}
      className="dk"
      data-dk-theme={theme}
      data-compact={compact || undefined}
      data-narrow={!dock || undefined}
      data-anim={animate ? 'on' : 'off'}
      style={style}
    >
      {compact ? null : <AppBar />}
      <div className="dk-body">
        {sidebar ? <Sidebar title={title} working={!!frame.spinner} slim={slim} /> : null}
        <div className="dk-main">
          {compact ? null : <SessionBar title={title} changes={changes} labels={width >= 760} sidebar={sidebar} />}
          <div className="dk-content">
            <div className="dk-chat">
              {/* only the conversation fades in on a loop: the mods' band, pane and status stay */}
              <StickToBottom className="dk-scroll" innerClassName="dk-thread">
                <m.div
                  key={cycle}
                  className="dk-convo"
                  initial={cycle === 0 ? false : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.3 }}
                >
                  <Thread model={model} frame={frame} animate={animate} />
                </m.div>
              </StickToBottom>
              <Toasts model={model} frame={frame} />
              <div className="dk-bottom">
                {dock ? null : <InlinePane panes={panes} />}
                <Band model={model} frame={frame} />
                <Composer frame={frame} animate={animate} placeholder={placeholder} />
                <UnderRow model={model} frame={frame} compact={compact} />
                <StatusRow model={model} frame={frame} />
              </div>
            </div>
            {dock ? <DockedPane panes={panes} /> : null}
          </div>
        </div>
      </div>
    </div>
  )
}
