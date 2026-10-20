// Loads the catalog entries (mods/<name>/mod.json) and derives everything registry.json carries:
// slots, capabilities, install commands and links, source and edit URLs, resolved media.
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import {
  REPO_SLUG, REPO_URL, RAW_BASE, BRANCH, MARKETPLACE_NAME, MIN_VERSIONS, siteUrlFor,
} from './constants.mjs'
import { SLOTS, drawsOn } from './surfaces.mjs'
import { slotsFromCalls, slotsFromRenderHooks, capabilitiesFromAnalysis, riskOf } from './analysis.mjs'

/** Folder names under mods/ (sorted). */
export function listModNames(root) {
  const dir = join(root, 'mods')
  if (!existsSync(dir)) return []
  return readdirSync(dir, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name)
    .sort()
}

/** Reads every mods/<name>/mod.json. Entries that fail to parse come back with `error`. */
export function loadEntries(root) {
  return listModNames(root).map(name => {
    const file = join(root, 'mods', name, 'mod.json')
    if (!existsSync(file)) return { name, error: `mods/${name}/mod.json is missing` }
    try {
      return { name, entry: JSON.parse(readFileSync(file, 'utf8')) }
    } catch (err) {
      return { name, error: `mods/${name}/mod.json is not valid JSON: ${err.message}` }
    }
  })
}

/** plugin.json of a hosted mod, or null. */
export function readPluginManifest(root, name) {
  const file = join(root, 'mods', name, 'plugin', '.claude-plugin', 'plugin.json')
  if (!existsSync(file)) return null
  try {
    return JSON.parse(readFileSync(file, 'utf8'))
  } catch {
    return null
  }
}

export function readJsonIfExists(file, fallback) {
  if (!existsSync(file)) return fallback
  try {
    return JSON.parse(readFileSync(file, 'utf8'))
  } catch {
    return fallback
  }
}

/** True when our marketplace serves the mod (everything except `marketplace` sources). */
export const inOurMarketplace = entry => entry.source?.type !== 'marketplace'

/** owner/repo of a github.com git URL, or null. */
export function githubRepoOfUrl(url) {
  const m = /^https:\/\/github\.com\/([A-Za-z0-9-]{1,39})\/([A-Za-z0-9._-]{1,100}?)(?:\.git)?\/?$/.exec(url || '')
  return m ? `${m[1]}/${m[2]}` : null
}

/** The GitHub repository whose stars describe the mod, or null. */
export function githubRepoOf(entry) {
  const s = entry.source || {}
  if (s.type === 'hosted') return REPO_SLUG
  if (s.type === 'github') return s.repo
  if (s.type === 'git') return githubRepoOfUrl(s.url)
  if (s.type === 'marketplace') return s.repo || s.marketplace
  return null
}

/** Plugin name and marketplace that install the mod. */
export function installTarget(entry, marketplaceNames = {}) {
  if (entry.source?.type === 'marketplace') {
    const plugin = entry.source.plugin || entry.name
    const repo = entry.source.marketplace
    const known = marketplaceNames[repo]
    return { plugin, repo, pluginId: known ? `${plugin}@${known}` : plugin }
  }
  return { plugin: entry.name, repo: REPO_SLUG, pluginId: `${entry.name}@${MARKETPLACE_NAME}` }
}

