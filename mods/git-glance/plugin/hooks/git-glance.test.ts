import { expect, mock, test } from 'claude-code/testing'
import type { On, ProcessRunInit, ProcessRunResult } from 'claude-code'

// What git answers: `head` is rev-parse's stdout (absent: it fails, as on a
// branch with no commits), `status` is `git status --porcelain=v1 -b`, and
// `slowMs` delays both answers on the mocked clock.
type Repo = { head?: string; status: string; slowMs?: number } | 'not-a-repo' | 'no-git'

const SURFACES = ['terminal', 'desktop'] as const

const exited = (exitCode: number, stdout: string, stderr = ''): { value: ProcessRunResult } => ({
  value: { exitCode, stdout, stderr, isStdoutTruncated: false, isStderrTruncated: false },
})

// The world beneath the plugin: a mocked clock, git answered from `repo.now`,
// tools that succeed, and every status line the plugin set, in order.
function world(on: On, repo: { now: Repo }) {
  const clock = mock.clock(on)
  const gitCalls: string[][] = []
  const inits: (ProcessRunInit | undefined)[] = []
  const shown: (string | undefined)[] = []

  on('process.run', async ($, e) => {
    gitCalls.push([...e.argv])
    inits.push(e.init)
    const now = repo.now
    // A refusal here rejects the plugin's call, as a missing executable does.
    if (now === 'no-git') return { deny: 'spawn git ENOENT' }
    if (now === 'not-a-repo') return exited(128, '', 'fatal: not a git repository')
    if (now.slowMs !== undefined) await clock.sleep(now.slowMs)
    if (!e.argv.includes('rev-parse')) return exited(0, now.status)

    return now.head === undefined
      ? exited(128, 'HEAD\n', "fatal: ambiguous argument 'HEAD'")
      : exited(0, `${now.head}\n`)
  })
  on('ui.status', ($, e) => {
    shown.push(e.text)

    return { value: undefined }
  })
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  // Core holds a shell `ls` read-only; a plugin beneath withholds the result
  // of the shell command `withheld` after it ran.
  on('tool.call', ($, e) => {
    if (e.tool === 'Bash' && e.command === 'ls') return { result: 'ok', isReadOnly: true }
    if (e.tool === 'Bash' && e.command === 'withheld') return { deny: 'withheld by a plugin' }

    return { result: 'ok' }
  })

  return { clock, gitCalls, inits, shown, last: () => shown[shown.length - 1] }
}

const DIRTY = '## main...origin/main [ahead 1]\n M src/app.ts\nA  src/new.ts\n?? notes.md\n'

// The mod draws no ui.render tree, only `$.ui.status`, so the line must come
// out the same whatever surface the session starts on.
for (const surface of SURFACES) {
  test(`shows branch, changes and ahead/behind at session start (${surface})`, async ($, on) => {
    const w = world(on, { now: { head: 'main', status: DIRTY } })
    await $.session.start({ cwd: '/repo', surface, isInteractive: true })
    await w.clock.settle()

    expect(w.last()).toBe('⎇ main · 3 changed · ↑1 ↓0')
    expect(w.gitCalls).toEqual([
      ['git', 'rev-parse', '--abbrev-ref', 'HEAD'],
      ['git', 'status', '--porcelain=v1', '-b'],
    ])
    // In the session's directory, killed after 10 s, off the index lock.
    const init = { timeoutMs: 10_000, env: { GIT_OPTIONAL_LOCKS: '0' } }
    expect(w.inits).toEqual([init, init])
  })
}

test('says clean and omits ahead/behind without an upstream', async ($, on) => {
  const w = world(on, { now: { head: 'feature/login', status: '## feature/login\n' } })
  await $.session.start({ cwd: '/repo', surface: 'terminal', isInteractive: true })
  await w.clock.settle()

  expect(w.last()).toBe('⎇ feature/login · clean')
})

test('counts behind, and treats a gone upstream as none', async ($, on) => {
  const repo: { now: Repo } = { now: { head: 'main', status: '## main...origin/main [behind 2]\n' } }
  const w = world(on, repo)
  await $.session.start({ cwd: '/repo', surface: 'desktop', isInteractive: true })
  await w.clock.settle()
  expect(w.last()).toBe('⎇ main · clean · ↑0 ↓2')

  repo.now = { head: 'old', status: '## old...origin/old [gone]\n M a.ts\n' }
  await w.clock.advance(30_000)
  expect(w.last()).toBe('⎇ old · 1 changed')
})

test('names the branch of a repository with no commits yet', async ($, on) => {
  const w = world(on, { now: { status: '## No commits yet on main\n?? README.md\n' } })
  await $.session.start({ cwd: '/repo', surface: 'terminal', isInteractive: true })
  await w.clock.settle()

  expect(w.last()).toBe('⎇ main · 1 changed')
})

test('says detached HEAD when no branch is checked out', async ($, on) => {
  const w = world(on, { now: { head: 'HEAD', status: '## HEAD (no branch)\n M a.ts\n' } })
  await $.session.start({ cwd: '/repo', surface: 'terminal', isInteractive: true })
  await w.clock.settle()

  expect(w.last()).toBe('⎇ detached HEAD · 1 changed')
})

test('clears the status outside a git repository', async ($, on) => {
  const repo: { now: Repo } = { now: { head: 'main', status: '## main\n' } }
  const w = world(on, repo)
  await $.session.start({ cwd: '/repo', surface: 'terminal', isInteractive: true })
  await w.clock.settle()
  expect(w.last()).toBe('⎇ main · clean')

  repo.now = 'not-a-repo'
  await w.clock.advance(30_000)
  expect(w.shown.length).toBe(2)
  expect(w.last()).toBe(undefined)
})

