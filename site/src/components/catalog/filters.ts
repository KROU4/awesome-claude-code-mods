// Catalog search, filters and sorting: pure functions over the registry's mods.
// Facet counts answer "how many mods would I see if I picked this", so a chip that
// leads to an empty grid shows 0 before anyone clicks it.
import type { Category, DrawingSurface, SiteMod, Slot } from '../../data/types'
import { shellRegistry } from '../../lib/shell'
import { readJSON, writeJSON } from '../../lib/storage'

export type SortKey = 'featured' | 'newest' | 'stars' | 'az'
export const SORTS: readonly SortKey[] = ['featured', 'newest', 'stars', 'az']

/** "Draws in" groups: what a person looks for, mapped to the slots behind it. */
export type SlotGroup = 'band' | 'pane' | 'status' | 'toast' | 'spinner' | 'commands' | 'guard' | 'transcript'
export const SLOT_GROUPS: Record<SlotGroup, readonly Slot[]> = {
  band: ['above-prompt'],
  pane: ['pane'],
  status: ['status', 'prompt-hint', 'session-mode'],
  toast: ['toast', 'notification'],
  spinner: ['spinner'],
  commands: ['command'],
  guard: ['tool-deny'],
  transcript: ['message', 'tool-row', 'model-tool', 'info-notice', 'turn-duration', 'prompt-rewrite'],
}
export const GROUP_ORDER = Object.keys(SLOT_GROUPS) as SlotGroup[]

export const SURFACES: readonly DrawingSurface[] = ['terminal', 'desktop', 'vscode']

export type FilterState = {
  q: string
  category: Category | 'all'
  /** Any of these (OR). Empty = no constraint. */
  groups: SlotGroup[]
  surface: DrawingSurface | 'any'
  sort: SortKey
}

export const DEFAULT_FILTERS: FilterState = { q: '', category: 'all', groups: [], surface: 'any', sort: 'featured' }

const STORAGE_KEY = 'catalog.filters'

const isCategory = (v: unknown): v is Category => typeof v === 'string' && shellRegistry.categories.some((c) => c.id === v)
const isGroup = (v: unknown): v is SlotGroup => typeof v === 'string' && Object.hasOwn(SLOT_GROUPS, v)

/**
 * Saved filters (not the search text: a stale search on the next visit hides mods for no visible
 * reason). localStorage is shared by every page of this origin, so each field is checked against
 * its allowed values ("constructor" is `in` every object, so `in` would not do).
 */
export function loadFilters(): FilterState {
  const raw = readJSON<Partial<FilterState> | null>(STORAGE_KEY, null)
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return DEFAULT_FILTERS
  const category = isCategory(raw.category) ? raw.category : 'all'
  const groups = Array.isArray(raw.groups) ? [...new Set(raw.groups.filter(isGroup))] : []
  const surface = SURFACES.includes(raw.surface as DrawingSurface) ? (raw.surface as DrawingSurface) : 'any'
  const sort = SORTS.includes(raw.sort as SortKey) ? (raw.sort as SortKey) : 'featured'
  return { q: '', category, groups, surface, sort }
}

export function saveFilters(f: FilterState): void {
  writeJSON(STORAGE_KEY, { category: f.category, groups: f.groups, surface: f.surface, sort: f.sort })
}

export function isFiltered(f: FilterState): boolean {
  return f.q.trim() !== '' || f.category !== 'all' || f.groups.length > 0 || f.surface !== 'any'
}

export function groupsOf(mod: SiteMod): Set<SlotGroup> {
  const out = new Set<SlotGroup>()
  for (const g of GROUP_ORDER) if (SLOT_GROUPS[g].some((s) => mod.slots.includes(s))) out.add(g)
  return out
}

function fold(s: string): string {
  return s.toLocaleLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ё/g, 'е')
}

/** Lower-cased text a search matches against: name, title, tags, author, taglines. */
export function haystack(mod: SiteMod): string {
  return fold(
    [
      mod.name,
      mod.title,
      ...(mod.tags ?? []),
      mod.author.name,
      mod.author.github ?? '',
      ...mod.maintainers,
      mod.tagline,
      mod.tagline_ru ?? '',
    ].join(' \u0001 '),
  )
}

export function matchesQuery(mod: SiteMod, q: string, hay = haystack(mod)): boolean {
  const terms = fold(q).split(/\s+/).filter(Boolean)
  return terms.every((t) => hay.includes(t.replace(/^@/, '')))
}

