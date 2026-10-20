// localStorage that never throws (private windows, blocked site data, previews).
// Only for per-viewer conveniences: theme, language, filters, loadout, motion.

const PREFIX = 'ms.'

export function readPref(key: string): string | null {
  try {
    return window.localStorage.getItem(PREFIX + key)
  } catch {
    return null
  }
}

export function writePref(key: string, value: string | null): void {
  try {
    if (value === null) window.localStorage.removeItem(PREFIX + key)
    else window.localStorage.setItem(PREFIX + key, value)
  } catch {
    /* storage unavailable: the choice lasts for this page view only */
  }
}

export function readJSON<T>(key: string, fallback: T): T {
  const raw = readPref(key)
  if (raw === null) return fallback
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export function writeJSON(key: string, value: unknown): void {
  writePref(key, JSON.stringify(value))
}
