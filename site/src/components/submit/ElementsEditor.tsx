// The preview elements: add an element → pick its slot → fill its fields. Each element
// edits the DSL object directly (schema $defs.element), so the JSON and the live preview
// follow every keystroke.
import { useState } from 'react'
import { useT, type TKey } from '../../i18n'
import type { PreviewElement, Row, Slot } from '../../data/types'
import { MAX_ELEMENTS, SLOT_GROUPS, THEME_COLORS, newElement } from './draft'
import { ListField, SelectField, TextField, useIssues } from './fields'
import { issueMessage } from './messages'
import { IconPlus, IconX, RowEditorSingle, RowsEditor } from './RowsEditor'
import { fieldId } from './validate'

type El<S extends Slot> = Extract<PreviewElement, { slot: S }>

function IconArrow({ up }: { up?: boolean }) {
  return (
    <svg width={14} height={14} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d={up ? 'M10 15.5v-11M5.5 9 10 4.5 14.5 9' : 'M10 4.5v11M5.5 11 10 15.5 14.5 11'} />
    </svg>
  )
}

/** Rows or Markdown, for a command's answer and a message. */
function AnswerFields({
  rows,
  markdown,
  base,
  rowsKey,
  label,
  onChange,
}: {
  rows: Row[] | undefined
  markdown: string | undefined
  base: string
  rowsKey: 'output' | 'rows'
  label: string
  onChange: (patch: { rows?: Row[]; markdown?: string }) => void
}) {
  const { t } = useT()
  const mode: 'rows' | 'markdown' = markdown !== undefined && rows === undefined ? 'markdown' : 'rows'
  return (
    <>
      <SelectField
        path={`${base}/answer`}
        label={t('submit.f.el.answer')}
        value={mode}
        options={[
          { value: 'rows', label: t('submit.answer.rows') },
          { value: 'markdown', label: t('submit.answer.markdown') },
        ]}
        onChange={(v) =>
          onChange(v === 'markdown' ? { rows: undefined, markdown: markdown ?? '' } : { rows: rows ?? [['text']], markdown: undefined })
        }
      />
      {mode === 'rows' ? (
        <RowsEditor rows={rows ?? []} path={`${base}/${rowsKey}`} label={label} onChange={(r) => onChange({ rows: r, markdown: undefined })} />
      ) : (
        <TextField
          path={`${base}/markdown`}
          label={t('submit.f.el.markdown')}
          value={markdown ?? ''}
          multiline
          rows={4}
          mono
          onChange={(v) => onChange({ markdown: v, rows: undefined })}
        />
      )}
    </>
  )
}

