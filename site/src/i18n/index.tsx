// i18n: RU and EN. Keys are "<area>.<key>", e.g. t('common.nav.catalog'), typed from the
// per-area dictionaries. Default language: <html lang> set before paint (index.html),
// which reads localStorage and falls back to navigator.language (ru* → ru).
import { createContext, useCallback, useContext, useLayoutEffect, useMemo, useState, type ReactNode } from 'react'
import { readPref, writePref } from '../lib/storage'
import type { Lang } from './define'
import common from './common'
import mock from './mock'
import hero from './hero'
import catalog from './catalog'
import install from './install'
import submit from './submit'
import how from './how'

export type { Lang } from './define'

const dicts = { common, mock, hero, catalog, install, submit, how }
type Dicts = typeof dicts
type Area = keyof Dicts

/** Every translation key, e.g. "common.nav.catalog". */
export type TKey = { [A in Area]: `${A}.${keyof Dicts[A]['en'] & string}` }[Area]
/** Keys that have plural forms: "hero.counter.mods" for "hero.counter.mods.one|other". */
export type TPluralKey = TKey extends infer K ? (K extends `${infer B}.other` ? B : never) : never
export type TVars = Record<string, string | number>

function lookup(lang: Lang, key: string): string | undefined {
  const dot = key.indexOf('.')
  const area = key.slice(0, dot) as Area
  const rest = key.slice(dot + 1)
  const d = dicts[area] as unknown as { en: Record<string, string>; ru: Record<string, string> } | undefined
  if (!d) return undefined
  return d[lang][rest] ?? d.en[rest]
}

function interpolate(s: string, vars?: TVars): string {
  if (!vars) return s
  return s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m))
}

export function translate(lang: Lang, key: TKey, vars?: TVars): string {
  return interpolate(lookup(lang, key) ?? key, vars)
}

const pluralRules: Record<Lang, Intl.PluralRules> = {
  en: new Intl.PluralRules('en'),
  ru: new Intl.PluralRules('ru'),
}

export function translatePlural(lang: Lang, key: TPluralKey, n: number, vars?: TVars): string {
  const form = pluralRules[lang].select(n)
  const s = lookup(lang, `${key}.${form}`) ?? lookup(lang, `${key}.other`) ?? key
  return interpolate(s, { n: formatNumber(lang, n), ...vars })
}

export function formatNumber(lang: Lang, n: number, compact = false): string {
  return new Intl.NumberFormat(lang === 'ru' ? 'ru-RU' : 'en-US', compact ? { notation: 'compact', maximumFractionDigits: 1 } : {}).format(n)
}

/** "3 minutes ago" / "3 минуты назад"; "just now" under a minute. */
export function formatRelative(lang: Lang, date: Date, now = Date.now()): string {
  const diff = (date.getTime() - now) / 1000
  const abs = Math.abs(diff)
  if (abs < 60) return translate(lang, 'common.time.justNow')
  const rtf = new Intl.RelativeTimeFormat(lang, { numeric: 'auto' })
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ['minute', 60],
    ['hour', 3600],
    ['day', 86400],
    ['week', 604800],
    ['month', 2629800],
    ['year', 31557600],
  ]
  let unit: Intl.RelativeTimeFormatUnit = 'minute'
  let size = 60
  for (const [u, s] of units) if (abs >= s) [unit, size] = [u, s]
  return rtf.format(Math.round(diff / size), unit)
}

export function formatDate(lang: Lang, date: Date): string {
  return new Intl.DateTimeFormat(lang === 'ru' ? 'ru-RU' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(date)
}

/** The Russian field when RU is on and the field exists, else English. */
export function pickLang(lang: Lang, en: string, ru?: string | null): string {
  return lang === 'ru' && ru ? ru : en
}

type I18nValue = {
  lang: Lang
  setLang: (lang: Lang) => void
  toggleLang: () => void
}

const Ctx = createContext<I18nValue | null>(null)

function initialLang(): Lang {
  const fromHtml = typeof document !== 'undefined' ? document.documentElement.getAttribute('lang') : null
  if (fromHtml === 'ru' || fromHtml === 'en') return fromHtml
  const saved = readPref('lang')
  if (saved === 'ru' || saved === 'en') return saved
  return typeof navigator !== 'undefined' && /^ru\b/i.test(navigator.language) ? 'ru' : 'en'
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang)

  useLayoutEffect(() => {
    document.documentElement.setAttribute('lang', lang)
    document.title = translate(lang, 'common.brand.title')
  }, [lang])

  const setLang = useCallback((next: Lang) => {
    setLangState(next)
    writePref('lang', next)
  }, [])
  const toggleLang = useCallback(() => {
    setLangState((cur) => {
      const next: Lang = cur === 'ru' ? 'en' : 'ru'
      writePref('lang', next)
      return next
    })
  }, [])

  const value = useMemo(() => ({ lang, setLang, toggleLang }), [lang, setLang, toggleLang])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useLang(): I18nValue {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useLang() needs <I18nProvider>')
  return ctx
}

export type T = {
  lang: Lang
  /** t('common.nav.catalog'), t('mock.rewritten', { mod: 'x' }) */
  t: (key: TKey, vars?: TVars) => string
  /** tn('hero.counter.mods', 9) → "9 mods" / "9 модов" */
  tn: (key: TPluralKey, n: number, vars?: TVars) => string
  /** pick(mod.tagline, mod.tagline_ru) */
  pick: (en: string, ru?: string | null) => string
  num: (n: number, compact?: boolean) => string
  relative: (date: Date) => string
  date: (date: Date) => string
}

export function useT(): T {
  const { lang } = useLang()
  return useMemo<T>(
    () => ({
      lang,
      t: (key, vars) => translate(lang, key, vars),
      tn: (key, n, vars) => translatePlural(lang, key, n, vars),
      pick: (en, ru) => pickLang(lang, en, ru),
      num: (n, compact) => formatNumber(lang, n, compact),
      relative: (d) => formatRelative(lang, d),
      date: (d) => formatDate(lang, d),
    }),
    [lang],
  )
}
