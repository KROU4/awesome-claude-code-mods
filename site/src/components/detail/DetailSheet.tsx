// DetailSheet — STUB with the final props. Owner: Detail agent (see src/CONTRACTS.md).
// Lazy-loaded by App for #/mod/<name>. Final: right-side sheet ≥ 1024px, full-screen sheet on
// phones; focus-trapped; Esc closes; history-aware (onClose → router back()). Contents: big
// MockClient (surface tabs, terminal theme, Replay), caption, description, "Works on" chips
// (availability.ts worksOn), InstallPanel, "What it touches" (analysis + capabilities),
// trust line, meta (author, license, version, requires, dates, source, editUrl), media.
// Shared element: the card's mock frame → this sheet's mock via MockClient `layoutId`
// (load domMax: <LazyMotion features={domMax}> around the sheet).
import { useEffect, useMemo, useRef } from 'react'
import { MockClient, type PreviewInput } from '../mock'
import InstallPanel from '../install/InstallPanel'
import { IconClose } from '../ui/icons'
import { useT } from '../../i18n'
import { useMod } from '../../lib/registry'
import './detail.css'

export type DetailSheetProps = {
  /** Mod name from the route #/mod/<name>. Unknown names show a "not found" sheet. */
  name: string
  /** Close: App passes the router's back(), so the browser Back button agrees. */
  onClose: () => void
}

export default function DetailSheet({ name, onClose }: DetailSheetProps) {
  const { t, pick } = useT()
  const mod = useMod(name)
  const panel = useRef<HTMLDivElement>(null)
  const previews = useMemo<PreviewInput[]>(() => (mod ? [{ ...mod.preview, id: mod.name, label: mod.title }] : []), [mod])

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null
    panel.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    document.documentElement.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.documentElement.style.overflow = ''
      prev?.focus?.()
    }
  }, [onClose])

  return (
    <div className="sheet-stub-scrim" onClick={onClose}>
      <div
        ref={panel}
        className="sheet-stub"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sheet-title"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" className="sheet-stub-close" aria-label={t('catalog.detail.close')} onClick={onClose}>
          <IconClose />
        </button>
        {mod ? (
          <>
            <h2 id="sheet-title">{mod.title}</h2>
            <p className="sheet-stub-tag">{pick(mod.tagline, mod.tagline_ru)}</p>
            <MockClient previews={previews} fullscreen={false} rows={22} />
            <InstallPanel mod={mod} />
          </>
        ) : (
          <h2 id="sheet-title">{t('catalog.detail.notFound', { name })}</h2>
        )}
      </div>
    </div>
  )
}
