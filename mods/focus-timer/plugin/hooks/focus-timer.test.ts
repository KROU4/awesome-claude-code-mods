import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { On } from 'claude-code'

const DONE = 'Focus session done. Take a 5 minute break.'
const USAGE = 'Usage: /focus-timer [minutes 1-180] | pause | stop'

const BAND = {
  plugin: 'focus-timer',
  component: 'AbovePrompt',
  props: {
    hasSurvey: false,
    isWorking: false,
    maxRows: 8,
    bodyColumns: 100,
    scroll: { offset: 0, bodyRows: 7 },
    view: {},
  },
} as const

const focus = async ($: Engine, args: string) =>
  (
    await $.command.run({
      command: 'focus-timer',
      args,
      origin: { kind: 'composer' },
      presentation: { isFullscreen: true, columns: 120 },
    })
  ).text

const ENGINE_BAND = 'the engine band'

// The world beneath the plugin: a clock in memory, the engine's own band, and
// the toasts and notifications the plugin raised.
function world(on: On) {
  const clock = mock.clock(on, { now: 1_760_000_000_000 })
  const toasts: string[] = []
  const notes: { text: string; title?: string }[] = []
  on('ui.render', { component: 'AbovePrompt' }, ($, e) =>
    $.ui.resolve(e).Text({ children: ENGINE_BAND }),
  )
  on('ui.toast', ($, e) => {
    toasts.push(e.text)

    return { value: undefined }
  })
  on('ui.notify', ($, e) => {
    notes.push({ text: e.text, title: e.title })

    return { value: { isSent: true, channel: 'kitty' } }
  })

  return { clock, toasts, notes }
}

for (const surface of ['terminal', 'desktop'] as const) {
  test(`counts down, pauses and stops on ${surface}`, { timeoutMs: 20_000 }, async ($, on) => {
    const { clock } = world(on)
    expect(await focus($, '25')).toBe('Focus timer started: 25:00.')

    const ui = await $.ui.mount({ ...BAND, surface })
    // Digits of one width, so the ticking time does not shift the buttons.
    expect((await ui.find({ type: 'Text', text: '◷ Focus · 25:00 left' }))?.props.tabular).toBe(true)
    expect((await ui.find({ key: 'pause' }))?.props.hotkey).toBe('p')
    expect((await ui.find({ key: 'stop' }))?.props.hotkey).toBe('s')

    await clock.advance(378_000)
    expect(await ui.find({ type: 'Text', text: '◷ Focus · 18:42 left' })).toBeDefined()
    const progress = surface === 'terminal' ? '▰'.repeat(5) + '▱'.repeat(15) : '25%'
    expect(await ui.find({ type: 'Text', text: progress })).toBeDefined()

    await ui.press({ key: 'pause' })
    expect(await ui.find({ type: 'Text', text: '◷ Focus · paused · 18:42 left' })).toBeDefined()
    expect((await ui.find({ key: 'pause' }))?.text).toBe('Resume')

    await clock.advance(60_000)
    expect(await ui.find({ type: 'Text', text: '◷ Focus · paused · 18:42 left' })).toBeDefined()

    await ui.press({ key: 'pause' })
    await clock.advance(2_000)
    expect(await ui.find({ type: 'Text', text: '◷ Focus · 18:40 left' })).toBeDefined()
    expect((await ui.find({ key: 'pause' }))?.text).toBe('Pause')

    await ui.press({ key: 'stop' })
    expect((await ui.find({ type: 'Text' }))?.text).toBe(ENGINE_BAND)
  })

  test(`notifies when the session ends and shows the done line on ${surface}`, async ($, on) => {
    const { clock, toasts, notes } = world(on)
    await focus($, '1')
    const ui = await $.ui.mount({ ...BAND, surface })

    await clock.advance(59_000)
    expect(await ui.find({ type: 'Text', text: '◷ Focus · 00:01 left' })).toBeDefined()
    expect(notes).toEqual([])

    await clock.advance(1_000)
    expect(notes).toEqual([{ text: DONE, title: 'Focus timer' }])
    expect(toasts).toEqual([DONE])
    expect(await ui.find({ type: 'Text', text: '✓ Focus done · 01:00' })).toBeDefined()
    expect((await ui.find({ key: 'dismiss' }))?.props.hotkey).toBe('d')

    await clock.advance(5_000)
    expect(notes).toHaveLength(1)

    await ui.press({ key: 'dismiss' })
    expect((await ui.find({ type: 'Text' }))?.text).toBe(ENGINE_BAND)
  })
}

test('the next prompt clears the done line', async ($, on) => {
  const { clock } = world(on)
  on('prompt.submit', ($, e) => ({ text: e.text }))
  await focus($, '1')
  await clock.advance(60_000)

  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: '✓ Focus done · 01:00' })).toBeDefined()

  await $.prompt.submit({ text: 'next task', wait: false, origin: { kind: 'composer' } })
  expect((await ui.find({ type: 'Text' }))?.text).toBe(ENGINE_BAND)
})

test('the band yields to a survey and draws nothing with no session', async ($, on) => {
  world(on)
  const idle = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect((await idle.find({ type: 'Text' }))?.text).toBe(ENGINE_BAND)

  await focus($, '25')
  const survey = await $.ui.mount({
    ...BAND,
    surface: 'desktop',
    props: { ...BAND.props, hasSurvey: true },
  })
  expect((await survey.find({ type: 'Text' }))?.text).toBe(ENGINE_BAND)
  await focus($, 'stop')
})

test('/focus-timer reads minutes, pause and stop', { options: { defaultMinutes: 50 } }, async ($, on) => {
  world(on)
  expect(await focus($, '')).toBe('Focus timer started: 50:00.')
  expect(await focus($, '0')).toBe(USAGE)
  expect(await focus($, '181')).toBe(USAGE)
  expect(await focus($, 'soon')).toBe(USAGE)
  expect(await focus($, '90')).toBe('Focus timer started: 1:30:00.')
  expect(await focus($, 'pause')).toBe('Focus timer paused: 1:30:00 left.')
  expect(await focus($, 'pause')).toBe('Focus timer resumed: 1:30:00 left.')
  expect(await focus($, 'stop')).toBe('Focus timer stopped.')
  expect(await focus($, 'stop')).toBe('No focus timer is running.')
  expect(await focus($, 'pause')).toBe('No focus timer is running.')
})

test('registers /focus-timer when the session starts', async ($, on) => {
  const names: string[] = []
  on('command.register', ($, e) => {
    names.push(e.name)

    return { value: { command: e.name } }
  })
  on('session.start', ($, e) => ({ cwd: e.cwd }))

  await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
  expect(names).toEqual(['focus-timer'])
})

// A reload keeps the state but drops the ticker, and session.start fires again.
// Here the ticker is dropped by refusing its periods, which ends an interval.
test('a session start picks a running countdown up again', async ($, on) => {
  let isDropped = true
  on('clock.every', { ms: 1000 }, ($, e, next) => (isDropped ? { deny: 'reloaded' } : next(e)))
  const { clock, toasts, notes } = world(on)
  on('command.register', ($, e) => ({ value: { command: e.name } }))
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  await focus($, '1')
  await clock.advance(60_000)
  expect(notes).toEqual([])

  isDropped = false
  await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
  await clock.advance(1_000)
  expect(notes).toEqual([{ text: DONE, title: 'Focus timer' }])
  expect(toasts).toEqual([DONE])
})
