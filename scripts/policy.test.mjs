import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  decide, modNameOf, extensionAllowed, parsePrNumber, parseArgs, code, confirmedHead, maintainerIdsFrom, gather,
  trustClaims, mixedScriptWord, sourceKey, prNumberForHead,
} from './policy.mjs'
import { plan } from './bot-comment.mjs'

const entry = (name, maintainers, extra = {}) => ({ name, maintainers, ...extra })
const file = (filename, status = 'added', extra = {}) => ({ filename, status, size: 1200, mode: '100644', ...extra })
const codes = d => d.reasons.map(r => r.code)
/** A mod.json that passes the catalog schema (gather checks head entries against it). */
const validEntry = (name, extra = {}) => ({
  name,
  title: 'Neon Band',
  tagline: 'A neon band above the prompt.',
  description: 'Draws a neon band above the prompt after every turn.',
  author: { name: 'Alice', github: 'alice' },
  maintainers: ['alice'],
  category: 'fun',
  license: 'MIT',
  source: { type: 'hosted' },
  preview: { elements: [{ slot: 'above-prompt', rows: [['neon']] }] },
  ...extra,
})

/** Runs `fn` with fetch answering from `routes` ({ "/repos/...": () => Response }). */
async function withRoutes(routes, fn) {
  const requested = []
  const realFetch = globalThis.fetch
  globalThis.fetch = async url => {
    const path = String(url).replace('https://api.github.com', '')
    requested.push(path)
    const route = routes[path]
    return route ? route() : new Response('{"message":"unexpected"}', { status: 500 })
  }
  try {
    return await fn(requested)
  } finally {
    globalThis.fetch = realFetch
  }
}
const json = body => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } })

test('changing the code of a listed mod needs a catalog maintainer, even from its maintainer', () => {
  const hosted = { 'turn-meter': entry('turn-meter', ['KROU4'], { source: { type: 'hosted' } }) }
  const edit = decide({
    prFiles: [file('mods/turn-meter/plugin/hooks/register.tsx', 'modified')],
    author: 'KROU4',
    baseEntries: hosted,
    headEntries: hosted,
  })
  assert.deepEqual(codes(edit), ['code-change'])
  assert.match(edit.reasons[0].en, /register\.tsx/)
  // Renaming a file out of plugin/ touches the code too.
  const moved = decide({
    prFiles: [file('mods/turn-meter/notes.md', 'renamed', { previous_filename: 'mods/turn-meter/plugin/hooks/register.tsx' })],
    author: 'KROU4',
    baseEntries: hosted,
    headEntries: hosted,
  })
  assert.deepEqual(codes(moved), ['code-change'])
  // Our marketplace serves github and git sources too.
  const github = { x: entry('x', ['alice'], { source: { type: 'github', repo: 'a/b' } }) }
  assert.deepEqual(codes(decide({ prFiles: [file('mods/x/plugin/a.ts', 'modified')], author: 'alice', baseEntries: github, headEntries: github })), ['code-change'])
  // A marketplace entry's code is installed from elsewhere: files here are not served.
  const market = { y: entry('y', ['alice'], { source: { type: 'marketplace', marketplace: 'a/b' } }) }
  assert.equal(decide({ prFiles: [file('mods/y/plugin/a.ts')], author: 'alice', baseEntries: market, headEntries: market }).allowed, true)
  // Preview and text edits still merge.
  assert.equal(decide({ prFiles: [file('mods/turn-meter/mod.json', 'modified')], author: 'KROU4', baseEntries: hosted, headEntries: hosted }).allowed, true)
})

test('the code check cannot be dodged by letter case or by removing mod.json in the same PR', () => {
  const hosted = { 'turn-meter': entry('turn-meter', ['KROU4'], { source: { type: 'hosted' } }) }
  // Plugin/ becomes plugin/ on macOS and Windows checkouts.
  const cased = decide({
    prFiles: [file('mods/turn-meter/Plugin/hooks/register.tsx')],
    author: 'KROU4',
    baseEntries: hosted,
    headEntries: hosted,
  })
  assert.ok(codes(cased).includes('code-change'))
  // Removing the entry does not make a code change free.
  const removed = decide({
    prFiles: [file('mods/turn-meter/mod.json', 'removed'), file('mods/turn-meter/plugin/hooks/register.tsx', 'modified')],
    author: 'KROU4',
    baseEntries: hosted,
    headEntries: {},
  })
  assert.deepEqual(codes(removed), ['code-change'])
  // Removing your own entry alone is still fine.
  const delist = decide({
    prFiles: [file('mods/turn-meter/mod.json', 'removed')],
    author: 'KROU4',
    baseEntries: hosted,
    headEntries: {},
  })
  assert.equal(delist.allowed, true)
})

