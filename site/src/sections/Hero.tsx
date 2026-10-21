// Hero: the serif headline across the top; under it, the explainer, "Browse mods" and
// "Add the marketplace" on the left and the live client on the right (stacked on narrow
// screens). The live client is the page's one orchestrated motion: everything else is still.
import HeroStats from '../components/hero/HeroStats'
import LiveClient from '../components/hero/LiveClient'
import { CommandText } from '../components/how/Command'
import Boundary from '../components/ui/Boundary'
import CopyButton from '../components/ui/CopyButton'
import { followHashLink } from '../components/catalog/nav'
import { useT } from '../i18n'
import { shellRegistry } from '../lib/registry'
import '../components/hero/hero.css'

export type HeroProps = {
  /** DOM id of the section (scroll target for "#/"). */
  id?: string
}

export default function Hero({ id = 'top' }: HeroProps) {
  const { t } = useT()
  // The command people paste comes from the copy bundled at build time, never from the live
  // registry.json: a bad write to main must not change what the page tells people to run.
  const command = shellRegistry.marketplace.addCommand
  const title = t('hero.title')
  const cut = title.indexOf('. ')
  const lead = cut > 0 ? title.slice(0, cut + 1) : title
  const rest = cut > 0 ? title.slice(cut + 2) : ''

  return (
    <section id={id} className="hero wrap" aria-labelledby={`${id}-title`}>
      <h1 id={`${id}-title`} className="hero-title">
        {/* the first sentence holds its own line; the rest wraps under it */}
        <span className="hero-title-lead">{lead}</span> {rest}
      </h1>

      <div className="hero-copy">
        <div className="hero-intro">
          <p className="hero-lead">{t('hero.lead')}</p>

          <div className="hero-actions">
            <a className="btn btn-primary" href="#/catalog" onClick={followHashLink}>
              {t('hero.cta.browse')}
            </a>
            <CopyButton text={command} label={t('hero.cta.marketplace')} className="btn btn-secondary" variant="plain" />
          </div>
          <p className="hero-cmd">
            <span className="hero-cmd-hint">{t('hero.cta.marketplaceHint')}</span>
            <code className="hero-cmd-line">
              <CommandText command={command} />
            </code>
          </p>
        </div>

        <div className="hero-foot">
          <HeroStats />
          <p className="hero-why">{t('hero.why')}</p>
        </div>
      </div>

      <Boundary fallback={<p className="hero-client hero-client-failed">{t('common.error.preview')}</p>}>
        <LiveClient sectionId={id} className="hero-client" />
      </Boundary>
    </section>
  )
}
