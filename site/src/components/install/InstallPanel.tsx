// InstallPanel — STUB with the final props. Owner: Install agent (see src/CONTRACTS.md).
// Final: tabs Terminal (default) · Shell · Desktop app · VS Code · Ask Claude; real deep-link
// buttons (<a href>): "Install in VS Code" (vscodeUrl), "Open in terminal" (terminalUrl, helper
// "Opens Claude Code with the install command typed. Press Enter."), "Open in Claude desktop"
// (desktopUrl) + the manual steps; Copy for every command; the one-line note that links open
// apps on this computer and the install is approved inside Claude Code. All values come from
// lib/install.ts resolveInstall(mod) (which reads the registry's install.* fields).
import CopyButton from '../ui/CopyButton'
import { useT } from '../../i18n'
import { resolveInstall } from '../../lib/install'
import type { SiteMod } from '../../data/types'
import './install.css'

export type InstallTab = 'terminal' | 'shell' | 'desktop' | 'vscode' | 'ask'

export type InstallPanelProps = {
  mod: SiteMod
  /** 'full' in the detail sheet; 'popover' when opened from a card's Install button. */
  variant?: 'full' | 'popover'
  defaultTab?: InstallTab
  className?: string
}

export default function InstallPanel({ mod, variant = 'full', className }: InstallPanelProps) {
  const { t } = useT()
  const i = resolveInstall(mod)
  return (
    <div className={['install-stub', className].filter(Boolean).join(' ')} data-variant={variant}>
      <div className="install-stub-cmd">
        <code>{i.terminal}</code>
        <CopyButton text={i.terminal} what={i.terminal} label={null} />
      </div>
      <div className="install-stub-links">
        <a className="btn btn-secondary" href={i.vscodeUrl}>
          {t('install.link.vscode')}
        </a>
        <a className="btn btn-secondary" href={i.terminalUrl}>
          {t('install.link.terminal')}
        </a>
        <a className="btn btn-secondary" href={i.desktopUrl}>
          {t('install.link.desktop')}
        </a>
      </div>
      <p className="install-stub-note">{t('install.links.note')}</p>
    </div>
  )
}