test('file names that break a checkout on some systems need a catalog maintainer', () => {
  const mine = { x: entry('x', ['alice'], { source: { type: 'marketplace', marketplace: 'a/b' } }) }
  const run = paths => decide({ prFiles: paths.map(p => file(p)), author: 'alice', baseEntries: mine, headEntries: mine })
  for (const bad of ['mods/x/media/a:b.png', 'mods/x/media/CON.png', 'mods/x/media/nul', 'mods/x/media/shot..png.', 'mods/x/media/кадр.png', 'mods/x/media/a b.png']) {
    assert.ok(codes(run([bad])).includes('unportable-path'), bad)
  }
  assert.ok(codes(run(['mods/x/media/Shot.png', 'mods/x/media/shot.png'])).includes('unportable-path'))
  // Folder spellings clash too: plugin/ and Plugin/ end up in one folder on macOS and Windows.
  assert.ok(codes(run(['mods/x/plugin/hooks/register.tsx', 'mods/x/Plugin/hooks/hidden.ts'])).includes('unportable-path'))
  assert.ok(codes(run(['mods/x/a.md', 'mods/x/A.md/b.png'])).includes('unportable-path'))
  // Long paths break checkouts on Windows without core.longpaths.
  assert.ok(codes(run([`mods/x/media/${'d'.repeat(100)}/${'f'.repeat(100)}.png`])).includes('unportable-path'))
  assert.ok(codes(run([`mods/x/media/${'s'.repeat(101)}.png`])).includes('unportable-path'))
  assert.equal(run(['mods/x/media/shot-1.png', 'mods/x/media/Band_dark.webp']).allowed, true)
})

test('changing where a listed mod installs from needs a catalog maintainer', () => {
  const base = { x: entry('x', ['alice'], { source: { type: 'github', repo: 'a/b', sha: 'a'.repeat(40) } }) }
  const moved = { x: entry('x', ['alice'], { source: { type: 'github', repo: 'a/b', sha: 'b'.repeat(40) } }) }
  assert.deepEqual(codes(decide({ prFiles: [file('mods/x/mod.json', 'modified')], author: 'alice', baseEntries: base, headEntries: moved })), ['source-change'])
  const market = { y: entry('y', ['alice'], { source: { type: 'marketplace', marketplace: 'good/mkt' } }) }
  const evil = { y: entry('y', ['alice'], { source: { type: 'marketplace', marketplace: 'evil/mkt' } }) }
  assert.deepEqual(codes(decide({ prFiles: [file('mods/y/mod.json', 'modified')], author: 'alice', baseEntries: market, headEntries: evil })), ['source-change'])
  const hosted = { z: entry('z', ['alice'], { source: { type: 'hosted' } }) }
  const toGit = { z: entry('z', ['alice'], { source: { type: 'git', url: 'https://example.com/z.git' } }) }
  assert.deepEqual(codes(decide({ prFiles: [file('mods/z/mod.json', 'modified')], author: 'alice', baseEntries: hosted, headEntries: toGit })), ['source-change'])
  assert.equal(sourceKey({ type: 'hosted' }), sourceKey({ type: 'hosted', extra: 1 }))
})

test('a new entry under a name the catalog had before needs a catalog maintainer', () => {
  const d = decide({
    prFiles: [file('mods/old-mod/mod.json'), file('mods/old-mod/plugin/hooks/register.ts')],
    author: 'mallory',
    baseEntries: { 'old-mod': null },
    headEntries: { 'old-mod': entry('old-mod', ['mallory']) },
    previouslyListed: { 'old-mod': true },
  })
  assert.deepEqual(codes(d), ['name-reused'])
})

test('one new entry per pull request, each mod.json under 64 KB', () => {
  const two = decide({
    prFiles: [file('mods/a-mod/mod.json'), file('mods/b-mod/mod.json')],
    author: 'alice',
    baseEntries: { 'a-mod': null, 'b-mod': null },
    headEntries: { 'a-mod': entry('a-mod', ['alice']), 'b-mod': entry('b-mod', ['alice']) },
  })
  assert.deepEqual(codes(two), ['many-new'])
  const big = decide({
    prFiles: [file('mods/a-mod/mod.json', 'added', { size: 64 * 1024 + 1 })],
    author: 'alice',
    baseEntries: { 'a-mod': null },
    headEntries: { 'a-mod': entry('a-mod', ['alice']) },
  })
  assert.deepEqual(codes(big), ['entry-too-big'])
  // The size limit is for mod.json; media keep the 2 MB limit.
  const media = decide({
    prFiles: [file('mods/a-mod/mod.json'), file('mods/a-mod/media/demo.png', 'added', { size: 500 * 1024 })],
    author: 'alice',
    baseEntries: { 'a-mod': null },
    headEntries: { 'a-mod': entry('a-mod', ['alice']) },
  })
  assert.equal(media.allowed, true, JSON.stringify(media.reasons))
})

