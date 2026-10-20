// MockClient — a faithful mock of the Claude Code client that plays a short session with
// one or more mods active. The heart of the site: hero, cards, detail sheet and the
// submit preview all use it. Contract: src/CONTRACTS.md and ./types.ts (MockClientProps).
import { AnimatePresence, m, useInView } from 'motion/react'
import { lazy, Suspense, useCallback, useId, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { useT, type TKey } from '../../i18n'
import { enter, exit } from '../../lib/motion'
import { useMotionPref } from '../../lib/motionPref'
import { useMediaQuery, usePageVisible } from '../../lib/hooks'
import { useTheme } from '../../lib/theme'
import { IconEditor, IconMoon, IconPause, IconPlay, IconReplay, IconSun, IconTerminal, IconWindow } from '../ui/icons'
import { MOCK_SURFACES, undrawnSlots } from './availability'
import { mergePreviews } from './model'
import NotDrawnNote from './NotDrawnNote'
import { HEADER } from './scenes'
import TerminalSurface from './terminal/TerminalSurface'
import { buildSchedule, finalFrame, frameAt } from './timeline'
import type { Frame, MockClientProps, MockModel, MockSurface, SurfaceProps, TerminalTheme } from './types'
import { usePlayback } from './usePlayback'
import './MockClient.css'

const DesktopSurface = lazy(() => import('./desktop/DesktopSurface'))
const VSCodeSurface = lazy(() => import('./vscode/VSCodeSurface'))

const SURFACE_ICON: Record<MockSurface, ReactNode> = {
  terminal: <IconTerminal size={16} />,
  desktop: <IconWindow size={16} />,
  vscode: <IconEditor size={16} />,
}

function Notifications({ model, frame, compact }: { model: MockModel; frame: Frame; compact: boolean }) {
  const { t } = useT()
  const list = model.chrome.notifications.filter((n) => frame.chrome[n.id])
  return (
    <div className="mc-notifs" data-compact={compact || undefined} aria-hidden="true">
      <AnimatePresence initial>
        {list.map((n) => (
          <m.div
            key={n.id}
            className="mc-notif"
            data-src={n.source}
            initial={{ opacity: 0, x: 18 }}
            animate={{ opacity: 1, x: 0, transition: enter }}
            exit={{ opacity: 0, x: 12, transition: exit }}
          >
            <span className="mc-notif-icon">
              <IconTerminal size={16} />
            </span>
            <span className="mc-notif-body">
              <span className="mc-notif-head">
                <span className="mc-notif-title">{n.title ?? HEADER.product}</span>
                <span className="mc-notif-time">{t('mock.now')}</span>
              </span>
              <span className="mc-notif-text">{n.text}</span>
            </span>
          </m.div>
        ))}
      </AnimatePresence>
    </div>
  )
}

function Backgrounds({ model, frame }: { model: MockModel; frame: Frame }) {
  const { t } = useT()
  const list = model.chrome.backgrounds.filter((b) => frame.chrome[b.id])
  if (!list.length) return null
  return (
    <ul className="mc-bg">
      {list.map((b) => (
        <li key={b.id} className="mc-bg-pill">
          <span className="mc-bg-dot" aria-hidden="true" />
          <span>
            <span className="mc-bg-label">{t('mock.background')}:</span> {b.text}
          </span>
        </li>
      ))}
    </ul>
  )
}

function usesCapturedTrees(model: MockModel): boolean {
  const c = model.chrome
  return !!(model.spinner.tree || [...c.bands, ...c.panes, ...c.hints, ...c.modes].some((x) => x.tree))
}

/** Every chrome element of the model, for "arrives now". */
function allChrome(model: MockModel) {
  const c = model.chrome
  return [...c.bands, ...c.panes, ...c.statuses, ...c.toasts, ...c.notifications, ...c.hints, ...c.modes, ...c.backgrounds]
}

/** Two-option segmented control (theme, layout). */
function Seg2<V extends string>({
  label,
  value,
  options,
  onChange,
  className,
}: {
  label: string
  value: V
  options: { value: V; label: string; title?: string }[]
  onChange: (v: V) => void
  className?: string
}) {
  return (
    <div className={['mc-seg mc-seg-sm', className].filter(Boolean).join(' ')} role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" className="mc-seg-btn" aria-pressed={value === o.value} title={o.title} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

export default function MockClient(props: MockClientProps) {
  const {
    previews,
    defaultSurface,
    onSurfaceChange,
    onTerminalThemeChange,
    onFullscreenChange,
    onPlayChange,
    autoPlay = true,
    loop = true,
    holdMs,
    loopFrom = 'start',
    replayKey = 0,
    scene,
    arriveAtStart,
    paneFollowsTools,
    arriveNow,
    highlight,
    compact = false,
    rows: rowsProp,
    toolbar: toolbarProp,
    notes = true,
    layoutId,
    className,
    label,
  } = props
  const { t } = useT()
  const site = useTheme()
  const motionPref = useMotionPref()
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '')

  // surface (controlled or own state)
  const [surfaceState, setSurfaceState] = useState<MockSurface>(
    () => defaultSurface ?? (previews[0]?.surface as MockSurface | undefined) ?? 'terminal',
  )
  const surface = props.surface ?? surfaceState
  const setSurface = useCallback(
    (s: MockSurface) => {
      if (props.surface === undefined) setSurfaceState(s)
      onSurfaceChange?.(s)
    },
    [props.surface, onSurfaceChange],
  )

  // Captured trees are per surface: the model takes the current surface's trees only when a
  // mod has any (otherwise the model, and so the playback, stays put across surface switches).
  const treeSurface = previews.some((p) => p.capturedTrees?.length) ? surface : undefined
  const model = useMemo(
    () => mergePreviews(previews, { scene, arriveAtStart, surface: treeSurface, paneFollowsTools }),
    [previews, scene, arriveAtStart, treeSurface, paneFollowsTools],
  )
  const schedule = useMemo(() => buildSchedule(model), [model])

  // Themes. The terminal follows the site until the person picks one (the hero starts it dark);
  // the desktop app and VS Code follow the site too, with their own choice.
  const [termState, setTermState] = useState<TerminalTheme | null>(null)
  const terminalTheme: TerminalTheme = props.terminalTheme ?? termState ?? site.resolved
  const setTerminalTheme = (v: TerminalTheme) => {
    if (props.terminalTheme === undefined) setTermState(v)
    onTerminalThemeChange?.(v)
  }
  const [appState, setAppState] = useState<TerminalTheme | null>(null)
  const appTheme: TerminalTheme = appState ?? site.resolved
  const theme = surface === 'terminal' ? terminalTheme : appTheme
  const setTheme = (v: TerminalTheme) => (surface === 'terminal' ? setTerminalTheme(v) : setAppState(v))

  // fullscreen: 'auto' → on from 960px viewports (the two-column hero): the prompt stays put
  // at the bottom while the conversation scrolls, so the page never shifts under the reader
  const wide = useMediaQuery('(min-width: 960px)')
  const [fsState, setFsState] = useState<boolean | null>(null)
  const fullscreen = typeof props.fullscreen === 'boolean' ? props.fullscreen : (fsState ?? wide)
  const setFullscreen = (v: boolean) => {
    if (typeof props.fullscreen !== 'boolean') setFsState(v)
    onFullscreenChange?.(v)
  }

  // playback
  const [playState, setPlayState] = useState(autoPlay)
  const play = props.play ?? playState
  const setPlay = (v: boolean) => {
    if (props.play === undefined) setPlayState(v)
    onPlayChange?.(v)
  }
  const [ownReplay, setOwnReplay] = useState(0)
  const rootRef = useRef<HTMLDivElement>(null)
  const inView = useInView(rootRef, { amount: 0.15 })
  const pageVisible = usePageVisible()
  const still = motionPref.still || compact
  const pb = usePlayback(schedule, {
    play,
    visible: inView && pageVisible,
    still,
    loop,
    replayKey: replayKey + ownReplay * 100003,
    holdMs,
    loopFromFirstTool: loopFrom === 'first-tool',
  })

  // A mod switched on while the session plays (a hero chip) arrives now, not at its anchor,
  // which may be at the end of the turn. Until the next loop.
  const tNow = useRef(0)
  if (Number.isFinite(pb.t)) tNow.current = pb.t
  const arrivals = useRef<{ cycle: number; at: Map<string, number> }>({ cycle: 0, at: new Map() })
  if (arrivals.current.cycle !== pb.cycle) arrivals.current = { cycle: pb.cycle, at: new Map() }
  useMemo(() => {
    for (const id of arriveNow ?? []) arrivals.current.at.set(id, tNow.current)
  }, [arriveNow])
  const arrived = arrivals.current.at

  const frame = useMemo(() => {
    const f = pb.t === Number.POSITIVE_INFINITY ? finalFrame(schedule) : frameAt(schedule, pb.t)
    if (f.final || !arrived.size) return f
    const chrome = { ...f.chrome }
    for (const c of allChrome(model)) {
      const at = arrived.get(c.source)
      if (at !== undefined && pb.t >= at) chrome[c.id] = true
    }
    return { ...f, chrome }
  }, [schedule, pb.t, model, arrived, arriveNow])

  // Panes that fill in as tools run show only the rows that have arrived, on every surface.
  const view = useMemo<MockModel>(() => {
    const shown = frame.paneRows
    if (!Object.keys(shown).length) return model
    const panes = model.chrome.panes.map((p) => (shown[p.id] === undefined ? p : { ...p, rows: p.rows.slice(0, shown[p.id]) }))
    return { ...model, chrome: { ...model.chrome, panes } }
  }, [model, frame.paneRows])

  const rows = rowsProp ?? (compact ? 10 : 26)
  const showToolbar = (toolbarProp ?? true) && !compact
  const undrawn = notes ? undrawnSlots(model.elements, surface) : []
  const modsLabel = model.sources.length ? model.sources.map((s) => s.label).join(', ') : t('mock.aria.noMods')
  const ariaLabel = label ?? t(`mock.aria.${surface}` as TKey, { mods: modsLabel })

  const surfaceProps: SurfaceProps = {
    model: view,
    frame,
    terminalTheme: theme,
    fullscreen,
    compact,
    rows,
    animate: pb.running,
    cycle: pb.cycle,
    onSurfaceChange: setSurface,
  }

  const canPlay = !still
  const replay = () => {
    setOwnReplay((n) => n + 1)
    if (!play) setPlay(true)
  }
  const themeLabel = surface === 'terminal' ? t('mock.theme.label') : t('mock.theme.appLabel')
  const nextTheme: TerminalTheme = theme === 'dark' ? 'light' : 'dark'

  return (
    <div
      ref={rootRef}
      className={['mc', className].filter(Boolean).join(' ')}
      data-surface={surface}
      data-compact={compact || undefined}
      data-mc={uid}
    >
      {highlight ? (
        <style>{`.mc[data-mc="${uid}"] [data-src="${highlight.replace(/["\\]/g, '')}"]{outline-color:var(--accent)}`}</style>
      ) : null}
      {showToolbar ? (
        <div className="mc-toolbar" role="group" aria-label={t('mock.toolbar.label')}>
          <div className="mc-seg mc-seg-surface" role="group" aria-label={t('mock.surface.label')}>
            {MOCK_SURFACES.map((s) => (
              // one accessible name whichever label the width shows
              <button
                key={s}
                type="button"
                className="mc-seg-btn"
                aria-pressed={surface === s}
                aria-label={t(`common.surface.${s}` as TKey)}
                onClick={() => setSurface(s)}
              >
                {SURFACE_ICON[s]}
                <span className="mc-seg-long" aria-hidden="true">
                  {t(`common.surface.${s}` as TKey)}
                </span>
                <span className="mc-seg-short" aria-hidden="true">
                  {t(`mock.surface.short.${s}` as TKey)}
                </span>
              </button>
            ))}
          </div>
          <div className="mc-tools">
            <Seg2
              className="mc-theme-seg"
              label={themeLabel}
              value={theme}
              onChange={setTheme}
              options={[
                { value: 'dark', label: t('mock.theme.dark') },
                { value: 'light', label: t('mock.theme.light') },
              ]}
            />
            {/* phones: one button that flips the theme */}
            <button
              type="button"
              className="mc-btn mc-btn-icon mc-theme-flip"
              aria-label={`${themeLabel}: ${t(`mock.theme.${nextTheme}` as TKey)}`}
              title={`${themeLabel}: ${t(`mock.theme.${nextTheme}` as TKey)}`}
              onClick={() => setTheme(nextTheme)}
            >
              {theme === 'dark' ? <IconSun size={16} /> : <IconMoon size={16} />}
            </button>
            {surface === 'terminal' ? (
              <Seg2
                className="mc-layout-seg"
                label={t('mock.layout.label')}
                value={fullscreen ? 'full' : 'classic'}
                onChange={(v) => setFullscreen(v === 'full')}
                options={[
                  { value: 'classic', label: t('mock.layout.classic'), title: t('mock.layout.classicTitle') },
                  { value: 'full', label: t('mock.layout.full'), title: t('mock.layout.fullTitle') },
                ]}
              />
            ) : null}
            {canPlay ? (
              <>
                <button
                  type="button"
                  className="mc-btn mc-btn-icon"
                  aria-label={play ? t('mock.pause') : t('mock.play')}
                  title={play ? t('mock.pause') : t('mock.play')}
                  onClick={() => setPlay(!play)}
                >
                  {play ? <IconPause size={16} /> : <IconPlay size={16} />}
                </button>
                <button
                  type="button"
                  className="mc-btn mc-btn-icon"
                  aria-label={t('mock.replay')}
                  title={t('mock.replay.title')}
                  onClick={replay}
                >
                  <IconReplay size={16} />
                </button>
              </>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="mc-stage">
        <m.div
          className="mc-window"
          layoutId={layoutId}
          data-term-theme={surface === 'terminal' ? terminalTheme : undefined}
          data-app-theme={surface === 'terminal' ? undefined : appTheme}
          {...(surface === 'terminal' ? { role: 'img', 'aria-label': ariaLabel } : { 'aria-label': ariaLabel, role: 'region' })}
        >
          {surface === 'terminal' ? (
            <TerminalSurface {...surfaceProps} />
          ) : (
            <Suspense fallback={<div className="mc-surface-loading" style={{ ['--rows' as string]: rows } as CSSProperties} />}>
              {surface === 'desktop' ? <DesktopSurface {...surfaceProps} /> : <VSCodeSurface {...surfaceProps} />}
            </Suspense>
          )}
        </m.div>
        {surface === 'terminal' ? <Notifications model={model} frame={frame} compact={compact} /> : null}
      </div>

      {!compact ? <Backgrounds model={model} frame={frame} /> : null}
      {!compact && undrawn.length ? <NotDrawnNote surface={surface} slots={undrawn} /> : null}
      {!compact && usesCapturedTrees(model) ? <p className="mc-badge">{t('mock.captured')}</p> : null}
    </div>
  )
}
