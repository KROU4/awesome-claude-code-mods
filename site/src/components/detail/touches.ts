// "What it touches": the mod's hooks and calls (from `claude plugin validate`, summarised
// by CI into `analysis`) turned into plain sentences, each with the raw names beneath.
// Without an analysis, the declared capabilities and the drawn slots stand in.
import type { TKey, TVars } from '../../i18n'
import type { Capabilities, SiteMod, SiteRegistry, Slot } from '../../data/types'

export type TouchGroup = 'acts' | 'draws' | 'watches'

export type TouchRow = {
  id: string
  group: TouchGroup
  /** Plain sentence (i18n key), or literal text for declared capability labels. */
  key?: TKey
  vars?: TVars
  text?: { en: string; ru: string }
  /** Slots whose names fill `{list}` (declared rows). */
  slots?: Slot[]
  /** Hook and call names as the code has them. */
  raw: string[]
  /** Listed by the official admin guide as worth a reviewer's look. */
  risk: boolean
}

export type Touches = {
  source: 'analysis' | 'declared'
  rows: TouchRow[]
  validatedWith?: string
}

const RENDER_COMPONENT: Record<string, { id: string; key: TKey }> = {
  AbovePrompt: { id: 'draw-band', key: 'catalog.touch.drawBand' },
  Pane: { id: 'draw-pane', key: 'catalog.touch.drawPane' },
  Spinner: { id: 'draw-spinner', key: 'catalog.touch.drawSpinner' },
  PromptHint: { id: 'draw-hint', key: 'catalog.touch.drawHint' },
  SessionMode: { id: 'draw-mode', key: 'catalog.touch.drawMode' },
  TurnDuration: { id: 'draw-turn', key: 'catalog.touch.drawTurn' },
  ToolUse: { id: 'draw-tools', key: 'catalog.touch.drawTools' },
  ToolResult: { id: 'draw-tools', key: 'catalog.touch.drawTools' },
  ToolGroup: { id: 'draw-tools', key: 'catalog.touch.drawTools' },
  ToolProgress: { id: 'draw-tools', key: 'catalog.touch.drawTools' },
  UserMessage: { id: 'draw-messages', key: 'catalog.touch.drawMessages' },
  AssistantMessage: { id: 'draw-messages', key: 'catalog.touch.drawMessages' },
  CommandOutput: { id: 'draw-command-output', key: 'catalog.touch.drawCommandOutput' },
  AskUserQuestion: { id: 'draw-ask', key: 'catalog.touch.drawAsk' },
  InfoNotice: { id: 'draw-info', key: 'catalog.touch.drawInfo' },
}

type Rule = { id: string; group: TouchGroup; key: TKey; test: (name: string) => boolean }

