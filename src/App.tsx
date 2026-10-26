import { AnimatePresence, MotionConfig } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'

import { ChooseFolderDialog } from '@/components/features/choose-folder/ChooseFolderDialog'
import { ConfirmCloseDialog } from '@/components/features/editor/ConfirmCloseDialog'
import { EditorScreen } from '@/components/features/editor/EditorScreen'
import { RenameModelDialog } from '@/components/features/editor/RenameModelDialog'
import { StaleFileDialog } from '@/components/features/editor/StaleFileDialog'
import { NewModelDialog } from '@/components/features/new-model/NewModelDialog'
import { FileErrorDialog } from '@/components/features/open-model/FileErrorDialog'
import { OpenModelDialog } from '@/components/features/open-model/OpenModelDialog'
import { PreferencesWindow } from '@/components/features/preferences/PreferencesWindow'
import { SplashScreen } from '@/components/features/splash/SplashScreen'
import { RecentNotFoundDialog } from '@/components/features/welcome/RecentNotFoundDialog'
import { TrashConfirmDialog } from '@/components/features/welcome/TrashConfirmDialog'
import { WelcomeScreen } from '@/components/features/welcome/WelcomeScreen'
import { AppShell } from '@/components/layout/AppShell'
import { Toast } from '@/components/ui/Toast'
import { ScrollRegion } from '@/components/layout/ScrollRegion'
import { useContextMenuGuard } from '@/hooks/useContextMenuGuard'
import { useAppShortcuts } from '@/hooks/useShortcut'
import { useTheme } from '@/hooks/useTheme'
import { SCREEN_EXIT_MS } from '@/lib/motion'
import { measureStartupReady, windowApplyMode, windowSetCloseGuard } from '@/lib/tauri/commands'
import { onCloseRequested, onMenuAction, onPreferencesOpen } from '@/lib/tauri/events'
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
 * Con `last-model` la aplicación abre ese archivo por su cuenta; si ya no se
 * puede leer o no es un modelo válido, el aviso lo dice y la pantalla se queda
 * en la Bienvenida, con la preferencia intacta.
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
 * Si el sistema pide menos movimiento.
 *
 * Se consulta en cada cambio en vez de guardarse: el ajuste se puede cambiar
 * con la aplicación abierta y el siguiente cambio de pantalla ya lo respeta.
 */
function prefersReducedMotion(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
}

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
  const isDirty = useAppStore((state) => state.isDirty)
  const requestQuit = useAppStore((state) => state.requestQuit)
  const preferences = useAppStore((state) => state.preferences)
  const openModel = useAppStore((state) => state.openModel)
  const requestIntent = useAppStore((state) => state.requestIntent)
  const requestClose = useAppStore((state) => state.requestClose)
  const saveModel = useAppStore((state) => state.saveModel)

  // El suelo se cuenta desde que la página empezó a cargar, no desde que monta
  // React: las preferencias pueden llegar antes del primer fotograma, y con un
  // suelo contado desde el montaje la pantalla de carga no se vería nunca.
  const [minElapsed, setMinElapsed] = useState(() => performance.now() >= SPLASH_MIN_MS)
  // Se recuerda para que la medida de SC-001 diga qué se midió.
  const [splashShown] = useState(() => performance.now() < SPLASH_MIN_MS)

  useTheme()
  useAppShortcuts()
  useContextMenuGuard()

  useEffect(() => onPreferencesOpen(openPreferences), [openPreferences])

  // El guardia del cierre vive en Rust y aquí solo se mantiene al día: con
  // cambios sin guardar, cerrar la ventana pregunta antes de salir (FR-028).
  useEffect(() => {
    void windowSetCloseGuard(isDirty).catch(() => undefined)
  }, [isDirty])

  useEffect(() => onCloseRequested(requestQuit), [requestQuit])

  // El menú Archivo del sistema comparte las acciones con los atajos: la
  // interfaz no tiene menús contextuales del navegador, así que este es el
  // sitio donde se encuentran crear, abrir, guardar y cerrar.
  useEffect(
    () =>
      onMenuAction((action) => {
        if (action === 'archivo://nuevo-modelo') requestIntent('new-model')
        else if (action === 'archivo://abrir-modelo') requestIntent('open-model')
        else if (screen !== 'editor') return
        else if (action === 'archivo://guardar') void saveModel()
        else requestClose()
      }),
    [requestClose, requestIntent, saveModel, screen],
  )

  // Cada pantalla tiene su ventana: la Bienvenida sale centrada con sus
  // 820 × 580 y el Editor, que es la zona de trabajo, llena el monitor
  // (RS-01). Por eso la geometría recordada ya no se restaura: la posición y
  // el tamaño los decide la pantalla, no la sesión anterior.
  //
  // El cambio va coordinado con el de la pantalla: primero se va la que está,
  // y solo entonces la ventana empieza su camino, a la vez que entra la que
  // llega. Estirar o encoger una pantalla a la vista la deforma mientras se
  // recoloca, que es justo lo que se quiere evitar. El primer ajuste del
  // arranque no se anima: no hay de dónde venir.
  const firstMode = useRef(true)
  useEffect(() => {
    const target = screen === 'editor' ? 'editor' : 'welcome'
    const animate = !firstMode.current && !prefersReducedMotion()
    firstMode.current = false

    const timer = window.setTimeout(
      () => {
        void windowApplyMode(target, animate).catch(() => undefined)
      },
      animate ? SCREEN_EXIT_MS : 0,
    )
    return () => window.clearTimeout(timer)
  }, [screen])

  // El modelo recordado se abre una sola vez, cuando las preferencias ya están
  // cargadas: después manda `screen`, que es lo que mueven crear, abrir y
  // cerrar (FR-006 del Incremento 0).
  const startupOpened = useRef(false)
  useEffect(() => {
    if (!isLoaded || startupOpened.current) return
    startupOpened.current = true
    const path = preferences.lastModelPath
    if (path === null || resolveStartupScreen(preferences) !== 'last-model') return
    void openModel(path)
  }, [isLoaded, openModel, preferences])

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
      <AppShell showTitlebar={screen !== 'editor'}>
        <AnimatePresence mode="wait" initial={false}>
          {isReady ? (
            <ScrollRegion key={screen} label="Contenido de la pantalla">
              {screen === 'editor' ? <EditorScreen /> : <WelcomeScreen />}
            </ScrollRegion>
          ) : (
            <SplashScreen key="splash" />
          )}
        </AnimatePresence>
        {notice ? <Toast title={notice} onDismiss={dismissNotice} /> : null}
        <NewModelDialog />
        <OpenModelDialog />
        <ChooseFolderDialog />
        <FileErrorDialog />
        <RenameModelDialog />
        <StaleFileDialog />
        <ConfirmCloseDialog />
        <RecentNotFoundDialog />
        <TrashConfirmDialog />
      </AppShell>
      <PreferencesWindow />
    </MotionConfig>
  )
}
