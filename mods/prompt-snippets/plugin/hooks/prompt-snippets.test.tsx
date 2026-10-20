import { expect, mock, test } from 'claude-code/testing'
import type {
  CommandRunInput,
  PromptFillMode,
  PromptOrigin,
  RenderSurface,
  SessionMessage,
} from 'claude-code'

const PLUGIN = 'prompt-snippets'
const SURFACES = ['terminal', 'desktop'] as const
const REVIEW = 'Review this diff for bugs, missing tests and unclear names. Then propose | fixes.'
const GREP = String.raw`grep -E 'TODO\|FIXME' src/`

const run = (command: string, args = '', isFullscreen = true): CommandRunInput => ({
  command,
  args,
  origin: { kind: 'composer' },
  presentation: { isFullscreen, columns: 120 },
})

const sent = (text: string, origin: PromptOrigin = { kind: 'composer' }) => ({ text, origin, wait: false })

const ROWS: SessionMessage[] = [
  { role: 'user', text: REVIEW, toolUses: [] },
  { role: 'assistant', text: 'Reading the diff.', toolUses: [] },
  {
    role: 'user',
    text: '',
    toolUses: [],
    toolResults: [{ tool_use_id: 't1', text: 'diff --git a/x b/x', isError: false }],
  },
  { role: 'assistant', text: 'Two bugs found.', toolUses: [] },
  { role: 'user', text: '<teammate-message from="tester">Done.</teammate-message>', toolUses: [] },
  { role: 'user', text: '<command-name>/snip</command-name>', toolUses: [] },
]

// Cells of a Markdown table row: the pipes no backslash escapes, less the two at its ends.
const cells = (row: string) => row.replace(/\\./g, '').split('|').length - 2

test('session.start registers /snip and /quote', async ($, on) => {
  const names: string[] = []
  on('command.register', ($, e) => {
    names.push(e.name)
    return { value: { command: e.name } }
  })
  on('session.start', ($, e) => ({ cwd: e.cwd }))

  await $.session.start({ cwd: '/repo', surface: 'terminal', isInteractive: true })
  expect(names).toEqual(['snip', 'quote'])
})

test('save reads the transcript before a prompt was sent, /snip <name> inserts it at the cursor', async ($, on) => {
  mock.store(on)
  const fills: { text: string; mode: PromptFillMode }[] = []
  on('session.surfaces', () => ({ value: ['terminal'] }))
  on('session.messages', () => ({ value: ROWS }))
  on('prompt.fill', ($, e) => {
    fills.push({ text: e.text, mode: e.mode })
    return { isFilled: true }
  })

  expect((await $.command.run(run('snip', 'save review'))).text).toBe(
    'Saved snippet review with your last prompt. `/snip review` inserts it.',
  )
  expect((await $.command.run(run('snip', 'review'))).text).toBe('Inserted snippet review.')
  expect(fills).toEqual([{ text: REVIEW, mode: 'insert' }])
  expect((await $.command.run(run('snip', 'save review'))).text).toStartWith('Replaced snippet review')
})

test('save keeps the last prompt the person sent, not a peer, meta or command one', async ($, on) => {
  mock.store(on)
  on('session.surfaces', () => ({ value: ['terminal'] }))
  on('session.messages', () => ({ value: ROWS }))
  on('prompt.submit', ($, e) => ({ text: e.text }))
  const fills: string[] = []
  on('prompt.fill', ($, e) => {
    fills.push(e.text)
    return { isFilled: true }
  })

  await $.prompt.submit(sent('Explain what parse() does, step by step.'))
  await $.prompt.submit(sent('From another session.', { kind: 'peer' }))
  await $.prompt.submit({ ...sent('A reminder.'), isMeta: true })
  await $.prompt.submit({ ...sent('/snip list'), command: { name: 'snip', args: 'list' } })
  await $.command.run(run('snip', 'save explain'))
  await $.command.run(run('snip', 'explain'))
  expect(fills).toEqual(['Explain what parse() does, step by step.'])

  await $.prompt.submit(sent('Typed on the desktop app.', { kind: 'sdk' }))
  await $.command.run(run('snip', 'save desk'))
  await $.command.run(run('snip', 'desk'))
  expect(fills.at(-1)).toBe('Typed on the desktop app.')
})

test('list answers a table of names and first 60 characters, drawn as Markdown', async ($, on) => {
  mock.store(on, { tests: 'Write tests for parse | eval\nand run them', review: REVIEW, 'grep-todo': GREP })
  const { text = '' } = await $.command.run(run('snip', 'list'))
  const rows = text.split('\n')
  expect(rows).toEqual([
    '| Name | Snippet |',
    '| --- | --- |',
    String.raw`| grep-todo | grep -E 'TODO\\\|FIXME' src/ |`,
    '| review | Review this diff for bugs, missing tests and unclear names.… |',
    '| tests | Write tests for parse \\| eval and run them |',
  ])
  expect(rows.map(cells)).toEqual([2, 2, 2, 2, 2])

  for (const surface of SURFACES) {
    const ui = await $.ui.mount({
      plugin: PLUGIN,
      surface,
      component: 'CommandOutput',
      props: { command: 'snip', args: 'list', text, isErrored: false },
    })
    expect((await ui.find({ type: 'Markdown' }))?.text).toBe(text)
    await ui.unmount()
  }
})

