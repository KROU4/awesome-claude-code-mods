// Full catalog validation, used by CI (Validate workflow) and locally (`npm run check`).
//   node scripts/validate.mjs [--changed <base-sha>] [--no-cli] [--no-network]
// Every entry: schema, folder name, plugin-name rules, hosted layout, media, file sizes.
// Changed entries (all of them without --changed): `claude plugin validate --strict` and
// `claude plugin test` for hosted mods when the claude binary exists; for external sources, that
// the repository and its hooks/hooks.json exist (GitHub API, needs GITHUB_TOKEN) and that a
// `marketplace` source lists the plugin. registry.json and marketplace.json may lag in PRs: the
// sync bot regenerates them after a merge.
import { readdirSync, statSync, existsSync, appendFileSync } from 'node:fs'
import { join, dirname, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadEntries, listModNames, githubRepoOfUrl } from './lib/catalog.mjs'
import { checkEntry } from './lib/entry.mjs'
import { findClaude, validatePlugin, testPlugin, changedFiles, isMain } from './lib/cli.mjs'
import { gh, fileAt, rawFile, githubToken } from './lib/github.mjs'
import { MAX_FILE_BYTES } from './lib/constants.mjs'
import { extensionAllowed, modNameOf, parseArgs } from './policy.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

/** Every file under mods/<name>/ except generated type folders and node_modules. */
export function walkFiles(dir, base = dir) {
  const out = []
  if (!existsSync(dir)) return out
  for (const d of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, d.name)
    const rel = relative(base, full).replace(/\\/g, '/')
    if (d.isSymbolicLink()) out.push({ rel, size: 0, link: true })
    else if (d.isDirectory()) {
      if (d.name === 'node_modules' || rel.endsWith('.claude-plugin/types')) continue
      out.push(...walkFiles(full, base))
    } else out.push({ rel, size: statSync(full).size, link: false })
  }
  return out
}

/** Problems with the files of one entry folder (sizes, types, links). */
export function checkFiles(rootDir, name) {
  const errors = []
  const warnings = []
  for (const f of walkFiles(join(rootDir, 'mods', name))) {
    const path = `mods/${name}/${f.rel}`
    if (f.link) errors.push(`${path} is a symbolic link`)
    if (f.size > MAX_FILE_BYTES) errors.push(`${path} is over 2 MB`)
    if (!extensionAllowed(path)) warnings.push(`${path}: this file type is not merged automatically (see CONTRIBUTING)`)
  }
  return { errors, warnings }
}

const lastLines = (text, n = 12) => text.split(/\r?\n/).filter(Boolean).slice(-n).join('\n    ')

function cliChecks(rootDir, name, claude) {
  const errors = []
  const warnings = []
  const notes = []
  const dir = join(rootDir, 'mods', name, 'plugin')
  const { report, raw } = validatePlugin(dir, { strict: true })
  if (!report) errors.push(`claude plugin validate gave no report:\n    ${lastLines(raw)}`)
  else if (!report.success) {
    const parts = [report.manifest, ...(report.contents || [])].filter(Boolean)
    const problems = parts.flatMap(p => [...(p.errors || []), ...(p.warnings || [])]).map(p => (typeof p === 'string' ? p : p.message || JSON.stringify(p)))
    errors.push(`claude plugin validate --strict failed: ${problems.join('; ') || lastLines(raw)}`)
  } else notes.push(`claude plugin validate --strict passed (${claude.version})`)
  const hasTests = walkFiles(dir).some(f => /\.test\.tsx?$/.test(f.rel))
  if (hasTests) {
    const t = testPlugin(dir)
    if (t.status !== 0) errors.push(`claude plugin test failed:\n    ${lastLines(t.output)}`)
    else {
      const m = /(\d+) pass/.exec(t.output)
      notes.push(`claude plugin test passed${m ? ` (${m[1]} tests)` : ''}`)
    }
  } else warnings.push('the hosted mod has no *.test.ts / *.test.tsx for `claude plugin test`')
  return { errors, warnings, notes }
}

async function sourceChecks(entry) {
  const errors = []
  const notes = []
  const s = entry.source || {}
  const checkRepo = async (repo, ref, path) => {
    const info = await gh(`/repos/${repo}`, { allow404: true })
    if (!info) return errors.push(`GitHub repository ${repo} does not exist or is private`)
    const at = ref || info.default_branch
    const hooksPath = `${path ? `${path.replace(/\/$/, '')}/` : ''}hooks/hooks.json`
    const text = await fileAt(repo, hooksPath, at)
    if (text === null) return errors.push(`${repo}@${at} has no ${hooksPath}`)
    try {
      const hooks = JSON.parse(text)
      if (!Array.isArray(hooks.modules)) errors.push(`${repo}/${hooksPath} has no "modules" list, so it is not a mod`)
      else notes.push(`${repo}/${hooksPath} lists ${hooks.modules.join(', ')}`)
    } catch {
      errors.push(`${repo}/${hooksPath} is not valid JSON`)
    }
  }
  if (s.type === 'github') await checkRepo(s.repo, s.sha || s.ref, s.path)
  else if (s.type === 'git') {
    const repo = githubRepoOfUrl(s.url)
    if (repo) await checkRepo(repo, s.sha || s.ref, s.path)
    else notes.push('not a GitHub URL: the source is checked when the sync job clones it')
  } else if (s.type === 'marketplace') {
    const text = await rawFile(s.marketplace, 'HEAD', '.claude-plugin/marketplace.json')
    if (!text) errors.push(`${s.marketplace} has no .claude-plugin/marketplace.json`)
    else {
      try {
        const market = JSON.parse(text)
        const plugin = s.plugin || entry.name
        if (!(market.plugins || []).some(p => p?.name === plugin)) errors.push(`the marketplace ${s.marketplace} does not list "${plugin}"`)
        else notes.push(`listed in ${s.marketplace} as ${plugin}@${market.name}`)
      } catch {
        errors.push(`${s.marketplace}/.claude-plugin/marketplace.json is not valid JSON`)
      }
    }
  }
  return { errors, notes }
}

