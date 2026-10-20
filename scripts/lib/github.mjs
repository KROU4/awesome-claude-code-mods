// A small GitHub REST client on fetch. Everything it returns is data: nothing read through it is
// executed. Uses GITHUB_TOKEN (or GH_TOKEN) when set.

const API = 'https://api.github.com'

export const githubToken = () => process.env.GITHUB_TOKEN || process.env.GH_TOKEN || ''

export class GitHubError extends Error {
  constructor(status, message, url) {
    super(`GitHub ${status} for ${url}: ${message}`)
    this.status = status
  }
}

/**
 * Calls the REST API. `path` is "/repos/o/r/..." or a full URL. Options: method, body, accept,
 * token (default: GITHUB_TOKEN), allow404 (resolve null instead of throwing).
 */
export async function gh(path, { method = 'GET', body, accept = 'application/vnd.github+json', token = githubToken(), allow404 = false, raw = false } = {}) {
  const url = path.startsWith('http') ? path : `${API}${path}`
  const headers = { Accept: accept, 'User-Agent': 'claude-code-mod-showroom-bot', 'X-GitHub-Api-Version': '2022-11-28' }
  if (token) headers.Authorization = `Bearer ${token}`
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  const res = await fetch(url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(30_000) })
  if (res.status === 404 && allow404) return null
  if (!res.ok) {
    let message = res.statusText
    try {
      message = (await res.json()).message || message
    } catch {
      /* not JSON */
    }
    throw new GitHubError(res.status, message, url)
  }
  if (res.status === 204) return null
  if (raw) return await res.text()
  const text = await res.text()
  return text ? JSON.parse(text) : null
}

/** Follows `page=` until a page comes back shorter than `per_page` (max `maxPages`). */
export async function ghPaginate(path, { perPage = 100, maxPages = 30, ...opts } = {}) {
  const out = []
  const sep = path.includes('?') ? '&' : '?'
  for (let page = 1; page <= maxPages; page++) {
    const items = await gh(`${path}${sep}per_page=${perPage}&page=${page}`, opts)
    const list = Array.isArray(items) ? items : items?.items || []
    out.push(...list)
    if (list.length < perPage) break
  }
  return out
}

/** A file's text at a ref, or null when it does not exist. */
export async function fileAt(repo, path, ref, opts = {}) {
  const encoded = path.split('/').map(encodeURIComponent).join('/')
  return gh(`/repos/${repo}/contents/${encoded}?ref=${encodeURIComponent(ref)}`, {
    accept: 'application/vnd.github.raw+json',
    allow404: true,
    raw: true,
    ...opts,
  })
}

/** Raw file from raw.githubusercontent.com (no API quota), or null. */
export async function rawFile(repo, ref, path) {
  const encoded = path.split('/').map(encodeURIComponent).join('/')
  const res = await fetch(`https://raw.githubusercontent.com/${repo}/${ref}/${encoded}`, { signal: AbortSignal.timeout(30_000) })
  if (!res.ok) return null
  return res.text()
}
