// The official docs on mods. (Other catalogs found by the research are listed in the footer.)
import { useT, type TKey } from '../../i18n'
import { IconArrowUpRight } from '../ui/icons'
import './how.css'

const DOCS: { href: string; title: TKey; note: TKey }[] = [
  {
    href: 'https://code.claude.com/docs/en/plugins/mods/overview',
    title: 'how.docs.overview',
    note: 'how.docs.overview.note',
  },
  {
    href: 'https://code.claude.com/docs/en/plugins/mods/create',
    title: 'how.docs.create',
    note: 'how.docs.create.note',
  },
  {
    href: 'https://code.claude.com/docs/en/plugins/mods/reference',
    title: 'how.docs.reference',
    note: 'how.docs.reference.note',
  },
]

export function Docs({ headingId }: { headingId: string }) {
  const { t, lang } = useT()
  return (
    <div className="how-links">
      <h3 id={headingId} className="how-sub">
        {t('how.docs.title')}
      </h3>
      {lang === 'ru' ? <p className="how-links-note">{t('how.docs.lang')}</p> : null}
      <ul className="how-link-list" aria-labelledby={headingId}>
        {DOCS.map((d) => (
          <li key={d.href}>
            <a className="how-link" href={d.href} rel="noopener" hrefLang="en">
              <span className="how-link-title">
                {t(d.title)}
                <IconArrowUpRight size={16} />
              </span>
              <span className="how-link-note">{t(d.note)}</span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  )
}
