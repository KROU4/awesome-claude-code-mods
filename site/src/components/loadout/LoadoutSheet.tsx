// "See them together": every mod of the loadout merged into one MockClient session, the
// list of picked mods, and the install lines: for a shell (one block, Copy) or for a Claude
// Code session (one line at a time, each with its own Copy: a pasted block would be sent as
// one prompt).
// Lazy-loaded by LoadoutBar for the #/loadout history entry.
import { useId, useMemo, useState } from 'react'
import { useT, type TKey } from '../../i18n'
import { loadoutLines, loadoutPlan, type HeldBack } from '../../lib/install'
import { useLoadout } from '../../lib/loadout'
import { hrefFor } from '../../lib/router'
import { WorksOn } from '../catalog/bits'
import { fullPreview } from '../catalog/cardPreview'
import { ON_SCREEN_FROM_START } from '../hero/heroSession'
import { isPlainClick, openMod } from '../catalog/nav'
import Sheet from '../detail/Sheet'
import { Cmd, CmdLines } from '../install/InstallPanel'
import { MockClient } from '../mock'
import CopyButton from '../ui/CopyButton'
import { IconClose } from '../ui/icons'
import { useLoadoutMods } from './useLoadoutMods'
import './loadout.css'

type Form = 'terminal' | 'shell'

export default function LoadoutSheet({ onClose }: { onClose: () => void }) {
  const { t, pick } = useT()
  const { remove, clear } = useLoadout()
  const mods = useLoadoutMods()
  const titleId = useId()
  const [form, setForm] = useState<Form>('shell')
  const previews = useMemo(() => mods.map(fullPreview), [mods])
  const heldNote = (h: HeldBack) => t('install.loadout.held', { mods: h.mods.map((m) => m.title).join(', '), repo: h.repo, name: h.name, kept: h.kept })
  const { held } = loadoutPlan(mods, form)
  const lines = loadoutLines(mods, form, heldNote)
  const commands = lines.join('\n')

  return (
    <Sheet
      labelledBy={titleId}
      onClose={onClose}
      closeLabel={t('catalog.detail.close')}
      head={
        <h2 id={titleId} className="lo-title">
          {t('install.loadout.sheetTitle')}
        </h2>
      }
      className="lo-sheet"
    >
      {mods.length === 0 ? (
        <p className="lo-empty">{t('install.loadout.empty')}</p>
      ) : (
        <div className="lo">
          <p className="lo-lead">{t('install.loadout.sheetLead')}</p>
          {/* the finished session first (it matches what the cards show); Play runs it, with the
              bands, status entries, hints and modes on screen from the start */}
          <MockClient previews={previews} scene="coding" rows={24} arriveAtStart={ON_SCREEN_FROM_START} autoPlay={false} />

          <div className="lo-cols">
            <section className="lo-section" aria-labelledby={`${titleId}-mods`}>
              <h3 id={`${titleId}-mods`} className="lo-h">
                {t('install.loadout.mods')}
              </h3>
              <ul className="lo-list">
                {mods.map((m) => (
                  <li key={m.name} className="lo-item">
                    <div className="lo-item-main">
                      <a
                        className="lo-item-title"
                        href={hrefFor({ name: 'mod', mod: m.name })}
                        onClick={(e) => {
                          if (!isPlainClick(e)) return
                          e.preventDefault()
                          openMod(m.name)
                        }}
                      >
                        {m.title}
                      </a>
                      <p className="lo-item-tag">{pick(m.tagline, m.tagline_ru)}</p>
                    </div>
                    <WorksOn mod={m} />
                    <button
                      type="button"
                      className="lo-item-x"
                      aria-label={t('install.loadout.remove', { title: m.title })}
                      title={t('install.loadout.remove', { title: m.title })}
                      onClick={() => remove(m.name)}
                    >
                      <IconClose size={16} />
                    </button>
                  </li>
                ))}
              </ul>
              <button type="button" className="lo-clear" onClick={clear}>
                {t('install.loadout.clear')}
              </button>
            </section>

            <section className="lo-section" aria-labelledby={`${titleId}-cmds`}>
              <h3 id={`${titleId}-cmds`} className="lo-h">
                {t('install.loadout.commands')}
              </h3>
              <div className="lo-form" role="group" aria-label={t('install.tabs')}>
                {(['shell', 'terminal'] as const).map((f) => (
                  <button key={f} type="button" className="lo-form-btn" aria-pressed={form === f} onClick={() => setForm(f)}>
                    {t(`install.tab.${f}` as TKey)}
                  </button>
                ))}
              </div>
              <p className="lo-note">
                {t('install.loadout.commandsLead')} {form === 'shell' ? t('install.loadout.shellLead') : t('install.loadout.terminalLead')}
              </p>
              {form === 'shell' ? (
                <>
                  <Cmd text={commands} what={t('install.what.loadout')} copy={false} />
                  <CopyButton text={commands} what={t('install.what.loadout')} label={t('install.loadout.copyAll')} variant="solid" className="lo-copy" />
                </>
              ) : (
                <CmdLines lines={lines} what={t('install.what.command')} />
              )}
              {held.map((h) => (
                <p key={`${h.name}-${h.repo}`} className="lo-note lo-held" role="note">
                  {heldNote(h)}
                </p>
              ))}
            </section>
          </div>
        </div>
      )}
    </Sheet>
  )
}
