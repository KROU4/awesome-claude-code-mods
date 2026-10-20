// How it works: three steps with the real commands (add the marketplace → install → it
// loads), the anatomy of a mod (3-file tree + a real excerpt of Turn Meter's register.tsx)
// and the official docs. Other places to find mods are listed once, in the footer.
import Anatomy from '../components/how/Anatomy'
import { Docs } from '../components/how/Links'
import Steps from '../components/how/Steps'
import { useT } from '../i18n'
import { useRegistry } from '../lib/registry'
import '../components/how/how.css'

export type HowItWorksProps = {
  /** DOM id of the section (scroll target for "#/how"). */
  id?: string
}

export default function HowItWorks({ id = 'how' }: HowItWorksProps) {
  const { t } = useT()
  const { registry } = useRegistry()
  const example = registry.mods.find((m) => m.name === 'turn-meter')

  return (
    <section id={id} className="wrap section how" aria-labelledby={`${id}-title`}>
      <div className="section-head">
        <h2 id={`${id}-title`}>{t('how.title')}</h2>
        <p>{t('how.lead')}</p>
      </div>

      <Steps />

      <div className="how-anatomy-block" aria-labelledby={`${id}-anatomy`} role="group">
        <div className="how-anatomy-head">
          <h3 id={`${id}-anatomy`} className="how-sub how-sub-lg">
            {t('how.anatomy.title')}
          </h3>
          <p>{t('how.anatomy.lead')}</p>
        </div>
        <Anatomy sourceUrl={example?.sourceUrl} />
      </div>

      <div className="how-more">
        <Docs headingId={`${id}-docs`} />
      </div>
    </section>
  )
}
