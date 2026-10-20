// Form primitives of the entry builder. Every control is labelled, carries its hint and
// error through aria-describedby, and is addressed by the JSON pointer of the field it edits
// (so a schema issue can name and focus it). Errors show once a field was left, or all of
// them after "Open a pull request" was pressed with problems left.
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { useT } from '../../i18n'
import { rich } from '../how/Command'
import { splitList } from './draft'
import { issueMessage } from './messages'
import { fieldId, issuesAt, type Issue } from './validate'

type BuilderCtxValue = {
  issues: readonly Issue[]
  /** Issues of this path (with `deep`, of any path under it) are on screen: touched, or all revealed. */
  shown: (path: string, deep?: boolean) => boolean
  touch: (path: string) => void
}

export const BuilderCtx = createContext<BuilderCtxValue>({ issues: [], shown: () => false, touch: () => {} })

export function useIssues(path: string, deep = false): Issue[] {
  const { issues, shown } = useContext(BuilderCtx)
  return shown(path, deep) ? issuesAt(issues, path, deep) : []
}

type ControlProps = { id: string; describedBy?: string; invalid: boolean; onBlur: () => void }

export type FieldProps = {
  path: string
  label: string
  hint?: string
  optional?: boolean
  /** Also show issues of the paths under this one (lists such as tags). */
  deep?: boolean
  /** A note that is not an error (e.g. "add your own login"). */
  warn?: string | null
  className?: string
  children: (p: ControlProps) => ReactNode
}

export function Field({ path, label, hint, optional, deep, warn, className, children }: FieldProps) {
  const { t } = useT()
  const { touch } = useContext(BuilderCtx)
  const list = useIssues(path, deep)
  const id = fieldId(path)
  const hintId = hint ? `${id}-hint` : undefined
  const errId = list.length ? `${id}-err` : undefined
  const warnId = warn ? `${id}-warn` : undefined
  const describedBy = [errId, warnId, hintId].filter(Boolean).join(' ') || undefined
  return (
    <div className={['sb-field', className].filter(Boolean).join(' ')} data-invalid={list.length ? '' : undefined}>
      <label className="sb-label" htmlFor={id}>
        {label}
        {optional ? (
          <>
            {' '}
            <span className="sb-optional">{t('submit.optional')}</span>
          </>
        ) : null}
      </label>
      {hint ? (
        <p className="sb-hint" id={hintId}>
          {rich(hint)}
        </p>
      ) : null}
      {children({ id, describedBy, invalid: list.length > 0, onBlur: () => touch(path) })}
      {list.length ? (
        <p className="sb-error" id={errId}>
          {issueMessage(list[0], t)}
        </p>
      ) : null}
      {warn ? (
        <p className="sb-warn" id={warnId}>
          {warn}
        </p>
      ) : null}
    </div>
  )
}

type TextFieldProps = Omit<FieldProps, 'children'> & {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  multiline?: boolean
  rows?: number
  mono?: boolean
  lang?: string
  inputMode?: 'text' | 'url'
}

export function TextField({ value, onChange, placeholder, multiline, rows = 3, mono, lang, inputMode, ...field }: TextFieldProps) {
  return (
    <Field {...field}>
      {(c) =>
        multiline ? (
          <textarea
            id={c.id}
            className={['sb-input', 'sb-textarea', mono ? 'is-mono' : ''].filter(Boolean).join(' ')}
            value={value}
            rows={rows}
            lang={lang}
            placeholder={placeholder}
            aria-invalid={c.invalid || undefined}
            aria-describedby={c.describedBy}
            onBlur={c.onBlur}
            onChange={(e) => onChange(e.target.value)}
          />
        ) : (
          <input
            id={c.id}
            className={['sb-input', mono ? 'is-mono' : ''].filter(Boolean).join(' ')}
            type="text"
            value={value}
            lang={lang}
            inputMode={inputMode}
            placeholder={placeholder}
            spellCheck={mono ? false : undefined}
            autoCapitalize={mono ? 'off' : undefined}
            autoCorrect={mono ? 'off' : undefined}
            aria-invalid={c.invalid || undefined}
            aria-describedby={c.describedBy}
            onBlur={c.onBlur}
            onChange={(e) => onChange(e.target.value)}
          />
        )
      }
    </Field>
  )
}

export type Option = { value: string; label: string }

type SelectFieldProps = Omit<FieldProps, 'children'> & {
  value: string
  onChange: (v: string) => void
  options: Option[]
  placeholder?: string
}

export function SelectField({ value, onChange, options, placeholder, ...field }: SelectFieldProps) {
  return (
    <Field {...field}>
      {(c) => (
        <select
          id={c.id}
          className="sb-input sb-select"
          value={value}
          aria-invalid={c.invalid || undefined}
          aria-describedby={c.describedBy}
          onBlur={c.onBlur}
          onChange={(e) => {
            onChange(e.target.value)
            c.onBlur()
          }}
        >
          {placeholder !== undefined ? (
            <option value="" disabled={value !== ''}>
              {placeholder}
            </option>
          ) : null}
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      )}
    </Field>
  )
}

