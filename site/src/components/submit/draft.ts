// The entry builder's state (a form-friendly draft of mods/<name>/mod.json) and its two
// conversions: draft → the JSON a contributor commits, and any pasted mod.json → draft.
import type { Category, PreviewElement, Row, Segment, Slot, Surface, Turn } from '../../data/types'

export type SourceType = 'github' | 'marketplace' | 'git' | 'hosted'
export type SceneChoice = '' | 'coding' | 'debugging' | 'review' | 'idle'

export type Draft = {
  name: string
  title: string
  tagline: string
  tagline_ru: string
  description: string
  description_ru: string
  category: Category | ''
  tags: string[]
  license: string
  version: string
  homepage: string
  source: {
    type: SourceType
    repo: string
    path: string
    ref: string
    sha: string
    url: string
    marketplace: string
    plugin: string
  }
  author: { name: string; github: string; url: string }
  maintainers: string[]
  surfaces: Surface[]
  requires: string
  preview: {
    scene: SceneChoice
    surface: '' | 'terminal' | 'desktop'
    caption: string
    caption_ru: string
    elements: PreviewElement[]
    /** Kept from a pasted entry; the builder has no editor for it. */
    transcript?: Turn[]
  }
  /** Fields of a pasted entry the builder has no inputs for, kept as they are. */
  extra: { capabilities?: unknown; media?: unknown }
}

export const CATEGORIES: Category[] = ['interface', 'insights', 'safety', 'productivity', 'git', 'integrations', 'fun', 'accessibility']
export const SURFACES: Surface[] = ['terminal', 'desktop', 'vscode', 'mobile']
export const SCENES: Exclude<SceneChoice, ''>[] = ['coding', 'debugging', 'review', 'idle']
export const SOURCE_TYPES: SourceType[] = ['github', 'marketplace', 'git', 'hosted']

/** Slots grouped the way the element picker shows them. */
export const SLOT_GROUPS: { key: 'around' | 'windows' | 'transcript' | 'hidden'; slots: Slot[] }[] = [
  { key: 'around', slots: ['above-prompt', 'status', 'prompt-hint', 'session-mode', 'spinner'] },
  { key: 'windows', slots: ['pane', 'toast', 'notification', 'info-notice'] },
  { key: 'transcript', slots: ['command', 'tool-row', 'tool-deny', 'message', 'model-tool', 'turn-duration', 'prompt-rewrite'] },
  { key: 'hidden', slots: ['background'] },
]

/** Theme tokens a color may name (schema $defs.color). */
export const THEME_COLORS = [
  'claude',
  'text',
  'secondary',
  'inactive',
  'subtle',
  'success',
  'error',
  'warning',
  'permission',
  'suggestion',
  'plan',
  'ide',
  'remember',
  'background',
] as const

export const MAX_ELEMENTS = 10
export const MAX_ROWS = 30
export const MAX_SEGMENTS = 24

/** A starting element for each slot: short placeholder text the contributor replaces. */
export function newElement(slot: Slot): PreviewElement {
  switch (slot) {
    case 'above-prompt':
      return { slot, rows: [[{ text: 'Your band', bold: true }, ' · ', { text: 'what it shows', dim: true }, ' ', { button: 'Hide', hotkey: 'h' }]] }
    case 'pane':
      return { slot, title: 'Pane title', width: 'narrow', rows: [['First row of the pane']] }
    case 'status':
      return { slot, text: 'Status entry' }
    case 'toast':
      return { slot, text: 'Toast text' }
    case 'notification':
      return { slot, title: 'Claude Code', text: 'Notification text' }
    case 'command':
      return { slot, command: '/your-command', output: [['What the command answers']] }
    case 'tool-deny':
      return { slot, tool: 'Bash', input: 'cat .env', message: 'Why the mod refused the call' }
    case 'prompt-rewrite':
      return { slot, before: 'What the person typed', after: 'What the mod sent instead' }
    case 'spinner':
      return { slot, verb: 'Working' }
    case 'prompt-hint':
      return { slot, row: [{ text: '? for shortcuts', dim: true }, '  ', 'Your hint'] }
    case 'session-mode':
      return { slot, row: [{ text: 'your mode', color: 'claude' }] }
    case 'turn-duration':
      return { slot, text: 'Worked for 12s' }
    case 'tool-row':
      return { slot, tool: 'Read', input: 'src/index.ts', result: [['Read 42 lines']] }
    case 'message':
      return { slot, role: 'assistant', rows: [['A message the mod added']] }
    case 'info-notice':
      return { slot, row: [{ text: 'An info notice', dim: true }] }
    case 'model-tool':
      return { slot, name: 'your_tool', input: 'query', result: [['What the tool returned']] }
    case 'background':
      return { slot, text: 'What the mod does without drawing' }
  }
}

