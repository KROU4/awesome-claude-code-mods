// Rows of segments, as the preview DSL writes them: each row is a line of pieces (text,
// button, bar, sparkline, link, key cap). Pieces are edited in place; new ones are added
// at the end of a row.
import { useContext, useEffect, useState, type ReactNode } from 'react'
import { useT, type TKey } from '../../i18n'
import type { Row, Segment } from '../../data/types'
import { TERMINAL_THEMES } from '../mock'
import { MAX_ROWS, MAX_SEGMENTS, THEME_COLORS } from './draft'
import { BuilderCtx, NumberInput, useIssues } from './fields'
import { issueMessage } from './messages'
import { fieldId } from './validate'

type Kind = 'text' | 'button' | 'bar' | 'spark' | 'link' | 'kbd'
const KINDS: Kind[] = ['text', 'button', 'bar', 'spark', 'link', 'kbd']

function kindOf(s: Segment): Kind {
  if (typeof s === 'string' || 'text' in s) return 'text'
  if ('button' in s) return 'button'
  if ('bar' in s) return 'bar'
  if ('spark' in s) return 'spark'
  if ('link' in s) return 'link'
  return 'kbd'
}

function newSegment(kind: Kind): Segment {
  switch (kind) {
    case 'text':
      return { text: 'text' }
    case 'button':
      return { button: 'Open' }
    case 'bar':
      return { bar: 0.5, width: 12 }
    case 'spark':
      return { spark: [3, 5, 2, 8, 4, 6] }
    case 'link':
      return { link: 'docs', href: 'https://' }
    case 'kbd':
      return { kbd: 'ctrl+o' }
  }
}

const ALIAS: Record<string, keyof (typeof TERMINAL_THEMES)['dark']> = { secondary: 'inactive', plan: 'planMode' }

/** What a color looks like in the dark terminal theme, for the swatch. */
function swatch(color: string | undefined): string | undefined {
  if (!color) return undefined
  if (color.startsWith('#')) return color
  const token = ALIAS[color] ?? color
  return (TERMINAL_THEMES.dark as Record<string, string>)[token]
}

