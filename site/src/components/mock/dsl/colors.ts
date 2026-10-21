// Claude Code terminal theme tokens, exactly as extracted from the CLI 2.1.302 binary
// (_specs/research/visual-4.md §1.2). `canvas` and `chrome*` are the mock's own:
// the client has no background of its own, it uses the terminal emulator's.
import type { CSSProperties } from 'react'

export type TerminalTheme = 'dark' | 'light'

export const TERMINAL_THEMES = {
  dark: {
    canvas: '#141413',
    chrome: '#1f1e1d',
    chromeInk: '#9c9a92',
    claude: '#d77757',
    claudeShimmer: '#eb9f7f',
    text: '#ffffff',
    inverseText: '#000000',
    inactive: '#999999',
    inactiveShimmer: '#c1c1c1',
    subtle: '#505050',
    promptBorder: '#888888',
    promptBorderShimmer: '#a6a6a6',
    bashBorder: '#fd5db1',
    permission: '#b1b9f9',
    suggestion: '#b1b9f9',
    remember: '#b1b9f9',
    planMode: '#48968c',
    autoAccept: '#af87ff',
    merged: '#af87ff',
    ide: '#4782c8',
    success: '#4eba65',
    error: '#ff6b80',
    warning: '#ffc107',
    background: '#00cccc',
    diffAdded: '#225c2b',
    diffRemoved: '#7a2936',
    diffAddedDimmed: '#47584a',
    diffRemovedDimmed: '#69484d',
    diffAddedWord: '#38a660',
    diffRemovedWord: '#b3596b',
    userMessageBackground: '#373737',
    selectionBg: '#264f78',
    bashMessageBackgroundColor: '#413c41',
    fastMode: '#ff7814',
    professionalBlue: '#6a9bcc',
  },
  light: {
    canvas: '#ffffff',
    chrome: '#f0eee6',
    chromeInk: '#6b6a65',
    claude: '#d77757',
    claudeShimmer: '#f59575',
    text: '#000000',
    inverseText: '#ffffff',
    inactive: '#666666',
    inactiveShimmer: '#8e8e8e',
    subtle: '#afafaf',
    promptBorder: '#8a8a8a',
    promptBorderShimmer: '#b7b7b7',
    bashBorder: '#ff0087',
    permission: '#5769f7',
    suggestion: '#5769f7',
    remember: '#0000ff',
    planMode: '#006666',
    autoAccept: '#8700ff',
    merged: '#8700ff',
    ide: '#4782c8',
    success: '#2c7a39',
    error: '#ab2b3f',
    warning: '#966c1e',
    background: '#009999',
    diffAdded: '#69db7c',
    diffRemoved: '#ffa8b4',
    diffAddedDimmed: '#c7e1cb',
    diffRemovedDimmed: '#fdd2d8',
    diffAddedWord: '#2f9d44',
    diffRemovedWord: '#d1454b',
    userMessageBackground: '#f0f0f0',
    selectionBg: '#b4d5ff',
    bashMessageBackgroundColor: '#faf5fa',
    fastMode: '#ff6a00',
    professionalBlue: '#6a9bcc',
  },
} as const

export type TerminalToken = keyof (typeof TERMINAL_THEMES)['dark']

/** DSL ThemeColor names that are not client token names. */
const ALIASES: Record<string, TerminalToken> = {
  secondary: 'inactive',
  plan: 'planMode',
  dim: 'inactive',
}

/** Ink also accepts named ANSI colors; the mock draws them with a typical palette. */
const ANSI: Record<string, string> = {
  black: '#000000',
  red: '#cd3131',
  green: '#0dbc79',
  yellow: '#c4a000',
  blue: '#2472c8',
  magenta: '#bc3fbc',
  cyan: '#11a8cd',
  white: '#e5e5e5',
  gray: '#7f7f7f',
  grey: '#7f7f7f',
  blackBright: '#666666',
  redBright: '#f14c4c',
  greenBright: '#23d18b',
  yellowBright: '#f5f543',
  blueBright: '#3b8eea',
  magentaBright: '#d670d6',
  cyanBright: '#29b8db',
  whiteBright: '#ffffff',
}

const TOKENS = new Set(Object.keys(TERMINAL_THEMES.dark))

/**
 * CSS value for a DSL / Ink color: a theme token → var(--t-token), #hex or rgb()/rgba() as is.
 * Only those exact shapes pass: the value is pasted into borders and color-mix() for captured
 * trees, so "#fff; background:url(…)" or "rgb(0 0 0) , url(…)" must not.
 */
export function resolveColor(color: string | undefined | null): string | undefined {
  if (!color || typeof color !== 'string') return undefined
  if (/^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(color)) return color
  if (/^rgba?\(\s*[\d.]+%?\s*(?:,\s*|\s+)[\d.]+%?\s*(?:,\s*|\s+)[\d.]+%?\s*(?:(?:,|\/)\s*[\d.]+%?\s*)?\)$/i.test(color)) return color
  if (color.startsWith('#') || /^rgb/i.test(color)) return undefined
  const token = ALIASES[color] ?? color
  if (TOKENS.has(token)) return `var(--t-${token})`
  const ansi = color.replace(/^ansi:/, '')
  return ANSI[ansi]
}

/** Inline CSS variables for a terminal theme (`--t-claude`, `--t-text`, …). */
export function themeVars(theme: TerminalTheme): CSSProperties {
  const vars: Record<string, string> = {}
  for (const [k, v] of Object.entries(TERMINAL_THEMES[theme])) vars[`--t-${k}`] = v
  return vars as CSSProperties
}
