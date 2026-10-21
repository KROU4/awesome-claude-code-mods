// The result of the builder: the schema check, the problems left (each one jumps to its
// field), "Open a pull request on GitHub" with the JSON in the link, Copy, and the JSON.
//
// GitHub's "new file" page takes the content in `value`. Links past ~8000 characters are
// cut by browsers and proxies, so a longer entry copies the JSON and opens an empty file.
import { useRef } from 'react'
import { useT } from '../../i18n'
import type { PreviewElement, SiteMod } from '../../data/types'
import { copyText } from '../../lib/clipboard'
import { shellRegistry } from '../../lib/registry'
import { highlightLine } from '../how/highlight'
import CopyButton from '../ui/CopyButton'
import { IconArrowUpRight, IconCheck } from '../ui/icons'
import { useToast } from '../ui/Toaster'
import { issueLabel, issueMessage } from './messages'
import { focusIssue, type Issue } from './validate'

export const MAX_URL = 8000
const SHOWN = 5

export type CheckStatus = 'idle' | 'loading' | 'ready' | 'failed'

export default function Output({
  name,
  json,
  issues,
  status,
  existing,
  elements,
  sourceType,
  revealed,
  onReveal,
}: {
  name: string
  json: string
  issues: Issue[]
  status: CheckStatus
  existing?: SiteMod
  elements: PreviewElement[]
  sourceType: string
  /** The person started filling in the form (or asked for the problems): red, not neutral. */
  revealed: boolean
  onReveal: () => void
}) {
  const { t, tn } = useT()
  const toast = useToast()
  const pre = useRef<HTMLPreElement>(null)

  const blocking = issues.filter((i) => i.keyword !== 'exists')
  const checked = status === 'ready' || status === 'failed'
  const ready = checked && blocking.length === 0
  const file = `mods/${name}/mod.json`
  // The repository the pull request goes to comes from the copy bundled at build time.
  const base = `${shellRegistry.repo.url}/new/${encodeURIComponent(shellRegistry.repo.branch)}?filename=${encodeURIComponent(file)}`
  const full = `${base}&value=${encodeURIComponent(json)}`
  const tooLong = full.length > MAX_URL

  const copyJson = () => {
    void copyText(json, pre.current).then((ok) => toast.show(ok ? t('common.copy.done') : t('common.copy.failed')))
  }

  return (
    <div className="sb-out">
      <h4 className="sb-sub">{t('submit.out.title')}</h4>

      <div className="sb-status" role="status" aria-live="polite">
        {status === 'idle' || status === 'loading' ? (
          <p className="sb-status-line" data-tone="wait">
            <span className="sb-status-dot" aria-hidden="true" />
            {t('submit.out.checking')}
          </p>
        ) : status === 'failed' ? (
          <p className="sb-status-line" data-tone="warn">
            {t('submit.out.loadFailed')}
          </p>
        ) : blocking.length === 0 ? (
          <p className="sb-status-line" data-tone="ok">
            <IconCheck size={16} />
            {t('submit.out.valid')}
          </p>
        ) : revealed ? (
          <p className="sb-status-line" data-tone="bad">
            {tn('submit.out.problems', blocking.length)}
          </p>
        ) : (
          // untouched form: one neutral line, no list of red "Required"s
          <p className="sb-status-line" data-tone="todo">
            {tn('submit.out.todo', blocking.length)}
          </p>
        )}
      </div>

      <div className="sb-actions">
        {existing ? (
          <>
            <p className="sb-out-note">{t('submit.out.exists', { name })}</p>
            <a className="btn btn-primary" href={existing.editUrl} target="_blank" rel="noopener" onClick={copyJson}>
              {t('submit.out.existsEdit', { name })}
              <IconArrowUpRight size={16} />
            </a>
            <p className="sb-out-hint">{t('submit.out.existsHint')}</p>
          </>
        ) : ready ? (
          tooLong ? (
            <>
              <a className="btn btn-primary" href={base} target="_blank" rel="noopener" onClick={copyJson}>
                {t('submit.out.long')}
                <IconArrowUpRight size={16} />
              </a>
              <p className="sb-out-hint">{t('submit.out.longHint', { name })}</p>
            </>
          ) : (
            <>
              <a className="btn btn-primary" href={full} target="_blank" rel="noopener">
                {t('submit.pr.open')}
                <IconArrowUpRight size={16} />
              </a>
              <p className="sb-out-hint">{t('submit.out.prHint', { name })}</p>
            </>
          )
        ) : (
          <>
            {/* not ready yet: the button stays a button; it shows what is missing and goes there */}
            <button type="button" className="btn btn-primary" aria-describedby="sb-pr-blocked" onClick={onReveal}>
              {t('submit.pr.open')}
            </button>
            <p className="sb-out-hint" id="sb-pr-blocked">
              {checked ? (revealed ? t('submit.out.prBlocked') : t('submit.out.prShows')) : t('submit.out.checking')}
            </p>
          </>
        )}
        <CopyButton text={json} label={t('submit.json.copy')} selectTarget={pre} className="sb-copy" />
      </div>

      {blocking.length && checked && revealed ? (
        <ul className="sb-problems">
          {blocking.slice(0, SHOWN).map((i) => (
            <li key={i.path}>
              <button type="button" className="sb-problem" onClick={() => focusIssue(i.path)}>
                <span className="sb-problem-field">{issueLabel(i, t, elements, sourceType)}</span>
                <span className="sb-problem-text">{issueMessage(i, t)}</span>
              </button>
            </li>
          ))}
          {blocking.length > SHOWN ? <li className="sb-problems-more">{t('submit.out.more', { n: blocking.length - SHOWN })}</li> : null}
        </ul>
      ) : null}

      <details className="sb-json">
        <summary>{t('submit.out.json')}</summary>
        <pre ref={pre} className="sb-json-body">
          <code>
            {json
              .replace(/\n$/, '')
              .split('\n')
              .map((line, i) => (
                <span key={i} className="sb-json-line">
                  {highlightLine(line, 'json')}
                </span>
              ))}
          </code>
        </pre>
      </details>
    </div>
  )
}
