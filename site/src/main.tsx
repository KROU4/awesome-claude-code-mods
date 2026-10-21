import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Self-hosted fonts with Cyrillic (no external requests).
import '@fontsource-variable/source-serif-4/opsz.css'
import '@fontsource-variable/onest/index.css'
import '@fontsource-variable/jetbrains-mono/index.css'
import './styles/fonts.css'
import './styles/tokens.css'
import './styles/base.css'
import './components/ui/ui.css'
import App from './App'
import Providers from './Providers'
import Boundary from './components/ui/Boundary'

/**
 * Shown when the page itself fails to render. Outside the providers (they may be what failed),
 * so the text is plain and in both languages.
 */
function PageFailed() {
  return (
    <main className="page-failed" role="alert">
      <h1>Something went wrong · Что-то пошло не так</h1>
      <p>The page could not be shown. Reload it, or open the start page. · Страницу не удалось показать. Обновите её или откройте начало.</p>
      <p className="page-failed-actions">
        <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>
          Reload · Обновить
        </button>
        <a
          className="btn btn-secondary"
          href="#/"
          onClick={(e) => {
            e.preventDefault()
            window.location.hash = '#/'
            window.location.reload()
          }}
        >
          Start page · Начало
        </a>
      </p>
    </main>
  )
}

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <Boundary fallback={<PageFailed />}>
      <Providers>
        <App />
      </Providers>
    </Boundary>
  </StrictMode>,
)
