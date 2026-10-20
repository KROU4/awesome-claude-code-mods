// Merge one or more mod previews into a single mock session: the conversation (a scene or
// the preview's own transcript), the mods' transcript elements placed where they happen,
// and the "chrome" elements (band, pane, status, toast…) with the moment each arrives.
import type { CapturedTree, Row, Turn } from '../../data/types'
import { SCENES, formatElapsed, type Scene, type SceneName, type SceneTurn } from './scenes'
import type { MockModel, ModelChrome, ModelItem, PreviewInput } from './types'

const TREE_SLOT: Record<string, keyof ModelChrome | 'spinner'> = {
  AbovePrompt: 'bands',
  Pane: 'panes',
  PromptHint: 'hints',
  SessionMode: 'modes',
  Spinner: 'spinner',
}

function hash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return h >>> 0
}

const b = (text: string) => ({ text, bold: true })

/** A believable result line for a tool turn that has none. */
export function autoResult(tool: string, input: string): Row[] | undefined {
  const h = hash(tool + input)
  switch (tool) {
    case 'Read':
      return [['Read ', b(String(24 + (h % 170))), ' lines']]
    case 'Edit':
    case 'Update':
    case 'MultiEdit': {
      const add = 2 + (h % 28)
      const rem = h % 7
      return [['Updated ', b(input), ' with ', b(String(add)), ` addition${add === 1 ? '' : 's'}`, ...(rem ? [' and ', b(String(rem)), ` removal${rem === 1 ? '' : 's'}`] : [])]]
    }
    case 'Write':
      return [['Wrote ', b(String(12 + (h % 90))), ' lines to ', b(input)]]
    case 'Grep':
    case 'Search':
    case 'Glob':
      return [['Found ', b(String(2 + (h % 8))), ' files']]
    case 'Bash':
    case 'PowerShell':
      return [[{ text: '(No content)', dim: true }]]
    default:
      return undefined
  }
}

function fromSceneTurn(t: SceneTurn, id: string): ModelItem {
  if (t.role === 'user') return { kind: 'user', id, text: t.text }
  if (t.role === 'assistant') return { kind: 'assistant', id, text: t.text }
  const status = t.status ?? 'done'
  return {
    kind: 'tool',
    id,
    tool: t.tool,
    input: t.input,
    status,
    result: status === 'running' ? undefined : (t.result ?? autoResult(t.tool, t.input)),
  }
}

function fromTurn(t: Turn, id: string): ModelItem | null {
  if (t.role === 'user') return t.text ? { kind: 'user', id, text: t.text } : null
  if (t.role === 'assistant') return t.text ? { kind: 'assistant', id, text: t.text } : null
  const tool = t.tool ?? 'Tool'
  const input = t.input ?? ''
  const status = t.status ?? 'done'
  let result: Row[] | undefined
  if (status !== 'running') {
    result = t.result
      ? t.result.split('\n').map((line) => [status === 'error' ? { text: line, color: 'error' as const } : line])
      : autoResult(tool, input)
  }
  return { kind: 'tool', id, tool, input, status, result }
}

export type MergeOptions = {
  scene?: SceneName | Turn[]
}

