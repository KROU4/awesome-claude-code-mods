// MockClient — a faithful mock of the Claude Code client that plays a short session with
// one or more mods active. The heart of the site: hero, cards, detail sheet and the
// submit preview all use it. Contract: src/CONTRACTS.md and ./types.ts (MockClientProps).
import { AnimatePresence, m, useInView } from 'motion/react'
import { lazy, Suspense, useCallback, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { useT, type TKey } from '../../i18n'
import { enter, exit } from '../../lib/motion'
import { useMotionPref } from '../../lib/motionPref'
import { useMediaQuery, usePageVisible } from '../../lib/hooks'
import { useTheme } from '../../lib/theme'
import { IconEditor, IconExpand, IconPause, IconPlay, IconReplay, IconTerminal, IconWindow } from '../ui/icons'
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
  const list = model.chrome.notifications.filter((n) => frame.chrome[n.id])
  return (
    <div className="mc-notifs" data-compact={compact || undefined} aria-hidden="true">
      <AnimatePresence initial>
        {list.map((n) => (
          <m.div
            key={n.id}
            className="mc-notif"
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
                <span className="mc-notif-time">now</span>
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

export default function MockClient(props: MockClientProps) {
  const {
    previews,
    defaultSurface,
    onSurfaceChange,
    onTerminalThemeChange,
    onFullscreenChange,
    onPlayChange,
    loop = true,
    replayKey = 0,
    scene,
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

  const model = useMemo(() => mergePreviews(previews, { scene }), [previews, scene])
  const schedule = useMemo(() => buildSchedule(model), [model])

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

  // terminal theme: follows the site until the person picks one
  const [termState, setTermState] = useState<TerminalTheme | null>(null)
  const terminalTheme: TerminalTheme = props.terminalTheme ?? termState ?? site.resolved
  const setTerminalTheme = (v: TerminalTheme) => {
    if (props.terminalTheme === undefined) setTermState(v)
    onTerminalThemeChange?.(v)
  }

  // fullscreen: 'auto' → on from 1100px viewports
  const wide = useMediaQuery('(min-width: 1100px)')
  const [fsState, setFsState] = useState<boolean | null>(null)
  const fullscreen =
    typeof props.fullscreen === 'boolean' ? props.fullscreen : (fsState ?? wide)
  const setFullscreen = (v: boolean) => {
    if (typeof props.fullscreen !== 'boolean') setFsState(v)
    onFullscreenChange?.(v)
  }

  // playback
  const [playState, setPlayState] = useState(true)
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
  })
  const frame = useMemo(() => (pb.t === Number.POSITIVE_INFINITY ? finalFrame(schedule) : frameAt(schedule, pb.t)), [schedule, pb.t])

  const rows = rowsProp ?? (compact ? 10 : 26)
  const showToolbar = (toolbarProp ?? true) && !compact
  const undrawn = notes ? undrawnSlots(model.elements, surface) : []
  const modsLabel = model.sources.length ? model.sources.map((s) => s.label).join(', ') : t('mock.aria.noMods')
  const ariaLabel = label ?? t(`mock.aria.${surface}` as TKey, { mods: modsLabel })

  const surfaceProps: SurfaceProps = {
    model,
    frame,
    terminalTheme,
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

  return (
    <div
      ref={rootRef}
      className={['mc', className].filter(Boolean).join(' ')}
      data-surface={surface}
      data-compact={compact || undefined}
    >
      {showToolbar ? (
        <div className="mc-toolbar" role="group" aria-label={t('mock.toolbar.label')}>
          <div className="mc-seg" role="group" aria-label={t('mock.surface.label')}>
            {MOCK_SURFACES.map((s) => (
              <button
                key={s}
                type="button"
                className="mc-seg-btn"
                aria-pressed={surface === s}
                onClick={() => setSurface(s)}
              >
                {SURFACE_ICON[s]}
                <span>{t(`common.surface.${s}` as TKey)}</span>
              </button>
            ))}
          </div>
          <div className="mc-tools">
            {surface === 'terminal' ? (
              <>
                <div className="mc-seg mc-seg-sm" role="group" aria-label={t('mock.theme.label')}>
                  {(['dark', 'light'] as const).map((th) => (
                    <button
                      key={th}
                      type="button"
                      className="mc-seg-btn"
                      aria-pressed={terminalTheme === th}
                      onClick={() => setTerminalTheme(th)}
                    >
                      {t(`mock.theme.${th}`)}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  className="mc-btn"
                  aria-pressed={fullscreen}
                  title={t('mock.fullscreen.title')}
                  onClick={() => setFullscreen(!fullscreen)}
                >
                  <IconExpand size={16} />
                  <span className="mc-btn-label">{t('mock.fullscreen')}</span>
                </button>
              </>
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