/** Every install line and deep link for one plugin in one marketplace. */
export function installFor(entry, marketplaceNames = {}) {
  const { plugin, repo, pluginId } = installTarget(entry, marketplaceNames)
  const terminal = `/plugin install ${plugin} --marketplace ${repo}`
  const desktopPrompt =
    `Install the Claude Code mod "${plugin}" from the marketplace ${repo}. ` +
    `Run in a shell: "\${CLAUDE_CODE_EXECPATH:-claude}" plugin install ${plugin} --marketplace ${repo} ` +
    '— then tell me to start a new session so it loads.'
  return {
    pluginId,
    marketplaceRepo: repo,
    terminal,
    shell: `claude plugin install ${plugin} --marketplace ${repo}`,
    marketplaceAdd: `/plugin marketplace add ${repo}`,
    vscodeUrl: `vscode://anthropic.claude-code/install-plugin?plugin=${encodeURIComponent(plugin)}&marketplace=${encodeURIComponent(repo)}`,
    terminalUrl: `claude-cli://open?q=${encodeURIComponent(terminal)}`,
    desktopPrompt,
    desktopUrl: `claude://code/new?q=${encodeURIComponent(desktopPrompt)}`,
    minVersion: { ...MIN_VERSIONS },
  }
}

const treePath = (base, ref, path) => `${base}/tree/${ref}${path ? `/${path}` : ''}`

/** Where the mod's code can be read on GitHub (or its git URL). */
export function sourceUrlFor(entry) {
  const s = entry.source || {}
  if (s.type === 'hosted') return `${REPO_URL}/tree/${BRANCH}/mods/${entry.name}/plugin`
  if (s.type === 'github') return treePath(`https://github.com/${s.repo}`, s.sha || s.ref || 'HEAD', s.path)
  if (s.type === 'git') {
    const gh = githubRepoOfUrl(s.url)
    if (gh) return treePath(`https://github.com/${gh}`, s.sha || s.ref || 'HEAD', s.path)
    return s.url.replace(/\.git$/, '')
  }
  if (s.type === 'marketplace') {
    const repo = s.repo || s.marketplace
    return s.path ? treePath(`https://github.com/${repo}`, 'HEAD', s.path) : `https://github.com/${repo}`
  }
  return REPO_URL
}

export const entryUrlFor = name => `${REPO_URL}/blob/${BRANCH}/mods/${name}/mod.json`
export const editUrlFor = name => `${REPO_URL}/edit/${BRANCH}/mods/${name}/mod.json`

/** Media with relative `src` resolved against the entry's folder on raw.githubusercontent.com. */
export function resolveMedia(entry) {
  if (!entry.media) return undefined
  return entry.media.map(m => ({
    ...m,
    src: /^https:\/\//.test(m.src) ? m.src : `${RAW_BASE}/mods/${entry.name}/${m.src.replace(/^\.\//, '')}`,
  }))
}

/**
 * Preview slots first (in preview order), then slots the code proves by its calls (schema order:
 * $.ui.toast, $.ui.status, $.ui.notify, $.ui.open, $.command.register, $.tool.register).
 * Render hooks alone do not count (a hook may only watch): see hookedSlots.
 */
export function deriveSlots(entry, analysis) {
  const fromPreview = (entry.preview?.elements || []).map(e => e.slot)
  const fromCode = slotsFromCalls(analysis)
  const ordered = [...new Set(fromPreview)]
  for (const slot of SLOTS) if (fromCode.includes(slot) && !ordered.includes(slot)) ordered.push(slot)
  return ordered
}

const CAPABILITY_KEYS = ['network', 'processes', 'filesystem', 'model', 'promptRewrite', 'blocksTools']

/** Declared capabilities, overridden field by field by what the analysis proves. */
export function deriveCapabilities(entry, analysis) {
  const declared = entry.capabilities || {}
  const proven = analysis ? capabilitiesFromAnalysis(analysis) : {}
  const out = {}
  for (const key of CAPABILITY_KEYS) {
    const value = key in proven ? proven[key] : declared[key]
    if (value !== undefined) out[key] = value
  }
  return out
}

/** Entry fields in schema order (drops `$schema`). */
const ENTRY_KEYS = [
  'name', 'title', 'tagline', 'tagline_ru', 'description', 'description_ru', 'author', 'maintainers',
  'category', 'tags', 'license', 'version', 'homepage', 'source', 'surfaces', 'requires',
  'capabilities', 'preview', 'media', 'verified',
]

