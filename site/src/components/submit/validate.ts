// Validation of a draft entry against schema/mod.schema.json, the same schema CI uses.
// ajv and the schema load lazily (their own chunk), the first time the builder is near.
//
// The schema's `oneOf`s (source, preview element, color) make ajv report every branch's
// errors; to point at the field that is actually wrong, each source and element is also
// checked against the one branch its `type` / `slot` names, and only those errors are kept.
import type { ErrorObject, ValidateFunction } from 'ajv/dist/2020'

export type Issue = {
  /** JSON pointer of the field, e.g. "/author/github", "/preview/elements/0/rows/0/2/hotkey". */
  path: string
  keyword: string
  params: Record<string, unknown>
}

export type Validator = (entry: unknown) => Issue[]

type Branchy = { oneOf: { properties: Record<string, { const?: string }> }[] }

/** Index of the $defs.segment.oneOf branch a segment means to be: string, text, button, bar, spark, link, kbd. */
function segmentBranch(s: unknown): number {
  if (typeof s === 'string') return 0
  if (!s || typeof s !== 'object') return 0
  if ('text' in s) return 1
  if ('button' in s) return 2
  if ('bar' in s) return 3
  if ('spark' in s) return 4
  if ('link' in s) return 5
  if ('kbd' in s) return 6
  return 1
}

/** Every segment of an element, with its JSON pointer (relative to the element). */
function segmentsOf(el: Record<string, unknown>): { path: string; seg: unknown }[] {
  const out: { path: string; seg: unknown }[] = []
  const row = (r: unknown, base: string) => {
    if (Array.isArray(r)) r.forEach((seg, i) => out.push({ path: `${base}/${i}`, seg }))
  }
  for (const key of ['rows', 'output', 'result']) {
    const v = el[key]
    if (Array.isArray(v)) v.forEach((r, i) => row(r, `/${key}/${i}`))
  }
  row(el.row, '/row')
  return out
}

let pending: Promise<Validator> | null = null

function toIssue(err: ErrorObject, base = ''): Issue {
  let path = base + err.instancePath
  const params = err.params as Record<string, unknown>
  if (err.keyword === 'required') path += `/${String(params.missingProperty)}`
  if (err.keyword === 'additionalProperties') path += `/${String(params.additionalProperty)}`
  return { path, keyword: err.keyword, params }
}

const SKIP = new Set(['oneOf', 'anyOf', 'if', 'not', '$ref'])

export function loadValidator(): Promise<Validator> {
  if (pending) return pending
  pending = (async () => {
    const [ajvMod, schemaMod] = await Promise.all([import('ajv/dist/2020'), import('@schema/mod.schema.json')])
    const Ajv2020 = ajvMod.default
    const schema = schemaMod.default as unknown as {
      $id: string
      properties: { source: Branchy }
      $defs: { element: Branchy }
    }
    const ajv = new Ajv2020({ allErrors: true, strict: false })
    ajv.addSchema(schema as object)
    const id = schema.$id
    const full = ajv.getSchema(id) as ValidateFunction

    const branches = (pointer: string, list: Branchy['oneOf'], key: string) => {
      const map = new Map<string, ValidateFunction>()
      list.forEach((b, i) => {
        const name = b.properties[key]?.const
        if (name) map.set(name, ajv.compile({ $ref: `${id}#${pointer}/${i}` }))
      })
      return map
    }
    const sourceBy = branches('/properties/source/oneOf', schema.properties.source.oneOf, 'type')
    const elementBy = branches('/$defs/element/oneOf', schema.$defs.element.oneOf, 'slot')
    const segmentBy = Array.from({ length: 7 }, (_, i) => ajv.compile({ $ref: `${id}#/$defs/segment/oneOf/${i}` }))

    return (entry: unknown): Issue[] => {
      const out: Issue[] = []
      full(entry)
      for (const err of full.errors ?? []) {
        const p = err.instancePath
        if (SKIP.has(err.keyword)) continue
        if (p === '/source' || p.startsWith('/source/')) continue
        if (/^\/preview\/elements\/\d+(\/|$)/.test(p)) continue
        out.push(toIssue(err))
      }

      const e = (entry ?? {}) as { source?: { type?: unknown }; preview?: { elements?: unknown } }
      if (e.source && typeof e.source === 'object') {
        const v = sourceBy.get(String(e.source.type))
        if (!v) out.push({ path: '/source/type', keyword: 'enum', params: {} })
        else if (!v(e.source)) for (const err of v.errors ?? []) if (!SKIP.has(err.keyword)) out.push(toIssue(err, '/source'))
      }
      const els = e.preview && Array.isArray(e.preview.elements) ? e.preview.elements : []
      els.forEach((el: unknown, i: number) => {
        const slot = el && typeof el === 'object' ? String((el as { slot?: unknown }).slot) : ''
        const v = elementBy.get(slot)
        const base = `/preview/elements/${i}`
        if (!v) {
          out.push({ path: `${base}/slot`, keyword: 'enum', params: {} })
          return
        }
        if (v(el)) return
        // Segments are a oneOf too: check each against the branch it means to be.
        const segs = segmentsOf(el as Record<string, unknown>)
        const inSeg = (p: string) => segs.some((s) => p === s.path || p.startsWith(`${s.path}/`))
        for (const err of v.errors ?? []) {
          if (SKIP.has(err.keyword) || inSeg(err.instancePath)) continue
          out.push(toIssue(err, base))
        }
        for (const s of segs) {
          const sv = segmentBy[segmentBranch(s.seg)]
          if (!sv(s.seg)) for (const err of sv.errors ?? []) if (!SKIP.has(err.keyword)) out.push(toIssue(err, base + s.path))
        }
      })

      // One message per field: a color fails both its enum and its pattern, for example.
      const seen = new Set<string>()
      return out.filter((x) => (seen.has(x.path) ? false : (seen.add(x.path), true)))
    }
  })()
  pending.catch(() => {
    pending = null
  })
  return pending
}

/** Issues for this field: its own path, or (with `deep`) anything under it. */
export function issuesAt(issues: readonly Issue[], path: string, deep = false): Issue[] {
  return issues.filter((x) => x.path === path || (deep && x.path.startsWith(`${path}/`)))
}

/** DOM id of a field's control, from its JSON pointer. */
export function fieldId(path: string): string {
  return `sb${path.replace(/[^A-Za-z0-9]+/g, '-')}`
}

/** Focuses the field of an issue, or the closest field above it. */
export function focusIssue(path: string): void {
  let p = path
  while (p) {
    const el = document.getElementById(fieldId(p))
    if (el) {
      el.scrollIntoView({ block: 'center' })
      el.focus({ preventScroll: true })
      return
    }
    p = p.slice(0, p.lastIndexOf('/'))
  }
}