/** Runs every check. Returns { results: [{ name, errors, warnings, notes }], global }. */
export async function validateCatalog({ rootDir = root, changed = null, cli = true, network = true } = {}) {
  const global = { errors: [], warnings: [], notes: [] }
  const results = []
  const claude = cli ? findClaude() : null
  if (cli && !claude) global.warnings.push('the claude binary is not installed: `claude plugin validate` and `claude plugin test` were skipped')
  const canNetwork = network && Boolean(githubToken())
  const loaded = loadEntries(rootDir)
  const externals = loaded.filter(l => l.entry && l.entry.source?.type !== 'hosted' && (!changed || changed.has(l.name)))
  if (network && !canNetwork && externals.length) {
    global.warnings.push('GITHUB_TOKEN is not set: external sources were not looked up on GitHub')
  }

  const seenSources = new Map()
  for (const { name, entry, error } of loaded) {
    const r = { name, errors: [], warnings: [], notes: [] }
    results.push(r)
    if (error) {
      r.errors.push(error)
      continue
    }
    const structural = checkEntry(rootDir, name, entry)
    r.errors.push(...structural.errors)
    r.warnings.push(...structural.warnings)
    const files = checkFiles(rootDir, name)
    r.errors.push(...files.errors)
    r.warnings.push(...files.warnings)

    const s = entry.source || {}
    const key = s.type === 'github' ? `github:${s.repo.toLowerCase()}:${s.path || ''}` : s.type === 'git' ? `git:${s.url}:${s.path || ''}` : null
    if (key) {
      if (seenSources.has(key)) r.warnings.push(`same source as ${seenSources.get(key)}`)
      else seenSources.set(key, name)
    }

    const isChanged = !changed || changed.has(name)
    if (!isChanged || r.errors.length) continue
    if (s.type === 'hosted' && claude) {
      const c = cliChecks(rootDir, name, claude)
      r.errors.push(...c.errors)
      r.warnings.push(...c.warnings)
      r.notes.push(...c.notes)
    }
    if (s.type !== 'hosted' && canNetwork) {
      try {
        const c = await sourceChecks(entry)
        r.errors.push(...c.errors)
        r.notes.push(...c.notes)
      } catch (err) {
        r.warnings.push(`could not check the source on GitHub: ${err.message}`)
      }
    }
  }

  const marketplaceFile = join(rootDir, '.claude-plugin', 'marketplace.json')
  if (claude && !changed && existsSync(marketplaceFile)) {
    const { report, raw } = validatePlugin(marketplaceFile, { strict: true })
    if (report?.success) global.notes.push('.claude-plugin/marketplace.json passes claude plugin validate --strict')
    else global.errors.push(`.claude-plugin/marketplace.json fails claude plugin validate --strict:\n    ${lastLines(raw)}`)
  }
  return { results, global }
}

function summaryMarkdown({ results, global }, changed) {
  const lines = ['## Catalog check', '']
  if (changed) lines.push(`Changed entries: ${changed.size ? [...changed].map(n => `\`${n}\``).join(', ') : 'none'}`, '')
  lines.push('| Entry | Result | Details |', '| --- | --- | --- |')
  const cell = t => t.replace(/\|/g, '\\|').replace(/\r?\n\s*/g, ' ')
  for (const r of results) {
    const status = r.errors.length ? 'error' : r.warnings.length ? 'warning' : 'ok'
    const details = [...r.errors.map(e => `error: ${e}`), ...r.warnings.map(w => `warning: ${w}`), ...r.notes].map(cell).join('<br>')
    lines.push(`| \`${r.name}\` | ${status} | ${details || ''} |`)
  }
  for (const e of global.errors) lines.push('', `**Error:** ${cell(e)}`)
  for (const w of global.warnings) lines.push('', `Warning: ${cell(w)}`)
  return `${lines.join('\n')}\n`
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  let changed = null
  if (args.changed && args.changed !== 'true') {
    const files = changedFiles(root, args.changed)
    if (files) changed = new Set(files.map(modNameOf).filter(Boolean).filter(n => listModNames(root).includes(n)))
    else console.log(`! could not diff against ${args.changed}; checking every entry`)
  }
  const outcome = await validateCatalog({ changed, cli: args['no-cli'] !== 'true', network: args['no-network'] !== 'true' })
  let errors = outcome.global.errors.length
  let warnings = outcome.global.warnings.length
  for (const r of outcome.results) {
    errors += r.errors.length
    warnings += r.warnings.length
    console.log(`${r.errors.length ? '✗' : '✓'} ${r.name}`)
    for (const e of r.errors) console.log(`  - ${e}`)
    for (const w of r.warnings) console.log(`  ! ${w}`)
    for (const n of r.notes) console.log(`    ${n}`)
  }
  for (const e of outcome.global.errors) console.log(`✗ ${e}`)
  for (const w of outcome.global.warnings) console.log(`! ${w}`)
  for (const n of outcome.global.notes) console.log(`  ${n}`)
  console.log(`\n${outcome.results.length} entries${changed ? ` (${changed.size} changed)` : ''} · ${errors} errors · ${warnings} warnings`)
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summaryMarkdown(outcome, changed))
  process.exitCode = errors ? 1 : 0
}

if (isMain(import.meta.url)) await main()