export function emptyDraft(): Draft {
  return {
    name: '',
    title: '',
    tagline: '',
    tagline_ru: '',
    description: '',
    description_ru: '',
    category: '',
    tags: [],
    license: 'MIT',
    version: '',
    homepage: '',
    source: { type: 'github', repo: '', path: '', ref: '', sha: '', url: '', marketplace: '', plugin: '' },
    author: { name: '', github: '', url: '' },
    maintainers: [],
    surfaces: [],
    requires: '',
    preview: { scene: 'coding', surface: '', caption: '', caption_ru: '', elements: [newElement('above-prompt')] },
    extra: {},
  }
}

// ── draft → mod.json ──────────────────────────────────────────────────────────────────

type Obj = Record<string, unknown>

function put(o: Obj, key: string, v: unknown): void {
  if (v === undefined || v === null) return
  if (typeof v === 'string' && v.trim() === '') return
  if (Array.isArray(v) && v.length === 0) return
  o[key] = typeof v === 'string' ? v.trim() : v
}

/** A segment as the schema writes it: plain text without styles becomes a string. */
export function cleanSegment(s: Segment): Segment {
  if (typeof s === 'string') return s
  if ('text' in s) {
    const o: Obj = { text: s.text }
    if (s.color) o.color = s.color
    if (s.bg) o.bg = s.bg
    for (const k of ['bold', 'dim', 'italic', 'underline', 'inverse'] as const) if (s[k]) o[k] = true
    return Object.keys(o).length === 1 ? s.text : (o as Segment)
  }
  if ('button' in s) {
    const o: Obj = { button: s.button }
    if (s.variant) o.variant = s.variant
    if (s.hotkey) o.hotkey = s.hotkey
    return o as Segment
  }
  if ('bar' in s) {
    const o: Obj = { bar: s.bar }
    if (s.width !== undefined) o.width = s.width
    if (s.color) o.color = s.color
    return o as Segment
  }
  if ('spark' in s) {
    const o: Obj = { spark: s.spark }
    if (s.color) o.color = s.color
    return o as Segment
  }
  return s
}

const cleanRow = (r: Row): Row => r.map(cleanSegment)
const cleanRows = (rows: Row[]): Row[] => rows.map(cleanRow)

export function cleanElement(el: PreviewElement): PreviewElement {
  const o: Obj = { slot: el.slot }
  switch (el.slot) {
    case 'above-prompt':
      o.rows = cleanRows(el.rows)
      break
    case 'pane':
      o.title = el.title
      o.rows = cleanRows(el.rows)
      put(o, 'width', el.width)
      break
    case 'status':
    case 'toast':
    case 'turn-duration':
    case 'background':
      o.text = el.text
      break
    case 'notification':
      put(o, 'title', el.title)
      o.text = el.text
      break
    case 'command':
      o.command = el.command
      put(o, 'args', el.args)
      if (el.output) o.output = cleanRows(el.output)
      put(o, 'markdown', el.markdown)
      break
    case 'tool-deny':
      o.tool = el.tool
      o.input = el.input
      o.message = el.message
      break
    case 'prompt-rewrite':
      o.before = el.before
      o.after = el.after
      break
    case 'spinner':
      put(o, 'glyphs', el.glyphs)
      o.verb = el.verb
      put(o, 'color', el.color)
      break
    case 'prompt-hint':
    case 'session-mode':
    case 'info-notice':
      o.row = cleanRow(el.row)
      break
    case 'tool-row':
      o.tool = el.tool
      o.input = el.input
      if (el.row) o.row = cleanRow(el.row)
      if (el.result) o.result = cleanRows(el.result)
      break
    case 'message':
      o.role = el.role
      if (el.rows) o.rows = cleanRows(el.rows)
      put(o, 'markdown', el.markdown)
      break
    case 'model-tool':
      o.name = el.name
      put(o, 'input', el.input)
      if (el.result) o.result = cleanRows(el.result)
      break
  }
  return o as PreviewElement
}

function sourceOut(s: Draft['source']): Obj {
  const o: Obj = { type: s.type }
  switch (s.type) {
    case 'github':
      o.repo = s.repo.trim()
      put(o, 'path', s.path)
      put(o, 'ref', s.ref)
      put(o, 'sha', s.sha)
      break
    case 'git':
      o.url = s.url.trim()
      put(o, 'path', s.path)
      put(o, 'ref', s.ref)
      put(o, 'sha', s.sha)
      break
    case 'marketplace':
      o.marketplace = s.marketplace.trim()
      put(o, 'plugin', s.plugin)
      put(o, 'repo', s.repo)
      put(o, 'path', s.path)
      break
    case 'hosted':
      break
  }
  return o
}

export function previewOut(p: Draft['preview']): Obj {
  const o: Obj = {}
  put(o, 'scene', p.scene)
  if (p.transcript && p.transcript.length) o.transcript = p.transcript
  put(o, 'surface', p.surface)
  put(o, 'caption', p.caption)
  put(o, 'caption_ru', p.caption_ru)
  o.elements = p.elements.map(cleanElement)
  return o
}

