// Catalog — STUB with the final props. Owner: Catalog agent (see src/CONTRACTS.md).
// Final: search (name, title, tags, author), segmented filters (category; "draws in" slot
// groups; surface; sort Featured/Newest/Most stars/A–Z), a grid of ModCards (compact
// MockClient on top, title, tagline, chips, author, stars, Hosted/External, ghost Install
// opening the install popover, "Add to loadout"), empty state with "Submit the first one".
// Filter state in localStorage only (lib/storage). Cards open #/mod/<name>.
import { useT } from '../i18n'
import { useRegistry } from '../lib/registry'
import { hrefFor } from '../lib/router'
import './sections.css'

export type CatalogProps = {
  /** DOM id of the section (scroll target for "#/catalog"). */
  id?: string
}

export default function Catalog({ id = 'catalog' }: CatalogProps) {
  const { t, pick } = useT()
  const { registry } = useRegistry()
  return (
    <section id={id} className="wrap section" aria-labelledby={`${id}-title`}>
      <div className="section-head">
        <h2 id={`${id}-title`}>{t('catalog.title')}</h2>
        <p>{t('catalog.lead')}</p>
      </div>
      <ul className="stub-list">
        {registry.mods.map((m) => (
          <li key={m.name}>
            <a href={hrefFor({ name: 'mod', mod: m.name })}>{m.title}</a>
            <span>{pick(m.tagline, m.tagline_ru)}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
