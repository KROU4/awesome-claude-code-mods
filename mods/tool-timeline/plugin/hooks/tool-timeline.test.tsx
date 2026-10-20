import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { On, ToolCallArgs, ToolCallResult } from 'claude-code'

const SURFACES = ['terminal', 'desktop'] as const
const DOCKED = { columns: 160, rows: 40, isFullscreen: true }
const INLINE = { columns: 100, rows: 40, isFullscreen: false }
const RUN = {
  command: 'timeline',
  args: '',
  origin: { kind: 'composer' },
  presentation: { isFullscreen: false, columns: 100 },
} as const

function pane(bodyRows: number, bodyColumns = 60) {
  return {
    plugin: 'tool-timeline',
    component: 'Pane',
    requestId: 'timeline',
    props: {
      title: 'Timeline',
      isFocused: false,
      bodyColumns,
      placement: 'dock',
      scroll: { offset: 0, bodyRows },
      view: {},
    },
    viewport: DOCKED,
  } as const
}

function band(viewport: typeof DOCKED | typeof INLINE) {
  return {
    plugin: 'tool-timeline',
    component: 'AbovePrompt',
    props: {
      hasSurvey: false,
      isWorking: false,
      maxRows: 8,
      bodyColumns: 100,
      scroll: { offset: 0, bodyRows: 8 },
      view: {},
    },
    viewport,
  } as const
}

// How a call ends beneath the plugin, by what it was about: after how long, with what answer.
const SCRIPT: Record<string, { ms: number; answer: ToolCallResult }> = {
  '/repo/src/app.ts': { ms: 120, answer: { result: 'ok' } },
  'TODO|FIXME': { ms: 340, answer: { result: 'ok' } },
  'npm test': { ms: 12_400, answer: { isError: true, result: 'Exit code 1', text: 'Exit code 1' } },
  '/repo/.env': { ms: 0, answer: { deny: 'Writes to .env are blocked here.' } },
  '/repo/src/db.ts': {
    ms: 900,
    answer: { isError: true, result: undefined, text: "The user doesn't want to proceed with this tool use." },
  },
  'npm run build --watch': { ms: 60_000, answer: { result: 'built' } },
  'sleep 10': { ms: 10_000, answer: { result: '' } },
  '/repo/a.ts': { ms: 500, answer: { result: 'a' } },
  '/repo/b.ts': { ms: 200, answer: { result: 'b' } },
  'acme/api': {
    ms: 0,
    answer: { isError: true, result: undefined, text: 'Error: access to this repository has been denied by the server (403)' },
  },
  'rm -rf build': {
    ms: 0,
    answer: { isError: true, result: undefined, text: 'Permission to use Bash with command rm -rf build has been denied.' },
  },
  // The catalog preview's shop project.
  '/repo/src/checkout.ts': { ms: 100, answer: { result: 'ok' } },
  applyDiscount: { ms: 200, answer: { result: 'ok' } },
  '/repo/src/cart/total.ts': { ms: 100, answer: { result: 'ok' } },
  '/repo/src/cart/total.test.ts': { ms: 100, answer: { result: 'ok' } },
}

const NARROW = 'opened unasked under 144 columns (100 now)'

// The world beneath the plugin: a clock, the session's directory, panes, and tools that answer by SCRIPT.
function world(on: On, { isPlaced = true } = {}) {
  const clock = mock.clock(on)
  const opened: string[] = []
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('command.register', ($, e) => ({ value: { command: e.name } }))
  on('session.cwd', () => ({ value: '/repo' }))
  on('ui.open', ($, e) => {
    opened.push(e.id)

    return { value: isPlaced ? { isPlaced: true } : { isPlaced: false, reason: NARROW } }
  })
  on('ui.render', { component: 'AbovePrompt' }, ($, e) => {
    const { Text } = $.ui.resolve(e)

    return <Text>band</Text>
  })
  on('tool.call', async ($, e) => {
    const subject = ['file_path', 'command', 'pattern', 'query']
      .map(key => Reflect.get(e, key))
      .find(v => typeof v === 'string')
    const step = SCRIPT[String(subject).replace(/\s+/g, ' ')] ?? { ms: 0, answer: { result: 'ok' } }
    if (step.ms > 0) await clock.sleep(step.ms)

    return step.answer
  })

  // Runs a call whose tool takes `ms` on the clock.
  async function call($: Engine, input: ToolCallArgs, ms: number) {
    const ran = $.tool.call(input)
    await clock.settle()
    await clock.advance(ms)
    await ran
  }

  return { clock, opened, call }
}

