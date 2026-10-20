// The hero's live client: a large MockClient playing one session with a loadout of mods,
// and a chip per mod to switch it in or out. Switching animates exactly that mod's elements
// (MockClient keys them by mod name), the conversation behind them stays put. Pointing at a
// chip outlines what that mod draws, and the line under the chips says what it does.
import { useCallback, useEffect, useId, useMemo, useState } from 'react'
import { useT, type TKey } from '../../i18n'
import { useMediaQuery } from '../../lib/hooks'
import { useLoadout } from '../../lib/loadout'
import { useMotionPref } from '../../lib/motionPref'
import { useRegistry } from '../../lib/registry'
import { hrefFor } from '../../lib/router'
import { isPlainClick, openMod } from '../catalog/nav'
import { MockClient, type TerminalTheme } from '../mock'
import { IconCheck } from '../ui/icons'
import { useToast } from '../ui/Toaster'
import {
  DEFAULT_LOADOUT,
  HERO_HOLD_MS,
  HERO_ON_SCREEN,
  HERO_PANE_FOLLOWS_TOOLS,
  HERO_SCENE,
  heroChips,
  heroPreview,
  leadSlot,
  onShowInHero,
} from './heroSession'
import './hero.css'

/** Slots with a short chip label in hero.ts; others use the full common.slot name. */
const SHORT_SLOTS: ReadonlySet<string> = new Set([
  'above-prompt',
  'pane',
  'status',
  'toast',
  'notification',
  'prompt-hint',
  'session-mode',
  'spinner',
])

function IconPlus({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" aria-hidden="true" focusable="false">
      <path d="M10 4.5v11M4.5 10h11" />
    </svg>
  )
}

export type LiveClientProps = {
  /** The hero section's id: "Show together" scrolls it into view. */
  sectionId: string
  className?: string
}

