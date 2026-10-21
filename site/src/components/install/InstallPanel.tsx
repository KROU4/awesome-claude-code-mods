// InstallPanel: one tab per place the person runs Claude Code. Real deep links where an app
// handles them (claude-cli://, claude://, vscode://), a copyable line for everything else.
// Every value comes from lib/install resolveInstall(), which builds it from checked parts (plugin,
// marketplace repository, marketplace name) instead of the registry's ready-made strings.
//
// Honest links: on a phone (no Claude Code there) the link drops below the commands as a
// secondary button "on your computer"; and when a click opens nothing (the app is missing,
// or the claude-cli:// handler is not registered yet), a line says so after 1.5 s.
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { useT, type TKey } from '../../i18n'
import { useMediaQuery, useOverflowEdge } from '../../lib/hooks'
import { needsVersion, resolveInstall, type ResolvedInstall } from '../../lib/install'
import { readPref, writePref } from '../../lib/storage'
import type { SiteMod } from '../../data/types'
import { undrawnSlots } from '../mock'
import CopyButton from '../ui/CopyButton'
import { IconEditor, IconTerminal, IconWindow } from '../ui/icons'
import './install.css'

export type InstallTab = 'terminal' | 'shell' | 'desktop' | 'vscode' | 'ask'
export const INSTALL_TABS: readonly InstallTab[] = ['terminal', 'desktop', 'vscode', 'shell', 'ask']

export type InstallPanelProps = {
  mod: SiteMod
  /** 'full' in the detail sheet; 'popover' when opened from a card's Install button. */
  variant?: 'full' | 'popover'
  /** Default: the tab this person used last, else Terminal. */
  defaultTab?: InstallTab
  className?: string
}

const TAB_KEY = 'install.tab'
/** How long a deep link has to take the focus away before "Nothing opened?" shows. */
const LINK_TIMEOUT_MS = 1500

function savedTab(): InstallTab | null {
  const v = readPref(TAB_KEY)
  return INSTALL_TABS.includes(v as InstallTab) ? (v as InstallTab) : null
}

/** A command on one or more lines with a Copy button. `prefix` is drawn but not copied. */
export function Cmd({
  text,
  what,
  prefix,
  className,
  copy = true,
}: {
  text: string
  what: string
  prefix?: string
  className?: string
  /** False when a labelled Copy button sits next to the block. */
  copy?: boolean
}) {
  const ref = useRef<HTMLElement>(null)
  const box = useRef<HTMLElement | null>(null)
  useOverflowEdge(box)
  const multi = text.includes('\n')
  return (
    <div className={['cmd', className].filter(Boolean).join(' ')} data-multi={multi || undefined}>
      {multi ? (
        <pre
          className="cmd-text"
          ref={(el) => {
            box.current = el
          }}
        >
          <code ref={ref}>{text}</code>
        </pre>
      ) : (
        <code
          ref={(el) => {
            ref.current = el
            box.current = el
          }}
          className="cmd-text"
        >
          {prefix ? (
            <span className="cmd-prefix" aria-hidden="true">
              {prefix}{' '}
            </span>
          ) : null}
          {text}
        </code>
      )}
      {copy ? <CopyButton text={text} what={what} label={null} selectTarget={ref} className="cmd-copy" /> : null}
    </div>
  )
}

/**
 * Several commands that must run one at a time: Claude Code sends a multi-line paste as one
 * prompt, so each line gets its own Copy button.
 */
export function CmdLines({ lines, what, prefix }: { lines: readonly string[]; what: string; prefix?: string }) {
  const { t } = useT()
  return (
    <div className="cmd-lines">
      <ol className="cmd-list">
        {lines.map((line) => (
          <li key={line}>
            <Cmd text={line} what={what} prefix={prefix} />
          </li>
        ))}
      </ol>
      <p className="ip-needs">{t('install.oneAtATime')}</p>
    </div>
  )
}