async function rows(ui: { findAll: (q: { type: string }) => Promise<{ text: string }[]> }) {
  return (await ui.findAll({ type: 'Text' })).map(text => text.text)
}

test('lists each call with its status, tool, subject and duration', async ($, on) => {
  const { clock, call } = world(on)
  await call($, { tool: 'Read', file_path: '/repo/src/app.ts' }, 120)
  await call($, { tool: 'mcp__fake__search', pattern: 'TODO|FIXME' }, 340)
  await call($, { tool: 'Bash', command: 'npm test' }, 12_400)
  await call($, { tool: 'Write', file_path: '/repo/.env', content: 'KEY=1' }, 0)
  await call($, { tool: 'Edit', file_path: '/repo/src/db.ts', old_string: 'a', new_string: 'b' }, 900)
  const building = $.tool.call({ tool: 'Bash', command: 'npm run build\n  --watch' })
  await clock.settle()
  await clock.advance(3_000)

  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ ...pane(20), surface })
    expect(await rows(ui)).toEqual([
      ...['✓', 'Read', 'src/app.ts', '0.1s'],
      ...['✓', 'fake:search', 'TODO|FIXME', '0.3s'],
      ...['✗', 'Bash', 'npm test', '12.4s'],
      ...['⊘', 'Write', '.env', '0.0s'],
      ...['⊘', 'Edit', 'src/db.ts', '0.9s'],
      ...['◐', 'Bash', 'npm run build --watch', '3.0s'],
    ])
    expect((await ui.find({ type: 'Text', text: '◐' }))?.props.color).toBe('warning')
    expect((await ui.find({ type: 'Text', text: '✓' }))?.props.color).toBe('success')
    expect((await ui.find({ type: 'Text', text: '✗' }))?.props.color).toBe('error')
    expect((await ui.find({ type: 'Text', text: '⊘' }))?.props.color).toBe('error')
    await ui.unmount()
  }

  await clock.advance(57_000)
  await building
  const ui = await $.ui.mount({ ...pane(20), surface: 'terminal' })
  expect((await rows(ui)).slice(-4)).toEqual(['✓', 'Bash', 'npm run build --watch', '1m00s'])
})

test('the catalog preview scene draws as shown', async ($, on) => {
  const { clock, call } = world(on)
  await call($, { tool: 'Read', file_path: '/repo/src/checkout.ts' }, 100)
  await call($, { tool: 'Grep', pattern: 'applyDiscount' }, 200)
  await call($, { tool: 'Edit', file_path: '/repo/src/cart/total.ts', old_string: 'a', new_string: 'b' }, 100)
  await call($, { tool: 'Read', file_path: '/repo/.env' }, 0)
  await call($, { tool: 'Write', file_path: '/repo/src/cart/total.test.ts', content: 'test' }, 100)
  await call($, { tool: 'Bash', command: 'npm test' }, 12_400)
  await call($, { tool: 'Edit', file_path: '/repo/src/cart/total.ts', old_string: 'b', new_string: 'c' }, 100)
  const testing = $.tool.call({ tool: 'Bash', command: 'npm test' })
  await clock.settle()
  await clock.advance(3_000)

  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ ...pane(20, 40), surface })
    expect(await rows(ui)).toEqual([
      ...['✓', 'Read', 'src/checkout.ts', '0.1s'],
      ...['✓', 'Grep', 'applyDiscount', '0.2s'],
      ...['✓', 'Edit', 'src/cart/total.ts', '0.1s'],
      ...['⊘', 'Read', '.env', '0.0s'],
      ...['✓', 'Write', 'src/cart/total.test.ts', '0.1s'],
      ...['✗', 'Bash', 'npm test', '12.4s'],
      ...['✓', 'Edit', 'src/cart/total.ts', '0.1s'],
      ...['◐', 'Bash', 'npm test', '3.0s'],
    ])
    await ui.unmount()
  }

  await clock.advance(9_400)
  await testing
})