export default function LiveClient({ sectionId, className }: LiveClientProps) {
  const { t, pick } = useT()
  const { registry, ready } = useRegistry()
  const loadout = useLoadout()
  const toast = useToast()
  const { still } = useMotionPref()
  const wide = useMediaQuery('(min-width: 1100px)')
  const twoCol = useMediaQuery('(min-width: 960px)')
  const roomy = useMediaQuery('(min-width: 600px)')
  const focusId = useId()

  const [selected, setSelected] = useState<string[]>(() => [...DEFAULT_LOADOUT])
  const [extra, setExtra] = useState<string[]>([])
  // A dark terminal reads as the product on both page themes; the toolbar switches it.
  const [terminalTheme, setTerminalTheme] = useState<TerminalTheme>('dark')
  /** The chip pointed at (hover or focus): its mod's elements are outlined in the mock. */
  const [hot, setHot] = useState<string | null>(null)
  /** The mod the line under the chips describes: the one pointed at or pressed last. */
  const [current, setCurrent] = useState<string | null>(null)
  /** Switched on just now: arrives in the playing session at once. */
  const [arriveNow, setArriveNow] = useState<readonly string[]>([])

  const chips = useMemo(() => heroChips(registry.mods, extra), [registry, extra])
  const active = useMemo(() => chips.filter((mod) => selected.includes(mod.name)), [chips, selected])
  const previews = useMemo(() => active.map(heroPreview), [active])
  const described = chips.find((mod) => mod.name === (hot ?? current)) ?? chips[0]

  const toggle = useCallback(
    (name: string) => {
      const on = !selected.includes(name)
      setSelected((cur) => (cur.includes(name) ? cur.filter((n) => n !== name) : [...cur, name]))
      if (on) setArriveNow([name])
      setCurrent(name)
    },
    [selected],
  )

  // "Show together" from elsewhere on the page.
  useEffect(
    () =>
      onShowInHero((names) => {
        const known = names.filter((n) => registry.mods.some((mod) => mod.name === n))
        if (!known.length) return
        setExtra(known)
        setSelected(known)
        setCurrent(known[0])
        document.getElementById(sectionId)?.scrollIntoView({ behavior: still ? 'auto' : 'smooth', block: 'start' })
      }),
    [registry, sectionId, still],
  )

  const missing = active.filter((mod) => !loadout.has(mod.name))
  const addAll = () => {
    if (!missing.length) return
    loadout.set([...loadout.names, ...missing.map((mod) => mod.name)])
    toast.show(t('hero.loadout.added'))
  }

  return (
    <div className={['hero-live', className].filter(Boolean).join(' ')}>
      <MockClient
        previews={previews}
        scene={HERO_SCENE}
        arriveAtStart={HERO_ON_SCREEN}
        paneFollowsTools={HERO_PANE_FOLLOWS_TOOLS}
        arriveNow={arriveNow}
        holdMs={HERO_HOLD_MS}
        loopFrom="first-tool"
        highlight={hot && selected.includes(hot) ? hot : null}
        terminalTheme={terminalTheme}
        onTerminalThemeChange={setTerminalTheme}
        // a phone keeps the whole client in the first screen; a tablet in portrait has room for more
        rows={wide ? 24 : twoCol ? 18 : roomy ? 22 : 17}
        className="hero-mock"
      />

      <div className="hero-mods" role="group" aria-labelledby={`${sectionId}-mods`}>
        <div className="hero-mods-head">
          <p id={`${sectionId}-mods`} className="hero-mods-label">
            {t('hero.mods.label')}
          </p>
          {active.length ? (
            missing.length ? (
              <button type="button" className="hero-add" onClick={addAll}>
                <IconPlus />
                {missing.length > 1 ? t('hero.loadout.addCount', { n: missing.length }) : t('hero.loadout.add')}
              </button>
            ) : (
              <span className="hero-add is-done">
                <IconCheck size={14} />
                {t('hero.loadout.in')}
              </span>
            )
          ) : null}
        </div>

        {ready ? null : (
          <ul className="hero-chips" aria-hidden="true">
            {[132, 118, 150, 124, 140].map((w, i) => (
              <li key={i} className="hero-chip-skel" style={{ width: w }} />
            ))}
          </ul>
        )}
        <ul className="hero-chips" hidden={!ready}>
          {chips.map((mod) => {
            const on = selected.includes(mod.name)
            const slot = leadSlot(mod)
            const slotLabel = !slot ? '' : t((SHORT_SLOTS.has(slot) ? `hero.slot.${slot}` : `common.slot.${slot}`) as TKey)
            return (
              <li key={mod.name}>
                <button
                  type="button"
                  className="hero-chip"
                  aria-pressed={on}
                  aria-label={slotLabel ? `${mod.title}, ${slotLabel}` : mod.title}
                  aria-describedby={`${focusId}-${mod.name}`}
                  onClick={() => toggle(mod.name)}
                  onPointerEnter={() => setHot(mod.name)}
                  onPointerLeave={() => setHot((h) => (h === mod.name ? null : h))}
                  onFocus={() => {
                    setHot(mod.name)
                    setCurrent(mod.name)
                  }}
                  onBlur={() => setHot((h) => (h === mod.name ? null : h))}
                >
                  <span className="hero-chip-mark" aria-hidden="true" />
                  <span className="hero-chip-title">{mod.title}</span>
                  {slotLabel ? <span className="hero-chip-slot">{slotLabel}</span> : null}
                </button>
                <span id={`${focusId}-${mod.name}`} hidden>
                  {pick(mod.tagline, mod.tagline_ru)}
                </span>
              </li>
            )
          })}
        </ul>

        <p className="hero-focus" hidden={!ready || !described}>
          {described ? (
            <>
              <span className="hero-focus-title">{described.title}:</span> {pick(described.tagline, described.tagline_ru)}{' '}
              <a
                className="hero-focus-link"
                href={hrefFor({ name: 'mod', mod: described.name })}
                onClick={(e) => {
                  if (!isPlainClick(e)) return
                  e.preventDefault()
                  openMod(described.name)
                }}
              >
                {t('hero.mods.details')}
                <span className="sr-only">: {described.title}</span>
              </a>
            </>
          ) : null}
        </p>

        <p className="hero-mods-none" aria-live="polite">
          {active.length || !ready ? '' : t('hero.mods.none')}
        </p>
      </div>
    </div>
  )
}
