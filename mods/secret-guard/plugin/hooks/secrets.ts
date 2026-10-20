// Which tool calls reach secret-looking files. Pure functions, no `$`.

import type { PluginOptions } from 'claude-code'

export type Glob = { matches: (path: string, segments: readonly string[]) => boolean; sample: string }
export type Rules = { extra: readonly Glob[]; allow: readonly Glob[] }

const ALLOWED_ENV = new Set(['.env.example', '.env.sample', '.env.template'])
const SECRET_NAMES = new Set(['.npmrc', '.pypirc', 'credentials.json'])
// What a wildcard in a shell word is tried against: `cat .env*`, `cat *.pem`.
const SAMPLES = ['.env', '.env.local', 'id_rsa', 'id_ed25519', 'cert.pem', 'server.key', '.npmrc', '.pypirc', 'credentials.json', 'credentials']

// Tools whose arguments name a file; others are compared by name only.
const FILE_FIELDS = new Map<string, readonly string[]>([
  ['Read', ['file_path']],
  ['Edit', ['file_path']],
  ['Write', ['file_path']],
  ['MultiEdit', ['file_path']],
  ['NotebookEdit', ['notebook_path']],
  ['NotebookRead', ['notebook_path']],
  ['Grep', ['path', 'glob']],
])
// Tools whose `command` a shell runs, with that shell's escape character.
const SHELL_ESCAPES = new Map([['Bash', '\\'], ['Monitor', '\\'], ['PowerShell', '`']])

// Commands that read (or copy away) the files they name.
const READERS = new Set([
  'cat', 'tac', 'nl', 'less', 'more', 'most', 'bat', 'batcat', 'view', 'vi', 'vim', 'nvim', 'ex', 'ed', 'nano', 'emacs',
  'head', 'tail', 'grep', 'egrep', 'fgrep', 'rg', 'ag', 'ack', 'sed', 'awk', 'gawk', 'mawk', 'cut', 'sort', 'uniq',
  'paste', 'join', 'comm', 'diff', 'cmp', 'column', 'fold', 'fmt', 'pr', 'rev', 'expand', 'strings', 'od', 'xxd',
  'hexdump', 'hd', 'base64', 'base32', 'basenc', 'uuencode', 'cp', 'mv', 'ln', 'install', 'scp', 'rsync', 'sftp',
  'tar', 'zip', '7z', 'gzip', 'bzip2', 'xz', 'zstd', 'zcat', 'dd', 'jq', 'yq', 'openssl', 'curl', 'wget', 'source', '.',
  'python', 'python3', 'node', 'deno', 'bun', 'ruby', 'perl', 'php', 'lua',
  'get-content', 'gc', 'type', 'select-string', 'sls', 'copy-item', 'copy', 'cpi', 'move-item', 'move', 'mi',
  'format-hex', 'fhx', 'import-csv', 'findstr', 'xcopy', 'certutil',
])
const GREPS = new Set(['grep', 'egrep', 'fgrep', 'rg', 'ag', 'ack', 'select-string', 'sls', 'findstr'])
const PATTERN_FLAGS = new Set(['-e', '--regexp', '-pattern'])
// Flags that hand a grep its patterns or files, so its first positional is no pattern.
const FILE_FLAGS = new Set(['-f', '--file', '-path', '-literalpath'])
const COPIERS = new Set(['cp', 'mv', 'ln', 'install', 'scp', 'rsync', 'copy-item', 'copy', 'cpi', 'move-item', 'move', 'mi', 'xcopy'])
const DESTINATION_FLAGS = new Set(['-t', '--target-directory', '-destination'])
const GIT_READS = new Set(['show', 'diff', 'log', 'blame', 'cat-file', 'grep', 'archive'])
const GIT_VALUED = new Set(['-C', '-c', '--git-dir', '--work-tree', '--namespace'])
// Words after which a command starts again: `find -exec`, `fd -x`, `kubectl exec pod --`.
const EXEC_FLAGS = new Set(['-exec', '-execdir', '-ok', '-okdir', '-x', '--exec', '--'])
// Flags whose following words are a command line: `bash -c`, `pwsh -Command`, `cmd /c`.
const RUN_FLAGS = /^(-c|--?command|\/c|\/k)$/i