test('a running call ticks on a mounted pane', async ($, on) => {
  const { clock } = world(on)
  const sleeping = $.tool.call({ tool: 'Bash', command: 'sleep 10' })
  await clock.settle()
  await clock.advance(2_000)

  const uis = await Promise.all(SURFACES.map(surface => $.ui.mount({ ...pane(10), surface })))
  for (const ui of uis) expect(await rows(ui)).toEqual(['◐', 'Bash', 'sleep 10', '2.0s'])

  await clock.advance(1_000)
  for (const ui of uis) expect(await rows(ui)).toEqual(['◐', 'Bash', 'sleep 10', '3.0s'])

  await clock.advance(7_000)
  await sleeping
  for (const ui of uis) expect(await rows(ui)).toEqual(['✓', 'Bash', 'sleep 10', '10.0s'])
})

test("a settings hook's deny reads as denied", async ($, on) => {
  const { call } = world(on)
  on('classic.PreToolUse', () => ({ deny: 'Blocked by policy: no .env writes' }))
  await call($, { tool: 'Write', file_path: '/repo/.env.local', content: 'KEY=1' }, 0)

  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ ...pane(10), surface })
    expect(await rows(ui)).toEqual(['⊘', 'Write', '.env.local', '0.0s'])
    expect((await ui.find({ type: 'Text', text: '⊘' }))?.props.color).toBe('error')
    await ui.unmount()
  }
})

test("only Claude Code's own refusal wording reads as denied", async ($, on) => {
  const { call } = world(on)
  await call($, { tool: 'mcp__gh__get_repo', query: 'acme/api' }, 0)
  await call($, { tool: 'Bash', command: 'rm -rf build' }, 0)

  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ ...pane(10), surface })
    expect(await rows(ui)).toEqual([
      ...['✗', 'gh:get_repo', 'acme/api', '0.0s'],
      ...['⊘', 'Bash', 'rm -rf build', '0.0s'],
    ])
    await ui.unmount()
  }
})

test('parallel calls settle in their own rows', async ($, on) => {
  const { clock } = world(on)
  const a = $.tool.call({ tool: 'Read', file_path: '/repo/a.ts' })
  const b = $.tool.call({ tool: 'Read', file_path: '/repo/b.ts' })
  await clock.settle()
  await clock.advance(200)
  await b

  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ ...pane(10), surface })
    expect(await rows(ui)).toEqual([...['◐', 'Read', 'a.ts', '0.2s'], ...['✓', 'Read', 'b.ts', '0.2s']])
    await ui.unmount()
  }

  await clock.advance(300)
  await a
  const ui = await $.ui.mount({ ...pane(10), surface: 'terminal' })
  expect(await rows(ui)).toEqual([...['✓', 'Read', 'a.ts', '0.5s'], ...['✓', 'Read', 'b.ts', '0.2s']])
})

test('cuts a long path from its start so the file name stays', async ($, on) => {
  const { call } = world(on)
  await call($, { tool: 'Read', file_path: '/repo/packages/server/src/handlers/authentication/session.ts' }, 0)

  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ ...pane(10, 30), surface })
    // 30 columns less the 4-cell name and 10 cells of glyph, gaps and duration: 16 cells.
    expect((await rows(ui))[2]).toBe('…tion/session.ts')
    await ui.unmount()
  }
})

test('keeps the last 200 calls and draws as many as fit', { timeoutMs: 60_000 }, async ($, on) => {
  world(on)
  for (let i = 1; i <= 205; i++) await $.tool.call({ tool: 'Bash', command: `echo ${i}` })

  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ ...pane(6), surface })
    const texts = await rows(ui)
    expect(texts[0]).toBe('+195 earlier')
    expect(texts.filter(text => text === '✓')).toHaveLength(5)
    expect(texts.at(-2)).toBe('echo 205')
    await ui.unmount()
  }
})

