// "Not drawn in VS Code: Band above the prompt, Status line" — shown under the mock when the
// selected surface skips some of the mods' elements, instead of faking them.
import { useT, type TKey } from '../../i18n'
import type { Slot } from '../../data/types'
import type { MockSurface } from './types'

export default function NotDrawnNote({ surface, slots }: { surface: MockSurface; slots: Slot[] }) {
  const { t } = useT()
  if (!slots.length) return null
  const what = t(`mock.notDrawn.${surface}` as TKey)
  const list = slots.map((s) => t(`common.slot.${s}` as TKey)).join(', ')
  return (
    <p className="mc-note">
      <span className="mc-note-mark" aria-hidden="true" />
      {t('mock.notDrawn.list', { what, slots: list })}
    </p>
  )
}
