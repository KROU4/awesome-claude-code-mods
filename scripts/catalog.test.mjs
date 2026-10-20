import { test } from 'node:test'
import assert from 'node:assert/strict'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  splitTopLevel, parseValidateReport, slotsFromCalls, slotsFromRenderHooks, capabilitiesFromAnalysis, riskOf, hookBase,
} from './lib/analysis.mjs'
import {
  installFor, installTarget, sourceUrlFor, entryUrlFor, editUrlFor, resolveMedia, deriveSlots, deriveCapabilities,
  toRegistryMod, sortMods, checkPluginName, githubRepoOfUrl, loadEntries,
} from './lib/catalog.mjs'
import { drawsOn, SURFACES_BY_SLOT, SLOTS } from './lib/surfaces.mjs'
import { checkEntry, formatSchemaErrors, schemaValidator } from './lib/entry.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

// A real report of `claude plugin validate --json` (2.1.302) for a mod like tool-timeline.
const REPORT = {
  success: true,
  manifest: {
    errors: [],
    warnings: [],
    notes: ['types ./types/index.d.ts declares on $: nothing (no EngineInterface member)', 'types ./types/index.d.ts declares state: tool-timeline.calls, tool-timeline.dismissed'],
    gatingHooks: [],
  },
  contents: [
    {
      type: 'hooks',
      errors: [],
      warnings: [],
      notes: [
        './register.tsx hooks: session.start, command.run{command=timeline}, ui.close{id=timeline}, ui.render{component=AbovePrompt}, tool.call, classic.PreToolUse, ui.render{component=Pane, requestId=timeline}',
        './register.tsx hooks on classic.PreToolUse do not run in a plugin a person installs where an organization manages Claude Code: there, these events pass over the plugins you install',
        './register.tsx answers its own command: command.run{command=timeline}',
        './register.tsx gating hook with .catch: tool.call',
        './register.tsx calls: $.clock.every (via tick, start), $.clock.now, $.command.register, $.session.cwd, $.state.get, $.ui.invalidate, $.ui.open, $.process.run (via git)',
        './register.tsx state writes: tool-timeline.calls, tool-timeline.dismissed',
        './register.tsx state reads: tool-timeline.calls',
      ],
      gatingHooks: [
        { module: './register.tsx', pattern: 'tool.call', hook: 'tool.call', hasCatch: true },
        { module: './register.tsx', pattern: 'ui.close', hook: 'ui.close{id=timeline}', hasCatch: true },
      ],
    },
  ],
  advice: [],
}

test('splitTopLevel keeps braces and parentheses together', () => {
  assert.deepEqual(splitTopLevel('a, b{c=1, d=2}, e (via f, g), tool.call{tool=/"^(Edit|Write)$"/}'), [
    'a', 'b{c=1, d=2}', 'e (via f, g)', 'tool.call{tool=/"^(Edit|Write)$"/}',
  ])
})

test('parseValidateReport summarises hooks, calls, gating and state', () => {
  const a = parseValidateReport(REPORT, '2.1.302')
  assert.equal(a.ok, true)
  assert.deepEqual(a.hooks, [
    'session.start', 'command.run{command=timeline}', 'ui.close{id=timeline}', 'ui.render{component=AbovePrompt}',
    'tool.call', 'classic.PreToolUse', 'ui.render{component=Pane, requestId=timeline}',
  ])
  assert.deepEqual(a.calls, ['$.clock.every', '$.clock.now', '$.command.register', '$.process.run', '$.session.cwd', '$.state.get', '$.ui.invalidate', '$.ui.open'])
  assert.deepEqual(a.gating, [{ hook: 'tool.call', hasCatch: true }, { hook: 'ui.close{id=timeline}', hasCatch: true }])
  assert.deepEqual(a.stateKeys, ['tool-timeline.calls', 'tool-timeline.dismissed'])
  assert.equal(a.validatedWith, '2.1.302')
})

test('parseValidateReport: "calls: nothing on $", errors and a failed report', () => {
  const a = parseValidateReport({
    success: false,
    manifest: { errors: [{ path: 'name', message: 'bad name' }], warnings: ['w'], notes: [] },
    contents: [{ notes: ['./register.ts hooks: ui.render{component=Spinner}', './register.ts calls: nothing on $'] }],
  }, '2.1.302')
  assert.equal(a.ok, false)
  assert.deepEqual(a.calls, [])
  assert.deepEqual(a.errors, ['name: bad name'])
  assert.deepEqual(a.warnings, ['w'])
  assert.equal(hookBase('ui.render{component=Pane, requestId=x}'), 'ui.render')
})