/** The mod.json object, in the key order the catalog's entries use. */
export function toEntry(d: Draft): Obj {
  const e: Obj = { $schema: '../../schema/mod.schema.json' }
  e.name = d.name.trim()
  e.title = d.title.trim()
  e.tagline = d.tagline.trim()
  put(e, 'tagline_ru', d.tagline_ru)
  e.description = d.description.trim()
  put(e, 'description_ru', d.description_ru)
  const author: Obj = { name: d.author.name.trim() }
  put(author, 'github', d.author.github)
  put(author, 'url', d.author.url)
  e.author = author
  e.maintainers = d.maintainers
  e.category = d.category
  put(e, 'tags', d.tags)
  e.license = d.license.trim()
  put(e, 'version', d.version)
  put(e, 'homepage', d.homepage)
  e.source = sourceOut(d.source)
  put(e, 'surfaces', d.surfaces)
  if (d.requires.trim()) e.requires = { claudeCode: d.requires.trim() }
  if (d.extra.capabilities !== undefined) e.capabilities = d.extra.capabilities
  e.preview = previewOut(d.preview)
  if (d.extra.media !== undefined) e.media = d.extra.media
  return e
}

export function entryJson(d: Draft): string {
  return `${JSON.stringify(toEntry(d), null, 2)}\n`
}

// ── any object → draft (a pasted mod.json, a saved draft) ─────────────────────────────

const str = (v: unknown): string => (typeof v === 'string' ? v : typeof v === 'number' ? String(v) : '')
const isObj = (v: unknown): v is Obj => !!v && typeof v === 'object' && !Array.isArray(v)
const strList = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [])

function isElement(v: unknown): v is PreviewElement {
  return isObj(v) && typeof v.slot === 'string' && SLOT_GROUPS.some((g) => g.slots.includes(v.slot as Slot))
}

export function fromEntry(v: unknown): Draft {
  const d = emptyDraft()
  if (!isObj(v)) return d
  d.name = str(v.name)
  d.title = str(v.title)
  d.tagline = str(v.tagline)
  d.tagline_ru = str(v.tagline_ru)
  d.description = str(v.description)
  d.description_ru = str(v.description_ru)
  d.category = CATEGORIES.includes(v.category as Category) ? (v.category as Category) : ''
  d.tags = strList(v.tags)
  d.license = str(v.license)
  d.version = str(v.version)
  d.homepage = str(v.homepage)
  if (isObj(v.source)) {
    const s = v.source
    const type = SOURCE_TYPES.includes(s.type as SourceType) ? (s.type as SourceType) : 'github'
    d.source = {
      type,
      repo: str(s.repo),
      path: str(s.path),
      ref: str(s.ref),
      sha: str(s.sha),
      url: str(s.url),
      marketplace: str(s.marketplace),
      plugin: str(s.plugin),
    }
  }
  if (isObj(v.author)) d.author = { name: str(v.author.name), github: str(v.author.github), url: str(v.author.url) }
  d.maintainers = strList(v.maintainers)
  d.surfaces = strList(v.surfaces).filter((s): s is Surface => SURFACES.includes(s as Surface))
  d.requires = isObj(v.requires) ? str(v.requires.claudeCode) : ''
  if (v.capabilities !== undefined) d.extra.capabilities = v.capabilities
  if (v.media !== undefined) d.extra.media = v.media
  if (isObj(v.preview)) {
    const p = v.preview
    d.preview = {
      scene: SCENES.includes(p.scene as Exclude<SceneChoice, ''>) ? (p.scene as SceneChoice) : '',
      surface: p.surface === 'terminal' || p.surface === 'desktop' ? p.surface : '',
      caption: str(p.caption),
      caption_ru: str(p.caption_ru),
      elements: Array.isArray(p.elements) ? p.elements.filter(isElement) : [],
      transcript: Array.isArray(p.transcript) ? (p.transcript as Turn[]) : undefined,
    }
  }
  return d
}

// ── small helpers ─────────────────────────────────────────────────────────────────────

/** Splits "a, b c" into ["a", "b", "c"]. */
export function splitList(text: string): string[] {
  return text
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter(Boolean)
}

/** "My Cool Mod" → "my-cool-mod" (the schema's name pattern). */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50)
    .replace(/-+$/g, '')
}

const RESERVED_PREFIXES = ['claude-', 'anthropic-', 'anthropics-', 'cc-plugin-']
const RESERVED_NAMES = ['claude', 'anthropic', 'anthropics', 'claude-code', 'claude-mods']

/** The plugin-name rules `claude plugin validate` adds to the schema (scripts/lib/catalog.mjs). */
export function reservedName(name: string): { kind: 'name' } | { kind: 'prefix'; prefix: string } | null {
  const lower = name.toLowerCase()
  if (RESERVED_NAMES.includes(lower)) return { kind: 'name' }
  const prefix = RESERVED_PREFIXES.find((p) => lower.startsWith(p))
  return prefix ? { kind: 'prefix', prefix } : null
}
