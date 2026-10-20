import { atom, read, update } from 'claude-code'
import type { EngineInterface, PromptFillResult, PromptOrigin, Register } from 'claude-code'

const NAME = /^[a-z0-9-]{1,32}$/
const VERBS = new Set(['save', 'list', 'rm', 'help'])
const PREVIEW = 60
// Where a prompt the person wrote arrives from: the terminal, the desktop app or another SDK host, Remote Control.
const BY_PERSON = new Set<PromptOrigin['kind']>(['composer', 'sdk', 'bridge'])
// User-role rows the person did not type: a command's record and output, reminders and
// notices, the summary /compact leaves, messages from teammates and channels.
const NOT_TYPED =
  /^(<(command-|local-command-|system-reminder|bash-|task-notification|teammate-message|channel)|\[Request interrupted|This session is being continued from a previous conversation)/

const typed = atom({ plugin: 'prompt-snippets', key: 'typed' } as const, null)

const USAGE = [
  '- `/snip save <name>` saves your last prompt',
  '- `/snip <name>` inserts a snippet into the prompt',
  '- `/snip list` shows your snippets',
  '- `/snip rm <name>` removes one',
].join('\n')

// The answer is drawn as Markdown: keep its punctuation from acting.
const escape = (text: string) => text.replace(/[\\`*_~<>[\]|&]/g, '\\$&')

const missing = (name: string) => `No snippet named ${name}. \`/snip list\` shows yours.`
const badName = (name: string) =>
  `${escape(name)} is not a snippet name: use 1-32 characters of \`a-z\`, \`0-9\` and \`-\`.`
const failed = (command: string) => (error: unknown) =>
  `\`${command}\` did not finish: ${error instanceof Error ? error.message : String(error)}`

// A fence longer than any backtick run in the text, so the text shows as it is.
function fence(text: string): string {
  const runs = text.match(/`+/g) ?? []
  const bar = '`'.repeat(Math.max(3, ...runs.map(run => run.length + 1)))

  return `${bar}\n${text.trimEnd()}\n${bar}`
}

// Puts text in at the cursor and answers `done`, or why it could not.
async function insert($: EngineInterface, text: string, done: string): Promise<string> {
  // Only the terminal's prompt box takes a mod's text: the desktop app draws its own, -p has none.
  const hasBox = (await $.session.surfaces()).includes('terminal')
  const filled: PromptFillResult = hasBox
    ? await $.prompt.fill({ text, mode: 'insert' })
    : { isFilled: false, refusal: 'no_composer' }

  if (filled.isFilled) return done
  if (filled.refusal === 'no_composer') {
    return `This session has no prompt box a mod can fill (the desktop app, \`claude -p\`). Copy it from here:\n\n${fence(text)}`
  }
  if (filled.refusal === 'dialog') return 'A dialog holds the keys. Close it, then run the command again.'

  return 'Another plugin kept the text out of the prompt box.'
}

async function lastPrompt($: EngineInterface): Promise<string | undefined> {
  const sent = await read($, typed)
  if (sent !== null) return sent

  // Nothing sent since the mod loaded (a resumed session): the transcript's last row that reads as typed.
  const rows = await $.session.messages()

  return rows.findLast(
    row =>
      row.role === 'user' &&
      !row.toolResults?.length &&
      row.text.trim() !== '' &&
      !NOT_TYPED.test(row.text.trimStart()),
  )?.text
}

function preview(text: string): string {
  const flat = text.replace(/\s+/g, ' ').trim()

  return escape(flat.length > PREVIEW ? `${flat.slice(0, PREVIEW).trimEnd()}…` : flat)
}

async function table($: EngineInterface): Promise<string> {
  const names = (await $.store.keys()).sort()
  if (names.length === 0) {
    return 'No snippets yet. Send a prompt, then `/snip save <name>` keeps it.'
  }
  const rows = await Promise.all(
    names.map(async name => `| ${name} | ${preview(String(await $.store.get(name)))} |`),
  )

  return ['| Name | Snippet |', '| --- | --- |', ...rows].join('\n')
}

async function snip($: EngineInterface, args: string): Promise<string> {
  const [verb = '', name = '', ...rest] = args.trim().split(/\s+/)

  if (verb === '' || verb === 'help') return USAGE
  if (verb === 'list') return name === '' ? table($) : `\`/snip list\` takes no name.\n\n${USAGE}`

  if (verb === 'save' || verb === 'rm') {
    if (name === '') return `Name the snippet: \`/snip ${verb} <name>\`.`
    if (!NAME.test(name) || rest.length > 0) return badName([name, ...rest].join(' '))
    if (VERBS.has(name)) return `${name} is a \`/snip\` command, so it cannot name a snippet.`
    const held = await $.store.get(name)

    if (verb === 'rm') {
      if (held === undefined) return missing(name)
      await $.store.delete(name)
      return `Removed snippet ${name}.`
    }

    const prompt = await lastPrompt($)
    if (prompt === undefined) return 'No prompt to save yet. Send one, then `/snip save <name>`.'
    try {
      await $.store.set(name, prompt)
    } catch {
      return 'The snippet store refused it: all snippets together hold at most 4 MiB. `/snip rm <name>` frees room.'
    }
    return `${held === undefined ? 'Saved' : 'Replaced'} snippet ${name} with your last prompt. \`/snip ${name}\` inserts it.`
  }

  if (!NAME.test(verb) || name !== '') return `${badName(args.trim())}\n\n${USAGE}`
  const text = await $.store.get(verb)
  if (typeof text !== 'string') return missing(verb)

  return insert($, text, `Inserted snippet ${verb}.`)
}

async function quote($: EngineInterface, isFullscreen: boolean): Promise<string> {
  const lines = (await $.ui.selection())?.text.replace(/\s+$/, '')
  if (!lines) {
    // The main-screen terminal never shows a mod its selection.
    return isFullscreen
      ? 'Nothing is selected. Select text with the mouse, then `/quote`.'
      : "Nothing is selected that `/quote` can read: it reads the mouse selection in the desktop app and in the terminal's fullscreen layout."
  }
  const quoted = `${lines
    .split(/\r?\n/)
    .map(line => `> ${line}`)
    .join('\n')}\n\n`

  return insert($, quoted, 'Quoted the selection into the prompt.')
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'snip',
      description: 'Save, list and insert reusable prompt snippets',
      argumentHint: '<name> | save <name> | list | rm <name>',
      immediate: true,
    })
    await $.command.register({
      name: 'quote',
      description: 'Quote your mouse selection into the prompt',
      immediate: true,
    })

    return next(e)
  })

  // Only notes the prompt down: a failure lets it through.
  on('prompt.submit', async ($, e, next) => {
    if (BY_PERSON.has(e.origin.kind) && !e.isMeta && !e.command && e.text.trim() !== '') {
      await update($, typed, () => e.text)
    }

    return next(e)
  }).catch(($, e, next) => next(e))

  on('command.run', { command: 'snip' }, async ($, e) => ({
    text: await snip($, e.args).catch(failed('/snip')),
  }))

  on('command.run', { command: 'quote' }, async ($, e) => ({
    text: await quote($, e.presentation.isFullscreen).catch(failed('/quote')),
  }))

  // The list is a Markdown table: draw it as one rather than as the row's plain text.
  on('ui.render', { component: 'CommandOutput', props: { command: 'snip' } }, ($, e, next) => {
    if (e.props.isErrored || e.props.args.trim() !== 'list') return next(e)
    const { Markdown } = $.ui.resolve(e)

    return <Markdown text={e.props.text} />
  })
}
