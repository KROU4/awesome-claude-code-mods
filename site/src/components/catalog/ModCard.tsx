// ModCard: the mod's most characteristic element in a compact terminal crop, then title,
// tagline, chips, author, Hosted/External and stars ("Works on" is a catalog filter and a row
// in the detail sheet: three unlabelled icons on a card said little); Install opens a popover,
// "Add to loadout" toggles. The title link covers the card and opens #/mod/<name>; the
// sheet's mock frame grows out of this card's frame (nav.ts origin, DetailSheet FLIP).
import { memo, useMemo, useRef } from 'react'
import { useT, type TKey } from '../../i18n'
import { hrefFor } from '../../lib/router'
import type { SiteMod, Slot } from '../../data/types'
import { MockClient } from '../mock'
import InstallPopover from '../install/InstallPopover'
import Boundary from '../ui/Boundary'
import { Avatar, CategoryDot, LoadoutToggle, SourceBadge, Stars } from './bits'
import { CARD_ROWS, cardPreview } from './cardPreview'
import { isPlainClick, openMod } from './nav'

const SHOWN_SLOTS = 2

function visibleSlots(mod: SiteMod): Slot[] {
  return mod.slots.filter((s) => s !== 'background')
}

function ModCard({ mod, headingLevel = 3 }: { mod: SiteMod; headingLevel?: 2 | 3 }) {
  const { t, pick } = useT()
  const previews = useMemo(() => [cardPreview(mod)], [mod])
  const frame = useRef<HTMLDivElement>(null)
  const slots = visibleSlots(mod)
  const shown = slots.slice(0, SHOWN_SLOTS)
  const rest = slots.slice(SHOWN_SLOTS)
  const H = headingLevel === 2 ? 'h2' : 'h3'
  const slotName = (s: Slot) => t(`common.slot.${s}` as TKey)

  return (
    <article className="mod-card" data-category={mod.category}>
      <div className="mod-card-mock" ref={frame}>
        {/* one preview the mock cannot draw (a newer registry than this build) costs one card's picture, not the page */}
        <Boundary resetKey={mod.name} fallback={<p className="mod-card-mock-failed">{t('common.error.preview')}</p>}>
          <MockClient previews={previews} compact rows={CARD_ROWS} notes={false} label={t('catalog.card.preview', { title: mod.title })} />
        </Boundary>
      </div>

      <div className="mod-card-body">
        <div className="mod-card-head">
          <H className="mod-card-title">
            <a
              className="mod-card-link"
              href={hrefFor({ name: 'mod', mod: mod.name })}
              onClick={(e) => {
                if (!isPlainClick(e)) return
                e.preventDefault()
                openMod(mod.name, { from: frame.current?.querySelector('.mc-window') })
              }}
            >
              {mod.title}
            </a>
          </H>
          <Stars n={mod.stars} />
        </div>

        <p className="mod-card-tagline">{pick(mod.tagline, mod.tagline_ru)}</p>

        <ul className="mod-card-chips">
          <li className="chip chip-cat">
            <CategoryDot category={mod.category} />
            {t(`common.category.${mod.category}` as TKey)}
          </li>
          {shown.map((s) => (
            <li key={s} className="chip">
              {slotName(s)}
            </li>
          ))}
          {rest.length ? (
            <li className="chip chip-more" title={t('catalog.card.moreTitle', { list: rest.map(slotName).join(', ') })}>
              <span aria-hidden="true">{t('catalog.card.more', { n: rest.length })}</span>
              <span className="sr-only">{t('catalog.card.moreTitle', { list: rest.map(slotName).join(', ') })}</span>
            </li>
          ) : null}
        </ul>

        <div className="mod-card-meta">
          <span className="mod-card-author">
            <Avatar name={mod.author.name} login={mod.author.github} />
            <span className="mod-card-author-name">{mod.author.name}</span>
          </span>
          <SourceBadge mod={mod} />
        </div>

        <div className="mod-card-actions">
          <InstallPopover mod={mod} />
          <LoadoutToggle mod={mod} />
        </div>
      </div>
    </article>
  )
}

export default memo(ModCard)