test('slots from calls and from render hooks', () => {
  const a = parseValidateReport(REPORT, 'x')
  assert.deepEqual(slotsFromCalls(a), ['command', 'pane'])
  assert.deepEqual(slotsFromRenderHooks(a), ['above-prompt', 'pane'])
  assert.deepEqual(slotsFromCalls({ calls: ['$.ui.toast', '$.ui.status', '$.ui.notify', '$.tool.register'] }), ['toast', 'status', 'notification', 'model-tool'])
  assert.deepEqual(slotsFromRenderHooks({ hooks: ['ui.render{component=ToolUse}', 'ui.render{component=AssistantMessage}', 'ui.render{component=InfoNotice}'] }), ['tool-row', 'message', 'info-notice'])
})

test('capabilities from the analysis', () => {
  assert.deepEqual(capabilitiesFromAnalysis(parseValidateReport(REPORT, 'x')), {
    network: false, processes: true, filesystem: 'none', model: false, promptRewrite: false, blocksTools: true,
  })
  assert.deepEqual(capabilitiesFromAnalysis({
    calls: ['$.http.fetch', '$.fs.read', '$.model.complete'], hooks: ['prompt.submit'], gating: [],
  }), { network: true, processes: false, filesystem: 'read', model: true, promptRewrite: true, blocksTools: false })
  assert.equal(capabilitiesFromAnalysis({ calls: ['$.fs.list', '$.fs.write'], hooks: [], gating: [] }).filesystem, 'write')
  assert.equal(capabilitiesFromAnalysis({ calls: [], hooks: ['tool.check'], gating: [{ hook: 'tool.check', hasCatch: false }] }).blocksTools, true)
})

test('risk flags follow the admin guide lists', () => {
  assert.deepEqual(riskOf({ calls: ['$.fs.read', '$.ui.toast', '$.http.fetch'], hooks: ['tool.call', 'ui.render{component=Pane}', 'session.append'] }), {
    calls: ['$.fs.read', '$.http.fetch'], hooks: ['tool.call', 'session.append'],
  })
  assert.equal(riskOf(undefined), undefined)
})

test('drawsOn: every visible slot must draw there, plus declared surfaces', () => {
  assert.deepEqual(drawsOn(['spinner', 'pane']), ['terminal', 'desktop', 'vscode'])
  assert.deepEqual(drawsOn(['above-prompt', 'toast']), ['terminal', 'desktop'])
  assert.deepEqual(drawsOn(['turn-duration', 'pane']), ['terminal'])
  assert.deepEqual(drawsOn(['turn-duration'], ['desktop', 'mobile']), ['terminal', 'desktop'])
  assert.deepEqual(drawsOn(['background']), ['terminal', 'desktop', 'vscode'])
  assert.deepEqual(drawsOn(['tool-deny', 'prompt-rewrite']), ['terminal', 'desktop', 'vscode'])
  for (const slot of SLOTS) assert.ok(SURFACES_BY_SLOT[slot]?.includes('terminal'), slot)
})

const HOSTED = {
  name: 'turn-meter',
  title: 'Turn Meter',
  tagline: 'How long each turn took.',
  description: 'A band above the prompt after every turn.',
  author: { name: 'KROU4', github: 'KROU4' },
  maintainers: ['KROU4'],
  category: 'insights',
  license: 'MIT',
  source: { type: 'hosted' },
  surfaces: ['terminal', 'desktop'],
  preview: { elements: [{ slot: 'above-prompt', rows: [['x']] }, { slot: 'toast', text: 'Slow turn' }] },
  media: [{ type: 'image', src: 'media/band.png', alt: 'The band' }, { type: 'video', src: 'https://example.com/a.mp4', alt: 'Demo' }],
}

