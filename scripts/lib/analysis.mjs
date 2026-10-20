// Turns the report of `claude plugin validate --json <plugin>` into the `Analysis` summary
// (schema/registry.d.ts) and maps it to slots, capabilities and risk flags.
//
// The report carries `notes` lines such as
//   "./register.tsx hooks: session.start, tool.call, ui.render{component=AbovePrompt}"
//   "./register.tsx calls: $.clock.every (via startTicking), $.ui.toast"
//   "./register.tsx state writes: turn-meter.turns"
// and `gatingHooks: [{ module, pattern, hook, hasCatch }]` on the manifest and on each content file.

/** Splits "a, b{c, d}, e (via f, g)" at top-level commas only. */
export function splitTopLevel(text) {
  const parts = []
  let depth = 0
  let current = ''
  for (const ch of text) {
    if (ch === '{' || ch === '(' || ch === '[') depth++
    else if ((ch === '}' || ch === ')' || ch === ']') && depth > 0) depth--
    if (ch === ',' && depth === 0) {
      if (current.trim()) parts.push(current.trim())
      current = ''
      continue
    }
    current += ch
  }
  if (current.trim()) parts.push(current.trim())
  return parts
}

const uniq = list => [...new Set(list)]

function messageOf(problem) {
  if (typeof problem === 'string') return problem
  if (problem && typeof problem === 'object') {
    const where = problem.path || problem.field || problem.file
    const text = problem.message || problem.text || JSON.stringify(problem)
    return where ? `${where}: ${text}` : text
  }
  return String(problem)
}

/** Summarises a validate report. `validatedWith` is the Claude Code version that produced it. */
export function parseValidateReport(report, validatedWith) {
  const parts = [report?.manifest, ...(report?.contents || [])].filter(Boolean)
  const hooks = []
  const calls = []
  const stateKeys = []
  const gating = []
  const errors = []
  const warnings = []
  for (const part of parts) {
    for (const e of part.errors || []) errors.push(messageOf(e))
    for (const w of part.warnings || []) warnings.push(messageOf(w))
    for (const g of part.gatingHooks || []) {
      if (g && typeof g.hook === 'string') gating.push({ hook: g.hook, hasCatch: Boolean(g.hasCatch) })
    }
    for (const note of part.notes || []) {
      if (typeof note !== 'string') continue
      let m
      if ((m = /^\S+ hooks: (.+)$/.exec(note))) hooks.push(...splitTopLevel(m[1]))
      else if ((m = /^\S+ calls: (.+)$/.exec(note))) {
        if (m[1].trim() === 'nothing on $') continue
        for (const call of splitTopLevel(m[1])) calls.push(call.replace(/\s*\(via [^)]*\)\s*$/, '').trim())
      } else if ((m = /^\S+ state (?:writes|reads): (.+)$/.exec(note))) stateKeys.push(...splitTopLevel(m[1]))
      else if ((m = /^types \S+ declares state: (.+)$/.exec(note))) stateKeys.push(...splitTopLevel(m[1]))
    }
  }
  const seenGating = new Set()
  return {
    ok: report?.success === true && errors.length === 0,
    hooks: uniq(hooks),
    calls: uniq(calls).sort(),
    gating: gating.filter(g => {
      const key = `${g.hook}|${g.hasCatch}`
      if (seenGating.has(key)) return false
      seenGating.add(key)
      return true
    }),
    stateKeys: uniq(stateKeys).sort(),
    errors: uniq(errors),
    warnings: uniq(warnings),
    validatedWith,
  }
}

