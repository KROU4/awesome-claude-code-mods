// The automerge decision. `decide()` is pure; the CLI gathers its inputs through the GitHub REST
// API as data only (nothing from the PR is checked out or executed here), and every input is read
// at an immutable commit: the changed files come from `compare/<main sha>...<head sha>` (the same
// merge-base diff a squash merge applies), sizes and modes from the tree of <head sha>, and mod.json
// from <main sha> and <head sha>. The merge step then merges exactly <head sha>
// (`gh pr merge --match-head-commit`), so the bot never decides on one commit and merges another.
//
// CLI (run by .github/workflows/automerge.yml from the trusted base branch):
//   node scripts/policy.mjs (--pr <n> | --pr-meta <pr.json>) --head-sha <sha>
//     --validate-conclusion <conclusion> [--head-repo <owner/repo>] [--head-branch <branch>]
//     [--repo owner/repo] [--out decision.json]
// Prints the decision as JSON and writes `allowed`/`pr` to $GITHUB_OUTPUT when set.
import { readFileSync, writeFileSync, appendFileSync } from 'node:fs'
import { join, dirname, posix } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  ALLOWED_EXTENSIONS, MAX_FILE_BYTES, MAX_PR_FILES, HOLD_LABEL, BOT_LOGINS, BRANCH, REPO_SLUG,
} from './lib/constants.mjs'
import { gh, fileAt } from './lib/github.mjs'
import { isMain } from './lib/cli.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

const NAME = '[a-z0-9](?:[a-z0-9-]{0,48}[a-z0-9])?'
const MOD_FILE = new RegExp(`^mods/(${NAME})/(.+)$`)
const ALLOWED_STATUSES = ['added', 'modified', 'renamed', 'removed']
/** Git modes of a regular file (100644) and an executable one (100755). */
const REGULAR_MODES = ['100644', '100755']
/** `compare` lists at most this many files; a list that long may be cut. */
export const COMPARE_FILE_LIMIT = 300

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

/**
 * Untrusted text (file names, logins, branch names) as one inline code span: backticks and line
 * breaks become "?", so the text cannot leave the span and add mentions, links or new lines.
 */
