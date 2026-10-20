// Checks mods/<name>/mod.json files against schema/mod.schema.json and the hosted-mod layout.
// Usage: node scripts/check-entry.mjs [name ...]   (no names: every entry)
// The full catalog check (with `claude plugin validate`, media and sources) is scripts/validate.mjs.
import { readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { listModNames } from './lib/catalog.mjs'
import { checkEntry } from './lib/entry.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const names = process.argv.slice(2).length ? process.argv.slice(2) : listModNames(root)

let failed = 0
for (const name of names) {
  const file = join(root, 'mods', name, 'mod.json')
  if (!existsSync(file)) {
    console.error(`✗ ${name}: mods/${name}/mod.json is missing`)
    failed++
    continue
  }
  let entry
  try {
    entry = JSON.parse(readFileSync(file, 'utf8'))
  } catch (err) {
    console.error(`✗ ${name}: mod.json is not valid JSON: ${err.message}`)
    failed++
    continue
  }
  const { errors, warnings } = checkEntry(root, name, entry)
  if (errors.length) {
    failed++
    console.error(`✗ ${name}\n  - ${errors.join('\n  - ')}`)
  } else {
    console.log(`✓ ${name}`)
  }
  for (const w of warnings) console.log(`  ! ${w}`)
}
process.exit(failed ? 1 : 0)
