// Copy text from inside a click handler. Falls back to a hidden textarea + execCommand,
// and finally to selecting `fallbackTarget` so the person can press Ctrl+C.

export async function copyText(text: string, fallbackTarget?: HTMLElement | null): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    /* fall through */
  }
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.setAttribute('readonly', '')
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    ta.style.pointerEvents = 'none'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    if (ok) return true
  } catch {
    /* fall through */
  }
  if (fallbackTarget) {
    const sel = window.getSelection()
    const range = document.createRange()
    range.selectNodeContents(fallbackTarget)
    sel?.removeAllRanges()
    sel?.addRange(range)
  }
  return false
}
