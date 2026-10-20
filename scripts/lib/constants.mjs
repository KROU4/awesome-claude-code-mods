// Names and URLs of the catalog. Every script reads them from here.

export const OWNER = 'KROU4'
export const REPO = 'claude-code-mod-showroom'
export const REPO_SLUG = `${OWNER}/${REPO}`
export const BRANCH = 'main'
export const REPO_URL = `https://github.com/${REPO_SLUG}`
export const RAW_BASE = `https://raw.githubusercontent.com/${REPO_SLUG}/${BRANCH}`
export const PAGES_URL = 'https://krou4.github.io/claude-code-mod-showroom/'

/** `name` of .claude-plugin/marketplace.json: plugin ids are `<mod>@mod-showroom`. */
export const MARKETPLACE_NAME = 'mod-showroom'
export const MARKETPLACE_DESCRIPTION =
  'Mod Showroom: community mods for Claude Code (bands, panes, status entries, toasts, spinners, tool guards). See each one inside the client at https://krou4.github.io/claude-code-mod-showroom/'

/** The bot that opens sync PRs and comments on PRs. */
export const BOT_LOGINS = ['github-actions[bot]', 'github-actions']

/** Claude Code CLI version CI installs (mods need 2.1.287+). */
export const CLI_VERSION = '2.1.302'

/** Minimum Claude Code versions behind each install path (from the official CHANGELOG). */
export const MIN_VERSIONS = {
  /** Mods load in the terminal. */
  mods: '2.1.287',
  /** Mods load in the desktop app's bundled Claude Code. */
  desktop: '2.1.286',
  /** `/plugin install <mod> --marketplace <repo>` inside a session. */
  terminal: '2.1.275',
  /** `claude plugin install <mod> --marketplace <repo>` in a shell. */
  shell: '2.1.292',
  /** Mods draw in the VS Code chat panel. */
  vscode: '2.1.299',
}

export const CATEGORIES = [
  { id: 'interface', title: 'Interface', title_ru: 'Интерфейс' },
  { id: 'insights', title: 'Insights', title_ru: 'Аналитика' },
  { id: 'safety', title: 'Safety', title_ru: 'Безопасность' },
  { id: 'productivity', title: 'Productivity', title_ru: 'Продуктивность' },
  { id: 'git', title: 'Git', title_ru: 'Git' },
  { id: 'integrations', title: 'Integrations', title_ru: 'Интеграции' },
  { id: 'fun', title: 'Fun', title_ru: 'Развлечения' },
  { id: 'accessibility', title: 'Accessibility', title_ru: 'Доступность' },
]

/** Files a PR may add under mods/<name>/ (lower-case extension, or a bare LICENSE). */
export const ALLOWED_EXTENSIONS = [
  'json', 'md', 'ts', 'tsx', 'js', 'mjs', 'cjs', 'mts', 'cts', 'jsx',
  'png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'mp4', 'webm',
  'txt', 'wav', 'mp3', 'ogg',
]
export const MAX_FILE_BYTES = 2 * 1024 * 1024
export const MAX_PR_FILES = 60

/** Label the bot puts on PRs it cannot merge, and the label that stops it. */
export const NEEDS_MAINTAINER_LABEL = 'needs-maintainer'
export const HOLD_LABEL = 'hold'
export const BOT_COMMENT_MARKER = '<!-- automerge-bot -->'
export const DISCOVERY_ISSUE_TITLE = 'Mods found this week'

export const siteUrlFor = name => `${PAGES_URL}#/mod/${name}`
