// A modal sheet: right side from 1024px, full screen below. Focus moves in and is trapped,
// Esc and the scrim close it (after a short exit), the page behind does not scroll, and
// focus returns to where it was. The owner decides what "close" means (router back()).
import { m } from 'motion/react'
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { useMediaQuery } from '../../lib/hooks'
import { duration, ease } from '../../lib/motion'
import { useMotionPref } from '../../lib/motionPref'
import { IconClose } from '../ui/icons'
import './detail.css'

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), video[controls], [tabindex]:not([tabindex="-1"])'

let locks = 0
/** Stops the page behind from scrolling; pads the body by the scrollbar's width so nothing shifts. */
function lockScroll(): () => void {
  const html = document.documentElement
  const body = document.body
  if (locks++ === 0) {
    const bar = window.innerWidth - html.clientWidth
    html.style.overflow = 'hidden'
    if (bar > 0) body.style.paddingRight = `${bar}px`
  }
  return () => {
    if (--locks === 0) {
      html.style.overflow = ''
      body.style.paddingRight = ''
    }
  }
}

function focusables(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.getClientRects().length > 0 && !el.closest('[inert]'))
}

export type SheetProps = {
  labelledBy: string
  /** Runs after the exit animation (close button, Esc, scrim). */
  onClose: () => void
  closeLabel: string
  /** Title area of the sticky head. */
  head: ReactNode
  /** Controls placed before the close button. */
  actions?: ReactNode
  /**
   * Opened from a card: the panel does not slide; its background and content fade in
   * (CSS, data-morph) while the owner grows the mock frame out of the card.
   */
  morph?: boolean
  className?: string
  children: ReactNode
}

export default function Sheet({ labelledBy, onClose, closeLabel, head, actions, morph = false, className, children }: SheetProps) {
  const panel = useRef<HTMLDivElement>(null)
  const closeRef = useRef(onClose)
  useLayoutEffect(() => {
    closeRef.current = onClose
  })
  const [leaving, setLeaving] = useState(false)
  const leavingRef = useRef(false)
  const wide = useMediaQuery('(min-width: 1024px)', true)
  const { still } = useMotionPref()

  const close = useCallback(() => {
    if (leavingRef.current) return
    leavingRef.current = true
    setLeaving(true)
    window.setTimeout(() => closeRef.current(), still ? 0 : duration.exit * 1000 + 20)
  }, [still])

  useLayoutEffect(() => lockScroll(), [])

  useEffect(() => {
    const before = document.activeElement as HTMLElement | null
    panel.current?.focus({ preventScroll: true })
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return
      // An open popover (install panel) takes Esc first.
      if (document.querySelector(':popover-open')) return
      e.preventDefault()
      close()
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      if (before && before.isConnected) before.focus({ preventScroll: true })
    }
  }, [close])

  const trap = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Tab' || !panel.current) return
    const list = focusables(panel.current)
    if (!list.length) {
      e.preventDefault()
      return
    }
    const first = list[0]
    const last = list[list.length - 1]
    const at = document.activeElement
    if (e.shiftKey && (at === first || at === panel.current)) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && at === last) {
      e.preventDefault()
      first.focus()
    }
  }

  const from = morph ? false : wide ? { opacity: 0, x: 48 } : { opacity: 0, y: 28 }
  const to = { opacity: 1, x: 0, y: 0 }
  const out = wide ? { opacity: 0, x: 24 } : { opacity: 0, y: 16 }

  return (
    <div className="sheet-root">
      <m.div
        className="sheet-scrim"
        aria-hidden="true"
        initial={{ opacity: 0 }}
        animate={{ opacity: leaving ? 0 : 1 }}
        transition={leaving ? { duration: duration.exit, ease: ease.in } : { duration: duration.enter, ease: ease.out }}
        onClick={close}
      />
      <m.div
        ref={panel}
        className={['sheet', className].filter(Boolean).join(' ')}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
        data-morph={morph || undefined}
        onKeyDown={trap}
        initial={from}
        animate={leaving ? out : to}
        transition={leaving ? { duration: duration.exit, ease: ease.in } : { duration: duration.enter + 0.04, ease: ease.out }}
      >
        <div className="sheet-head">
          <div className="sheet-head-main">{head}</div>
          <div className="sheet-head-actions">
            {actions}
            <button type="button" className="sheet-close" aria-label={closeLabel} title={closeLabel} onClick={close}>
              <IconClose size={18} />
            </button>
          </div>
        </div>
        <div className="sheet-body">{children}</div>
      </m.div>
    </div>
  )
}
