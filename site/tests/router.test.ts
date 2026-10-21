// lib/router: hashes parse safely, and back() leaves the site only when nothing of ours is behind
// the current entry, whatever the browser's own Back and Forward buttons did in between.
import { test } from 'node:test'
import assert from 'node:assert/strict'

type Entry = { url: string; state: unknown }

/** A browser tab: session history entries, location, and the events a fragment navigation fires. */
class FakeTab {
  entries: Entry[]
  index = 0
  left = false
  listeners = new Map<string, Set<() => void>>()
  constructor(url: string, before: Entry[] = []) {
    this.entries = [...before, { url, state: null }]
    this.index = this.entries.length - 1
  }
  get href() {
    return this.entries[this.index].url
  }
  fire(type: string) {
    for (const cb of this.listeners.get(type) ?? []) cb()
  }
  /** The browser's Back button. */
  browserBack() {
    if (this.index === 0) return // nothing behind: the browser does nothing
    this.index--
    if (!this.href.startsWith('https://site.test/')) this.left = true
    else {
      this.fire('popstate')
      this.fire('hashchange')
    }
  }
  /** A plain <a href="#/…"> the router did not intercept. */
  clickLink(hash: string) {
    this.entries = this.entries.slice(0, this.index + 1)
    this.entries.push({ url: `https://site.test/${hash}`, state: null })
    this.index++
    this.fire('popstate')
    this.fire('hashchange')
  }
  window() {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const tab = this
    return {
      history: {
        get state() {
          return tab.entries[tab.index].state
        },
        pushState(state: unknown, _: string, url: URL | string) {
          tab.entries = tab.entries.slice(0, tab.index + 1)
          tab.entries.push({ url: String(url), state: structuredClone(state) })
          tab.index++
        },
        replaceState(state: unknown, _: string, url?: URL | string) {
          tab.entries[tab.index] = { url: url === undefined ? tab.href : String(url), state: structuredClone(state) }
        },
        back() {
          tab.browserBack()
        },
      },
      location: {
        get href() {
          return tab.href
        },
        get hash() {
          const h = new URL(tab.href).hash
          return h === '#' ? '' : h
        },
      },
      addEventListener(type: string, cb: () => void) {
        if (!tab.listeners.has(type)) tab.listeners.set(type, new Set())
        tab.listeners.get(type)!.add(cb)
      },
      removeEventListener(type: string, cb: () => void) {
        tab.listeners.get(type)?.delete(cb)
      },
    }
  }
}

let n = 0
/** A fresh copy of the router (it keeps its state per page load) in a fresh tab. */
async function open(url: string, before: Entry[] = []) {
  const tab = new FakeTab(url, before)
  ;(globalThis as { window?: unknown }).window = tab.window()
  const router = (await import(`../src/lib/router.ts?case=${n++}`)) as typeof import('../src/lib/router.ts')
  return { tab, router }
}

test('hashes parse to routes, and a malformed escape is not a crash', async () => {
  const { router } = await open('https://site.test/#/')
  assert.deepEqual(router.parseHash('#/mod/git-glance'), { name: 'mod', mod: 'git-glance' })
  assert.deepEqual(router.parseHash('#/mod/%E0'), { name: 'home' })
  assert.deepEqual(router.parseHash('#/catalog/'), { name: 'catalog' })
  assert.deepEqual(router.parseHash(''), { name: 'home' })
  assert.equal(router.hrefFor({ name: 'mod', mod: 'a b' }), '#/mod/a%20b')
})

test('back() after an in-site navigation goes back one entry', async () => {
  const { tab, router } = await open('https://site.test/#/')
  router.navigate({ name: 'mod', mod: 'x' })
  assert.equal(tab.href, 'https://site.test/#/mod/x')
  router.back()
  assert.equal(tab.href, 'https://site.test/#/')
  assert.equal(tab.left, false)
})

test('back() never leaves the site, even after the browser Back button', async () => {
  // Arrived from another site straight on the loadout sheet.
  const { tab, router } = await open('https://site.test/#/loadout', [{ url: 'https://example.com/', state: null }])
  router.navigate({ name: 'mod', mod: 'x' })
  tab.browserBack()
  assert.equal(tab.href, 'https://site.test/#/loadout')
  // The sheet's close button: nothing of ours is behind this entry, so it stays on the site.
  router.back()
  assert.equal(tab.left, false)
  assert.equal(tab.href, 'https://site.test/#/')
})

test('a plain link click counts as an entry of ours', async () => {
  const { tab, router } = await open('https://site.test/#/', [{ url: 'https://example.com/', state: null }])
  router.navigate('#/catalog') // starts the router (any subscription would)
  tab.clickLink('#/mod/y')
  router.back()
  assert.equal(tab.href, 'https://site.test/#/catalog')
  router.back()
  assert.equal(tab.href, 'https://site.test/#/')
  router.back()
  assert.equal(tab.left, false, 'the first entry has nothing of ours behind it')
})

test('navigating to the current route is still a navigation', async () => {
  const { tab, router } = await open('https://site.test/#/catalog')
  router.navigate('#/how')
  const before = tab.entries.length
  router.navigate('#/how')
  assert.equal(tab.entries.length, before, 'no new history entry')
  router.navigate({ name: 'home' }, { replace: true })
  assert.equal(tab.entries.length, before, 'replace keeps the entry count')
  assert.equal(tab.href, 'https://site.test/#/')
})
