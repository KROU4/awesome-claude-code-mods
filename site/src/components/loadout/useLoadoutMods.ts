import { useMemo } from 'react'
import { useLoadout } from '../../lib/loadout'
import { useRegistry } from '../../lib/registry'
import type { SiteMod } from '../../data/types'

/** The loadout's mods in the order they were added (names the registry no longer has are skipped). */
export function useLoadoutMods(): SiteMod[] {
  const { names } = useLoadout()
  const { registry } = useRegistry()
  return useMemo(() => {
    const by = new Map(registry.mods.map((m) => [m.name, m]))
    return names.map((n) => by.get(n)).filter((m): m is SiteMod => !!m)
  }, [names, registry])
}
