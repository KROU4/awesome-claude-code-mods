import { expect, test } from 'claude-code/testing'
import type { Engine, Plugin } from 'claude-code/testing'
import type { On, TurnCompleteInput, UiNotifyResult } from 'claude-code'

// The terminal sends through the person's channel; the desktop app holds no
// terminal, so notify answers no-surface there and the mod falls back to a toast.
const SURFACES = [
  { surface: 'terminal', answer: { isSent: true, channel: 'kitty' } },
  { surface: 'desktop', answer: { isSent: false, reason: 'no-surface' } },
] as const
const SENT = SURFACES[0].answer

const COMPOSER = { kind: 'composer' } as const
const LONG_TURN = 'Claude finished in 1m 40s · 12 tool calls'

// `answer` is what notify resolves to, or a hook's refusal, which rejects it.
function world(on: On, answer: UiNotifyResult | { deny: string }) {
  const notes: { title: string | undefined; text: string }[] = []
  const toasts: string[] = []

  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('command.register', ($, e) => ({ value: { command: e.name } }))
  on('prompt.submit', ($, e) => ({ text: e.text }))
  on('tool.call', () => ({ result: 'ok' }))
  on('turn.complete', ($, e) => ({ text: e.answer }))
  on('ui.notify', ($, e) => {
    notes.push({ title: e.title, text: e.text })
    return 'deny' in answer ? answer : { value: answer }
  })
  on('ui.toast', ($, e) => {
    toasts.push(e.text)
    return { value: undefined }
  })

  return { notes, toasts }
}

// With a turnId, the prompt was typed over that running turn.
function ask($: Engine, text: string, turnId?: string) {
  return $.prompt.submit({ text, wait: false, origin: COMPOSER, ...(turnId ? { turnId } : {}) })
}

function slash($: Engine, args: string) {
  return $.command.run({
    command: 'done-ping',
    args,
    origin: COMPOSER,
    presentation: { isFullscreen: true, columns: 120 },
  })
}

// With an agentId, the calls run in that subagent's loop.
async function tools($: Engine, count: number, agentId?: string) {
  for (let i = 0; i < count; i++) {
    await $.tool.call({ tool: 'Bash', command: `echo ${i}`, ...(agentId ? { agentId } : {}) })
  }
}

type End = Partial<Omit<TurnCompleteInput, 'reason' | 'refusal'>> & {
  reason?: 'answer' | 'aborted' | 'error'
}

function end($: Engine, fields: End) {
  return $.turn.complete({
    answer: 'Done.',
    durationMs: 100_000,
    isAborted: false,
    turnId: 'turn-1',
    reason: 'answer',
    ...fields,
  })
}

async function turn($: Engine, count: number, fields: End) {
  await ask($, 'refactor the parser')
  await tools($, count)
  await end($, fields)
}

for (const { surface, answer } of SURFACES) {
  test(`pings when a long turn finishes (${surface})`, async ($, on) => {
    const { notes, toasts } = world(on, answer)
    await $.session.start({ cwd: '/work', surface, isInteractive: true })

    await turn($, 12, {})

    expect(notes).toEqual([{ title: 'Claude Code', text: LONG_TURN }])
    expect(toasts).toEqual(answer.isSent ? [] : [LONG_TURN])
  })

  test(`/done-ping test says what happened (${surface})`, async ($, on) => {
    const { notes, toasts } = world(on, answer)
    await $.session.start({ cwd: '/work', surface, isInteractive: true })

    const ran = await slash($, 'test')

    expect(notes).toEqual([{ title: 'Claude Code', text: LONG_TURN }])
    if (answer.isSent) {
      expect(ran.text).toBe('Sample notification sent via kitty.')
      expect(toasts).toEqual([])
    } else {
      expect(ran.text).toBe('Sample notification not sent: no-surface, shown as a toast instead.')
      expect(toasts).toEqual([LONG_TURN])
    }
  })
}

test('a bell-only channel is reported as such', async ($, on) => {
  world(on, { isSent: true, channel: 'terminal_bell' })

  const ran = await slash($, 'test')

  expect(ran.text).toBe('Sample notification sent via terminal_bell (a bell only, no text).')
})

