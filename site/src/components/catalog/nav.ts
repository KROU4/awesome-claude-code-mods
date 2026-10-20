// Opening the mod sheet and the loadout sheet as history entries, so Back closes them.
import { useSyncExternalStore, type MouseEvent } from 'react'
import { navigate, parseHash } from '../../lib/router'

/** The loadout sheet's history entry (the router reads it as home: nothing scrolls). */
export const LOADOUT_HASH = '#/loadout'

/** Where a card's mock frame was on screen when it was clicked (viewport px). */
export type Origin = { left: number; top: number; width: number; height: number }

// The card that was just clicked: its mock frame grows into the sheet's. The sheet peeks at
// it while it mounts (StrictMode may run that twice) and clears it after.
let fromCard: { name: string; rect: Origin; at: number } | null = null

export function peekCardOrigin(name: string): Origin | null {
  return fromCard && fromCard.name === name && Date.now() - fromCard.at < 3000 ? fromCard.rect : null
}

export function clearCardOrigin(): void {
  fromCard = null
}

/**
 * Section routes (#/catalog, #/how, #/submit) scroll the page to their section whenever
 * they become current again, so closing a sheet with Back would jump away from the card.
 * Before an overlay opens, swap such a route for the home route in place.
 */
function leaveSectionRoute(): void {
  const r = parseHash(window.location.hash)
  if (r.name === 'catalog' || r.name === 'how' || r.name === 'submit') {
    const url = new URL(window.location.href)
    url.hash = '#/'
    window.history.replaceState(window.history.state, '', url)
  }
}

export function openMod(name: string, opts: { from?: Element | null } = {}): void {
  leaveSectionRoute()
  const r = opts.from?.getBoundingClientRect()
  fromCard = r && r.width > 0 ? { name, rect: { left: r.left, top: r.top, width: r.width, height: r.height }, at: Date.now() } : null
  navigate({ name: 'mod', mod: name })
}

export function openLoadout(): void {
  leaveSectionRoute()
  navigate(LOADOUT_HASH)
}

/** Plain left click without modifiers: handle in the page; otherwise let the browser open a tab. */
export function isPlainClick(e: MouseEvent): boolean {
  return e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey
}

function subscribe(cb: () => void) {
  window.addEventListener('hashchange', cb)
  window.addEventListener('popstate', cb)
  return () => {
    window.removeEventListener('hashchange', cb)
    window.removeEventListener('popstate', cb)
  }
}

export function useHash(): string {
  return useSyncExternalStore(subscribe, () => window.location.hash, () => '')
}
