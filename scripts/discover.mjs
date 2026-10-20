// Finds mods on GitHub that the catalog does not list yet: repositories with the topics
// claude-code-mod, claude-code-mods or claude-mod whose tree has a hooks/hooks.json with a
// "modules" key. Reads repository data through the API as data only; runs nothing.
//   node scripts/discover.mjs [--limit 150] [--issue]
// Prints a Markdown checklist; with --issue it creates or updates ONE open issue
// "Mods found this week" (label `discovery`) in GITHUB_REPOSITORY. It never opens PRs.
import { gh, ghPaginate, rawFile } from './lib/github.mjs'
import { loadEntries, githubRepoOfUrl } from './lib/catalog.mjs'
import { mdEscape } from './lib/readme.mjs'
import { DISCOVERY_ISSUE_TITLE, REPO_SLUG, BOT_LOGINS } from './lib/constants.mjs'
import { isMain } from './lib/cli.mjs'
import { parseArgs } from './policy.mjs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
export const TOPICS = ['claude-code-mod', 'claude-code-mods', 'claude-mod']
const DISCOVERY_LABEL = 'discovery'

/** Plugin folders ("" for the repo root) that hold a hooks/hooks.json, from a git tree listing. */
export function modFoldersInTree(items = []) {
  return items
    .filter(i => i.type === 'blob' && (i.path === 'hooks/hooks.json' || i.path.endsWith('/hooks/hooks.json')))
    .filter(i => !i.path.split('/').includes('node_modules'))
    .map(i => i.path.slice(0, -'hooks/hooks.json'.length).replace(/\/$/, ''))
}

/** True when a hooks.json text declares a hooks module (what makes a plugin a mod). */
export function hasModules(text) {
  try {
    const json = JSON.parse(text)
    return Boolean(json && typeof json === 'object' && 'modules' in json)
  } catch {
    return false
  }
}

/** Keys of what the catalog already lists: "owner/repo:path" and "owner/repo:*" for whole repos. */
export function knownSources(entries) {
  const known = new Set([`${REPO_SLUG.toLowerCase()}:*`])
  for (const e of entries) {
    const s = e.source || {}
    if (s.type === 'github') known.add(`${s.repo.toLowerCase()}:${s.path || ''}`)
    if (s.type === 'git') {
      const repo = githubRepoOfUrl(s.url)
      if (repo) known.add(`${repo.toLowerCase()}:${s.path || ''}`)
    }
    if (s.type === 'marketplace') {
      known.add(`${s.marketplace.toLowerCase()}:*`)
      if (s.repo) known.add(`${s.repo.toLowerCase()}:${s.path || '*'}`)
    }
  }
  return known
}

export const isCatalogued = (candidate, known) =>
  known.has(`${candidate.repo.toLowerCase()}:*`) || known.has(`${candidate.repo.toLowerCase()}:${candidate.path}`)

const clip = (text, n) => (text.length > n ? `${text.slice(0, n - 1)}…` : text)

/** The checklist body. Repo descriptions are untrusted: escaped and clipped. */
export function renderChecklist(candidates, { date = new Date().toISOString().slice(0, 10), scanned = 0 } = {}) {
  const lines = [
    `Mods on GitHub that the catalog does not list yet (topics ${TOPICS.map(t => `\`${t}\``).join(', ')}; a \`hooks/hooks.json\` with \`modules\`). Scanned ${scanned} repositories on ${date}.`,
    '',
    'Tick one when you have opened a PR for it or decided to skip it. Nothing here was installed or run.',
    '',
  ]
  if (!candidates.length) lines.push('Nothing new this week.')
  for (const c of candidates) {
    const where = c.path ? ` · \`${c.path.replace(/`/g, '')}\`` : ''
    const stars = typeof c.stars === 'number' ? ` · ★${c.stars}` : ''
    const about = c.description ? ` — ${mdEscape(clip(c.description, 140))}` : ''
    lines.push(`- [ ] [${c.repo}](https://github.com/${c.repo}${c.path ? `/tree/HEAD/${c.path}` : ''})${where}${stars}${about}`)
  }
  return clip(lines.join('\n'), 60_000)
}

async function searchTopic(topic) {
  const items = await ghPaginate(`/search/repositories?q=${encodeURIComponent(`topic:${topic}`)}&sort=updated&order=desc`, { maxPages: 10 })
  return items
}

async function upsertIssue(repo, body) {
  const label = await gh(`/repos/${repo}/labels/${DISCOVERY_LABEL}`, { allow404: true })
  if (!label) {
    await gh(`/repos/${repo}/labels`, { method: 'POST', body: { name: DISCOVERY_LABEL, color: '6a9bcc', description: 'Mods found by the weekly discovery job' } }).catch(() => {})
  }
  const open = await ghPaginate(`/repos/${repo}/issues?state=open&labels=${DISCOVERY_LABEL}`, { maxPages: 3 })
  const mine = open.find(i => !i.pull_request && i.title === DISCOVERY_ISSUE_TITLE && BOT_LOGINS.includes(i.user?.login))
  if (mine) {
    await gh(`/repos/${repo}/issues/${mine.number}`, { method: 'PATCH', body: { body } })
    return mine.number
  }
  const created = await gh(`/repos/${repo}/issues`, { method: 'POST', body: { title: DISCOVERY_ISSUE_TITLE, body, labels: [DISCOVERY_LABEL] } })
  return created.number
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const limit = Math.max(1, Math.min(500, Number(args.limit) || 150))
  const repos = new Map()
  for (const topic of TOPICS) {
    try {
      for (const r of await searchTopic(topic)) if (!r.fork && !r.archived) repos.set(r.full_name, r)
    } catch (err) {
      console.error(`! topic ${topic}: ${err.message}`)
    }
  }
  const known = knownSources(loadEntries(root).filter(e => e.entry).map(e => e.entry))
  const sorted = [...repos.values()].sort((a, b) => (a.pushed_at < b.pushed_at ? 1 : -1)).slice(0, limit)
  const candidates = []
  for (const r of sorted) {
    if (known.has(`${r.full_name.toLowerCase()}:*`)) continue
    try {
      const tree = await gh(`/repos/${r.full_name}/git/trees/${encodeURIComponent(r.default_branch)}?recursive=1`, { allow404: true })
      for (const path of modFoldersInTree(tree?.tree).slice(0, 20)) {
        const candidate = { repo: r.full_name, path, stars: r.stargazers_count, description: r.description || '' }
        if (isCatalogued(candidate, known)) continue
        const text = await rawFile(r.full_name, r.default_branch, `${path ? `${path}/` : ''}hooks/hooks.json`)
        if (text && hasModules(text)) candidates.push(candidate)
      }
    } catch (err) {
      console.error(`! ${r.full_name}: ${err.message}`)
    }
  }
  const body = renderChecklist(candidates, { scanned: sorted.length })
  console.log(body)
  if (args.issue === 'true') {
    const repo = process.env.GITHUB_REPOSITORY || REPO_SLUG
    const number = await upsertIssue(repo, body)
    console.error(`issue #${number} updated with ${candidates.length} candidates`)
  }
}

if (isMain(import.meta.url)) {
  main().catch(err => {
    console.error(`discover: ${err.message}`)
    process.exit(1)
  })
}
