import type { EngineInterface, ProcessRunInit, Register, Timer } from 'claude-code'

const DEBOUNCE_MS = 1_000
const POLL_MS = 30_000
// GIT_OPTIONAL_LOCKS=0 keeps `git status` off the index lock; git older than
// 2.15 ignores the variable, where it would refuse `--no-optional-locks`.
const GIT: ProcessRunInit = { timeoutMs: 10_000, env: { GIT_OPTIONAL_LOCKS: '0' } }

let poll: Timer | undefined
let pending: Timer | undefined
let running = false
let again = false
// The text last sent to the status line; null until a session's first refresh.
let shown: string | undefined | null = null

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const started = await next(e)
    poll?.cancel()
    poll = $.clock.every(POLL_MS, () => void refresh($))
    shown = null
    void refresh($)

    return started
  })

  // MultiEdit is matched for builds that still have it; PowerShell is the
  // shell tool on Windows.
  on(
    'tool.call',
    { tool: /^(Edit|Write|MultiEdit|NotebookEdit|Bash|PowerShell)$/ },
    async ($, e, next) => {
      const ran = await next(e)
      // A deny can come after the tool ran and undoes nothing, so only a call
      // core ran read-only (a shell `ls`) is skipped.
      if (ran.isReadOnly !== true) {
        pending?.cancel()
        pending = $.clock.after(DEBOUNCE_MS, () => void refresh($))
      }

      return ran
    },
  ).catch(($, e, next) => next(e)) // an observer, not a guard: the call always goes on
}

// One git pair at a time: refreshes asked for while one runs make one more run.
async function refresh($: EngineInterface) {
  if (running) {
    again = true
    return
  }
  running = true
  try {
    do {
      again = false
      const text = await describeRepo($).catch(() => undefined)
      if (text !== shown) $.ui.status((shown = text))
    } while (again)
  } finally {
    running = false
  }
}

// "⎇ main · 3 changed · ↑1 ↓0", or undefined outside a git repository.
async function describeRepo($: EngineInterface) {
  const [head, status] = await Promise.all([
    $.process.run(['git', 'rev-parse', '--abbrev-ref', 'HEAD'], GIT),
    $.process.run(['git', 'status', '--porcelain=v1', '-b'], GIT),
  ])
  if (status.exitCode !== 0) return undefined

  const [header = '', ...files] = status.stdout.split(/\r?\n/).filter(line => line !== '')
  const branch = head.exitCode === 0 ? head.stdout.trim() : unbornBranch(header)
  const parts = [
    `⎇ ${branch === 'HEAD' ? 'detached HEAD' : branch}`,
    files.length === 0 ? 'clean' : `${files.length} changed`,
  ]

  // "## main...origin/main [ahead 1, behind 2]"; no "..." means no upstream.
  const tracking = /^## \S+?\.\.\.\S+(?: \[(.*)\])?$/.exec(header)
  const counts = tracking?.[1] ?? ''
  if (tracking && counts !== 'gone') {
    parts.push(`↑${count(counts, 'ahead')} ↓${count(counts, 'behind')}`)
  }

  return parts.join(' · ')
}

// rev-parse fails on a branch with no commits yet: "## No commits yet on main".
function unbornBranch(header: string) {
  return /^## (?:No commits yet|Initial commit) on (.+?)(?:\.\.\..*)?$/.exec(header)?.[1] ?? 'HEAD'
}

function count(counts: string, word: 'ahead' | 'behind') {
  return Number(new RegExp(`${word} (\\d+)`).exec(counts)?.[1] ?? 0)
}
