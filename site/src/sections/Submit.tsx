// Submit a mod — STUB with the final props. Owner: Submit agent (see src/CONTRACTS.md).
// Loaded lazily by App (it will carry ajv). Final: the rules in plain words, an entry
// builder (name, title, tagline EN/RU, description, category, source, author, license,
// preview elements) with a live MockClient beside it, the JSON with Copy, and
// "Open a pull request on GitHub" →
//   https://github.com/<owner>/<repo>/new/main?filename=mods/<name>/mod.json&value=<urlencoded JSON>
// Client-side validation against schema/mod.schema.json with ajv imported inside this chunk.
import { useT } from '../i18n'
import { useRegistry } from '../lib/registry'
import './sections.css'

export type SubmitProps = {
  /** DOM id of the section (scroll target for "#/submit"). */
  id?: string
}

export default function Submit({ id = 'submit' }: SubmitProps) {
  const { t } = useT()
  const { registry } = useRegistry()
  const newFile = `${registry.repo.url}/new/${registry.repo.branch}?filename=${encodeURIComponent('mods/<name>/mod.json')}`
  return (
    <section id={id} className="wrap section" aria-labelledby={`${id}-title`}>
      <div className="section-head">
        <h2 id={`${id}-title`}>{t('submit.title')}</h2>
        <p>{t('submit.lead')}</p>
      </div>
      <a className="btn btn-secondary" href={newFile}>
        {t('submit.pr.open')}
      </a>
    </section>
  )
}