/**
 * One RegistryMod. `ctx`: { analysis, manifest (plugin.json of a hosted mod), dates {addedAt, updatedAt},
 * github: data/github.json, marketplaceNames: { "<owner/repo>": "<marketplace name>" } }.
 */
export function toRegistryMod(entry, ctx = {}) {
  const { analysis, manifest, dates = {}, github = {}, marketplaceNames = {} } = ctx
  const mod = {}
  for (const key of ENTRY_KEYS) if (entry[key] !== undefined) mod[key] = entry[key]
  if (mod.version === undefined && manifest?.version) mod.version = manifest.version
  mod.capabilities = deriveCapabilities(entry, analysis)
  const media = resolveMedia(entry)
  if (media) mod.media = media
  const slots = deriveSlots(entry, analysis)
  mod.slots = slots
  const hooked = slotsFromRenderHooks(analysis)
  if (analysis) mod.hookedSlots = SLOTS.filter(s => hooked.includes(s))
  mod.drawsOn = drawsOn(slots, entry.surfaces)
  mod.hosted = entry.source?.type === 'hosted'
  mod.inMarketplace = inOurMarketplace(entry)
  mod.install = installFor(entry, marketplaceNames)
  mod.siteUrl = siteUrlFor(entry.name)
  mod.sourceUrl = sourceUrlFor(entry)
  mod.entryUrl = entryUrlFor(entry.name)
  mod.editUrl = editUrlFor(entry.name)
  if (analysis) {
    mod.analysis = analysis
    mod.risk = riskOf(analysis)
  }
  if (dates.addedAt) mod.addedAt = dates.addedAt
  if (dates.updatedAt) mod.updatedAt = dates.updatedAt
  const repo = githubRepoOf(entry)
  const stats = repo ? github[repo] : undefined
  if (stats && typeof stats.stars === 'number') mod.stars = stats.stars
  if (stats && stats.pushedAt && !mod.hosted) mod.pushedAt = stats.pushedAt
  return mod
}

/** Verified first, then newest `addedAt`, then name. */
export function sortMods(mods) {
  return [...mods].sort((a, b) => {
    if (Boolean(a.verified) !== Boolean(b.verified)) return a.verified ? -1 : 1
    const ad = a.addedAt || ''
    const bd = b.addedAt || ''
    if (ad !== bd) return ad < bd ? 1 : -1
    return a.name < b.name ? -1 : a.name > b.name ? 1 : 0
  })
}

const RESERVED_PREFIXES = ['claude-', 'anthropic-', 'anthropics-', 'cc-plugin-']
const RESERVED_NAMES = ['claude', 'anthropic', 'anthropics', 'claude-code', 'claude-mods']

/**
 * The plugin-name rules of `claude plugin validate`: errors for reserved prefixes and names,
 * a warning when "claude" or "anthropic(s)" is a whole word elsewhere in the name.
 */
export function checkPluginName(name) {
  const errors = []
  const warnings = []
  const lower = String(name).toLowerCase()
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(name) || name.includes('..')) {
    errors.push(`"${name}" is not a valid plugin name (letters, digits, ".", "_", "-", starting with a letter or digit)`)
  }
  if (RESERVED_NAMES.includes(lower)) errors.push(`"${name}" is a reserved plugin name`)
  const prefix = RESERVED_PREFIXES.find(p => lower.startsWith(p))
  if (prefix) errors.push(`plugin names may not start with "${prefix}"`)
  const words = lower.split(/[-._]/)
  if (words.includes('official') && words.some(w => ['claude', 'anthropic', 'anthropics'].includes(w))) {
    errors.push('plugin names may not put "official" next to claude or anthropic')
  }
  if (!errors.length && words.some(w => ['claude', 'anthropic', 'anthropics'].includes(w))) {
    warnings.push(`"${name}" has "claude" or "anthropic" as a word, which \`claude plugin validate\` warns about (and --strict fails on)`)
  }
  return { errors, warnings }
}