function DeepLink({
  href,
  icon,
  children,
  hint,
  missed,
  secondary,
}: {
  href: string
  icon: ReactNode
  children: ReactNode
  hint: string
  /** Shown when the click opened nothing. */
  missed: string
  /** Phones: a secondary button, after the commands. */
  secondary: boolean
}) {
  const { t } = useT()
  const [nothing, setNothing] = useState(false)
  const timer = useRef<number | null>(null)
  const stop = useRef<(() => void) | null>(null)
  useEffect(() => () => stop.current?.(), [])

  const onClick = () => {
    stop.current?.()
    setNothing(false)
    // An app that takes the link takes the focus (blur) or hides the page.
    const opened = () => stop.current?.()
    const onVis = () => document.visibilityState === 'hidden' && opened()
    window.addEventListener('blur', opened)
    document.addEventListener('visibilitychange', onVis)
    timer.current = window.setTimeout(() => {
      stop.current?.()
      setNothing(true)
    }, LINK_TIMEOUT_MS)
    stop.current = () => {
      if (timer.current !== null) window.clearTimeout(timer.current)
      timer.current = null
      window.removeEventListener('blur', opened)
      document.removeEventListener('visibilitychange', onVis)
      stop.current = null
    }
  }

  return (
    <div className="ip-link" data-secondary={secondary || undefined}>
      {secondary ? <p className="ip-label">{t('install.link.onComputer')}</p> : null}
      <a className={secondary ? 'btn btn-secondary ip-link-btn' : 'btn btn-primary ip-link-btn'} href={href} onClick={onClick}>
        {icon}
        <span>{children}</span>
      </a>
      <p className="ip-hint">{hint}</p>
      <p className="ip-missed" role="status">
        {nothing ? missed : ''}
      </p>
    </div>
  )
}

export default function InstallPanel(props: InstallPanelProps) {
  const { t } = useT()
  const i = resolveInstall(props.mod)
  // The mod's install parts did not check out (a damaged registry): offer no command at all.
  if (!i) {
    return (
      <div className={['ip', props.className].filter(Boolean).join(' ')} data-variant={props.variant ?? 'full'}>
        <p className="ip-hint">{t('install.unavailable')}</p>
      </div>
    )
  }
  return <InstallPanelBody {...props} i={i} />
}

