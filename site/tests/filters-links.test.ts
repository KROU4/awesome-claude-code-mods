// Saved catalog filters survive anything another page of this origin may have written, and
// description links show their real host.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { hostNote } from '../src/components/detail/links.ts'

function withStorage(value: unknown) {
  const store = new Map<string, string>([['ms.catalog.filters', JSON.stringify(value)]])
  ;(globalThis as { window?: unknown }).window = {
    localStorage: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    },
  }
}

test('saved filters keep known values only', async () => {
  const { loadFilters, DEFAULT_FILTERS } = await import('../src/components/catalog/filters.ts')
  withStorage({ category: 'toString', groups: ['constructor', '__proto__', 'band', 'band', 7], surface: 'mars', sort: 'evil' })
  assert.deepEqual(loadFilters(), { q: '', category: 'all', groups: ['band'], surface: 'any', sort: 'featured' })
  withStorage({ category: 'git', groups: ['pane'], surface: 'vscode', sort: 'stars' })
  assert.deepEqual(loadFilters(), { q: '', category: 'git', groups: ['pane'], surface: 'vscode', sort: 'stars' })
  withStorage([1, 2])
  assert.deepEqual(loadFilters(), DEFAULT_FILTERS)
})

test('link text that names another address shows the real host', () => {
  assert.equal(hostNote('github.com/anthropics/claude-code', 'https://evil.example/install'), 'evil.example')
  assert.equal(hostNote('the docs', 'https://evil.example/install'), null)
  assert.equal(hostNote('github.com/a/b', 'https://github.com/a/b'), null)
  assert.equal(hostNote('example.org', 'https://www.example.org/x'), null)
  assert.equal(hostNote('github.com', 'http://github.com'), null, 'not https: no link at all')
})
