// `node --import ./scripts/test-register.mjs --test …`: lets the tests import the site's .ts
// sources without extensions (see test-hooks.mjs).
import { register } from 'node:module'

register('./test-hooks.mjs', import.meta.url)
