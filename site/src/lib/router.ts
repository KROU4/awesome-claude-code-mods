// Tiny hash router: #/, #/catalog, #/mod/<name>, #/submit, #/how.
// No library; history-aware so the detail sheet can close with "back".
import { useSyncExternalStore } from 'react'

export type Route =
  | { name: 'home' }
  | { name: 'catalog' }
  | { name: 'mod'; mod: string }
  | { name: 'submit' }
  | { name: 'how' }

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
      const mod = decodeURIComponent(rest.join('/'))
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

// In-app navigations since load: when > 0, "back" stays inside the site.
let depth = 0

export function navigate(route: Route | string, opts: { replace?: boolean } = {}): void {
  const href = typeof route === 'string' ? (route.startsWith('#') ? route : `#${route}`) : hrefFor(route)
  if (href === window.location.hash || (href === '#/' && window.location.hash === '')) {
    // Same route: still notify so sections can re-scroll.
    window.dispatchEvent(new HashChangeEvent('hashchange'))
    return
  }
  if (opts.replace) {
    const url = new URL(window.location.href)
    url.hash = href
    window.history.replaceState(window.history.state, '', url)
    window.dispatchEvent(new HashChangeEvent('hashchange'))
  } else {
    depth++
    window.location.hash = href
  }
}

/** Go back if the previous entry is ours, otherwise replace with `fallback` (default home). */
export function back(fallback: Route = { name: 'home' }): void {
  if (depth > 0) {
    depth--
    window.history.back()
  } else {
    navigate(fallback, { replace: true })
  }
}

function subscribe(cb: () => void) {
  window.addEventListener('hashchange', cb)
  window.addEventListener('popstate', cb)
  return () => {
    window.removeEventListener('hashchange', cb)
    window.removeEventListener('popstate', cb)
  }
}

const getHash = () => window.location.hash

/** Current route, re-rendering on hash changes. */
export function useRoute(): Route {
  const hash = useSyncExternalStore(subscribe, getHash, () => '')
  return parseHash(hash)
}