test('clears the status when git cannot run', async ($, on) => {
  const w = world(on, { now: 'no-git' })
  await $.session.start({ cwd: '/repo', surface: 'terminal', isInteractive: true })
  await w.clock.settle()

  expect(w.shown).toEqual([undefined])
})

test('sends the status line only when its text changes, and again at a new session', async ($, on) => {
  const w = world(on, { now: { head: 'main', status: '## main\n' } })
  await $.session.start({ cwd: '/repo', surface: 'terminal', isInteractive: true })
  await w.clock.settle()
  await w.clock.advance(60_000)
  expect(w.gitCalls.length).toBe(6)
  expect(w.shown).toEqual(['⎇ main · clean'])

  await $.session.start({ cwd: '/repo', surface: 'terminal', isInteractive: true })
  await w.clock.settle()
  expect(w.shown).toEqual(['⎇ main · clean', '⎇ main · clean'])
})

test('refreshes once, a second after edits, without holding the tool call', async ($, on) => {
  const repo: { now: Repo } = { now: { head: 'main', status: '## main\n' } }
  const w = world(on, repo)
  await $.session.start({ cwd: '/repo', surface: 'terminal', isInteractive: true })
  await w.clock.settle()
  const before = w.gitCalls.length

  repo.now = { head: 'main', status: '## main\n M a.ts\n M b.ts\n' }
  await $.tool.call({ tool: 'Edit', file_path: '/repo/a.ts', old_string: 'a', new_string: 'b' })
  expect(w.gitCalls.length).toBe(before)

  await w.clock.advance(600)
  await $.tool.call({ tool: 'Bash', command: 'touch b.ts' })
  await w.clock.advance(999)
  expect(w.gitCalls.length).toBe(before)

  await w.clock.advance(1)
  expect(w.gitCalls.length).toBe(before + 2)
  expect(w.last()).toBe('⎇ main · 2 changed')
})

const WRITERS = [
  { tool: 'Write', file_path: '/repo/a.ts', content: 'a' },
  { tool: 'NotebookEdit', notebook_path: '/repo/n.ipynb', new_source: 'x = 1' },
  { tool: 'PowerShell', command: 'New-Item b.ts' },
] as const

for (const input of WRITERS) {
  test(`refreshes after a ${input.tool} call`, async ($, on) => {
    const w = world(on, { now: { head: 'main', status: '## main\n' } })
    await $.session.start({ cwd: '/repo', surface: 'terminal', isInteractive: true })
    await w.clock.settle()
    const before = w.gitCalls.length

    await $.tool.call(input)
    await w.clock.advance(1_000)
    expect(w.gitCalls.length).toBe(before + 2)
  })
}

test('refreshes after a shell call whose result a plugin withheld', async ($, on) => {
  const w = world(on, { now: { head: 'main', status: '## main\n' } })
  await $.session.start({ cwd: '/repo', surface: 'terminal', isInteractive: true })
  await w.clock.settle()
  const before = w.gitCalls.length

  const ran = await $.tool.call({ tool: 'Bash', command: 'withheld' })
  expect(ran.deny).toBe('withheld by a plugin')
  await w.clock.advance(1_000)
  expect(w.gitCalls.length).toBe(before + 2)
})

test('a read-only tool call does not refresh', async ($, on) => {
  const w = world(on, { now: { head: 'main', status: '## main\n' } })
  await $.session.start({ cwd: '/repo', surface: 'terminal', isInteractive: true })
  await w.clock.settle()
  const before = w.gitCalls.length

  await $.tool.call({ tool: 'Read', file_path: '/repo/a.ts' })
  await $.tool.call({ tool: 'Bash', command: 'ls' })
  await w.clock.advance(5_000)
  expect(w.gitCalls.length).toBe(before)
})

test('runs one git pair at a time and ends on the newest state', async ($, on) => {
  const repo: { now: Repo } = { now: { head: 'main', status: '## main\n' } }
  const w = world(on, repo)
  await $.session.start({ cwd: '/repo', surface: 'terminal', isInteractive: true })
  await w.clock.settle()
  const before = w.gitCalls.length

  repo.now = { head: 'main', status: '## main\n M a.ts\n', slowMs: 5_000 }
  await $.tool.call({ tool: 'Edit', file_path: '/repo/a.ts', old_string: 'a', new_string: 'b' })
  await w.clock.advance(1_000)
  expect(w.gitCalls.length).toBe(before + 2)

  // A refresh asked for while the slow one runs waits for it.
  repo.now = { head: 'main', status: '## main\n M a.ts\n M b.ts\n' }
  await $.tool.call({ tool: 'Bash', command: 'touch b.ts' })
  await w.clock.advance(1_000)
  expect(w.gitCalls.length).toBe(before + 2)

  await w.clock.advance(4_000)
  expect(w.gitCalls.length).toBe(before + 4)
  expect(w.shown.slice(1)).toEqual(['⎇ main · 1 changed', '⎇ main · 2 changed'])
})

test('polls every 30 seconds', async ($, on) => {
  const repo: { now: Repo } = { now: { head: 'main', status: '## main\n' } }
  const w = world(on, repo)
  await $.session.start({ cwd: '/repo', surface: 'terminal', isInteractive: true })
  await w.clock.settle()

  repo.now = { head: 'fix/typo', status: '## fix/typo\n' }
  await w.clock.advance(29_999)
  expect(w.last()).toBe('⎇ main · clean')

  await w.clock.advance(1)
  expect(w.last()).toBe('⎇ fix/typo · clean')
})