export function mergePreviews(previews: readonly PreviewInput[], opts: MergeOptions = {}): MockModel {
  const sources = previews.map((p, i) => ({ id: p.id ?? `p${i}`, label: p.label ?? p.id ?? `mod ${i + 1}` }))

  // 1. The conversation behind the mods.
  let scene: Scene = SCENES.idle
  let custom: Turn[] | null = null
  if (opts.scene) {
    if (Array.isArray(opts.scene)) custom = opts.scene
    else scene = SCENES[opts.scene]
  } else {
    const withTranscript = previews.find((p) => p.transcript && p.transcript.length > 0)
    const withScene = previews.find((p) => p.scene)
    if (withTranscript?.transcript) custom = withTranscript.transcript
    else if (withScene?.scene) scene = SCENES[withScene.scene]
    else if (previews.length > 0) scene = SCENES.coding
  }
  if (custom) scene = { ...SCENES.coding, turns: [] }

  const base: ModelItem[] = custom
    ? custom.map((t, i) => fromTurn(t, `b${i}`)).filter((x): x is ModelItem => x !== null)
    : scene.turns.map((t, i) => fromSceneTurn(t, `b${i}`))

  // 2. Sort every element into the transcript or the chrome.
  const chrome: ModelChrome = {
    bands: [],
    panes: [],
    statuses: [],
    toasts: [],
    notifications: [],
    hints: [],
    modes: [],
    infoNotices: [],
    backgrounds: [],
  }
  const commands: ModelItem[] = []
  const inTurn: ModelItem[] = []
  const elements: MockModel['elements'] = []
  let spinner: MockModel['spinner'] = { verb: scene.verb }
  let spinnerSet = false
  let turnDuration: { text: string; source: string } | null = null
  let rewrite: Extract<ModelItem, { kind: 'rewrite' }> | null = null

  previews.forEach((p, pi) => {
    const source = sources[pi].id
    const trees = new Map<string, CapturedTree>()
    for (const tr of p.capturedTrees ?? []) {
      const key = TREE_SLOT[tr.component]
      if (key && !trees.has(`${key}:${tr.surface}`)) trees.set(`${key}:${tr.surface}`, tr)
    }
    const treeFor = (key: string) => trees.get(`${key}:terminal`) ?? [...trees.entries()].find(([k]) => k.startsWith(`${key}:`))?.[1]

    p.elements.forEach((el, ei) => {
      const id = `${source}:${ei}`
      elements.push({ id, source, slot: el.slot })
      switch (el.slot) {
        case 'command':
          commands.push({ kind: 'command', id, command: el.command, args: el.args, output: el.output, markdown: el.markdown, source })
          break
        case 'tool-deny':
          inTurn.push({
            kind: 'tool',
            id,
            tool: el.tool,
            input: el.input,
            status: 'error',
            deny: true,
            result: [[{ text: el.message, color: 'error' }]],
            source,
          })
          break
        case 'tool-row':
          inTurn.push({ kind: 'tool', id, tool: el.tool, input: el.input, status: 'done', row: el.row, result: el.result, source })
          break
        case 'model-tool':
          inTurn.push({ kind: 'tool', id, tool: el.name, input: el.input ?? '', status: 'done', result: el.result, modelTool: true, source })
          break
        case 'message':
          if (el.role === 'user') {
            const text = el.markdown ?? (el.rows ?? []).map((r) => r.map((s) => (typeof s === 'string' ? s : 'text' in s ? s.text : '')).join('')).join('\n')
            inTurn.push({ kind: 'user', id, text, source })
          } else if (el.role === 'assistant') inTurn.push({ kind: 'assistant', id, rows: el.rows, markdown: el.markdown, source })
          else inTurn.push({ kind: 'note', id, rows: el.rows, markdown: el.markdown, source })
          break
        case 'prompt-rewrite':
          if (!rewrite) rewrite = { kind: 'rewrite', id, before: el.before, after: el.after, source }
          break
        case 'spinner':
          if (!spinnerSet) {
            spinner = { verb: el.verb, glyphs: el.glyphs, color: el.color, source, tree: treeFor('spinner') }
            spinnerSet = true
          }
          break
        case 'turn-duration':
          if (!turnDuration) turnDuration = { text: el.text, source }
          break
        case 'above-prompt':
          chrome.bands.push({ id, source, slot: el.slot, rows: el.rows, tree: treeFor('bands') })
          break
        case 'pane':
          chrome.panes.push({ id, source, slot: el.slot, title: el.title, rows: el.rows, width: el.width ?? 'narrow', tree: treeFor('panes') })
          break
        case 'status':
          chrome.statuses.push({ id, source, slot: el.slot, text: el.text })
          break
        case 'toast':
          chrome.toasts.push({ id, source, slot: el.slot, text: el.text })
          break
        case 'notification':
          chrome.notifications.push({ id, source, slot: el.slot, title: el.title, text: el.text })
          break
        case 'prompt-hint':
          chrome.hints.push({ id, source, slot: el.slot, row: el.row, tree: treeFor('hints') })
          break
        case 'session-mode':
          chrome.modes.push({ id, source, slot: el.slot, row: el.row, tree: treeFor('modes') })
          break
        case 'info-notice':
          chrome.infoNotices.push({ id, source, slot: el.slot, row: el.row })
          break
        case 'background':
          chrome.backgrounds.push({ id, source, slot: el.slot, text: el.text })
          break
      }
    })
  })

  // 3. The work turn: a prompt rewrite replaces the first prompt; tool and message
  //    elements go after the last tool call (before a closing summary) or at the end.
  const turnItems = [...base]
  if (rewrite) {
    const r = rewrite as Extract<ModelItem, { kind: 'rewrite' }>
    const firstUser = turnItems.findIndex((it) => it.kind === 'user')
    if (firstUser >= 0) turnItems.splice(firstUser, 1, r)
    else turnItems.unshift(r)
  }
  if (inTurn.length) {
    const last = turnItems[turnItems.length - 1]
    const hasTool = turnItems.some((it) => it.kind === 'tool')
    const at = last && last.kind === 'assistant' && hasTool ? turnItems.length - 1 : turnItems.length
    turnItems.splice(at, 0, ...inTurn)
  }

  const lastTool = [...turnItems].reverse().find((it) => it.kind === 'tool')
  const finalPhase: MockModel['finalPhase'] =
    spinnerSet || (lastTool?.kind === 'tool' && lastTool.status === 'running')
      ? 'working'
      : turnItems.length === 0
        ? 'idle'
        : 'done'

  // 4. Order: commands typed while Claude works go first; otherwise after the turn.
  const items: ModelItem[] = []
  let turn: MockModel['turn'] = null
  if (finalPhase === 'working') {
    items.push(...commands)
    turn = { start: items.length, end: items.length + turnItems.length }
    items.push(...turnItems)
  } else {
    if (turnItems.length) {
      turn = { start: 0, end: turnItems.length }
      items.push(...turnItems)
      const td = turnDuration as { text: string; source: string } | null
      items.push({
        kind: 'turn-end',
        id: 'turn-end',
        text: td ? td.text : `${scene.pastVerb} for ${formatElapsed(scene.seconds)}`,
        source: td?.source,
      })
    }
    items.push(...commands)
  }

  // 5. Each mod's chrome arrives after its own last transcript element, else at the turn end.
  const anchors: MockModel['anchors'] = {}
  const lastOf = new Map<string, string>()
  for (const it of items) if ('source' in it && it.source && it.kind !== 'turn-end') lastOf.set(it.source, it.id)
  const fallback = finalPhase === 'done' ? 'turn-end' : 'end'
  const all = [
    ...chrome.bands,
    ...chrome.panes,
    ...chrome.statuses,
    ...chrome.toasts,
    ...chrome.notifications,
    ...chrome.hints,
    ...chrome.modes,
    ...chrome.backgrounds,
  ]
  for (const c of all) anchors[c.id] = lastOf.get(c.source) ?? fallback
  for (const c of chrome.infoNotices) anchors[c.id] = 'start'

  return {
    items,
    chrome,
    anchors,
    spinner,
    finalPhase,
    turn,
    seconds: scene.seconds || 12,
    tokens: scene.tokens || 1200,
    elements,
    sources,
  }
}
