import { AnimatePresence, MotionConfig } from 'framer-motion'
import { useEffect, useState } from 'react'

import { EditorScreen } from '@/components/features/editor/EditorScreen'
import { NewModelDialog } from '@/components/features/new-model/NewModelDialog'
import { PreferencesWindow } from '@/components/features/preferences/PreferencesWindow'
import { SplashScreen } from '@/components/features/splash/SplashScreen'
import { WelcomeScreen } from '@/components/features/welcome/WelcomeScreen'
import { AppShell } from '@/components/layout/AppShell'
import { Toast } from '@/components/ui/Toast'
import { ScrollRegion } from '@/components/layout/ScrollRegion'
import { useAppShortcuts } from '@/hooks/useShortcut'
import { useTheme } from '@/hooks/useTheme'
import { measureStartupReady } from '@/lib/tauri/commands'
import { onPreferencesOpen } from '@/lib/tauri/events'
import { windowApplySavedGeometry } from '@/lib/tauri/commands'
import { useAppStore } from '@/store'
import type { Preferences } from '@/lib/tauri/types'

/** Pantalla con la que arranca la aplicación. */
export type StartupScreen = 'welcome' | 'last-model'

/**
 * Decide qué se muestra al arrancar (FR-006).
 *
 * Con la casilla desmarcada y un modelo recordado se abre ese modelo; si no
 * hay ninguno, se muestra la Bienvenida **sin** cambiar la preferencia, para
 * que el usuario no pierda su elección por un archivo que ya no está.
 *
 * Mientras abrir un modelo no esté implementado, `last-model` acaba igual que
 * `welcome`: la decisión ya está aquí y quien la consume es la historia de
 * abrir, que lleva la pantalla a `'editor'` por su cuenta.
 *
 * @param preferences Preferencias cargadas al arrancar.
 */
export function resolveStartupScreen(preferences: Preferences): StartupScreen {
  if (preferences.showWelcomeOnStart) return 'welcome'
  return preferences.lastModelPath ? 'last-model' : 'welcome'
}

/** Tiempo mínimo que se ve la pantalla de carga, en milisegundos. */
const SPLASH_MIN_MS = 650

/**
 * Orquestador de la interfaz: aplica el tema, registra los atajos, conecta el
 * evento del menú nativo y restaura la geometría de la ventana.
 *
 * Mientras la carga no termina se muestra la pantalla de arranque; se
 * mantiene un mínimo de {@link SPLASH_MIN_MS} desde que la página empezó a
 * cargar, para que no parpadee cuando los comandos responden al instante, y
 * luego la Bienvenida entra con su animación (SC-001).
 */
export default function App() {
  const notice = useAppStore((state) => state.notice)
  const dismissNotice = useAppStore((state) => state.dismissNotice)
  const openPreferences = useAppStore((state) => state.openPreferences)
  const isLoaded = useAppStore((state) => state.isLoaded)
  const screen = useAppStore((state) => state.screen)

  // El suelo se cuenta desde que la página empezó a cargar, no desde que monta
  // React: las preferencias pueden llegar antes del primer fotograma, y con un
  // suelo contado desde el montaje la pantalla de carga no se vería nunca.
  const [minElapsed, setMinElapsed] = useState(() => performance.now() >= SPLASH_MIN_MS)
  // Se recuerda para que la medida de SC-001 diga qué se midió.
  const [splashShown] = useState(() => performance.now() < SPLASH_MIN_MS)

  useTheme()
  useAppShortcuts()

  useEffect(() => onPreferencesOpen(openPreferences), [openPreferences])

  useEffect(() => {
    void windowApplySavedGeometry().catch(() => undefined)
  }, [])

  useEffect(() => {
    if (minElapsed) return undefined
    const remaining = Math.max(0, SPLASH_MIN_MS - performance.now())
    const timer = window.setTimeout(() => setMinElapsed(true), remaining)
    return () => window.clearTimeout(timer)
  }, [minElapsed])

  const isReady = isLoaded && minElapsed

  useEffect(() => {
    if (!isReady) return undefined
    // Dos fotogramas: se informa cuando la Bienvenida ya está pintada, no
    // cuando se monta. El binario solo lo anota si se le pidió medir (SC-001).
    let second = 0
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => {
        void measureStartupReady(splashShown).catch(() => undefined)
      })
    })
    return () => {
      cancelAnimationFrame(first)
      cancelAnimationFrame(second)
    }
  }, [isReady, splashShown])

  return (
    <MotionConfig reducedMotion="user">
      <AppShell>
        <AnimatePresence mode="wait" initial={false}>
          {isReady ? (
            <ScrollRegion key="screen" label="Contenido de la pantalla">
              {/*
                `startup` solo decide la pantalla del arranque; a partir de ahí
                manda `screen`, que es lo que mueven crear, abrir y cerrar.
              */}
              {screen === 'editor' ? <EditorScreen /> : <WelcomeScreen />}
            </ScrollRegion>
          ) : (
            <SplashScreen key="splash" />
          )}
        </AnimatePresence>
        {notice ? <Toast title={notice} onDismiss={dismissNotice} /> : null}
        <NewModelDialog />
      </AppShell>
      <PreferencesWindow />
    </MotionConfig>
  )
}
