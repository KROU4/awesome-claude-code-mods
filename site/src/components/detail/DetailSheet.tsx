// DetailSheet for #/mod/<name> (lazy-loaded by App). A right-side sheet from 1024px, full
// screen below; focus-trapped; Esc closes; closing goes through the router's back(), so
// the browser's Back button agrees. Contents: the big MockClient (surface tabs, terminal
// theme, fullscreen, replay), caption and "Works on", the description, the install panel,
// "What it touches" with the trust line, the details and the media. Opened from a card,
// this sheet's mock frame grows out of the card's (a FLIP from the card's rectangle; a shared
// motion layoutId cannot start here, because the card and this lazy sheet mount in different
// React commits).
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react'
import { useT, type TKey } from '../../i18n'
import { useMediaQuery } from '../../lib/hooks'
import { useMotionPref } from '../../lib/motionPref'
import { useMod, useRegistry } from '../../lib/registry'
import type { SiteMod, SiteRegistry } from '../../data/types'
import { Avatar, CategoryDot, LoadoutToggle, SourceBadge, Stars, WorksOn } from '../catalog/bits'
import { fullPreview } from '../catalog/cardPreview'
import { ON_SCREEN_FROM_START } from '../hero/heroSession'
import { clearCardOrigin, peekCardOrigin, type Origin } from '../catalog/nav'
import InstallPanel from '../install/InstallPanel'
import { formatRange } from '../../lib/install'
import { MockClient } from '../mock'
import { IconArrowUpRight } from '../ui/icons'
import { RichText, withNodes } from './richText'
import Sheet from './Sheet'
import { describeTouches, type TouchGroup, type TouchRow } from './touches'
import './detail.css'

export type DetailSheetProps = {
  /** Mod name from the route #/mod/<name>. Unknown names show a "not found" sheet. */
  name: string
  /** Close: App passes the router's back(), so the browser Back button agrees. */
  onClose: () => void
}

const VALIDATE = 'claude plugin validate'

function IconShield() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M10 2.8 4.2 5v4.6c0 3.6 2.4 6.3 5.8 7.6 3.4-1.3 5.8-4 5.8-7.6V5L10 2.8Z" />
      <path d="m7.4 10 1.9 1.9 3.4-3.6" />
    </svg>
  )
}

function IconEye() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M2.4 10S5.2 4.6 10 4.6 17.6 10 17.6 10 14.8 15.4 10 15.4 2.4 10 2.4 10Z" />
      <circle cx="10" cy="10" r="2.4" />
    </svg>
  )
}

function Section({ title, children, className }: { title: string; children: ReactNode; className?: string }) {
  const id = useId()
  return (
    <section className={['ds-section', className].filter(Boolean).join(' ')} aria-labelledby={id}>
      <h3 id={id} className="ds-h">
        {title}
      </h3>
      {children}
    </section>
  )
}

function Trust({ mod }: { mod: SiteMod }) {
  const { t } = useT()
  const cmd = <code>{VALIDATE}</code>
  const text = mod.hosted
    ? withNodes((v) => t('catalog.detail.trust.hosted', v), { cmd })
    : mod.analysis
      ? withNodes((v) => t('catalog.detail.trust.externalChecked', v), { cmd })
      : t('catalog.detail.trust.external')
  return (
    <div className="ds-trust" data-hosted={mod.hosted || undefined}>
      <span className="ds-trust-icon">{mod.hosted ? <IconShield /> : <IconEye />}</span>
      <div className="ds-trust-body">
        <p>{text}</p>
        {mod.source.type === 'marketplace' ? (
          <p className="ds-trust-sub">{withNodes((v) => t('catalog.detail.trust.marketplace', v), { repo: <code>{mod.install.marketplaceRepo}</code> })}</p>
        ) : null}
        {mod.analysis && !mod.analysis.ok && mod.analysis.errors.length ? (
          <div className="ds-trust-warn" role="note">
            <p>{withNodes((v) => t('catalog.detail.trust.failed', v), { cmd })}</p>
            <ul>
              {mod.analysis.errors.slice(0, 3).map((err) => (
                <li key={err}>{err}</li>
              ))}
            </ul>
          </div>
        ) : null}
        {!mod.hosted ? (
          <a className="ds-trust-link" href={mod.sourceUrl} target="_blank" rel="noopener noreferrer">
            {t('catalog.detail.trust.read')}
            <IconArrowUpRight size={15} />
          </a>
        ) : null}
      </div>
    </div>
  )
}

