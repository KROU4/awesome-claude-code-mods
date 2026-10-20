// The three steps: add the marketplace once → install a mod → it loads. Each step carries
// the real command from the registry, ready to copy, and the last one shows the result.
import { useMemo } from 'react'
import { useT } from '../../i18n'
import { resolveInstall } from '../../lib/install'
import { useRegistry } from '../../lib/registry'
import { MockClient, type PreviewInput } from '../mock'
import Command, { rich } from './Command'
import './how.css'

/** The mod the steps use as their example (falls back to the first one in the catalog). */
const EXAMPLE = 'turn-meter'

export default function Steps() {
  const { t } = useT()
  const { registry } = useRegistry()
  const mod = registry.mods.find((m) => m.name === EXAMPLE) ?? registry.mods.find((m) => m.hosted) ?? registry.mods[0]
  const install = mod ? resolveInstall(mod) : null
  const repo = registry.marketplace.repo
  const v = registry.minVersions
  const previews = useMemo<PreviewInput[]>(() => (mod ? [{ ...mod.preview, id: mod.name, label: mod.title }] : []), [mod])

  return (
    <ol className="how-steps">
      <li className="how-step">
        <h3 className="how-step-title">
          <span className="how-step-n">1</span>
          {t('how.step.marketplace')}
        </h3>
        <p className="how-step-body">{t('how.step.marketplace.session')}</p>
        <Command command={registry.marketplace.addCommand} what={t('how.copy.marketplace')} />
        <p className="how-step-body">{t('how.step.marketplace.shell')}</p>
        <Command command={registry.marketplace.addShell} what={t('how.copy.marketplaceShell')} />
        <p className="how-step-note">{rich(t('how.step.marketplace.desktop', { repo }))}</p>
      </li>

      <li className="how-step">
        <h3 className="how-step-title">
          <span className="how-step-n">2</span>
          {t('how.step.install')}
        </h3>
        {install && mod ? (
          <>
            <p className="how-step-body">{rich(t('how.step.install.session', { mod: mod.title }))}</p>
            <Command command={install.twoStep[1]} what={t('how.copy.install', { mod: mod.name })} />
            <p className="how-step-body">{t('how.step.install.oneLine', { v: v.terminal })}</p>
            <Command command={install.terminal} what={t('how.copy.installOneLine', { mod: mod.name })} />
          </>
        ) : null}
        <p className="how-step-note">{t('how.step.install.links')}</p>
      </li>

      <li className="how-step">
        <h3 className="how-step-title">
          <span className="how-step-n">3</span>
          {t('how.step.load')}
        </h3>
        <p className="how-step-body">{rich(t('how.step.load.body'))}</p>
        {mod ? (
          <figure className="how-result">
            <MockClient previews={previews} compact rows={9} className="how-result-mock" />
            <figcaption className="how-step-note">{t('how.step.load.caption', { mod: mod.title })}</figcaption>
          </figure>
        ) : null}
        <p className="how-step-note">
          {t('how.step.load.versions', { mods: v.mods, desktop: v.desktop, vscode: v.vscode })}
        </p>
      </li>
    </ol>
  )
}
