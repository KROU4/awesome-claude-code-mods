import { test } from 'node:test'
import assert from 'node:assert/strict'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { marketplaceSource, marketplaceEntry, buildMarketplace } from './lib/marketplace.mjs'
import { toRegistryMod } from './lib/catalog.mjs'
import { collect } from './build-registry.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const SHA = '0123456789abcdef0123456789abcdef01234567'

const base = {
  title: 'Neon Band',
  tagline: 'A neon band above the prompt.',
  tagline_ru: 'Неоновая полоса над промптом.',
  description: 'Draws a band above the prompt in neon colors.',
  author: { name: 'Alice', github: 'alice' },
  maintainers: ['alice'],
  category: 'fun',
  tags: ['band', 'neon'],
  license: 'Apache-2.0',
  preview: { elements: [{ slot: 'above-prompt', rows: [['x']] }] },
}
const item = (entry, manifest = null) => ({ entry, mod: toRegistryMod(entry, { manifest }), manifest })

test('marketplace sources for every source type', () => {
  assert.equal(marketplaceSource({ name: 'x', source: { type: 'hosted' } }), './mods/x/plugin')
  assert.deepEqual(marketplaceSource({ name: 'x', source: { type: 'github', repo: 'a/b' } }), { source: 'github', repo: 'a/b' })
  assert.deepEqual(marketplaceSource({ name: 'x', source: { type: 'github', repo: 'a/b', ref: 'v1', sha: SHA } }), { source: 'github', repo: 'a/b', ref: 'v1', sha: SHA })
  assert.deepEqual(marketplaceSource({ name: 'x', source: { type: 'github', repo: 'a/b', path: 'mods/x', sha: SHA } }), { source: 'git-subdir', url: 'a/b', path: 'mods/x', sha: SHA })
  assert.deepEqual(marketplaceSource({ name: 'x', source: { type: 'git', url: 'https://gitlab.com/a/b.git' } }), { source: 'url', url: 'https://gitlab.com/a/b.git' })
  assert.deepEqual(marketplaceSource({ name: 'x', source: { type: 'git', url: 'https://gitlab.com/a/b.git', path: 'p', ref: 'main' } }), { source: 'git-subdir', url: 'https://gitlab.com/a/b.git', path: 'p', ref: 'main' })
  assert.equal(marketplaceSource({ name: 'x', source: { type: 'marketplace', marketplace: 'o/m' } }), null)
})

test('a hosted entry copies plugin.json version and keeps catalog extras in metadata only', () => {
  const entry = { ...base, name: 'neon-band', source: { type: 'hosted' }, version: '9.9.9' }
  const { mod } = item(entry)
  const out = marketplaceEntry(entry, mod, { version: '0.3.0' })
  assert.deepEqual(Object.keys(out), ['name', 'source', 'description', 'version', 'author', 'homepage', 'repository', 'license', 'keywords', 'category', 'metadata'])
  assert.equal(out.version, '0.3.0')
  assert.deepEqual(out.author, { name: 'Alice', url: 'https://github.com/alice' })
  assert.equal(out.homepage, 'https://krou4.github.io/claude-code-mod-showroom/#/mod/neon-band')
  assert.equal(out.repository, 'https://github.com/KROU4/claude-code-mod-showroom')
  assert.deepEqual(out.keywords, ['band', 'neon'])
  assert.deepEqual(out.metadata, {
    showroom: {
      title: 'Neon Band',
      tagline: 'A neon band above the prompt.',
      tagline_ru: 'Неоновая полоса над промптом.',
      slots: ['above-prompt'],
      surfaces: ['terminal', 'desktop'],
      site: 'https://krou4.github.io/claude-code-mod-showroom/#/mod/neon-band',
    },
  })
})

test('external entries carry no version; marketplace sources are left out', () => {
  const gh = { ...base, name: 'neon-band', homepage: 'https://alice.dev/neon', version: '1.0.0', source: { type: 'github', repo: 'alice/neon', path: 'plugin', sha: SHA } }
  const other = { ...base, name: 'store', source: { type: 'marketplace', marketplace: 'o/m' } }
  const m = buildMarketplace([item(gh), item(other)])
  assert.equal(m.name, 'mod-showroom')
  assert.deepEqual(Object.keys(m), ['name', 'description', 'owner', 'metadata', 'plugins'])
  assert.deepEqual(m.owner, { name: 'KROU4', url: 'https://github.com/KROU4' })
  assert.equal(m.plugins.length, 1)
  const [p] = m.plugins
  assert.equal(p.version, undefined)
  assert.equal(p.homepage, 'https://alice.dev/neon')
  assert.equal(p.repository, 'https://github.com/alice/neon')
  assert.deepEqual(p.source, { source: 'git-subdir', url: 'alice/neon', path: 'plugin', sha: SHA })
})

test('plugins are sorted by name and the real catalog maps one to one', () => {
  const { items } = collect(root)
  const m = buildMarketplace(items)
  const names = m.plugins.map(p => p.name)
  assert.deepEqual(names, [...names].sort())
  const expected = items.filter(i => i.entry.source.type !== 'marketplace').map(i => i.entry.name).sort()
  assert.deepEqual(names, expected)
  for (const p of m.plugins) {
    if (typeof p.source === 'string') assert.match(p.source, /^\.\/mods\/[a-z0-9-]+\/plugin$/)
    const allowed = ['name', 'source', 'description', 'version', 'author', 'homepage', 'repository', 'license', 'keywords', 'category', 'metadata']
    for (const key of Object.keys(p)) assert.ok(allowed.includes(key), `unexpected key ${key}`)
  }
})
