// Types of the catalog. `ModEntry` is what a contributor writes in mods/<name>/mod.json
// (validated by schema/mod.schema.json); `Registry` is registry.json, generated from all
// entries by scripts/build-registry.mjs and read by the site at runtime from GitHub.

export type Surface = 'terminal' | 'desktop' | 'vscode' | 'mobile'

export type Category =
  | 'interface'
  | 'insights'
  | 'safety'
  | 'productivity'
  | 'git'
  | 'integrations'
  | 'fun'
  | 'accessibility'

export type ThemeColor =
  | 'claude'
  | 'text'
  | 'secondary'
  | 'inactive'
  | 'subtle'
  | 'success'
  | 'error'
  | 'warning'
  | 'permission'
  | 'suggestion'
  | 'plan'
  | 'ide'
  | 'remember'
  | 'background'

/** A theme token or a #rrggbb hex. */
export type Color = ThemeColor | `#${string}`

export type TextSegment = {
  text: string
  color?: Color
  bg?: Color
  bold?: boolean
  dim?: boolean
  italic?: boolean
  underline?: boolean
  inverse?: boolean
}
export type ButtonSegment = { button: string; variant?: 'primary' | 'secondary'; hotkey?: string }
/** A progress bar, `bar` in 0..1, `width` in cells (default 12). */
export type BarSegment = { bar: number; width?: number; color?: Color }
/** A sparkline of the values, one cell per value. */
export type SparkSegment = { spark: number[]; color?: Color }
export type LinkSegment = { link: string; href: string }
export type KbdSegment = { kbd: string }
export type Segment = string | TextSegment | ButtonSegment | BarSegment | SparkSegment | LinkSegment | KbdSegment
export type Row = Segment[]

export type Turn = {
  role: 'user' | 'assistant' | 'tool'
  text?: string
  tool?: string
  input?: string
  result?: string
  status?: 'done' | 'running' | 'error'
}

export type PreviewElement =
  | { slot: 'above-prompt'; rows: Row[] }
  | { slot: 'pane'; title: string; rows: Row[]; width?: 'narrow' | 'wide' }
  | { slot: 'status'; text: string }
  | { slot: 'toast'; text: string }
  | { slot: 'notification'; title?: string; text: string }
  | { slot: 'command'; command: string; args?: string; output?: Row[]; markdown?: string }
  | { slot: 'tool-deny'; tool: string; input: string; message: string }
  | { slot: 'prompt-rewrite'; before: string; after: string }
  | { slot: 'spinner'; glyphs?: string[]; verb: string; color?: Color }
  | { slot: 'prompt-hint'; row: Row }
  | { slot: 'session-mode'; row: Row }
  | { slot: 'turn-duration'; text: string }
  | { slot: 'tool-row'; tool: string; input: string; row?: Row; result?: Row[] }
  | { slot: 'message'; role: 'user' | 'assistant' | 'note'; rows?: Row[]; markdown?: string }
  | { slot: 'info-notice'; row: Row }
  | { slot: 'model-tool'; name: string; input?: string; result?: Row[] }
  | { slot: 'background'; text: string }

export type Slot = PreviewElement['slot']

export type Preview = {
  scene?: 'coding' | 'debugging' | 'review' | 'idle'
  transcript?: Turn[]
  surface?: 'terminal' | 'desktop'
  caption?: string
  caption_ru?: string
  elements: PreviewElement[]
}

export type ModSource =
  | { type: 'hosted' }
  | { type: 'github'; repo: string; path?: string; ref?: string; sha?: string }
  | { type: 'git'; url: string; path?: string; ref?: string; sha?: string }
  | { type: 'marketplace'; marketplace: string; plugin?: string; repo?: string; path?: string }

export type Capabilities = {
  network?: boolean
  processes?: boolean
  filesystem?: 'none' | 'read' | 'write'
  model?: boolean
  promptRewrite?: boolean
  blocksTools?: boolean
}

export type ModEntry = {
  name: string
  title: string
  tagline: string
  tagline_ru?: string
  description: string
  description_ru?: string
  author: { name: string; github?: string; url?: string }
  maintainers: string[]
  category: Category
  tags?: string[]
  license: string
  version?: string
  homepage?: string
  source: ModSource
  surfaces?: Surface[]
  requires?: { claudeCode?: string }
  capabilities?: Capabilities
  preview: Preview
  media?: { type: 'image' | 'video'; src: string; alt: string; surface?: Surface }[]
  verified?: boolean
}

/** What `claude plugin validate --json` said about the mod's code, summarised by CI. */
export type Analysis = {
  ok: boolean
  /** e.g. "tool.call", "ui.render{component=AbovePrompt}" */
  hooks: string[]
  /** e.g. "$.ui.toast", "$.process.run" */
  calls: string[]
  gating: { hook: string; hasCatch: boolean }[]
  stateKeys: string[]
  errors: string[]
  warnings: string[]
  /** Claude Code version that produced the report. */
  validatedWith: string
}

/** Minimum Claude Code versions behind each install path (official CHANGELOG). */
export type MinVersions = {
  /** Mods load in the terminal: "2.1.287". */
  mods: string
  /** Mods load in the desktop app's bundled Claude Code: "2.1.286". */
  desktop: string
  /** `/plugin install <mod> --marketplace <repo>` inside a session: "2.1.275". */
  terminal: string
  /** `claude plugin install <mod> --marketplace <repo>` in a shell: "2.1.292". */
  shell: string
  /** Mods draw in the VS Code chat panel: "2.1.299". */
  vscode: string
}

