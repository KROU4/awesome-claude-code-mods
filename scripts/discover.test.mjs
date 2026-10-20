import { test } from 'node:test'
import assert from 'node:assert/strict'
import { modFoldersInTree, hasModules, knownSources, isCatalogued, renderChecklist, TOPICS } from './discover.mjs'

test('mod folders come from hooks/hooks.json blobs, not node_modules', () => {
  const tree = [
    { path: 'hooks/hooks.json', type: 'blob' },
    { path: 'mods/band/hooks/hooks.json', type: 'blob' },
    { path: 'node_modules/x/hooks/hooks.json', type: 'blob' },
    { path: 'myhooks/hooks.json', type: 'blob' },
    { path: 'mods/pane/hooks', type: 'tree' },
  ]
  assert.deepEqual(modFoldersInTree(tree), ['', 'mods/band'])
  assert.deepEqual(modFoldersInTree(undefined), [])
})

test('a hooks.json is a mod when it has a modules key', () => {
  assert.equal(hasModules('{"modules":["./register.ts"]}'), true)
  assert.equal(hasModules('{"hooks":{"PreToolUse":[]}}'), false)
  assert.equal(hasModules('not json'), false)
})

test('catalogued sources are skipped, case-insensitively', () => {
  const known = knownSources([
    { source: { type: 'github', repo: 'Alice/Band', path: 'plugin' } },
    { source: { type: 'git', url: 'https://github.com/bob/pane.git' } },
    { source: { type: 'marketplace', marketplace: 'carol/market' } },
    { source: { type: 'hosted' } },
  ])
  assert.equal(isCatalogued({ repo: 'alice/band', path: 'plugin' }, known), true)
  assert.equal(isCatalogued({ repo: 'alice/band', path: 'other' }, known), false)
  assert.equal(isCatalogued({ repo: 'bob/pane', path: '' }, known), true)
  assert.equal(isCatalogued({ repo: 'carol/market', path: 'anything' }, known), true)
  assert.equal(isCatalogued({ repo: 'KROU4/claude-code-mod-showroom', path: 'mods/x/plugin' }, known), true)
})

test('the checklist escapes repository descriptions', () => {
  const md = renderChecklist([
    { repo: 'alice/band', path: 'mods/band', stars: 3, description: 'A band <img src=x onerror=alert(1)> [click](https://evil)' },
    { repo: 'bob/pane', path: '', stars: 0, description: '' },
  ], { date: '2026-10-20', scanned: 12 })
  assert.match(md, /Scanned 12 repositories on 2026-10-20/)
  assert.match(md, /- \[ \] \[alice\/band\]\(https:\/\/github\.com\/alice\/band\/tree\/HEAD\/mods\/band\) · `mods\/band` · ★3 — A band &lt;img/)
  assert.ok(!md.includes('<img'))
  assert.ok(md.includes('\\[click\\]'))
  assert.match(md, /- \[ \] \[bob\/pane\]\(https:\/\/github\.com\/bob\/pane\) · ★0$/m)
  assert.match(renderChecklist([], { date: 'd' }), /Nothing new this week/)
  assert.deepEqual(TOPICS, ['claude-code-mod', 'claude-code-mods', 'claude-mod'])
})
