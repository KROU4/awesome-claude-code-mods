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

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <Providers>
      <App />
    </Providers>
  </StrictMode>,
)
