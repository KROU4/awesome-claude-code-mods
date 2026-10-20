// Summarises what each mod's code does, from `claude plugin validate --json`, into
// data/analysis/<name>.json (the `Analysis` type). Hosted mods are read in place; github, git and
// marketplace sources are shallow-cloned into a temp folder and only validated (never run).
// Usage: node scripts/analyze.mjs [name ...]
// Without the `claude` binary on PATH it keeps the existing cache and prints a notice.
import { readFileSync, writeFileSync, existsSync, mkdirSync, mkdtempSync, rmSync, readdirSync } from 'node:fs'
import { join, dirname, normalize } from 'node:path'
import { tmpdir } from 'node:os'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { loadEntries } from './lib/catalog.mjs'
import { parseValidateReport } from './lib/analysis.mjs'
import { findClaude, validatePlugin, isMain } from './lib/cli.mjs'
import { rawFile } from './lib/github.mjs'
import { toJson } from './lib/registry.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

const safePath = p => {
  if (!p) return ''
  const clean = normalize(p.replace(/^\.\//, '')).replace(/\\/g, '/').replace(/\/$/, '')
  if (clean === '.' ) return ''
  if (clean.startsWith('..') || clean.startsWith('/') || /^[A-Za-z]:/.test(clean)) throw new Error(`unsafe path ${p}`)
  return clean
}

/** { url, ref?, sha?, path } to clone for an external source, or null. */
export async function cloneSpecFor(entry) {
  const s = entry.source || {}
  if (s.type === 'github') return { url: `https://github.com/${s.repo}.git`, ref: s.ref, sha: s.sha, path: safePath(s.path) }
  if (s.type === 'git') return { url: s.url, ref: s.ref, sha: s.sha, path: safePath(s.path) }
  if (s.type !== 'marketplace') return null
  const text = await rawFile(s.marketplace, 'HEAD', '.claude-plugin/marketplace.json').catch(() => null)
  if (!text) return null
  let market
  try {
    market = JSON.parse(text)
  } catch {
    return null
  }
  const plugin = (market.plugins || []).find(p => p && p.name === (s.plugin || entry.name))
  if (!plugin) return null
  return cloneSpecFromMarketplaceSource(plugin.source, s.marketplace, market.metadata?.pluginRoot)
}

/** Maps a marketplace entry `source` to a clone spec. */
export function cloneSpecFromMarketplaceSource(src, marketplaceRepo, pluginRoot) {
  const ghUrl = repo => (/^https?:\/\//.test(repo) || repo.startsWith('git@') ? repo : `https://github.com/${repo}.git`)
  if (typeof src === 'string') {
    const rel = src.startsWith('./') || src === '.' ? src : `${pluginRoot ? `${pluginRoot.replace(/\/$/, '')}/` : './'}${src}`
    return { url: ghUrl(marketplaceRepo), path: safePath(rel) }
  }
  if (!src || typeof src !== 'object') return null
  if (src.source === 'github' && src.repo) return { url: ghUrl(src.repo), ref: src.ref, sha: src.sha, path: '' }
  if (src.source === 'url' && src.url) return { url: src.url, ref: src.ref, sha: src.sha, path: '' }
  if (src.source === 'git-subdir' && src.url) return { url: ghUrl(src.url), ref: src.ref, sha: src.sha, path: safePath(src.path) }
  return null
}

function runGit(args, cwd) {
  const r = spawnSync('git', ['-c', 'core.symlinks=false', '-c', 'core.hooksPath=/dev/null', ...args], {
    cwd,
    encoding: 'utf8',
    timeout: 180_000,
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GIT_LFS_SKIP_SMUDGE: '1' },
  })
  if (r.status !== 0) throw new Error(`git ${args[0]} failed: ${(r.stderr || '').trim().split('\n').pop()}`)
}

/** Shallow checkout of a spec into a temp dir: { dir, cleanup }. */
function checkout(spec) {
  if (!/^https:\/\//.test(spec.url)) throw new Error(`only https git URLs are cloned (${spec.url})`)
  const tmp = mkdtempSync(join(tmpdir(), 'mod-'))
  const cleanup = () => rmSync(tmp, { recursive: true, force: true })
  try {
    if (spec.sha) {
      runGit(['init', '--quiet'], tmp)
      runGit(['remote', 'add', 'origin', spec.url], tmp)
      runGit(['fetch', '--depth', '1', '--no-tags', 'origin', spec.sha], tmp)
      runGit(['checkout', '--quiet', '--detach', 'FETCH_HEAD'], tmp)
    } else {
      runGit(['clone', '--quiet', '--depth', '1', '--no-tags', ...(spec.ref ? ['--branch', spec.ref] : []), spec.url, tmp], undefined)
    }
  } catch (err) {
    cleanup()
    throw err
  }
  return { dir: spec.path ? join(tmp, spec.path) : tmp, cleanup }
}

async function main() {
  const only = process.argv.slice(2).filter(a => !a.startsWith('-'))
  const claude = findClaude()
  if (!claude) {
    console.log('notice: the claude binary is not on PATH, so data/analysis/ is kept as it is')
    return
  }
  console.log(`claude ${claude.version}`)
  const outDir = join(root, 'data', 'analysis')
  mkdirSync(outDir, { recursive: true })
  const entries = loadEntries(root).filter(e => e.entry)
  const names = new Set(entries.map(e => e.name))

  for (const { name, entry } of entries) {
    if (only.length && !only.includes(name)) continue
    let target = null
    try {
      if (entry.source?.type === 'hosted') target = { dir: join(root, 'mods', name, 'plugin'), cleanup: () => {} }
      else {
        const spec = await cloneSpecFor(entry)
        if (spec) target = checkout(spec)
      }
    } catch (err) {
      console.log(`! ${name}: ${err.message}; keeping the cached analysis`)
      continue
    }
    if (!target) {
      console.log(`- ${name}: no readable source; keeping the cached analysis`)
      continue
    }
    try {
      if (!existsSync(target.dir)) {
        console.log(`! ${name}: ${target.dir} does not exist; keeping the cached analysis`)
        continue
      }
      const { report, raw } = validatePlugin(target.dir)
      if (!report) {
        console.log(`! ${name}: validate gave no JSON report; keeping the cached analysis\n${raw.trim().slice(0, 400)}`)
        continue
      }
      const analysis = parseValidateReport(report, claude.version)
      const file = join(outDir, `${name}.json`)
      const text = toJson(analysis)
      const before = existsSync(file) ? readFileSync(file, 'utf8') : null
      if (before !== text) writeFileSync(file, text)
      const mark = analysis.ok ? '✓' : '✗'
      console.log(`${mark} ${name}: ${analysis.hooks.length} hooks, ${analysis.calls.length} calls${before === text ? '' : ' (updated)'}`)
    } finally {
      target.cleanup()
    }
  }

  if (!only.length) {
    for (const file of readdirSync(outDir)) {
      if (file.endsWith('.json') && !names.has(file.slice(0, -5))) {
        rmSync(join(outDir, file))
        console.log(`- removed data/analysis/${file} (no such entry)`)
      }
    }
  }
}

if (isMain(import.meta.url)) await main()
