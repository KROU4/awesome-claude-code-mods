// Structural checks of one catalog entry: the JSON schema, folder name, plugin name rules and,
// for hosted mods, the plugin folder. Shared by scripts/check-entry.mjs and scripts/validate.mjs.
import { readFileSync, existsSync, statSync } from 'node:fs'
import { join, dirname, resolve, relative, sep } from 'node:path'
import Ajv2020 from 'ajv/dist/2020.js'
import { checkPluginName, inOurMarketplace } from './catalog.mjs'
import { MAX_FILE_BYTES } from './constants.mjs'

const compiled = new Map()

/** A git branch or tag name that cannot be read as a command-line option. */
export const SAFE_REF = /^(?!-)[A-Za-z0-9._/-]{1,200}$/

/** The compiled schema/mod.schema.json validator of a checkout (cached per root). */
export function schemaValidator(root) {
  if (!compiled.has(root)) {
    const schema = JSON.parse(readFileSync(join(root, 'schema', 'mod.schema.json'), 'utf8'))
    // verbose: oneOf errors then carry their branch list (`schema`), used to find a matching branch.
    compiled.set(root, new Ajv2020({ allErrors: true, strict: false, verbose: true }).compile(schema))
  }
  return compiled.get(root)
}

const DISCRIMINATOR = /\/properties\/(type|slot)\/const$/

/**
 * ajv reports every branch of a failed `oneOf`. Keep the branch that matters:
 * - a branch with no errors of its own matched; its nested errors (through $ref) explain the failure;
 * - else the branch whose `type`/`slot` matches the value, or the one with the fewest errors that
 *   is not a plain type mismatch;
 * - when no branch's `type`/`slot` matches, say which values are allowed and nothing else.
 */
