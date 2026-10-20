// The generated parts of README.md (Russian) and README.en.md (English): the catalog between
// <!-- mods:start --> and <!-- mods:end -->, and the mod count between <!-- count:start --> and
// <!-- count:end -->. Entry text comes from contributors, so it is escaped for Markdown and HTML.
import { CATEGORIES } from './constants.mjs'

export const SLOT_LABELS = {
  'above-prompt': { en: 'band above the prompt', ru: 'полоса над промптом' },
  pane: { en: 'pane', ru: 'панель' },
  status: { en: 'status line', ru: 'строка статуса' },
  toast: { en: 'toast', ru: 'всплывающее сообщение' },
  notification: { en: 'notification', ru: 'системное уведомление' },
  command: { en: 'slash command', ru: 'слеш-команда' },
  'tool-deny': { en: 'tool guard', ru: 'блокировка инструментов' },
  'prompt-rewrite': { en: 'prompt rewrite', ru: 'переписывание промпта' },
  spinner: { en: 'spinner', ru: 'спиннер' },
  'prompt-hint': { en: 'hint line', ru: 'строка подсказки' },
  'session-mode': { en: 'mode label', ru: 'метка режима' },
  'turn-duration': { en: 'turn duration line', ru: 'строка длительности хода' },
  'tool-row': { en: 'tool rows', ru: 'строки инструментов' },
  message: { en: 'transcript messages', ru: 'сообщения в переписке' },
  'info-notice': { en: 'info notice', ru: 'инфо-строка' },
  'model-tool': { en: 'tool for Claude', ru: 'инструмент для Claude' },
  background: { en: 'background behaviour', ru: 'работа в фоне' },
}

const TEXT = {
  en: {
    draws: 'draws',
    by: 'by',
    hosted: 'hosted here',
    external: 'external',
    install: 'Install',
    otherMarketplace: 'from the author’s marketplace',
    empty: 'No mods yet. [Add the first one](CONTRIBUTING.en.md).',
    categories: 'Categories',
  },
  ru: {
    draws: 'рисует',
    by: 'автор',
    hosted: 'в этом репозитории',
    external: 'внешний',
    install: 'Установка',
    otherMarketplace: 'из маркетплейса автора',
    empty: 'Модов пока нет. [Добавьте первый](CONTRIBUTING.md).',
    categories: 'Категории',
  },
}

/** Escapes text for inline Markdown on GitHub (no HTML, no links, no emphasis). */
export function mdEscape(text) {
  return String(text)
    .replace(/\r?\n/g, ' ')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/([\\`*_[\]|~#!])/g, '\\$1')
}

const withPeriod = text => (/[.!?…]$/.test(text.trim()) ? text.trim() : `${text.trim()}.`)

/** GitHub's heading anchor: lower case, punctuation dropped, spaces to dashes (Cyrillic kept). */
export const anchorOf = heading =>
  heading.toLowerCase().trim().replace(/[^\p{L}\p{N}\s-]/gu, '').replace(/\s/g, '-')

/** "9 mods" / "9 модов". */
export function countPhrase(count, lang) {
  if (lang === 'en') return `${count} ${count === 1 ? 'mod' : 'mods'}`
  const mod10 = count % 10
  const mod100 = count % 100
  const word = mod10 === 1 && mod100 !== 11 ? 'мод' : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14) ? 'мода' : 'модов'
  return `${count} ${word}`
}

function modItem(mod, lang) {
  const t = TEXT[lang]
  const tagline = lang === 'ru' && mod.tagline_ru ? mod.tagline_ru : mod.tagline
  const slots = mod.slots.filter(s => s !== 'background').map(s => SLOT_LABELS[s]?.[lang] || s)
  const author = mod.author?.github ? `@${mod.author.github}` : mod.author?.name
  const kind = mod.hosted ? t.hosted : t.external
  const meta = [
    slots.length ? `${t.draws}: ${slots.map(mdEscape).join(', ')}` : null,
    author ? `${t.by} ${mdEscape(author)}` : null,
    kind,
  ].filter(Boolean).join(' · ')
  const lines = [`- **[${mdEscape(mod.title)}](${mod.siteUrl})** — ${mdEscape(withPeriod(tagline))} <sub>${meta}</sub>`]
  const summary = mod.inMarketplace ? t.install : `${t.install} (${t.otherMarketplace})`
  lines.push(`  <details><summary>${summary}</summary>`, '')
  lines.push('  ```text', `  ${mod.install.terminal}`, '  ```', '')
  lines.push('  </details>')
  return lines.join('\n')
}

/** The catalog block (without the markers), grouped by category in the CATEGORIES order. */
export function renderCatalog(mods, lang) {
  const t = TEXT[lang]
  if (!mods.length) return t.empty
  const groups = CATEGORIES.map(c => ({
    title: lang === 'ru' ? c.title_ru : c.title,
    mods: mods.filter(m => m.category === c.id).sort((a, b) => a.title.localeCompare(b.title, 'en')),
  })).filter(g => g.mods.length)
  const out = [`${t.categories}: ${groups.map(g => `[${g.title}](#${anchorOf(g.title)})`).join(' · ')}`]
  for (const g of groups) {
    out.push('', `### ${g.title}`, '')
    out.push(g.mods.map(m => modItem(m, lang)).join('\n'))
  }
  return out.join('\n')
}

/** Replaces the text between `<!-- key:start -->` and `<!-- key:end -->`. Throws if absent. */
export function replaceBlock(text, key, content, { inline = false } = {}) {
  const start = `<!-- ${key}:start -->`
  const end = `<!-- ${key}:end -->`
  const i = text.indexOf(start)
  const j = text.indexOf(end, i + start.length)
  if (i < 0 || j < 0) throw new Error(`markers ${start} … ${end} not found`)
  const body = inline ? content : `\n${content}\n`
  return text.slice(0, i + start.length) + body + text.slice(j)
}

/** README text with both generated blocks refreshed. */
export function updateReadme(text, mods, lang) {
  let out = replaceBlock(text, 'mods', renderCatalog(mods, lang))
  out = replaceBlock(out, 'count', countPhrase(mods.length, lang), { inline: true })
  return out
}
