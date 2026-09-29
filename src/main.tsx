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
import './styles/mascot.css'
import './styles/chat.css'
import App from './App'
import { view } from './board/view'
import { chat } from './chat/chatStore'
import { mascotStore } from './mascot/mascotStore'
import { mascotDebug } from './mascot/watch'
import { store } from './store/store'

// Para las pruebas automáticas y para revisar el estado a mano: abre la app con `?debug`.
if (import.meta.env.DEV || new URLSearchParams(location.search).has('debug')) {
  ;(window as unknown as { __posits: unknown }).__posits = { store, view, mascot: mascotStore, mascotDebug, chat }
  // `?debug&mascot=quiet` (o `off`, `on`) deja a la mascota en ese modo y ya presentada: así las pruebas no reciben saludos.
  const m = new URLSearchParams(location.search).get('mascot')
  if (m === 'on' || m === 'quiet' || m === 'off') {
    store.getState().setMascotMode(m)
    store.getState().markMascotMet()
  }
}

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