test('who made the mod: the bot vouches only for the pull request author', () => {
  const fake = decide({
    prFiles: [file('mods/neon-band/mod.json')],
    author: 'mallory',
    baseEntries: { 'neon-band': null },
    headEntries: { 'neon-band': entry('neon-band', ['mallory'], { author: { name: 'Anthropic', github: 'anthropics', url: 'https://www.anthropic.com' } }) },
  })
  assert.deepEqual(codes(fake).sort(), ['author-not-you', 'trust-claim'])
  const listed = decide({
    prFiles: [file('mods/neon-band/mod.json')],
    author: 'mallory',
    baseEntries: { 'neon-band': null },
    headEntries: { 'neon-band': entry('neon-band', ['mallory', 'anthropics'], { author: { name: 'Mallory', github: 'mallory' } }) },
  })
  assert.deepEqual(codes(listed), ['new-maintainers'])
  const self = decide({
    prFiles: [file('mods/neon-band/mod.json')],
    author: 'Alice',
    baseEntries: { 'neon-band': null },
    headEntries: { 'neon-band': entry('neon-band', ['alice'], { author: { name: 'Alice', github: 'alice' } }) },
  })
  assert.equal(self.allowed, true, JSON.stringify(self.reasons))
  // An existing entry keeps its author and maintainers without a new check.
  const kept = { 'next-steps': entry('next-steps', ['KROU4'], { author: { name: 'Thariq', github: 'anthropics' }, title: 'Next Steps' }) }
  assert.equal(decide({ prFiles: [file('mods/next-steps/mod.json', 'modified')], author: 'KROU4', baseEntries: kept, headEntries: kept }).allowed, true)
  // Adding a co-maintainer to an existing entry is confirmed by a catalog maintainer.
  const more = { 'next-steps': { ...kept['next-steps'], maintainers: ['KROU4', 'eve'] } }
  assert.deepEqual(codes(decide({ prFiles: [file('mods/next-steps/mod.json', 'modified')], author: 'KROU4', baseEntries: kept, headEntries: more })), ['new-maintainers'])
})

test('words, marks, mixed alphabets and links that claim an endorsement need a catalog maintainer', () => {
  for (const extra of [
    { title: 'Official Git Glance' },
    { title: 'Git Glance ✓' },
    { tagline: 'Verified by the catalog team' },
    { tagline_ru: 'Официальный мод для Claude Code' },
    { author: { name: 'Аnthropic' } },
    { homepage: 'https://docs.claude.com/x' },
  ]) {
    const d = decide({
      prFiles: [file('mods/neon-band/mod.json')],
      author: 'alice',
      baseEntries: { 'neon-band': null },
      headEntries: { 'neon-band': entry('neon-band', ['alice'], extra) },
    })
    assert.deepEqual(codes(d), ['trust-claim'], JSON.stringify(extra))
  }
  assert.equal(mixedScriptWord('Аnthropic tools'), 'Аnthropic')
  assert.equal(mixedScriptWord('Привет, world'), null)
  assert.deepEqual(trustClaims({ title: 'Neon Band', tagline: 'A neon band above the prompt.' }), [])
  // Unchanged identity on an existing entry: nothing to check again.
  const base = { x: entry('x', ['alice'], { title: 'Official X' }) }
  assert.equal(decide({ prFiles: [file('mods/x/mod.json', 'modified')], author: 'alice', baseEntries: base, headEntries: base }).allowed, true)
})

test('gather checks the head mod.json against the schema of main and the name history', async () => {
  const repo = 'KROU4/claude-code-mod-showroom'
  const mainSha = '1'.repeat(40)
  const headSha = '2'.repeat(40)
  const pr = { number: 8, user: { login: 'alice', id: 1 }, state: 'open', draft: false, labels: [], base: { ref: 'main' }, head: { sha: headSha, ref: 'feature', repo: { full_name: 'alice/fork' } } }
  const routesFor = (head, history) => ({
    [`/repos/${repo}/git/ref/heads/main`]: () => json({ object: { sha: mainSha } }),
    [`/repos/${repo}/compare/${mainSha}...${headSha}`]: () => json({ files: [{ filename: 'mods/neon-band/mod.json', status: 'added' }] }),
    [`/repos/${repo}/git/trees/${headSha}?recursive=1`]: () => json({ truncated: false, tree: [{ path: 'mods/neon-band/mod.json', mode: '100644', type: 'blob', size: 300 }] }),
    [`/repos/${repo}/contents/mods/neon-band/mod.json?ref=${mainSha}`]: () => new Response('{"message":"Not Found"}', { status: 404 }),
    [`/repos/${repo}/contents/mods/neon-band?ref=${mainSha}`]: () => new Response('{"message":"Not Found"}', { status: 404 }),
    [`/repos/${repo}/contents/mods/neon-band/mod.json?ref=${headSha}`]: () => new Response(JSON.stringify(head), { status: 200 }),
    [`/repos/${repo}/commits?sha=${mainSha}&path=mods/neon-band&per_page=1`]: () => json(history),
  })
  const reused = await withRoutes(routesFor(validEntry('neon-band'), [{ sha: 'c'.repeat(40) }]), () => gather({ repo, pr, headSha, validateConclusion: 'success' }))
  assert.deepEqual(codes(reused), ['name-reused'])
  const hidden = await withRoutes(routesFor(validEntry('neon-band', { title: 'Neon‮Band' }), []), () => gather({ repo, pr, headSha, validateConclusion: 'success' }))
  assert.deepEqual(codes(hidden), ['invalid-entry'])
  assert.match(hidden.reasons[0].en, /title/)
  const pixel = validEntry('neon-band', { media: [{ type: 'image', src: 'https://tracker.example/p.png', alt: 'pixel' }] })
  assert.deepEqual(codes(await withRoutes(routesFor(pixel, []), () => gather({ repo, pr, headSha, validateConclusion: 'success' }))), ['invalid-entry'])
})