test('a refused notification falls back to a toast', async ($, on) => {
  const { toasts } = world(on, { deny: 'quiet hours' })

  const ran = await slash($, 'test')

  expect(ran.text).toMatch(/^Sample notification not sent: .*quiet hours.*, shown as a toast instead\.$/)
  expect(toasts).toEqual([LONG_TURN])
})

test('stays quiet for a turn shorter than minSeconds', async ($, on) => {
  const { notes, toasts } = world(on, SENT)

  await turn($, 3, { durationMs: 29_000 })

  expect(notes).toEqual([])
  expect(toasts).toEqual([])
})

test('pings for a turn of exactly minSeconds', async ($, on) => {
  const { notes } = world(on, SENT)

  await turn($, 1, { durationMs: 30_000 })

  expect(notes.map(n => n.text)).toEqual(['Claude finished in 30s · 1 tool call'])
})

test('minSeconds comes from the options', { options: { minSeconds: 5 } }, async ($, on) => {
  const { notes } = world(on, SENT)

  await turn($, 1, { durationMs: 6_000 })

  expect(notes.map(n => n.text)).toEqual(['Claude finished in 6s · 1 tool call'])
})

test('skips a turn the person interrupted', async ($, on) => {
  const { notes, toasts } = world(on, SENT)

  await turn($, 4, { durationMs: 300_000, isAborted: true, reason: 'aborted' })

  expect(notes).toEqual([])
  expect(toasts).toEqual([])
})

test('says when a turn ended on an error', async ($, on) => {
  const { notes } = world(on, SENT)

  await turn($, 2, { durationMs: 3_900_000, reason: 'error' })

  expect(notes.map(n => n.text)).toEqual(['Claude stopped on an error after 1h 5m · 2 tool calls'])
})

test('counts each turn from its own prompt, ignoring subagent ends', async ($, on) => {
  const { notes } = world(on, SENT)

  await turn($, 5, { durationMs: 45_000 })
  await ask($, 'now the tests')
  await tools($, 1)
  await end($, { turnId: 'sub-1', agentId: 'agent-1', durationMs: 200_000 })
  await ask($, 'and lint it too', 'turn-2')
  await tools($, 2)
  await end($, { turnId: 'turn-2', durationMs: 120_000 })

  expect(notes.map(n => n.text)).toEqual([
    'Claude finished in 45s · 5 tool calls',
    'Claude finished in 2m · 3 tool calls',
  ])
})

test("a prompt queued behind a turn counts from that turn's end", async ($, on) => {
  const { notes } = world(on, SENT)

  await ask($, 'refactor the parser')
  await tools($, 3)
  await ask($, 'then the docs', 'turn-1')
  await end($, { turnId: 'turn-1', durationMs: 60_000 })
  await tools($, 4)
  await end($, { turnId: 'turn-2', durationMs: 60_000 })

  expect(notes.map(n => n.text)).toEqual([
    'Claude finished in 1m · 3 tool calls',
    'Claude finished in 1m · 4 tool calls',
  ])
})

test("leaves a subagent's tool calls out of the count", async ($, on) => {
  const { notes } = world(on, SENT)

  await ask($, 'review the branch')
  await tools($, 2)
  await tools($, 5, 'agent-1')
  await end($, { durationMs: 60_000 })

  expect(notes.map(n => n.text)).toEqual(['Claude finished in 1m · 2 tool calls'])
})

// Sits beneath done-ping and runs a tool as each turn ends, as a mod that
// reviews the finished turn would.
const reviewer: Plugin = {
  name: 'reviewer',
  tier: 'append',
  register(on) {
    on('turn.complete', async ($, e, next) => {
      await $.tool.call({ tool: 'Bash', command: 'git status' })
      return next(e)
    })
  },
}

test("a call a hook beneath makes as the turn ends is not that turn's", { plugins: [reviewer] }, async ($, on) => {
  const { notes } = world(on, SENT)

  await turn($, 2, { durationMs: 60_000 })

  expect(notes.map(n => n.text)).toEqual(['Claude finished in 1m · 2 tool calls'])
})

test('/done-ping without "test" explains itself and sends nothing', async ($, on) => {
  const { notes } = world(on, SENT)

  const ran = await slash($, '')

  expect(ran.text).toBe('Notifies when a turn of 30s or more finishes. /done-ping test sends a sample.')
  expect(notes).toEqual([])
})
