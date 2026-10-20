import { expect, test } from 'claude-code/testing'
import type { On, SessionContextUsage, SessionMeasureInput, SessionMessage } from 'claude-code'

const PLUGIN = 'context-gauge'
const SURFACES = ['terminal', 'desktop'] as const
const HINT = { isDraft: false, isWorking: false, hint: '? for shortcuts' }
const SUMMARY: SessionMessage[] = [{ role: 'user', text: 'Summary of the conversation so far.', toolUses: [] }]

function measure(tokens: number | undefined, window = 200_000): SessionMeasureInput {
  return { context: { tokens, window }, rateLimits: [], changed: ['context'] }
}

/** The engine beneath the plugin: its own hint line draws `hint` then `tail`; `veto` blocks compactions. */
function world(on: On, context: SessionContextUsage = { window: 200_000 }, veto?: string) {
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('session.usage', () => ({ value: { startedAt: 0, context, rateLimits: [] } }))
  on('session.measure', ($, e) => ({ changed: e.changed }))
  on('session.compact', ($, e) => (veto === undefined ? { messages: e.messages } : { skip: veto }))
  on('session.end', ($, e) => ({ sessionId: e.sessionId }))
  on('ui.render', { component: 'PromptHint' }, ($, e) => {
    const { Text } = $.ui.resolve(e)

    return (
      <Text dimColor>
        {e.props.hint}
        {e.props.tail ?? ''}
      </Text>
    )
  })
}

