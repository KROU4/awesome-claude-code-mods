// Submit a mod: the rules in plain words, then the entry builder (form + structured preview
// editor + live MockClient + JSON + "Open a pull request on GitHub"). App loads this section
// lazily; ajv and the schema load later still, when the builder comes near (submit/validate.ts).
// The section's strings ship in this chunk too: the first import registers them.
import '../i18n/registerSubmit'
import { rich } from '../components/how/Command'
import EntryBuilder from '../components/submit/EntryBuilder'
import Rules from '../components/submit/Rules'
import { useT } from '../i18n'
import '../components/submit/submit.css'

export type SubmitProps = {
  /** DOM id of the section (scroll target for "#/submit"). */
  id?: string
}

export default function Submit({ id = 'submit' }: SubmitProps) {
  const { t } = useT()
  return (
    <section id={id} className="wrap section sb" aria-labelledby={`${id}-title`}>
      <div className="section-head">
        <h2 id={`${id}-title`}>{t('submit.title')}</h2>
        <p>{t('submit.lead')}</p>
      </div>

      <Rules idBase={id} />

      <div className="sb-builder-head">
        <h3 id={`${id}-builder`} className="sb-builder-title">
          {t('submit.builder.title')}
        </h3>
        <p>{rich(t('submit.builder.lead'))}</p>
      </div>
      <EntryBuilder />
    </section>
  )
}
