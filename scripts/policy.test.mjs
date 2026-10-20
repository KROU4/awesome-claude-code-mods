import { test } from 'node:test'
import assert from 'node:assert/strict'
import { decide, modNameOf, extensionAllowed, parsePrNumber, parseArgs } from './policy.mjs'
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
    baseEntries: { 'turn-meter': entry('turn-meter', ['KROU4'], { verified: true }) },
    headEntries: { 'turn-meter': entry('turn-meter', ['KROU4'], { verified: true, title: 'New' }) },
  })
  assert.equal(kept.allowed, true)
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
})
