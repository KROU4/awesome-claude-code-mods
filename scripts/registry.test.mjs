import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, symlinkSync, copyFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { buildRegistry, withGeneratedAt, toJson } from './lib/registry.mjs'
import { collect } from './build-registry.mjs'
import { checkEntry } from './lib/entry.mjs'
import { checkFiles } from './validate.mjs'
import { cloneSpecFromMarketplaceSource } from './analyze.mjs'
import { reposToEnrich, sortKeys } from './enrich.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

test('registry shape, category counts and generatedAt only moving on change', () => {
  const { items } = collect(root)
  const mods = items.map(i => i.mod)
  const r = buildRegistry(mods)
  assert.deepEqual(Object.keys(r), ['version', 'generatedAt', 'repo', 'marketplace', 'categories', 'surfacesBySlot', 'capabilityLabels', 'minVersions', 'mods'])
  assert.equal(r.marketplace.name, 'mod-showroom')
  assert.equal(r.marketplace.addCommand, '/plugin marketplace add KROU4/claude-code-mod-showroom')
  assert.equal(r.repo.pagesUrl, 'https://krou4.github.io/claude-code-mod-showroom/')
  assert.equal(r.categories.reduce((n, c) => n + c.count, 0), mods.length)

  const first = withGeneratedAt(r, null, '2026-10-20T00:00:00.000Z')
  assert.equal(first.generatedAt, '2026-10-20T00:00:00.000Z')
  const again = withGeneratedAt(buildRegistry(mods), first, '2026-10-21T00:00:00.000Z')
  assert.equal(again.generatedAt, '2026-10-20T00:00:00.000Z', 'unchanged content keeps the stamp')
  assert.equal(toJson(again), toJson(first))
  const changed = withGeneratedAt(buildRegistry(mods.slice(1)), first, '2026-10-21T00:00:00.000Z')
  assert.equal(changed.generatedAt, '2026-10-21T00:00:00.000Z')
  assert.ok(toJson(first).endsWith('}\n'))
})

function scratch(files) {
  const dir = mkdtempSync(join(tmpdir(), 'showroom-'))
  mkdirSync(join(dir, 'schema'), { recursive: true })
  copyFileSync(join(root, 'schema', 'mod.schema.json'), join(dir, 'schema', 'mod.schema.json'))
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, path)), { recursive: true })
    writeFileSync(join(dir, path), text)
  }
  return dir
}

const ENTRY = {
  name: 'neon-band',
  title: 'Neon Band',
  tagline: 'A neon band above the prompt.',
  description: 'Draws a band above the prompt in neon colors.',
  author: { name: 'Alice' },
  maintainers: ['alice'],
  category: 'fun',
  license: 'MIT',
  source: { type: 'hosted' },
  preview: { elements: [{ slot: 'above-prompt', rows: [['x']] }] },
}

