// Screenshots of the built site for visual checks (Playwright, Chromium).
//
//   npm run build && npm run preview -- --port 4173 --strictPort   (in another shell)
//   npm run shoot -- --out ../../_shots/foundation [--widths 1440,390] [--themes light,dark]
//                    [--hash "#/"] [--name page] [--selector ".dev-mock"] [--still] [--wait 1500]
//                    [--click 'button:has-text("Tool Timeline")'] [--viewport]  (viewport-only shot)
//
// --still emulates prefers-reduced-motion: every MockClient renders its final frame.
// Without it the hero session plays; --wait sets how long to let it run before the shot.
// First run: npx playwright install chromium
import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { chromium } from 'playwright'

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`)
  if (i < 0) return fallback
  const v = process.argv[i + 1]
  return v === undefined || v.startsWith('--') ? true : v
}

const base = arg('url', 'http://localhost:4173/claude-code-mod-showroom/')
const out = resolve(String(arg('out', 'shots')))
const widths = String(arg('widths', '1440,390')).split(',').map(Number)
const themes = String(arg('themes', 'light,dark')).split(',')
const hash = String(arg('hash', '#/'))
const name = String(arg('name', 'page'))
const selector = arg('selector', null)
const still = arg('still', false) === true
const wait = Number(arg('wait', 1500))
const full = arg('viewport', false) !== true

mkdirSync(out, { recursive: true })
const browser = await chromium.launch()
const files = []
try {
  for (const width of widths) {
    for (const theme of themes) {
      const ctx = await browser.newContext({
        viewport: { width, height: width < 600 ? 844 : 900 },
        deviceScaleFactor: 1,
        colorScheme: theme === 'dark' ? 'dark' : 'light',
        reducedMotion: still ? 'reduce' : 'no-preference',
        locale: String(arg('locale', 'en-US')),
      })
      const page = await ctx.newPage()
      const errors = []
      page.on('pageerror', (e) => errors.push(e.message))
      page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
      await page.goto(base + hash, { waitUntil: 'networkidle' })
      await page.evaluate(() => document.fonts.ready)
      const click = arg('click', null)
      if (typeof click === 'string') {
        await page.locator(click).first().click()
      }
      await page.waitForTimeout(wait)
      const file = `${out}/${name}-${width}-${theme}${still ? '-still' : ''}.png`
      if (typeof selector === 'string') {
        const el = page.locator(selector).first()
        await el.scrollIntoViewIfNeeded()
        await page.waitForTimeout(400)
        await el.screenshot({ path: file })
      } else {
        await page.screenshot({ path: file, fullPage: full })
      }
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
      files.push(file)
      console.log(`${file}${overflow > 0 ? `  ! horizontal overflow ${overflow}px` : ''}${errors.length ? `\n  errors: ${errors.join(' | ')}` : ''}`)
      await ctx.close()
    }
  }
} finally {
  await browser.close()
}
