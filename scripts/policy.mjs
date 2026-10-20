// The automerge decision. `decide()` is pure; the CLI gathers its inputs through the GitHub REST
// API (PR, its files, the head tree, mod.json at the base branch and at the head commit) as data
// only: nothing from the PR is checked out or executed here.
//
// CLI (run by .github/workflows/automerge.yml from the trusted base branch):
//   node scripts/policy.mjs (--pr <n> | --pr-meta <pr.json>) --head-sha <sha>
//     --validate-conclusion <conclusion> [--repo owner/repo] [--out decision.json]
// Prints the decision as JSON and writes `allowed`/`pr` to $GITHUB_OUTPUT when set.
import { readFileSync, writeFileSync, appendFileSync } from 'node:fs'
import { posix } from 'node:path'
import {
  ALLOWED_EXTENSIONS, MAX_FILE_BYTES, MAX_PR_FILES, HOLD_LABEL, BOT_LOGINS, BRANCH, REPO_SLUG,
} from './lib/constants.mjs'
import { gh, ghPaginate, fileAt } from './lib/github.mjs'
import { isMain } from './lib/cli.mjs'

const NAME = '[a-z0-9](?:[a-z0-9-]{0,48}[a-z0-9])?'
const MOD_FILE = new RegExp(`^mods/(${NAME})/(.+)$`)
const ALLOWED_STATUSES = ['added', 'modified', 'renamed', 'removed']

/** "mods/<name>/<rest>" -> "<name>", anything else -> null. */
export function modNameOf(path) {
  const m = MOD_FILE.exec(path || '')
  if (!m) return null
  if (m[2].split('/').some(seg => seg === '' || seg === '.' || seg === '..')) return null
  return m[1]
}

/** Allowed file types under mods/<name>/: the listed extensions and a bare LICENSE. */
export function extensionAllowed(path) {
  const base = posix.basename(path)
  if (base === 'LICENSE') return true
  const dot = base.lastIndexOf('.')
  if (dot < 0) return false
  return ALLOWED_EXTENSIONS.includes(base.slice(dot + 1).toLowerCase())
}

const isMaintainer = (entry, login) =>
  Array.isArray(entry?.maintainers) && entry.maintainers.some(m => String(m).toLowerCase() === String(login).toLowerCase())

const list = (items, max = 8) => {
  const shown = items.slice(0, max).map(i => `\`${i}\``).join(', ')
  return items.length > max ? `${shown} and ${items.length - max} more` : shown
}
const listRu = (items, max = 8) => {
  const shown = items.slice(0, max).map(i => `\`${i}\``).join(', ')
  return items.length > max ? `${shown} и ещё ${items.length - max}` : shown
}

const reason = (code, en, ru) => ({ code, en, ru })

/**
 * The automerge decision.
 * - prFiles: [{ filename, status, previous_filename?, size?, mode? }] (size/mode of the head blob)
 * - author: the PR author's login
 * - baseEntries / headEntries: { "<name>": mod.json object | null } for every name the PR touches
 *   (base = the current base branch, head = the PR head commit)
 * - headErrors: { "<name>": message } for head mod.json files that are not valid JSON
 * - isDraft, labels (names), baseRef, state ("open"), validateConclusion, headShaMatches, headRepoGone
 * Returns { allowed, reasons: [{ code, en, ru }], names }.
 */
