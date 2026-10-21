// The community rules in plain words: what the bot merges by itself, what waits for a
// maintainer (scripts/policy.mjs, docs/governance.md).
import { useT, type TKey } from '../../i18n'
import { shellRegistry } from '../../lib/registry'
import { rich } from '../how/Command'
import { IconArrowUpRight } from '../ui/icons'
import './submit.css'

const AUTO: TKey[] = ['submit.rules.auto.1', 'submit.rules.auto.2', 'submit.rules.auto.3']
const MANUAL: TKey[] = ['submit.rules.manual.1', 'submit.rules.manual.2', 'submit.rules.manual.3']

export default function Rules({ idBase }: { idBase: string }) {
  const { t, lang } = useT()
  const blob = `${shellRegistry.repo.url}/blob/${shellRegistry.repo.branch}`
  return (
    <div className="sb-rules">
      <div className="sb-rule" data-tone="auto">
        <h3 id={`${idBase}-auto`} className="sb-rule-title">
          {t('submit.rules.auto.title')}
        </h3>
        <ul aria-labelledby={`${idBase}-auto`}>
          {AUTO.map((k) => (
            <li key={k}>{rich(t(k))}</li>
          ))}
        </ul>
      </div>
      <div className="sb-rule" data-tone="manual">
        <h3 id={`${idBase}-manual`} className="sb-rule-title">
          {t('submit.rules.manual.title')}
        </h3>
        <ul aria-labelledby={`${idBase}-manual`}>
          {MANUAL.map((k) => (
            <li key={k}>{rich(t(k))}</li>
          ))}
        </ul>
      </div>
      <p className="sb-rules-links">
        <a href={`${blob}/docs/governance.md`} rel="noopener">
          {t('submit.rules.governance')}
          <IconArrowUpRight size={14} />
        </a>
        <a href={`${blob}/${lang === 'ru' ? 'CONTRIBUTING.md' : 'CONTRIBUTING.en.md'}`} rel="noopener">
          {t('submit.rules.contributing')}
          <IconArrowUpRight size={14} />
        </a>
      </p>
    </div>
  )
}
