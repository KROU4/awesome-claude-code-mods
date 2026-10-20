import type { EngineInterface, Register, TurnCompleteReason } from 'claude-code'

const TITLE = 'Claude Code'
const SAMPLE = { ms: 100_000, tools: 12, reason: 'answer' } as const

// 45s, 1m 40s, 2m, 1h 5m
function duration(ms: number): string {
  const total = Math.round(ms / 1000)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60

  if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`
  if (m > 0) return s > 0 ? `${m}m ${s}s` : `${m}m`
  return `${s}s`
}

function summary(ms: number, tools: number, reason: TurnCompleteReason): string {
  const calls = `${tools} tool call${tools === 1 ? '' : 's'}`
  const head = reason === 'error' ? 'Claude stopped on an error after' : 'Claude finished in'

  return `${head} ${duration(ms)} · ${calls}`
}

// Notifies natively; anything short of a sent notification becomes a toast.
// Answers what happened, for /done-ping test.
async function ping($: EngineInterface, text: string): Promise<string> {
  let reason: string
  try {
    const sent = await $.ui.notify(text, { title: TITLE })
    if (sent.isSent) {
      return sent.channel === 'terminal_bell'
        ? 'sent via terminal_bell (a bell only, no text)'
        : `sent via ${sent.channel}`
    }
    reason = sent.reason
  } catch (error) {
    reason = error instanceof Error ? error.message : String(error)
  }
  $.ui.toast(text)

  return `not sent: ${reason}, shown as a toast instead`
}

export const register: Register = (on, options) => {
  const minSeconds = typeof options.minSeconds === 'number' ? options.minSeconds : 30
  let tools = 0

  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'done-ping',
      description: 'Send a sample turn-finished notification',
      argumentHint: 'test',
    })

    return next(e)
  })

  // Counting never guards: should a counter fail, the prompt or call goes on.
  // A prompt typed over a running turn must not zero that turn's count; if it
  // was queued, its own turn starts from the zero turn.complete leaves.
  on('prompt.submit', ($, e, next) => {
    if (e.turnId === undefined) tools = 0

    return next(e)
  }).catch(($, e, next) => next(e))

  // The main loop's calls alone: subagents, background agents and the
  // engine's own forks (compaction, memory) all run with an agentId.
  on('tool.call', ($, e, next) => {
    if (e.agentId === undefined) tools += 1

    return next(e)
  }).catch(($, e, next) => next(e))

  on('turn.complete', async ($, e, next) => {
    if (e.agentId !== undefined) return next(e)

    // Taken before the chain goes on: a call a hook beneath makes is not this turn's.
    const calls = tools
    tools = 0
    const done = await next(e)

    if (!e.isAborted && e.durationMs >= minSeconds * 1000) {
      await ping($, summary(e.durationMs, calls, e.reason))
    }

    return done
  })

  on('command.run', { command: 'done-ping' }, async ($, e) => {
    if (e.args.trim() !== 'test') {
      return {
        text: `Notifies when a turn of ${minSeconds}s or more finishes. /done-ping test sends a sample.`,
      }
    }
    const what = await ping($, summary(SAMPLE.ms, SAMPLE.tools, SAMPLE.reason))

    return { text: `Sample notification ${what}.` }
  })
}
