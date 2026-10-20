import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import shellJson from '../data/registry.shell.json'
import type { SiteMod, SiteRegistry } from '../data/types'

// The catalog is never bundled into the JS. As soon as this module loads (before React's
// first render) the page requests it live from GitHub (cache-busting param rounded to 5
// minutes) and, at the same time, the copy published with the site (./registry.json, written
// by scripts/snapshot.mjs at predev/prebuild). The live copy wins when it answers within
// LIVE_GRACE_MS; otherwise the site copy is shown and the live one replaces it if it arrives
// later. A failed live request (404 before the repository is published, offline, timeout) is
// silent: the page only says where its numbers came from.
//
// Until one of them arrives, `registry` is the shell (src/data/registry.shell.json: repo,
// marketplace, categories, labels; no mods) and `ready` is false.

export const REGISTRY_URL = 'https://raw.githubusercontent.com/KROU4/claude-code-mod-showroom/main/registry.json'
/** The copy deployed next to index.html. */
export const SITE_REGISTRY_URL = `${import.meta.env.BASE_URL}registry.json`

const BUCKET_MS = 5 * 60 * 1000
const LIVE_TIMEOUT_MS = 8000
const SITE_TIMEOUT_MS = 20000
/** How long the live copy may take before the site copy is shown instead. */
const LIVE_GRACE_MS = 400

export type RegistrySource = 'live' | 'snapshot'

export type RegistryState = {
  /** The shell (no mods) until the catalog arrives, then the catalog. */
  registry: SiteRegistry
  /** Where `registry` came from: GitHub, or the copy published with the site. */
  source: RegistrySource
  /** registry.generatedAt as a Date (when the catalog was last built). */
  updatedAt: Date | null
  /** Set only when neither copy could be loaded. */
  error: Error | null
  /** A request is still in flight (the live one may still replace the site copy). */
  loading: boolean
  /** The catalog has arrived: `registry.mods` is real. */
  ready: boolean
  /** Loads again after an error. */
  retry: () => void
}

/** Repo, marketplace, categories and labels: everything except the mods. */
export const shellRegistry = shellJson as unknown as SiteRegistry

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

async function fetchRegistry(url: string, timeoutMs: number): Promise<SiteRegistry> {
  const ctrl = new AbortController()
  const timer = window.setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(url, { signal: ctrl.signal, credentials: 'omit' })
    if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`)
    const json: unknown = await res.json()
    if (!isRegistry(json)) throw new Error(`${url}: unexpected shape`)
    return json
  } finally {
    window.clearTimeout(timer)
  }
}

/** Both requests of one attempt, started together. */
type Load = {
  startedAt: number
  live: Promise<SiteRegistry>
  site: Promise<SiteRegistry>
  liveSettled: boolean
}

function startLoad(url: string, siteUrl: string): Load {
  const bucket = Math.floor(Date.now() / BUCKET_MS)
  const load: Load = {
    startedAt: Date.now(),
    live: fetchRegistry(`${url}?v=${bucket}`, LIVE_TIMEOUT_MS),
    site: fetchRegistry(`${siteUrl}?v=${bucket}`, SITE_TIMEOUT_MS),
    liveSettled: false,
  }
  load.live.then(
    () => (load.liveSettled = true),
    () => (load.liveSettled = true),
  )
  load.site.catch(() => {}) // handled by the provider; never an unhandled rejection
  return load
}

/** The first attempt starts with the module, not after the first render. */
const firstLoad: Load | null = typeof window !== 'undefined' ? startLoad(REGISTRY_URL, SITE_REGISTRY_URL) : null

type Loaded = Pick<RegistryState, 'registry' | 'source' | 'updatedAt' | 'error' | 'loading' | 'ready'>

const initial: Loaded = {
  registry: shellRegistry,
  source: 'snapshot',
  updatedAt: null,
  error: null,
  loading: true,
  ready: false,
}

const Ctx = createContext<RegistryState>({ ...initial, retry: () => {} })

export type RegistryProviderProps = {
  children: ReactNode
  /** The live catalog. */
  url?: string
  /** The copy published with the site. */
  siteUrl?: string
}

export function RegistryProvider({ children, url = REGISTRY_URL, siteUrl = SITE_REGISTRY_URL }: RegistryProviderProps) {
  const [state, setState] = useState<Loaded>(initial)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const reuse = attempt === 0 && firstLoad && url === REGISTRY_URL && siteUrl === SITE_REGISTRY_URL
    const load = reuse ? firstLoad : startLoad(url, siteUrl)
    let cancelled = false
    let shown: 'none' | 'live' | 'site' = 'none'
    let siteCopy: SiteRegistry | null = null
    let siteFailed = false
    let graceOver = false

    const show = (registry: SiteRegistry, source: RegistrySource, loading: boolean) => {
      if (!cancelled) setState({ registry, source, updatedAt: toDate(registry.generatedAt), error: null, loading, ready: true })
    }
    const fail = (error: Error) => {
      if (!cancelled) setState((s) => ({ ...s, error, loading: false }))
    }
    const showSiteIfDue = () => {
      if (shown !== 'none' || !siteCopy) return
      if (load.liveSettled || graceOver) {
        shown = 'site'
        show(siteCopy, 'snapshot', !load.liveSettled)
      }
    }

    const grace = window.setTimeout(
      () => {
        graceOver = true
        showSiteIfDue()
      },
      Math.max(0, load.startedAt + LIVE_GRACE_MS - Date.now()),
    )

    load.live.then(
      (registry) => {
        if (shown === 'site' && siteCopy && siteCopy.generatedAt === registry.generatedAt) {
          // same content: keep the objects the page already renders, only the source changes
          if (!cancelled) setState((s) => ({ ...s, source: 'live', loading: false }))
        } else {
          show(registry, 'live', false)
        }
        shown = 'live'
      },
      () => {
        if (shown === 'site') {
          if (!cancelled) setState((s) => ({ ...s, loading: false }))
        } else if (siteCopy) {
          showSiteIfDue()
        } else if (siteFailed) {
          fail(new Error('the catalog could not be loaded'))
        }
      },
    )
    load.site.then(
      (registry) => {
        siteCopy = registry
        showSiteIfDue()
      },
      (err: unknown) => {
        siteFailed = true
        if (load.liveSettled && shown === 'none') fail(err instanceof Error ? err : new Error(String(err)))
      },
    )

    return () => {
      cancelled = true
      window.clearTimeout(grace)
    }
  }, [url, siteUrl, attempt])

  const retry = useCallback(() => {
    setState(initial)
    setAttempt((n) => n + 1)
  }, [])

  const value = useMemo<RegistryState>(() => ({ ...state, retry }), [state, retry])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

/** { registry, source, updatedAt, error, loading, ready, retry } */
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
