import { useEffect } from 'react'

import { usePlatform } from '@/hooks/usePlatform'
import { isMacOS } from '@/lib/platform'
import { useAppStore } from '@/store'

/** Atajo declarado como tecla más modificador principal. */
export interface Shortcut {
  /** Tecla, comparada sin distinguir mayúsculas (`n`, `o`, `,`). */
  key: string
  /** Si exige ⌘ en macOS o Ctrl en Windows. */
  meta?: boolean
}

/**
 * Escucha un atajo mientras el componente está montado.
 *
 * @param shortcut Tecla y modificador del atajo.
 * @param handler Qué hacer al activarlo.
 */
export function useShortcut(shortcut: Shortcut, handler: () => void): void {
  const platform = usePlatform()

  useEffect(() => {
    const mac = isMacOS(platform)

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== shortcut.key.toLowerCase()) return
      if (shortcut.meta) {
        const pressed = mac ? event.metaKey : event.ctrlKey
        if (!pressed) return
      }
      event.preventDefault()
      handler()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [handler, platform, shortcut.key, shortcut.meta])
}

/**
 * Registra los atajos de la aplicación.
 *
 * `⌘N`/`Ctrl+N` abre Nuevo modelo (FR-002), `⌘O`/`Ctrl+O` abre Abrir modelo
 * (FR-012) y `⌘,`/`Ctrl+,` abre Ajustes, que es la tercera vía de FR-020.
 */
export function useAppShortcuts(): void {
  const openPreferences = useAppStore((state) => state.openPreferences)
  const openNewModel = useAppStore((state) => state.openNewModel)
  const openOpenModel = useAppStore((state) => state.openOpenModel)

  useShortcut({ key: 'n', meta: true }, openNewModel)
  useShortcut({ key: 'o', meta: true }, openOpenModel)
  useShortcut({ key: ',', meta: true }, openPreferences)
}
