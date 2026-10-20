// Small pieces every catalog view shares: author avatar, category dot, the "Works on"
// surface row, the Hosted/External badge, stars and the loadout toggle.
import { useState, type ReactNode } from 'react'
import { useT, type TKey } from '../../i18n'
import { useLoadout } from '../../lib/loadout'
import type { Category, DrawingSurface, SiteMod } from '../../data/types'
import { worksOn, type SurfaceSupport } from '../mock'
import { IconCheck, IconEditor, IconStar, IconTerminal, IconWindow } from '../ui/icons'
import { SURFACES } from './filters'

export const CATEGORY_HUE: Record<Category, string> = {
  interface: 'var(--hue-sky)',
  insights: 'var(--hue-olive)',
  safety: 'var(--hue-clay)',
  productivity: 'var(--hue-kraft)',
  git: 'var(--hue-cactus)',
  integrations: 'var(--hue-sky)',
  fun: 'var(--hue-heather)',
  accessibility: 'var(--hue-cactus)',
}

export function CategoryDot({ category }: { category: Category }) {
  return <span className="cat-dot" style={{ background: CATEGORY_HUE[category] }} aria-hidden="true" />
}

export const SURFACE_ICON: Record<DrawingSurface, (p: { size?: number }) => ReactNode> = {
  terminal: IconTerminal,
  desktop: IconWindow,
  vscode: IconEditor,
}

function initials(name: string): string {
  const parts = name.replace(/\(.*?\)/g, '').trim().split(/[\s_-]+/).filter(Boolean)
  const s = parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : (parts[0] ?? '?').slice(0, 2)
  return s.toUpperCase()
}

/** github.com/<login>.png, falling back to initials when there is no login or the image fails. */
export function Avatar({ name, login, size = 20 }: { name: string; login?: string; size?: number }) {
  const [failed, setFailed] = useState(false)
  const style = { width: size, height: size, fontSize: Math.round(size * 0.42) }
  if (!login || failed) {
    return (
      <span className="avatar avatar-initials" style={style} aria-hidden="true">
        {initials(name)}
      </span>
    )
  }
  return (
    <img
      className="avatar"
      src={`https://github.com/${encodeURIComponent(login)}.png?size=${size * 2}`}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  )
}

/** Per surface: full (registry drawsOn), partial or none (from the preview's slots). */
export function surfaceSupport(mod: SiteMod): Record<DrawingSurface, SurfaceSupport> {
  const fine = worksOn(mod.preview.elements, mod.surfaces)
  const out = {} as Record<DrawingSurface, SurfaceSupport>
  for (const s of SURFACES) out[s] = mod.drawsOn.includes(s) ? 'full' : fine[s] === 'full' ? 'partial' : fine[s]
  return out
}

/** "Works on": three surface marks. `labels` shows the names (detail sheet); cards show icons only. */
export function WorksOn({ mod, labels = false, className }: { mod: SiteMod; labels?: boolean; className?: string }) {
  const { t } = useT()
  const support = surfaceSupport(mod)
  return (
    <ul className={['works-on', className].filter(Boolean).join(' ')} aria-label={t('catalog.worksOn.label')} data-labels={labels || undefined}>
      {SURFACES.map((s) => {
        const Icon = SURFACE_ICON[s]
        const name = t(`common.surface.${s}` as TKey)
        const state = support[s]
        const text = t(`catalog.worksOn.${state}` as TKey, { surface: name })
        return (
          <li key={s} className="works-on-item" data-support={state} title={text}>
            <Icon size={labels ? 16 : 15} />
            {labels ? (
              <span className="works-on-name">
                {name}
                {state === 'partial' ? <span className="works-on-partial"> · {t('catalog.worksOn.partialShort')}</span> : null}
              </span>
            ) : null}
            <span className="sr-only">{text}</span>
          </li>
        )
      })}
    </ul>
  )
}

export function SourceBadge({ mod }: { mod: SiteMod }) {
  const { t } = useT()
  return (
    <span
      className="src-badge"
      data-hosted={mod.hosted || undefined}
      title={mod.hosted ? t('catalog.card.hostedTitle') : t('catalog.card.externalTitle')}
    >
      {mod.hosted ? t('catalog.card.hosted') : t('catalog.card.external')}
    </span>
  )
}

export function Stars({ n }: { n?: number }) {
  const { t, num } = useT()
  if (!n) return null
  return (
    <span className="stars tabular" title={t('catalog.card.starsTitle', { n: num(n) })}>
      <IconStar size={14} />
      <span aria-hidden="true">{num(n, true)}</span>
      <span className="sr-only">{t('catalog.card.starsTitle', { n: num(n) })}</span>
    </span>
  )
}

/** "Add to loadout": a checkbox (native input, drawn box). Its name ends with the mod's title. */
export function LoadoutToggle({ mod, className }: { mod: SiteMod; className?: string }) {
  const { t } = useT()
  const loadout = useLoadout()
  const on = loadout.has(mod.name)
  return (
    <label className={['loadout-toggle', className].filter(Boolean).join(' ')} data-on={on || undefined}>
      <input type="checkbox" className="loadout-toggle-input" checked={on} onChange={() => loadout.toggle(mod.name)} />
      <span className="loadout-toggle-box" aria-hidden="true">
        {on ? <IconCheck size={14} /> : null}
      </span>
      <span className="loadout-toggle-text">
        {t('catalog.card.addToLoadout')}
        <span className="sr-only">: {mod.title}</span>
      </span>
    </label>
  )
}
