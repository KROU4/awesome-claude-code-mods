import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

const schemaDir = fileURLToPath(new URL('../schema', import.meta.url))

// GitHub Pages serves the site at https://krou4.github.io/claude-code-mod-showroom/
export default defineConfig({
  base: '/claude-code-mod-showroom/',
  plugins: [react()],
  resolve: {
    alias: { '@schema': schemaDir },
  },
  server: {
    fs: { allow: ['..'] },
  },
  build: {
    target: 'es2022',
    sourcemap: false,
  },
})
