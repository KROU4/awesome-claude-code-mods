// Install commands and one-click links for a mod. Uses the registry's `install.*` fields
// and fills the deep links when an older registry does not carry them yet.
import type { InstallLinks, SiteInstall, SiteMod, SiteRegistry } from '../data/types'

export type ResolvedInstall = Required<SiteInstall> & {
  /** Plugin name inside its marketplace (differs from `name` for some external mods). */
  plugin: string
  /** Two-step form: marketplace add once, then install by id. */
  twoStep: [string, string]
}

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

export function resolveInstall(mod: SiteMod): ResolvedInstall {
  const i = mod.install
  const plugin = mod.source.type === 'marketplace' ? (mod.source.plugin ?? mod.name) : mod.name
  const links = linksFor(plugin, i.marketplaceRepo)
  return {
    ...i,
    vscodeUrl: i.vscodeUrl ?? links.vscodeUrl,
    terminalUrl: i.terminalUrl ?? links.terminalUrl,
    desktopUrl: i.desktopUrl ?? links.desktopUrl,
    desktopPrompt: i.desktopPrompt ?? links.desktopPrompt,
    plugin,
    twoStep: [i.marketplaceAdd, `/plugin install ${i.pluginId}`],
  }
}

/**
 * A loadout's install lines: each marketplace added once, then one install line per mod.
 * 'shell' lines (claude plugin …) run one after another when pasted into a shell; 'terminal'
 * lines (/plugin …) must be sent one at a time, since Claude Code sends a multi-line paste
 * as a single prompt.
 */
export function loadoutLines(mods: SiteMod[], form: 'terminal' | 'shell' = 'shell'): string[] {
  const adds = new Set<string>()
  const installs: string[] = []
  for (const m of mods) {
    const i = resolveInstall(m)
    adds.add(form === 'terminal' ? i.marketplaceAdd : `claude plugin marketplace add ${i.marketplaceRepo}`)
    installs.push(form === 'terminal' ? `/plugin install ${i.pluginId}` : `claude plugin install ${i.pluginId}`)
  }
  return [...adds, ...installs]
}

/** The shell lines as one block, ready to paste into a terminal (not into Claude Code). */
export function loadoutCommands(mods: SiteMod[], form: 'terminal' | 'shell' = 'shell'): string {
  return loadoutLines(mods, form).join('\n')
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

/** The registry's own marketplace command (hero "Add the marketplace"). */
export function marketplaceAddCommand(registry: SiteRegistry): string {
  return registry.marketplace.addCommand
}
