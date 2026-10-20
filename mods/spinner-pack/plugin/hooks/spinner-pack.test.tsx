import { describe, expect, test } from 'claude-code/testing'
import type { Engine, Plugin } from 'claude-code/testing'
import type { On, RenderPropsOf } from 'claude-code'

type Spinner = RenderPropsOf['Spinner']

const SURFACES = ['terminal', 'desktop'] as const
type Surface = (typeof SURFACES)[number]

// What each surface says before a pack touches it: a sampled verb on the
// terminal, the generic `Working` on the desktop.
const spinner = (surface: Surface, props: Partial<Spinner> = {}): Spinner => ({
  word: surface === 'desktop' ? 'Working' : 'Sauteing',
  message: null,
  suffix: '…',
  mode: 'thinking',
  ...props,
})

// The test's hook stands for the engine: it draws the word (or the message)
// and the suffix as one line.
const drawLikeEngine = (on: On) =>
  on('ui.render', { component: 'Spinner' }, ($, e) => {
    const { Text } = $.ui.resolve(e)

    return (
      <Text>
        {e.props.message ?? e.props.word}
        {e.props.suffix}
      </Text>
    )
  })

// Mounts the spinner, then redraws it through each phase, and returns the
// line drawn at every step.
const linesThrough = async (
  $: Engine,
  surface: Surface,
  phases: readonly [Spinner['mode'], ...Spinner['mode'][]],
) => {
  const [first, ...rest] = phases
  const ui = await $.ui.mount({
    plugin: 'spinner-pack',
    surface,
    component: 'Spinner',
    props: spinner(surface, { mode: first }),
  })
  const lines = [(await ui.find({ type: 'Text' }))?.text]
  for (const mode of rest) {
    await ui.redraw(spinner(surface, { mode }))
    lines.push((await ui.find({ type: 'Text' }))?.text)
  }
  await ui.unmount()

  return lines
}

// Stands for a phase a later build may raise.
const LATER_PHASE = 'planning' as string as Spinner['mode']

// Sits above the pack and draws how the pack's hook settled, so a hook that
// threw (and was skipped) cannot pass for one that handed the line on.
const watcher: Plugin = {
  name: 'watcher',
  tier: 'prepend',
  register(on) {
    on('ui.render', { component: 'Spinner' }, async ($, e, next) => {
      await next(e)
      const { Text } = $.ui.resolve(e)
      const pack = next.trace.find((link) => link.plugin === 'spinner-pack')

      return <Text>{pack?.outcome ?? 'absent'}</Text>
    })
  },
}

const lineFor = async ($: Engine, surface: Surface, props: Partial<Spinner>) => {
  const ui = await $.ui.mount({
    plugin: 'spinner-pack',
    surface,
    component: 'Spinner',
    props: spinner(surface, props),
  })
  const line = (await ui.find({ type: 'Text' }))?.text
  await ui.unmount()

  return line
}

describe('spinner-pack', () => {
  test('moon is the default and follows the turn through its phases', async ($, on) => {
    drawLikeEngine(on)
    for (const surface of SURFACES) {
      const lines = await linesThrough($, surface, ['requesting', 'thinking', 'tool-use', 'responding'])
      expect(lines, surface).toEqual(['Orbiting ◐…', 'Waxing ◓…', 'Eclipsing ◒…', 'Waning ◐…'])
    }
  })

  test('braille pack', { options: { pack: 'braille' } }, async ($, on) => {
    drawLikeEngine(on)
    for (const surface of SURFACES) {
      const lines = await linesThrough($, surface, ['thinking', 'tool-input', 'responding'])
      expect(lines, surface).toEqual(['Computing ⠹…', 'Threading ⠼…', 'Weaving ⠇…'])
    }
  })

  test('coffee pack', { options: { pack: 'coffee' } }, async ($, on) => {
    drawLikeEngine(on)
    for (const surface of SURFACES) {
      const lines = await linesThrough($, surface, ['thinking', 'tool-use', 'responding'])
      expect(lines, surface).toEqual(['Steeping ∵…', 'Brewing ⁂…', 'Pouring ∴…'])
    }
  })

  test('classic leaves the engine spinner as it was', { options: { pack: 'classic' } }, async ($, on) => {
    drawLikeEngine(on)
    expect(await lineFor($, 'terminal', { mode: 'tool-use' })).toBe('Sauteing…')
    expect(await lineFor($, 'desktop', { mode: 'tool-use' })).toBe('Working…')
  })

  test('classic hooks nothing', { options: { pack: 'classic' }, plugins: [watcher] }, async ($, on) => {
    drawLikeEngine(on)
    for (const surface of SURFACES) {
      expect(await lineFor($, surface, { mode: 'tool-use' }), surface).toBe('absent')
    }
  })

  test('a value outside the list falls back to moon', { options: { pack: 'disco' } }, async ($, on) => {
    drawLikeEngine(on)
    for (const surface of SURFACES) {
      expect(await lineFor($, surface, { mode: 'thinking' }), surface).toBe('Waxing ◓…')
    }
  })

  test('a state message is drawn as the engine has it', async ($, on) => {
    drawLikeEngine(on)
    for (const surface of SURFACES) {
      const line = await lineFor($, surface, { message: 'Compacting conversation' })
      expect(line, surface).toBe('Compacting conversation…')
    }
  })

  test('a phase the pack does not know is drawn as the engine has it', async ($, on) => {
    drawLikeEngine(on)
    for (const surface of SURFACES) {
      const line = await lineFor($, surface, { mode: LATER_PHASE })
      expect(line, surface).toBe(surface === 'desktop' ? 'Working…' : 'Sauteing…')
    }
  })

  test('a phase the pack does not know is passed on, not thrown on', { plugins: [watcher] }, async ($, on) => {
    drawLikeEngine(on)
    for (const surface of SURFACES) {
      expect(await lineFor($, surface, { mode: LATER_PHASE }), surface).toBe('returned')
    }
  })

  test('the desktop keeps the step it names and gains the glyph', async ($, on) => {
    drawLikeEngine(on)
    const line = await lineFor($, 'desktop', { word: 'Creating notes.md', mode: 'tool-use' })
    expect(line).toBe('Creating notes.md ◒…')
  })
})
