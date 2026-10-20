// The entry builder: a form for mods/<name>/mod.json with a structured editor for the
// preview elements, a live MockClient preview beside it, and the result (schema check,
// JSON, pull request link). The draft is saved in this browser (lib/storage, never throws).
import { useInView } from 'motion/react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useT, type TKey } from '../../i18n'
import type { Category, Preview, Surface } from '../../data/types'
import { readJSON, writeJSON } from '../../lib/storage'
import { useRegistry } from '../../lib/registry'
import { useToast } from '../ui/Toaster'
import {
  CATEGORIES,
  SCENES,
  SOURCE_TYPES,
  SURFACES,
  emptyDraft,
  fromEntry,
  reservedName,
  slugify,
  toEntry,
  type Draft,
  type SceneChoice,
  type SourceType,
} from './draft'
import ElementsEditor from './ElementsEditor'
import { BuilderCtx, CheckGroup, ListField, RadioGroup, SelectField, TextField } from './fields'
import Output, { type CheckStatus } from './Output'
import PreviewPane from './PreviewPane'
import { focusIssue, loadValidator, type Issue, type Validator } from './validate'
import './submit.css'

const STORE_KEY = 'submit.draft'

/** The value at a JSON pointer ("/author/name", "/preview/elements/0/text"). */
function valueAt(root: unknown, pointer: string): unknown {
  let cur = root
  for (const key of pointer.split('/').slice(1)) {
    if (cur === null || typeof cur !== 'object') return undefined
    cur = (cur as Record<string, unknown>)[key.replace(/~1/g, '/').replace(/~0/g, '~')]
  }
  return cur
}

function initialDraft(): Draft {
  const saved = readJSON<unknown>(STORE_KEY, null)
  return saved ? fromEntry(saved) : emptyDraft()
}

