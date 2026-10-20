// Sticky header: wordmark · Catalog, How it works, Submit a mod · GitHub ★ · RU/EN · theme.
// Below 900px the links fold into a Menu disclosure.
import { useEffect, useId, useRef, useState } from 'react'
import { useLang, useT, type TKey } from '../../i18n'
import { repoStars, useRegistry } from '../../lib/registry'
import { useRoute, type Route } from '../../lib/router'
import { useTheme, type ThemePref } from '../../lib/theme'
import { IconClose, IconGitHub, IconMenu, IconMoon, IconStar, IconSun, IconSystem } from '../ui/icons'
import './layout.css'

const LINKS: { route: Route['name']; href: string; key: TKey }[] = [
  { route: 'catalog', href: '#/catalog', key: 'common.nav.catalog' },
  { route: 'how', href: '#/how', key: 'common.nav.how' },
  { route: 'submit', href: '#/submit', key: 'common.nav.submit' },
]

export function Wordmark() {
  const { t } = useT()
  return (
    <a href="#/" className="wordmark" aria-label={t('common.brand.home')}>
      <span className="wordmark-name">
        mod showroom
        <span className="wordmark-caret" aria-hidden="true" />
      </span>
      <span className="wordmark-for">{t('common.brand.for')}</span>
    </a>
  )
}

function LangToggle() {
  const { lang, setLang } = useLang()
  const { t } = useT()
  return (
    <div className="hdr-seg" role="group" aria-label={t('common.lang.label')}>
      <button type="button" lang="en" aria-pressed={lang === 'en'} title="English" onClick={() => setLang('en')}>
        EN
      </button>
      <button type="button" lang="ru" aria-pressed={lang === 'ru'} title="Русский" onClick={() => setLang('ru')}>
        RU
      </button>
    </div>
  )
}

const NEXT: Record<ThemePref, ThemePref> = { system: 'light', light: 'dark', dark: 'system' }

function ThemeToggle() {
  const { pref, cycle } = useTheme()
  const { t } = useT()
  const name = (p: ThemePref) => t(`common.theme.${p}` as TKey)
  const label = t('common.theme.button', { current: name(pref), next: name(NEXT[pref]) })
  return (
    <button type="button" className="hdr-icon-btn" onClick={cycle} aria-label={label} title={label}>
      {pref === 'system' ? <IconSystem /> : pref === 'light' ? <IconSun /> : <IconMoon />}
    </button>
  )
}

function GitHubLink({ compact = false }: { compact?: boolean }) {
  const { registry } = useRegistry()
  const { t, num } = useT()
  // a new repository has no stars yet: show the count once there is one
  const stars = repoStars(registry) || undefined
  return (
    <a className="hdr-gh" href={registry.repo.url} aria-label={stars !== undefined ? `${t('common.nav.githubAria')}, ${t('common.nav.starsAria', { n: num(stars) })}` : t('common.nav.githubAria')}>
      <IconGitHub size={17} />
      {compact ? null : <span className="hdr-gh-label">{t('common.nav.github')}</span>}
      {stars !== undefined ? (
        <span className="hdr-gh-stars tabular">
          <IconStar size={14} />
          {num(stars, true)}
        </span>
      ) : null}
    </a>
  )
}

export default function Header() {
  const { t } = useT()
  const route = useRoute()
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const menuId = useId()
  const btnRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // close the menu on navigation and on Escape
  useEffect(() => setOpen(false), [route.name])
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        btnRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const links = LINKS.map((l) => (
    <a key={l.route} href={l.href} aria-current={route.name === l.route ? 'page' : undefined}>
      {t(l.key)}
    </a>
  ))

  return (
    <header className="site-header" data-scrolled={scrolled || open || undefined}>
      <div className="wrap site-header-inner">
        <Wordmark />
        <nav className="hdr-nav" aria-label={t('common.nav.label')}>
          {links}
        </nav>
        <div className="hdr-actions">
          <span className="hdr-wide-only">
            <GitHubLink />
          </span>
          <LangToggle />
          <ThemeToggle />
          <button
            ref={btnRef}
            type="button"
            className="hdr-icon-btn hdr-menu-btn"
            aria-expanded={open}
            aria-controls={menuId}
            aria-label={open ? t('common.nav.closeMenu') : t('common.nav.menu')}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <IconClose /> : <IconMenu />}
          </button>
        </div>
      </div>
      <div id={menuId} className="hdr-menu" hidden={!open}>
        <nav className="wrap hdr-menu-inner" aria-label={t('common.nav.label')}>
          {links}
          <GitHubLink />
        </nav>
      </div>
    </header>
  )
}
