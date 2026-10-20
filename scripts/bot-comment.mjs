// Posts or updates the automerge bot's single comment on a PR (found by a hidden marker) and adds
// the needs-maintainer label when the policy refused. Run by .github/workflows/automerge.yml.
//   node scripts/bot-comment.mjs --decision decision.json [--merged] [--run-url <url>] [--repo o/r]
import { readFileSync } from 'node:fs'
import { gh, ghPaginate } from './lib/github.mjs'
import { isMain } from './lib/cli.mjs'
import { BOT_COMMENT_MARKER, NEEDS_MAINTAINER_LABEL, BOT_LOGINS, REPO_SLUG, REPO_URL } from './lib/constants.mjs'
import { parseArgs, parsePrNumber } from './policy.mjs'

/** Codes that are about this run, not about the change: no label for them. */
const TRANSIENT = ['validate-failed', 'stale-head', 'not-open', 'bot-error']

/**
 * What to do for a decision: { comment: string | null, label: boolean }.
 * `merged`: the merge went through; `runUrl`: the Validate run, linked when it failed.
 */
export function plan(decision, { merged = false, runUrl = '' } = {}) {
  const codes = (decision.reasons || []).map(r => r.code)
  if (merged) {
    return {
      label: false,
      comment: [
        BOT_COMMENT_MARKER,
        '**Merged automatically ✓**',
        '',
        'Every changed file is inside `mods/<name>/`, Validate passed for this exact commit and you maintain the entries you changed. The catalog, marketplace and site update in a few minutes.',
        '',
        'Слито автоматически: все файлы внутри `mods/<имя>/`, проверка Validate прошла для этого коммита, и вы мейнтейнер изменённых записей. Каталог, маркетплейс и сайт обновятся через несколько минут.',
      ].join('\n'),
    }
  }
  if (codes.includes('stale-head') || codes.includes('not-open')) return { label: false, comment: null }
  if (codes.includes('validate-failed')) {
    const link = runUrl ? `[the Validate run](${runUrl})` : 'the Validate run'
    const linkRu = runUrl ? `[журнал Validate](${runUrl})` : 'журнал Validate'
    return {
      label: false,
      comment: [
        BOT_COMMENT_MARKER,
        `**Validate failed**, so the bot did not look further. See ${link} for what to fix, then push a new commit.`,
        '',
        `Проверка Validate не прошла, поэтому бот дальше не смотрел. Что исправить, написано в ${linkRu}; затем отправьте новый коммит.`,
      ].join('\n'),
    }
  }
  const reasons = decision.reasons || []
  return {
    label: !reasons.every(r => TRANSIENT.includes(r.code)),
    comment: [
      BOT_COMMENT_MARKER,
      `**Not merged automatically.** A maintainer will look at this pull request (label \`${NEEDS_MAINTAINER_LABEL}\`).`,
      '',
      ...reasons.map(r => `- ${r.en}`),
      '',
      '<details><summary>По-русски</summary>',
      '',
      'Бот не слил запрос автоматически; его посмотрит мейнтейнер.',
      '',
      ...reasons.map(r => `- ${r.ru}`),
      '',
      '</details>',
      '',
      `The rules: [docs/governance.md](${REPO_URL}/blob/main/docs/governance.md).`,
    ].join('\n'),
  }
}

async function upsertComment(repo, number, body) {
  const comments = await ghPaginate(`/repos/${repo}/issues/${number}/comments`)
  const mine = comments.find(c => BOT_LOGINS.includes(c.user?.login) && typeof c.body === 'string' && c.body.includes(BOT_COMMENT_MARKER))
  if (mine) {
    if (mine.body !== body) await gh(`/repos/${repo}/issues/comments/${mine.id}`, { method: 'PATCH', body: { body } })
  } else {
    await gh(`/repos/${repo}/issues/${number}/comments`, { method: 'POST', body: { body } })
  }
}

async function addLabel(repo, number) {
  const existing = await gh(`/repos/${repo}/labels/${encodeURIComponent(NEEDS_MAINTAINER_LABEL)}`, { allow404: true })
  if (!existing) {
    await gh(`/repos/${repo}/labels`, {
      method: 'POST',
      body: { name: NEEDS_MAINTAINER_LABEL, color: 'd97757', description: 'The automerge bot needs a maintainer to look at this' },
    }).catch(() => {})
  }
  await gh(`/repos/${repo}/issues/${number}/labels`, { method: 'POST', body: { labels: [NEEDS_MAINTAINER_LABEL] } })
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const repo = args.repo || process.env.GITHUB_REPOSITORY || REPO_SLUG
  const decision = JSON.parse(readFileSync(args.decision, 'utf8'))
  const number = parsePrNumber(decision.pr)
  if (!number) throw new Error('decision has no valid PR number')
  const runUrl = /^https:\/\/github\.com\//.test(args['run-url'] || '') ? args['run-url'] : ''
  const todo = plan(decision, { merged: args.merged === 'true', runUrl })
  if (todo.label) await addLabel(repo, number)
  if (todo.comment) await upsertComment(repo, number, todo.comment)
  console.log(`PR #${number}: ${todo.label ? 'labelled, ' : ''}${todo.comment ? 'comment updated' : 'nothing to say'}`)
}

if (isMain(import.meta.url)) {
  main().catch(err => {
    console.error(`bot-comment: ${err.message}`)
    process.exit(1)
  })
}