test("the surface's height caps the rows", async ($, on) => {
  world(on)
  for (let i = 1; i <= 8; i++) await $.tool.call({ tool: 'Bash', command: `echo ${i}` })

  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ ...pane(20), viewport: { ...DOCKED, rows: 5 }, surface })
    const texts = await rows(ui)
    expect(texts[0]).toBe('+4 earlier')
    expect(texts.filter(text => text === '✓')).toHaveLength(4)
    await ui.unmount()
  }
})

test('shows a quiet line before the first call', async ($, on) => {
  world(on)

  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ ...pane(10), surface })
    expect(await rows(ui)).toEqual(['No tool calls yet.'])
    await ui.unmount()
  }
})

test('/timeline opens the pane', async ($, on) => {
  const { opened } = world(on)
  await $.session.start({ cwd: '/repo', surface: 'terminal', isInteractive: true })

  expect(await $.command.run(RUN)).toMatchObject({ text: 'Timeline opened.' })
  expect(opened).toEqual(['timeline'])
})

test('/timeline says when the pane waits undrawn', async ($, on) => {
  world(on, { isPlaced: false })
  await $.session.start({ cwd: '/repo', surface: 'terminal', isInteractive: true })

  expect(await $.command.run(RUN)).toMatchObject({ text: `Timeline is open, not drawn yet: ${NARROW}` })
})

test('opens unasked only where the surface docks panes', async ($, on) => {
  const { clock, opened } = world(on)

  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ ...band(INLINE), surface })
    await ui.unmount()
  }
  await clock.settle()
  expect(opened).toEqual([])

  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ ...band(DOCKED), surface })
    expect(await rows(ui)).toEqual(['band'])
    await ui.unmount()
  }
  await clock.settle()
  expect(opened).toEqual(['timeline'])
})

test('a pane the person closed does not open unasked again', async ($, on) => {
  const { clock, opened } = world(on)
  // What the person's close left in $.state (the kit raises no close of the person's own).
  on('state.get', { plugin: 'tool-timeline', key: 'dismissed' }, () => ({ value: { value: true, version: 1 } }))

  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ ...band(DOCKED), surface })
    await ui.unmount()
  }
  await clock.settle()
  expect(opened).toEqual([])

  await $.session.start({ cwd: '/repo', surface: 'terminal', isInteractive: true })
  expect(await $.command.run(RUN)).toMatchObject({ text: 'Timeline opened.' })
  expect(opened).toEqual(['timeline'])
})

test('a row an earlier load left running ends as an error', async ($, on) => {
  const { clock, call } = world(on)
  // A reload took the hook that watched this call; $.state kept its row, read once by the next call.
  const orphan = { id: 'toolu_old', tool: 'Bash', summary: 'npm run dev', isPath: false, status: 'running', startedAt: 0 }
  let isSeeded = false
  on('state.get', { plugin: 'tool-timeline', key: 'calls' }, ($, e, next) => {
    if (isSeeded) return next(e)
    isSeeded = true

    return { value: { value: [{ ...orphan, load: 'earlier' }], version: 0 } }
  })
  await clock.advance(4_000)
  await call($, { tool: 'Read', file_path: '/repo/src/app.ts' }, 120)

  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ ...pane(10), surface })
    // Settled when the next call began, 4 s after it started.
    expect(await rows(ui)).toEqual([
      ...['✗', 'Bash', 'npm run dev', '4.0s'],
      ...['✓', 'Read', 'src/app.ts', '0.1s'],
    ])
    await ui.unmount()
  }
})

test('autoOpen off keeps the pane for /timeline alone', { options: { autoOpen: false } }, async ($, on) => {
  const { clock, opened } = world(on)

  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ ...band(DOCKED), surface })
    await ui.unmount()
  }
  await clock.settle()
  expect(opened).toEqual([])
})
