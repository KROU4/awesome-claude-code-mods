// A terminal gives every glyph a whole cell, whatever font ends up drawing it. The browser
// does not: a glyph JetBrains Mono lacks is drawn by a fallback font at that font's width
// (✻ in Segoe UI Symbol is 1.5ch, ⎿ in Cambria Math 1.5ch), and the row slides off the grid.
// `cells()` puts each such glyph in an inline-block exactly 1ch wide (2ch for emoji), as the
// terminal would. Glyphs the bundled fonts have at 1ch (letters, box drawing, blocks, most
// geometric shapes, arrows: styles/fonts.css) stay plain text.
//
// A terminal also gives every glyph the whole row height, so │ and █ on stacked rows join.
// The font's box-drawing and block glyphs are 1.32em tall and a mock row is 1.45em, so runs
// of them go in a `tm-bx` span that stretches them to the row (terminal.css).
import type { ReactNode } from 'react'

/** Code points in U+2100–2BFF that JetBrains Mono (and so 'Showroom Mono Symbols') draws at 1ch. */
const COVERED =
  /[ℓℕ№™℮←-↙⇧∀∂∃∈∉∋∌∏-−∕∘-√∞∣∥∧∨∫∷∼≈≉≠≡≤≥⊂-⊇⌂-⌅⌘⌥⍴⏻-⏾─-□▪▫▲-◇◊◌◎●◔◕◧-◫◯⚠⚡✕❮-❱⟨⟩⭘]/
const PICTO = /\p{Extended_Pictographic}/u
/** Emoji shown as emoji by default (✅ ⭐ ⏳): two cells in a terminal. */
const EMOJI = /\p{Emoji_Presentation}/u
/** Box drawing (U+2500–257F) and block elements (U+2580–259F). */
const BOXISH = /[─-▟]/
/** Box-drawing glyphs with no vertical stroke: on their own they need no stretching. */
const FLAT = /[─━┄┅┈┉╌╍═╴╶╸╺╼╾]/
/** A vertical frame stroke: a row holding one is laid out like a frame (terminal.css .is-frame). */
export const FRAME_STROKE = /[│┃┆┇┊┋╎╏║├┤┌┐└┘╭╮╯╰┏┓┗┛╔╗╚╝┣┫╠╣▏▎▕]/

/** East Asian wide characters (Hangul, CJK, kana, full-width forms): two cells in a terminal. */
function eastAsianWide(cp: number): boolean {
  return (
    (cp >= 0x1100 && cp <= 0x115f) ||
    (cp >= 0x2e80 && cp <= 0x303e) ||
    (cp >= 0x3041 && cp <= 0x33ff) ||
    (cp >= 0x3400 && cp <= 0x4dbf) ||
    (cp >= 0x4e00 && cp <= 0x9fff) ||
    (cp >= 0xa000 && cp <= 0xa4cf) ||
    (cp >= 0xac00 && cp <= 0xd7a3) ||
    (cp >= 0xf900 && cp <= 0xfaff) ||
    (cp >= 0xfe30 && cp <= 0xfe4f) ||
    (cp >= 0xff00 && cp <= 0xff60) ||
    (cp >= 0xffe0 && cp <= 0xffe6)
  )
}

function cellWidth(ch: string): 0 | 1 | 2 {
  const cp = ch.codePointAt(0) ?? 0
  if (eastAsianWide(cp)) return 2
  if (cp < 0x2100) return 0
  if (cp <= 0x2bff) {
    if (COVERED.test(ch)) return 0
    return EMOJI.test(ch) ? 2 : 1
  }
  return cp >= 0x1f000 && PICTO.test(ch) ? 2 : 0
}

/** Terminal columns `text` takes: wide glyphs (CJK, emoji) count two. */
export function columns(text: string): number {
  let n = 0
  for (const ch of text) {
    const cp = ch.codePointAt(0) ?? 0
    n += eastAsianWide(cp) || (cp >= 0x1f300 && cp <= 0x1faff) ? 2 : 1
  }
  return n
}

/**
 * `text` with every glyph the fonts lack wrapped in a fixed-width cell, and runs of box
 * drawing with a vertical stroke (or block elements) stretched to the row. Plain string when
 * neither occurs.
 */
export function cells(text: string): ReactNode {
  let out: ReactNode[] | null = null
  let run = ''
  let box = ''
  let key = 0
  const flushBox = () => {
    if (!box) return
    if ([...box].every((c) => FLAT.test(c))) run += box
    else {
      out ??= []
      if (run) out.push(run)
      run = ''
      out.push(
        <span key={key++} className="tm-bx">
          {box}
        </span>,
      )
    }
    box = ''
  }
  const chars = Array.from(text)
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i]
    if (BOXISH.test(ch)) {
      box += ch
      continue
    }
    flushBox()
    const w = cellWidth(ch)
    if (!w) {
      run += ch
      continue
    }
    out ??= []
    if (run) out.push(run)
    run = ''
    // keep a following variation selector with its glyph
    const glyph = chars[i + 1] === '️' || chars[i + 1] === '︎' ? ch + chars[++i] : ch
    out.push(
      <span key={key++} className={w === 2 ? 'tm-cell is-wide' : 'tm-cell'}>
        {glyph}
      </span>,
    )
  }
  flushBox()
  if (!out) return run
  if (run) (out as ReactNode[]).push(run)
  return out
}
