// GitHub facts for the catalog → data/github.json:
//   { "<owner/repo>": { stars, pushedAt?, marketplaceName? } }
// for each github/git source repo, each `marketplace` source repo (plus the name in its
// marketplace.json, so install ids read `<plugin>@<their marketplace>`) and the catalog repo itself
// (stars only: its pushedAt moves with every sync and would loop the sync job).
// Uses GITHUB_TOKEN when set. Failures keep the previous values.
//
// Also data/maintainers.json: { "<login lower case>": <numeric GitHub user id> } for every login in
// any entry's `maintainers`, looked up the first time the catalog sees the login and never
// overwritten afterwards. The automerge policy compares the PR author's id with it, so a login that
// was renamed away and registered again by someone else does not inherit the entries.
import { writeFileSync, existsSync, readFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadEntries, githubRepoOf, readJsonIfExists, marketplaceNameAllowed } from './lib/catalog.mjs'
import { gh, rawFile } from './lib/github.mjs'
import { REPO_SLUG } from './lib/constants.mjs'
import { isMain } from './lib/cli.mjs'
import { toJson } from './lib/registry.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

/** Repos to look up: { repo: { marketplace: boolean } }. */
export function reposToEnrich(entries) {
  const repos = new Map([[REPO_SLUG, { marketplace: false }]])
  for (const entry of entries) {
    const repo = githubRepoOf(entry)
    if (repo && !repos.has(repo)) repos.set(repo, { marketplace: false })
    if (entry.source?.type === 'marketplace') repos.set(entry.source.marketplace, { marketplace: true })
  }
  return repos
}

/** Sorted-keys object so the file diff stays small. */
export const sortKeys = obj => Object.fromEntries(Object.keys(obj).sort().map(k => [k, obj[k]]))

const LOGIN = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/

/** Every maintainer login of the catalog, lower case, sorted, valid GitHub logins only. */
export function maintainerLogins(entries) {
  const logins = new Set()
  for (const entry of entries) {
    for (const m of Array.isArray(entry?.maintainers) ? entry.maintainers : []) {
      if (typeof m === 'string' && LOGIN.test(m)) logins.add(m.toLowerCase())
    }
  }
  return [...logins].sort()
}

/**
 * The next data/maintainers.json: `previous` plus ids for logins it lacks. `lookup(login)` resolves
 * a login to { login, id } or null. Existing ids are never replaced or dropped.
 */
export async function nextMaintainerIds(previous, logins, lookup) {
  const next = {}
  for (const [login, id] of Object.entries(previous || {})) if (Number.isInteger(id)) next[login.toLowerCase()] = id
  let failures = 0
  for (const login of logins) {
    if (login in next) continue
    try {
      const user = await lookup(login)
      if (user && Number.isInteger(user.id) && String(user.login).toLowerCase() === login) next[login] = user.id
    } catch (err) {
      failures++
      console.log(`! user ${login}: ${err.message}`)
    }
  }
  return { ids: sortKeys(next), failures }
}

async function enrichMaintainers(entries) {
  const file = join(root, 'data', 'maintainers.json')
  const previous = readJsonIfExists(file, {})
  const { ids, failures } = await nextMaintainerIds(previous, maintainerLogins(entries), login => gh(`/users/${login}`, { allow404: true }))
  const text = toJson(ids)
  const before = existsSync(file) ? readFileSync(file, 'utf8') : null
  if (before !== text) writeFileSync(file, text)
  console.log(`${Object.keys(ids).length} maintainer ids${failures ? `, ${failures} lookups failed` : ''}${before === text ? ', nothing changed' : ', data/maintainers.json updated'}`)
}

async function main() {
  const file = join(root, 'data', 'github.json')
  const previous = readJsonIfExists(file, {})
  const entries = loadEntries(root).filter(e => e.entry).map(e => e.entry)
  const next = {}
  let failures = 0
  for (const [repo, { marketplace }] of reposToEnrich(entries)) {
    const old = previous[repo] || {}
    const row = { ...old }
    try {
      const info = await gh(`/repos/${repo}`)
      row.stars = info.stargazers_count
      if (repo !== REPO_SLUG && info.pushed_at) row.pushedAt = info.pushed_at
      if (repo === REPO_SLUG) delete row.pushedAt
    } catch (err) {
      failures++
      console.log(`! ${repo}: ${err.message}; keeping previous values`)
    }
    if (marketplace) {
      try {
        const text = await rawFile(repo, 'HEAD', '.claude-plugin/marketplace.json')
        const name = text ? JSON.parse(text).name : null
        // A reserved or official-looking name (this catalog's own included) is not recorded, so
        // install ids stay `<plugin>` and the site installs with an explicit --marketplace.
        if (marketplaceNameAllowed(name, repo)) row.marketplaceName = name
        else {
          if (name !== null && name !== undefined) console.log(`! ${repo}: marketplace name ${JSON.stringify(String(name)).slice(0, 80)} is not used (reserved or not a plain name)`)
          if (text) delete row.marketplaceName
        }
      } catch (err) {
        console.log(`! ${repo}: marketplace.json unreadable (${err.message})`)
      }
    }
    if (Object.keys(row).length) next[repo] = sortKeys(row)
  }
  const text = toJson(sortKeys(next))
  const before = existsSync(file) ? readFileSync(file, 'utf8') : null
  if (before !== text) {
    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(file, text)
  }
  console.log(`${Object.keys(next).length} repos${failures ? `, ${failures} lookups failed` : ''}${before === text ? ', nothing changed' : ', data/github.json updated'}`)
  await enrichMaintainers(entries)
}

if (isMain(import.meta.url)) await main()
