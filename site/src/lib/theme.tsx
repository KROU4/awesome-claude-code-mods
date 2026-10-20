import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useState, type ReactNode } from 'react'
import { readPref, writePref } from './storage'

/** What the person chose. `system` follows prefers-color-scheme. */
export type ThemePref = 'system' | 'light' | 'dark'
export type ResolvedTheme = 'light' | 'dark'

type ThemeContextValue = {
  pref: ThemePref
  resolved: ResolvedTheme
  setPref: (pref: ThemePref) => void
  /** system → light → dark → system */
  cycle: () => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

const query = '(prefers-color-scheme: dark)'
const THEME_COLOR = { light: '#faf9f5', dark: '#1f1e1d' } as const

function initialPref(): ThemePref {
  const v = readPref('theme')
  return v === 'light' || v === 'dark' ? v : 'system'
}

function systemIsDark(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia(query).matches
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [pref, setPrefState] = useState<ThemePref>(initialPref)
  const [systemDark, setSystemDark] = useState<boolean>(systemIsDark)

  useEffect(() => {
    if (!window.matchMedia) return
    const mq = window.matchMedia(query)
    const onChange = () => setSystemDark(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  const resolved: ResolvedTheme = pref === 'system' ? (systemDark ? 'dark' : 'light') : pref

  useLayoutEffect(() => {
    const html = document.documentElement
    html.setAttribute('data-theme', resolved)
    html.setAttribute('data-theme-pref', pref)
    document.querySelectorAll('meta[name="theme-color"]').forEach((m) => {
      m.setAttribute('content', THEME_COLOR[resolved])
    })
  }, [resolved, pref])

  const setPref = useCallback((next: ThemePref) => {
    setPrefState(next)
    writePref('theme', next === 'system' ? null : next)
  }, [])

  const cycle = useCallback(() => {
    setPrefState((cur) => {
      const next: ThemePref = cur === 'system' ? 'light' : cur === 'light' ? 'dark' : 'system'
      writePref('theme', next === 'system' ? null : next)
      return next
    })
  }, [])

  const value = useMemo(() => ({ pref, resolved, setPref, cycle }), [pref, resolved, setPref, cycle])
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme() needs <ThemeProvider>')
  return ctx
}
