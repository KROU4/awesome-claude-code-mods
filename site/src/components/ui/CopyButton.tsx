// Copy button: writes `text` to the clipboard inside the click handler, toasts "Copied",
// falls back to selecting `selectTarget` when the clipboard is unavailable.
import { useState, type RefObject } from 'react'
import { useT } from '../../i18n'
import { copyText } from '../../lib/clipboard'
import { IconCheck, IconCopy } from './icons'
import { useToast } from './Toaster'
import './ui.css'

export type CopyButtonProps = {
  text: string
  /** What is copied, for the accessible name: "Copy: install command". */
  what?: string
  /** Visible label; default "Copy". Pass null for an icon-only button. */
  label?: string | null
  selectTarget?: RefObject<HTMLElement | null>
  className?: string
  /** ghost/solid: the small copy button; plain: only `className` (e.g. 'btn btn-secondary'). */
  variant?: 'ghost' | 'solid' | 'plain'
}

export default function CopyButton({ text, what, label, selectTarget, className, variant = 'ghost' }: CopyButtonProps) {
  const { t } = useT()
  const toast = useToast()
  const [done, setDone] = useState(false)
  const visible = label === undefined ? t('common.copy.button') : label
  return (
    <button
      type="button"
      className={(variant === 'plain' ? [className] : ['copy-btn', `copy-btn-${variant}`, className]).filter(Boolean).join(' ')}
      aria-label={what ? t('common.copy.aria', { what }) : undefined}
      onClick={async () => {
        const ok = await copyText(text, selectTarget?.current)
        toast.show(ok ? t('common.copy.done') : t('common.copy.failed'))
        if (ok) {
          setDone(true)
          window.setTimeout(() => setDone(false), 1600)
        }
      }}
    >
      {done ? <IconCheck size={16} /> : <IconCopy size={16} />}
      {visible ? <span>{visible}</span> : null}
    </button>
  )
}
