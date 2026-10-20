// Assembles registry.json (the `Registry` type in schema/registry.d.ts) from RegistryMods.
import {
  OWNER, REPO, BRANCH, REPO_URL, REPO_SLUG, PAGES_URL, MARKETPLACE_NAME, CATEGORIES, MIN_VERSIONS,
} from './constants.mjs'
import { SURFACES_BY_SLOT } from './surfaces.mjs'
import { CAPABILITY_LABELS } from './analysis.mjs'
import { sortMods } from './catalog.mjs'

/** Registry with a placeholder `generatedAt` (see withGeneratedAt). */
export function buildRegistry(mods, generatedAt = '') {
  const sorted = sortMods(mods)
  return {
    version: 1,
    generatedAt,
    repo: { owner: OWNER, name: REPO, branch: BRANCH, url: REPO_URL, pagesUrl: PAGES_URL },
    marketplace: {
      name: MARKETPLACE_NAME,
      repo: REPO_SLUG,
      addCommand: `/plugin marketplace add ${REPO_SLUG}`,
      addShell: `claude plugin marketplace add ${REPO_SLUG}`,
    },
    categories: CATEGORIES.map(c => ({ ...c, count: sorted.filter(m => m.category === c.id).length })),
    surfacesBySlot: SURFACES_BY_SLOT,
    capabilityLabels: CAPABILITY_LABELS,
    minVersions: { ...MIN_VERSIONS },
    mods: sorted,
  }
}

/** 2-space JSON with a trailing newline. */
export const toJson = value => `${JSON.stringify(value, null, 2)}\n`

/**
 * Keeps the previous `generatedAt` when nothing else changed, so a rebuild without changes is a
 * no-op; otherwise stamps `now`.
 */
export function withGeneratedAt(next, previous, now) {
  const strip = r => toJson({ ...r, generatedAt: '' })
  const same = previous && typeof previous.generatedAt === 'string' && strip(previous) === strip(next)
  return { ...next, generatedAt: same ? previous.generatedAt : now }
}