test('install lines and deep links for a hosted mod', () => {
  const i = installFor(HOSTED)
  assert.equal(i.pluginId, 'turn-meter@mod-showroom')
  assert.equal(i.marketplaceRepo, 'KROU4/claude-code-mod-showroom')
  assert.equal(i.terminal, '/plugin install turn-meter --marketplace KROU4/claude-code-mod-showroom')
  assert.equal(i.shell, 'claude plugin install turn-meter --marketplace KROU4/claude-code-mod-showroom')
  assert.equal(i.marketplaceAdd, '/plugin marketplace add KROU4/claude-code-mod-showroom')
  assert.equal(i.vscodeUrl, 'vscode://anthropic.claude-code/install-plugin?plugin=turn-meter&marketplace=KROU4%2Fclaude-code-mod-showroom')
  assert.equal(i.terminalUrl, 'claude-cli://open?q=%2Fplugin%20install%20turn-meter%20--marketplace%20KROU4%2Fclaude-code-mod-showroom')
  assert.equal(i.desktopPrompt,
    'Install the Claude Code mod "turn-meter" from the marketplace KROU4/claude-code-mod-showroom. Run in a shell: ' +
    '"${CLAUDE_CODE_EXECPATH:-claude}" plugin install turn-meter --marketplace KROU4/claude-code-mod-showroom — then tell me to start a new session so it loads.')
  assert.equal(decodeURIComponent(i.desktopUrl.replace('claude://code/new?q=', '')), i.desktopPrompt)
  assert.deepEqual(i.minVersion, { mods: '2.1.287', desktop: '2.1.286', terminal: '2.1.275', shell: '2.1.292', vscode: '2.1.299' })
})

test('install for a mod from another marketplace uses that marketplace', () => {
  const e = { ...HOSTED, name: 'mod-store', source: { type: 'marketplace', marketplace: 'hellosverre/mod-store', plugin: 'store' } }
  assert.deepEqual(installTarget(e), { plugin: 'store', repo: 'hellosverre/mod-store', pluginId: 'store' })
  assert.equal(installTarget(e, { 'hellosverre/mod-store': 'mod-store' }).pluginId, 'store@mod-store')
  assert.equal(installFor(e).terminal, '/plugin install store --marketplace hellosverre/mod-store')
})

test('source, entry and edit URLs', () => {
  assert.equal(sourceUrlFor(HOSTED), 'https://github.com/KROU4/claude-code-mod-showroom/tree/main/mods/turn-meter/plugin')
  assert.equal(sourceUrlFor({ name: 'x', source: { type: 'github', repo: 'a/b' } }), 'https://github.com/a/b/tree/HEAD')
  assert.equal(sourceUrlFor({ name: 'x', source: { type: 'github', repo: 'a/b', path: 'mods/x', ref: 'v1' } }), 'https://github.com/a/b/tree/v1/mods/x')
  const sha = 'a'.repeat(40)
  assert.equal(sourceUrlFor({ name: 'x', source: { type: 'github', repo: 'a/b', ref: 'v1', sha } }), `https://github.com/a/b/tree/${sha}`)
  assert.equal(sourceUrlFor({ name: 'x', source: { type: 'git', url: 'https://github.com/a/b.git', path: 'p' } }), 'https://github.com/a/b/tree/HEAD/p')
  assert.equal(sourceUrlFor({ name: 'x', source: { type: 'git', url: 'https://gitlab.com/a/b.git' } }), 'https://gitlab.com/a/b')
  assert.equal(sourceUrlFor({ name: 'x', source: { type: 'marketplace', marketplace: 'o/m', repo: 'o/code', path: 'x' } }), 'https://github.com/o/code/tree/HEAD/x')
  assert.equal(entryUrlFor('x'), 'https://github.com/KROU4/claude-code-mod-showroom/blob/main/mods/x/mod.json')
  assert.equal(editUrlFor('x'), 'https://github.com/KROU4/claude-code-mod-showroom/edit/main/mods/x/mod.json')
  assert.equal(githubRepoOfUrl('https://github.com/a/b.git'), 'a/b')
  assert.equal(githubRepoOfUrl('https://gitlab.com/a/b.git'), null)
})

test('media src resolves relative paths to raw.githubusercontent.com', () => {
  assert.deepEqual(resolveMedia(HOSTED).map(m => m.src), [
    'https://raw.githubusercontent.com/KROU4/claude-code-mod-showroom/main/mods/turn-meter/media/band.png',
    'https://example.com/a.mp4',
  ])
  assert.equal(resolveMedia({ name: 'x' }), undefined)
})

