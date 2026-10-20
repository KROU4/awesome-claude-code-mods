// Catalog: search, facet filters (category; "draws in" slot groups; surface), sort, the
// count, and a grid of ModCards: the first twelve, then "Show all" (a search or a filter
// shows every match). Filter state lives in localStorage only (never the URL). Cards open
// #/mod/<name>; the detail sheet is lazy-loaded by App. Until the catalog has arrived
// (lib/registry.tsx) the grid holds three quiet placeholders. Cards are on the page at rest:
// no entrance animation (the hero client is the page's one moving part).
import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import CatalogFilters from '../components/catalog/CatalogFilters'
import ModCard from '../components/catalog/ModCard'
import { DEFAULT_FILTERS, facetCounts, filterMods, isFiltered, loadFilters, saveFilters, sortMods, type FilterState } from '../components/catalog/filters'
import '../components/catalog/catalog.css'
import { useT } from '../i18n'
import { useRegistry } from '../lib/registry'

/** Cards shown before "Show all". */
const FIRST = 12

export type CatalogProps = {
  /** DOM id of the section (scroll target for "#/catalog"). */
  id?: string
}

export default function Catalog({ id = 'catalog' }: CatalogProps) {
  const { t, tn, lang } = useT()
  const { registry, ready, error, retry } = useRegistry()
  const [filters, setFilters] = useState<FilterState>(loadFilters)
  const [all, setAll] = useState(false)
  const shown = useDeferredValue(filters)
  const grid = useRef<HTMLUListElement>(null)
  const focusAfter = useRef<number | null>(null)

  useEffect(() => saveFilters(filters), [filters])

  const categoryOrder = useMemo(() => registry.categories.map((c) => c.id), [registry])
  const facets = useMemo(() => facetCounts(registry.mods, filters), [registry, filters])
  const mods = useMemo(
    () => sortMods(filterMods(registry.mods, shown), shown.sort, lang, categoryOrder),
    [registry, shown, lang, categoryOrder],
  )
  const total = registry.mods.length
  const filtered = isFiltered(filters)
  const reset = () => setFilters({ ...DEFAULT_FILTERS, sort: filters.sort })
  const capped = !all && !filtered && mods.length > FIRST
  const visible = capped ? mods.slice(0, FIRST) : mods

  // "Show all" moves keyboard focus to the first card it revealed.
  useEffect(() => {
    if (focusAfter.current === null) return
    const at = focusAfter.current
    focusAfter.current = null
    grid.current?.querySelectorAll<HTMLAnchorElement>('.mod-card-link')[at]?.focus()
  }, [all])

  return (
    <section id={id} className="wrap section catalog" aria-labelledby={`${id}-title`}>
      <div className="section-head">
        <h2 id={`${id}-title`}>{t('catalog.title')}</h2>
        <p>{t('catalog.lead')}</p>
      </div>

      <CatalogFilters registry={registry} filters={filters} facets={facets} onChange={setFilters} />

      {ready ? (
        renderResults()
      ) : (
        <>
          <div className="cat-results">
            {error ? (
              <p className="cat-count" role="alert">
                {t('common.data.failed')}{' '}
                <button type="button" className="cat-reset" onClick={retry}>
                  {t('common.data.retry')}
                </button>
              </p>
            ) : (
              <p className="cat-count" role="status">
                {t('common.data.loading')}
              </p>
            )}
          </div>
          <ul className="cat-grid" aria-hidden="true">
            {[0, 1, 2].map((i) => (
              <li key={i} className="cat-cell">
                <div className={error ? 'cat-skel is-still' : 'cat-skel'} />
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )

  /** A plain render helper (not a component), so the grid is never remounted. */
  function renderResults() {
    return (
      <>
        <div className="cat-results">
          <p className="cat-count" role="status" aria-live="polite" aria-atomic="true">
            {filtered ? t('catalog.results.filtered', { shown: mods.length, total }) : tn('catalog.count', total)}
          </p>
          {filtered ? (
            <button type="button" className="cat-reset" onClick={reset}>
              {t('catalog.filters.reset')}
            </button>
          ) : null}
        </div>

        {mods.length ? (
          <>
            <ul className="cat-grid" ref={grid}>
              {visible.map((mod) => (
                <li key={mod.name} className="cat-cell">
                  <ModCard mod={mod} />
                </li>
              ))}
            </ul>
            {capped ? (
              <div className="cat-more">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    focusAfter.current = FIRST
                    setAll(true)
                  }}
                >
                  {tn('catalog.showAll', mods.length)}
                </button>
              </div>
            ) : null}
          </>
        ) : (
          <div className="cat-empty">
            <p className="cat-empty-title">{t('catalog.empty.title')}</p>
            <p className="cat-empty-body">{t('catalog.empty.body')}</p>
            <div className="cat-empty-actions">
              {filtered ? (
                <button type="button" className="btn btn-secondary" onClick={reset}>
                  {t('catalog.empty.reset')}
                </button>
              ) : null}
              <a className="btn btn-ghost" href="#/submit">
                {t('catalog.empty.submit')}
              </a>
            </div>
          </div>
        )}
      </>
    )
  }
}
