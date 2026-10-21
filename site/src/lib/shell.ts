// The registry without its mods (repo, marketplace, categories, labels, minimum versions), bundled
// at build time from the registry.json of the commit being deployed (scripts/snapshot.mjs). The
// page draws with it before the catalog arrives, and everything that names this repository or its
// marketplace (links, the commands people paste) reads it from here, never from the live copy.
import shellJson from '../data/registry.shell.json' with { type: 'json' }
import type { SiteRegistry } from '../data/types'

export const shellRegistry = shellJson as unknown as SiteRegistry