export type Install = {
  /** "turn-meter@mod-showroom", "<plugin>@<their marketplace name>" when known, else "<plugin>" */
  pluginId: string
  /** owner/repo of the marketplace that serves the mod */
  marketplaceRepo: string
  /** "/plugin install turn-meter --marketplace KROU4/claude-code-mod-showroom" (in a session) */
  terminal: string
  /** "claude plugin install turn-meter --marketplace KROU4/claude-code-mod-showroom" (in a shell) */
  shell: string
  /** "/plugin marketplace add KROU4/claude-code-mod-showroom" */
  marketplaceAdd: string
  /** One-click install in VS Code: "vscode://anthropic.claude-code/install-plugin?plugin=<enc>&marketplace=<enc>" */
  vscodeUrl: string
  /** Opens a terminal session with `terminal` typed (not sent): "claude-cli://open?q=<enc terminal>" */
  terminalUrl: string
  /**
   * A prompt that asks Claude (desktop app) to install the mod:
   * `Install the Claude Code mod "<plugin>" from the marketplace <repo>. Run in a shell:
   * "${CLAUDE_CODE_EXECPATH:-claude}" plugin install <plugin> --marketplace <repo> — then tell me to
   * start a new session so it loads.`
   */
  desktopPrompt: string
  /** Opens a new Code session in the desktop app with `desktopPrompt`: "claude://code/new?q=<enc>" */
  desktopUrl: string
  minVersion: MinVersions
}

/** Surfaces that draw something: the site's "Works on" chips. */
export type DrawingSurface = 'terminal' | 'desktop' | 'vscode'

/**
 * Where each slot can appear (scripts/lib/surfaces.mjs, published as `Registry.surfacesBySlot`):
 * everywhere (terminal, desktop, vscode): pane, message, tool-row, spinner, model-tool, background,
 *   tool-deny (shows as a tool row), prompt-rewrite (behaviour);
 * terminal + desktop: above-prompt, command, session-mode, prompt-hint, status, toast, notification;
 * terminal only: turn-duration, info-notice.
 */
export type SurfacesBySlot = Record<Slot, DrawingSurface[]>

/** Calls and hooks the official admin guide asks reviewers to look at (from `analysis`). */
export type Risk = {
  /** Of $.fs.read, $.fs.write, $.process.run, $.process.spawn, $.http.fetch, $.env.get, $.env.set,
   *  $.settings.read, $.mcp.call, $.model.complete, $.prompt.submit, $.session.send */
  calls: string[]
  /** Of tool.call, prompt.submit, session.append, tool.check */
  hooks: string[]
}

export type RegistryMod = ModEntry & {
  /**
   * Slots drawn by the preview (preview order), plus ones the analysis proves by a drawing call
   * ($.ui.toast → toast, $.ui.status → status, $.ui.notify → notification, $.ui.open → pane,
   * $.command.register → command, $.tool.register → model-tool), deduplicated.
   */
  slots: Slot[]
  /**
   * Present with `analysis`: slots whose render site the code hooks (`ui.render{component=…}`:
   * AbovePrompt → above-prompt, Pane → pane, Spinner → spinner, PromptHint → prompt-hint,
   * SessionMode → session-mode, TurnDuration → turn-duration, ToolUse/ToolResult/ToolGroup → tool-row,
   * UserMessage/AssistantMessage → message, CommandOutput → command, InfoNotice → info-notice).
   * A render hook may draw there or only watch, so these are not added to `slots`.
   */
  hookedSlots?: Slot[]
  /** Surfaces where every visible slot draws, plus the declared `surfaces` among the three. */
  drawsOn: DrawingSurface[]
  /** source.type === 'hosted' */
  hosted: boolean
  /** Our marketplace serves it (every source except `marketplace`). */
  inMarketplace: boolean
  install: Install
  /** The mod's page on the site: "https://krou4.github.io/claude-code-mod-showroom/#/mod/<name>" */
  siteUrl: string
  /** Where the code can be read on GitHub. */
  sourceUrl: string
  /** mod.json on GitHub, and its edit link. */
  entryUrl: string
  editUrl: string
  /** media `src` resolved to absolute URLs */
  media?: { type: 'image' | 'video'; src: string; alt: string; surface?: Surface }[]
  /** Capabilities: declared ones, overridden by what the analysis proves. */
  capabilities: Capabilities
  analysis?: Analysis
  /** Present with `analysis`. */
  risk?: Risk
  /** ISO dates from git history of the entry. */
  addedAt?: string
  updatedAt?: string
  /** GitHub enrichment: stars of the source repo (the catalog repo for hosted ones); pushedAt for external repos only. */
  stars?: number
  pushedAt?: string
}

export type Registry = {
  version: 1
  generatedAt: string
  repo: { owner: string; name: string; branch: string; url: string; pagesUrl: string }
  marketplace: { name: string; repo: string; addCommand: string; addShell: string }
  categories: { id: Category; title: string; title_ru: string; count: number }[]
  surfacesBySlot: SurfacesBySlot
  /** Plain-language labels of the capability flags. */
  capabilityLabels: Record<keyof Capabilities, { en: string; ru: string }>
  minVersions: MinVersions
  mods: RegistryMod[]
}
