// Search, category and sort in one row; under it "Draws in" (the filter only this site has)
// as chips and "Works on" as a four-way switch. Below 900px the category, slot and surface
// filters fold behind a "Filters" button, and the category turns back into chips there.
import { useId, useRef, useState, type ReactNode } from 'react'
import { useT, type TKey } from '../../i18n'
import type { Category, DrawingSurface, SiteRegistry } from '../../data/types'
import { IconClose } from '../ui/icons'
import { CategoryDot, SURFACE_ICON } from './bits'
import { GROUP_ORDER, SORTS, SURFACES, type Facets, type FilterState, type SlotGroup, type SortKey } from './filters'

function IconSearch() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" aria-hidden="true" focusable="false">
      <circle cx="8.8" cy="8.8" r="5.3" />
      <path d="m12.8 12.8 3.7 3.7" />
    </svg>
  )
}

function IconSliders() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" aria-hidden="true" focusable="false">
      <path d="M3.5 6h7M14.5 6h2M3.5 14h2M9.5 14h7" />
      <circle cx="12.5" cy="6" r="2" />
      <circle cx="7.5" cy="14" r="2" />
    </svg>
  )
}

function Chip({
  pressed,
  count,
  onClick,
  children,
}: {
  pressed: boolean
  count?: number
  onClick: () => void
  children: ReactNode
}) {
  const empty = count === 0 && !pressed
  return (
    <button type="button" className="fchip" aria-pressed={pressed} disabled={empty} onClick={onClick}>
      {children}
      {count !== undefined ? <span className="fchip-count tabular">{count}</span> : null}
    </button>
  )
}

function Row({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  const id = useId()
  return (
    <div className={['facet', className].filter(Boolean).join(' ')} role="group" aria-labelledby={id}>
      <span className="facet-label" id={id}>
        {label}
      </span>
      <div className="facet-chips">{children}</div>
    </div>
  )
}

export type CatalogFiltersProps = {
  registry: SiteRegistry
  filters: FilterState
  facets: Facets
  onChange: (next: FilterState) => void
}

export default function CatalogFilters({ registry, filters, facets, onChange }: CatalogFiltersProps) {
  const { t } = useT()
  const [open, setOpen] = useState(false)
  const search = useRef<HTMLInputElement>(null)
  const facetsId = useId()
  const set = (patch: Partial<FilterState>) => onChange({ ...filters, ...patch })
  const active = (filters.category !== 'all' ? 1 : 0) + filters.groups.length + (filters.surface !== 'any' ? 1 : 0)
  const categories = registry.categories.filter((c) => c.count > 0 || filters.category === c.id)

  const toggleGroup = (g: SlotGroup) =>
    set({ groups: filters.groups.includes(g) ? filters.groups.filter((x) => x !== g) : [...filters.groups, g] })

  return (
    <div className="cat-tools">
      <div className="cat-toolbar">
        <div className="cat-search">
          <IconSearch />
          <input
            ref={search}
            type="search"
            className="cat-search-input"
            value={filters.q}
            placeholder={t('catalog.search.placeholder')}
            aria-label={t('catalog.search.label')}
            autoComplete="off"
            spellCheck={false}
            enterKeyHint="search"
            onChange={(e) => set({ q: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === 'Escape' && filters.q) {
                e.preventDefault()
                set({ q: '' })
              }
            }}
          />
          {filters.q ? (
            <button
              type="button"
              className="cat-search-clear"
              aria-label={t('catalog.search.clear')}
              onClick={() => {
                set({ q: '' })
                search.current?.focus()
              }}
            >
              <IconClose size={16} />
            </button>
          ) : null}
        </div>

        <button
          type="button"
          className="cat-filters-toggle"
          aria-expanded={open}
          aria-controls={facetsId}
          onClick={() => setOpen((v) => !v)}
        >
          <IconSliders />
          <span>{active ? t('catalog.filters.showCount', { n: active }) : t('catalog.filters.show')}</span>
        </button>

        {/* wide screens: the category is a menu beside the sort (phones: chips in Filters) */}
        <label className="cat-sort cat-category" data-on={filters.category !== 'all' || undefined}>
          <span className="cat-sort-label">{t('catalog.filters.category')}</span>
          <select value={filters.category} onChange={(e) => set({ category: e.target.value as FilterState['category'] })}>
            <option value="all">
              {t('catalog.filters.allCategories')} ({facets.allCategories})
            </option>
            {categories.map((c) => (
              <option key={c.id} value={c.id} disabled={(facets.category[c.id] ?? 0) === 0 && filters.category !== c.id}>
                {t(`common.category.${c.id}` as TKey)} ({facets.category[c.id] ?? 0})
              </option>
            ))}
          </select>
        </label>

        <label className="cat-sort">
          <span className="cat-sort-label">{t('catalog.filters.sort')}</span>
          <select value={filters.sort} onChange={(e) => set({ sort: e.target.value as SortKey })}>
            {SORTS.map((s) => (
              <option key={s} value={s}>
                {t(`catalog.sort.${s}` as TKey)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="cat-facets" id={facetsId} data-open={open || undefined}>
        <Row label={t('catalog.filters.category')} className="facet-category">
          <Chip pressed={filters.category === 'all'} count={facets.allCategories} onClick={() => set({ category: 'all' })}>
            {t('catalog.filters.all')}
          </Chip>
          {categories.map((c) => (
            <Chip
              key={c.id}
              pressed={filters.category === c.id}
              count={facets.category[c.id] ?? 0}
              onClick={() => set({ category: filters.category === c.id ? 'all' : (c.id as Category) })}
            >
              <CategoryDot category={c.id} />
              {t(`common.category.${c.id}` as TKey)}
            </Chip>
          ))}
        </Row>

        <Row label={t('catalog.filters.drawsIn')}>
          {GROUP_ORDER.map((g) => (
            <Chip key={g} pressed={filters.groups.includes(g)} count={facets.groups[g]} onClick={() => toggleGroup(g)}>
              {t(`catalog.group.${g}` as TKey)}
            </Chip>
          ))}
        </Row>

        <Row label={t('catalog.filters.surface')}>
          <div className="fseg">
            <button type="button" className="fseg-btn" aria-pressed={filters.surface === 'any'} onClick={() => set({ surface: 'any' })}>
              {t('catalog.filters.any')}
              <span className="fchip-count tabular">{facets.anySurface}</span>
            </button>
            {SURFACES.map((s: DrawingSurface) => {
              const Icon = SURFACE_ICON[s]
              const pressed = filters.surface === s
              return (
                <button
                  key={s}
                  type="button"
                  className="fseg-btn"
                  aria-pressed={pressed}
                  disabled={facets.surface[s] === 0 && !pressed}
                  onClick={() => set({ surface: pressed ? 'any' : s })}
                >
                  <Icon size={15} />
                  {t(`common.surface.${s}` as TKey)}
                  <span className="fchip-count tabular">{facets.surface[s]}</span>
                </button>
              )
            })}
          </div>
        </Row>
      </div>
    </div>
  )
}