// Words that run the command after them. `valued` flags take the next word; `operands` leading words are no command.
type Wrapper = { valued?: readonly string[]; operands?: number }
const WRAPPERS = new Map<string, Wrapper>([
  ['sudo', { valued: ['-u', '-g', '-h', '-p', '-C', '-D', '-r', '-t', '-U'] }],
  ['doas', { valued: ['-u', '-C'] }],
  ['env', { valued: ['-u', '-C', '--unset', '--chdir'] }],
  ['exec', { valued: ['-a'] }],
  ['time', { valued: ['-f', '-o', '--format', '--output'] }],
  ['nice', { valued: ['-n', '--adjustment'] }],
  ['timeout', { valued: ['-s', '-k', '--signal', '--kill-after'], operands: 1 }],
  ['watch', { valued: ['-n', '--interval'] }],
  ['xargs', { valued: ['-a', '--arg-file', '-d', '--delimiter', '-E', '-I', '-L', '-n', '--max-args', '-P', '--max-procs', '-s', '--max-chars'] }],
  ['ssh', { valued: ['-b', '-c', '-D', '-E', '-e', '-F', '-I', '-i', '-J', '-L', '-l', '-m', '-O', '-o', '-p', '-Q', '-R', '-S', '-W', '-w'], operands: 1 }],
  ...['command', 'builtin', 'nohup', 'eval', 'iex', 'invoke-expression', 'if', 'then', 'else', 'elif', 'while', 'until', 'do', '!'].map(
    name => [name, {}] as const,
  ),
])