for (const surface of SURFACES) {
  test(`before a reading the hint line is the engine's own on ${surface}`, async ($, on) => {
    world(on)
    const ui = await $.ui.mount({ plugin: PLUGIN, surface, component: 'PromptHint', props: HINT })

    expect(await ui.find({ text: /ctx/ })).toBeUndefined()
    expect((await ui.find({ type: 'Text' }))?.text).toBe('? for shortcuts')
  })

  test(`under 60% the gauge is dim after the engine's hint on ${surface}`, async ($, on) => {
    world(on)
    await $.session.measure(measure(84_000))
    const ui = await $.ui.mount({ plugin: PLUGIN, surface, component: 'PromptHint', props: HINT })

    const gauge = await ui.find({ type: 'Text', text: 'ctx ▰▰▰▱▱▱ 42% · 84k/200k' })
    if (surface === 'terminal') {
      // Appended as the engine line's tail, so its pills stay live (and the engine draws it dim).
      expect(gauge?.text).toBe('? for shortcuts  ctx ▰▰▰▱▱▱ 42% · 84k/200k')
    } else {
      expect(gauge?.props.dimColor).toBe(true)
      expect(gauge?.props.color).toBeUndefined()
      expect(await ui.find({ type: 'Text', text: '? for shortcuts' })).toBeDefined()
    }
  })

  test(`another plugin's tail stays on the line, dim or in color, on ${surface}`, async ($, on) => {
    world(on)
    for (const [tokens, text] of [
      [84_000, 'ctx ▰▰▰▱▱▱ 42% · 84k/200k'],
      [124_000, 'ctx ▰▰▰▰▱▱ 62% · 124k/200k'],
    ] as const) {
      await $.session.measure(measure(tokens))
      const ui = await $.ui.mount({ plugin: PLUGIN, surface, component: 'PromptHint', props: { ...HINT, tail: ' · other' } })

      expect(await ui.find({ type: 'Text', text: /other/ })).toBeDefined()
      expect(await ui.find({ type: 'Text', text: new RegExp(text) })).toBeDefined()
      await ui.unmount()
    }
  })

  test(`from 60% the gauge is the warning color, past 85% the error color, on ${surface}`, async ($, on) => {
    world(on)
    const cases = [
      [120_000, 'ctx ▰▰▰▰▱▱ 60% · 120k/200k', 'warning'],
      [124_000, 'ctx ▰▰▰▰▱▱ 62% · 124k/200k', 'warning'],
      [170_000, 'ctx ▰▰▰▰▰▱ 85% · 170k/200k', 'warning'],
      [180_000, 'ctx ▰▰▰▰▰▱ 90% · 180k/200k', 'error'],
      [212_000, 'ctx ▰▰▰▰▰▰ 106% · 212k/200k', 'error'],
    ] as const

    for (const [tokens, text, color] of cases) {
      await $.session.measure(measure(tokens))
      const ui = await $.ui.mount({ plugin: PLUGIN, surface, component: 'PromptHint', props: HINT })

      expect((await ui.find({ type: 'Text', text }))?.props.color).toBe(color)
      expect((await ui.find({ type: 'Text', text: '? for shortcuts' }))?.props.dimColor).toBe(true)
      await ui.unmount()
    }
  })

  test(`the gauge follows each turn's measurement on ${surface}`, async ($, on) => {
    world(on)
    await $.session.measure(measure(84_000))
    const ui = await $.ui.mount({ plugin: PLUGIN, surface, component: 'PromptHint', props: HINT })

    await $.session.measure(measure(124_000))
    expect((await ui.find({ type: 'Text', text: /62% · 124k\/200k/ }))?.props.color).toBe('warning')

    // A measurement where only the rate limits moved leaves the gauge alone.
    await $.session.measure({ ...measure(10_000), changed: ['rateLimits'] })
    expect(await ui.find({ text: /62% · 124k\/200k/ })).toBeDefined()
  })

  test(`a compaction or a /clear empties the gauge until the next turn on ${surface}`, async ($, on) => {
    world(on)
    await $.session.measure(measure(180_000))
    const ui = await $.ui.mount({ plugin: PLUGIN, surface, component: 'PromptHint', props: HINT })

    await $.session.compact({ trigger: 'precompute', messages: SUMMARY })
    expect(await ui.find({ text: /90%/ })).toBeDefined()

    // A subagent's compaction leaves the main window as it was.
    await $.session.compact({ trigger: 'auto', agentId: 'a1', messages: SUMMARY })
    expect(await ui.find({ text: /90%/ })).toBeDefined()

    await $.session.compact({ trigger: 'manual', messages: SUMMARY })
    expect(await ui.find({ text: /ctx/ })).toBeUndefined()

    await $.session.measure(measure(30_000))
    expect(await ui.find({ text: /ctx ▰▱▱▱▱▱ 15% · 30k\/200k/ })).toBeDefined()

    await $.session.end({ reason: 'clear', sessionId: 's1', resume: { id: 's1' } })
    expect(await ui.find({ text: /ctx/ })).toBeUndefined()
  })

  test(`a vetoed compaction keeps the gauge on ${surface}`, async ($, on) => {
    world(on, undefined, 'blocked')
    await $.session.measure(measure(180_000))
    const ui = await $.ui.mount({ plugin: PLUGIN, surface, component: 'PromptHint', props: HINT })

    await $.session.compact({ trigger: 'manual', messages: SUMMARY })
    expect(await ui.find({ text: /90%/ })).toBeDefined()
  })

  test(`an exit leaves the gauge alone and a resume empties it on ${surface}`, async ($, on) => {
    world(on)
    await $.session.measure(measure(84_000))
    const ui = await $.ui.mount({ plugin: PLUGIN, surface, component: 'PromptHint', props: HINT })

    // An exit leaves it be: the process is going, and the end chain's budget is short.
    for (const reason of ['prompt_input_exit', 'logout', 'other'] as const) {
      await $.session.end({ reason, sessionId: 's1', resume: { id: 's1' } })
      expect(await ui.find({ text: /42%/ })).toBeDefined()
    }

    await $.session.end({ reason: 'resume', sessionId: 's1', resume: { id: 's1' } })
    expect(await ui.find({ text: /ctx/ })).toBeUndefined()
  })

  test(`a session that starts with a reading shows it at once on ${surface}`, async ($, on) => {
    world(on, { tokens: 397_000, window: 1_000_000, percent: 40 })
    await $.session.start({ cwd: '/work', surface, isInteractive: true })
    const ui = await $.ui.mount({ plugin: PLUGIN, surface, component: 'PromptHint', props: HINT })

    expect(await ui.find({ text: /ctx ▰▰▱▱▱▱ 40% · 397k\/1M/ })).toBeDefined()
  })

  test(
    `with no window reported the windowTokens option stands in on ${surface}`,
    { options: { windowTokens: 100_000 } },
    async ($, on) => {
      world(on)
      await $.session.measure(measure(50_000, 0))
      const ui = await $.ui.mount({ plugin: PLUGIN, surface, component: 'PromptHint', props: HINT })

      expect(await ui.find({ text: /ctx ▰▰▰▱▱▱ 50% · 50k\/100k/ })).toBeDefined()
    },
  )
}
