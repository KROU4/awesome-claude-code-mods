// Predev/prebuild: publish a copy of the catalog next to the site, outside the JS bundle.
//
// 1. If the repository root has registry.json (written by scripts/build-registry.mjs), copy it.
// 2. Otherwise build it in memory with the repository's own generator (scripts/lib/*), writing
//    nothing outside the site.
// 3. If the generator is not there either (the site checked out alone), build a minimal registry
//    from mods/*/mod.json that matches schema/registry.d.ts.
//
// Output (each written only when its content changes):
// - site/public/registry.json: the whole catalog, minified. The app fetches it from the same
//   origin when the live copy on GitHub does not answer (src/lib/registry.tsx). Not committed.
// - site/src/data/registry.shell.json: the registry without mods and without dates (repo,
//   marketplace, categories, labels), bundled so the page can draw before the catalog arrives.
// MS_SNAPSHOT=entries skips registry.json (when it is older than the entries you are editing).

import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const siteDir = resolve(here, '..')
const repoRoot = resolve(siteDir, '..')
const outFile = join(siteDir, 'public', 'registry.json')
const shellFile = join(siteDir, 'src', 'data', 'registry.shell.json')
/** Written by older versions of this script; removed so it cannot be bundled by mistake. */
const legacyFile = join(siteDir, 'src', 'data', 'registry.snapshot.json')

const OWNER = 'KROU4'
const REPO = 'claude-code-mod-showroom'
const BRANCH = 'main'
const MARKETPLACE_NAME = 'mod-showroom'
const MARKETPLACE_REPO = `${OWNER}/${REPO}`
const REPO_URL = `https://github.com/${MARKETPLACE_REPO}`
const PAGES_URL = `https://krou4.github.io/${REPO}/`

const MIN_VERSIONS = { mods: '2.1.287', desktop: '2.1.286', terminal: '2.1.275', shell: '2.1.292', vscode: '2.1.299' }

const CATEGORIES = [
  { id: 'interface', title: 'Interface', title_ru: 'Интерфейс' },
  { id: 'insights', title: 'Insights', title_ru: 'Сводки' },
  { id: 'safety', title: 'Safety', title_ru: 'Безопасность' },
  { id: 'productivity', title: 'Productivity', title_ru: 'Продуктивность' },
  { id: 'git', title: 'Git', title_ru: 'Git' },
  { id: 'integrations', title: 'Integrations', title_ru: 'Интеграции' },
  { id: 'fun', title: 'Fun', title_ru: 'Для настроения' },
  { id: 'accessibility', title: 'Accessibility', title_ru: 'Доступность' },
]

const ALL = ['terminal', 'desktop', 'vscode']
const TD = ['terminal', 'desktop']
const T = ['terminal']
const SURFACES_BY_SLOT = {
  'above-prompt': TD, pane: ALL, status: TD, toast: TD, notification: TD, command: TD,
  'tool-deny': ALL, 'prompt-rewrite': ALL, spinner: ALL, 'prompt-hint': TD, 'session-mode': TD,
  'turn-duration': T, 'tool-row': ALL, message: ALL, 'info-notice': T, 'model-tool': ALL, background: ALL,
}
const CAPABILITY_LABELS = {
  network: { en: 'uses the network', ru: 'ходит в сеть' },
  processes: { en: 'runs programs', ru: 'запускает программы' },
  filesystem: { en: 'reads or writes files', ru: 'читает или пишет файлы' },
  model: { en: 'calls the model', ru: 'обращается к модели' },
  promptRewrite: { en: 'can change prompts', ru: 'может менять промпты' },
  blocksTools: { en: 'can refuse tool calls', ru: 'может отклонять вызовы инструментов' },
}

/** Install commands and deep links, exactly as the site spec describes them. */
function installFor(plugin, marketplaceRepo, pluginId) {
  const terminal = `/plugin install ${plugin} --marketplace ${marketplaceRepo}`
  const shell = `claude plugin install ${plugin} --marketplace ${marketplaceRepo}`
  const desktopPrompt =
    `Install the Claude Code mod "${plugin}" from the marketplace ${marketplaceRepo}. ` +
    `Run in a shell: "\${CLAUDE_CODE_EXECPATH:-claude}" plugin install ${plugin} --marketplace ${marketplaceRepo}` +
    ` — then tell me to start a new session so it loads.`
  return {
    pluginId,
    marketplaceRepo,
    terminal,
    shell,
    marketplaceAdd: `/plugin marketplace add ${marketplaceRepo}`,
    vscodeUrl:
      `vscode://anthropic.claude-code/install-plugin?plugin=${encodeURIComponent(plugin)}` +
      `&marketplace=${encodeURIComponent(marketplaceRepo)}`,
    terminalUrl: `claude-cli://open?q=${encodeURIComponent(terminal)}`,
    desktopPrompt,
    desktopUrl: `claude://code/new?q=${encodeURIComponent(desktopPrompt)}`,
    minVersion: { ...MIN_VERSIONS },
  }
}

function sourceUrlOf(name, source) {
  switch (source.type) {
    case 'hosted':
      return `${REPO_URL}/tree/${BRANCH}/mods/${name}/plugin`
    case 'github':
      return `https://github.com/${source.repo}/tree/${source.sha || source.ref || 'HEAD'}${source.path ? `/${source.path}` : ''}`
    case 'git':
      return source.url.replace(/\.git$/, '')
    case 'marketplace':
      return `https://github.com/${source.repo || source.marketplace}${source.path ? `/tree/HEAD/${source.path}` : ''}`
    default:
      return REPO_URL
  }
}