/** Calls ($.noun.verb), in the order they are listed. */
const CALL_RULES: Rule[] = [
  { id: 'processes', group: 'acts', key: 'catalog.touch.processes', test: (c) => c.startsWith('$.process.') },
  { id: 'fs-write', group: 'acts', key: 'catalog.touch.fsWrite', test: (c) => c.startsWith('$.fs.write') },
  { id: 'fs-read', group: 'acts', key: 'catalog.touch.fsRead', test: (c) => c.startsWith('$.fs.') },
  { id: 'network', group: 'acts', key: 'catalog.touch.network', test: (c) => c.startsWith('$.http.') },
  { id: 'model', group: 'acts', key: 'catalog.touch.model', test: (c) => c.startsWith('$.model.') },
  { id: 'prompt-send', group: 'acts', key: 'catalog.touch.promptSend', test: (c) => c === '$.prompt.submit' },
  { id: 'session-send', group: 'acts', key: 'catalog.touch.sessionSend', test: (c) => c === '$.session.send' || c === '$.session.append' },
  { id: 'mcp', group: 'acts', key: 'catalog.touch.mcp', test: (c) => c.startsWith('$.mcp.') },
  { id: 'env-set', group: 'acts', key: 'catalog.touch.envSet', test: (c) => c === '$.env.set' },
  { id: 'env', group: 'acts', key: 'catalog.touch.env', test: (c) => c.startsWith('$.env.') },
  { id: 'settings', group: 'acts', key: 'catalog.touch.settings', test: (c) => c.startsWith('$.settings.') },
  { id: 'tool', group: 'acts', key: 'catalog.touch.tool', test: (c) => c === '$.tool.register' },
  { id: 'clipboard', group: 'acts', key: 'catalog.touch.clipboard', test: (c) => c === '$.ui.copy' },
  { id: 'audio', group: 'acts', key: 'catalog.touch.audio', test: (c) => c.startsWith('$.audio.') },
  { id: 'draw-pane', group: 'draws', key: 'catalog.touch.drawPane', test: (c) => c === '$.ui.open' },
  { id: 'draw-toast', group: 'draws', key: 'catalog.touch.drawToast', test: (c) => c === '$.ui.toast' },
  { id: 'draw-status', group: 'draws', key: 'catalog.touch.drawStatus', test: (c) => c === '$.ui.status' },
  { id: 'draw-notify', group: 'draws', key: 'catalog.touch.drawNotify', test: (c) => c === '$.ui.notify' },
  { id: 'draw-log', group: 'draws', key: 'catalog.touch.drawLog', test: (c) => c === '$.ui.log' },
  { id: 'draw-prompt', group: 'draws', key: 'catalog.touch.drawPrompt', test: (c) => c === '$.prompt.fill' || c === '$.prompt.suggest' },
  { id: 'session-read', group: 'watches', key: 'catalog.touch.sessionRead', test: (c) => c === '$.session.messages' },
  { id: 'usage', group: 'watches', key: 'catalog.touch.usage', test: (c) => c === '$.session.usage' },
  { id: 'agents', group: 'watches', key: 'catalog.touch.agents', test: (c) => c.startsWith('$.agent.') },
  { id: 'config', group: 'watches', key: 'catalog.touch.config', test: (c) => c.startsWith('$.config.') },
  { id: 'store', group: 'watches', key: 'catalog.touch.store', test: (c) => c.startsWith('$.store.') },
  { id: 'state', group: 'watches', key: 'catalog.touch.state', test: (c) => c.startsWith('$.state.') },
]

/** Hooks (event names, details in braces stripped). */
const HOOK_RULES: Rule[] = [
  { id: 'prompt-submit', group: 'acts', key: 'catalog.touch.promptSubmit', test: (h) => h === 'prompt.submit' },
  { id: 'tools-check', group: 'acts', key: 'catalog.touch.toolsCheck', test: (h) => h === 'tool.check' },
  { id: 'prompt-context', group: 'acts', key: 'catalog.touch.promptContext', test: (h) => /^prompt\.(compose|context|section|attachment)$/.test(h) },
  { id: 'session-append', group: 'watches', key: 'catalog.touch.sessionAppend', test: (h) => h === 'session.append' },
  { id: 'usage', group: 'watches', key: 'catalog.touch.usage', test: (h) => h === 'session.measure' },
  { id: 'agents', group: 'watches', key: 'catalog.touch.agents', test: (h) => h.startsWith('agent.') },
  { id: 'config', group: 'watches', key: 'catalog.touch.config', test: (h) => h.startsWith('config.') },
  { id: 'lifecycle', group: 'watches', key: 'catalog.touch.lifecycle', test: (h) => /^(session\.(start|end|compact)|turn\.)/.test(h) },
]

const QUIET_CALL = (c: string) =>
  c.startsWith('$.clock.') ||
  c.startsWith('$.ui.') ||
  c.startsWith('$.session.') ||
  c.startsWith('$.command.') ||
  c.startsWith('$.prompt.') ||
  c.startsWith('$.tool.')

