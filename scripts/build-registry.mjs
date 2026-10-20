// Builds registry.json, .claude-plugin/marketplace.json and the generated blocks of README.md
// (Russian) and README.en.md (English) from mods/*/mod.json plus the caches in data/.
// Usage: node scripts/build-registry.mjs [--check]   (--check: exit 1 when an output is stale)
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  loadEntries, readPluginManifest, readJsonIfExists, toRegistryMod, marketplaceNamesFrom, marketplaceNameClashes,
} from './lib/catalog.mjs'
import { checkEntry } from './lib/entry.mjs'
import { buildMarketplace } from './lib/marketplace.mjs'
import { buildRegistry, withGeneratedAt, toJson } from './lib/registry.mjs'
import { updateReadme } from './lib/readme.mjs'
import { gitDates, isMain } from './lib/cli.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const checkOnly = process.argv.includes('--check')

/** Loads everything the outputs need. Entries with errors are skipped with a notice. */
export function collect(rootDir) {
  const github = readJsonIfExists(join(rootDir, 'data', 'github.json'), {})
  const marketplaceNames = marketplaceNamesFrom(github)
  const items = []
  const skipped = []
  for (const { name, entry, error } of loadEntries(rootDir)) {
    if (error) {
      skipped.push(`${name}: ${error}`)
      continue
    }
    const { errors } = checkEntry(rootDir, name, entry)
    if (errors.length) {
      skipped.push(`${name}: ${errors[0]}${errors.length > 1 ? ` (+${errors.length - 1} more)` : ''}`)
      continue
    }
    const manifest = entry.source?.type === 'hosted' ? readPluginManifest(rootDir, name) : null
    const analysis = readJsonIfExists(join(rootDir, 'data', 'analysis', `${name}.json`), undefined)
    const dates = gitDates(rootDir, `mods/${name}/mod.json`)
    const mod = toRegistryMod(entry, { analysis, manifest, dates, github, marketplaceNames })
    items.push({ entry, mod, manifest })
  }
  const clashes = marketplaceNameClashes(items.map(i => i.entry), marketplaceNames)
  return { items, skipped, clashes }
}

function writeIfChanged(file, text, changed) {
  const before = existsSync(file) ? readFileSync(file, 'utf8') : null
  if (before === text) return
  changed.push(file)
  if (checkOnly) return
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, text)
}

function main() {
  const { items, skipped, clashes } = collect(root)
  for (const s of skipped) console.warn(`! skipped ${s}`)
  for (const c of clashes) console.warn(`! marketplaces ${c.repos.join(' and ')} share the name "${c.name}" (${c.mods.join(', ')})`)

  const changed = []
  const registryFile = join(root, 'registry.json')
  const previous = readJsonIfExists(registryFile, null)
  const registry = withGeneratedAt(buildRegistry(items.map(i => i.mod)), previous, new Date().toISOString())
  writeIfChanged(registryFile, toJson(registry), changed)

  writeIfChanged(join(root, '.claude-plugin', 'marketplace.json'), toJson(buildMarketplace(items)), changed)

  for (const [file, lang] of [['README.md', 'ru'], ['README.en.md', 'en']]) {
    const path = join(root, file)
    if (!existsSync(path)) {
      console.error(`✗ ${file} is missing`)
      process.exitCode = 1
      continue
    }
    try {
      writeIfChanged(path, updateReadme(readFileSync(path, 'utf8'), registry.mods, lang), changed)
    } catch (err) {
      console.error(`✗ ${file}: ${err.message}`)
      process.exitCode = 1
    }
  }

  const rel = changed.map(f => f.slice(root.length + 1).replace(/\\/g, '/'))
  if (checkOnly) {
    if (rel.length) {
      console.error(`✗ out of date: ${rel.join(', ')} (run npm run build:registry)`)
      process.exitCode = 1
    } else console.log('✓ registry, marketplace and README blocks are up to date')
  } else {
    console.log(`${registry.mods.length} mods · ${rel.length ? `updated ${rel.join(', ')}` : 'nothing changed'}`)
  }
}

if (isMain(import.meta.url)) main()