test('checkEntry: hosted layout, module path, media and names', () => {
  const dir = scratch({
    'mods/neon-band/plugin/.claude-plugin/plugin.json': JSON.stringify({ name: 'neon-band', version: '0.2.0' }),
    'mods/neon-band/plugin/hooks/hooks.json': JSON.stringify({ modules: ['./register.ts'] }),
    'mods/neon-band/plugin/hooks/register.ts': 'export const register = () => {}',
    'mods/neon-band/media/band.png': 'png',
  })
  try {
    const res = checkEntry(dir, 'neon-band', { ...ENTRY, version: '0.1.0', media: [{ type: 'image', src: 'media/band.png', alt: 'band' }] })
    assert.deepEqual(res.errors, [])
    assert.match(res.warnings[0], /differs from plugin.json version 0.2.0/)

    const missing = checkEntry(dir, 'neon-band', { ...ENTRY, media: [{ type: 'image', src: 'media/none.png', alt: 'none' }] })
    assert.deepEqual(missing.errors, ['media media/none.png does not exist'])

    const renamed = checkEntry(dir, 'neon-band', { ...ENTRY, name: 'claude-band' })
    assert.ok(renamed.errors.includes('name "claude-band" must equal the folder name "neon-band"'))
    assert.ok(renamed.errors.some(e => /may not start with "claude-"/.test(e)))
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('checkEntry: a hooks module outside plugin/ and a missing hooks.json', () => {
  const dir = scratch({
    'mods/neon-band/plugin/.claude-plugin/plugin.json': JSON.stringify({ name: 'neon-band' }),
    'mods/neon-band/plugin/hooks/hooks.json': JSON.stringify({ modules: ['../../../../scripts/policy.mjs'] }),
    'mods/other/plugin/.claude-plugin/plugin.json': JSON.stringify({ name: 'other' }),
  })
  try {
    assert.ok(checkEntry(dir, 'neon-band', ENTRY).errors.some(e => /must be inside plugin\//.test(e)))
    assert.ok(checkEntry(dir, 'other', { ...ENTRY, name: 'other' }).errors.some(e => /hooks\.json is missing/.test(e)))
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('checkFiles flags big files, odd types and links', () => {
  const dir = scratch({
    'mods/neon-band/mod.json': '{}',
    'mods/neon-band/run.sh': 'echo',
    'mods/neon-band/media/big.mp4': 'x'.repeat(2 * 1024 * 1024 + 1),
    'mods/neon-band/plugin/.claude-plugin/types/claude-code/index.d.ts': 'generated',
  })
  try {
    let linked = false
    try {
      symlinkSync(join(dir, 'mods/neon-band/mod.json'), join(dir, 'mods/neon-band/link.json'))
      linked = true
    } catch {
      /* symlinks need privileges on Windows */
    }
    const { errors, warnings } = checkFiles(dir, 'neon-band')
    assert.ok(errors.includes('mods/neon-band/media/big.mp4 is over 2 MB'))
    if (linked) assert.ok(errors.includes('mods/neon-band/link.json is a symbolic link'))
    assert.ok(warnings.some(w => w.startsWith('mods/neon-band/run.sh')))
    assert.ok(!warnings.some(w => w.includes('.claude-plugin/types')))
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('analyze maps marketplace entry sources to clone specs', () => {
  assert.deepEqual(cloneSpecFromMarketplaceSource('./plugins/x', 'o/m'), { url: 'https://github.com/o/m.git', path: 'plugins/x' })
  assert.deepEqual(cloneSpecFromMarketplaceSource('x', 'o/m', './plugins'), { url: 'https://github.com/o/m.git', path: 'plugins/x' })
  assert.deepEqual(cloneSpecFromMarketplaceSource({ source: 'github', repo: 'a/b', sha: 'c'.repeat(40) }, 'o/m'), { url: 'https://github.com/a/b.git', ref: undefined, sha: 'c'.repeat(40), path: '' })
  assert.deepEqual(cloneSpecFromMarketplaceSource({ source: 'git-subdir', url: 'a/b', path: 'm/x' }, 'o/m'), { url: 'https://github.com/a/b.git', ref: undefined, sha: undefined, path: 'm/x' })
  assert.equal(cloneSpecFromMarketplaceSource({ source: 'npm', package: 'x' }, 'o/m'), null)
  assert.throws(() => cloneSpecFromMarketplaceSource('./../../etc', 'o/m'), /unsafe path/)
})

test('enrich looks up source repos, marketplaces and the catalog repo', () => {
  const repos = reposToEnrich([
    { source: { type: 'hosted' } },
    { source: { type: 'github', repo: 'a/b' } },
    { source: { type: 'git', url: 'https://github.com/c/d.git' } },
    { source: { type: 'git', url: 'https://gitlab.com/e/f.git' } },
    { source: { type: 'marketplace', marketplace: 'o/m', repo: 'o/code' } },
  ])
  assert.deepEqual([...repos.keys()], ['KROU4/claude-code-mod-showroom', 'a/b', 'c/d', 'o/code', 'o/m'])
  assert.equal(repos.get('o/m').marketplace, true)
  assert.deepEqual(Object.keys(sortKeys({ b: 1, a: 2 })), ['a', 'b'])
})