type Facet = 'q' | 'category' | 'groups' | 'surface'

function matches(mod: SiteMod, f: FilterState, hay: string, skip?: Facet): boolean {
  if (skip !== 'q' && f.q.trim() && !matchesQuery(mod, f.q, hay)) return false
  if (skip !== 'category' && f.category !== 'all' && mod.category !== f.category) return false
  if (skip !== 'groups' && f.groups.length) {
    const own = groupsOf(mod)
    if (!f.groups.some((g) => own.has(g))) return false
  }
  if (skip !== 'surface' && f.surface !== 'any' && !mod.drawsOn.includes(f.surface)) return false
  return true
}

export type Facets = {
  category: Record<string, number>
  groups: Record<SlotGroup, number>
  surface: Record<DrawingSurface, number>
  /** Mods matching every facet except that one ("All" / "Any" counts). */
  allCategories: number
  anySurface: number
}

export function facetCounts(mods: readonly SiteMod[], f: FilterState): Facets {
  const out: Facets = {
    category: {},
    groups: Object.fromEntries(GROUP_ORDER.map((g) => [g, 0])) as Record<SlotGroup, number>,
    surface: { terminal: 0, desktop: 0, vscode: 0 },
    allCategories: 0,
    anySurface: 0,
  }
  for (const m of mods) {
    const hay = haystack(m)
    if (matches(m, f, hay, 'category')) {
      out.allCategories++
      out.category[m.category] = (out.category[m.category] ?? 0) + 1
    }
    if (matches(m, f, hay, 'groups')) for (const g of groupsOf(m)) out.groups[g]++
    if (matches(m, f, hay, 'surface')) {
      out.anySurface++
      for (const s of m.drawsOn) out.surface[s]++
    }
  }
  return out
}

export function filterMods(mods: readonly SiteMod[], f: FilterState): SiteMod[] {
  return mods.filter((m) => matches(m, f, haystack(m)))
}

function newestKey(m: SiteMod): number {
  const iso = m.addedAt ?? m.updatedAt ?? m.pushedAt
  const t = iso ? Date.parse(iso) : Number.NaN
  return Number.isNaN(t) ? Number.NEGATIVE_INFINITY : t
}

/**
 * Featured: verified mods first; then the categories take turns (in the registry's
 * category order), each category's mods by stars, so the first row is not three mods
 * of one kind. Ties keep the registry's own order.
 */
function featured(mods: readonly SiteMod[], categoryOrder: readonly string[]): SiteMod[] {
  const index = new Map(mods.map((m, i) => [m.name, i]))
  const byStars = (a: SiteMod, b: SiteMod) => (b.stars ?? 0) - (a.stars ?? 0) || index.get(a.name)! - index.get(b.name)!
  const verified = mods.filter((m) => m.verified).sort(byStars)
  const rest = mods.filter((m) => !m.verified)
  const queues = new Map<string, SiteMod[]>()
  for (const c of categoryOrder) queues.set(c, [])
  for (const m of rest) {
    if (!queues.has(m.category)) queues.set(m.category, [])
    queues.get(m.category)!.push(m)
  }
  for (const q of queues.values()) q.sort(byStars)
  const out = [...verified]
  let left = rest.length
  while (left > 0) {
    for (const q of queues.values()) {
      const m = q.shift()
      if (m) {
        out.push(m)
        left--
      }
    }
  }
  return out
}

export function sortMods(mods: readonly SiteMod[], sort: SortKey, lang: string, categoryOrder: readonly string[]): SiteMod[] {
  const index = new Map(mods.map((m, i) => [m.name, i]))
  const stable = (a: SiteMod, b: SiteMod) => index.get(a.name)! - index.get(b.name)!
  switch (sort) {
    case 'featured':
      return featured(mods, categoryOrder)
    case 'newest':
      return [...mods].sort((a, b) => newestKey(b) - newestKey(a) || stable(a, b))
    case 'stars':
      return [...mods].sort((a, b) => (b.stars ?? -1) - (a.stars ?? -1) || a.title.localeCompare(b.title, lang))
    case 'az':
      return [...mods].sort((a, b) => a.title.localeCompare(b.title, lang, { sensitivity: 'base' }) || stable(a, b))
  }
}