test('other /snip rows are left to the engine', async ($, on) => {
  on('ui.render', { component: 'CommandOutput' }, ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>{e.props.text}</Text>
  })
  const answers = [
    { args: 'rm x', text: 'Removed snippet x.' },
    { args: 'list foo', text: '`/snip list` takes no name.' },
  ]

  for (const surface of SURFACES) {
    for (const { args, text } of answers) {
      const props = { command: 'snip', args, text, isErrored: false }
      const ui = await $.ui.mount({ plugin: PLUGIN, surface, component: 'CommandOutput', props })
      expect(await ui.find({ type: 'Markdown' })).toBeUndefined()
      expect((await ui.find({ type: 'Text' }))?.text).toBe(text)
      await ui.unmount()
    }
  }
})

test('errors answer plainly', async ($, on) => {
  mock.store(on, { review: REVIEW })
  on('session.messages', () => ({ value: [] }))
  const answer = async (args: string) => (await $.command.run(run('snip', args))).text
  const rule = 'is not a snippet name: use 1-32 characters of `a-z`, `0-9` and `-`.'

  expect(await answer('x')).toBe('No snippet named x. `/snip list` shows yours.')
  expect(await answer('rm x')).toBe('No snippet named x. `/snip list` shows yours.')
  expect(await answer('save')).toBe('Name the snippet: `/snip save <name>`.')
  expect(await answer('save Bad_Name')).toBe(`Bad\\_Name ${rule}`)
  expect(await answer('save a b')).toBe(`a b ${rule}`)
  expect(await answer('save list')).toBe('list is a `/snip` command, so it cannot name a snippet.')
  expect(await answer('save fresh')).toBe('No prompt to save yet. Send one, then `/snip save <name>`.')
  expect(await answer('list foo')).toStartWith('`/snip list` takes no name.\n\n- `/snip save <name>`')
  expect(await answer('')).toBe(
    [
      '- `/snip save <name>` saves your last prompt',
      '- `/snip <name>` inserts a snippet into the prompt',
      '- `/snip list` shows your snippets',
      '- `/snip rm <name>` removes one',
    ].join('\n'),
  )
  expect(await answer('rm review')).toBe('Removed snippet review.')
  expect(await answer('list')).toBe('No snippets yet. Send a prompt, then `/snip save <name>` keeps it.')
})

test('a store that refuses or fails answers in words', async ($, on) => {
  let isBroken = false
  on('session.messages', () => ({ value: ROWS }))
  on('store.get', () => {
    if (isBroken) throw new Error('the store file is unreadable')
    return { value: undefined }
  })
  on('store.set', () => {
    throw new Error('store over 4 MiB')
  })

  expect((await $.command.run(run('snip', 'save huge'))).text).toBe(
    'The snippet store refused it: all snippets together hold at most 4 MiB. `/snip rm <name>` frees room.',
  )
  isBroken = true
  expect((await $.command.run(run('snip', 'review'))).text).toStartWith('`/snip` did not finish: ')
})

test('on the desktop app and under -p the text is answered to copy, the box left alone', async ($, on) => {
  mock.store(on, { review: REVIEW, fenced: 'Run:\n```sh\nnpm test\n```' })
  let surfaces: RenderSurface[] = ['desktop']
  on('session.surfaces', () => ({ value: surfaces }))
  on('ui.selection', () => ({ value: { text: 'const a = 1\n' } }))
  on('prompt.fill', () => {
    throw new Error('no prompt box to fill')
  })
  const copy =
    'This session has no prompt box a mod can fill (the desktop app, `claude -p`). Copy it from here:\n\n'

  expect((await $.command.run(run('snip', 'review', false))).text).toBe(`${copy}\`\`\`\n${REVIEW}\n\`\`\``)
  expect((await $.command.run(run('snip', 'fenced', false))).text).toBe(
    `${copy}\`\`\`\`\nRun:\n\`\`\`sh\nnpm test\n\`\`\`\n\`\`\`\``,
  )
  surfaces = []
  expect((await $.command.run(run('quote', '', false))).text).toBe(`${copy}\`\`\`\n> const a = 1\n\`\`\``)
})

test('text another plugin keeps out of the box is not echoed', async ($, on) => {
  mock.store(on, { review: REVIEW })
  on('session.surfaces', () => ({ value: ['terminal', 'mobile'] }))
  // A hook's own cause never reaches the caller, whatever it writes.
  on('prompt.fill', () => ({ isFilled: false, refusal: 'no_composer' as const }))

  expect((await $.command.run(run('snip', 'review'))).text).toBe(
    'Another plugin kept the text out of the prompt box.',
  )
})

test('/quote puts the selection into the prompt as "> " lines', async ($, on) => {
  let selection: { text: string } | undefined = { text: 'const a = 1\nconst b = 2\n' }
  const fills: string[] = []
  on('session.surfaces', () => ({ value: ['terminal'] }))
  on('ui.selection', () => ({ value: selection }))
  on('prompt.fill', ($, e) => {
    fills.push(e.text)
    return { isFilled: e.mode === 'insert' }
  })

  expect((await $.command.run(run('quote'))).text).toBe('Quoted the selection into the prompt.')
  expect(fills).toEqual(['> const a = 1\n> const b = 2\n\n'])

  selection = { text: '  \n\t\n' }
  expect((await $.command.run(run('quote'))).text).toBe(
    'Nothing is selected. Select text with the mouse, then `/quote`.',
  )
  selection = undefined
  expect((await $.command.run(run('quote', '', false))).text).toBe(
    "Nothing is selected that `/quote` can read: it reads the mouse selection in the desktop app and in the terminal's fullscreen layout.",
  )
  expect(fills).toHaveLength(1)
})
