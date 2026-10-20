// Hero — STUB with the final props. Owner: Hero agent (see src/CONTRACTS.md).
// Final: serif headline + one-line explainer + "Browse mods" / "Add the marketplace" on the
// left; the live client (MockClient with a loadout of 3–4 mods, chips to toggle mods,
// Terminal | Desktop app | VS Code, Pause/Play) on the right/below; the counter
// "N mods · M authors · updated <relative time>". Replaces sections/DevMockShowcase.tsx.
import CopyButton from '../components/ui/CopyButton'
import DataStatus from '../components/ui/DataStatus'
import { useT } from '../i18n'
import { authorCount, useRegistry } from '../lib/registry'
import './sections.css'

export type HeroProps = {
  /** DOM id of the section (scroll target for "#/"). */
  id?: string
}

export default function Hero({ id = 'top' }: HeroProps) {
  const { t, tn } = useT()
  const { registry } = useRegistry()
  return (
    <section id={id} className="wrap hero-stub" aria-labelledby={`${id}-title`}>
      <h1 id={`${id}-title`}>{t('hero.title')}</h1>
      <p className="hero-stub-lead">{t('hero.lead')}</p>
      <div className="hero-stub-actions">
        <a className="btn btn-primary" href="#/catalog">
          {t('hero.cta.browse')}
        </a>
        <CopyButton
          text={registry.marketplace.addCommand}
          label={t('hero.cta.marketplace')}
          className="btn btn-secondary"
          variant="plain"
        />
      </div>
      <p className="hero-stub-meta">
        {tn('hero.counter.mods', registry.mods.length)} · {tn('hero.counter.authors', authorCount(registry))} · <DataStatus />
      </p>
    </section>
  )
}