function baseHook(h: string): string {
  return h.replace(/\{.*$/, '').trim()
}

/** The analyzer's "via …" notes and the like: keep the name only. */
function cleanCall(c: string): string {
  return c.replace(/\s*\(.*$/, '').trim()
}

export function describeTouches(mod: SiteMod, registry: SiteRegistry): Touches {
  const a = mod.analysis
  if (!a) return declaredTouches(mod, registry)

  const riskCalls = new Set(mod.risk?.calls ?? [])
  const riskHooks = new Set(mod.risk?.hooks ?? [])
  const rows = new Map<string, TouchRow>()
  const add = (id: string, group: TouchGroup, key: TKey, raw: string, risk: boolean, vars?: TVars) => {
    const row = rows.get(id)
    if (row) {
      if (!row.raw.includes(raw)) row.raw.push(raw)
      row.risk ||= risk
      return
    }
    rows.set(id, { id, group, key, vars, raw: [raw], risk })
  }

  const blocks = mod.capabilities.blocksTools || a.gating.some((g) => g.hook === 'tool.call' || g.hook === 'tool.check')
  const commands: string[] = []
  const other: string[] = []
  const classic: string[] = []

  for (const h of a.hooks) {
    const base = baseHook(h)
    if (base === 'ui.render') {
      const comp = /component=(\w+)/.exec(h)?.[1]
      const r = comp ? RENDER_COMPONENT[comp] : undefined
      if (r) add(r.id, 'draws', r.key, `ui.render{${comp}}`, false)
      else other.push(h)
      continue
    }
    if (base === 'command.run' || base === 'command.describe') {
      const name = /command=([\w:.-]+)/.exec(h)?.[1]
      if (name && !commands.includes(`/${name}`)) commands.push(`/${name}`)
      add('commands', 'draws', 'catalog.touch.commandsAny', base, false)
      continue
    }
    if (base === 'tool.call') {
      add('tools', 'acts', blocks ? 'catalog.touch.toolsGuard' : 'catalog.touch.toolsWatch', 'tool.call', riskHooks.has('tool.call'))
      continue
    }
    if (base.startsWith('classic.')) {
      const ev = base.slice('classic.'.length)
      if (!classic.includes(ev)) classic.push(ev)
      continue
    }
    const rule = HOOK_RULES.find((r) => r.test(base))
    if (rule) add(rule.id, rule.group, rule.key, base, riskHooks.has(base))
    else if (!other.includes(base)) other.push(base)
  }

  for (const raw of a.calls) {
    const c = cleanCall(raw)
    if (!c.startsWith('$.')) continue
    if (c === '$.command.register') {
      add('commands', 'draws', 'catalog.touch.commandsAny', c, false)
      continue
    }
    const rule = CALL_RULES.find((r) => r.test(c))
    if (rule) add(rule.id, rule.group, rule.key, c, riskCalls.has(c))
    else if (!QUIET_CALL(c) && !other.includes(c)) other.push(c)
  }

  const cmd = rows.get('commands')
  if (cmd && commands.length) {
    cmd.key = 'catalog.touch.commands'
    cmd.vars = { list: commands.join(', ') }
  }
  if (classic.length) {
    rows.set('classic', {
      id: 'classic',
      group: 'watches',
      key: 'catalog.touch.classic',
      vars: { list: classic.join(', ') },
      raw: classic.map((e) => `classic.${e}`),
      risk: false,
    })
  }
  if (other.length) rows.set('other', { id: 'other', group: 'watches', key: 'catalog.touch.other', raw: other, risk: false })

  const order: TouchGroup[] = ['acts', 'draws', 'watches']
  const list = [...rows.values()].sort((x, y) => order.indexOf(x.group) - order.indexOf(y.group) || Number(y.risk) - Number(x.risk))
  return { source: 'analysis', rows: list, validatedWith: a.validatedWith }
}

const CAP_ORDER: (keyof Capabilities)[] = ['processes', 'filesystem', 'network', 'model', 'promptRewrite', 'blocksTools']

function declaredTouches(mod: SiteMod, registry: SiteRegistry): Touches {
  const rows: TouchRow[] = []
  const caps = mod.capabilities
  for (const k of CAP_ORDER) {
    const v = caps[k]
    if (!v || v === 'none') continue
    const label = registry.capabilityLabels?.[k]
    const raw = k === 'filesystem' ? `capabilities.filesystem: ${String(v)}` : `capabilities.${k}`
    if (label) rows.push({ id: k, group: 'acts', text: label, raw: [raw], risk: k !== 'blocksTools' && k !== 'promptRewrite' })
  }
  const slots = mod.slots.filter((s) => s !== 'background')
  if (slots.length) {
    rows.push({
      id: 'draws',
      group: 'draws',
      key: 'catalog.touch.declaredDraws',
      slots,
      raw: slots.map((s) => `slot: ${s}`),
      risk: false,
    })
  }
  return { source: 'declared', rows }
}
