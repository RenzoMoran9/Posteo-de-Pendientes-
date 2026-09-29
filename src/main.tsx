import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/patrick-hand/latin-400.css'
import '@fontsource/caveat/latin-500.css'
import '@fontsource/caveat/latin-700.css'
import './styles/tokens.css'
import './styles/base.css'
import './styles/board.css'
import './styles/note.css'
import './styles/ui.css'
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
