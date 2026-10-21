// Module resolution for the site's unit tests (`npm test`): Node runs the .ts sources with its
// built-in type stripping, but the sources import without extensions the way Vite resolves them
// ("./shell", "../../lib/router"). This hook tries ".ts" and "/index.ts" for such relative
// imports. Registered by scripts/test-register.mjs; nothing here runs in the site itself.

export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context)
  } catch (err) {
    const relative = specifier.startsWith('./') || specifier.startsWith('../')
    const [path, query = ''] = specifier.split('?')
    if (!relative || err?.code !== 'ERR_MODULE_NOT_FOUND' || /\.[cm]?[jt]sx?$|\.json$/.test(path)) throw err
    for (const suffix of ['.ts', '/index.ts']) {
      try {
        return await nextResolve(`${path}${suffix}${query ? `?${query}` : ''}`, context)
      } catch {
        // try the next form
      }
    }
    throw err
  }
}
