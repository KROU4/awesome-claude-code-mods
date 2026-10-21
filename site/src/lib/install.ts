// Install commands and one-click links for a mod, built here from checked parts: the plugin
// name, the marketplace repository and the marketplace name. The ready-made strings in the
// registry's `install.*` (terminal, shell, deep links, desktop prompt) are never used, so a bad
// write to registry.json cannot hand people a command or a deep link of its own.
import type { InstallLinks, MinVersions, SiteMod } from '../data/types'
import { shellRegistry } from './shell'

export type ResolvedInstall = InstallLinks & {
  /** "<plugin>@<marketplace name>", or "<plugin>" when the marketplace's name is unknown. */
  pluginId: string
  /** owner/repo of the marketplace that serves the mod. */
  marketplaceRepo: string
  /** "/plugin install <plugin> --marketplace <repo>" (in a session). */
  terminal: string
  /** "claude plugin install <plugin> --marketplace <repo>" (in a shell). */
  shell: string
  /** "/plugin marketplace add <repo>". */
  marketplaceAdd: string
  minVersion: MinVersions
  /** Plugin name inside its marketplace (differs from `name` for some external mods). */
  plugin: string
  /** Two-step form: marketplace add once, then install by id. */
  twoStep: [string, string]
}

/** A plugin name as the catalog schema allows it. */
export const PLUGIN_NAME = /^[a-z0-9](?:[a-z0-9-]{0,48}[a-z0-9])?$/
/** owner/repo with a GitHub login as the owner (never starting with "-"). */
export const GITHUB_REPO = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?\/(?!\.\.?$)[A-Za-z0-9._-]{1,100}$/
/** A marketplace name as scripts/lib/catalog.mjs accepts it. */
export const MARKETPLACE_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/

export function desktopPromptFor(plugin: string, marketplaceRepo: string): string {
  return (
    `Install the Claude Code mod "${plugin}" from the marketplace ${marketplaceRepo}. ` +
    `Run in a shell: "\${CLAUDE_CODE_EXECPATH:-claude}" plugin install ${plugin} --marketplace ${marketplaceRepo}` +
    `  — then tell me to start a new session so it loads.`
  )
}

export function linksFor(plugin: string, marketplaceRepo: string): InstallLinks {
  const terminal = `/plugin install ${plugin} --marketplace ${marketplaceRepo}`
  const desktopPrompt = desktopPromptFor(plugin, marketplaceRepo)
  return {
    vscodeUrl:
      `vscode://anthropic.claude-code/install-plugin?plugin=${encodeURIComponent(plugin)}` +
      `&marketplace=${encodeURIComponent(marketplaceRepo)}`,
    terminalUrl: `claude-cli://open?q=${encodeURIComponent(terminal)}`,
    desktopUrl: `claude://code/new?q=${encodeURIComponent(desktopPrompt)}`,
    desktopPrompt,
  }
}

/** The versions behind each install path, as plain version strings only. */
function minVersionsOf(mod: SiteMod): MinVersions {
  const fallback = shellRegistry.minVersions
  const given = (mod.install?.minVersion ?? {}) as Partial<Record<keyof MinVersions, unknown>>
  const out = { ...fallback }
  for (const k of Object.keys(fallback) as (keyof MinVersions)[]) {
    const v = given[k]
    if (typeof v === 'string' && /^\d{1,4}\.\d{1,4}\.\d{1,6}$/.test(v)) out[k] = v
  }
  return out
}

/**
 * Everything the install panel shows for `mod`, or null when its parts do not check out (then the
 * page offers no command at all). Mods of our marketplace install from the repository bundled
 * with the site; external ones from their `source.marketplace`.
 */
export function resolveInstall(mod: SiteMod): ResolvedInstall | null {
  const source = mod.source?.type === 'marketplace' ? mod.source : null
  const external = source !== null
  const plugin = source ? (source.plugin ?? mod.name) : mod.name
  const repo = source ? source.marketplace : shellRegistry.marketplace.repo
  if (typeof plugin !== 'string' || !PLUGIN_NAME.test(plugin)) return null
  if (typeof repo !== 'string' || !GITHUB_REPO.test(repo)) return null
  let pluginId = plugin
  if (!external) pluginId = `${plugin}@${shellRegistry.marketplace.name}`
  else {
    // The generator writes "<plugin>@<their marketplace name>" when the name is known and allowed.
    const id = typeof mod.install?.pluginId === 'string' ? mod.install.pluginId : ''
    const at = id.indexOf('@')
    const name = at > 0 ? id.slice(at + 1) : ''
    if (id.slice(0, at) === plugin && MARKETPLACE_NAME.test(name) && name.toLowerCase() !== shellRegistry.marketplace.name) {
      pluginId = `${plugin}@${name}`
    }
  }
  const terminal = `/plugin install ${plugin} --marketplace ${repo}`
  const marketplaceAdd = `/plugin marketplace add ${repo}`
  return {
    ...linksFor(plugin, repo),
    pluginId,
    marketplaceRepo: repo,
    terminal,
    shell: `claude plugin install ${plugin} --marketplace ${repo}`,
    marketplaceAdd,
    minVersion: minVersionsOf(mod),
    plugin,
    // Without a known marketplace name, "install <plugin>" could pick any marketplace: name it.
    twoStep: [marketplaceAdd, pluginId.includes('@') ? `/plugin install ${pluginId}` : terminal],
  }
}