export function pruneOneOfErrors(errors) {
  const seen = new Set()
  const unique = errors.filter(e => {
    const key = `${e.keyword}|${e.instancePath}|${e.schemaPath}|${e.message}|${JSON.stringify(e.params)}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
  const sites = unique
    .filter(e => e.keyword === 'oneOf')
    .map(e => ({ path: e.schemaPath, at: e.instancePath, count: Array.isArray(e.schema) ? e.schema.length : 0 }))
  let kept = unique.filter(e => e.keyword !== 'oneOf')
  const under = (e, at) => e.instancePath === at || e.instancePath.startsWith(`${at}/`)
  // schemaPath restarts at every $ref ("#/oneOf/1/..."), so an error belongs to the deepest
  // oneOf whose instance contains it and whose schema path prefixes it.
  const owner = new Map()
  for (const e of kept) {
    let best = null
    for (const s of sites) {
      if (e.schemaPath.startsWith(`${s.path}/`) && under(e, s.at) && (!best || s.at.length > best.at.length)) best = s
    }
    owner.set(e, best)
  }
  for (const site of sites) {
    const inSite = e => owner.get(e) === site
    const branchOf = e => Number(e.schemaPath.slice(site.path.length + 1).split('/')[0])
    const members = kept.filter(inSite)
    if (!members.length) continue
    const byBranch = new Map()
    for (const e of members) byBranch.set(branchOf(e), [...(byBranch.get(branchOf(e)) || []), e])
    const branches = [...byBranch.keys()]
    if (site.count > branches.length) {
      kept = kept.filter(e => !inSite(e))
      continue
    }
    const discriminatorWrong = k => byBranch.get(k).some(e => e.keyword === 'const' && DISCRIMINATOR.test(e.schemaPath))
    const typeWrong = k => byBranch.get(k).some(e => e.keyword === 'type' && e.instancePath === site.at)
    const hasDiscriminator = branches.some(discriminatorWrong)
    let candidates = branches.filter(k => !discriminatorWrong(k) && !typeWrong(k))
    if (!candidates.length && hasDiscriminator) {
      const consts = members.filter(e => e.keyword === 'const' && DISCRIMINATOR.test(e.schemaPath))
      const prop = DISCRIMINATOR.exec(consts[0].schemaPath)[1]
      const allowed = [...new Set(consts.map(e => e.params.allowedValue))]
      kept = kept.filter(e => !under(e, site.at))
      kept.push({ keyword: 'enum', instancePath: `${site.at}/${prop}`, schemaPath: site.path, params: { allowedValues: allowed }, message: '' })
      continue
    }
    if (!candidates.length) candidates = branches
    const best = candidates.sort((a, b) => byBranch.get(a).length - byBranch.get(b).length || a - b)[0]
    kept = kept.filter(e => !inSite(e) || branchOf(e) === best)
  }
  return kept
}

/** Readable messages for ajv errors; oneOf noise is collapsed to the branch that matters. */
export function formatSchemaErrors(errors = []) {
  const out = []
  for (const e of pruneOneOfErrors(errors)) {
    if (e.keyword === 'if') continue
    const where = e.instancePath || '(root)'
    let msg = e.message
    if (e.keyword === 'additionalProperties') msg = `has an unknown field "${e.params.additionalProperty}"`
    if (e.keyword === 'enum') msg = `must be one of: ${e.params.allowedValues.join(', ')}`
    if (e.keyword === 'const') msg = `must be ${JSON.stringify(e.params.allowedValue)}`
    out.push(`${where} ${msg}`)
  }
  if (!out.length && errors.length) out.push(`${errors[0].instancePath || '(root)'} ${errors[0].message}`)
  return [...new Set(out)]
}

function readJson(file) {
  try {
    return { value: JSON.parse(readFileSync(file, 'utf8')) }
  } catch (err) {
    return { error: err.message }
  }
}

/** True when `child` resolves inside `parent`. */
const isInside = (parent, child) => {
  const rel = relative(parent, child)
  return rel && !rel.startsWith('..') && !rel.startsWith(sep) && !/^[A-Za-z]:/.test(rel)
}

/**
 * Checks one entry. Returns { errors: string[], warnings: string[] }.
 * `entry` is the parsed mod.json, `name` the folder name.
 */
export function checkEntry(root, name, entry) {
  const errors = []
  const warnings = []
  const validate = schemaValidator(root)
  if (!validate(entry)) errors.push(...formatSchemaErrors(validate.errors))
  if (entry.name !== name) errors.push(`name "${entry.name}" must equal the folder name "${name}"`)

  const names = checkPluginName(entry.name ?? name)
  errors.push(...names.errors)
  // In our marketplace a warning would fail `claude plugin validate --strict`, so it is an error.
  if (inOurMarketplace(entry)) errors.push(...names.warnings)
  else warnings.push(...names.warnings)

  const s = entry.source || {}
  // `ref` reaches git's argv when CI clones the source: a branch or tag name, never an option.
  if ((s.type === 'github' || s.type === 'git') && s.ref !== undefined && !SAFE_REF.test(String(s.ref))) {
    errors.push('/source/ref must be a branch or tag name: letters, digits, ".", "_", "/" and "-", not starting with "-"')
  }
  if (entry.verified === true) {
    if ((s.type === 'github' || s.type === 'git') && !s.sha) errors.push('verified: true needs source.sha (the commit that was read)')
    if (s.type === 'marketplace') warnings.push('verified: true on a marketplace source cannot be pinned to a commit')
  }

  const modDir = join(root, 'mods', name)
  const pluginDir = join(modDir, 'plugin')
  if (entry.source?.type === 'hosted') {
    const manifestFile = join(pluginDir, '.claude-plugin', 'plugin.json')
    if (!existsSync(manifestFile)) errors.push('source.type is "hosted" but plugin/.claude-plugin/plugin.json is missing')
    else {
      const { value: pj, error } = readJson(manifestFile)
      if (error) errors.push(`plugin/.claude-plugin/plugin.json is not valid JSON: ${error}`)
      else {
        if (pj.name !== name) errors.push(`plugin.json name "${pj.name}" must equal "${name}"`)
        if (entry.version && pj.version && entry.version !== pj.version) {
          warnings.push(`mod.json version ${entry.version} differs from plugin.json version ${pj.version}; the marketplace uses plugin.json's`)
        }
      }
    }
    const hooksFile = join(pluginDir, 'hooks', 'hooks.json')
    if (!existsSync(hooksFile)) errors.push('plugin/hooks/hooks.json is missing (a mod lists its module there)')
    else {
      const { value: hooks, error } = readJson(hooksFile)
      if (error) errors.push(`plugin/hooks/hooks.json is not valid JSON: ${error}`)
      else if (!Array.isArray(hooks.modules) || hooks.modules.length !== 1 || typeof hooks.modules[0] !== 'string') {
        errors.push('plugin/hooks/hooks.json must have "modules": ["./<one module>"]')
      } else {
        const moduleFile = resolve(dirname(hooksFile), hooks.modules[0])
        if (!isInside(pluginDir, moduleFile)) errors.push(`the module ${hooks.modules[0]} must be inside plugin/`)
        else if (!existsSync(moduleFile)) errors.push(`the module ${hooks.modules[0]} named in hooks.json does not exist`)
      }
    }
  } else if (existsSync(pluginDir)) {
    warnings.push(`mods/${name}/plugin/ exists but source.type is "${entry.source?.type}", so nobody installs that code`)
  }

  for (const m of entry.media || []) {
    if (/^https:\/\//.test(m.src)) continue
    const file = resolve(modDir, m.src)
    if (!isInside(modDir, file)) errors.push(`media ${m.src} must stay inside mods/${name}/`)
    else if (!existsSync(file)) errors.push(`media ${m.src} does not exist`)
    else if (statSync(file).size > MAX_FILE_BYTES) errors.push(`media ${m.src} is over 2 MB`)
  }
  return { errors, warnings }
}