function drawsOn(slots, declared = []) {
  const visible = slots.filter((s) => s !== 'background' && SURFACES_BY_SLOT[s])
  return ALL.filter((surface) => visible.every((s) => SURFACES_BY_SLOT[s].includes(surface)) || declared.includes(surface))
}

/** Fallback 3: a minimal registry straight from the entries. */
function buildMinimal() {
  const modsDir = join(repoRoot, 'mods')
  const names = existsSync(modsDir)
    ? readdirSync(modsDir).filter((n) => existsSync(join(modsDir, n, 'mod.json'))).sort()
    : []
  let newest = 0
  const mods = []
  for (const name of names) {
    const file = join(modsDir, name, 'mod.json')
    let entry
    try {
      entry = JSON.parse(readFileSync(file, 'utf8'))
    } catch (err) {
      console.warn(`[snapshot] skipped mods/${name}/mod.json: ${err.message}`)
      continue
    }
    newest = Math.max(newest, statSync(file).mtimeMs)
    delete entry.$schema
    const slots = [...new Set((entry.preview?.elements ?? []).map((e) => e.slot))]
    const external = entry.source.type === 'marketplace'
    const plugin = external ? entry.source.plugin || entry.name : entry.name
    const repo = external ? entry.source.marketplace : MARKETPLACE_REPO
    mods.push({
      ...entry,
      slots,
      drawsOn: drawsOn(slots, entry.surfaces),
      hosted: entry.source.type === 'hosted',
      inMarketplace: !external,
      install: installFor(plugin, repo, external ? plugin : `${plugin}@${MARKETPLACE_NAME}`),
      siteUrl: `${PAGES_URL}#/mod/${name}`,
      sourceUrl: sourceUrlOf(name, entry.source),
      entryUrl: `${REPO_URL}/blob/${BRANCH}/mods/${name}/mod.json`,
      editUrl: `${REPO_URL}/edit/${BRANCH}/mods/${name}/mod.json`,
      ...(entry.media
        ? {
            media: entry.media.map((m) => ({
              ...m,
              src: /^https:/.test(m.src) ? m.src : `https://raw.githubusercontent.com/${MARKETPLACE_REPO}/${BRANCH}/mods/${name}/${m.src}`,
            })),
          }
        : {}),
      capabilities: entry.capabilities ?? {},
    })
  }
  return {
    version: 1,
    generatedAt: new Date(newest || Date.now()).toISOString(),
    repo: { owner: OWNER, name: REPO, branch: BRANCH, url: REPO_URL, pagesUrl: PAGES_URL },
    marketplace: {
      name: MARKETPLACE_NAME,
      repo: MARKETPLACE_REPO,
      addCommand: `/plugin marketplace add ${MARKETPLACE_REPO}`,
      addShell: `claude plugin marketplace add ${MARKETPLACE_REPO}`,
    },
    categories: CATEGORIES.map((c) => ({ ...c, count: mods.filter((m) => m.category === c.id).length })),
    surfacesBySlot: SURFACES_BY_SLOT,
    capabilityLabels: CAPABILITY_LABELS,
    minVersions: { ...MIN_VERSIONS },
    mods,
  }
}

/** Fallback 2: the repository's own generator, in memory. */
async function buildWithGenerator() {
  const builder = join(repoRoot, 'scripts', 'build-registry.mjs')
  const lib = join(repoRoot, 'scripts', 'lib', 'registry.mjs')
  if (!existsSync(builder) || !existsSync(lib)) return null
  try {
    const { collect } = await import(pathToFileURL(builder).href)
    const { buildRegistry } = await import(pathToFileURL(lib).href)
    const { items, skipped } = collect(repoRoot)
    for (const s of skipped) console.warn(`[snapshot] skipped ${s}`)
    return { ...buildRegistry(items.map((i) => i.mod)), generatedAt: new Date().toISOString() }
  } catch (err) {
    console.warn(`[snapshot] generator failed (${err.message}); using the minimal builder`)
    return null
  }
}

async function main() {
  const registryFile = join(repoRoot, 'registry.json')
  let json
  let how
  const fromEntries = process.env.MS_SNAPSHOT === 'entries'
  if (existsSync(registryFile) && !fromEntries) {
    json = JSON.parse(readFileSync(registryFile, 'utf8'))
    how = 'copied registry.json'
  } else {
    json = await buildWithGenerator()
    if (json) how = `built ${json.mods.length} mods with scripts/build-registry.mjs (no registry.json yet)`
    else {
      json = buildMinimal()
      how = `built ${json.mods.length} mods from mods/*/mod.json (no registry.json, no generator)`
    }
  }
  const changed = writeIfChanged(outFile, JSON.stringify(json) + '\n')
  writeIfChanged(shellFile, JSON.stringify(shellOf(json), null, 2) + '\n')
  if (existsSync(legacyFile)) rmSync(legacyFile)
  const kb = Math.round(statSync(outFile).size / 1024)
  console.log(`[snapshot] ${how} → public/registry.json, ${kb} KB${changed ? '' : ' (unchanged)'}`)
}

/** Everything but the mods; no dates and no counts, so the bundled file rarely changes. */
function shellOf(registry) {
  const { mods: _mods, generatedAt: _at, categories, ...rest } = registry
  return {
    ...rest,
    generatedAt: '',
    categories: categories.map((c) => ({ ...c, count: 0 })),
    mods: [],
  }
}

function writeIfChanged(file, text) {
  mkdirSync(dirname(file), { recursive: true })
  const prev = existsSync(file) ? readFileSync(file, 'utf8') : ''
  if (prev === text) return false
  writeFileSync(file, text)
  return true
}

await main()
