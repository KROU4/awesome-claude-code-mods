// Plain-language messages for schema issues, and the field name each issue belongs to.
import type { T, TKey } from '../../i18n'
import type { PreviewElement } from '../../data/types'
import type { Issue } from './validate'

/** Pattern failures, by the field they happen in (the schema's patterns, in words). */
const PATTERN_BY_PATH: [RegExp, TKey][] = [
  [/^\/name$/, 'submit.err.name'],
  [/^\/source\/plugin$/, 'submit.err.name'],
  [/^\/author\/github$|^\/maintainers\/\d+$/, 'submit.err.login'],
  [/^\/source\/(repo|marketplace)$/, 'submit.err.repo'],
  [/^\/source\/url$/, 'submit.err.gitUrl'],
  [/\/path$/, 'submit.err.path'],
  [/\/sha$/, 'submit.err.sha'],
  [/^\/version$/, 'submit.err.version'],
  [/^\/requires\/claudeCode$/, 'submit.err.requires'],
  [/^\/tags\/\d+$/, 'submit.err.tag'],
  [/(^\/homepage|\/url|\/href|\/src)$/, 'submit.err.https'],
  [/\/command$/, 'submit.err.command'],
  [/\/hotkey$/, 'submit.err.hotkey'],
  [/\/(color|bg)$/, 'submit.err.color'],
]

export function issueMessage(issue: Issue, t: T['t']): string {
  const p = issue.params
  const n = (k: string) => String(p[k] ?? '')
  if (/\/(color|bg)$/.test(issue.path) && issue.keyword !== 'required') return t('submit.err.color')
  switch (issue.keyword) {
    case 'required':
      return t('submit.err.required')
    case 'minLength':
      return Number(p.limit) <= 1 ? t('submit.err.required') : t('submit.err.minLength', { n: n('limit') })
    case 'maxLength':
      return t('submit.err.maxLength', { n: n('limit') })
    case 'pattern': {
      const hit = PATTERN_BY_PATH.find(([re]) => re.test(issue.path))
      return t(hit ? hit[1] : 'submit.err.pattern')
    }
    case 'enum':
    case 'const':
      return t('submit.err.enum')
    case 'type':
      return p.type === 'integer' ? t('submit.err.integer') : t('submit.err.type')
    case 'minItems':
      return t('submit.err.minItems', { n: n('limit') })
    case 'maxItems':
      return t('submit.err.maxItems', { n: n('limit') })
    case 'uniqueItems':
      return t('submit.err.unique')
    case 'minimum':
      return t('submit.err.minimum', { n: n('limit') })
    case 'maximum':
      return t('submit.err.maximum', { n: n('limit') })
    case 'additionalProperties':
      return t('submit.err.unknown', { prop: n('additionalProperty') })
    // extra checks made by the builder itself
    case 'reserved':
      return t('submit.err.reserved', { prefix: n('prefix') })
    case 'reservedName':
      return t('submit.err.reservedName')
    case 'exists':
      return t('submit.err.exists')
    default:
      return t('submit.err.pattern')
  }
}

const TOP: Record<string, TKey> = {
  name: 'submit.f.name',
  title: 'submit.f.title',
  tagline: 'submit.f.tagline',
  tagline_ru: 'submit.f.tagline_ru',
  description: 'submit.f.description',
  description_ru: 'submit.f.description_ru',
  category: 'submit.f.category',
  tags: 'submit.f.tags',
  license: 'submit.f.license',
  version: 'submit.f.version',
  homepage: 'submit.f.homepage',
  surfaces: 'submit.f.surfaces',
  requires: 'submit.f.requires',
  maintainers: 'submit.f.maintainers',
}

const SOURCE: Record<string, TKey> = {
  type: 'submit.f.sourceType',
  repo: 'submit.f.repo',
  path: 'submit.f.path',
  ref: 'submit.f.ref',
  sha: 'submit.f.sha',
  url: 'submit.f.url',
  marketplace: 'submit.f.marketplace',
  plugin: 'submit.f.plugin',
}

const PREVIEW: Record<string, TKey> = {
  scene: 'submit.f.scene',
  surface: 'submit.f.surfaceFirst',
  caption: 'submit.f.caption',
  caption_ru: 'submit.f.caption_ru',
  elements: 'submit.elements.title',
}

/** "Plugin name", "Element 2: Status line", for the list of problems. */
export function issueLabel(issue: Issue, t: T['t'], elements: readonly PreviewElement[], sourceType: string): string {
  const parts = issue.path.split('/').slice(1)
  const [head, second, third] = parts
  if (head in TOP) return t(TOP[head])
  if (head === 'author') {
    return t(second === 'github' ? 'submit.f.authorGithub' : second === 'url' ? 'submit.f.authorUrl' : 'submit.f.authorName')
  }
  if (head === 'source') {
    if (second === 'repo' && sourceType === 'marketplace') return t('submit.f.codeRepo')
    return t(SOURCE[second] ?? 'submit.f.sourceType')
  }
  if (head === 'preview') {
    if (second === 'elements' && third !== undefined) {
      const i = Number(third)
      const slot = elements[i]?.slot
      return t('submit.el.label', { n: i + 1, slot: slot ? t(`common.slot.${slot}` as TKey) : '?' })
    }
    return t(PREVIEW[second] ?? 'submit.group.preview')
  }
  return issue.path
}