/** "ui.render{component=Pane, requestId=x}" -> "ui.render"; "tool.call" -> "tool.call". */
export const hookBase = hook => hook.replace(/\{.*$/s, '').trim()

const COMPONENT_SLOTS = {
  AbovePrompt: 'above-prompt',
  Pane: 'pane',
  Spinner: 'spinner',
  PromptHint: 'prompt-hint',
  SessionMode: 'session-mode',
  TurnDuration: 'turn-duration',
  ToolUse: 'tool-row',
  ToolResult: 'tool-row',
  ToolGroup: 'tool-row',
  UserMessage: 'message',
  AssistantMessage: 'message',
  CommandOutput: 'command',
  InfoNotice: 'info-notice',
}

const CALL_SLOTS = {
  '$.ui.toast': 'toast',
  '$.ui.status': 'status',
  '$.ui.notify': 'notification',
  '$.ui.open': 'pane',
  '$.command.register': 'command',
  '$.tool.register': 'model-tool',
}

/** Slots the code draws into by calling the API ($.ui.toast, $.ui.open, $.command.register...). */
export function slotsFromCalls(analysis) {
  if (!analysis) return []
  return uniq((analysis.calls || []).map(c => CALL_SLOTS[c]).filter(Boolean))
}

/**
 * Slots whose render site the code hooks (`ui.render{component=…}`). A render hook may draw there
 * or only watch and return the engine's own drawing, so these are "may draw", not proof.
 */
export function slotsFromRenderHooks(analysis) {
  if (!analysis) return []
  const slots = []
  for (const hook of analysis.hooks || []) {
    const m = /^ui\.render\{component=([A-Za-z]+)/.exec(hook)
    if (m && COMPONENT_SLOTS[m[1]]) slots.push(COMPONENT_SLOTS[m[1]])
  }
  return uniq(slots)
}

/** Every slot the analysis points at: calls and render hooks. */
export const slotsFromAnalysis = analysis => uniq([...slotsFromCalls(analysis), ...slotsFromRenderHooks(analysis)])

/** Calls the official admin guide asks reviewers to look for. */
export const RISKY_CALLS = [
  '$.fs.read', '$.fs.write', '$.process.run', '$.process.spawn', '$.http.fetch',
  '$.env.get', '$.env.set', '$.settings.read', '$.mcp.call', '$.model.complete',
  '$.prompt.submit', '$.session.send',
]
/** Hooks that see (and can change) every tool call, prompt or stored row. */
export const SENSITIVE_HOOKS = ['tool.call', 'prompt.submit', 'session.append', 'tool.check']

export function riskOf(analysis) {
  if (!analysis) return undefined
  return {
    calls: (analysis.calls || []).filter(c => RISKY_CALLS.includes(c)),
    hooks: uniq((analysis.hooks || []).map(hookBase).filter(h => SENSITIVE_HOOKS.includes(h))),
  }
}

const PROMPT_HOOKS = ['prompt.submit', 'prompt.compose', 'session.append']
const BLOCKING_HOOKS = ['tool.call', 'tool.check', 'classic.PreToolUse']

/** Capabilities the analysis proves. */
export function capabilitiesFromAnalysis(analysis) {
  const calls = analysis.calls || []
  const hooks = (analysis.hooks || []).map(hookBase)
  const gating = (analysis.gating || []).map(g => hookBase(g.hook))
  const fsWrite = calls.some(c => c.startsWith('$.fs.write'))
  const fsRead = calls.some(c => c.startsWith('$.fs.'))
  return {
    network: calls.some(c => c.startsWith('$.http.') || c.startsWith('$.net') || c === 'fetch'),
    processes: calls.some(c => c.startsWith('$.process.')),
    filesystem: fsWrite ? 'write' : fsRead ? 'read' : 'none',
    model: calls.some(c => c.startsWith('$.model.')),
    promptRewrite: hooks.some(h => PROMPT_HOOKS.includes(h)),
    blocksTools: gating.some(h => BLOCKING_HOOKS.includes(h)),
  }
}

/** Plain-language labels for the capability flags (the site and README use them). */
export const CAPABILITY_LABELS = {
  network: { en: 'uses the network', ru: 'ходит в сеть' },
  processes: { en: 'runs programs', ru: 'запускает программы' },
  filesystem: { en: 'reads or writes files', ru: 'читает или пишет файлы' },
  model: { en: 'calls the model', ru: 'обращается к модели' },
  promptRewrite: { en: 'can change prompts', ru: 'может менять промпты' },
  blocksTools: { en: 'can refuse tool calls', ru: 'может отклонять вызовы инструментов' },
}
