// Runs the Claude Code CLI (`claude plugin validate`, `claude plugin test`) and git.
// Nothing here executes code from a mod: validate reads it statically; `plugin test` runs a hosted
// mod's own tests in Claude Code's test kit (CI only does that in the read-only Validate job).
import { spawnSync } from 'node:child_process'
import { homedir } from 'node:os'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/** True when the module at `url` is the script node was started with. */
export function isMain(url) {
  if (!process.argv[1]) return false
  const a = resolve(process.argv[1])
  const b = fileURLToPath(url)
  return process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b
}

let cached

/** { cmd, shell, version } for the `claude` binary, or null when it is not installed. */
export function findClaude() {
  if (cached !== undefined) return cached
  const candidates = process.env.CLAUDE_BIN
    ? [{ cmd: process.env.CLAUDE_BIN, shell: false }]
    : [{ cmd: 'claude', shell: false }, ...(process.platform === 'win32' ? [{ cmd: 'claude.cmd', shell: true }] : [])]
  cached = null
  for (const c of candidates) {
    const r = spawnSync(c.cmd, ['--version'], { encoding: 'utf8', shell: c.shell, cwd: homedir(), timeout: 60_000 })
    if (r.status === 0 && r.stdout) {
      const m = /(\d+\.\d+\.\d+)/.exec(r.stdout)
      cached = { ...c, version: m ? m[1] : r.stdout.trim() }
      break
    }
  }
  return cached
}

const quote = arg => (/^[\w./:@=+-]+$/.test(arg) ? arg : `"${arg.replace(/"/g, '\\"')}"`)

/** Runs `claude <args>` from the home directory (a short, neutral cwd). */
export function runClaude(args, { timeout = 180_000 } = {}) {
  const claude = findClaude()
  if (!claude) return { status: null, stdout: '', stderr: 'claude is not installed' }
  const r = spawnSync(claude.shell ? claude.cmd + ' ' + args.map(quote).join(' ') : claude.cmd, claude.shell ? [] : args, {
    encoding: 'utf8',
    shell: claude.shell,
    cwd: homedir(),
    timeout,
    maxBuffer: 32 * 1024 * 1024,
    env: { ...process.env, NO_COLOR: '1', CI: process.env.CI || '1' },
  })
  return { status: r.status, stdout: r.stdout || '', stderr: r.stderr || '', error: r.error }
}

/** Parsed `claude plugin validate --json [--strict] <dir>`: { status, report, raw }. */
export function validatePlugin(dir, { strict = false } = {}) {
  const r = runClaude(['plugin', 'validate', '--json', ...(strict ? ['--strict'] : []), dir])
  let report = null
  try {
    report = JSON.parse(r.stdout)
  } catch {
    const start = r.stdout.indexOf('{')
    if (start >= 0) {
      try {
        report = JSON.parse(r.stdout.slice(start))
      } catch {
        report = null
      }
    }
  }
  return { status: r.status, report, raw: r.stdout + r.stderr }
}

/** `claude plugin test <dir>`: { status, output }. */
export function testPlugin(dir) {
  const r = runClaude(['plugin', 'test', dir], { timeout: 300_000 })
  return { status: r.status, output: (r.stdout + r.stderr).trim() }
}

/** Runs git and returns trimmed stdout, or null on failure. */
export function git(args, cwd) {
  const r = spawnSync('git', args, { encoding: 'utf8', cwd, timeout: 120_000, maxBuffer: 32 * 1024 * 1024 })
  if (r.status !== 0) return null
  return r.stdout.trim()
}

/** First and last commit dates of a file ({ addedAt, updatedAt }), or {} without history. */
export function gitDates(root, file) {
  const out = git(['log', '--follow', '--format=%cI', '--', file], root)
  if (!out) return {}
  const dates = out.split(/\r?\n/).filter(Boolean)
  if (!dates.length) return {}
  return { addedAt: dates[dates.length - 1], updatedAt: dates[0] }
}

/** Paths changed between `base` and HEAD (merge-base diff), or null when git cannot tell. */
export function changedFiles(root, base) {
  const out = git(['diff', '--name-only', `${base}...HEAD`], root) ?? git(['diff', '--name-only', base, 'HEAD'], root)
  if (out === null) return null
  return out.split(/\r?\n/).filter(Boolean)
}
