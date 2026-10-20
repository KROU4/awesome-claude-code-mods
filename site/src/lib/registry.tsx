import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import snapshotJson from '../data/registry.snapshot.json'
import type { SiteMod, SiteRegistry } from '../data/types'

// The catalog: fetched live from GitHub (cache-busting param rounded to 5 minutes),
// falling back to the copy bundled at build time (scripts/snapshot.mjs).

export const REGISTRY_URL = 'https://raw.githubusercontent.com/KROU4/claude-code-mod-showroom/main/registry.json'
const BUCKET_MS = 5 * 60 * 1000
const TIMEOUT_MS = 8000

export type RegistrySource = 'live' | 'snapshot'

export type RegistryState = {
  /** Always present: the snapshot until the live copy arrives. */
  registry: SiteRegistry
  source: RegistrySource
  /** registry.generatedAt as a Date (when the catalog was last built). */
  updatedAt: Date | null
  /** Why the live copy is not used (network, 404, bad shape). The snapshot is shown meanwhile. */
  error: Error | null
  /** The live request is still in flight. */
  loading: boolean
}

export const snapshotRegistry = snapshotJson as unknown as SiteRegistry

function isRegistry(x: unknown): x is SiteRegistry {
  if (!x || typeof x !== 'object') return false
  const r = x as Partial<SiteRegistry>
  return r.version === 1 && Array.isArray(r.mods) && typeof r.generatedAt === 'string' && !!r.marketplace
}

function toDate(iso: string | undefined): Date | null {
  if (!iso) return null
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? null : d
}

const initial: RegistryState = {
  registry: snapshotRegistry,
  source: 'snapshot',
  updatedAt: toDate(snapshotRegistry.generatedAt),
  error: null,
  loading: true,
}

const Ctx = createContext<RegistryState>(initial)

export function RegistryProvider({ children, url = REGISTRY_URL }: { children: ReactNode; url?: string }) {
  const [state, setState] = useState<RegistryState>(initial)

  useEffect(() => {
    let cancelled = false
    const ctrl = new AbortController()
    const timer = window.setTimeout(() => ctrl.abort(), TIMEOUT_MS)
    const bucket = Math.floor(Date.now() / BUCKET_MS)
    fetch(`${url}?v=${bucket}`, { signal: ctrl.signal, credentials: 'omit' })
      .then((res) => {
        if (!res.ok) throw new Error(`registry.json: HTTP ${res.status}`)
        return res.json() as Promise<unknown>
      })
      .then((json) => {
        if (!isRegistry(json)) throw new Error('registry.json: unexpected shape')
        if (cancelled) return
        setState({ registry: json, source: 'live', updatedAt: toDate(json.generatedAt), error: null, loading: false })
      })
      .catch((err: unknown) => {
        if (cancelled) return
        const error = err instanceof Error ? err : new Error(String(err))
        setState((s) => ({ ...s, error, loading: false }))
      })
      .finally(() => window.clearTimeout(timer))
    return () => {
      cancelled = true
      window.clearTimeout(timer)
      ctrl.abort()
    }
  }, [url])

  return <Ctx.Provider value={state}>{children}</Ctx.Provider>
}

/** { registry, source: 'live' | 'snapshot', updatedAt, error, loading } */
export function useRegistry(): RegistryState {
  return useContext(Ctx)
}

export function useMod(name: string | null | undefined): SiteMod | undefined {
  const { registry } = useRegistry()
  return useMemo(() => (name ? registry.mods.find((m) => m.name === name) : undefined), [registry, name])
}

/** Stars of the catalog repository: the generator stores them on hosted mods. */
export function repoStars(registry: SiteRegistry): number | undefined {
  return registry.mods.find((m) => m.source.type === 'hosted' && typeof m.stars === 'number')?.stars
}

/** Distinct authors (by GitHub login, else by name). */
export function authorCount(registry: SiteRegistry): number {
  return new Set(registry.mods.map((m) => (m.author.github ?? m.author.name).toLowerCase())).size
}
