// How it works — STUB with the final props. Owner: How agent (see src/CONTRACTS.md).
// Final: three steps with real artifacts (marketplace add → install → it loads, terminal and
// desktop), then "Anatomy of a mod": the 3-file tree (.claude-plugin/plugin.json,
// hooks/hooks.json, hooks/register.tsx) with a short real excerpt, and links to the docs.
import { useT } from '../i18n'
import { useRegistry } from '../lib/registry'
import './sections.css'

export type HowItWorksProps = {
  /** DOM id of the section (scroll target for "#/how"). */
  id?: string
}

export default function HowItWorks({ id = 'how' }: HowItWorksProps) {
  const { t } = useT()
  const { registry } = useRegistry()
  const example = registry.mods[0]
  return (
    <section id={id} className="wrap section" aria-labelledby={`${id}-title`}>
      <div className="section-head">
        <h2 id={`${id}-title`}>{t('how.title')}</h2>
        <p>{t('how.lead')}</p>
      </div>
      <ol className="stub-steps">
        <li>
          <span>{t('how.step.marketplace')}</span>
          <code>{registry.marketplace.addCommand}</code>
        </li>
        <li>
          <span>{t('how.step.install')}</span>
          <code>{example ? example.install.terminal : '/plugin install <name>'}</code>
        </li>
        <li>
          <span>{t('how.step.load')}</span>
        </li>
      </ol>
    </section>
  )
}