function ColorPicker({ value, onChange, path, label }: { value: string | undefined; onChange: (v: string | undefined) => void; path: string; label: string }) {
  const { t } = useT()
  const { touch } = useContext(BuilderCtx)
  const isHex = !!value && value.startsWith('#')
  const sw = swatch(value)
  return (
    <span className="sb-color">
      <span className="sb-mini-label" aria-hidden="true">
        {label}
      </span>
      <span className="sb-swatch" style={sw ? { background: sw } : undefined} data-empty={sw ? undefined : ''} aria-hidden="true" />
      <select
        id={fieldId(path)}
        className="sb-input sb-select sb-mini"
        aria-label={label}
        value={isHex ? '#' : (value ?? '')}
        onBlur={() => touch(path)}
        onChange={(e) => {
          const v = e.target.value
          onChange(v === '' ? undefined : v === '#' ? (isHex ? value : '#5f9ea0') : v)
        }}
      >
        <option value="">{t('submit.color.default')}</option>
        {THEME_COLORS.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
        <option value="#">{t('submit.color.custom')}</option>
      </select>
      {isHex ? (
        <input
          type="color"
          className="sb-colorwell"
          aria-label={t('submit.color.hex')}
          value={/^#[0-9a-fA-F]{6}$/.test(value as string) ? (value as string) : '#5f9ea0'}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : null}
    </span>
  )
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="sb-toggle">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  )
}

function SegmentEditor({
  seg,
  path,
  where,
  onChange,
  onRemove,
}: {
  seg: Segment
  path: string
  /** "row 1, piece 2", for accessible names. */
  where: string
  onChange: (s: Segment) => void
  onRemove: () => void
}) {
  const { t } = useT()
  const { touch } = useContext(BuilderCtx)
  const kind = kindOf(seg)
  const issues = useIssues(path, true)
  const bad = (p: string) => issues.some((x) => x.path === `${path}/${p}` || x.path === path)
  const kindLabel = t(`submit.seg.${kind}` as TKey)
  const name = (what: string) => `${what}, ${where}`
  const input = (p: string, value: string, set: (v: string) => void, label: string, size?: number, mono?: boolean) => (
    <input
      id={fieldId(`${path}/${p}`)}
      className={['sb-input', 'sb-mini', mono ? 'is-mono' : ''].filter(Boolean).join(' ')}
      type="text"
      size={size}
      value={value}
      aria-label={name(label)}
      aria-invalid={bad(p) || undefined}
      spellCheck={mono ? false : undefined}
      onBlur={() => touch(`${path}/${p}`)}
      onChange={(e) => set(e.target.value)}
    />
  )

  let body: ReactNode = null
  if (kind === 'text') {
    const s = typeof seg === 'string' ? { text: seg } : (seg as Extract<Segment, { text: string }>)
    body = (
      <>
        {input('text', s.text, (v) => onChange({ ...s, text: v }), kindLabel, Math.max(6, Math.min(36, s.text.length + 1)), true)}
        <ColorPicker value={s.color} onChange={(c) => onChange({ ...s, color: c as typeof s.color })} path={`${path}/color`} label={t('submit.f.el.color')} />
        <Toggle checked={!!s.bold} onChange={(v) => onChange({ ...s, bold: v })} label={t('submit.seg.bold')} />
        <Toggle checked={!!s.dim} onChange={(v) => onChange({ ...s, dim: v })} label={t('submit.seg.dim')} />
      </>
    )
  } else if (kind === 'button') {
    const s = seg as Extract<Segment, { button: string }>
    body = (
      <>
        {input('button', s.button, (v) => onChange({ ...s, button: v }), t('submit.seg.label'), Math.max(6, s.button.length + 1))}
        <span className="sb-mini-field">
          <span className="sb-mini-label" aria-hidden="true">
            {t('submit.seg.hotkey')}
          </span>
          {input('hotkey', s.hotkey ?? '', (v) => onChange({ ...s, hotkey: v || undefined }), t('submit.seg.hotkey'), 2, true)}
        </span>
        <Toggle
          checked={s.variant === 'primary'}
          onChange={(v) => onChange({ ...s, variant: v ? 'primary' : undefined })}
          label={t('submit.seg.primary')}
        />
      </>
    )
  } else if (kind === 'bar') {
    const s = seg as Extract<Segment, { bar: number }>
    body = (
      <>
        <span className="sb-mini-field">
          <span className="sb-mini-label" aria-hidden="true">
            {t('submit.seg.value')}
          </span>
          <NumberInput
            id={fieldId(`${path}/bar`)}
            value={s.bar}
            step={0.05}
            min={0}
            max={1}
            label={name(t('submit.seg.value'))}
            invalid={bad('bar')}
            onBlur={() => touch(`${path}/bar`)}
            onChange={(v) => onChange({ ...s, bar: v as number })}
          />
        </span>
        <span className="sb-mini-field">
          <span className="sb-mini-label" aria-hidden="true">
            {t('submit.seg.width')}
          </span>
          <NumberInput
            id={fieldId(`${path}/width`)}
            value={s.width}
            step={1}
            min={4}
            max={40}
            label={name(t('submit.seg.width'))}
            invalid={bad('width')}
            onBlur={() => touch(`${path}/width`)}
            onChange={(v) => onChange({ ...s, width: v })}
          />
        </span>
        <ColorPicker value={s.color} onChange={(c) => onChange({ ...s, color: c as typeof s.color })} path={`${path}/color`} label={t('submit.f.el.color')} />
      </>
    )
  } else if (kind === 'spark') {
    const s = seg as Extract<Segment, { spark: number[] }>
    body = (
      <>
        <SparkInput
          id={fieldId(`${path}/spark`)}
          values={s.spark}
          label={name(t('submit.seg.values'))}
          invalid={bad('spark')}
          onBlur={() => touch(`${path}/spark`)}
          onChange={(v) => onChange({ ...s, spark: v })}
        />
        <ColorPicker value={s.color} onChange={(c) => onChange({ ...s, color: c as typeof s.color })} path={`${path}/color`} label={t('submit.f.el.color')} />
      </>
    )
  } else if (kind === 'link') {
    const s = seg as Extract<Segment, { link: string }>
    body = (
      <>
        {input('link', s.link, (v) => onChange({ ...s, link: v }), t('submit.seg.label'), Math.max(6, s.link.length + 1))}
        {input('href', s.href, (v) => onChange({ ...s, href: v }), t('submit.seg.href'), 22, true)}
      </>
    )
  } else {
    const s = seg as Extract<Segment, { kbd: string }>
    body = input('kbd', s.kbd, (v) => onChange({ kbd: v }), t('submit.seg.key'), Math.max(4, s.kbd.length + 1), true)
  }

  return (
    <li className="sb-seg" data-kind={kind} data-invalid={issues.length ? '' : undefined}>
      <span className="sb-seg-kind">{kindLabel}</span>
      <span className="sb-seg-body">{body}</span>
      <button type="button" className="sb-icon-btn" aria-label={name(t('submit.seg.remove'))} title={t('submit.seg.remove')} onClick={onRemove}>
        <IconX />
      </button>
      {issues.length ? <span className="sb-error sb-seg-error">{issueMessage(issues[0], t)}</span> : null}
    </li>
  )
}

function SparkInput({
  id,
  values,
  label,
  invalid,
  onBlur,
  onChange,
}: {
  id: string
  values: number[]
  label: string
  invalid: boolean
  onBlur: () => void
  onChange: (v: number[]) => void
}) {
  const [text, setText] = useState(values.join(' '))
  useEffect(() => {
    const same = (cur: string) =>
      cur
        .split(/[\s,]+/)
        .filter(Boolean)
        .map(Number)
        .filter((n) => Number.isFinite(n))
        .join(' ') === values.join(' ')
    setText((cur) => (same(cur) ? cur : values.join(' ')))
  }, [values])
  return (
    <input
      id={id}
      className="sb-input sb-mini is-mono"
      type="text"
      size={Math.max(10, text.length + 1)}
      value={text}
      aria-label={label}
      aria-invalid={invalid || undefined}
      spellCheck={false}
      onBlur={onBlur}
      onChange={(e) => {
        setText(e.target.value)
        onChange(
          e.target.value
            .split(/[\s,]+/)
            .filter(Boolean)
            .map(Number)
            .filter((n) => Number.isFinite(n)),
        )
      }}
    />
  )
}

export function IconX() {
  return (
    <svg width={14} height={14} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" aria-hidden="true" focusable="false">
      <path d="M5.5 5.5l9 9M14.5 5.5l-9 9" />
    </svg>
  )
}

export function IconPlus() {
  return (
    <svg width={14} height={14} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" aria-hidden="true" focusable="false">
      <path d="M10 4.5v11M4.5 10h11" />
    </svg>
  )
}

function RowEditor({
  row,
  path,
  index,
  canRemove,
  onChange,
  onRemove,
}: {
  row: Row
  path: string
  index: number
  canRemove: boolean
  onChange: (r: Row) => void
  onRemove: () => void
}) {
  const { t } = useT()
  const [kind, setKind] = useState<Kind>('text')
  const issues = useIssues(path)
  const n = index + 1
  return (
    <div className="sb-row" id={fieldId(path)} tabIndex={-1}>
      <div className="sb-row-head">
        <span className="sb-row-title">{t('submit.rows.row', { n })}</span>
        {canRemove ? (
          <button type="button" className="sb-text-btn" onClick={onRemove}>
            {t('submit.rows.removeRow', { n })}
          </button>
        ) : null}
      </div>
      {row.length ? (
        <ul className="sb-segs">
          {row.map((seg, s) => (
            <SegmentEditor
              key={s}
              seg={seg}
              path={`${path}/${s}`}
              where={`${t('submit.rows.row', { n })}, ${s + 1}`}
              onChange={(next) => onChange(row.map((x, j) => (j === s ? next : x)))}
              onRemove={() => onChange(row.filter((_, j) => j !== s))}
            />
          ))}
        </ul>
      ) : (
        <p className="sb-hint">{t('submit.rows.empty')}</p>
      )}
      {issues.length ? <p className="sb-error">{issueMessage(issues[0], t)}</p> : null}
      {row.length < MAX_SEGMENTS ? (
        <div className="sb-add">
          <select className="sb-input sb-select sb-mini" aria-label={t('submit.rows.addKind', { n })} value={kind} onChange={(e) => setKind(e.target.value as Kind)}>
            {KINDS.map((k) => (
              <option key={k} value={k}>
                {t(`submit.seg.${k}` as TKey)}
              </option>
            ))}
          </select>
          <button type="button" className="sb-small-btn" onClick={() => onChange([...row, newSegment(kind)])}>
            <IconPlus />
            {t('submit.rows.add')}
          </button>
        </div>
      ) : null}
    </div>
  )
}

/** Several rows (`rows`): add and remove rows. */
export function RowsEditor({ rows, onChange, path, label }: { rows: Row[]; onChange: (rows: Row[]) => void; path: string; label: string }) {
  const { t } = useT()
  const issues = useIssues(path)
  return (
    <div className="sb-rows" role="group" aria-label={label}>
      <p className="sb-label" aria-hidden="true">
        {label}
      </p>
      {rows.map((row, r) => (
        <RowEditor
          key={r}
          row={row}
          path={`${path}/${r}`}
          index={r}
          canRemove={rows.length > 1}
          onChange={(next) => onChange(rows.map((x, j) => (j === r ? next : x)))}
          onRemove={() => onChange(rows.filter((_, j) => j !== r))}
        />
      ))}
      {issues.length ? <p className="sb-error">{issueMessage(issues[0], t)}</p> : null}
      {rows.length < MAX_ROWS ? (
        <button type="button" className="sb-small-btn" onClick={() => onChange([...rows, [{ text: 'text' }]])}>
          <IconPlus />
          {t('submit.rows.addRow')}
        </button>
      ) : null}
    </div>
  )
}

/** One row (`row`): the hint line, the mode label, an info notice, a redrawn tool line. */
export function RowEditorSingle({ row, onChange, path, label }: { row: Row; onChange: (row: Row) => void; path: string; label: string }) {
  return (
    <div className="sb-rows" role="group" aria-label={label}>
      <p className="sb-label" aria-hidden="true">
        {label}
      </p>
      <RowEditor row={row} path={path} index={0} canRemove={false} onChange={onChange} onRemove={() => {}} />
    </div>
  )
}