/** Lower case, forward slashes, no quotes, no `host:`, `HEAD:` or drive prefix, no `::$DATA` stream. */
export function normalise(raw: string): string {
  const path = raw.trim().replace(/^["']+|["']+$/g, '').replace(/\\/g, '/').toLowerCase().replace(/::\$data\b/g, '')
  const colon = path.indexOf(':')

  return colon > 0 && !path.slice(0, colon).includes('/') ? path.slice(colon + 1) : path
}

// A colon left inside a path parts a ref from its file: `origin/main:.env`.
const segmentsOf = (path: string) => path.split(/[/:]/).filter(part => part !== '' && part !== '.')
const hasWildcard = (text: string) => /[*?]/.test(text)
// Short flags are case-sensitive (`-f` is not `-F`); PowerShell's long ones are not.
const isFlag = (flags: ReadonlySet<string>, arg = '') => flags.has(arg.length > 2 ? arg.toLowerCase() : arg)

function isBuiltinSecret(segments: readonly string[]): boolean {
  const name = segments.at(-1) ?? ''
  if (segments.includes('.ssh')) return true
  if (name === 'credentials' && segments.at(-2) === '.aws') return true
  if (name === '.env' || name.startsWith('.env.')) return !ALLOWED_ENV.has(name)

  return SECRET_NAMES.has(name) || name.endsWith('.pem') || name.endsWith('.key') || name.startsWith('id_rsa') || name.startsWith('id_ed25519')
}

function globSource(glob: string): string {
  return glob.replace(/\*\*\/|\*\*|\*|\?|[.+^${}()|[\]\\]/g, token =>
    token === '**/' ? '(?:.*/)?' : token === '**' ? '.*' : token === '*' ? '[^/]*' : token === '?' ? '[^/]' : `\\${token}`,
  )
}

/** A glob without `/` matches the file name or any folder; with `/`, the end of the path. */
export function compileGlob(pattern: string): Glob | undefined {
  const glob = normalise(pattern).replace(/^\.\//, '')
  if (segmentsOf(glob).length === 0) return undefined
  const sample = (segmentsOf(glob).at(-1) ?? '').replace(/[*?]+/g, 'x')

  if (!glob.includes('/')) {
    const re = new RegExp(`^${globSource(glob)}$`)
    return { matches: (_, segments) => segments.some(segment => re.test(segment)), sample }
  }
  const re = new RegExp(`(?:^|/)${globSource(glob.replace(/^\/+/, ''))}$`)

  return { matches: path => re.test(path), sample }
}

export function rulesFrom(options: PluginOptions): Rules {
  const globs = (value: unknown) =>
    (typeof value === 'string' ? value.split(',') : []).flatMap(part => compileGlob(part.trim()) ?? [])

  return { extra: globs(options.extraPatterns), allow: globs(options.allow) }
}

export function isSecretPath(raw: string, rules: Rules): boolean {
  const path = normalise(raw)
  const segments = segmentsOf(path)
  if (segments.length === 0 || rules.allow.some(glob => glob.matches(path, segments))) return false

  return isBuiltinSecret(segments) || rules.extra.some(glob => glob.matches(path, segments))
}

/** A path, or a shell glob tried against typical secret names: `.env*`, `~/.ssh/*`. */
export function isSecretWord(word: string, rules: Rules): boolean {
  const path = normalise(word)
  const slash = path.lastIndexOf('/')
  const folder = path.slice(0, slash + 1)
  const name = path.slice(slash + 1)
  if (!hasWildcard(name)) return isSecretPath(path, rules)
  if (/^[*?]*$/.test(name)) return isSecretPath(`${folder}x`, rules)
  const re = new RegExp(`^${globSource(name)}$`)
  const samples = [...SAMPLES, ...rules.extra.map(glob => glob.sample)]

  return samples.some(sample => re.test(sample) && isSecretPath(folder + sample, rules))
}

/**
 * One simple command. `nested`: its words that run a command line inside double
 * quotes (`"$(cat .env)"`). `call`: it ended on `(` or `$(`, whose content is its argument.
 */
type Segment = { words: string[]; inputs: string[]; nested: string[]; call: boolean }

/**
 * Splits a command line into simple commands at `; & | ( ) $(`, newlines and
 * standalone braces, keeping each one's words (quotes removed) and the files `<` reads.
 * Here-document bodies are text and are skipped.
 * `escape` is the shell's escape character: `\` for sh, a backtick for PowerShell.
 */
function parse(command: string, escape: string): Segment[] {
  const segments: Segment[] = []
  const empty = (): Segment => ({ words: [], inputs: [], nested: [], call: false })
  let current = empty()
  let word = ''
  let hasWord = false
  let runs = false
  let quote = ''
  let redirect: 'in' | 'out' | 'heredoc' | undefined
  const heredocs: string[] = []

  const endWord = () => {
    if (!hasWord) return
    if (redirect === 'in') current.inputs.push(word)
    else if (redirect === 'heredoc') heredocs.push(word)
    else if (redirect === undefined) current.words.push(word)
    if (runs) current.nested.push(word)
    redirect = undefined
    word = ''
    hasWord = false
    runs = false
  }
  const endSegment = (call = false) => {
    endWord()
    redirect = undefined
    current.call = call
    if (current.words.length > 0 || current.inputs.length > 0 || current.nested.length > 0) segments.push(current)
    current = empty()
  }
  // Index of the newline that ends a here-document begun after `from`, or the end.
  const bodyEnd = (from: number, delimiter: string) => {
    let start = from + 1
    for (;;) {
      const end = command.indexOf('\n', start)
      if (end === -1) return command.length
      if (command.slice(start, end).replace(/^\t+/, '') === delimiter) return end
      start = end + 1
    }
  }

  for (let i = 0; i < command.length; i++) {
    const c = command[i] ?? ''
    const following = command[i + 1] ?? ''
    if (c === escape && (quote === '"' || quote === '') && /["'`$\\\s;&|<>()]/.test(following)) {
      word += following
      hasWord = true
      i++
    } else if (quote !== '') {
      if (c === quote) quote = ''
      else word += c
      // Inside double quotes `$(...)` and backticks still run; single quotes keep text literal.
      runs ||= quote === '"' && ((c === '$' && following === '(') || (c === '`' && escape !== '`'))
    } else if (c === '"' || c === "'") {
      quote = c
      hasWord = true
    } else if (c === '#' && !hasWord) {
      while (i + 1 < command.length && command[i + 1] !== '\n') i++
    } else if (c === '(' || (c === '$' && following === '(')) {
      endSegment(true)
      if (c === '$') i++
    } else if (c === '\n' || ';&|)'.includes(c) || (c === '`' && escape !== '`')) {
      endSegment()
      if (c === '\n') for (const delimiter of heredocs.splice(0)) i = bodyEnd(i, delimiter)
    } else if ((c === '{' || c === '}') && !hasWord && /^$|[\s;&|)]/.test(following)) {
      // `{ cat .env; }` and PowerShell's `{ gc .env }` hold commands; `{}` and `{a,b}` stay words.
      endSegment()
    } else if (/\s/.test(c)) {
      endWord()
    } else if (c === '<' || c === '>') {
      // `<` reads a file, `<<` opens a here-document, `<<<` is a here-string, `>` writes.
      endWord()
      let last = i
      while (command[last + 1] === c) last++
      const count = last - i + 1
      redirect = c === '>' || count > 2 ? 'out' : count === 2 ? 'heredoc' : 'in'
      i = command[last + 1] === '&' || (redirect === 'heredoc' && command[last + 1] === '-') ? last + 1 : last
    } else {
      word += c
      hasWord = true
    }
  }
  endSegment()

  return segments
}

const commandName = (word: string) => (word.split(/[\\/]/).at(-1) ?? '').toLowerCase().replace(/\.exe$/, '')

/** Where the command starts at or after `from`: past `NAME=value`, keywords and wrappers such as `sudo -u root`. */
function commandStart(words: readonly string[], from = 0): number {
  let i = from
  for (;;) {
    const word = words[i] ?? ''
    const wrapper = WRAPPERS.get(commandName(word))
    if (/^[A-Za-z_]\w*=/.test(word)) {
      i++
      continue
    }
    if (wrapper === undefined) return i
    let operands = wrapper.operands ?? 0
    i++
    while (i < words.length) {
      const flag = words[i] ?? ''
      if (flag.startsWith('-')) i += wrapper.valued?.includes(flag) ? 2 : 1
      else if (operands > 0) {
        operands--
        i++
      } else break
    }
  }
}

/** The word that reads files: the command, a git subcommand, or what `-exec` runs; -1 if none. */
function readerAt(words: readonly string[]): number {
  const starts = [0, ...words.flatMap((word, i) => (EXEC_FLAGS.has(word) ? [i + 1] : []))]

  for (const start of starts) {
    let at = commandStart(words, start)
    const name = commandName(words[at] ?? '')
    if (READERS.has(name)) return at
    if (name !== 'git') continue
    at++
    while ((words[at] ?? '').startsWith('-')) at += GIT_VALUED.has(words[at] ?? '') ? 2 : 1
    if (GIT_READS.has((words[at] ?? '').toLowerCase())) return at
  }

  return -1
}

/** The arguments of a reading command that may name what it reads. */
function readArgs(name: string, args: readonly string[]): string[] {
  const positional = args.flatMap((arg, i) => (arg.startsWith('-') ? [] : [i]))
  const after = (flags: ReadonlySet<string>) => args.flatMap((arg, i) => (isFlag(flags, arg) ? [i + 1] : []))
  // A grep's pattern is no file (`grep -rn ".env" src`); a copy's destination is written (`cp .env.example .env`).
  const patterns = after(PATTERN_FLAGS)
  const destinations = after(DESTINATION_FLAGS)
  const grepSkip = patterns.length > 0 || args.some(arg => isFlag(FILE_FLAGS, arg)) ? patterns : positional.slice(0, 1)
  const copySkip = destinations.length > 0 ? destinations : positional.slice(-1)
  const skipped = new Set([
    ...(GREPS.has(name) ? grepSkip : []),
    ...(COPIERS.has(name) && positional.length > 1 ? copySkip : []),
  ])

  return args.filter((_, i) => !skipped.has(i))
}

/** Words of one simple command that may name a file it reads. */
function readTargets(words: readonly string[], previous: readonly string[]): string[] {
  const prefix = words.slice(0, commandStart(words))
  // `xargs -a .env echo` reads its argument file, whatever it runs.
  const argFiles = prefix.some(word => commandName(word) === 'xargs')
    ? prefix.filter((word, i) => /^(-a|--arg-file)$/.test(prefix[i - 1] ?? '') || word.startsWith('--arg-file='))
    : []
  const at = readerAt(words)
  if (at === -1) return argFiles
  const before = words.slice(0, at)
  const args = readArgs(commandName(words[at] ?? ''), words.slice(at + 1))
  // `find . -name .env -exec cat {} +` and `... | xargs cat` read what came before.
  const isExec = before.some(word => EXEC_FLAGS.has(word))
  const isXargs = before.some(word => commandName(word) === 'xargs')

  return [...argFiles, ...args, ...(isExec ? before : []), ...(isXargs ? previous : [])]
}

/** A reader whose argument is the call that follows: `Get-Content (Join-Path ...)`, `[IO.File]::ReadAllText('.env')`. */
function readsCall(segment: Segment | undefined): boolean {
  if (segment?.call !== true) return false
  const last = segment.words.at(-1) ?? ''
  const at = readerAt(segment.words)
  if (/io\.file\]::(read|open|copy|move)/i.test(last)) return true

  return at !== -1 && (at === segment.words.length - 1 || (last.startsWith('-') && !isFlag(PATTERN_FLAGS, last)))
}

// Pieces of a word that may be a path: `open('.env')`, `--env-file=.env`, `-F f=@id_rsa`, `{a,.env}`; `${HOME}` stays whole.
const pieces = (word: string) => word.match(/(?:\$\{[^}]*\}|[^\s"'`()[\]{},;=@<>|&])+/g) ?? []

/** The first secret-looking path a shell command reads, as written; undefined if none. */
export function shellSecret(command: string, rules: Rules, escape = '\\', depth = 0): string | undefined {
  const segments = parse(command, escape)

  for (const [index, segment] of segments.entries()) {
    const { words, inputs, nested } = segment
    const previous = segments[index - 1]
    const targets = [...inputs, ...readTargets(words, previous?.words ?? []), ...(readsCall(previous) ? words : [])]
    const hit = targets.flatMap(pieces).find(piece => isSecretWord(piece, rules))
    if (hit !== undefined) return hit

    // Command lines a shell runs: `bash -c "cat .env"`, `cmd /c type .env`, `ssh host 'head .env'`, `echo "$(cat .env)"`.
    const program = words[commandStart(words)] ?? ''
    const lines = [
      ...words.flatMap((_, i) => (RUN_FLAGS.test(words[i - 1] ?? '') ? [words.slice(i).join(' ')] : [])),
      ...(/\s/.test(program) ? [program] : []),
      ...nested,
    ]
    for (const line of depth < 3 ? lines : []) {
      const inner = shellSecret(line, rules, escape, depth + 1)
      if (inner !== undefined) return inner
    }
  }

  return undefined
}

/** The secret-looking path a tool call would touch, as written; undefined if none. */
export function findSecret(e: Readonly<Record<string, unknown>>, rules: Rules): string | undefined {
  const tool = String(e.tool)
  const text = (key: string) => {
    const value = e[key]
    return typeof value === 'string' ? value : undefined
  }

  const escape = SHELL_ESCAPES.get(tool)
  if (escape !== undefined) {
    // A Monitor on a WebSocket has no command and reads no file.
    const command = text('command')
    return command === undefined ? undefined : shellSecret(command, rules, escape)
  }

  return (FILE_FIELDS.get(tool) ?? []).map(text).find(path => path !== undefined && isSecretWord(path, rules))
}
