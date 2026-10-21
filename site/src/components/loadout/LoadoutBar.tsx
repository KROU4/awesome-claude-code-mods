// LoadoutBar: a bar at the bottom (safe-area aware) while the loadout has mods: the picked
// mods as removable chips, "See them together" (a sheet with one MockClient merging their
// previews, history entry #/loadout), "Copy shell commands" (claude plugin marketplace add once
// + one claude plugin install per mod: a shell runs them line by line, while Claude Code would
// send a pasted block as one prompt) and Clear. Reads lib/loadout useLoadout().
import { AnimatePresence, m } from 'motion/react'
import { lazy, Suspense } from 'react'
import { useT } from '../../i18n'
import { loadoutCommands } from '../../lib/install'
import { useLoadout } from '../../lib/loadout'
import { enter, exit } from '../../lib/motion'
import { back } from '../../lib/router'
import { LOADOUT_HASH, openLoadout, useHash } from '../catalog/nav'
import { useLoadoutMods } from './useLoadoutMods'
import CopyButton from '../ui/CopyButton'
import { IconClose } from '../ui/icons'
import './loadout.css'

const LoadoutSheet = lazy(() => import('./LoadoutSheet'))

export type LoadoutBarProps = {
  className?: string
}

function IconLayers() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="m10 3.2 7 3.6-7 3.6-7-3.6 7-3.6Z" />
      <path d="m3 10.2 7 3.6 7-3.6M3 13.6l7 3.6 7-3.6" />
    </svg>
  )
}

export default function LoadoutBar({ className }: LoadoutBarProps) {
  const { t, tn } = useT()
  const { remove, clear } = useLoadout()
  const mods = useLoadoutMods()
  const hash = useHash()
  const sheetOpen = hash === LOADOUT_HASH

  return (
    <>
      <AnimatePresence>
        {mods.length ? (
          <m.aside
            key="loadout"
            className={['loadout', className].filter(Boolean).join(' ')}
            aria-label={t('install.loadout.title')}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0, transition: enter }}
            exit={{ opacity: 0, y: 16, transition: exit }}
          >
            <p className="loadout-count">
              <IconLayers />
              <span className="loadout-label">{t('install.loadout.title')}</span>
              <span className="loadout-n tabular">{tn('install.loadout.count', mods.length)}</span>
            </p>
            <ul className="loadout-chips">
              {mods.map((m) => (
                <li key={m.name} className="loadout-chip">
                  <span>{m.title}</span>
                  <button
                    type="button"
                    className="loadout-chip-x"
                    aria-label={t('install.loadout.remove', { title: m.title })}
                    title={t('install.loadout.remove', { title: m.title })}
                    onClick={() => remove(m.name)}
                  >
                    <IconClose size={14} />
                  </button>
                </li>
              ))}
            </ul>
            <div className="loadout-actions">
              <button type="button" className="loadout-clear" onClick={clear}>
                {t('install.loadout.clear')}
              </button>
              <CopyButton
                text={loadoutCommands(mods, 'shell', (h) =>
                  t('install.loadout.held', { mods: h.mods.map((m) => m.title).join(', '), repo: h.repo, name: h.name, kept: h.kept }),
                )}
                what={t('install.what.loadout')}
                label={t('install.loadout.copyAll')}
                className="loadout-copy"
              />
              <button type="button" className="btn btn-primary loadout-see" onClick={openLoadout}>
                <span className="loadout-see-long">{t('install.loadout.see')}</span>
                <span className="loadout-see-short">{t('install.loadout.seeShort')}</span>
              </button>
            </div>
          </m.aside>
        ) : null}
      </AnimatePresence>
      {mods.length ? <div className="loadout-spacer" aria-hidden="true" /> : null}
      {sheetOpen ? (
        <Suspense fallback={null}>
          <LoadoutSheet onClose={() => back()} />
        </Suspense>
      ) : null}
    </>
  )
}
