// "32 mods · 24 authors · updated 2 hours ago", from the registry (never invented). The dot
// says whether the numbers came live from GitHub or from the copy published with the site.
// Before the catalog arrives the line says so, at the same height. Each item carries its own
// leading separator (hero.css), so a wrapped line never ends on a "·".
import { useEffect, useState } from 'react'
import { useT } from '../../i18n'
import { authorCount, useRegistry } from '../../lib/registry'
import { followHashLink } from '../catalog/nav'
import './hero.css'

export default function HeroStats() {
  const { t, tn, relative } = useT()
  const { registry, source, updatedAt, loading, ready, error, retry } = useRegistry()
  const [, tick] = useState(0)
  useEffect(() => {
    const id = window.setInterval(() => tick((n) => n + 1), 60_000)
    return () => window.clearInterval(id)
  }, [])

  if (!ready) {
    return (
      <p className="hero-stats" role="status">
        {error ? (
          <>
            <span className="hero-stats-wait">{t('common.data.failed')}</span>
            <button type="button" className="hero-stats-retry" onClick={retry}>
              {t('common.data.retry')}
            </button>
          </>
        ) : (
          <span className="hero-stats-wait">
            <span className="hero-updated-dot is-waiting" aria-hidden="true" />
            {t('common.data.loading')}
          </span>
        )}
      </p>
    )
  }

  const where = source === 'live' ? t('common.data.live') : loading ? t('common.data.checking') : t('common.data.snapshot')
  return (
    <p className="hero-stats">
      <span className="sr-only">{t('hero.counter.label')}: </span>
      <span className="hero-stats-row">
        <span className="hero-stats-item">
          <a className="hero-stat" href="#/catalog" onClick={followHashLink}>
            {tn('hero.counter.mods', registry.mods.length)}
          </a>
        </span>
        <span className="hero-stats-item">
          <span className="hero-stat">{tn('hero.counter.authors', authorCount(registry))}</span>
        </span>
        {updatedAt ? (
          <span className="hero-stats-item">
            <span
              className="hero-stat hero-updated"
              data-source={source}
              title={source === 'snapshot' && !loading ? t('common.data.snapshotTitle') : where}
            >
              <span className="hero-updated-dot" aria-hidden="true" />
              {t('common.data.updated', { when: relative(updatedAt) })}
              <span className="sr-only"> ({where})</span>
            </span>
          </span>
        ) : null}
      </span>
    </p>
  )
}