export default function EntryBuilder() {
  const { t } = useT()
  const { registry } = useRegistry()
  const toast = useToast()

  const [draft, setDraft] = useState<Draft>(initialDraft)
  // Remounts inputs that keep their own text (lists, numbers) after a reset or a paste.
  const [formKey, setFormKey] = useState(0)
  const [touched, setTouched] = useState<ReadonlySet<string>>(() => new Set())
  const [showAll, setShowAll] = useState(false)

  // ── schema check, loaded when the builder comes near ───────────────────────────────
  const root = useRef<HTMLDivElement>(null)
  const near = useInView(root, { once: true, margin: '600px 0px 600px 0px' })
  const [check, setCheck] = useState<{ status: CheckStatus; fn?: Validator }>({ status: 'idle' })
  useEffect(() => {
    if (!near) return
    let live = true
    setCheck({ status: 'loading' })
    loadValidator()
      .then((fn) => live && setCheck({ status: 'ready', fn }))
      .catch(() => live && setCheck({ status: 'failed' }))
    return () => {
      live = false
    }
  }, [near])

  const entry = useMemo(() => toEntry(draft), [draft])
  const json = useMemo(() => `${JSON.stringify(entry, null, 2)}\n`, [entry])
  const existing = useMemo(() => registry.mods.find((m) => m.name === draft.name.trim()), [registry, draft.name])

  const issues = useMemo<Issue[]>(() => {
    const out: Issue[] = []
    const name = draft.name.trim()
    const reserved = name ? reservedName(name) : null
    if (reserved?.kind === 'name') out.push({ path: '/name', keyword: 'reservedName', params: {} })
    else if (reserved) out.push({ path: '/name', keyword: 'reserved', params: { prefix: reserved.prefix } })
    else if (existing) out.push({ path: '/name', keyword: 'exists', params: {} })
    const schema = check.fn ? check.fn(entry) : []
    const seen = new Set(out.map((i) => i.path))
    for (const i of schema) {
      if (seen.has(i.path)) continue
      // an empty field fails its pattern or length; "Required" says it better
      const empty = (i.keyword === 'pattern' || i.keyword === 'minLength') && valueAt(entry, i.path) === ''
      out.push(empty ? { ...i, keyword: 'required' } : i)
    }
    return out
  }, [check, entry, draft.name, existing])

  // save the draft (debounced)
  useEffect(() => {
    const id = window.setTimeout(() => writeJSON(STORE_KEY, entry), 400)
    return () => window.clearTimeout(id)
  }, [entry])

  const ctx = useMemo(
    () => ({
      issues,
      shown: (path: string, deep?: boolean) =>
        showAll || touched.has(path) || (!!deep && [...touched].some((p) => p.startsWith(`${path}/`))),
      touch: (path: string) => setTouched((cur) => (cur.has(path) ? cur : new Set(cur).add(path))),
    }),
    [issues, showAll, touched],
  )

  // ── updates ───────────────────────────────────────────────────────────────────────
  const patch = useCallback((p: Partial<Draft>) => setDraft((d) => ({ ...d, ...p })), [])
  const patchSource = (p: Partial<Draft['source']>) => setDraft((d) => ({ ...d, source: { ...d.source, ...p } }))
  const patchAuthor = (p: Partial<Draft['author']>) => setDraft((d) => ({ ...d, author: { ...d.author, ...p } }))
  const patchPreview = (p: Partial<Draft['preview']>) => setDraft((d) => ({ ...d, preview: { ...d.preview, ...p } }))
  const setTitle = (title: string) =>
    setDraft((d) => ({ ...d, title, name: !d.name || d.name === slugify(d.title) ? slugify(title) : d.name }))
  const setGithub = (github: string) =>
    setDraft((d) => {
      const prev = d.author.github.trim()
      const follow = d.maintainers.length === 0 || (d.maintainers.length === 1 && d.maintainers[0] === prev)
      return { ...d, author: { ...d.author, github }, maintainers: follow ? (github.trim() ? [github.trim()] : []) : d.maintainers }
    })

  const [resetArmed, setResetArmed] = useState(false)
  useEffect(() => {
    if (!resetArmed) return
    const id = window.setTimeout(() => setResetArmed(false), 3500)
    return () => window.clearTimeout(id)
  }, [resetArmed])
  const reset = () => {
    if (!resetArmed) {
      setResetArmed(true)
      return
    }
    setResetArmed(false)
    setDraft(emptyDraft())
    setTouched(new Set())
    setShowAll(false)
    setFormKey((k) => k + 1)
  }

  const [paste, setPaste] = useState('')
  const [pasteError, setPasteError] = useState<string | null>(null)
  const loadPaste = () => {
    try {
      const v = JSON.parse(paste) as unknown
      setDraft(fromEntry(v))
      setTouched(new Set())
      setShowAll(true)
      setFormKey((k) => k + 1)
      setPasteError(null)
      setPaste('')
      toast.show(t('submit.tools.pasteDone'))
    } catch (err) {
      setPasteError(t('submit.tools.pasteError', { error: err instanceof Error ? err.message : String(err) }))
    }
  }

  // "Open a pull request" before the entry is ready: list the problems and go to the first one
  const reveal = () => {
    setShowAll(true)
    const first = issues.find((i) => i.keyword !== 'exists')
    requestAnimationFrame(() => {
      if (first) focusIssue(first.path)
      else document.querySelector<HTMLElement>('.sb-problem')?.focus()
    })
  }

  const gh = draft.author.github.trim()
  const maintainerWarn =
    gh && draft.maintainers.length > 0 && !draft.maintainers.some((m) => m.toLowerCase() === gh.toLowerCase())
      ? t('submit.warn.maintainer', { login: gh })
      : null

  const src = draft.source
  const optional = { optional: true }

  return (
    <BuilderCtx.Provider value={ctx}>
      <div className="sb-builder" ref={root}>
        <form className="sb-form" noValidate onSubmit={(e) => e.preventDefault()} key={formKey}>
          <div className="sb-tools">
            <details className="sb-paste">
              <summary>{t('submit.tools.paste')}</summary>
              <div className="sb-paste-body">
                <label className="sb-label" htmlFor="sb-paste">
                  {t('submit.tools.pasteLabel')}
                </label>
                <p className="sb-hint" id="sb-paste-hint">
                  {t('submit.tools.pasteHint')}
                </p>
                <textarea
                  id="sb-paste"
                  className="sb-input sb-textarea is-mono"
                  rows={6}
                  value={paste}
                  spellCheck={false}
                  aria-describedby={pasteError ? 'sb-paste-err sb-paste-hint' : 'sb-paste-hint'}
                  aria-invalid={pasteError ? true : undefined}
                  onChange={(e) => setPaste(e.target.value)}
                />
                {pasteError ? (
                  <p className="sb-error" id="sb-paste-err">
                    {pasteError}
                  </p>
                ) : null}
                <button type="button" className="btn btn-secondary" disabled={!paste.trim()} onClick={loadPaste}>
                  {t('submit.tools.pasteLoad')}
                </button>
              </div>
            </details>
            <div className="sb-tools-right">
              <span className="sb-saved">{t('submit.tools.saved')}</span>
              <button type="button" className="sb-text-btn" onClick={reset} aria-live="polite">
                {resetArmed ? t('submit.tools.resetAgain') : t('submit.tools.reset')}
              </button>
            </div>
          </div>

          <fieldset className="sb-group">
            <legend className="sb-legend">{t('submit.group.about')}</legend>
            <div className="sb-grid-2">
              <TextField path="/title" label={t('submit.f.title')} hint={t('submit.f.title.hint')} value={draft.title} onChange={setTitle} />
              <TextField path="/name" label={t('submit.f.name')} hint={t('submit.f.name.hint')} value={draft.name} mono onChange={(v) => patch({ name: v })} />
            </div>
            <TextField path="/tagline" label={t('submit.f.tagline')} hint={t('submit.f.tagline.hint')} value={draft.tagline} lang="en" onChange={(v) => patch({ tagline: v })} />
            <TextField path="/tagline_ru" label={t('submit.f.tagline_ru')} {...optional} value={draft.tagline_ru} lang="ru" onChange={(v) => patch({ tagline_ru: v })} />
            <TextField
              path="/description"
              label={t('submit.f.description')}
              hint={t('submit.f.description.hint')}
              value={draft.description}
              multiline
              rows={4}
              lang="en"
              onChange={(v) => patch({ description: v })}
            />
            <TextField
              path="/description_ru"
              label={t('submit.f.description_ru')}
              {...optional}
              value={draft.description_ru}
              multiline
              rows={4}
              lang="ru"
              onChange={(v) => patch({ description_ru: v })}
            />
            <div className="sb-grid-2">
              <SelectField
                path="/category"
                label={t('submit.f.category')}
                value={draft.category}
                placeholder={t('submit.f.category.choose')}
                options={CATEGORIES.map((c) => ({ value: c, label: t(`common.category.${c}` as TKey) }))}
                onChange={(v) => patch({ category: v as Category })}
              />
              <TextField path="/license" label={t('submit.f.license')} hint={t('submit.f.license.hint')} value={draft.license} mono onChange={(v) => patch({ license: v })} />
            </div>
            <ListField path="/tags" label={t('submit.f.tags')} hint={t('submit.f.tags.hint')} {...optional} value={draft.tags} onChange={(v) => patch({ tags: v })} />

            <details className="sb-more">
              <summary>{t('submit.group.more')}</summary>
              <div className="sb-more-body">
                <div className="sb-grid-2">
                  <TextField path="/version" label={t('submit.f.version')} hint={t('submit.f.version.hint')} {...optional} value={draft.version} mono onChange={(v) => patch({ version: v })} />
                  <TextField path="/requires/claudeCode" label={t('submit.f.requires')} hint={t('submit.f.requires.hint')} {...optional} value={draft.requires} mono onChange={(v) => patch({ requires: v })} />
                </div>
                <TextField path="/homepage" label={t('submit.f.homepage')} {...optional} value={draft.homepage} mono inputMode="url" onChange={(v) => patch({ homepage: v })} />
                <CheckGroup<Surface>
                  path="/surfaces"
                  legend={t('submit.f.surfaces')}
                  hint={t('submit.f.surfaces.hint')}
                  value={draft.surfaces}
                  options={SURFACES.map((s) => ({ value: s, label: t(`common.surface.${s}` as TKey) }))}
                  onChange={(v) => patch({ surfaces: v })}
                />
              </div>
            </details>
          </fieldset>

          <fieldset className="sb-group">
            <legend className="sb-legend">{t('submit.group.source')}</legend>
            <RadioGroup<SourceType>
              name="sb-source"
              path="/source/type"
              legend={t('submit.f.sourceType')}
              value={src.type}
              options={SOURCE_TYPES.map((s) => ({ value: s, label: t(`submit.source.${s}` as TKey), hint: t(`submit.source.${s}.hint` as TKey) }))}
              onChange={(v) => patchSource({ type: v })}
            />
            {src.type === 'github' ? (
              <>
                <div className="sb-grid-2">
                  <TextField path="/source/repo" label={t('submit.f.repo')} hint={t('submit.f.repo.hint')} value={src.repo} mono onChange={(v) => patchSource({ repo: v })} />
                  <TextField path="/source/path" label={t('submit.f.path')} hint={t('submit.f.path.hint')} {...optional} value={src.path} mono onChange={(v) => patchSource({ path: v })} />
                </div>
                <div className="sb-grid-2">
                  <TextField path="/source/ref" label={t('submit.f.ref')} {...optional} value={src.ref} mono onChange={(v) => patchSource({ ref: v })} />
                  <TextField path="/source/sha" label={t('submit.f.sha')} hint={t('submit.f.sha.hint')} {...optional} value={src.sha} mono onChange={(v) => patchSource({ sha: v })} />
                </div>
              </>
            ) : null}
            {src.type === 'git' ? (
              <>
                <TextField path="/source/url" label={t('submit.f.url')} hint={t('submit.f.url.hint')} value={src.url} mono inputMode="url" onChange={(v) => patchSource({ url: v })} />
                <div className="sb-grid-2">
                  <TextField path="/source/path" label={t('submit.f.path')} hint={t('submit.f.path.hint')} {...optional} value={src.path} mono onChange={(v) => patchSource({ path: v })} />
                  <TextField path="/source/ref" label={t('submit.f.ref')} {...optional} value={src.ref} mono onChange={(v) => patchSource({ ref: v })} />
                </div>
                <TextField path="/source/sha" label={t('submit.f.sha')} hint={t('submit.f.sha.hint')} {...optional} value={src.sha} mono onChange={(v) => patchSource({ sha: v })} />
              </>
            ) : null}
            {src.type === 'marketplace' ? (
              <>
                <TextField
                  path="/source/marketplace"
                  label={t('submit.f.marketplace')}
                  hint={t('submit.f.marketplace.hint')}
                  value={src.marketplace}
                  mono
                  onChange={(v) => patchSource({ marketplace: v })}
                />
                <div className="sb-grid-2">
                  <TextField path="/source/plugin" label={t('submit.f.plugin')} hint={t('submit.f.plugin.hint')} {...optional} value={src.plugin} mono onChange={(v) => patchSource({ plugin: v })} />
                  <TextField path="/source/repo" label={t('submit.f.codeRepo')} hint={t('submit.f.codeRepo.hint')} {...optional} value={src.repo} mono onChange={(v) => patchSource({ repo: v })} />
                </div>
                <TextField path="/source/path" label={t('submit.f.path')} hint={t('submit.f.path.hint')} {...optional} value={src.path} mono onChange={(v) => patchSource({ path: v })} />
              </>
            ) : null}
          </fieldset>

          <fieldset className="sb-group">
            <legend className="sb-legend">{t('submit.group.author')}</legend>
            <div className="sb-grid-2">
              <TextField path="/author/name" label={t('submit.f.authorName')} value={draft.author.name} onChange={(v) => patchAuthor({ name: v })} />
              <TextField path="/author/github" label={t('submit.f.authorGithub')} {...optional} value={draft.author.github} mono onChange={setGithub} />
            </div>
            <TextField
              path="/author/url"
              label={t('submit.f.authorUrl')}
              {...optional}
              value={draft.author.url}
              mono
              inputMode="url"
              onChange={(v) => patchAuthor({ url: v })}
            />
            <ListField
              path="/maintainers"
              label={t('submit.f.maintainers')}
              hint={t('submit.f.maintainers.hint')}
              warn={maintainerWarn}
              value={draft.maintainers}
              onChange={(v) => patch({ maintainers: v })}
            />
          </fieldset>

          <fieldset className="sb-group">
            <legend className="sb-legend">{t('submit.group.preview')}</legend>
            <div className="sb-grid-2">
              <SelectField
                path="/preview/scene"
                label={t('submit.f.scene')}
                value={draft.preview.scene}
                options={[
                  ...(draft.preview.scene === '' ? [{ value: '', label: t('submit.scene.none') }] : []),
                  ...SCENES.map((s) => ({ value: s, label: t(`submit.scene.${s}` as TKey) })),
                ]}
                onChange={(v) => patchPreview({ scene: v as SceneChoice })}
              />
              <SelectField
                path="/preview/surface"
                label={t('submit.f.surfaceFirst')}
                value={draft.preview.surface}
                options={[
                  { value: '', label: t('submit.surfaceFirst.none') },
                  { value: 'terminal', label: t('common.surface.terminal') },
                  { value: 'desktop', label: t('common.surface.desktop') },
                ]}
                onChange={(v) => patchPreview({ surface: v as Draft['preview']['surface'] })}
              />
            </div>
            {draft.preview.transcript?.length ? <p className="sb-hint">{t('submit.transcriptKept', { n: draft.preview.transcript.length })}</p> : null}
            <TextField path="/preview/caption" label={t('submit.f.caption')} hint={t('submit.f.caption.hint')} {...optional} value={draft.preview.caption} lang="en" onChange={(v) => patchPreview({ caption: v })} />
            <TextField path="/preview/caption_ru" label={t('submit.f.caption_ru')} {...optional} value={draft.preview.caption_ru} lang="ru" onChange={(v) => patchPreview({ caption_ru: v })} />
            <ElementsEditor elements={draft.preview.elements} onChange={(elements) => patchPreview({ elements })} />
          </fieldset>
        </form>

        <aside className="sb-side" aria-label={t('submit.preview.title')}>
          <h4 className="sb-sub">{t('submit.preview.title')}</h4>
          <PreviewPane preview={entry.preview as Preview} name={draft.name.trim()} title={draft.title.trim()} />
          <Output
            name={draft.name.trim()}
            json={json}
            issues={issues}
            status={check.status}
            existing={existing}
            elements={draft.preview.elements}
            sourceType={draft.source.type}
            revealed={showAll || touched.size > 0}
            onReveal={reveal}
          />
        </aside>
      </div>
    </BuilderCtx.Provider>
  )
}