const GROUPS: { id: TouchGroup; key: TKey }[] = [
  { id: 'acts', key: 'catalog.detail.touches.acts' },
  { id: 'draws', key: 'catalog.detail.touches.draws' },
  { id: 'watches', key: 'catalog.detail.touches.watches' },
]

function TouchSentence({ row }: { row: TouchRow }) {
  const { t, lang } = useT()
  if (row.text) {
    const s = lang === 'ru' ? row.text.ru : row.text.en
    return <>{s.charAt(0).toUpperCase() + s.slice(1)}</>
  }
  if (!row.key) return null
  const vars = row.slots ? { list: row.slots.map((s) => t(`common.slot.${s}` as TKey)).join(', ') } : row.vars
  return <>{t(row.key, vars)}</>
}

function Touches({ mod, registry }: { mod: SiteMod; registry: SiteRegistry }) {
  const { t } = useT()
  const touches = useMemo(() => describeTouches(mod, registry), [mod, registry])
  const anyRisk = touches.rows.some((r) => r.risk)
  return (
    <div className="tch">
      <Trust mod={mod} />
      <p className="tch-source">
        {touches.source === 'analysis'
          ? withNodes((v) => t('catalog.detail.touches.fromCode', { ...v, version: touches.validatedWith ?? '' }), { cmd: <code>{VALIDATE}</code> })
          : t('catalog.detail.touches.declared')}
      </p>
      {touches.rows.length === 0 ? <p className="tch-none">{t('catalog.detail.touches.none')}</p> : null}
      {GROUPS.map((g) => {
        const rows = touches.rows.filter((r) => r.group === g.id)
        if (!rows.length) return null
        return (
          <div key={g.id} className="tch-group">
            <h4 className="tch-group-title">{t(g.key)}</h4>
            <ul className="tch-list">
              {rows.map((r) => (
                <li key={r.id} className="tch-row" data-risk={r.risk || undefined}>
                  <span className="tch-mark" aria-hidden="true" />
                  <span className="tch-text">
                    <TouchSentence row={r} />
                    {r.risk ? <span className="sr-only">. {t('catalog.detail.touches.risk')}</span> : null}
                  </span>
                  <code className="tch-raw">{r.raw.join(' · ')}</code>
                </li>
              ))}
            </ul>
          </div>
        )
      })}
      {anyRisk ? (
        <p className="tch-legend">
          <span className="tch-mark" data-risk aria-hidden="true" />
          {t('catalog.detail.touches.risk')}
        </p>
      ) : null}
    </div>
  )
}

/** "owner/repo" for GitHub URLs, else the host and path. */
function urlLabel(url: string): string {
  try {
    const u = new URL(url)
    if (u.hostname === 'github.com') return u.pathname.split('/').filter(Boolean).slice(0, 2).join('/')
    return (u.hostname.replace(/^www\./, '') + u.pathname).replace(/\/$/, '')
  } catch {
    return url
  }
}

/** Break opportunities after slashes, so long repository names wrap cleanly. */
function breakable(s: string): ReactNode {
  const parts = s.split('/')
  return parts.map((p, i) => (
    <span key={i}>
      {p}
      {i < parts.length - 1 ? (
        <>
          /<wbr />
        </>
      ) : null}
    </span>
  ))
}

/** The homepage repeats the source when both point into the same GitHub repository. */
function sameRepo(a: string, b: string): boolean {
  return a.includes('github.com') && b.includes('github.com') && urlLabel(a) === urlLabel(b)
}

