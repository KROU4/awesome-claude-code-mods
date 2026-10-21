// Tiny hash router: #/, #/catalog, #/mod/<name>, #/submit, #/how.
// No library; history-aware so the detail sheet can close with "back".
//
// Every history entry the site sees is tagged in history.state with `ms`: how many of the site's
// own entries lie behind it (0 for the entry the visitor arrived on). The browser keeps that tag
// per entry, so Back and Forward restore it, and back() leaves the site only when the current
// entry has nothing of ours behind it. A counter in memory would drift as soon as the visitor
// used the browser's own buttons.
import { useMemo, useSyncExternalStore } from 'react'

export type Route =
  | { name: 'home' }
  | { name: 'catalog' }
  | { name: 'mod'; mod: string }
  | { name: 'submit' }
  | { name: 'how' }

/** A route plus the navigation it came from: `seq` changes on every navigation, the same route included. */
export type RouteState = Route & { seq: number }

export function parseHash(hash: string): Route {
  const path = hash.replace(/^#/, '').replace(/^\/+/, '').replace(/\/+$/, '')
  if (path === '') return { name: 'home' }
  const [head, ...rest] = path.split('/')
  switch (head) {
    case 'catalog':
      return { name: 'catalog' }
    case 'submit':
      return { name: 'submit' }
    case 'how':
      return { name: 'how' }
    case 'mod': {
      // A malformed escape (#/mod/%E0) must not throw: a link like that would blank the page.
      let mod = ''
      try {
        mod = decodeURIComponent(rest.join('/'))
      } catch {
        mod = ''
      }
      return mod ? { name: 'mod', mod } : { name: 'home' }
    }
    default:
      return { name: 'home' }
  }
}

/** The href for a route, e.g. hrefFor({ name: 'mod', mod: 'git-glance' }) → "#/mod/git-glance". */
export function hrefFor(route: Route): string {
  switch (route.name) {
    case 'home':
      return '#/'
    case 'mod':
      return `#/mod/${encodeURIComponent(route.mod)}`
    default:
      return `#/${route.name}`
  }
}

type Tagged = { ms?: unknown }

/** The `ms` tag of the current entry (0 when untagged). */
function depthOf(state: unknown): number {
  const ms = (state as Tagged | null)?.ms
  return typeof ms === 'number' && Number.isInteger(ms) && ms >= 0 ? ms : 0
}

const isTagged = (state: unknown): boolean => typeof (state as Tagged | null)?.ms === 'number'

/** The tag of the entry the site last saw, so a fresh untagged entry knows what lies behind it. */
let current = 0
/** Bumped on every navigation (same route too), so sections can scroll again. */
let seq = 0
const listeners = new Set<() => void>()

function withDepth(state: unknown, ms: number): Record<string, unknown> {
  const base = state && typeof state === 'object' ? (state as Record<string, unknown>) : {}
  return { ...base, ms }
}

/**
 * Tags the current entry. A tagged entry (Back, Forward, a reload) keeps its tag. An untagged one
 * is either the entry the visitor arrived on (`arrival`) or one the browser just pushed for a
 * plain link click: that one has the previous entry behind it.
 */
function tagCurrent(arrival: boolean): void {
  const state = window.history.state
  if (isTagged(state)) {
    current = depthOf(state)
    return
  }
  current = arrival ? 0 : current + 1
  window.history.replaceState(withDepth(state, current), '')
}

/** Hash and tag of the entry the last notification was for. */
let lastKey = ''
const keyNow = () => `${window.location.hash}\u0000${depthOf(window.history.state)}`

function notify(): void {
  seq++
  lastKey = keyNow()
  for (const l of listeners) l()
}

let started = false
function start(): void {
  if (started || typeof window === 'undefined') return
  started = true
  tagCurrent(true)
  lastKey = keyNow()
  const onChange = () => {
    tagCurrent(false)
    // A fragment navigation fires popstate and then hashchange: one navigation, one notification.
    if (keyNow() !== lastKey) notify()
  }
  window.addEventListener('popstate', onChange)
  window.addEventListener('hashchange', onChange)
}

export function navigate(route: Route | string, opts: { replace?: boolean } = {}): void {
  start()
  const href = typeof route === 'string' ? (route.startsWith('#') ? route : `#${route}`) : hrefFor(route)
  if (href === window.location.hash || (href === '#/' && window.location.hash === '')) {
    // Same route: still a navigation, so sections can scroll to themselves again.
    notify()
    return
  }
  const url = new URL(window.location.href)
  url.hash = href
  if (opts.replace) {
    window.history.replaceState(withDepth(window.history.state, current), '', url)
  } else {
    current += 1
    window.history.pushState(withDepth(null, current), '', url)
  }
  notify()
}

/** Go back if the entry behind this one is ours, otherwise replace with `fallback` (default home). */
export function back(fallback: Route = { name: 'home' }): void {
  start()
  if (depthOf(window.history.state) > 0) window.history.back()
  else navigate(fallback, { replace: true })
}

function subscribe(cb: () => void) {
  start()
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}

const getSnapshot = () => `${seq}\u0000${window.location.hash}`

/**
 * Current route. The object stays the same between navigations (re-renders for a language or
 * motion change do not count as one), and `seq` tells two navigations to the same route apart.
 */
export function useRoute(): RouteState {
  const snap = useSyncExternalStore(subscribe, getSnapshot, () => '0\u0000')
  return useMemo(() => {
    const at = snap.indexOf('\u0000')
    return { ...parseHash(snap.slice(at + 1)), seq: Number(snap.slice(0, at)) }
  }, [snap])
}

/** The current hash, re-rendering on navigation (the loadout sheet's entry is not a route). */
export function useHash(): string {
  const snap = useSyncExternalStore(subscribe, getSnapshot, () => '0\u0000')
  return snap.slice(snap.indexOf('\u0000') + 1)
}
