// The live preview of the draft: a MockClient fed with the entry's `preview`, made safe to
// draw while it is half-typed (numbers clamped, broken pieces skipped), behind an error
// boundary so a bad value can never take the page down.
import { useMemo, useState } from 'react'
import { useT } from '../../i18n'
import type { Preview, PreviewElement, Row, Segment } from '../../data/types'
import { useMediaQuery } from '../../lib/hooks'
import { MockClient, type PreviewInput } from '../mock'
import Boundary from '../ui/Boundary'

function safeSegment(s: Segment): Segment | null {
  if (typeof s === 'string') return s
  if (!s || typeof s !== 'object') return null
  if ('text' in s) return { ...s, text: String(s.text ?? '') }
  if ('button' in s) return { ...s, button: String(s.button ?? '') }
  if ('bar' in s) {
    const v = Number(s.bar)
    const w = s.width === undefined ? undefined : Math.round(Number(s.width))
    return {
      ...s,
      bar: Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0,
      width: w === undefined || !Number.isFinite(w) ? undefined : Math.min(40, Math.max(4, w)),
    }
  }
  if ('spark' in s) {
    const vals = (Array.isArray(s.spark) ? s.spark : []).map(Number).filter((n) => Number.isFinite(n))
    return vals.length >= 2 ? { ...s, spark: vals.slice(0, 60) } : null
  }
  if ('link' in s) return { link: String(s.link ?? ''), href: String(s.href ?? '') }
  if ('kbd' in s) return { kbd: String(s.kbd ?? '') }
  return null
}

const safeRow = (r: Row | undefined): Row => (Array.isArray(r) ? r.map(safeSegment).filter((x): x is Segment => x !== null) : [])
const safeRows = (rs: Row[] | undefined): Row[] | undefined => (Array.isArray(rs) ? rs.map(safeRow) : undefined)

function safeElement(e: PreviewElement): PreviewElement {
  switch (e.slot) {
    case 'above-prompt':
    case 'pane':
      return { ...e, rows: safeRows(e.rows) ?? [] }
    case 'prompt-hint':
    case 'session-mode':
    case 'info-notice':
      return { ...e, row: safeRow(e.row) }
    case 'tool-row':
      return { ...e, row: e.row ? safeRow(e.row) : undefined, result: safeRows(e.result) }
    case 'command':
      return { ...e, output: safeRows(e.output) }
    case 'message':
      return { ...e, rows: safeRows(e.rows) }
    case 'model-tool':
      return { ...e, result: safeRows(e.result) }
    case 'spinner':
      return { ...e, glyphs: e.glyphs && e.glyphs.length ? e.glyphs : undefined }
    default:
      return e
  }
}

export default function PreviewPane({ preview, name, title }: { preview: Preview; name: string; title: string }) {
  const { t, pick } = useT()
  const wide = useMediaQuery('(min-width: 1100px)')
  const [play, setPlay] = useState(false)
  const previews = useMemo<PreviewInput[]>(
    () => [{ ...preview, elements: preview.elements.map(safeElement), id: name || 'your-mod', label: title || t('submit.preview.unnamed') }],
    [preview, name, title, t],
  )
  const key = useMemo(() => JSON.stringify(preview), [preview])
  const caption = pick(preview.caption ?? '', preview.caption_ru)
  return (
    <figure className="sb-preview">
      <Boundary resetKey={key} fallback={<p className="sb-hint sb-preview-broken">{t('submit.preview.broken')}</p>}>
        <MockClient
          previews={previews}
          play={play}
          onPlayChange={setPlay}
          loop={false}
          rows={wide ? 16 : 18}
          defaultSurface={preview.surface ?? 'terminal'}
          className="sb-mock"
        />
      </Boundary>
      {caption ? <figcaption className="sb-preview-caption">{caption}</figcaption> : null}
    </figure>
  )
}