test('without the pr-meta artifact the PR is found by its exact head commit, repository and branch', async () => {
  const repo = 'KROU4/claude-code-mod-showroom'
  const headSha = '3'.repeat(40)
  const pulls = [
    { number: 4, head: { sha: '4'.repeat(40), ref: 'feature', repo: { full_name: 'alice/fork' } }, base: { ref: 'main' } },
    { number: 9, head: { sha: headSha, ref: 'feature', repo: { full_name: 'alice/fork' } }, base: { ref: 'main' } },
  ]
  const path = `/repos/${repo}/pulls?state=open&per_page=30&head=${encodeURIComponent('alice:feature')}`
  assert.equal(await withRoutes({ [path]: () => json(pulls) }, () => prNumberForHead(repo, headSha, 'alice/fork', 'feature')), 9)
  assert.equal(await withRoutes({ [path]: () => json(pulls) }, () => prNumberForHead(repo, '5'.repeat(40), 'alice/fork', 'feature')), null)
  assert.equal(await prNumberForHead(repo, headSha, '-bad/fork', 'feature'), null)
})

test('a new entry by its maintainer is merged', () => {
  const d = decide({
    prFiles: [file('mods/neon-band/mod.json'), file('mods/neon-band/media/band.png')],
    author: 'alice',
    baseEntries: { 'neon-band': null },
    headEntries: { 'neon-band': entry('neon-band', ['Alice']) },
  })
  assert.equal(d.allowed, true, JSON.stringify(d.reasons))
  assert.deepEqual(d.names, ['neon-band'])
})

test('an edit by someone who is not a maintainer needs a maintainer', () => {
  const d = decide({
    prFiles: [file('mods/turn-meter/mod.json', 'modified')],
    author: 'mallory',
    baseEntries: { 'turn-meter': entry('turn-meter', ['KROU4']) },
    headEntries: { 'turn-meter': entry('turn-meter', ['KROU4', 'mallory']) },
  })
  assert.equal(d.allowed, false)
  assert.deepEqual(codes(d), ['not-maintainer'])
  assert.match(d.reasons[0].en, /not a maintainer of `turn-meter`/)
  assert.match(d.reasons[0].ru, /не мейнтейнер/)
})

test('maintainer logins compare case-insensitively against the base entry', () => {
  const d = decide({
    prFiles: [file('mods/turn-meter/mod.json', 'modified')],
    author: 'krou4',
    baseEntries: { 'turn-meter': entry('turn-meter', ['KROU4']) },
    headEntries: { 'turn-meter': entry('turn-meter', ['KROU4']) },
  })
  assert.equal(d.allowed, true, JSON.stringify(d.reasons))
})

test('a file outside mods/ is refused', () => {
  const d = decide({
    prFiles: [file('mods/neon-band/mod.json'), file('scripts/policy.mjs', 'modified')],
    author: 'alice',
    baseEntries: { 'neon-band': null },
    headEntries: { 'neon-band': entry('neon-band', ['alice']) },
  })
  assert.equal(d.allowed, false)
  assert.ok(codes(d).includes('outside-mods'))
  assert.match(d.reasons.find(r => r.code === 'outside-mods').en, /scripts\/policy\.mjs/)
})

test('workflow files and loose files directly under mods/ are outside an entry', () => {
  for (const path of ['.github/workflows/validate.yml', 'mods/README.md', 'mods/x/../../scripts/a.mjs']) {
    const d = decide({ prFiles: [file(path)], author: 'alice' })
    assert.ok(codes(d).includes('outside-mods'), path)
  }
})

