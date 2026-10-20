// VS Code surface — the Claude Code chat panel in a VS Code window (site-spec "Surfaces"):
// title bar with the command center, activity bar, the editor dimmed behind a few lines of
// TypeScript, the Claude Code panel docked right (messages on a timeline, tool rows, Bash
// as IN / OUT, the prompt box) and the status bar. Default Dark Modern / Light Modern
// colors. Narrow windows drop the editor and give the panel the width.
//
// Where the mods draw (availability.ts): panes as a section at the top of the panel;
// messages, tool rows, the spinner and prompt rewrites in the thread; toasts as VS Code
// notifications at the bottom-right (VSCODE_AS_NOTIFICATION). Band, status, hint, mode,
// slash-command output, notifications, turn duration and info notices are not drawn here:
// MockClient shows the "Not drawn in VS Code" note for them.
import { AnimatePresence, m } from 'motion/react'
import type { CSSProperties, ReactNode } from 'react'
import { enter, exit } from '../../../lib/motion'
import type { Frame, MockModel, ModelChrome, ModelItem, SurfaceProps } from '../types'
import {
  IAccount,
  IAlert,
  IArrowUp,
  IAt,
  IBell,
  IBlock,
  IBranch,
  IChevronDown,
  IChevronRight,
  IClose,
  IDebug,
  IExtensions,
  IEye,
  IFastForward,
  IFiles,
  IGear,
  IHistory,
  IInfo,
  IMoreH,
  INewChat,
  IPaperclip,
  ISearch,
  IStop,
  ISync,
  IBroadcast,
} from '../desktop/icons'
import {
  denyText,
  drawnItems,
  editCounts,
  NativeBody,
  NativeRows,
  plainRows,
  sessionTitle,
  sourceLabel,
  SpinnerRow,
  StickToBottom,
  surfaceVars,
  toolKind,
  toolSummary,
  useWidth,
  type ToolItem,
} from '../desktop/native'
import NativeTree from '../desktop/NativeTree'
import './vscode.css'

type Pane = ModelChrome['panes'][number]

/** Window width (px) from which the editor shows beside the Claude Code panel. */
const EDITOR_MIN = 640

const slideIn = {
  initial: { opacity: 0, x: 24 },
  animate: { opacity: 1, x: 0, transition: enter },
  exit: { opacity: 0, x: 14, transition: exit },
}
const rise = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0, transition: enter },
  exit: { opacity: 0, y: 8, transition: exit },
}

/** Mod colors in the panel: terminal tokens with VS Code's foregrounds where they read better. */
const VARS = {
  light: {
    text: '#3b3b3b',
    canvas: '#f8f8f8',
    inactive: '#616161',
    claude: '#a94e2f',
    claudeShimmer: '#d97757',
    success: '#2c7a39',
    error: '#c72e0f',
    warning: '#895503',
    permission: '#005fb8',
    suggestion: '#005fb8',
    remember: '#005fb8',
    ide: '#005fb8',
  },
  dark: {
    text: '#cccccc',
    canvas: '#181818',
    inactive: '#9d9d9d',
    claude: '#d97757',
    claudeShimmer: '#eb9f7f',
    success: '#89d185',
    error: '#f14c4c',
    warning: '#cca700',
  },
} as const

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ')

function visible<T extends { id: string }>(list: T[], frame: Frame): T[] {
  return list.filter((x) => frame.chrome[x.id])
}

// ── the editor behind the panel ────────────────────────────────────────────────────────

