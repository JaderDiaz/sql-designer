import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import App from '@/App'
import { DARK_QUERY } from '@/hooks/useTheme'
import { useAppStore } from '@/store'

import '@/styles/global.css'

/**
 * Punto de entrada de React.
 *
 * Pasos: fija el tema del sistema en `<html>` antes del primer fotograma para
 * que la pantalla de carga ya salga con el color correcto; monta la
 * aplicación enseguida, que muestra esa pantalla; y pide en paralelo
 * preferencias, identidad y plataforma (FR-007, SC-001).
 */
const container = document.getElementById('root')
if (!container) throw new Error('No se encontró el contenedor #root en index.html')

document.documentElement.dataset['theme'] = window.matchMedia(DARK_QUERY).matches ? 'dark' : 'light'

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

void useAppStore.getState().load()
