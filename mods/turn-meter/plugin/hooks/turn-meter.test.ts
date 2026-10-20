import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { On, TurnUsage } from 'claude-code'

const SURFACES = ['terminal', 'desktop'] as const
const BAND = {
  component: 'AbovePrompt',
  props: {
    hasSurvey: false,
    isWorking: false,
    maxRows: 8,
    bodyColumns: 100,
    scroll: { offset: 0, bodyRows: 8 },
    view: {},
  },
} as const
const USAGE: TurnUsage = {
  input_tokens: 1200,
  cache_creation_input_tokens: 9000,
  cache_read_input_tokens: 250_000,
  output_tokens: 4000,
  model: 'claude-test',
}
const SHOW = {
  command: 'turn-meter',
  args: '',
  origin: { kind: 'composer' },
  presentation: { isFullscreen: false, columns: 100 },
} as const
const TYPED = { wait: false, origin: { kind: 'composer' } } as const

// The world beneath the plugin: a clock, and bottoms for prompts, turns, tools, toasts and the
// engine's own (empty) band, drawn whenever the plugin passes.
function world(on: On) {
  const clock = mock.clock(on)
  const toasts: string[] = []
  on('prompt.submit', ($, e) => ({ text: e.text }))
  on('turn.start', ($, e) => ({ turnId: e.turnId }))
  on('tool.call', () => ({ result: { ok: true } }))
  on('turn.complete', ($, e) => ({ text: e.answer }))
  on('ui.toast', ($, e) => {
    toasts.push(e.text)

    return { value: undefined }
  })
  on('ui.render', ($, e) => $.ui.resolve(e).Box({}))

  return { clock, toasts }
}

function complete(
  $: Engine,
  { durationMs = 1, isAborted = false, usage }: { durationMs?: number; isAborted?: boolean; usage?: TurnUsage } = {},
) {
  return $.turn.complete({
    answer: 'done',
    durationMs,
    isAborted,
    turnId: 't',
    reason: isAborted ? 'aborted' : 'answer',
    usage,
  })
}

async function turn(
  $: Engine,
  clock: ReturnType<typeof mock.clock>,
  { ms, tools = 0, usage, isAborted }: { ms: number; tools?: number; usage?: TurnUsage; isAborted?: boolean },
) {
  await $.prompt.submit({ text: 'go', ...TYPED })
  await $.turn.start({ text: 'go', turnId: 't' })
  for (let i = 0; i < tools; i++) await $.tool.call({ tool: 'mcp__fake__noop' })
  await clock.advance(ms)
  await complete($, { usage, isAborted })
}

// The band's "Last turn" line on each surface (undefined where nothing is drawn).
async function lines($: Engine) {
  const found: (string | undefined)[] = []
  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ plugin: 'turn-meter', surface, ...BAND })
    found.push((await ui.find({ type: 'Text', text: 'Last turn' }))?.text)
    await ui.unmount()
  }

  return found
}

// A Raster's cells back as its glyphs and foreground colors.
function unpack(cells: unknown) {
  const bytes = Uint8Array.from(atob(String(cells)), c => c.charCodeAt(0))
  const words = [...new Uint32Array(bytes.buffer)]

  return {
    glyphs: String.fromCharCode(...words.filter((_, i) => i % 3 === 0)),
    colors: words.filter((_, i) => i % 3 === 1),
  }
}

test('the band shows the last turn, a sparkline and hides on h', async ($, on) => {
  const { clock } = world(on)
  await turn($, clock, { ms: 30_000, tools: 2 })
  await turn($, clock, { ms: 72_000, tools: 9, usage: USAGE })

  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ plugin: 'turn-meter', surface, ...BAND })
    expect((await ui.find({ type: 'Text', text: 'Last turn' }))?.text).toBe(
      'Last turn 1m 12s · 9 tools · 14.2k tokens',
    )
    expect((await ui.find({ key: 'hide' }))?.props).toMatchObject({ label: 'Hide', hotkey: 'h' })

    if (surface === 'terminal') {
      const raster = await ui.find({ type: 'Raster', key: 'spark' })
      expect(raster?.props).toMatchObject({ columns: 2, rows: 1 })
      expect(unpack(raster?.props.cells).glyphs).toBe('▄█')
    } else {
      expect(await ui.find({ type: 'Raster' })).toBeUndefined()
      expect(await ui.find({ type: 'Text', text: '▄█' })).toBeDefined()
    }

    await ui.press({ key: 'hide' })
    expect(await ui.find({ type: 'Text', text: 'Last turn' })).toBeUndefined()

    const shown = await $.command.run(SHOW)
    expect(shown.text).toBe('Turn meter shown above the prompt.')
    expect(await ui.find({ type: 'Text', text: 'Last turn' })).toBeDefined()
    await ui.unmount()
  }
})

