import { atom, update } from 'claude-code'
import type { Register } from 'claude-code'

import { findSecret, rulesFrom } from './secrets'

const blocked = atom({ plugin: 'secret-guard', key: 'blocked' } as const, 0)

const denial = (path: string) =>
  `secret-guard: ${path} looks like a secret; ask the person to share what is needed.`
const FAILED = 'secret-guard: its check failed, so the call was refused.'

export const register: Register = (on, options) => {
  const rules = rulesFrom(options)

  on('tool.call', async ($, e, next) => {
    const secret = findSecret(e, rules)
    if (secret === undefined) return next(e)

    const count = await update($, blocked, n => n + 1)
    $.ui.status(`secret-guard · ${count} blocked`)
    $.ui.toast(`⊘ blocked ${String(e.tool)}: ${secret}`)

    return { deny: denial(secret) }
  }).catch(async ($, e, next) => {
    if (next.called) return next(e)
    let secret: string | undefined
    try {
      secret = findSecret(e, rules)
    } catch {
      return { deny: FAILED }
    }
    if (secret !== undefined) return { deny: denial(secret) }

    // Re-entry (raised beneath a call of ours): judged here on `e` alone. Any other failure fails closed.
    return next.error.kind === 're-entry' ? next(e) : { deny: FAILED }
  })
}
