// Contrast check for the site's text pairs (WCAG 2.x ratio).
// Reads src/styles/tokens.css (LIGHT `:root {` block and DARK `:root[data-theme='dark'] {` block)
// and fails (exit 1) when a pair is below its minimum. The mock terminal's colors are the
// client's real theme tokens (src/components/mock/dsl/colors.ts); they are reported for
// information only, because the mock must look like Claude Code, not like the site.
//
//   npm run contrast

import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const siteDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const css = readFileSync(join(siteDir, 'src/styles/tokens.css'), 'utf8')

function block(startPattern) {
  const start = css.search(startPattern)
  if (start < 0) throw new Error(`block not found: ${startPattern}`)
  const open = css.indexOf('{', start)
  const close = css.indexOf('\n}', open)
  const body = css.slice(open + 1, close)
  const vars = {}
  for (const m of body.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) vars[m[1]] = m[2]
  return vars
}

const themes = {
  light: block(/^:root \{\n  color-scheme: light;/m),
  dark: block(/^:root\[data-theme='dark'\] \{/m),
}

function lum(hex) {
  const n = parseInt(hex.slice(1), 16)
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2]
}
export function ratio(a, b) {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p)
  return (x + 0.05) / (y + 0.05)
}

// [foreground, background, minimum, where it is used]
const TEXT = 4.5
const UI = 3
const pairs = [
  ...['paper', 'raised', 'sunk', 'sunk-2'].flatMap((bg) => [
    ['ink', bg, TEXT, 'body text'],
    ['ink-2', bg, TEXT, 'secondary text'],
  ]),
  ...['paper', 'raised', 'sunk'].flatMap((bg) => [
    ['ink-3', bg, TEXT, 'muted text, labels'],
    ['accent-ink', bg, TEXT, 'links, accent text'],
    ['success', bg, TEXT, 'success text'],
    ['warning', bg, TEXT, 'warning text'],
    ['danger', bg, TEXT, 'error text'],
  ]),
  ['on-accent', 'accent-fill', TEXT, 'primary button label'],
  ['on-accent', 'accent-fill-hover', TEXT, 'primary button label (hover)'],
  ['accent-soft-ink', 'accent-soft', TEXT, 'selected chip'],
  ['ink', 'accent-soft', TEXT, 'text on selected chip'],
  ['ink', 'success-soft', TEXT, 'success note'],
  ['ink', 'warning-soft', TEXT, 'warning note'],
  ['ink', 'danger-soft', TEXT, 'error note'],
  ['success', 'success-soft', TEXT, 'success note accent'],
  ['warning', 'warning-soft', TEXT, 'warning note accent'],
  ['danger', 'danger-soft', TEXT, 'error note accent'],
  ['paper', 'ink', TEXT, 'inverted (skip link, tooltip)'],
  ['focus', 'paper', UI, 'focus ring'],
  ['focus', 'raised', UI, 'focus ring on cards'],
  ['accent', 'paper', UI, 'caret, accent marks (non-text)'],
]

let failed = 0
for (const [name, vars] of Object.entries(themes)) {
  console.log(`\n${name}`)
  for (const [fg, bg, min, note] of pairs) {
    const a = vars[fg]
    const b = vars[bg]
    if (!a || !b) {
      console.log(`  ?  ${fg} on ${bg}: missing token`)
      failed++
      continue
    }
    const r = ratio(a, b)
    const ok = r >= min
    if (!ok) failed++
    console.log(`  ${ok ? 'ok' : 'FAIL'}  ${r.toFixed(2).padStart(5)}  ${fg} ${a} on ${bg} ${b}  (min ${min}, ${note})`)
  }
}

// Informational: the client's terminal theme tokens on the mock's terminal background.
const colorsFile = join(siteDir, 'src/components/mock/dsl/colors.ts')
if (existsSync(colorsFile)) {
  const src = readFileSync(colorsFile, 'utf8')
  for (const theme of ['dark', 'light']) {
    const m = src.match(new RegExp(`${theme}: \\{([\\s\\S]*?)\\n  \\}`))
    if (!m) continue
    const vars = Object.fromEntries([...m[1].matchAll(/(\w+): '(#[0-9a-f]{6})'/g)].map((x) => [x[1], x[2]]))
    const bg = vars.canvas
    if (!bg) continue
    const report = ['text', 'inactive', 'claude', 'success', 'error', 'warning', 'permission', 'subtle']
      .filter((k) => vars[k])
      .map((k) => `${k} ${ratio(vars[k], bg).toFixed(2)}`)
    console.log(`\nterminal ${theme} (client tokens, info only) on ${bg}: ${report.join(' · ')}`)
  }
}

console.log(failed ? `\n${failed} pair(s) below minimum` : '\nall pairs pass')
process.exit(failed ? 1 : 0)
