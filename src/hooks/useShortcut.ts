import { useEffect } from 'react'

import { usePlatform } from '@/hooks/usePlatform'
import { isMacOS } from '@/lib/platform'
import { useAppStore } from '@/store'

/** Atajo declarado como tecla más modificadores. */
export interface Shortcut {
  /** Tecla, comparada sin distinguir mayúsculas (`n`, `o`, `,`). */
  key: string
  /** Si exige ⌘ en macOS o Ctrl en Windows. */
  meta?: boolean
  /** Si exige ⇧; `false` exige que **no** esté pulsada. */
  shift?: boolean
}

/**
 * Escucha un atajo mientras el componente está montado.
 *
 * @param shortcut Tecla y modificadores del atajo.
 * @param handler Qué hacer al activarlo.
 * @param enabled Si el atajo está activo; los del Editor solo lo están allí.
 */
export function useShortcut(shortcut: Shortcut, handler: () => void, enabled = true): void {
  const platform = usePlatform()

  useEffect(() => {
    if (!enabled) return undefined
    const mac = isMacOS(platform)

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== shortcut.key.toLowerCase()) return
      if (shortcut.meta) {
        const pressed = mac ? event.metaKey : event.ctrlKey
        if (!pressed) return
      }
      if (shortcut.shift !== undefined && event.shiftKey !== shortcut.shift) return
      event.preventDefault()
      handler()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [enabled, handler, platform, shortcut.key, shortcut.meta, shortcut.shift])
}

/**
 * Registra los atajos de la aplicación.
 *
 * `⌘N`/`Ctrl+N` abre Nuevo modelo (FR-002), `⌘O`/`Ctrl+O` abre Abrir modelo
 * (FR-012) y `⌘,`/`Ctrl+,` abre Ajustes, que es la tercera vía de FR-020. Los
 * dos primeros pasan por la pregunta de los cambios sin guardar cuando hay un
 * modelo editado (FR-030).
 *
 * `⌘S`, `⌘W`, `⌘Z` y `⇧⌘Z` (`Ctrl+S`, `Ctrl+W`, `Ctrl+Z` y `Ctrl+Y`) solo
 * escuchan con el Editor delante, para que en la Bienvenida no hagan nada
 * (FR-021, FR-027, FR-044, RS-12).
 */
export function useAppShortcuts(): void {
  const openPreferences = useAppStore((state) => state.openPreferences)
  const requestIntent = useAppStore((state) => state.requestIntent)
  const requestClose = useAppStore((state) => state.requestClose)
  const saveModel = useAppStore((state) => state.saveModel)
  const undo = useAppStore((state) => state.undo)
  const redo = useAppStore((state) => state.redo)
  const screen = useAppStore((state) => state.screen)

  const inEditor = screen === 'editor'

  useShortcut({ key: 'n', meta: true }, () => requestIntent('new-model'))
  useShortcut({ key: 'o', meta: true }, () => requestIntent('open-model'))
  useShortcut({ key: ',', meta: true }, openPreferences)

  useShortcut({ key: 's', meta: true }, () => void saveModel(), inEditor)
  useShortcut({ key: 'w', meta: true }, requestClose, inEditor)
  useShortcut({ key: 'z', meta: true, shift: false }, undo, inEditor)
  useShortcut({ key: 'z', meta: true, shift: true }, redo, inEditor)
  // Windows usa Ctrl+Y para rehacer, además de Ctrl+⇧+Z (RS-12).
  useShortcut({ key: 'y', meta: true }, redo, inEditor)
}
