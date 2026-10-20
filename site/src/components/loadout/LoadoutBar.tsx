// LoadoutBar — STUB with the final props. Owner: Install agent (see src/CONTRACTS.md).
// Final: a floating bar at the bottom (safe-area aware) when the loadout has mods: the
// selected mods as removable chips, "Show together" (the hero client with this loadout),
// one combined command block (marketplace add once + one install line per mod,
// lib/install.ts loadoutCommands) with "Copy all", and Clear. Reads lib/loadout useLoadout().
import { useT } from '../../i18n'
import { loadoutCommands } from '../../lib/install'
import { useLoadout } from '../../lib/loadout'
import { useRegistry } from '../../lib/registry'
import CopyButton from '../ui/CopyButton'
import './loadout.css'

export type LoadoutBarProps = {
  className?: string
}

export default function LoadoutBar({ className }: LoadoutBarProps) {
  const { t } = useT()
  const { names, clear } = useLoadout()
  const { registry } = useRegistry()
  const mods = registry.mods.filter((m) => names.includes(m.name))
  if (!mods.length) return null
  return (
    <aside className={['loadout-stub', className].filter(Boolean).join(' ')} aria-label={t('install.loadout.title')}>
      <span className="loadout-stub-names">{mods.map((m) => m.title).join(', ')}</span>
      <CopyButton text={loadoutCommands(mods)} label={t('install.loadout.copyAll')} variant="solid" />
      <button type="button" className="btn btn-ghost" onClick={clear}>
        {t('install.loadout.clear')}
      </button>
    </aside>
  )
}