test('/turn-meter runs mid-turn and only ever shows the band', async ($, on) => {
  const { clock } = world(on)
  const specs: { name: string; immediate?: true }[] = []
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('command.register', ($, e) => {
    specs.push({ name: e.name, immediate: e.immediate })

    return { value: { command: e.name } }
  })
  await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
  expect(specs).toEqual([{ name: 'turn-meter', immediate: true }])

  // Run before any turn, while the band is still empty, it must not hide the first turn's band.
  expect((await $.command.run(SHOW)).text).toBe('Turn meter shown above the prompt.')
  await turn($, clock, { ms: 5_000 })
  expect(await lines($)).toEqual(['Last turn 5s · 0 tools', 'Last turn 5s · 0 tools'])

  expect((await $.command.run(SHOW)).text).toBe('Turn meter shown above the prompt.')
  expect(await lines($)).toEqual(['Last turn 5s · 0 tools', 'Last turn 5s · 0 tools'])
})

test('nothing is drawn before a turn or while a survey holds the band', async ($, on) => {
  const { clock } = world(on)
  expect(await lines($)).toEqual([undefined, undefined])

  await turn($, clock, { ms: 3_000, tools: 1 })
  for (const surface of SURFACES) {
    const survey = { ...BAND, props: { ...BAND.props, hasSurvey: true } }
    const ui = await $.ui.mount({ plugin: 'turn-meter', surface, ...survey })
    expect(await ui.find({ type: 'Text', text: 'Last turn' })).toBeUndefined()
    await ui.unmount()
  }
})

test('a prompt typed over a running turn joins it; with no prompt seen the engine duration stands', async ($, on) => {
  const { clock } = world(on)
  await $.prompt.submit({ text: 'go', ...TYPED })
  await clock.advance(30_000)
  await $.prompt.submit({ text: 'and this too', ...TYPED, turnId: 't1' })
  await clock.advance(30_000)
  await complete($)
  expect(await lines($)).toEqual(['Last turn 1m · 0 tools', 'Last turn 1m · 0 tools'])

  await complete($, { durationMs: 7_000 })
  expect(await lines($)).toEqual(['Last turn 7s · 0 tools', 'Last turn 7s · 0 tools'])
})

test("another plugin's prompt mid-turn keeps the clock; subagents' runs and calls are not counted", async ($, on) => {
  const { clock } = world(on)
  // A background subagent starting while the main loop is idle does not make it busy.
  await $.turn.start({ text: '', turnId: 'bg', agentId: 'agent-1' })

  await $.prompt.submit({ text: 'go', ...TYPED })
  await $.turn.start({ text: 'go', turnId: 't' })
  await $.tool.call({ tool: 'mcp__fake__noop' })
  await $.tool.call({ tool: 'mcp__fake__noop', agentId: 'agent-1' })
  await clock.advance(90_000)
  await $.prompt.submit({ text: 'from a plugin', wait: false, origin: { kind: 'plugin', name: 'other' } })
  await clock.advance(10_000)
  await complete($)
  expect(await lines($)).toEqual(['Last turn 1m 40s · 1 tool', 'Last turn 1m 40s · 1 tool'])
})

