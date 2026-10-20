// Anatomy of a mod: the three files of Turn Meter (a first-party mod in this catalog) as a
// file tree; picking a file shows it beside the tree. The files are imported raw at build
// time, so the excerpt is always the real code.
import { useId, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import manifestSrc from '../../../../mods/turn-meter/plugin/.claude-plugin/plugin.json?raw'
import hooksSrc from '../../../../mods/turn-meter/plugin/hooks/hooks.json?raw'
import registerSrc from '../../../../mods/turn-meter/plugin/hooks/register.tsx?raw'
import { useT, type TKey } from '../../i18n'
import { highlightLine, type Lang } from './highlight'
import './how.css'

type Line = { n: number; text: string } | { gap: [number, number] }

type FileId = 'manifest' | 'hooks' | 'register'

type FileSpec = {
  id: FileId
  /** Path inside the plugin folder. */
  path: string
  /** Tree rows: indent guide + name. */
  dir: string
  name: string
  note: TKey
  lang: Lang
  lines: Line[]
  total: number
}

function allLines(src: string): Line[] {
  return src.replace(/\n$/, '').split('\n').map((text, i) => ({ n: i + 1, text }))
}

/**
 * The AbovePrompt handler of register.tsx: from `on('ui.render'…` to its closing `})`,
 * with the sparkline branch folded into one gap row. Falls back to the whole file.
 */
function registerExcerpt(src: string): Line[] {
  const lines = src.replace(/\n$/, '').split('\n')
  const start = lines.findIndex((l) => l.includes("on('ui.render'"))
  if (start < 0) return allLines(src)
  let end = lines.findIndex((l, i) => i > start && /^ {2}\}\)\s*$/.test(l))
  if (end < 0) end = Math.min(lines.length - 1, start + 34)
  const resolve = lines.findIndex((l, i) => i > start && i < end && l.includes('$.ui.resolve(e)'))
  const ret = lines.findIndex((l, i) => i > resolve && i < end && /^\s+return \($/.test(l))
  const take = (from: number, to: number): Line[] => lines.slice(from, to + 1).map((text, i) => ({ n: from + i + 1, text }))
  if (resolve < 0 || ret < 0 || ret - resolve < 4) return take(start, end)
  return [...take(start, resolve), { gap: [resolve + 2, ret] }, ...take(ret, end)]
}

function CodeView({ file, labelledBy, id }: { file: FileSpec; labelledBy: string; id: string }) {
  const { t } = useT()
  const shown = file.lines.filter((l): l is { n: number; text: string } => 'n' in l)
  const first = shown[0]?.n ?? 1
  const last = shown[shown.length - 1]?.n ?? 1
  const partial = first > 1 || last < file.total || file.lines.some((l) => 'gap' in l)
  return (
    <div className="how-code" role="tabpanel" id={id} aria-labelledby={labelledBy} tabIndex={0}>
      <div className="how-code-head">
        <span className="how-code-path">{file.path}</span>
        <span className="how-code-range">
          {partial
            ? t('how.anatomy.range', { from: first, to: last, total: file.total })
            : t('how.anatomy.whole', { total: file.total })}
        </span>
      </div>
      <pre className="how-code-body" data-lang={file.lang}>
        <code>
          {file.lines.map((l, i) =>
            'gap' in l ? (
              <span key={`g${i}`} className="how-code-gap">
                <span className="how-code-n" aria-hidden="true">
                  ⋮
                </span>
                <span className="how-code-gap-text">{t('how.anatomy.gap', { from: l.gap[0], to: l.gap[1] })}</span>
              </span>
            ) : (
              <span key={l.n} className="how-code-line">
                <span className="how-code-n" aria-hidden="true">
                  {l.n}
                </span>
                {l.text ? highlightLine(l.text, file.lang) : ' '}
              </span>
            ),
          )}
        </code>
      </pre>
    </div>
  )
}

export default function Anatomy({ sourceUrl }: { sourceUrl?: string }) {
  const { t } = useT()
  const uid = useId()
  const files = useMemo<FileSpec[]>(() => {
    const count = (s: string) => s.replace(/\n$/, '').split('\n').length
    return [
      {
        id: 'manifest',
        path: '.claude-plugin/plugin.json',
        dir: '.claude-plugin/',
        name: 'plugin.json',
        note: 'how.anatomy.note.manifest',
        lang: 'json',
        lines: allLines(manifestSrc),
        total: count(manifestSrc),
      },
      {
        id: 'hooks',
        path: 'hooks/hooks.json',
        dir: 'hooks/',
        name: 'hooks.json',
        note: 'how.anatomy.note.hooks',
        lang: 'json',
        lines: allLines(hooksSrc),
        total: count(hooksSrc),
      },
      {
        id: 'register',
        path: 'hooks/register.tsx',
        dir: 'hooks/',
        name: 'register.tsx',
        note: 'how.anatomy.note.register',
        lang: 'tsx',
        lines: registerExcerpt(registerSrc),
        total: count(registerSrc),
      },
    ]
  }, [])

  const [current, setCurrent] = useState<FileId>('register')
  const tabs = useRef<Record<string, HTMLButtonElement | null>>({})
  const file = files.find((f) => f.id === current) ?? files[2]

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = files.findIndex((f) => f.id === current)
    let next = -1
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') next = (i + 1) % files.length
    else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') next = (i - 1 + files.length) % files.length
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = files.length - 1
    if (next < 0) return
    e.preventDefault()
    setCurrent(files[next].id)
    tabs.current[files[next].id]?.focus()
  }

  const tabId = (id: FileId) => `${uid}-tab-${id}`
  const panelId = `${uid}-panel`

  // Tree: plugin root, then .claude-plugin/plugin.json, then hooks/ with two files. The
  // lists are only layout (role none): the tablist owns the file tabs directly.
  const dirs = [...new Set(files.map((f) => f.dir))]
  return (
    <div className="how-anatomy">
      <div className="how-tree-wrap">
        <p className="how-tree-root">
          <span className="how-tree-folder">turn-meter/</span>
        </p>
        <div className="how-tree" role="tablist" aria-orientation="vertical" aria-label={t('how.anatomy.files')} onKeyDown={onKey}>
          <ul className="how-tree-list" role="none">
            {dirs.map((dir) => (
              <li key={dir} className="how-tree-item" role="none">
                <p className="how-tree-dir" aria-hidden="true">
                  <span className="how-tree-folder">{dir}</span>
                </p>
                <ul className="how-tree-list" role="none">
                  {files
                    .filter((f) => f.dir === dir)
                    .map((f) => (
                      <li key={f.id} className="how-tree-item is-file" role="none">
                        <button
                          ref={(el) => {
                            tabs.current[f.id] = el
                          }}
                          type="button"
                          role="tab"
                          id={tabId(f.id)}
                          aria-selected={current === f.id}
                          aria-controls={panelId}
                          tabIndex={current === f.id ? 0 : -1}
                          className="how-tree-file"
                          onClick={() => setCurrent(f.id)}
                        >
                          <span className="how-tree-text">
                            <span className="how-tree-name">{f.name}</span>
                            <span className="how-tree-note">{t(f.note)}</span>
                          </span>
                        </button>
                      </li>
                    ))}
                </ul>
              </li>
            ))}
          </ul>
        </div>
        {sourceUrl ? (
          <a className="how-tree-source" href={sourceUrl} rel="noopener">
            {t('how.anatomy.source')}
          </a>
        ) : null}
      </div>
      <CodeView file={file} labelledBy={tabId(file.id)} id={panelId} />
    </div>
  )
}
