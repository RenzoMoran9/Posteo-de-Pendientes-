import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/kalam/latin-400.css'
import '@fontsource/kalam/latin-700.css'
import '@fontsource/permanent-marker/latin-400.css'
import '@fontsource/caveat/latin-400.css'
import '@fontsource/caveat/latin-700.css'
import '@fontsource/patrick-hand/latin-400.css'
import '@fontsource/architects-daughter/latin-400.css'
import '@fontsource/gochi-hand/latin-400.css'
import '@fontsource/covered-by-your-grace/latin-400.css'
import '@fontsource/just-another-hand/latin-400.css'
import './styles/tokens.css'
import './styles/base.css'
import './styles/board.css'
import './styles/note.css'
import './styles/lists.css'
import './styles/ui.css'
// después de ui.css: el panel y el botón de íconos ajustan piezas que ui.css define (.hand-box, .more-btn)
import './styles/icons.css'
import App from './App'
import { view } from './board/view'
import { store } from './store/store'

// Para las pruebas automáticas y para revisar el estado a mano: abre la app con `?debug`.
if (import.meta.env.DEV || new URLSearchParams(location.search).has('debug')) {
  ;(window as unknown as { __posits: unknown }).__posits = { store, view }
}

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