function ElementBody({ el, base, set }: { el: PreviewElement; base: string; set: (next: PreviewElement) => void }) {
  const { t } = useT()
  const text = (key: string, label: TKey, value: string, onChange: (v: string) => void, opts: { optional?: boolean; mono?: boolean; multiline?: boolean; hint?: TKey } = {}) => (
    <TextField
      path={`${base}/${key}`}
      label={t(label)}
      value={value}
      optional={opts.optional}
      mono={opts.mono}
      multiline={opts.multiline}
      rows={2}
      hint={opts.hint ? t(opts.hint) : undefined}
      onChange={onChange}
    />
  )

  switch (el.slot) {
    case 'above-prompt':
      return <RowsEditor rows={el.rows} path={`${base}/rows`} label={t('submit.f.el.rows')} onChange={(rows) => set({ ...el, rows })} />
    case 'pane':
      return (
        <>
          <div className="sb-grid-2">
            {text('title', 'submit.f.el.title', el.title, (v) => set({ ...el, title: v }))}
            <SelectField
              path={`${base}/width`}
              label={t('submit.f.el.width')}
              value={el.width ?? 'narrow'}
              options={[
                { value: 'narrow', label: t('submit.width.narrow') },
                { value: 'wide', label: t('submit.width.wide') },
              ]}
              onChange={(v) => set({ ...el, width: v as 'narrow' | 'wide' })}
            />
          </div>
          <RowsEditor rows={el.rows} path={`${base}/rows`} label={t('submit.f.el.rows')} onChange={(rows) => set({ ...el, rows })} />
        </>
      )
    case 'status':
    case 'toast':
    case 'turn-duration':
    case 'background':
      return text('text', 'submit.f.el.text', el.text, (v) => set({ ...el, text: v }), { multiline: el.slot === 'background' })
    case 'notification':
      return (
        <>
          {text('title', 'submit.f.el.title', el.title ?? '', (v) => set({ ...el, title: v || undefined }), { optional: true })}
          {text('text', 'submit.f.el.text', el.text, (v) => set({ ...el, text: v }))}
        </>
      )
    case 'command':
      return (
        <>
          <div className="sb-grid-2">
            {text('command', 'submit.f.el.command', el.command, (v) => set({ ...el, command: v }), { mono: true })}
            {text('args', 'submit.f.el.args', el.args ?? '', (v) => set({ ...el, args: v || undefined }), { mono: true, optional: true })}
          </div>
          <AnswerFields
            rows={el.output}
            markdown={el.markdown}
            base={base}
            rowsKey="output"
            label={t('submit.f.el.rows')}
            onChange={(p) => set({ ...el, output: p.rows, markdown: p.markdown })}
          />
        </>
      )
    case 'tool-deny':
      return (
        <>
          <div className="sb-grid-2">
            {text('tool', 'submit.f.el.tool', el.tool, (v) => set({ ...el, tool: v }), { mono: true })}
            {text('input', 'submit.f.el.input', el.input, (v) => set({ ...el, input: v }), { mono: true })}
          </div>
          {text('message', 'submit.f.el.message', el.message, (v) => set({ ...el, message: v }), { multiline: true })}
        </>
      )
    case 'prompt-rewrite':
      return (
        <>
          {text('before', 'submit.f.el.before', el.before, (v) => set({ ...el, before: v }), { multiline: true })}
          {text('after', 'submit.f.el.after', el.after, (v) => set({ ...el, after: v }), { multiline: true })}
        </>
      )
    case 'spinner':
      return (
        <>
          {text('verb', 'submit.f.el.verb', el.verb, (v) => set({ ...el, verb: v }))}
          <ListField
            path={`${base}/glyphs`}
            label={t('submit.f.el.glyphs')}
            hint={t('submit.f.el.glyphs.hint')}
            optional
            spaces
            value={el.glyphs ?? []}
            onChange={(v) => set({ ...el, glyphs: v.length ? v : undefined })}
          />
          <SelectField
            path={`${base}/color`}
            label={t('submit.f.el.color')}
            optional
            value={el.color ?? ''}
            options={[
              { value: '', label: t('submit.color.default') },
              ...THEME_COLORS.map((c) => ({ value: c, label: c })),
            ]}
            onChange={(v) => set({ ...el, color: (v || undefined) as El<'spinner'>['color'] })}
          />
        </>
      )
    case 'prompt-hint':
    case 'session-mode':
    case 'info-notice':
      return <RowEditorSingle row={el.row} path={`${base}/row`} label={t('submit.f.el.row')} onChange={(row) => set({ ...el, row })} />
    case 'tool-row':
      return (
        <>
          <div className="sb-grid-2">
            {text('tool', 'submit.f.el.tool', el.tool, (v) => set({ ...el, tool: v }), { mono: true })}
            {text('input', 'submit.f.el.input', el.input, (v) => set({ ...el, input: v }), { mono: true })}
          </div>
          {el.row ? (
            <>
              <RowEditorSingle row={el.row} path={`${base}/row`} label={t('submit.f.el.toolLine')} onChange={(row) => set({ ...el, row })} />
              <button type="button" className="sb-text-btn" onClick={() => set({ ...el, row: undefined })}>
                {t('submit.f.el.toolLine.remove')}
              </button>
            </>
          ) : (
            <button type="button" className="sb-small-btn" onClick={() => set({ ...el, row: [{ text: el.tool, bold: true }, `(${el.input})`] })}>
              <IconPlus />
              {t('submit.f.el.toolLine.add')}
            </button>
          )}
          {el.result ? (
            <>
              <RowsEditor rows={el.result} path={`${base}/result`} label={t('submit.f.el.result')} onChange={(result) => set({ ...el, result })} />
              <button type="button" className="sb-text-btn" onClick={() => set({ ...el, result: undefined })}>
                {t('submit.f.el.result.remove')}
              </button>
            </>
          ) : (
            <button type="button" className="sb-small-btn" onClick={() => set({ ...el, result: [['Done']] })}>
              <IconPlus />
              {t('submit.f.el.result.add')}
            </button>
          )}
        </>
      )
    case 'message':
      return (
        <>
          <SelectField
            path={`${base}/role`}
            label={t('submit.f.el.role')}
            value={el.role}
            options={[
              { value: 'assistant', label: t('submit.role.assistant') },
              { value: 'user', label: t('submit.role.user') },
              { value: 'note', label: t('submit.role.note') },
            ]}
            onChange={(v) => set({ ...el, role: v as El<'message'>['role'] })}
          />
          <AnswerFields
            rows={el.rows}
            markdown={el.markdown}
            base={base}
            rowsKey="rows"
            label={t('submit.f.el.rows')}
            onChange={(p) => set({ ...el, rows: p.rows, markdown: p.markdown })}
          />
        </>
      )
    case 'model-tool':
      return (
        <>
          <div className="sb-grid-2">
            {text('name', 'submit.f.el.name', el.name, (v) => set({ ...el, name: v }), { mono: true })}
            {text('input', 'submit.f.el.input', el.input ?? '', (v) => set({ ...el, input: v || undefined }), { mono: true, optional: true })}
          </div>
          {el.result ? (
            <>
              <RowsEditor rows={el.result} path={`${base}/result`} label={t('submit.f.el.result')} onChange={(result) => set({ ...el, result })} />
              <button type="button" className="sb-text-btn" onClick={() => set({ ...el, result: undefined })}>
                {t('submit.f.el.result.remove')}
              </button>
            </>
          ) : (
            <button type="button" className="sb-small-btn" onClick={() => set({ ...el, result: [['Done']] })}>
              <IconPlus />
              {t('submit.f.el.result.add')}
            </button>
          )}
        </>
      )
  }
}

