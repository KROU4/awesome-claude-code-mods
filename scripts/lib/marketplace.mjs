// Generates .claude-plugin/marketplace.json in the format `claude plugin validate --strict` accepts
// (Claude Code 2.1.302): top-level name/description/owner/metadata/plugins; per plugin only
// plugin.json fields plus category and `metadata`, where every catalog extra lives.
import { OWNER, REPO_URL, MARKETPLACE_NAME, MARKETPLACE_DESCRIPTION } from './constants.mjs'
import { inOurMarketplace } from './catalog.mjs'

/** The `source` of a marketplace entry, or null when our marketplace does not serve the mod. */
export function marketplaceSource(entry) {
  const s = entry.source || {}
  const pin = out => {
    if (s.ref) out.ref = s.ref
    if (s.sha) out.sha = s.sha
    return out
  }
  switch (s.type) {
    case 'hosted':
      return `./mods/${entry.name}/plugin`
    case 'github':
      return s.path
        ? pin({ source: 'git-subdir', url: s.repo, path: s.path })
        : pin({ source: 'github', repo: s.repo })
    case 'git':
      return s.path
        ? pin({ source: 'git-subdir', url: s.url, path: s.path })
        : pin({ source: 'url', url: s.url })
    default:
      return null
  }
}

function authorOf(entry) {
  const a = entry.author || {}
  const out = { name: a.name }
  const url = a.url || (a.github ? `https://github.com/${a.github}` : undefined)
  if (url) out.url = url
  return out
}

function repositoryOf(entry) {
  const s = entry.source || {}
  if (s.type === 'hosted') return REPO_URL
  if (s.type === 'github') return `https://github.com/${s.repo}`
  if (s.type === 'git') return s.url.replace(/\.git$/, '')
  return undefined
}

/**
 * One plugin entry. `mod` is the RegistryMod (for slots, drawsOn, siteUrl); `manifest` is the
 * hosted mod's plugin.json (its version wins over the entry's, so we copy it to avoid a warning).
 */
export function marketplaceEntry(entry, mod, manifest) {
  const source = marketplaceSource(entry)
  if (!source) return null
  const out = { name: entry.name, source, description: entry.tagline }
  if (entry.source.type === 'hosted' && manifest?.version) out.version = manifest.version
  out.author = authorOf(entry)
  out.homepage = entry.homepage || mod.siteUrl
  const repository = repositoryOf(entry)
  if (repository) out.repository = repository
  out.license = entry.license
  if (entry.tags?.length) out.keywords = entry.tags
  out.category = entry.category
  const showroom = { title: entry.title, tagline: entry.tagline }
  if (entry.tagline_ru) showroom.tagline_ru = entry.tagline_ru
  showroom.slots = mod.slots
  showroom.surfaces = mod.drawsOn
  if (entry.requires?.claudeCode) showroom.requires = entry.requires.claudeCode
  if (entry.verified) showroom.verified = true
  showroom.site = mod.siteUrl
  out.metadata = { showroom }
  return out
}

/** The whole marketplace.json object. `items`: [{ entry, mod, manifest }]. */
export function buildMarketplace(items) {
  const plugins = items
    .filter(({ entry }) => inOurMarketplace(entry))
    .map(({ entry, mod, manifest }) => marketplaceEntry(entry, mod, manifest))
    .filter(Boolean)
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
  return {
    name: MARKETPLACE_NAME,
    description: MARKETPLACE_DESCRIPTION,
    owner: { name: OWNER, url: `https://github.com/${OWNER}` },
    metadata: { description: MARKETPLACE_DESCRIPTION },
    plugins,
  }
}
