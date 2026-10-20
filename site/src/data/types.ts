// Site-side view of the catalog types. The source of truth is ../schema/registry.d.ts
// (imported through the "@schema/*" path alias); this file only adds what the site
// reads before the generator writes it.

export type * from '@schema/registry'

import type { Install, Preview, Registry, RegistryMod } from '@schema/registry'

/** One-click links the generator adds to `install` (see site-spec "Install panel — real deep links"). */
export type InstallLinks = {
  /** vscode://anthropic.claude-code/install-plugin?plugin=<name>&marketplace=<owner/repo> */
  vscodeUrl: string
  /** claude-cli://open?q=<"/plugin install <name> --marketplace <owner/repo>"> */
  terminalUrl: string
  /** claude://code/new?q=<desktopPrompt> */
  desktopUrl: string
  /** The prompt the desktop link types for the person. */
  desktopPrompt: string
}

/** `install` as the site reads it: the deep links may be missing in older registries. */
export type SiteInstall = Install & Partial<InstallLinks>

/** A `ui.render` tree captured with `claude plugin test` (the engine's RenderElement JSON). */
export type RenderElement = {
  type: string
  props?: Record<string, unknown>
  children?: Array<RenderElement | string>
}

export type CapturedTree = {
  /** RenderComponent name, e.g. "AbovePrompt", "Pane", "PromptHint". */
  component: string
  surface: string
  tree: RenderElement
}

/** `preview` plus the optional captured trees (may be added to the registry later). */
export type SitePreview = Preview & { capturedTrees?: CapturedTree[] }

export type SiteMod = RegistryMod & { install: SiteInstall; preview: SitePreview }

export type SiteRegistry = Omit<Registry, 'mods'> & { mods: SiteMod[] }
