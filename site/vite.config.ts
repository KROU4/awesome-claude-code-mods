import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

const schemaDir = fileURLToPath(new URL('../schema', import.meta.url))
const BASE = '/claude-code-mod-showroom/'

/**
 * Preloads the headline font (Source Serif 4, Latin) so the hero H1 paints in it, and hands the
 * Cyrillic file's URL to index.html's early script (preloaded for Russian pages only).
 */
function preloadSerif(): Plugin {
  return {
    name: 'showroom:preload-serif',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        const files = Object.keys(ctx.bundle ?? {})
        const find = (subset: string) => files.find((f) => new RegExp(`source-serif-4-${subset}-opsz-normal[-.][^/]*[.]woff2$`).test(f))
        const latin = find('latin')
        const cyrillic = find('cyrillic')
        const out = cyrillic ? html.replace('__SERIF_CYRILLIC__', BASE + cyrillic) : html
        if (!latin) return out
        return {
          html: out,
          tags: [
            {
              tag: 'link',
              attrs: { rel: 'preload', as: 'font', type: 'font/woff2', crossorigin: '', href: BASE + latin },
              injectTo: 'head',
            },
          ],
        }
      },
    },
  }
}

// GitHub Pages serves the site at https://krou4.github.io/claude-code-mod-showroom/
export default defineConfig({
  base: BASE,
  plugins: [react(), preloadSerif()],
  resolve: {
    alias: { '@schema': schemaDir },
  },
  server: {
    fs: { allow: ['..'] },
  },
  build: {
    target: 'es2022',
    sourcemap: false,
    rolldownOptions: {
      output: {
        // React in its own chunk: it changes far less often than the app, so returning
        // visitors keep it cached across deploys. Everything else splits automatically
        // (detail sheet, submit + ajv, desktop / VS Code surfaces, motion features).
        codeSplitting: {
          groups: [{ name: 'react', test: /[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/ }],
        },
      },
    },
  },
})