export default function ElementsEditor({ elements, onChange }: { elements: PreviewElement[]; onChange: (els: PreviewElement[]) => void }) {
  const { t } = useT()
  const [slot, setSlot] = useState<Slot>('status')
  const listIssues = useIssues('/preview/elements')
  const slotName = (s: Slot) => t(`common.slot.${s}` as TKey)

  const move = (i: number, d: -1 | 1) => {
    const j = i + d
    if (j < 0 || j >= elements.length) return
    const next = [...elements]
    ;[next[i], next[j]] = [next[j], next[i]]
    onChange(next)
    // keep focus on the same control of the moved element
    requestAnimationFrame(() => document.getElementById(`sb-el-${j}-${d < 0 ? 'up' : 'down'}`)?.focus())
  }

  return (
    <div className="sb-elements" id={fieldId('/preview/elements')} tabIndex={-1}>
      <div className="sb-elements-head">
        <h4 className="sb-sub">{t('submit.elements.title')}</h4>
        <p className="sb-hint">{t('submit.elements.hint')}</p>
      </div>

      <ol className="sb-el-list">
        {elements.map((el, i) => {
          const base = `/preview/elements/${i}`
          return (
            <li key={i} className="sb-el">
              <fieldset className="sb-el-box">
                <legend className="sb-el-legend">{t('submit.el.label', { n: i + 1, slot: slotName(el.slot) })}</legend>
                <div className="sb-el-tools">
                  <button
                    type="button"
                    id={`sb-el-${i}-up`}
                    className="sb-icon-btn"
                    aria-label={t('submit.el.up', { n: i + 1 })}
                    title={t('submit.el.up', { n: i + 1 })}
                    disabled={i === 0}
                    onClick={() => move(i, -1)}
                  >
                    <IconArrow up />
                  </button>
                  <button
                    type="button"
                    id={`sb-el-${i}-down`}
                    className="sb-icon-btn"
                    aria-label={t('submit.el.down', { n: i + 1 })}
                    title={t('submit.el.down', { n: i + 1 })}
                    disabled={i === elements.length - 1}
                    onClick={() => move(i, 1)}
                  >
                    <IconArrow />
                  </button>
                  <button
                    type="button"
                    className="sb-text-btn sb-danger"
                    aria-label={t('submit.el.remove', { n: i + 1 })}
                    onClick={() => onChange(elements.filter((_, j) => j !== i))}
                  >
                    <IconX />
                    {t('submit.el.removeShort')}
                  </button>
                </div>
                <div className="sb-el-body">
                  <ElementBody el={el} base={base} set={(next) => onChange(elements.map((x, j) => (j === i ? next : x)))} />
                </div>
              </fieldset>
            </li>
          )
        })}
      </ol>

      {listIssues.length ? <p className="sb-error">{issueMessage(listIssues[0], t)}</p> : null}

      {elements.length < MAX_ELEMENTS ? (
        <div className="sb-add sb-add-el">
          <label className="sb-label" htmlFor="sb-new-element">
            {t('submit.el.addKind')}
          </label>
          <div className="sb-add-row">
            <select id="sb-new-element" className="sb-input sb-select" value={slot} onChange={(e) => setSlot(e.target.value as Slot)}>
              {SLOT_GROUPS.map((g) => (
                <optgroup key={g.key} label={t(`submit.group.${g.key}` as TKey)}>
                  {g.slots.map((s) => (
                    <option key={s} value={s}>
                      {slotName(s)}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            <button type="button" className="btn btn-secondary sb-add-btn" onClick={() => onChange([...elements, newElement(slot)])}>
              <IconPlus />
              {t('submit.el.add')}
            </button>
          </div>
        </div>
      ) : (
        <p className="sb-hint">{t('submit.el.full')}</p>
      )}
    </div>
  )
}
