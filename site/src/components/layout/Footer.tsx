// Footer: disclaimer, project links, other places to find mods, "Stop animations", data freshness.
import { ELSEWHERE } from '../../data/elsewhere'
import { useT } from '../../i18n'
import { useMotionPref } from '../../lib/motionPref'
import { shellRegistry } from '../../lib/registry'
import DataStatus from '../ui/DataStatus'
import { Wordmark } from './Header'
import './layout.css'

export default function Footer() {
  const { t, pick } = useT()
  const { stopped, toggle } = useMotionPref()
  // The project's own links come from the copy bundled at build time, not the live registry.
  const repo = shellRegistry.repo.url
  const blob = `${repo}/blob/${shellRegistry.repo.branch}`

  return (
    <footer className="site-footer">
      <div className="wrap footer-grid">
        <div className="footer-about">
          <Wordmark />
          <p className="footer-disclaimer">{t('common.footer.disclaimer')}</p>
          <p className="footer-meta">
            <span className="footer-meta-label">{t('common.footer.data')}:</span> <DataStatus />
          </p>
          <button type="button" className="footer-motion" aria-pressed={stopped} onClick={toggle}>
            {stopped ? t('common.footer.motionPlay') : t('common.footer.motionStop')}
          </button>
        </div>

        <nav className="footer-col" aria-label={t('common.footer.project')}>
          <h2 className="footer-head">{t('common.footer.project')}</h2>
          <ul>
            <li>
              <a href={repo}>{t('common.footer.repo')}</a>
            </li>
            <li>
              <a href={`${blob}/docs/research.md`}>{t('common.footer.research')}</a>
            </li>
            <li>
              <a href={`${blob}/CONTRIBUTING.md`}>{t('common.footer.contributing')}</a>
            </li>
            <li>
              <a href={`${blob}/LICENSE`}>{t('common.footer.license')} (MIT)</a>
            </li>
          </ul>
        </nav>

        <div className="footer-col footer-elsewhere">
          <h2 className="footer-head">{t('common.footer.elsewhere')}</h2>
          <ul>
            {ELSEWHERE.map((e) => (
              <li key={e.url}>
                <a href={e.url} rel="noopener">
                  {e.name}
                </a>
                <span className="footer-note">{pick(e.note, e.note_ru)}</span>
              </li>
            ))}
          </ul>
          <p className="footer-small">{t('common.footer.elsewhereNote')}</p>
        </div>
      </div>
    </footer>
  )
}
