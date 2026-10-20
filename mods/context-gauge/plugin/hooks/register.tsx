import { atom, read, update } from 'claude-code'
import type { Register, SessionContextUsage } from 'claude-code'

import type { Reading } from '../types'

const reading = atom({ plugin: 'context-gauge', key: 'reading' } as const, null)

const CELLS = 6
const GAP = '  '

/** 124000 → "124k", 1000000 → "1M". */
function short(n: number): string {
  if (n >= 999_500) return `${+(n / 1_000_000).toFixed(1)}M`
  if (n >= 1000) return `${Math.round(n / 1000)}k`
  return String(n)
}

function gauge({ tokens, window }: Reading): { text: string; percent: number } {
  const percent = Math.round((tokens / window) * 100)
  const filled = Math.min(CELLS, Math.round((percent / 100) * CELLS))
  const bar = '▰'.repeat(filled) + '▱'.repeat(CELLS - filled)

  return { text: `ctx ${bar} ${percent}% · ${short(tokens)}/${short(window)}`, percent }
}

function colorOf(percent: number): 'warning' | 'error' | undefined {
  if (percent > 85) return 'error'

  return percent >= 60 ? 'warning' : undefined
}

/** `tokens` is absent until the live window's first response (a fresh or just compacted session). */
function readingOf({ tokens, window }: SessionContextUsage, fallbackWindow: number): Reading | null {
  return tokens === undefined ? null : { tokens, window: window > 0 ? window : fallbackWindow }
}

export const register: Register = (on, options) => {
  const fallbackWindow =
    typeof options.windowTokens === 'number' && options.windowTokens > 0 ? options.windowTokens : 200_000

  // Also raised on an enable or a reload mid-session: the gauge shows at once.
  on('session.start', async ($, e, next) => {
    const started = await next(e)
    const { context } = await $.session.usage()
    await update($, reading, () => readingOf(context, fallbackWindow))

    return started
  })

  // The status line's figures, pushed after each main-thread turn.
  on('session.measure', async ($, e, next) => {
    if (e.changed.includes('context')) await update($, reading, () => readingOf(e.context, fallbackWindow))

    return next(e)
  })

  // A main-thread compaction that went through makes the last reading stale until the next turn.
  // An observer: whatever fails here, the compaction goes on.
  on('session.compact', async ($, e, next) => {
    const done = await next(e)
    if (done.skip === undefined && e.trigger !== 'precompute' && e.agentId === undefined) {
      await update($, reading, () => null)
    }

    return done
  }).catch(($, e, next) => next(e))

  // Only a /clear or a resume goes on in this process, and no session.start follows them.
  // On an exit the write would only spend the chain's one short budget.
  on('session.end', async ($, e, next) => {
    if (e.reason === 'clear' || e.reason === 'resume') await update($, reading, () => null)

    return next(e)
  })

  on('ui.render', { component: 'PromptHint' }, async ($, e, next) => {
    const now = await read($, reading)
    if (now === null) return next(e)

    const { text, percent } = gauge(now)
    const color = colorOf(percent)

    // The terminal draws `tail` after its own line and keeps its pills live, but only dim:
    // a color, and the desktop (which draws no tail), take a tree of our own.
    if (e.surface === 'terminal' && color === undefined) {
      return next({ ...e, props: { ...e.props, tail: `${e.props.tail ?? ''}${GAP}${text}` } })
    }

    const { Box, Text } = $.ui.resolve(e)
    const line = [e.props.hint, e.props.tail?.trim()].filter(Boolean).join(GAP)

    return (
      <Box flexDirection="row" columnGap={2}>
        {line !== '' && (
          <Text dimColor wrap="truncate-end">
            {line}
          </Text>
        )}
        <Box flexShrink={0}>
          <Text color={color} dimColor={color === undefined}>
            {text}
          </Text>
        </Box>
      </Box>
    )
  })
}