test('slots: preview first, then slots the calls prove; capabilities: analysis wins', () => {
  const analysis = { calls: ['$.command.register', '$.ui.toast'], hooks: ['ui.render{component=Spinner}'], gating: [] }
  assert.deepEqual(deriveSlots(HOSTED, analysis), ['above-prompt', 'toast', 'command'])
  assert.deepEqual(deriveSlots(HOSTED, undefined), ['above-prompt', 'toast'])
  const declared = { ...HOSTED, capabilities: { network: true, filesystem: 'write' } }
  assert.deepEqual(deriveCapabilities(declared, undefined), { network: true, filesystem: 'write' })
  assert.equal(deriveCapabilities(declared, analysis).network, false)
})

test('toRegistryMod puts derived fields after the entry, and stars only from enrichment', () => {
  const analysis = { ok: true, calls: ['$.ui.toast'], hooks: ['ui.render{component=AbovePrompt}'], gating: [], stateKeys: [], errors: [], warnings: [], validatedWith: '2.1.302' }
  const mod = toRegistryMod({ $schema: '../../schema/mod.schema.json', ...HOSTED }, {
    analysis,
    manifest: { version: '0.2.0' },
    dates: { addedAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-02T00:00:00Z' },
    github: { 'KROU4/claude-code-mod-showroom': { stars: 12 } },
  })
  assert.equal(mod.$schema, undefined)
  assert.equal(mod.version, '0.2.0')
  assert.equal(mod.hosted, true)
  assert.equal(mod.inMarketplace, true)
  assert.deepEqual(mod.slots, ['above-prompt', 'toast'])
  assert.deepEqual(mod.hookedSlots, ['above-prompt'])
  assert.deepEqual(mod.drawsOn, ['terminal', 'desktop'])
  assert.equal(mod.siteUrl, 'https://krou4.github.io/claude-code-mod-showroom/#/mod/turn-meter')
  assert.equal(mod.stars, 12)
  assert.equal(mod.pushedAt, undefined)
  assert.deepEqual(mod.risk, { calls: [], hooks: [] })
  const keys = Object.keys(mod)
  assert.ok(keys.indexOf('preview') < keys.indexOf('slots'))
})

test('sortMods: verified first, then newest, then name', () => {
  const mods = [
    { name: 'b', addedAt: '2026-10-02' },
    { name: 'a', addedAt: '2026-10-02' },
    { name: 'c', addedAt: '2026-10-05' },
    { name: 'z', verified: true },
    { name: 'd' },
  ]
  assert.deepEqual(sortMods(mods).map(m => m.name), ['z', 'c', 'a', 'b', 'd'])
})

test('plugin name rules match claude plugin validate', () => {
  assert.deepEqual(checkPluginName('turn-meter'), { errors: [], warnings: [] })
  for (const bad of ['claude-meter', 'anthropic-x', 'anthropics-x', 'cc-plugin-x', 'claude', 'claude-code', 'claude-mods', 'official-claude']) {
    assert.ok(checkPluginName(bad).errors.length, bad)
  }
  assert.equal(checkPluginName('mcp-for-claude').warnings.length, 1)
  assert.equal(checkPluginName('claudette').warnings.length, 0)
})

test('schema errors name the branch that matters', () => {
  const validate = schemaValidator(root)
  const bad = {
    ...HOSTED,
    source: { type: 'github' },
    preview: { elements: [{ slot: 'toast' }, { slot: 'band', rows: [] }, { slot: 'above-prompt', rows: [[{ text: 'x', colour: 'red' }]] }] },
  }
  assert.equal(validate(bad), false)
  const messages = formatSchemaErrors(validate.errors)
  assert.ok(messages.includes("/source must have required property 'repo'"), messages.join('\n'))
  assert.ok(messages.includes("/preview/elements/0 must have required property 'text'"), messages.join('\n'))
  assert.ok(messages.some(m => m.startsWith('/preview/elements/1/slot must be one of: above-prompt, pane')), messages.join('\n'))
  assert.ok(messages.includes('/preview/elements/2/rows/0/0 has an unknown field "colour"'), messages.join('\n'))
  assert.ok(!messages.some(m => /must be equal to constant/.test(m)), messages.join('\n'))
})

test('every entry in the catalog passes the structural checks', () => {
  const loaded = loadEntries(root)
  assert.ok(loaded.length > 0)
  for (const { name, entry, error } of loaded) {
    assert.equal(error, undefined, error)
    const { errors } = checkEntry(root, name, entry)
    assert.deepEqual(errors, [], `${name}: ${errors.join('; ')}`)
  }
})