const CODE_START = 28
const CODE = [
  "import type { CartLine, DiscountCode } from './types'",
  "import { ExpiredCodeError } from '../api/errors'",
  '',
  'export function applyDiscount(subtotal: number, code?: DiscountCode): number {',
  '  if (!code) return subtotal',
  '  if (code.expiresAt < Date.now()) throw new ExpiredCodeError(code.id)',
  "  const off = code.kind === 'percent' ? subtotal * (code.value / 100) : code.value",
  '  return Math.max(0, subtotal - off)',
  '}',
  '',
  'export function cartTotal(lines: CartLine[], code?: DiscountCode): number {',
  '  const subtotal = lines.reduce((sum, l) => sum + l.price * l.qty, 0)',
  '  // Round once, on the total, so shared discounts do not drift by a cent.',
  '  return Math.round(applyDiscount(subtotal, code) * 100) / 100',
  '}',
  '',
  'export function formatTotal(total: number, currency = "USD"): string {',
  "  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(total)",
  '}',
]

const KEYWORDS = new Set(['import', 'export', 'from', 'type', 'function', 'const', 'let', 'new', 'number', 'string'])
const CONTROL = new Set(['return', 'if', 'throw', 'await'])
const TOKEN =
  /(\/\/.*$)|('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*")|(\b\d+(?:\.\d+)?\b)|(\b[A-Z][A-Za-z0-9]*\b)|(\b[a-zA-Z_$][\w$]*\b)(?=\s*\()|(\b[a-zA-Z_$][\w$]*\b)/g

/** A tiny TypeScript highlighter for the fixed editor lines (Dark+ / Light+ token colors). */
function highlight(line: string): ReactNode[] {
  const out: ReactNode[] = []
  let last = 0
  let k = 0
  let mt: RegExpExecArray | null
  TOKEN.lastIndex = 0
  while ((mt = TOKEN.exec(line))) {
    if (mt.index > last) out.push(line.slice(last, mt.index))
    const t = mt[0]
    let cls = 'vs-tk-var'
    if (mt[1]) cls = 'vs-tk-com'
    else if (mt[2]) cls = 'vs-tk-str'
    else if (mt[3]) cls = 'vs-tk-num'
    else if (CONTROL.has(t)) cls = 'vs-tk-ctl'
    else if (KEYWORDS.has(t)) cls = 'vs-tk-kw'
    else if (mt[4]) cls = 'vs-tk-type'
    else if (mt[5]) cls = 'vs-tk-fn'
    out.push(
      <span key={k++} className={cls}>
        {t}
      </span>,
    )
    last = mt.index + t.length
  }
  if (last < line.length) out.push(line.slice(last))
  return out
}

function Editor() {
  return (
    <div className="vs-editor" aria-hidden="true">
      <div className="vs-tabs">
        {['total.ts', 'checkout.ts', 'orders.test.ts'].map((f, i) => (
          <span key={f} className={cx('vs-tab', i === 0 && 'is-active')}>
            <span className="vs-ts">TS</span>
            {f}
            {i === 0 ? <IClose className="nv-icon vs-tab-x" /> : null}
          </span>
        ))}
      </div>
      <div className="vs-crumbs">
        src
        <IChevronRight />
        cart
        <IChevronRight />
        <span className="vs-ts">TS</span>
        total.ts
        <IChevronRight />
        cartTotal
      </div>
      <div className="vs-code">
        {CODE.map((l, i) => (
          <div key={i} className={cx('vs-line', i === 13 && 'is-current')}>
            <span className="vs-ln">{CODE_START + i}</span>
            <span className="vs-src">{l ? highlight(l) : ' '}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function TitleBar() {
  return (
    <div className="vs-titlebar" aria-hidden="true">
      <span className="vs-dots">
        <i />
        <i />
        <i />
      </span>
      <span className="vs-cc">
        <ISearch />
        shop
      </span>
    </div>
  )
}

function ActivityBar() {
  return (
    <nav className="vs-activity" aria-hidden="true">
      <span className="vs-act">
        <IFiles />
      </span>
      <span className="vs-act">
        <ISearch />
      </span>
      <span className="vs-act">
        <IBranch />
        <span className="vs-badge">3</span>
      </span>
      <span className="vs-act">
        <IDebug />
      </span>
      <span className="vs-act">
        <IExtensions />
      </span>
      <span className="vs-act-bottom">
        <span className="vs-act">
          <IAccount />
        </span>
        <span className="vs-act">
          <IGear />
        </span>
      </span>
    </nav>
  )
}

function StatusBar({ narrow }: { narrow: boolean }) {
  return (
    <div className="vs-statusbar" aria-hidden="true">
      <span className="vs-remote">
        <IBroadcast />
      </span>
      <span className="vs-sb">
        <IBranch />
        feature/discount-codes
      </span>
      {narrow ? null : (
        <span className="vs-sb">
          <ISync />
        </span>
      )}
      <span className="vs-sb">
        <IBlock />0
        <IAlert />0
      </span>
      <span className="vs-sb-right">
        {narrow ? null : (
          <>
            <span className="vs-sb">Ln 41, Col 18</span>
            <span className="vs-sb">Spaces: 2</span>
            <span className="vs-sb">UTF-8</span>
          </>
        )}
        <span className="vs-sb">TypeScript</span>
        <span className="vs-sb">
          <IBell />
        </span>
      </span>
    </div>
  )
}

// ── the Claude Code panel ──────────────────────────────────────────────────────────────

function PanelHeader({ title }: { title: string }) {
  return (
    <div className="vs-panel-head" aria-hidden="true">
      <span className="vs-panel-name">Claude Code</span>
      <span className="vs-panel-session">{title}</span>
      <span className="vs-panel-actions">
        <INewChat />
        <IHistory />
        <IMoreH />
      </span>
    </div>
  )
}

function lines(text: string): ReactNode {
  return text.split('\n').map((l, i) => (
    <span key={i}>
      {i > 0 ? <br /> : null}
      {l}
    </span>
  ))
}

function ToolBody({ it, status, chars }: { it: ToolItem; status: string; chars?: number }) {
  const kind = toolKind(it.tool)
  const done = status !== 'running'
  if (it.row) {
    return done && it.result?.length ? <NativeRows rows={it.result} className="vs-tool-custom" /> : null
  }
  if (kind === 'shell') {
    return (
      <div className="vs-io">
        <div className="vs-io-row">
          <span className="vs-io-label">IN</span>
          <span className="vs-io-cmd">{it.input}</span>
        </div>
        {done && it.result?.length ? (
          <div className="vs-io-row">
            <span className="vs-io-label">OUT</span>
            {it.deny ? (
              <span className="vs-io-out is-error">{denyText(it, chars)}</span>
            ) : (
              <NativeRows rows={it.result} forceCells className={cx('vs-io-out', status === 'error' && 'is-error')} />
            )}
          </div>
        ) : null}
      </div>
    )
  }
  if (!done || !it.result?.length) return null
  if (it.deny) return <div className="vs-tool-res is-error">{denyText(it, chars)}</div>
  const counts = kind === 'edit' ? editCounts(plainRows(it.result)) : null
  if (counts) {
    return (
      <div className="vs-tool-res vs-counts">
        <span className="is-add">+{counts.add}</span>
        {counts.rem ? <span className="is-rem">−{counts.rem}</span> : null}
      </div>
    )
  }
  const summary = toolSummary(it)
  if (summary) return <div className="vs-tool-res">{plainRows(it.result).split('\n')[0]}</div>
  return <NativeRows rows={it.result} className={cx('vs-tool-res', status === 'error' && 'is-error')} />
}

function ToolRow({ it, phase, chars }: { it: ToolItem; phase: 'running' | 'done'; chars?: number }) {
  const status = phase === 'running' ? 'running' : it.status
  const shell = toolKind(it.tool) === 'shell'
  return (
    <>
      {it.row ? (
        <NativeRows rows={[it.row]} className="vs-tool-head is-custom" />
      ) : (
        <div className="vs-tool-head">
          <span className="vs-tool-name">{it.tool}</span>
          {it.input && !shell ? <span className="vs-tool-arg">{it.input}</span> : null}
        </div>
      )}
      <ToolBody it={it} status={status} chars={chars} />
    </>
  )
}

/** Timeline dot color of an item. */
function dot(it: ModelItem, frame: Frame): string {
  if (it.kind !== 'tool') return 'neutral'
  // A mod that redraws the tool line brings its own marker.
  if (it.row) return 'none'
  if (frame.items[it.id]?.phase === 'running') return 'running'
  return it.status === 'error' ? 'error' : 'success'
}

function Item({ it, frame, model }: { it: ModelItem; frame: Frame; model: MockModel }) {
  const f = frame.items[it.id]
  switch (it.kind) {
    case 'user':
      return <div className="vs-user">{lines(it.text)}</div>
    case 'rewrite':
      return (
        <>
          <div className="vs-user is-rewritten">{lines(it.before)}</div>
          {f.phase === 'done' ? (
            <>
              <p className="vs-rewrite-note">Rewritten by {sourceLabel(model, it.source)}</p>
              <div className="vs-user">{lines(it.after)}</div>
            </>
          ) : null}
        </>
      )
    case 'assistant':
      return <NativeBody text={it.text} markdown={it.markdown} rows={it.rows} />
    case 'tool':
      return <ToolRow it={it} phase={f.phase} chars={f.chars} />
    case 'note':
      return (
        <div className="vs-note">
          <NativeBody markdown={it.markdown} rows={it.rows} />
        </div>
      )
    default:
      return null
  }
}

function Thread({ model, frame, animate }: { model: MockModel; frame: Frame; animate: boolean }) {
  const items = drawnItems(model, frame, (it) => it.kind === 'command')
  return (
    <>
      {items.map((it) => {
        const user = it.kind === 'user' || it.kind === 'rewrite'
        return (
          <m.div
            key={it.id}
            className={user ? 'vs-turn vs-turn-user' : 'vs-turn vs-turn-step'}
            data-dot={user ? undefined : dot(it, frame)}
            initial={animate ? { opacity: 0, y: 6 } : false}
            animate={{ opacity: 1, y: 0, transition: enter }}
          >
            {user || dot(it, frame) === 'none' ? null : (
              <span className={cx('vs-dot', dot(it, frame) === 'running' && 'nv-blink')} aria-hidden="true" />
            )}
            <div className="vs-turn-body">
              <Item it={it} frame={frame} model={model} />
            </div>
          </m.div>
        )
      })}
      <SpinnerRow model={model} frame={frame} animate={animate} className="vs-turn vs-turn-step vs-spin" />
    </>
  )
}

function PaneSection({ panes }: { panes: Pane[] }) {
  const pane = panes[0]
  return (
    <AnimatePresence initial>
      {pane ? (
        <m.section key="pane" className="vs-pane" data-wide={pane.width === 'wide' || undefined} data-src={pane.source} {...slideIn}>
          <div className="vs-pane-head">
            <IChevronDown />
            {panes.length > 1 ? (
              <span className="vs-pane-tabs">
                {panes.map((p, i) => (
                  <span key={p.id} className={cx('vs-pane-tab', i === 0 && 'is-active')}>
                    {p.title}
                  </span>
                ))}
              </span>
            ) : (
              <span className="vs-pane-title">{pane.title}</span>
            )}
            <span className="vs-pane-close" aria-hidden="true">
              <IClose />
            </span>
          </div>
          <div className="vs-pane-body">
            {pane.tree && pane.tree.surface === 'vscode' ? <NativeTree tree={pane.tree.tree} /> : <NativeRows rows={pane.rows} />}
          </div>
        </m.section>
      ) : null}
    </AnimatePresence>
  )
}

function Composer({ frame, animate, typed }: { frame: Frame; animate: boolean; typed: string }) {
  const typing = typed.length > 0
  const working = !!frame.spinner && !typing
  return (
    <div className="vs-composer">
      <div className="vs-input">
        {typing ? (
          <>
            {typed}
            <span className="nv-caret is-steady" aria-hidden="true" />
          </>
        ) : (
          <>
            <span className={cx('nv-caret', !animate && 'is-steady')} aria-hidden="true" />
            <span className="vs-ph">{working ? 'Queue another message…' : 'Reply to Claude…'}</span>
          </>
        )}
      </div>
      <div className="vs-input-foot" aria-hidden="true">
        <span className="vs-ctx">
          <IEye />
          total.ts
        </span>
        <span className="vs-input-r">
          <span className="vs-mode">
            <IFastForward />
            Ask before edits
          </span>
          <IPaperclip />
          <IAt />
          <span className="vs-send" data-state={typing ? 'ready' : working ? 'stop' : 'idle'}>
            {working ? <IStop /> : <IArrowUp />}
          </span>
        </span>
      </div>
    </div>
  )
}

/** Toasts as VS Code notifications at the bottom-right of the window. */
function Notifications({ model, frame }: { model: MockModel; frame: Frame }) {
  const list = visible(model.chrome.toasts, frame)
  return (
    <div className="vs-notifs">
      <AnimatePresence initial>
        {list.map((t) => (
          <m.div key={t.id} className="vs-notif" data-src={t.source} {...rise}>
            <span className="vs-notif-icon">
              <IInfo />
            </span>
            <span className="vs-notif-body">
              <span className="vs-notif-text">{t.text}</span>
              <span className="vs-notif-src">Source: Claude Code ({sourceLabel(model, t.source)})</span>
            </span>
            <span className="vs-notif-actions" aria-hidden="true">
              <IGear />
              <IClose />
            </span>
          </m.div>
        ))}
      </AnimatePresence>
    </div>
  )
}

// ── the surface ────────────────────────────────────────────────────────────────────────

export default function VSCodeSurface({ model, frame, terminalTheme, compact, rows, animate, cycle }: SurfaceProps) {
  const [ref, width] = useWidth<HTMLDivElement>()
  const theme = terminalTheme
  const editor = !compact && width >= EDITOR_MIN
  const panes = visible(model.chrome.panes, frame)

  // Slash commands are not drawn in VS Code: do not type them into the prompt either.
  const commands = model.items.filter((it) => it.kind === 'command').map((it) => (it.kind === 'command' ? [it.command, it.args].filter(Boolean).join(' ') : ''))
  const typed = frame.prompt && commands.some((c) => c.startsWith(frame.prompt)) && frame.prompt.startsWith('/') ? '' : frame.prompt

  const style = {
    ...surfaceVars(theme, VARS[theme]),
    ['--rows' as string]: rows,
  } as CSSProperties

  return (
    <div
      ref={ref}
      className="vs"
      data-vs-theme={theme}
      data-compact={compact || undefined}
      data-narrow={!editor || undefined}
      data-anim={animate ? 'on' : 'off'}
      style={style}
    >
      {compact ? null : <TitleBar />}
      <div className="vs-body">
        {compact ? null : <ActivityBar />}
        {editor ? <Editor /> : null}
        <section className="vs-panel">
          {compact ? null : <PanelHeader title={sessionTitle(model)} />}
          <div className="vs-panel-content">
            <PaneSection panes={panes} />
            {/* only the conversation fades in on a loop: the mods' pane stays */}
            <StickToBottom className="vs-scroll" innerClassName="vs-thread">
              <m.div
                key={cycle}
                className="vs-convo"
                initial={cycle === 0 ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3 }}
              >
                <Thread model={model} frame={frame} animate={animate} />
              </m.div>
            </StickToBottom>
            <Composer frame={frame} animate={animate} typed={typed} />
          </div>
        </section>
      </div>
      {compact ? null : <StatusBar narrow={!editor} />}
      <Notifications model={model} frame={frame} />
    </div>
  )
}
