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

/** One block for a loadout: each marketplace added once, then one install line per mod. */
export function loadoutCommands(mods: SiteMod[], form: 'terminal' | 'shell' = 'terminal'): string {
  const adds = new Set<string>()
  const installs: string[] = []
  for (const m of mods) {
    const i = resolveInstall(m)
    adds.add(form === 'terminal' ? i.marketplaceAdd : `claude plugin marketplace add ${i.marketplaceRepo}`)
    installs.push(form === 'terminal' ? `/plugin install ${i.pluginId}` : `claude plugin install ${i.pluginId}`)
  }
  return [...adds, ...installs].join('\n')
}

/** The registry's own marketplace command (hero "Add the marketplace"). */
export function marketplaceAddCommand(registry: SiteRegistry): string {
  return registry.marketplace.addCommand
}