test('flipping verified is refused, and new entries must not set it', () => {
  const edit = decide({
    prFiles: [file('mods/turn-meter/mod.json', 'modified')],
    author: 'KROU4',
    baseEntries: { 'turn-meter': entry('turn-meter', ['KROU4']) },
    headEntries: { 'turn-meter': entry('turn-meter', ['KROU4'], { verified: true }) },
  })
  assert.deepEqual(codes(edit), ['verified-changed'])
  const fresh = decide({
    prFiles: [file('mods/neon-band/mod.json')],
    author: 'alice',
    baseEntries: { 'neon-band': null },
    headEntries: { 'neon-band': entry('neon-band', ['alice'], { verified: false }) },
  })
  assert.deepEqual(codes(fresh), ['verified-changed'])
  const kept = decide({
    prFiles: [file('mods/turn-meter/mod.json', 'modified')],
    author: 'KROU4',
    baseEntries: { 'turn-meter': entry('turn-meter', ['KROU4'], { verified: false }) },
    headEntries: { 'turn-meter': entry('turn-meter', ['KROU4'], { verified: false, title: 'New' }) },
  })
  assert.equal(kept.allowed, true, JSON.stringify(kept.reasons))
})

test('any change to a verified entry needs a catalog maintainer, even by its maintainer', () => {
  const base = { 'turn-meter': entry('turn-meter', ['KROU4'], { verified: true, source: { type: 'github', repo: 'a/b', sha: 'a'.repeat(40) } }) }
  const edit = decide({
    prFiles: [file('mods/turn-meter/plugin/hooks/register.tsx', 'modified')],
    author: 'KROU4',
    baseEntries: base,
    headEntries: base,
  })
  assert.deepEqual(codes(edit), ['verified-entry'])
  const sha = decide({
    prFiles: [file('mods/turn-meter/mod.json', 'modified')],
    author: 'KROU4',
    baseEntries: base,
    headEntries: { 'turn-meter': entry('turn-meter', ['KROU4'], { verified: true, source: { type: 'github', repo: 'a/b', sha: 'b'.repeat(40) } }) },
  })
  assert.deepEqual(codes(sha), ['verified-entry'])
  const removed = decide({
    prFiles: [file('mods/turn-meter/mod.json', 'removed')],
    author: 'KROU4',
    baseEntries: base,
    headEntries: { 'turn-meter': null },
  })
  assert.deepEqual(codes(removed), ['verified-entry'])
})

test('a file whose size or type is unknown is refused (fail closed)', () => {
  // A new entry, so its code goes in without a code review (the first version has no installs).
  const ok = { author: 'alice', baseEntries: { x: null }, headEntries: { x: entry('x', ['alice']) } }
  assert.deepEqual(codes(decide({ ...ok, prFiles: [{ filename: 'mods/x/plugin/a.js', status: 'added' }] })), ['unknown-blob'])
  assert.deepEqual(codes(decide({ ...ok, prFiles: [file('mods/x/plugin/a.js', 'added', { mode: undefined })] })), ['unknown-blob'])
  assert.deepEqual(codes(decide({ ...ok, prFiles: [file('mods/x/plugin/a.js', 'added', { size: undefined })] })), ['unknown-blob'])
  assert.deepEqual(codes(decide({ ...ok, prFiles: [file('mods/x/plugin/a.js', 'added', { mode: '040000' })] })), ['unknown-blob'])
  assert.deepEqual(codes(decide({ ...ok, prFiles: [file('mods/x/plugin/sub', 'added', { mode: '160000', size: undefined })] })).sort(), ['bad-extension', 'symlink'])
  assert.equal(decide({ ...ok, prFiles: [file('mods/x/plugin/run.js', 'added', { mode: '100755' })] }).allowed, true)
  // A removed file has no head blob, and that is fine.
  assert.equal(decide({ ...ok, prFiles: [{ filename: 'mods/x/plugin/a.js', status: 'removed' }] }).allowed, true)
})

test('an unreadable head tree or a cut file list is refused', () => {
  const ok = { prFiles: [file('mods/x/mod.json', 'modified')], author: 'alice', baseEntries: { x: entry('x', ['alice']) }, headEntries: { x: entry('x', ['alice']) } }
  assert.deepEqual(codes(decide({ ...ok, treeUnreadable: true })), ['tree-unreadable'])
  const cut = decide({ ...ok, filesTruncated: true })
  assert.deepEqual(codes(cut), ['too-many-files'])
  assert.match(cut.reasons[0].en, /1 or more files/)
})

test('a maintainer login now owned by another account is refused', () => {
  const ok = { prFiles: [file('mods/x/mod.json', 'modified')], author: 'Alice', baseEntries: { x: entry('x', ['alice']) }, headEntries: { x: entry('x', ['alice']) } }
  assert.equal(decide({ ...ok, authorId: 101, maintainerIds: { alice: 101 } }).allowed, true)
  assert.deepEqual(codes(decide({ ...ok, authorId: 202, maintainerIds: { alice: 101 } })), ['maintainer-id-mismatch'])
  assert.deepEqual(codes(decide({ ...ok, authorId: undefined, maintainerIds: { alice: 101 } })), ['maintainer-id-mismatch'])
  // A login the catalog has not seen yet is trusted on first use.
  assert.equal(decide({ ...ok, authorId: 303, maintainerIds: { bob: 1 } }).allowed, true)
})