export const code = s => '`' + String(s).replace(/[`\r\n]/g, '?').slice(0, 200) + '`'

const list = (items, max = 8) => {
  const shown = items.slice(0, max).map(code).join(', ')
  return items.length > max ? `${shown} and ${items.length - max} more` : shown
}
const listRu = (items, max = 8) => {
  const shown = items.slice(0, max).map(code).join(', ')
  return items.length > max ? `${shown} и ещё ${items.length - max}` : shown
}

const reason = (code, en, ru) => ({ code, en, ru })

/**
 * The automerge decision.
 * - prFiles: [{ filename, status, previous_filename?, size?, mode? }] (size/mode of the head blob)
 * - filesTruncated: the file list may be cut (compare lists at most 300 files)
 * - treeUnreadable: the head tree could not be read in full, so sizes and modes may be missing
 * - author / authorId: the PR author's login and numeric GitHub id
 * - maintainerIds: { "<login lower case>": <id> } from data/maintainers.json on main
 * - baseEntries / headEntries: { "<name>": mod.json object | null } for every name the PR touches
 *   (base = main, head = the PR head commit)
 * - baseErrors: { "<name>": message } for base mod.json files that could not be read as an object
 * - baseOrphans: { "<name>": true } for folders on main that have no mod.json
 * - headErrors: { "<name>": message } for head mod.json files that are not a JSON object
 * - isDraft, labels (names), baseRef, state ("open"), validateConclusion, headShaMatches, headRepoGone
 * Returns { allowed, reasons: [{ code, en, ru }], names }.
 */
export function decide({
  prFiles = [],
  filesTruncated = false,
  treeUnreadable = false,
  author = '',
  authorId,
  maintainerIds = {},
  baseEntries = {},
  baseErrors = {},
  baseOrphans = {},
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
      `The Validate check did not pass (${code(validateConclusion)}). Fix what its log reports and push again.`,
      `Проверка Validate не прошла (${code(validateConclusion)}). Исправьте то, что написано в её журнале, и отправьте коммит ещё раз.`))
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
  const knownId = maintainerIds[String(author).toLowerCase()]
  if (knownId !== undefined && knownId !== authorId) {
    reasons.push(reason('maintainer-id-mismatch',
      `The login ${code(author)} belonged to another GitHub account (id ${code(knownId)}) when the catalog first saw it; a catalog maintainer needs to confirm who you are.`,
      `Логин ${code(author)} принадлежал другому аккаунту GitHub (id ${code(knownId)}), когда каталог увидел его впервые; кто вы, подтвердит мейнтейнер каталога.`))
  }
  if (isDraft) reasons.push(reason('draft', 'The pull request is a draft.', 'Запрос в статусе черновика.'))
  if (labels.map(l => String(l).toLowerCase()).includes(HOLD_LABEL)) {
    reasons.push(reason('hold', `It has the \`${HOLD_LABEL}\` label.`, `На запросе стоит метка \`${HOLD_LABEL}\`.`))
  }
  if (baseRef !== BRANCH) {
    reasons.push(reason('wrong-base', `It targets ${code(baseRef)}, not \`${BRANCH}\`.`, `Запрос направлен в ${code(baseRef)}, а не в \`${BRANCH}\`.`))
  }
  if (headRepoGone) {
    reasons.push(reason('head-repo-gone', 'The fork with the changes no longer exists.', 'Форк с изменениями удалён.'))
  }

  if (!prFiles.length) reasons.push(reason('no-files', 'The pull request changes no files.', 'Запрос не меняет ни одного файла.'))
  if (prFiles.length > MAX_PR_FILES || filesTruncated) {
    const count = filesTruncated ? `${prFiles.length} or more` : String(prFiles.length)
    const countRu = filesTruncated ? `${prFiles.length} и больше` : String(prFiles.length)
    reasons.push(reason('too-many-files',
      `It changes ${count} files; the bot merges at most ${MAX_PR_FILES}.`,
      `Запрос меняет ${countRu} файлов, а бот сливает не больше ${MAX_PR_FILES}.`))
  }
  if (treeUnreadable) {
    reasons.push(reason('tree-unreadable',
      'The bot could not read the whole file tree of the head commit, so it cannot check file sizes and types.',
      'Бот не смог прочитать всё дерево файлов коммита запроса и не может проверить размеры и типы файлов.'))
  }

  const outside = []
  const badStatus = []
  const badType = []
  const tooBig = []
  const links = []
  const unknown = []
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
    // Fail closed: a file whose size or type the bot does not know is not merged.
    if (f.mode === '120000' || f.mode === '160000') links.push(f.filename)
    else if (typeof f.size !== 'number' || !REGULAR_MODES.includes(f.mode)) unknown.push(f.filename)
    else if (f.size > MAX_FILE_BYTES) tooBig.push(f.filename)
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
  if (unknown.length) {
    reasons.push(reason('unknown-blob',
      `The bot could not tell the size or type of: ${list(unknown)}. A maintainer needs to check them.`,
      `Бот не смог определить размер или тип файлов: ${listRu(unknown)}. Их проверит мейнтейнер.`))
  }

  for (const name of [...names].sort()) {
    const base = baseEntries[name] ?? null
    const head = headEntries[name] ?? null
    if (baseErrors[name] || baseOrphans[name]) {
      reasons.push(reason('base-entry-unreadable',
        `\`mods/${name}/\` on \`${BRANCH}\` has no readable \`mod.json\`, so the bot cannot tell who maintains it.`,
        `У \`mods/${name}/\` в \`${BRANCH}\` нет читаемого \`mod.json\`, поэтому бот не может определить её мейнтейнеров.`))
      continue
    }
    if (headErrors[name]) {
      reasons.push(reason('invalid-entry', `\`mods/${name}/mod.json\` is not a valid JSON object.`, `\`mods/${name}/mod.json\` не является корректным JSON-объектом.`))
      continue
    }
    if (base) {
      if (!isMaintainer(base, author)) {
        const who = Array.isArray(base.maintainers) && base.maintainers.length ? list(base.maintainers.map(String)) : 'its maintainers'
        const whoRu = Array.isArray(base.maintainers) && base.maintainers.length ? listRu(base.maintainers.map(String)) : 'мейнтейнеры записи'
        reasons.push(reason('not-maintainer',
          `${code(author)} is not a maintainer of \`${name}\` (${who}); a maintainer of the entry or of the catalog needs to approve.`,
          `${code(author)} не мейнтейнер \`${name}\` (${whoRu}); нужно одобрение мейнтейнера записи или каталога.`))
      }
      if (base.verified === true) {
        reasons.push(reason('verified-entry',
          `\`${name}\` is verified: any change to it needs a catalog maintainer to read the code again.`,
          `\`${name}\` отмечена verified: любое изменение такой записи проверяет мейнтейнер каталога.`))
      } else if (head && base.verified !== head.verified) {
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
          `The new entry \`${name}\` must list ${code(author)} in \`maintainers\`.`,
          `Новая запись \`${name}\` должна содержать ${code(author)} в \`maintainers\`.`))
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
      const value = argv[i + 1] !== undefined && !argv[i + 1].startsWith('--') ? argv[++i] : 'true'
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

/**
 * True when the PR is the one the Validate run checked: same head commit and, when the run's
 * head repository and branch are given, the same ones.
 */
export function confirmedHead(pr, headSha, { headRepo, headBranch } = {}) {
  if (!pr || pr.head?.sha !== headSha) return false
  if (headRepo !== undefined && (pr.head?.repo?.full_name || '') !== headRepo) return false
  if (headBranch !== undefined && (pr.head?.ref || '') !== headBranch) return false
  return true
}

/** { "<login lower case>": <id> } from a parsed data/maintainers.json; anything else is dropped. */
export function maintainerIdsFrom(json) {
  const out = {}
  if (!json || typeof json !== 'object' || Array.isArray(json)) return out
  for (const [login, id] of Object.entries(json)) if (Number.isInteger(id)) out[login.toLowerCase()] = id
  return out
}

const isObject = v => Boolean(v) && typeof v === 'object' && !Array.isArray(v)

async function readEntry(repo, name, ref) {
  const text = await fileAt(repo, `mods/${name}/mod.json`, ref)
  if (text === null) return { entry: null }
  let entry
  try {
    entry = JSON.parse(text)
  } catch {
    return { entry: null, error: 'not valid JSON' }
  }
  return isObject(entry) ? { entry } : { entry: null, error: 'not a JSON object' }
}

/**
 * Reads everything decide() needs for PR `pr` (the object from GET /pulls/{n}) at the commit
 * `headSha` and returns the decision. Every read names a commit SHA, never a branch or the PR.
 */
export async function gather({ repo, pr, headSha, validateConclusion, confirmed = true, maintainerIds = {} }) {
  const mainSha = (await gh(`/repos/${repo}/git/ref/heads/${BRANCH}`))?.object?.sha
  if (!/^[0-9a-f]{40}$/.test(mainSha || '')) throw new Error(`could not read the ${BRANCH} branch`)
  // The merge-base diff of main...head: the same change a squash merge of headSha applies.
  const cmp = await gh(`/repos/${repo}/compare/${mainSha}...${headSha}`)
  const files = Array.isArray(cmp?.files) ? cmp.files : []
  // The PR's commits are reachable in the base repository (refs/pull/<n>/head), so the head tree
  // and mod.json are read there, by SHA, not from the fork.
  const tree = await gh(`/repos/${repo}/git/trees/${headSha}?recursive=1`, { allow404: true })
  const blobs = new Map()
  for (const item of tree?.tree || []) blobs.set(item.path, { size: item.size, mode: item.mode })
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
  const baseErrors = {}
  const baseOrphans = {}
  const headEntries = {}
  const headErrors = {}
  for (const name of [...names].sort()) {
    const base = await readEntry(repo, name, mainSha)
    baseEntries[name] = base.entry
    if (base.error) baseErrors[name] = base.error
    if (!base.entry && !base.error) {
      const dir = await gh(`/repos/${repo}/contents/mods/${name}?ref=${mainSha}`, { allow404: true })
      if (dir) baseOrphans[name] = true
    }
    const head = await readEntry(repo, name, headSha)
    headEntries[name] = head.entry
    if (head.error) headErrors[name] = head.error
  }
  const decision = decide({
    prFiles,
    filesTruncated: files.length >= COMPARE_FILE_LIMIT,
    treeUnreadable: !tree || tree.truncated === true,
    author: pr.user?.login || '',
    authorId: pr.user?.id,
    maintainerIds,
    baseEntries,
    baseErrors,
    baseOrphans,
    headEntries,
    headErrors,
    isDraft: Boolean(pr.draft),
    labels: (pr.labels || []).map(l => l.name),
    baseRef: pr.base?.ref,
    state: pr.state,
    validateConclusion,
    headShaMatches: confirmed,
    headRepoGone: !pr.head?.repo?.full_name,
  })
  return { ...decision, pr: pr.number, headSha, mainSha, author: pr.user?.login || '', validateConclusion, confirmed }
}

/** An error message as plain one-line text for the bot comment. */
const plain = text => String(text).replace(/[`\r\n]/g, ' ').slice(0, 300)

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
  let maintainerIds = {}
  try {
    maintainerIds = maintainerIdsFrom(JSON.parse(readFileSync(join(root, 'data', 'maintainers.json'), 'utf8')))
  } catch {
    maintainerIds = {}
  }

  let confirmed = false
  let result
  try {
    const pr = await gh(`/repos/${repo}/pulls/${number}`)
    confirmed = confirmedHead(pr, headSha, { headRepo: args['head-repo'], headBranch: args['head-branch'] })
    result = await gather({ repo, pr, headSha, validateConclusion, confirmed, maintainerIds })
    if (metaSha && metaSha !== headSha) {
      result.allowed = false
      result.reasons.push(reason('stale-head', 'The check ran for another commit.', 'Проверка запускалась для другого коммита.'))
    }
  } catch (err) {
    result = {
      allowed: false,
      reasons: [reason('bot-error', `The bot could not read the pull request: ${plain(err.message)}`, `Бот не смог прочитать запрос: ${plain(err.message)}`)],
      names: [],
      pr: number,
      headSha,
      author: '',
      validateConclusion,
      confirmed,
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