/** Mods of a loadout that cannot go in with the rest: their marketplace's name is taken. */
export type HeldBack = {
  /** The shared marketplace name. */
  name: string
  /** The marketplace these mods come from (another repository already uses the name). */
  repo: string
  /** The repository that keeps the name in this loadout. */
  kept: string
  mods: SiteMod[]
}

export type LoadoutPlan = {
  /** Install lines, each marketplace added once. */
  lines: string[]
  /** Mods left out of `lines` (see HeldBack). */
  held: HeldBack[]
  /** Mods whose install parts did not check out. */
  skipped: SiteMod[]
}

/**
 * A loadout's install lines: each marketplace added once, then one install line per mod.
 * 'shell' lines (claude plugin …) run one after another when pasted into a shell; 'terminal'
 * lines (/plugin …) must be sent one at a time, since Claude Code sends a multi-line paste
 * as a single prompt.
 *
 * Claude Code keys an added marketplace by its name, so two repositories with the same
 * marketplace name (hamzafer/claude-code-mods and OneWave-AI/claude-code-mods are both
 * "claude-code-mods") cannot be added side by side: the first one met keeps the name, and the
 * mods of the other are held back, to be installed after removing the first marketplace.
 */
export function loadoutPlan(mods: SiteMod[], form: 'terminal' | 'shell' = 'shell'): LoadoutPlan {
  const adds = new Set<string>()
  const installs: string[] = []
  const owner = new Map<string, string>()
  const held = new Map<string, HeldBack>()
  const skipped: SiteMod[] = []
  for (const m of mods) {
    const i = resolveInstall(m)
    if (!i) {
      skipped.push(m)
      continue
    }
    const at = i.pluginId.indexOf('@')
    const name = at > 0 ? i.pluginId.slice(at + 1).toLowerCase() : ''
    if (name) {
      const kept = owner.get(name)
      if (kept === undefined) owner.set(name, i.marketplaceRepo)
      else if (kept.toLowerCase() !== i.marketplaceRepo.toLowerCase()) {
        const key = `${name}\u0000${i.marketplaceRepo.toLowerCase()}`
        const row = held.get(key) ?? { name: i.pluginId.slice(at + 1), repo: i.marketplaceRepo, kept, mods: [] }
        row.mods.push(m)
        held.set(key, row)
        continue
      }
    }
    adds.add(form === 'terminal' ? i.marketplaceAdd : `claude plugin marketplace add ${i.marketplaceRepo}`)
    // An id without a marketplace name could match a plugin of any marketplace: name the repo.
    const byId = i.pluginId.includes('@')
    installs.push(form === 'terminal' ? (byId ? `/plugin install ${i.pluginId}` : i.terminal) : byId ? `claude plugin install ${i.pluginId}` : i.shell)
  }
  return { lines: [...adds, ...installs], held: [...held.values()], skipped }
}

/** The plan's lines; in a shell, held-back mods follow as comments (`note` words them). */
export function loadoutLines(
  mods: SiteMod[],
  form: 'terminal' | 'shell' = 'shell',
  note?: (h: HeldBack) => string,
): string[] {
  const plan = loadoutPlan(mods, form)
  if (form !== 'shell' || !plan.held.length) return plan.lines
  const comment = note ?? ((h: HeldBack) => `${h.mods.map((m) => m.name).join(', ')}: ${h.repo} is also named "${h.name}"; install after: claude plugin marketplace remove ${h.name}`)
  return [...plan.lines, ...plan.held.map((h) => `# ${comment(h).replace(/[\r\n]+/g, ' ')}`)]
}

/** The shell lines as one block, ready to paste into a terminal (not into Claude Code). */
export function loadoutCommands(mods: SiteMod[], form: 'terminal' | 'shell' = 'shell', note?: (h: HeldBack) => string): string {
  return loadoutLines(mods, form, note).join('\n')
}

function semver(v: string): number[] | null {
  const m = /(\d+)\.(\d+)\.(\d+)/.exec(v)
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null
}

/**
 * The version a mod asks for (its `requires.claudeCode`, e.g. ">=2.1.299"), when that is newer
 * than `base` (the version mods first loaded in). Null otherwise.
 */
export function needsVersion(range: string | undefined, base: string): string | null {
  if (!range) return null
  const want = semver(range)
  const have = semver(base)
  if (!want) return null
  if (have && (want[0] - have[0] || want[1] - have[1] || want[2] - have[2]) <= 0) return null
  return want.join('.')
}

/** ">=2.1.299" → "2.1.299" with `orLater` filled in; other ranges as written. */
export function formatRange(range: string, orLater: (v: string) => string): string {
  const m = /^\s*>=\s*v?(\d+\.\d+\.\d+)\s*$/.exec(range)
  return m ? orLater(m[1]) : range
}