test('a turn over the default 120 s threshold raises a toast, unless it was aborted', async ($, on) => {
  const { clock, toasts } = world(on)
  await turn($, clock, { ms: 100_000, tools: 3 })
  expect(toasts).toEqual([])

  await turn($, clock, { ms: 185_000, tools: 31, usage: USAGE })
  expect(toasts).toEqual(['Slow turn: 3m 5s · 31 tools · 14.2k tokens (over 2m)'])

  await turn($, clock, { ms: 200_000, isAborted: true })
  expect(toasts).toHaveLength(1)
})

test('slowTurnSeconds sets the threshold', { options: { slowTurnSeconds: 60 } }, async ($, on) => {
  const { clock, toasts } = world(on)
  await turn($, clock, { ms: 72_000, tools: 1 })
  expect(toasts).toEqual(['Slow turn: 1m 12s · 1 tool (over 1m)'])
})

test('slowTurnSeconds 0 turns the toast off', { options: { slowTurnSeconds: 0 } }, async ($, on) => {
  const { clock, toasts } = world(on)
  await turn($, clock, { ms: 999_000 })
  expect(toasts).toEqual([])
})

test('token counts switch from k to M without a "1000k"', async ($, on) => {
  const { clock } = world(on)
  for (const [tokens, shown] of [
    [999_499, '999k'],
    [999_600, '1M'],
  ] as const) {
    const usage = { ...USAGE, input_tokens: tokens, cache_creation_input_tokens: 0, output_tokens: 0 }
    await turn($, clock, { ms: 5_000, usage })
    const line = `Last turn 5s · 0 tools · ${shown} tokens`
    expect(await lines($)).toEqual([line, line])
  }
})

test('the README and catalog preview scene draws as shown', async ($, on) => {
  const { clock, toasts } = world(on)
  const seconds = [22, 41, 35, 58, 12, 47, 96, 30, 72, 64, 40]
  for (const s of seconds) await turn($, clock, { ms: s * 1000, tools: 4 })
  const usage = { ...USAGE, input_tokens: 2400, cache_creation_input_tokens: 61_000, output_tokens: 25_000 }
  await turn($, clock, { ms: 185_000, tools: 31, usage })
  expect(toasts).toEqual(['Slow turn: 3m 5s · 31 tools · 88.4k tokens (over 2m)'])

  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ plugin: 'turn-meter', surface, ...BAND })
    expect((await ui.find({ type: 'Text', text: 'Last turn' }))?.text).toBe(
      'Last turn 3m 5s · 31 tools · 88.4k tokens',
    )
    if (surface === 'terminal') {
      const { glyphs, colors } = unpack((await ui.find({ type: 'Raster', key: 'spark' }))?.props.cells)
      expect(glyphs).toBe('▁▂▂▃▁▃▅▂▄▃▂█')
      expect(colors).toEqual([...Array(11).fill(0x5f9ea0), 0xe0783f])
    } else {
      expect((await ui.find({ type: 'Text', text: /^[▁▂▃▄▅▆▇█]+$/ }))?.text).toBe('▁▂▂▃▁▃▅▂▄▃▂█')
      const bars = await ui.findAll({ type: 'Text', text: /^[▁▂▃▄▅▆▇█]$/ })
      expect(bars.map(bar => bar.props.color)).toEqual([...Array(11).fill('suggestion'), 'warning'])
    }
    await ui.unmount()
  }
})

test('the sparkline keeps the last 12 turns and skips subagent turns', async ($, on) => {
  const { clock } = world(on)
  for (let i = 1; i <= 14; i++) await turn($, clock, { ms: i * 1000 })
  await $.turn.complete({
    answer: 'sub',
    durationMs: 999_000,
    isAborted: false,
    turnId: 'sub',
    reason: 'answer',
    agentId: 'agent-1',
  })

  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ plugin: 'turn-meter', surface, ...BAND })
    expect((await ui.find({ type: 'Text', text: 'Last turn' }))?.text).toBe('Last turn 14s · 0 tools')
    if (surface === 'terminal') {
      expect((await ui.find({ type: 'Raster' }))?.props.columns).toBe(12)
    } else {
      const bars = await ui.find({ type: 'Text', text: /^[▁▂▃▄▅▆▇█]+$/ })
      expect(bars?.text).toHaveLength(12)
    }
    await ui.unmount()
  }
})
