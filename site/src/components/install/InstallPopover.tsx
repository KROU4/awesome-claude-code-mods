// The card's Install button and its popover (native popover="auto": top layer, Esc and
// click-outside close it, focus returns to the button). Anchored under the button on wide
// screens; a bottom sheet on phones.
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { useT } from '../../i18n'
import type { SiteMod } from '../../data/types'
import { IconClose } from '../ui/icons'
import InstallPanel from './InstallPanel'
import './install.css'

const GAP = 8
const MARGIN = 12
const SHEET_BELOW = 640

function ChevronDown() {
  return (
    <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="m5.5 8 4.5 4.5L14.5 8" />
    </svg>
  )
}

export type InstallPopoverProps = {
  mod: SiteMod
  className?: string
}

export default function InstallPopover({ mod, className }: InstallPopoverProps) {
  const { t } = useT()
  const id = `install-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`
  const titleId = `${id}-title`
  const btn = useRef<HTMLButtonElement>(null)
  const pop = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)

  const place = useCallback(() => {
    const b = btn.current
    const p = pop.current
    if (!b || !p) return
    const vw = window.innerWidth
    const vh = window.innerHeight
    p.dataset.placed = ''
    if (vw < SHEET_BELOW) {
      p.dataset.placement = 'sheet'
      p.style.removeProperty('top')
      p.style.removeProperty('left')
      return
    }
    const r = b.getBoundingClientRect()
    const w = p.offsetWidth
    const h = p.offsetHeight
    const below = vh - r.bottom - GAP - MARGIN
    const above = r.top - GAP - MARGIN
    const top = below >= h || below >= above ? Math.min(r.bottom + GAP, vh - MARGIN - h) : Math.max(MARGIN, r.top - GAP - h)
    const left = Math.min(Math.max(MARGIN, r.left), vw - MARGIN - w)
    p.dataset.placement = top >= r.bottom ? 'below' : 'above'
    p.style.top = `${Math.max(MARGIN, top)}px`
    p.style.left = `${left}px`
  }, [])

  useEffect(() => {
    const p = pop.current
    if (!p) return
    const onToggle = (e: Event) => {
      const isOpen = (e as ToggleEvent).newState === 'open'
      if (!isOpen) delete p.dataset.placed
      setOpen(isOpen)
    }
    p.addEventListener('toggle', onToggle)
    return () => p.removeEventListener('toggle', onToggle)
  }, [])

  // Place once the panel is in the DOM (its height is known), then follow scroll and resize.
  useLayoutEffect(() => {
    if (!open) return
    place()
    pop.current?.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]')?.focus()
    const ro = new ResizeObserver(place)
    if (pop.current) ro.observe(pop.current)
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [open, place])

  return (
    <>
      <button
        ref={btn}
        type="button"
        className={['install-trigger', className].filter(Boolean).join(' ')}
        popoverTarget={id}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={t('catalog.card.installAria', { title: mod.title })}
      >
        <span>{t('catalog.card.install')}</span>
        <ChevronDown />
      </button>
      <div ref={pop} id={id} popover="auto" role="dialog" aria-labelledby={titleId} className="install-pop">
        <div className="install-pop-head">
          <p id={titleId} className="install-pop-title">
            {t('install.for', { title: mod.title })}
          </p>
          <button type="button" className="install-pop-close" popoverTarget={id} popoverTargetAction="hide" aria-label={t('catalog.detail.close')}>
            <IconClose size={16} />
          </button>
        </div>
        {open ? <InstallPanel mod={mod} variant="popover" /> : null}
      </div>
    </>
  )
}