function InstallPanelBody({ mod, variant = 'full', defaultTab, className, i }: InstallPanelProps & { i: ResolvedInstall }) {
  const { t } = useT()
  const [tab, setTabState] = useState<InstallTab>(() => defaultTab ?? savedTab() ?? 'terminal')
  const base = useId()
  const tabRefs = useRef<Partial<Record<InstallTab, HTMLButtonElement | null>>>({})
  const v = i.minVersion
  const popover = variant === 'popover'
  // no Claude Code on a phone: the deep link is not the main way there
  const phone = useMediaQuery('(pointer: coarse) and (max-width: 1023px), (max-width: 639px)')
  // the mod's own minimum, when it is newer than the version mods first loaded in
  const need = needsVersion(mod.requires?.claudeCode, v.mods)

  const setTab = (next: InstallTab, focus = false) => {
    setTabState(next)
    writePref(TAB_KEY, next)
    if (focus) tabRefs.current[next]?.focus()
  }

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const at = INSTALL_TABS.indexOf(tab)
    let next: number | null = null
    if (e.key === 'ArrowRight') next = (at + 1) % INSTALL_TABS.length
    else if (e.key === 'ArrowLeft') next = (at - 1 + INSTALL_TABS.length) % INSTALL_TABS.length
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = INSTALL_TABS.length - 1
    if (next === null) return
    e.preventDefault()
    setTab(INSTALL_TABS[next], true)
  }

  // Fade the tab strip's edge while more tabs hide past it (narrow popovers, Russian labels).
  const strip = useRef<HTMLDivElement>(null)
  useOverflowEdge(strip)
  // Keep the selected tab inside the strip (sideways only: never scroll the page).
  useEffect(() => {
    const el = strip.current
    const btn = tabRefs.current[tab]
    if (!el || !btn) return
    if (btn.offsetLeft < el.scrollLeft) el.scrollLeft = btn.offsetLeft - 8
    else if (btn.offsetLeft + btn.offsetWidth > el.scrollLeft + el.clientWidth)
      el.scrollLeft = btn.offsetLeft + btn.offsetWidth - el.clientWidth + 8
  }, [tab])

  const vscodeMissing = undrawnSlots(mod.preview.elements, 'vscode')
  const hasLink = tab === 'terminal' || tab === 'desktop' || tab === 'vscode'

  /** The deep link first on a computer; after the commands on a phone. */
  const linkFirst = (link: ReactNode, rest: ReactNode) => (phone ? [rest, link] : [link, rest])

  let body: ReactNode
  switch (tab) {
    case 'terminal': {
      const link = (
        <DeepLink
          key="link"
          href={i.terminalUrl}
          icon={<IconTerminal size={18} />}
          hint={t('install.link.terminalHint')}
          missed={t('install.link.terminalMissed')}
          secondary={phone}
        >
          {t('install.link.terminal')}
        </DeepLink>
      )
      const rest = (
        <div key="rest" className="ip-stack">
          <div className="ip-block">
            <p className="ip-label">{t('install.terminal.session')}</p>
            <Cmd text={i.terminal} what={t('install.what.command')} />
          </div>
          {popover ? null : (
            <div className="ip-block">
              <p className="ip-label">{t('install.terminal.twoStep')}</p>
              <CmdLines lines={i.twoStep} what={t('install.what.command')} />
            </div>
          )}
        </div>
      )
      body = (
        <>
          {linkFirst(link, rest)}
          <p className="ip-needs">{t('install.terminal.needs', { v: v.terminal, mods: v.mods })}</p>
        </>
      )
      break
    }
    case 'desktop': {
      const link = (
        <DeepLink
          key="link"
          href={i.desktopUrl}
          icon={<IconWindow size={18} />}
          hint={t('install.desktop.linkHint')}
          missed={t('install.link.desktopMissed')}
          secondary={phone}
        >
          {t('install.link.desktop')}
        </DeepLink>
      )
      const rest = (
        <div key="rest" className="ip-block">
          <p className="ip-label">{t('install.desktop.manual')}</p>
          <ol className="ip-steps">
            <li>{t('install.desktop.step1')}</li>
            <li>
              <span>{t('install.desktop.step2')}</span>
              <Cmd text={i.marketplaceRepo} what={t('install.what.marketplace')} className="cmd-inline" />
            </li>
            <li>
              <span>{t('install.desktop.step3')}</span>
              <Cmd text={i.plugin} what={t('install.what.plugin')} className="cmd-inline" />
            </li>
            <li>{t('install.desktop.step4')}</li>
          </ol>
        </div>
      )
      body = (
        <>
          {linkFirst(link, rest)}
          <p className="ip-needs">{t('install.desktop.needs', { v: v.desktop })}</p>
        </>
      )
      break
    }
    case 'vscode':
      body = (
        <>
          <DeepLink
            href={i.vscodeUrl}
            icon={<IconEditor size={18} />}
            hint={t('install.vscode.linkHint')}
            missed={t('install.link.vscodeMissed')}
            secondary={phone}
          >
            {t('install.link.vscode')}
          </DeepLink>
          {vscodeMissing.length ? (
            <p className="ip-partial">
              {t('install.vscode.partial', { slots: vscodeMissing.map((s) => t(`common.slot.${s}` as TKey)).join(', ') })}
            </p>
          ) : null}
          <p className="ip-needs">{t('install.vscode.needs', { v: v.vscode })}</p>
        </>
      )
      break
    case 'shell':
      body = (
        <>
          <p className="ip-lead">{t('install.shell.lead')}</p>
          <Cmd text={i.shell} what={t('install.what.shell')} prefix="$" />
          <p className="ip-needs">{t('install.shell.needs', { v: v.shell })}</p>
        </>
      )
      break
    case 'ask':
      body = (
        <>
          <p className="ip-lead">{t('install.ask.lead')}</p>
          <div className="ip-prompt">
            <p className="ip-prompt-text">{i.desktopPrompt}</p>
            <CopyButton text={i.desktopPrompt} what={t('install.what.prompt')} label={t('install.ask.copy')} variant="solid" />
          </div>
        </>
      )
      break
  }

  return (
    <div className={['ip', className].filter(Boolean).join(' ')} data-variant={variant}>
      <div ref={strip} className="ip-tabs" role="tablist" aria-label={t('install.tabs')} onKeyDown={onKeyDown}>
        {INSTALL_TABS.map((k) => (
          <button
            key={k}
            ref={(el) => {
              tabRefs.current[k] = el
            }}
            type="button"
            role="tab"
            id={`${base}-tab-${k}`}
            aria-selected={tab === k}
            aria-controls={`${base}-panel`}
            tabIndex={tab === k ? 0 : -1}
            className="ip-tab"
            onClick={() => setTab(k)}
          >
            {t(`install.tab.${k}` as TKey)}
          </button>
        ))}
      </div>
      <div className="ip-panel" role="tabpanel" id={`${base}-panel`} aria-labelledby={`${base}-tab-${tab}`}>
        {need ? <p className="ip-requires">{t('install.requires', { title: mod.title, v: need })}</p> : null}
        {body}
      </div>
      <div className="ip-foot">
        {hasLink ? <p>{t('install.links.note')}</p> : null}
        <p>{t('install.from', { repo: i.marketplaceRepo })}</p>
      </div>
    </div>
  )
}
