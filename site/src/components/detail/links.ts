// Links inside mod descriptions (richText.tsx): https only, and the real host shown when the
// link text names another address.

/** The host of an https URL, or null for anything else. */
export function httpsHost(href: string): string | null {
  try {
    const u = new URL(href)
    return u.protocol === 'https:' ? u.hostname.toLowerCase() : null
  } catch {
    return null
  }
}

/** Text that reads like an address or a domain ("github.com/x", "example.org"). */
const LOOKS_LIKE_URL = /(?:^|[\s/(])(?:[a-z0-9-]+\.)+[a-z]{2,}(?:[/:\s)]|$)|^https?:/i

/**
 * Link text a description author chose may name another site than the one it opens
 * ("[github.com/anthropics/claude-code](https://elsewhere.example)"). When the text reads like an
 * address that is not the real host, returns the real host to show next to it; otherwise null.
 */
export function hostNote(label: string, href: string): string | null {
  const host = httpsHost(href)
  if (!host) return null
  const text = label.toLowerCase()
  if (!LOOKS_LIKE_URL.test(text)) return null
  const bare = host.replace(/^www\./, '')
  return text.includes(bare) ? null : host
}
