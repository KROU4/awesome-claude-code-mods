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
  ALLOWED_EXTENSIONS, MAX_FILE_BYTES, MAX_PR_FILES, MAX_ENTRY_BYTES, MAX_NEW_ENTRIES, HOLD_LABEL, BOT_LOGINS, BRANCH, REPO_SLUG,
} from './lib/constants.mjs'
import { gh, fileAt } from './lib/github.mjs'
import { isMain } from './lib/cli.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

const NAME = '[a-z0-9](?:[a-z0-9-]{0,48}[a-z0-9])?'
const MOD_FILE = new RegExp(`^mods/(${NAME})/(.+)$`)
const ENTRY_FILE = new RegExp(`^mods/${NAME}/mod\\.json$`)
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

const PORTABLE_SEGMENT = /^[A-Za-z0-9._-]+$/
const WINDOWS_RESERVED = /^(?:con|prn|aux|nul|com[0-9]|lpt[0-9])(?:\..*)?$/i

/**
 * True when every folder and file name in the path can be checked out on Linux, macOS and
 * Windows alike: ASCII letters, digits, dot, dash and underscore, no trailing dot, no name that
 * Windows reserves (CON, NUL, COM1, …). A path that breaks a checkout breaks the marketplace.
 */
export function portablePath(path) {
  return String(path)
    .split('/')
    .every(seg => PORTABLE_SEGMENT.test(seg) && !seg.endsWith('.') && !WINDOWS_RESERVED.test(seg))
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

const sameLogin = (a, b) => String(a).toLowerCase() === String(b).toLowerCase()

/** The `source` fields that decide which code people install, as one comparable string. */
const SOURCE_FIELDS = ['type', 'repo', 'url', 'path', 'ref', 'sha', 'plugin', 'marketplace']
export const sourceKey = source => JSON.stringify(SOURCE_FIELDS.map(k => (source && typeof source === 'object' ? source[k] ?? null : null)))

/**
 * Words and marks in a title, tagline or author name that read as an endorsement by Anthropic or
 * by the catalog, which the bot cannot confirm.
 */
const TRUST_WORDS = /\b(?:anthropic|official|verified|endorsed)\b|официальн|верифицир|проверено\s+anthropic|[✓✔☑✅\u{1F6E1}]/iu
/** A word that mixes Latin with Cyrillic or Greek letters ("Аnthropic" with a Cyrillic А). */
export function mixedScriptWord(text) {
  return String(text)
    .split(/[^\p{L}\p{M}]+/u)
    .find(w => /\p{Script=Latin}/u.test(w) && /[\p{Script=Cyrillic}\p{Script=Greek}]/u.test(w)) ?? null
}
/** Hosts of Anthropic and Claude: an author or homepage link there claims to be them. */
const OFFICIAL_HOST = /(?:^|\.)(?:anthropic\.com|claude\.ai|claude\.com)$/i
const hostOf = url => {
  try {
    return new URL(String(url)).hostname
  } catch {
    return ''
  }
}

/** What in an entry's shown identity (title, taglines, author, homepage) claims trust: [] when nothing. */
export function trustClaims(entry) {
  const out = []
  const texts = [entry?.title, entry?.tagline, entry?.tagline_ru, entry?.author?.name].filter(t => typeof t === 'string')
  for (const t of texts) {
    const m = TRUST_WORDS.exec(t)
    if (m) out.push(m[0])
    const mixed = mixedScriptWord(t)
    if (mixed) out.push(mixed)
  }
  for (const url of [entry?.author?.url, entry?.homepage]) {
    const host = hostOf(url)
    if (host && OFFICIAL_HOST.test(host)) out.push(host)
  }
  return [...new Set(out)]
}

/** The author as shown (name, login, link), independent of the key order in mod.json. */
const authorKey = entry => {
  const a = entry?.author && typeof entry.author === 'object' ? entry.author : {}
  return JSON.stringify([a.name ?? null, a.github ?? null, a.url ?? null])
}
const identityOf = entry => JSON.stringify([entry?.title ?? null, entry?.tagline ?? null, entry?.tagline_ru ?? null, authorKey(entry), entry?.homepage ?? null])

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
 * - headErrors: { "<name>": message } for head mod.json files that are not a JSON object or fail
 *   the catalog check of main (schema, folder name, plugin-name rules)
 * - previouslyListed: { "<name>": true } for new entries whose folder has history on main (the name
 *   was listed before and removed)
 * - isDraft, labels (names), baseRef, state ("open"), validateConclusion, headShaMatches, headRepoGone
 * Returns { allowed, reasons: [{ code, en, ru }], names }.
 *
 * Code that people already installed only changes with a catalog maintainer: for an entry on main
 * that our marketplace serves, any change under mods/<name>/plugin/ and any change of `source`
 * (for every entry: it decides where installs come from) needs one, and so does a new entry that
 * reuses a removed entry's name. New entries are merged one per pull request, under 64 KB, with
 * the PR author as the only maintainer and as the author's GitHub login, and without words, marks
 * or links that claim an endorsement.
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
  previouslyListed = {},
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
  const bigEntries = []
  const links = []
  const unknown = []
  const unportable = []
  const byLowerCase = new Map()
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
    if (!portablePath(f.filename)) unportable.push(f.filename)
    const lower = String(f.filename).toLowerCase()
    byLowerCase.set(lower, [...(byLowerCase.get(lower) ?? []), f.filename])
    if (!extensionAllowed(f.filename)) badType.push(f.filename)
    // Fail closed: a file whose size or type the bot does not know is not merged.
    if (f.mode === '120000' || f.mode === '160000') links.push(f.filename)
    else if (typeof f.size !== 'number' || !REGULAR_MODES.includes(f.mode)) unknown.push(f.filename)
    else if (f.size > MAX_FILE_BYTES) tooBig.push(f.filename)
    else if (ENTRY_FILE.test(f.filename) && f.size > MAX_ENTRY_BYTES) bigEntries.push(f.filename)
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
  if (bigEntries.length) {
    const kb = Math.round(MAX_ENTRY_BYTES / 1024)
    reasons.push(reason('entry-too-big',
      `Entries over ${kb} KB: ${list(bigEntries)}. Every visitor of the site downloads them, so shorten the preview.`,
      `Записи больше ${kb} КБ: ${listRu(bigEntries)}. Их скачивает каждый посетитель сайта, поэтому сократите превью.`))
  }
  if (links.length) {
    reasons.push(reason('symlink',
      `Symbolic links and submodules are not merged automatically: ${list(links)}.`,
      `Символические ссылки и подмодули автоматически не сливаются: ${listRu(links)}.`))
  }
  const clashes = [...byLowerCase.values()].filter(group => new Set(group).size > 1).flat()
  if (unportable.length || clashes.length) {
    const bad = [...new Set([...unportable, ...clashes])]
    reasons.push(reason('unportable-path',
      `File names that do not check out the same on Linux, macOS and Windows: ${list(bad)}. Use ASCII letters, digits, \`.\`, \`-\` and \`_\`, no name Windows reserves (CON, NUL, …) and no two names that differ only in case.`,
      `Имена файлов, которые по-разному извлекаются в Linux, macOS и Windows: ${listRu(bad)}. Используйте латинские буквы, цифры, \`.\`, \`-\` и \`_\`, без имён, зарезервированных в Windows (CON, NUL, …), и без двух имён, отличающихся только регистром.`))
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
      reasons.push(reason('invalid-entry',
        `\`mods/${name}/mod.json\` does not pass the catalog check: ${code(headErrors[name])}. Run \`npm run check:entry ${name}\` and fix what it reports.`,
        `\`mods/${name}/mod.json\` не проходит проверку каталога: ${code(headErrors[name])}. Запустите \`npm run check:entry ${name}\` и исправьте то, что она покажет.`))
      continue
    }
    if (base && base.verified !== true) {
      // Code people already installed changes only with a catalog maintainer: a hosted, github or
      // git entry is served by our marketplace, so a change under plugin/ reaches every install.
      // Compared without case (a Plugin/ folder lands in plugin/ on macOS and Windows checkouts),
      // and also when the same PR removes mod.json (then only code it adds or edits counts:
      // a maintainer may delist the entry together with its code).
      const served = base.source?.type !== 'marketplace'
      const codePrefix = `mods/${name}/plugin/`
      const codeFiles = prFiles
        .filter(f => head || f.status !== 'removed')
        .flatMap(f => (head ? [f.filename, f.previous_filename] : [f.filename]))
        .filter(p => typeof p === 'string' && p.toLowerCase().startsWith(codePrefix))
      if (served && codeFiles.length) {
        reasons.push(reason('code-change',
          `\`${name}\` is already in the catalog and this changes its code (${list([...new Set(codeFiles)], 4)}): a catalog maintainer reads code changes before they reach the people who installed it.`,
          `\`${name}\` уже есть в каталоге, а запрос меняет её код (${listRu([...new Set(codeFiles)], 4)}): изменения кода читает мейнтейнер каталога, прежде чем они дойдут до тех, кто мод уже поставил.`))
      }
      if (head && sourceKey(base.source) !== sourceKey(head.source)) {
        reasons.push(reason('source-change',
          `\`${name}\` changes \`source\`, which decides where installs come from: a catalog maintainer checks the new source.`,
          `\`${name}\` меняет \`source\`, а от него зависит, откуда ставится мод: новый источник проверит мейнтейнер каталога.`))
      }
    }
    if (!base && head && previouslyListed[name]) {
      reasons.push(reason('name-reused',
        `\`${name}\` was in the catalog before: people who installed it would get this code as an update, so a catalog maintainer reviews it.`,
        `\`${name}\` уже была в каталоге: те, кто её ставил, получат этот код как обновление, поэтому его проверит мейнтейнер каталога.`))
    }
    if (head) {
      // What the site shows as who made the mod: the bot can vouch only for the PR author.
      const login = typeof head.author?.github === 'string' ? head.author.github : null
      const authorChanged = !base || authorKey(base) !== authorKey(head)
      if (login && authorChanged && !sameLogin(login, author)) {
        reasons.push(reason('author-not-you',
          `\`${name}\` names ${code(login)} as its author, but the pull request comes from ${code(author)}: a catalog maintainer confirms who wrote it.`,
          `\`${name}\` называет автором ${code(login)}, а запрос отправил ${code(author)}: кто автор, подтвердит мейнтейнер каталога.`))
      }
      const before = new Set((Array.isArray(base?.maintainers) ? base.maintainers : []).map(m => String(m).toLowerCase()))
      const added = (Array.isArray(head.maintainers) ? head.maintainers : [])
        .map(String)
        .filter(m => !before.has(m.toLowerCase()) && !sameLogin(m, author))
      if (added.length) {
        reasons.push(reason('new-maintainers',
          `\`${name}\` adds maintainers other than you (${list(added, 4)}): they get to change the entry, so a catalog maintainer confirms them.`,
          `\`${name}\` добавляет мейнтейнеров кроме вас (${listRu(added, 4)}): они смогут менять запись, поэтому их подтвердит мейнтейнер каталога.`))
      }
      const claims = !base || identityOf(base) !== identityOf(head) ? trustClaims(head) : []
      if (claims.length) {
        reasons.push(reason('trust-claim',
          `\`${name}\` shows words, marks or links that read as an endorsement or mix alphabets in one word (${list(claims, 4)}): a catalog maintainer checks them.`,
          `\`${name}\` показывает слова, значки или ссылки, похожие на одобрение, или смешивает алфавиты в одном слове (${listRu(claims, 4)}): их проверит мейнтейнер каталога.`))
      }
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
  const newNames = [...names].filter(n => !baseEntries[n] && headEntries[n] && !baseErrors[n] && !baseOrphans[n]).sort()
  if (newNames.length > MAX_NEW_ENTRIES) {
    reasons.push(reason('many-new',
      `It adds ${newNames.length} new entries (${list(newNames, 4)}); the bot merges ${MAX_NEW_ENTRIES === 1 ? 'one new entry' : `${MAX_NEW_ENTRIES} new entries`} per pull request. Split them, or a catalog maintainer merges them.`,
      `Запрос добавляет ${newNames.length} новых записей (${listRu(newNames, 4)}), а бот сливает ${MAX_NEW_ENTRIES === 1 ? 'одну новую запись' : `не больше ${MAX_NEW_ENTRIES}`} за запрос. Разделите их, или их сольёт мейнтейнер каталога.`))
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
export async function gather({ repo, pr, headSha, validateConclusion, confirmed = true, maintainerIds = {}, check }) {
  // Loaded here, not at the top: scripts that only borrow parseArgs from this file (discover,
  // bot-comment) run without npm dependencies, and the entry check needs ajv.
  if (!check) check = (await import('./lib/entry.mjs')).checkEntryData
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
  const previouslyListed = {}
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
    else if (head.entry) {
      // The schema and name rules of main (this checkout), on the PR's mod.json as data: the bot
      // does not rely on the PR's own Validate run for them.
      const { errors } = check(root, name, head.entry)
      if (errors.length) headErrors[name] = errors.slice(0, 3).join('; ') + (errors.length > 3 ? ` (+${errors.length - 3} more)` : '')
    }
    if (!base.entry && !base.error && head.entry) {
      // A new entry under a name main had before: its installs would update to this code.
      const history = await gh(`/repos/${repo}/commits?sha=${mainSha}&path=mods/${name}&per_page=1`)
      if (!Array.isArray(history)) throw new Error(`could not read the history of mods/${name}`)
      if (history.length) previouslyListed[name] = true
    }
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
    previouslyListed,
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

/**
 * The open PR into `repo` whose head is `headSha` on branch `headBranch` of `headRepo`, or null.
 * Used only when the Validate run left no pr-meta artifact; every value is matched exactly.
 */
export async function prNumberForHead(repo, headSha, headRepo, headBranch) {
  if (!/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?\/[A-Za-z0-9._-]{1,100}$/.test(headRepo)) return null
  const owner = headRepo.split('/')[0]
  const pulls = await gh(`/repos/${repo}/pulls?state=open&per_page=30&head=${encodeURIComponent(`${owner}:${headBranch}`)}`)
  const hit = (Array.isArray(pulls) ? pulls : []).find(p =>
    p?.head?.sha === headSha && p.head.ref === headBranch && p.head.repo?.full_name === headRepo && p.base?.ref === BRANCH)
  return hit ? parsePrNumber(hit.number) : null
}

/** An error message as plain one-line text for the bot comment. */
const plain = text => String(text).replace(/[`\r\n]/g, ' ').slice(0, 300)

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const repo = args.repo || process.env.GITHUB_REPOSITORY || REPO_SLUG
  if (!/^[A-Za-z0-9-]{1,39}\/[A-Za-z0-9._-]{1,100}$/.test(repo)) throw new Error('bad --repo')
  const headSha = String(args['head-sha'] || '')
  if (!/^[0-9a-f]{40}$/.test(headSha)) throw new Error('--head-sha must be a full commit SHA')
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
    // No artifact (Validate failed to start, or a PR changed validate.yml): find the open PR whose
    // head is the commit the run checked. confirmedHead() below checks the same three facts again.
    if (!number && args['head-repo'] && args['head-branch']) {
      number = await prNumberForHead(repo, headSha, args['head-repo'], args['head-branch'])
      if (number) console.log(`no pr-meta artifact: found PR #${number} by its head commit`)
    }
  }
  if (!number) throw new Error('no valid pull request number (expected a positive integer)')
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
