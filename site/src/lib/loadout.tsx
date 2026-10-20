import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { readJSON, writeJSON } from './storage'

// The loadout: mods the person picked to see together and install in one block.
// Shared by catalog cards ("Add to loadout"), the hero chips and the LoadoutBar.

type LoadoutValue = {
  /** Mod names in the order they were added. */
  names: string[]
  has: (name: string) => boolean
  toggle: (name: string) => void
  add: (name: string) => void
  remove: (name: string) => void
  set: (names: string[]) => void
  clear: () => void
}

const Ctx = createContext<LoadoutValue | null>(null)
const KEY = 'loadout'

export function LoadoutProvider({ children }: { children: ReactNode }) {
  const [names, setNames] = useState<string[]>(() => {
    const v = readJSON<unknown>(KEY, [])
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').slice(0, 24) : []
  })

  const commit = useCallback((next: string[]) => {
    setNames(next)
    writeJSON(KEY, next)
  }, [])

  const value = useMemo<LoadoutValue>(() => {
    const has = (n: string) => names.includes(n)
    return {
      names,
      has,
      toggle: (n) => commit(has(n) ? names.filter((x) => x !== n) : [...names, n]),
      add: (n) => !has(n) && commit([...names, n]),
      remove: (n) => commit(names.filter((x) => x !== n)),
      set: (next) => commit([...new Set(next)]),
      clear: () => commit([]),
    }
  }, [names, commit])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useLoadout(): LoadoutValue {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useLoadout() needs <LoadoutProvider>')
  return ctx
}