test('an unreadable or missing mod.json on main is not a free entry to adopt', () => {
  const head = { x: entry('x', ['mallory']) }
  const broken = decide({
    prFiles: [file('mods/x/mod.json', 'modified')],
    author: 'mallory',
    baseEntries: { x: null },
    baseErrors: { x: 'not valid JSON' },
    headEntries: head,
  })
  assert.deepEqual(codes(broken), ['base-entry-unreadable'])
  const orphan = decide({
    prFiles: [file('mods/x/mod.json', 'added')],
    author: 'mallory',
    baseEntries: { x: null },
    baseOrphans: { x: true },
    headEntries: head,
  })
  assert.deepEqual(codes(orphan), ['base-entry-unreadable'])
})

test('untrusted names cannot leave their code span in bot comments', () => {
  const d = decide({
    prFiles: [file('docs/a` @KROU4 [x](https://evil.example) `.md'), file('docs/line\nbreak.md')],
    author: 'alice',
  })
  const outside = d.reasons.find(r => r.code === 'outside-mods')
  assert.ok(outside.en.includes('`docs/a? @KROU4 [x](https://evil.example) ?.md`'), outside.en)
  assert.ok(outside.en.includes('`docs/line?break.md`'), outside.en)
  assert.ok(!/\n/.test(outside.en))
  const who = decide({
    prFiles: [file('mods/x/mod.json', 'modified')],
    author: 'eve',
    baseEntries: { x: entry('x', ['a` @everyone `b']) },
    headEntries: { x: entry('x', ['a` @everyone `b']) },
  })
  assert.ok(who.reasons[0].en.includes('`a? @everyone ?b`'), who.reasons[0].en)
  assert.equal(code('x'.repeat(300)).length, 202)
})

test('confirmedHead checks the commit, and the run repository and branch when given', () => {
  const sha = 'a'.repeat(40)
  const pr = { head: { sha, ref: 'feature', repo: { full_name: 'alice/fork' } } }
  assert.equal(confirmedHead(pr, sha), true)
  assert.equal(confirmedHead(pr, 'b'.repeat(40)), false)
  assert.equal(confirmedHead(pr, sha, { headRepo: 'alice/fork', headBranch: 'feature' }), true)
  assert.equal(confirmedHead(pr, sha, { headRepo: 'mallory/fork', headBranch: 'feature' }), false)
  assert.equal(confirmedHead(pr, sha, { headRepo: 'alice/fork', headBranch: 'main' }), false)
  assert.equal(confirmedHead(null, sha), false)
  assert.deepEqual(maintainerIdsFrom({ KROU4: 7, bad: 'x', also: 1.5 }), { krou4: 7 })
  assert.deepEqual(maintainerIdsFrom([1, 2]), {})
})

test('gather reads files from compare by SHA and blobs from the base repository, never pulls/N/files', async () => {
  const repo = 'KROU4/claude-code-mod-showroom'
  const mainSha = '1'.repeat(40)
  const headSha = '2'.repeat(40)
  const requested = []
  const json = body => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } })
  const routes = {
    [`/repos/${repo}/git/ref/heads/main`]: () => json({ object: { sha: mainSha } }),
    [`/repos/${repo}/compare/${mainSha}...${headSha}`]: () => json({ files: [
      { filename: 'mods/neon-band/mod.json', status: 'added' },
      { filename: 'mods/neon-band/plugin/hooks/register.ts', status: 'added' },
    ] }),
    [`/repos/${repo}/git/trees/${headSha}?recursive=1`]: () => json({ truncated: false, tree: [
      { path: 'mods/neon-band/mod.json', mode: '100644', type: 'blob', size: 300 },
      { path: 'mods/neon-band/plugin/hooks/register.ts', mode: '100644', type: 'blob', size: 900 },
    ] }),
    [`/repos/${repo}/contents/mods/neon-band/mod.json?ref=${mainSha}`]: () => new Response('{"message":"Not Found"}', { status: 404 }),
    [`/repos/${repo}/contents/mods/neon-band?ref=${mainSha}`]: () => new Response('{"message":"Not Found"}', { status: 404 }),
    [`/repos/${repo}/contents/mods/neon-band/mod.json?ref=${headSha}`]: () => new Response(JSON.stringify(validEntry('neon-band')), { status: 200 }),
    [`/repos/${repo}/commits?sha=${mainSha}&path=mods/neon-band&per_page=1`]: () => json([]),
  }
  const realFetch = globalThis.fetch
  globalThis.fetch = async url => {
    const path = String(url).replace('https://api.github.com', '')
    requested.push(path)
    const route = routes[path]
    return route ? route() : new Response('{"message":"unexpected"}', { status: 500 })
  }
  try {
    const pr = { number: 7, user: { login: 'alice', id: 1 }, state: 'open', draft: false, labels: [], base: { ref: 'main' }, head: { sha: headSha, ref: 'feature', repo: { full_name: 'alice/fork' } } }
    const d = await gather({ repo, pr, headSha, validateConclusion: 'success' })
    assert.equal(d.allowed, true, JSON.stringify(d.reasons))
    assert.equal(d.mainSha, mainSha)
    assert.ok(!requested.some(p => p.includes('/pulls/')), requested.join('\n'))
    assert.ok(!requested.some(p => p.startsWith('/repos/alice/fork')), requested.join('\n'))
    assert.ok(requested.includes(`/repos/${repo}/compare/${mainSha}...${headSha}`))
  } finally {
    globalThis.fetch = realFetch
  }
})