type ListFieldProps = Omit<FieldProps, 'children' | 'deep'> & {
  value: string[]
  onChange: (v: string[]) => void
  placeholder?: string
  /** Split on spaces only (glyphs); default commas and spaces. */
  spaces?: boolean
}

/** A list typed as one line: "a, b, c". Keeps the text as typed while it means the same list. */
export function ListField({ value, onChange, placeholder, spaces, ...field }: ListFieldProps) {
  const split = (s: string) => (spaces ? s.split(/\s+/).filter(Boolean) : splitList(s))
  const join = (v: string[]) => v.join(spaces ? ' ' : ', ')
  const [text, setText] = useState(() => join(value))
  useEffect(() => {
    setText((cur) => (split(cur).join('\u0000') === value.join('\u0000') ? cur : join(value)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])
  return (
    <Field {...field} deep>
      {(c) => (
        <input
          id={c.id}
          className="sb-input is-mono"
          type="text"
          value={text}
          placeholder={placeholder}
          spellCheck={false}
          autoCapitalize="off"
          aria-invalid={c.invalid || undefined}
          aria-describedby={c.describedBy}
          onBlur={c.onBlur}
          onChange={(e) => {
            setText(e.target.value)
            onChange(split(e.target.value))
          }}
        />
      )}
    </Field>
  )
}

/** A number typed freely ("0." on the way to "0.5"); reports a number, or undefined when empty. */
export function NumberInput({
  value,
  onChange,
  id,
  label,
  invalid,
  step,
  min,
  max,
  onBlur,
}: {
  value: number | undefined
  onChange: (v: number | undefined) => void
  id: string
  label: string
  invalid?: boolean
  step?: number
  min?: number
  max?: number
  onBlur?: () => void
}) {
  const [text, setText] = useState(value === undefined ? '' : String(value))
  useEffect(() => {
    setText((cur) => (Number(cur) === value || (cur === '' && value === undefined) ? cur : value === undefined ? '' : String(value)))
  }, [value])
  return (
    <input
      id={id}
      className="sb-input sb-num"
      type="number"
      inputMode="decimal"
      value={text}
      step={step}
      min={min}
      max={max}
      aria-label={label}
      aria-invalid={invalid || undefined}
      onBlur={onBlur}
      onChange={(e) => {
        setText(e.target.value)
        const n = e.target.value === '' ? undefined : Number(e.target.value)
        onChange(n === undefined || Number.isFinite(n) ? n : undefined)
      }}
    />
  )
}

/** A set of radio buttons with a legend; each option may carry a description. */
export function RadioGroup<V extends string>({
  name,
  legend,
  value,
  onChange,
  options,
  path,
}: {
  name: string
  legend: string
  value: V
  onChange: (v: V) => void
  options: { value: V; label: string; hint?: string }[]
  path: string
}) {
  const list = useIssues(path)
  const { t } = useT()
  return (
    <fieldset className="sb-radios" id={fieldId(path)} tabIndex={-1}>
      <legend className="sb-label">{legend}</legend>
      <div className="sb-radio-list">
        {options.map((o) => (
          <label key={o.value} className="sb-radio" data-checked={value === o.value || undefined}>
            <input type="radio" name={name} value={o.value} checked={value === o.value} onChange={() => onChange(o.value)} />
            <span className="sb-radio-text">
              <span className="sb-radio-label">{o.label}</span>
              {o.hint ? <span className="sb-radio-hint">{rich(o.hint)}</span> : null}
            </span>
          </label>
        ))}
      </div>
      {list.length ? <p className="sb-error">{issueMessage(list[0], t)}</p> : null}
    </fieldset>
  )
}

/** Checkboxes for a set of values. */
export function CheckGroup<V extends string>({
  legend,
  hint,
  value,
  onChange,
  options,
  path,
}: {
  legend: string
  hint?: string
  value: V[]
  onChange: (v: V[]) => void
  options: { value: V; label: string }[]
  path: string
}) {
  const { t } = useT()
  return (
    <fieldset className="sb-checks" id={fieldId(path)} tabIndex={-1}>
      <legend className="sb-label">
        {legend}{' '}
        <span className="sb-optional">{t('submit.optional')}</span>
      </legend>
      {hint ? <p className="sb-hint">{hint}</p> : null}
      <div className="sb-check-list">
        {options.map((o) => (
          <label key={o.value} className="sb-check">
            <input
              type="checkbox"
              checked={value.includes(o.value)}
              onChange={(e) =>
                onChange(e.target.checked ? options.map((x) => x.value).filter((v) => v === o.value || value.includes(v)) : value.filter((v) => v !== o.value))
              }
            />
            <span>{o.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}
