import { describe, expect, it } from 'vitest'

import { WINDOWS_SYMBOLS, pathSeparator, shortcutLabel } from './platform'

import type { PlatformInfo } from './tauri/types'

/** Plataforma de macOS tal como la devuelve `platform_info`. */
const MACOS: PlatformInfo = {
  os: 'macos',
  modifierSymbols: { meta: '⌘', alt: '⌥', del: '⌫' },
}

/** Plataforma de Windows. */
const WINDOWS: PlatformInfo = { os: 'windows', modifierSymbols: WINDOWS_SYMBOLS }

describe('textos que cambian con el sistema', () => {
  it('el atajo se escribe pegado en macOS y con signo más en Windows', () => {
    expect(shortcutLabel(MACOS, 'N')).toBe('⌘N')
    expect(shortcutLabel(WINDOWS, 'N')).toBe('Ctrl+N')
  })

  it('la ruta que se muestra lleva el separador del sistema', () => {
    expect(pathSeparator(MACOS)).toBe('/')
    expect(pathSeparator(WINDOWS)).toBe('\\')
  })
})