export function decide({
  prFiles = [],
  author = '',
  baseEntries = {},
  headEntries = {},
  headErrors = {},
  isDraft = false,
  labels = [],
  baseRef = BRANCH,
  state = 'open',
  validateConclusion = 'success',
  headShaMatches = true,
  headRepoGone = false,
}) {
  const reasons = []
  if (validateConclusion !== 'success') {
    reasons.push(reason('validate-failed',
      `The Validate check did not pass (${validateConclusion}). Fix what its log reports and push again.`,
      `Проверка Validate не прошла (${validateConclusion}). Исправьте то, что написано в её журнале, и отправьте коммит ещё раз.`))
  }
  if (!headShaMatches) {
    reasons.push(reason('stale-head',
      'The pull request has new commits since this check ran; the next check decides.',
      'После этой проверки в запрос добавились коммиты; решение примет следующая проверка.'))
  }
  if (state !== 'open') reasons.push(reason('not-open', 'The pull request is not open.', 'Запрос закрыт.'))
  if (BOT_LOGINS.includes(author)) {
    reasons.push(reason('bot-author', 'The bot does not merge its own pull requests.', 'Бот не сливает свои собственные запросы.'))
  }
  if (isDraft) reasons.push(reason('draft', 'The pull request is a draft.', 'Запрос в статусе черновика.'))
  if (labels.map(l => String(l).toLowerCase()).includes(HOLD_LABEL)) {
    reasons.push(reason('hold', `It has the \`${HOLD_LABEL}\` label.`, `На запросе стоит метка \`${HOLD_LABEL}\`.`))
  }
  if (baseRef !== BRANCH) {
    reasons.push(reason('wrong-base', `It targets \`${baseRef}\`, not \`${BRANCH}\`.`, `Запрос направлен в \`${baseRef}\`, а не в \`${BRANCH}\`.`))
  }
  if (headRepoGone) {
    reasons.push(reason('head-repo-gone', 'The fork with the changes no longer exists.', 'Форк с изменениями удалён.'))
  }

  if (!prFiles.length) reasons.push(reason('no-files', 'The pull request changes no files.', 'Запрос не меняет ни одного файла.'))
  if (prFiles.length > MAX_PR_FILES) {
    reasons.push(reason('too-many-files',
      `It changes ${prFiles.length} files; the bot merges at most ${MAX_PR_FILES}.`,
      `Запрос меняет ${prFiles.length} файлов, а бот сливает не больше ${MAX_PR_FILES}.`))
  }

  const outside = []
  const badStatus = []
  const badType = []
  const tooBig = []
  const links = []
  const names = new Set()
  for (const f of prFiles) {
    const paths = [f.filename, ...(f.status === 'renamed' && f.previous_filename ? [f.previous_filename] : [])]
    for (const p of paths) {
      const name = modNameOf(p)
      if (name) names.add(name)
      else outside.push(p)
    }
    if (!ALLOWED_STATUSES.includes(f.status)) badStatus.push(`${f.filename} (${f.status})`)
    if (f.status === 'removed') continue
    if (!extensionAllowed(f.filename)) badType.push(f.filename)
    if (typeof f.size === 'number' && f.size > MAX_FILE_BYTES) tooBig.push(f.filename)
    if (f.mode === '120000' || f.mode === '160000') links.push(f.filename)
  }
  if (outside.length) {
    reasons.push(reason('outside-mods',
      `It changes files outside \`mods/<name>/\`: ${list(outside)}. Those need a maintainer.`,
      `Запрос меняет файлы вне \`mods/<имя>/\`: ${listRu(outside)}. Такие изменения проверяет мейнтейнер.`))
  }
  if (badStatus.length) {
    reasons.push(reason('bad-status',
      `Only added, modified, renamed or removed files are merged automatically: ${list(badStatus)}.`,
      `Автоматически сливаются только добавленные, изменённые, переименованные или удалённые файлы: ${listRu(badStatus)}.`))
  }
  if (badType.length) {
    reasons.push(reason('bad-extension',
      `File types the bot does not merge: ${list(badType)}. Allowed: ${ALLOWED_EXTENSIONS.join(', ')} and LICENSE.`,
      `Типы файлов, которые бот не сливает: ${listRu(badType)}. Разрешены: ${ALLOWED_EXTENSIONS.join(', ')} и LICENSE.`))
  }
  if (tooBig.length) {
    reasons.push(reason('too-big', `Files over 2 MB: ${list(tooBig)}.`, `Файлы больше 2 МБ: ${listRu(tooBig)}.`))
  }
  if (links.length) {
    reasons.push(reason('symlink',
      `Symbolic links and submodules are not merged automatically: ${list(links)}.`,
      `Символические ссылки и подмодули автоматически не сливаются: ${listRu(links)}.`))
  }

  for (const name of [...names].sort()) {
    const base = baseEntries[name] ?? null
    const head = headEntries[name] ?? null
    if (headErrors[name]) {
      reasons.push(reason('invalid-entry', `\`mods/${name}/mod.json\` is not valid JSON.`, `\`mods/${name}/mod.json\` содержит некорректный JSON.`))
      continue
    }
    if (base) {
      if (!isMaintainer(base, author)) {
        const who = (base.maintainers || []).map(m => '`' + m + '`').join(', ') || 'its maintainers'
        reasons.push(reason('not-maintainer',
          `\`${author}\` is not a maintainer of \`${name}\` (${who}); a maintainer of the entry or of the catalog needs to approve.`,
          `\`${author}\` не мейнтейнер \`${name}\` (${who}); нужно одобрение мейнтейнера записи или каталога.`))
      }
      if (head && base.verified !== head.verified) {
        reasons.push(reason('verified-changed',
          `\`${name}\` changes the \`verified\` field, which only catalog maintainers set.`,
          `\`${name}\` меняет поле \`verified\`; его ставят только мейнтейнеры каталога.`))
      }
    } else if (!head) {
      reasons.push(reason('missing-entry',
        `\`mods/${name}/\` has no \`mod.json\`.`,
        `В \`mods/${name}/\` нет \`mod.json\`.`))
    } else {
      if (!isMaintainer(head, author)) {
        reasons.push(reason('not-in-new-maintainers',
          `The new entry \`${name}\` must list \`${author}\` in \`maintainers\`.`,
          `Новая запись \`${name}\` должна содержать \`${author}\` в \`maintainers\`.`))
      }
      if (head.verified !== undefined) {
        reasons.push(reason('verified-changed',
          `The new entry \`${name}\` sets \`verified\`, which only catalog maintainers set.`,
          `Новая запись \`${name}\` задаёт поле \`verified\`; его ставят только мейнтейнеры каталога.`))
      }
    }
  }
  return { allowed: reasons.length === 0, reasons, names: [...names].sort() }
}

