// Built-in scenes: short, realistic Claude Code sessions in a small TypeScript shop
// project (~/shop). A mod's preview names one (`preview.scene`) or brings its own
// `preview.transcript`. Results are Rows so numbers can be bold, as the client draws them.
import type { Row } from '../../data/types'

export type SceneName = 'coding' | 'debugging' | 'review' | 'idle'

export type SceneTurn =
  | { role: 'user'; text: string }
  /** Inline `code` and **bold** are drawn the way the client renders Markdown. */
  | { role: 'assistant'; text: string }
  | { role: 'tool'; tool: string; input: string; result?: Row[]; status?: 'done' | 'running' | 'error' }

export type Scene = {
  name: SceneName
  turns: SceneTurn[]
  /** Present participle on the spinner while the turn works. */
  verb: string
  /** Past tense for the turn-duration line ("Baked for 1m 12s"). */
  pastVerb: string
  /** Final elapsed seconds and output tokens shown by the spinner / turn line. */
  seconds: number
  tokens: number
}

const b = (text: string) => ({ text, bold: true })

export const SCENES: Record<SceneName, Scene> = {
  coding: {
    name: 'coding',
    verb: 'Architecting',
    pastVerb: 'Baked',
    seconds: 72,
    tokens: 4800,
    turns: [
      { role: 'user', text: 'Add a discount code field to checkout and reject expired codes on the server.' },
      { role: 'assistant', text: 'I’ll read the checkout form and the order API first.' },
      { role: 'tool', tool: 'Read', input: 'src/components/CheckoutForm.tsx', result: [['Read ', b('142'), ' lines']] },
      { role: 'tool', tool: 'Read', input: 'src/api/orders.ts', result: [['Read ', b('88'), ' lines']] },
      {
        role: 'tool',
        tool: 'Update',
        input: 'src/components/CheckoutForm.tsx',
        result: [['Updated ', b('src/components/CheckoutForm.tsx'), ' with ', b('24'), ' additions and ', b('3'), ' removals']],
      },
      {
        role: 'tool',
        tool: 'Update',
        input: 'src/api/orders.ts',
        result: [['Updated ', b('src/api/orders.ts'), ' with ', b('31'), ' additions']],
      },
      { role: 'tool', tool: 'Bash', input: 'npm test -- checkout', result: [['Tests  ', b('14 passed'), ' (14)']] },
      {
        role: 'assistant',
        text: 'Checkout now has a `discountCode` field with inline validation, and `POST /orders` rejects unknown or expired codes with a 422. All 14 checkout tests pass.',
      },
    ],
  },

  debugging: {
    name: 'debugging',
    verb: 'Cogitating',
    pastVerb: 'Cooked',
    seconds: 124,
    tokens: 7100,
    turns: [
      { role: 'user', text: 'The cart total is off by a cent when two items share a 15% discount. Find out why.' },
      { role: 'tool', tool: 'Search', input: 'pattern: "applyDiscount", path: "src"', result: [['Found ', b('4'), ' files']] },
      { role: 'tool', tool: 'Read', input: 'src/lib/pricing.ts', result: [['Read ', b('64'), ' lines']] },
      {
        role: 'tool',
        tool: 'Bash',
        input: 'npx vitest run pricing',
        status: 'error',
        result: [['FAIL  src/lib/pricing.test.ts > shared discount total'], ['Expected 84.15, received 84.16']],
      },
      { role: 'assistant', text: 'Each line item is rounded before the sum, so both 15% discounts round up. I’ll round once, on the total.' },
      {
        role: 'tool',
        tool: 'Update',
        input: 'src/lib/pricing.ts',
        result: [['Updated ', b('src/lib/pricing.ts'), ' with ', b('6'), ' additions and ', b('4'), ' removals']],
      },
      { role: 'tool', tool: 'Bash', input: 'npx vitest run pricing', result: [['Tests  ', b('12 passed'), ' (12)']] },
      {
        role: 'assistant',
        text: 'Fixed: `cartTotal()` now sums exact amounts and rounds once at the end. The new shared-discount test passes, along with the other 11.',
      },
    ],
  },

  review: {
    name: 'review',
    verb: 'Combobulating',
    pastVerb: 'Churned',
    seconds: 48,
    tokens: 3200,
    turns: [
      { role: 'user', text: 'Review this branch before I open the PR.' },
      {
        role: 'tool',
        tool: 'Bash',
        input: 'git diff main --stat',
        result: [['6 files changed, ', b('212'), ' insertions(+), ', b('40'), ' deletions(-)']],
      },
      { role: 'tool', tool: 'Read', input: 'src/api/payments.ts', result: [['Read ', b('120'), ' lines']] },
      { role: 'tool', tool: 'Read', input: 'src/api/payments.test.ts', result: [['Read ', b('76'), ' lines']] },
      {
        role: 'assistant',
        text: 'Three things before the PR:\n1. `refund()` at src/api/payments.ts:58 never awaits `ledger.write`, so a failed write goes unnoticed.\n2. No test covers a partial refund.\n3. `amt` in `capture()` reads better as `amountCents`.',
      },
    ],
  },

  idle: {
    name: 'idle',
    verb: 'Clauding',
    pastVerb: 'Worked',
    seconds: 0,
    tokens: 0,
    turns: [],
  },
}

export const HEADER = {
  product: 'Claude Code',
  version: 'v2.1.302',
  model: 'Opus 5.5 · Claude Max',
  cwd: '~/shop',
  windowTitle: 'claude — ~/shop',
} as const

/** Spinner frames (non-Ghostty): · ✢ * ✶ ✻ ✽, then the same in reverse. */
const BASE_FRAMES = ['·', '✢', '*', '✶', '✻', '✽']
export const SPINNER_FRAMES = [...BASE_FRAMES, ...[...BASE_FRAMES].reverse()]

/** "Baked for 3s" verbs, as the client picks them. */
export const PAST_VERBS = ['Baked', 'Brewed', 'Churned', 'Cogitated', 'Cooked', 'Crunched', 'Sautéed', 'Worked']

export function formatElapsed(seconds: number): string {
  const s = Math.max(0, Math.round(seconds))
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  const rest = s % 60
  return rest ? `${m}m ${rest}s` : `${m}m`
}

export function formatTokens(n: number): string {
  if (n < 1000) return String(Math.round(n))
  return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k`
}
