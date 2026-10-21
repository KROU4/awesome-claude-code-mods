import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { createHash } from 'node:crypto'
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

/**
 * A Content-Security-Policy <meta> (GitHub Pages sets no headers): scripts only from this site
 * plus the hash of each inline script left in the built index.html (theme and language bootstrap),
 * data only from this site and GitHub. 'unsafe-eval' stays because ajv, which checks entries in
 * the builder, compiles the schema with new Function; injected markup still cannot run script.
 * Runs last, after preloadSerif has filled in the inline script.
 */
function contentSecurityPolicy(): Plugin {
  return {
    name: 'showroom:csp',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        const hashes = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(
          (m) => `'sha256-${createHash('sha256').update(m[1], 'utf8').digest('base64')}'`,
        )
        const github = 'https://github.com https://*.githubusercontent.com'
        const policy = [
          "default-src 'self'",
          `script-src 'self' 'unsafe-eval' ${hashes.join(' ')}`.trim(),
          "style-src 'self' 'unsafe-inline'",
          `img-src 'self' data: ${github}`,
          `media-src 'self' ${github}`,
          "connect-src 'self' https://raw.githubusercontent.com",
          "font-src 'self' data:",
          "object-src 'none'",
          "base-uri 'self'",
          "form-action 'none'",
        ].join('; ')
        const meta = `<meta http-equiv="Content-Security-Policy" content="${policy}" />`
        // Right after <meta charset>: a policy covers only what comes after it.
        return html.replace(/(<meta charset="[^"]*"\s*\/?>)/i, `$1\n    ${meta}`)
      },
    },
  }
}

// GitHub Pages serves the site at https://krou4.github.io/claude-code-mod-showroom/
export default defineConfig({
  base: BASE,
  plugins: [react(), preloadSerif(), contentSecurityPolicy()],
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
