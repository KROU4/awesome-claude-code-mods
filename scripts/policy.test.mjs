import { test } from 'node:test'
import assert from 'node:assert/strict'
import { decide, modNameOf, extensionAllowed, parsePrNumber, parseArgs, code, confirmedHead, maintainerIdsFrom, gather } from './policy.mjs'
import { plan } from './bot-comment.mjs'

const entry = (name, maintainers, extra = {}) => ({ name, maintainers, ...extra })
const file = (filename, status = 'added', extra = {}) => ({ filename, status, size: 1200, mode: '100644', ...extra })
const codes = d => d.reasons.map(r => r.code)

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
    prFiles: [file('mods/turn-meter/plugin/hooks/register.tsx', 'modified')],
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
  const ok = { author: 'alice', baseEntries: { x: entry('x', ['alice']) }, headEntries: { x: entry('x', ['alice']) } }
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
    [`/repos/${repo}/contents/mods/neon-band/mod.json?ref=${headSha}`]: () => new Response(JSON.stringify(entry('neon-band', ['alice'])), { status: 200 }),
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
  assert.deepEqual(codes(d), ['not-in-new-maintainers'])
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
  assert.match(merged.comment, /Merged automatically ✓/)
  assert.match(merged.comment, /<!-- automerge-bot -->/)

  const failed = plan({ pr: 1, reasons: [{ code: 'validate-failed', en: 'x', ru: 'y' }] }, { runUrl: 'https://github.com/o/r/actions/runs/1' })
  assert.equal(failed.label, false)
  assert.match(failed.comment, /actions\/runs\/1/)

  const stale = plan({ pr: 1, reasons: [{ code: 'stale-head', en: 'x', ru: 'y' }] })
  assert.equal(stale.comment, null)

  const refused = plan({ pr: 1, reasons: [{ code: 'outside-mods', en: 'Outside files.', ru: 'Файлы снаружи.' }] })
  assert.equal(refused.label, true)
  assert.match(refused.comment, /- Outside files\./)
  assert.match(refused.comment, /- Файлы снаружи\./)
  assert.match(refused.comment, /needs-maintainer/)
})

test('bot comment plan: a bot error says nothing unless the PR/head pair was confirmed', () => {
  const error = { code: 'bot-error', en: 'GitHub 404', ru: 'GitHub 404' }
  assert.deepEqual(plan({ pr: 7, reasons: [error] }), { label: false, comment: null })
  assert.deepEqual(plan({ pr: 7, reasons: [error], confirmed: false }), { label: false, comment: null })
  const confirmed = plan({ pr: 7, reasons: [error], confirmed: true })
  assert.equal(confirmed.label, false)
  assert.match(confirmed.comment, /Not merged this time/)
  assert.match(confirmed.comment, /повторится при следующем коммите/)
  assert.ok(!confirmed.comment.includes('needs-maintainer'), confirmed.comment)
})