function Meta({ mod }: { mod: SiteMod }) {
  const { t, date, num } = useT()
  const asDate = (iso?: string) => {
    if (!iso) return null
    const d = new Date(iso)
    return Number.isNaN(d.getTime()) ? null : <time dateTime={iso}>{date(d)}</time>
  }
  const authorHref = mod.author.url ?? (mod.author.github ? `https://github.com/${mod.author.github}` : undefined)
  const rows: [TKey, ReactNode][] = []
  rows.push([
    'catalog.detail.meta.author',
    <span className="ds-author">
      <Avatar name={mod.author.name} login={mod.author.github} size={22} />
      {authorHref ? (
        <a href={authorHref} target="_blank" rel="noopener noreferrer">
          {mod.author.name}
        </a>
      ) : (
        mod.author.name
      )}
    </span>,
  ])
  if (mod.maintainers.length) {
    rows.push([
      'catalog.detail.meta.maintainers',
      <span className="ds-list">
        {mod.maintainers.map((login, i) => (
          <span key={login}>
            {i > 0 ? ', ' : null}
            <a href={`https://github.com/${login}`} target="_blank" rel="noopener noreferrer">
              @{login}
            </a>
          </span>
        ))}
      </span>,
    ])
  }
  rows.push([
    'catalog.detail.meta.category',
    <span className="ds-cat">
      <CategoryDot category={mod.category} />
      {t(`common.category.${mod.category}` as TKey)}
    </span>,
  ])
  rows.push(['catalog.detail.meta.license', mod.license])
  if (mod.version) rows.push(['catalog.detail.meta.version', <code>{mod.version}</code>])
  if (mod.requires?.claudeCode) {
    const v = formatRange(mod.requires.claudeCode, (x) => t('catalog.detail.meta.orLater', { v: x }))
    rows.push(['catalog.detail.meta.requires', t('catalog.detail.meta.claudeCode', { v })])
  }
  const added = asDate(mod.addedAt)
  if (added) rows.push(['catalog.detail.meta.added', added])
  const updated = asDate(mod.updatedAt)
  if (updated && mod.updatedAt !== mod.addedAt) rows.push(['catalog.detail.meta.updated', updated])
  const pushed = asDate(mod.pushedAt)
  if (pushed) rows.push(['catalog.detail.meta.pushed', pushed])
  if (mod.stars) rows.push(['catalog.detail.meta.stars', num(mod.stars)])
  rows.push([
    'catalog.detail.meta.source',
    <a href={mod.sourceUrl} target="_blank" rel="noopener noreferrer" className="ds-url" title={mod.sourceUrl}>
      {breakable(urlLabel(mod.sourceUrl))}
    </a>,
  ])
  if (mod.homepage && !sameRepo(mod.homepage, mod.sourceUrl)) {
    rows.push([
      'catalog.detail.meta.homepage',
      <a href={mod.homepage} target="_blank" rel="noopener noreferrer" className="ds-url" title={mod.homepage}>
        {breakable(urlLabel(mod.homepage))}
      </a>,
    ])
  }
  return (
    <>
      <dl className="ds-meta">
        {rows.map(([k, v]) => (
          <div key={k} className="ds-meta-row">
            <dt>{t(k)}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
      <a className="ds-edit" href={mod.editUrl} target="_blank" rel="noopener noreferrer">
        {t('catalog.detail.meta.edit')}
        <IconArrowUpRight size={15} />
      </a>
    </>
  )
}

function Media({ mod }: { mod: SiteMod }) {
  const { t } = useT()
  const media = mod.media ?? []
  if (!media.length) return null
  return (
    <Section title={media.every((x) => x.type === 'video') ? t('catalog.detail.mediaVideo') : t('catalog.detail.media')}>
      <ul className="ds-media">
        {media.map((x) => (
          <li key={x.src}>
            <figure>
              {x.type === 'video' ? (
                <video src={x.src} controls preload="none" aria-label={x.alt} />
              ) : (
                <a href={x.src} target="_blank" rel="noopener noreferrer">
                  <img src={x.src} alt={x.alt} loading="lazy" decoding="async" />
                </a>
              )}
              <figcaption>
                {x.alt}
                {x.surface ? <span className="ds-media-surface"> · {t(`common.surface.${x.surface}` as TKey)}</span> : null}
              </figcaption>
            </figure>
          </li>
        ))}
      </ul>
    </Section>
  )
}

const GROW_MS = 320
const GROW_EASE = 'cubic-bezier(0.16, 1, 0.3, 1)'

/**
 * The sheet's mock frame grows out of the card's: one uniform scale (text never
 * stretches) plus a clip that starts as the card's crop, the bottom of the session, and
 * opens upwards. Runs once, before paint; skipped for reduced motion.
 */
function useGrowFrom(stage: RefObject<HTMLElement | null>, origin: Origin | null) {
  const { still } = useMotionPref()
  useLayoutEffect(() => {
    const win = stage.current?.querySelector<HTMLElement>('.mc-window')
    if (!origin || still || !win || typeof win.animate !== 'function') return
    const to = win.getBoundingClientRect()
    if (!to.width || !to.height) return
    const s = origin.width / to.width
    const cut = Math.max(0, to.height - origin.height / s)
    const dx = origin.left - to.left
    const dy = origin.top - to.top - cut * s
    const anim = win.animate(
      [
        { transformOrigin: '0 0', transform: `translate(${dx}px, ${dy}px) scale(${s})`, clipPath: `inset(${cut}px 0 0 0 round ${10 / s}px)` },
        { transformOrigin: '0 0', transform: 'none', clipPath: 'inset(0 0 0 0 round 12px)' },
      ],
      { duration: GROW_MS, easing: GROW_EASE },
    )
    return () => anim.cancel()
  }, []) // once, on mount: the origin is where the card was when it was clicked
}

function ModDetail({ mod, origin }: { mod: SiteMod; origin: Origin | null }) {
  const { t, pick } = useT()
  const { registry } = useRegistry()
  const wide = useMediaQuery('(min-width: 1024px)', true)
  const previews = useMemo(() => [fullPreview(mod)], [mod])
  const caption = mod.preview.caption ? pick(mod.preview.caption, mod.preview.caption_ru) : null
  const stage = useRef<HTMLDivElement>(null)
  useGrowFrom(stage, origin)

  return (
    <div className="ds">
      <Intro mod={mod} />
      <div className="ds-stage" ref={stage}>
        {/* The finished session, as the card showed it (the frame grows out of the card's):
            Play or Replay runs it, with the persistent UI (band, status, hint, mode) there from the start. */}
        <MockClient
          previews={previews}
          rows={wide ? 24 : 20}
          arriveAtStart={ON_SCREEN_FROM_START}
          autoPlay={false}
          className="ds-mock"
        />
        <div className="ds-under">
          {caption ? <p className="ds-caption">{caption}</p> : null}
          <div className="ds-works">
            <span className="ds-works-label">{t('catalog.worksOn.label')}</span>
            <WorksOn mod={mod} labels />
          </div>
        </div>
      </div>

      <Section title={t('catalog.detail.install')} className="ds-install">
        <InstallPanel mod={mod} />
      </Section>

      <div className="ds-cols">
        <div className="ds-main">
          <Section title={t('catalog.detail.about')}>
            <RichText className="ds-prose" text={pick(mod.description, mod.description_ru)} />
          </Section>
          <Section title={t('catalog.detail.touches')}>
            <Touches mod={mod} registry={registry} />
          </Section>
          <Media mod={mod} />
        </div>
        <div className="ds-side">
          <Section title={t('catalog.detail.details')}>
            <Meta mod={mod} />
          </Section>
        </div>
      </div>
    </div>
  )
}

function Intro({ mod }: { mod: SiteMod }) {
  const { t, pick } = useT()
  return (
    <div className="ds-intro">
      <p className="ds-tagline">{pick(mod.tagline, mod.tagline_ru)}</p>
      <div className="ds-badges">
        <span className="chip chip-cat">
          <CategoryDot category={mod.category} />
          {t(`common.category.${mod.category}` as TKey)}
        </span>
        <SourceBadge mod={mod} />
        {mod.verified ? (
          <span className="ds-verified" title={t('catalog.detail.verifiedTitle')}>
            {t('catalog.detail.verified')}
          </span>
        ) : null}
        <Stars n={mod.stars} />
      </div>
      {/* phones: the head has room for the close button only */}
      <LoadoutToggle mod={mod} className="ds-loadout-inline" />
    </div>
  )
}

export default function DetailSheet({ name, onClose }: DetailSheetProps) {
  const { t } = useT()
  const { ready, error, retry } = useRegistry()
  const mod = useMod(name)
  const titleId = useId()
  const [origin] = useState(() => peekCardOrigin(name))
  useEffect(() => clearCardOrigin(), [])

  let head: ReactNode
  let body: ReactNode
  if (mod) {
    head = (
      <h2 id={titleId} className="ds-title">
        {mod.title}
      </h2>
    )
    body = <ModDetail mod={mod} origin={origin} />
  } else if (!ready) {
    head = (
      <h2 id={titleId} className="ds-title">
        {name}
      </h2>
    )
    body = error ? (
      <div className="ds-missing" role="alert">
        <p>{t('common.data.failed')}</p>
        <button type="button" className="btn btn-secondary" onClick={retry}>
          {t('common.data.retry')}
        </button>
      </div>
    ) : (
      <p className="ds-loading" role="status">
        {t('common.data.loading')}
      </p>
    )
  } else {
    head = (
      <h2 id={titleId} className="ds-title">
        {t('catalog.detail.notFound', { name })}
      </h2>
    )
    body = (
      <div className="ds-missing">
        <p>{t('catalog.detail.notFoundBody')}</p>
        <a className="btn btn-secondary" href="#/catalog">
          {t('catalog.detail.toCatalog')}
        </a>
      </div>
    )
  }

  return (
    <Sheet
      labelledBy={titleId}
      onClose={onClose}
      closeLabel={t('catalog.detail.close')}
      morph={!!origin && !!mod}
      head={head}
      actions={mod ? <LoadoutToggle mod={mod} className="ds-loadout" /> : null}
    >
      {body}
    </Sheet>
  )
}