test('more than 60 files is refused', () => {
  const prFiles = Array.from({ length: 61 }, (_, i) => file(`mods/big/media/${i}.png`))
  const d = decide({ prFiles, author: 'alice', baseEntries: { big: null }, headEntries: { big: entry('big', ['alice']) } })
  assert.deepEqual(codes(d), ['too-many-files'])
})

test('a file over 2 MB is refused', () => {
  const d = decide({
    prFiles: [file('mods/neon-band/mod.json'), file('mods/neon-band/media/demo.mp4', 'added', { size: 2 * 1024 * 1024 + 1 })],
    author: 'alice',
    baseEntries: { 'neon-band': null },
    headEntries: { 'neon-band': entry('neon-band', ['alice']) },
  })
  assert.deepEqual(codes(d), ['too-big'])
})

test('disallowed file types, symlinks and odd statuses are refused', () => {
  const d = decide({
    prFiles: [
      file('mods/neon-band/mod.json'),
      file('mods/neon-band/plugin/install.sh'),
      file('mods/neon-band/plugin/hooks/link.ts', 'added', { mode: '120000' }),
      file('mods/neon-band/plugin/hooks/x.ts', 'changed'),
    ],
    author: 'alice',
    baseEntries: { 'neon-band': null },
    headEntries: { 'neon-band': entry('neon-band', ['alice']) },
  })
  assert.deepEqual(codes(d).sort(), ['bad-extension', 'bad-status', 'symlink'])
})

test('drafts, the hold label, another base branch and the bot itself are refused', () => {
  const base = {
    prFiles: [file('mods/neon-band/mod.json')],
    author: 'alice',
    baseEntries: { 'neon-band': null },
    headEntries: { 'neon-band': entry('neon-band', ['alice']) },
  }
  assert.deepEqual(codes(decide({ ...base, isDraft: true })), ['draft'])
  assert.deepEqual(codes(decide({ ...base, labels: ['Hold'] })), ['hold'])
  assert.deepEqual(codes(decide({ ...base, baseRef: 'dev' })), ['wrong-base'])
  const bot = decide({ ...base, author: 'github-actions[bot]', headEntries: { 'neon-band': entry('neon-band', ['github-actions[bot]']) } })
  assert.ok(codes(bot).includes('bot-author'))
})

test('deleting an entry is allowed for its maintainer only', () => {
  const prFiles = [file('mods/old-mod/mod.json', 'removed'), file('mods/old-mod/plugin/hooks/register.ts', 'removed')]
  const baseEntries = { 'old-mod': entry('old-mod', ['bob']) }
  const headEntries = { 'old-mod': null }
  assert.equal(decide({ prFiles, author: 'bob', baseEntries, headEntries }).allowed, true)
  assert.deepEqual(codes(decide({ prFiles, author: 'eve', baseEntries, headEntries })), ['not-maintainer'])
})

test('a new entry must list its author in maintainers', () => {
  const d = decide({
    prFiles: [file('mods/neon-band/mod.json')],
    author: 'alice',
    baseEntries: { 'neon-band': null },
    headEntries: { 'neon-band': entry('neon-band', ['bob']) },
  })
  assert.deepEqual(codes(d).sort(), ['new-maintainers', 'not-in-new-maintainers'])
})

test('a new folder without mod.json is refused', () => {
  const d = decide({ prFiles: [file('mods/ghost/plugin/hooks/register.ts')], author: 'alice', baseEntries: {}, headEntries: {} })
  assert.deepEqual(codes(d), ['missing-entry'])
})

test('renaming a file between two entries touches both', () => {
  const d = decide({
    prFiles: [file('mods/b-mod/media/x.png', 'renamed', { previous_filename: 'mods/a-mod/media/x.png' })],
    author: 'alice',
    baseEntries: { 'a-mod': entry('a-mod', ['alice']), 'b-mod': entry('b-mod', ['carol']) },
    headEntries: { 'a-mod': entry('a-mod', ['alice']), 'b-mod': entry('b-mod', ['carol']) },
  })
  assert.deepEqual(d.names, ['a-mod', 'b-mod'])
  assert.deepEqual(codes(d), ['not-maintainer'])
})