// ---------------------------------------------------------------- CLI

const CONCLUSIONS = ['success', 'failure', 'cancelled', 'skipped', 'timed_out', 'action_required', 'neutral', 'stale', 'startup_failure']

export function parseArgs(argv) {
  const args = {}
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a.startsWith('--')) {
      const key = a.slice(2)
      const value = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : 'true'
      args[key] = value
    }
  }
  return args
}

/** A PR number from untrusted input: a positive integer or null. */
export function parsePrNumber(value) {
  const text = typeof value === 'number' ? String(value) : typeof value === 'string' ? value.trim() : ''
  if (!/^[1-9][0-9]{0,8}$/.test(text)) return null
  return Number(text)
}

async function readEntry(repo, name, ref) {
  const text = await fileAt(repo, `mods/${name}/mod.json`, ref)
  if (text === null) return { entry: null }
  try {
    return { entry: JSON.parse(text) }
  } catch {
    return { entry: null, error: 'not valid JSON' }
  }
}

async function gather({ repo, pr: number, headSha, validateConclusion }) {
  const pr = await gh(`/repos/${repo}/pulls/${number}`)
  const headRepo = pr.head?.repo?.full_name || null
  const files = await ghPaginate(`/repos/${repo}/pulls/${number}/files`, { maxPages: 30 })
  const blobs = new Map()
  if (headRepo) {
    const tree = await gh(`/repos/${headRepo}/git/trees/${headSha}?recursive=1`, { allow404: true })
    for (const item of tree?.tree || []) blobs.set(item.path, { size: item.size, mode: item.mode })
    if (!tree || tree.truncated) {
      for (const f of files.slice(0, MAX_PR_FILES + 1)) {
        if (f.status === 'removed' || blobs.has(f.filename)) continue
        const meta = await gh(`/repos/${headRepo}/contents/${f.filename.split('/').map(encodeURIComponent).join('/')}?ref=${headSha}`, { allow404: true })
        if (meta && !Array.isArray(meta)) {
          blobs.set(f.filename, { size: meta.size, mode: meta.type === 'symlink' ? '120000' : meta.type === 'submodule' ? '160000' : '100644' })
        }
      }
    }
  }
  const prFiles = files.map(f => ({
    filename: f.filename,
    status: f.status,
    previous_filename: f.previous_filename,
    size: blobs.get(f.filename)?.size,
    mode: blobs.get(f.filename)?.mode,
  }))
  const names = new Set()
  for (const f of prFiles) {
    for (const p of [f.filename, f.previous_filename]) {
      const name = modNameOf(p)
      if (name) names.add(name)
    }
  }
  const baseEntries = {}
  const headEntries = {}
  const headErrors = {}
  for (const name of names) {
    baseEntries[name] = (await readEntry(repo, name, pr.base.ref)).entry
    if (headRepo) {
      const head = await readEntry(headRepo, name, headSha)
      headEntries[name] = head.entry
      if (head.error) headErrors[name] = head.error
    }
  }
  const decision = decide({
    prFiles,
    author: pr.user?.login || '',
    baseEntries,
    headEntries,
    headErrors,
    isDraft: Boolean(pr.draft),
    labels: (pr.labels || []).map(l => l.name),
    baseRef: pr.base?.ref,
    state: pr.state,
    validateConclusion,
    headShaMatches: pr.head?.sha === headSha,
    headRepoGone: !headRepo,
  })
  return { ...decision, pr: number, headSha, author: pr.user?.login || '', validateConclusion }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const repo = args.repo || process.env.GITHUB_REPOSITORY || REPO_SLUG
  if (!/^[A-Za-z0-9-]{1,39}\/[A-Za-z0-9._-]{1,100}$/.test(repo)) throw new Error('bad --repo')
  let number = parsePrNumber(args.pr)
  let metaSha = null
  if (args['pr-meta']) {
    let meta = null
    try {
      meta = JSON.parse(readFileSync(args['pr-meta'], 'utf8'))
    } catch {
      meta = null
    }
    number = parsePrNumber(meta?.number)
    metaSha = typeof meta?.head_sha === 'string' ? meta.head_sha : null
  }
  if (!number) throw new Error('no valid pull request number (expected a positive integer)')
  const headSha = String(args['head-sha'] || '')
  if (!/^[0-9a-f]{40}$/.test(headSha)) throw new Error('--head-sha must be a full commit SHA')
  const validateConclusion = CONCLUSIONS.includes(args['validate-conclusion']) ? args['validate-conclusion'] : 'failure'

  let result
  try {
    result = await gather({ repo, pr: number, headSha, validateConclusion })
    if (metaSha && metaSha !== headSha) {
      result.allowed = false
      result.reasons.push(reason('stale-head', 'The check ran for another commit.', 'Проверка запускалась для другого коммита.'))
    }
  } catch (err) {
    result = {
      allowed: false,
      reasons: [reason('bot-error', `The bot could not read the pull request: ${err.message}`, `Бот не смог прочитать запрос: ${err.message}`)],
      names: [],
      pr: number,
      headSha,
      author: '',
      validateConclusion,
    }
  }
  const json = JSON.stringify(result, null, 2)
  if (args.out) writeFileSync(args.out, `${json}\n`)
  console.log(json)
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, `allowed=${result.allowed}\npr=${number}\n`)
  }
}

if (isMain(import.meta.url)) {
  main().catch(err => {
    console.error(`policy: ${err.message}`)
    process.exit(1)
  })
}
