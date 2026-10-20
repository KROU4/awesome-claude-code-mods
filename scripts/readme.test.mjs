import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { replaceBlock, updateReadme, renderCatalog, mdEscape, countPhrase, anchorOf } from './lib/readme.mjs'
import { toRegistryMod } from './lib/catalog.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

const mod = (name, extra = {}) =>
  toRegistryMod({
    name,
    title: extra.title || name,
    tagline: extra.tagline || `Does ${name}`,
    tagline_ru: extra.tagline_ru,
    description: 'A description long enough.',
    author: { name: 'Alice', github: 'alice' },
    maintainers: ['alice'],
    category: extra.category || 'fun',
    license: 'MIT',
    source: extra.source || { type: 'hosted' },
    preview: { elements: extra.elements || [{ slot: 'toast', text: 'hi' }] },
  })

test('replaceBlock swaps only the text between the markers', () => {
  const text = 'a\n<!-- mods:start -->\nold\n<!-- mods:end -->\nb <!-- count:start -->1<!-- count:end --> c'
  const out = replaceBlock(replaceBlock(text, 'mods', 'new'), 'count', '7 mods', { inline: true })
  assert.equal(out, 'a\n<!-- mods:start -->\nnew\n<!-- mods:end -->\nb <!-- count:start -->7 mods<!-- count:end --> c')
  assert.throws(() => replaceBlock('no markers', 'mods', 'x'), /not found/)
})

test('updateReadme is idempotent', () => {
  const mods = [mod('a-mod'), mod('b-mod', { category: 'git' })]
  const text = 'x <!-- count:start --><!-- count:end -->\n<!-- mods:start -->\n<!-- mods:end -->\n'
  const once = updateReadme(text, mods, 'en')
  assert.equal(updateReadme(once, mods, 'en'), once)
  assert.match(once, /x <!-- count:start -->2 mods<!-- count:end -->/)
})

test('catalog groups by category with the item format', () => {
  const md = renderCatalog([
    mod('spinner-pack', { title: 'Spinner Pack', tagline: 'Themed spinners', tagline_ru: 'Тематические спиннеры', elements: [{ slot: 'spinner', verb: 'x' }] }),
    mod('git-glance', { title: 'Git Glance', category: 'git', elements: [{ slot: 'status', text: 's' }, { slot: 'background', text: 'b' }] }),
    mod('store', { title: 'Store', source: { type: 'marketplace', marketplace: 'o/m' } }),
  ], 'en')
  assert.match(md, /^Categories: \[Git\]\(#git\) · \[Fun\]\(#fun\)/)
  assert.ok(md.indexOf('### Git') < md.indexOf('### Fun'))
  assert.match(md, /- \*\*\[Spinner Pack\]\(https:\/\/krou4\.github\.io\/claude-code-mod-showroom\/#\/mod\/spinner-pack\)\*\* — Themed spinners\. <sub>draws: spinner · by @alice · hosted here<\/sub>/)
  assert.match(md, /<sub>draws: status line · by @alice · hosted here<\/sub>/)
  assert.match(md, /```text\n {2}\/plugin install spinner-pack --marketplace KROU4\/claude-code-mod-showroom\n {2}```/)
  assert.match(md, /Store.*external<\/sub>\n {2}<details><summary>Install \(from the author’s marketplace\)<\/summary>/)
  assert.match(md, /\/plugin install store --marketplace o\/m/)
  const ru = renderCatalog([mod('spinner-pack', { title: 'Spinner Pack', tagline: 'Themed spinners', tagline_ru: 'Тематические спиннеры' })], 'ru')
  assert.match(ru, /### Развлечения/)
  assert.match(ru, /— Тематические спиннеры\. <sub>рисует: всплывающее уведомление · автор @alice · в этом репозитории<\/sub>/)
  assert.match(renderCatalog([], 'ru'), /Модов пока нет/)
})

test('contributor text is escaped', () => {
  assert.equal(mdEscape('<img src=x onerror=alert(1)> [link](javascript:x) *bold* `code` a|b'),
    '&lt;img src=x onerror=alert(1)&gt; \\[link\\](javascript:x) \\*bold\\* \\`code\\` a\\|b')
  const md = renderCatalog([mod('evil', { title: '[x](https://bad)', tagline: '<script>alert(1)</script>' })], 'en')
  assert.ok(!md.includes('<script>'))
  assert.ok(md.includes('**[\\[x\\](https://bad)](https://krou4.github.io/claude-code-mod-showroom/#/mod/evil)**'))
})

test('counts and anchors', () => {
  assert.equal(countPhrase(1, 'en'), '1 mod')
  assert.equal(countPhrase(9, 'en'), '9 mods')
  assert.deepEqual([1, 2, 5, 11, 21, 22, 25, 112].map(n => countPhrase(n, 'ru')), [
    '1 мод', '2 мода', '5 модов', '11 модов', '21 мод', '22 мода', '25 модов', '112 модов',
  ])
  assert.equal(anchorOf('Продуктивность'), 'продуктивность')
  assert.equal(anchorOf('How the repository is protected'), 'how-the-repository-is-protected')
})

test('both READMEs carry the generated-block markers', () => {
  for (const file of ['README.md', 'README.en.md']) {
    const text = readFileSync(join(root, file), 'utf8')
    for (const marker of ['<!-- mods:start -->', '<!-- mods:end -->', '<!-- count:start -->', '<!-- count:end -->']) {
      assert.ok(text.includes(marker), `${file}: ${marker}`)
    }
  }
})