test('a failed Validate run, a newer head commit or a closed PR stop the merge', () => {
  const base = {
    prFiles: [file('mods/neon-band/mod.json')],
    author: 'alice',
    baseEntries: { 'neon-band': null },
    headEntries: { 'neon-band': entry('neon-band', ['alice']) },
  }
  assert.deepEqual(codes(decide({ ...base, validateConclusion: 'failure' })), ['validate-failed'])
  assert.deepEqual(codes(decide({ ...base, headShaMatches: false })), ['stale-head'])
  assert.deepEqual(codes(decide({ ...base, state: 'closed' })), ['not-open'])
  assert.deepEqual(codes(decide({ ...base, headErrors: { 'neon-band': 'not valid JSON' } })), ['invalid-entry'])
})

test('an empty PR is not merged', () => {
  assert.deepEqual(codes(decide({ prFiles: [], author: 'alice' })), ['no-files'])
})

test('helpers: names, extensions, PR numbers, args', () => {
  assert.equal(modNameOf('mods/turn-meter/plugin/hooks/register.tsx'), 'turn-meter')
  assert.equal(modNameOf('mods/Turn/mod.json'), null)
  assert.equal(modNameOf('mods/turn-meter'), null)
  assert.equal(extensionAllowed('mods/a/plugin/types/index.d.ts'), true)
  assert.equal(extensionAllowed('mods/a/LICENSE'), true)
  assert.equal(extensionAllowed('mods/a/media/SHOT.PNG'), true)
  assert.equal(extensionAllowed('mods/a/.gitignore'), false)
  assert.equal(extensionAllowed('mods/a/Makefile'), false)
  assert.equal(parsePrNumber('42'), 42)
  assert.equal(parsePrNumber(7), 7)
  for (const bad of ['0', '-1', '1.5', '42; rm -rf /', '', null, undefined, '9999999999', ' 1e3']) {
    assert.equal(parsePrNumber(bad), null, String(bad))
  }
  assert.deepEqual(parseArgs(['--pr', '5', '--merged', '--out', 'x.json']), { pr: '5', merged: 'true', out: 'x.json' })
  assert.deepEqual(parseArgs(['--head-repo', '', '--merged']), { 'head-repo': '', merged: 'true' })
})

test('bot comment plan: merged, failed check, refused', () => {
  const merged = plan({ pr: 1, reasons: [] }, { merged: true })
  assert.equal(merged.label, false)
  assert.equal(merged.unlabel, true)
  assert.match(merged.comment, /Merged automatically ✓/)
  assert.match(merged.comment, /<!-- automerge-bot -->/)

  const failed = plan({ pr: 1, reasons: [{ code: 'validate-failed', en: 'x', ru: 'y' }] }, { runUrl: 'https://github.com/o/r/actions/runs/1' })
  assert.equal(failed.label, false)
  assert.equal(failed.unlabel, true)
  assert.match(failed.comment, /actions\/runs\/1/)
  // A failed run of a PR that still changes files outside mods/ keeps its label.
  const failedOutside = plan({ pr: 1, reasons: [{ code: 'validate-failed', en: 'x', ru: 'y' }, { code: 'outside-mods', en: 'x', ru: 'y' }] })
  assert.equal(failedOutside.unlabel, false)

  const stale = plan({ pr: 1, reasons: [{ code: 'stale-head', en: 'x', ru: 'y' }] })
  assert.equal(stale.comment, null)
  assert.equal(stale.unlabel, false)

  const refused = plan({ pr: 1, reasons: [{ code: 'outside-mods', en: 'Outside files.', ru: 'Файлы снаружи.' }] })
  assert.equal(refused.label, true)
  assert.equal(refused.unlabel, false)
  assert.match(refused.comment, /- Outside files\./)
  assert.match(refused.comment, /- Файлы снаружи\./)
  assert.match(refused.comment, /needs-maintainer/)
})

test('bot comment plan: a bot error says nothing unless the PR/head pair was confirmed', () => {
  const error = { code: 'bot-error', en: 'GitHub 404', ru: 'GitHub 404' }
  assert.deepEqual(plan({ pr: 7, reasons: [error] }), { label: false, unlabel: false, comment: null })
  assert.deepEqual(plan({ pr: 7, reasons: [error], confirmed: false }), { label: false, unlabel: false, comment: null })
  const confirmed = plan({ pr: 7, reasons: [error], confirmed: true })
  assert.equal(confirmed.label, false)
  // The bot could not look, so it does not know the label is stale: it stays.
  assert.equal(confirmed.unlabel, false)
  assert.match(confirmed.comment, /Not merged this time/)
  assert.match(confirmed.comment, /повторится при следующем коммите/)
  assert.ok(!confirmed.comment.includes('needs-maintainer'), confirmed.comment)
})
