import '@testing-library/jest-dom/vitest'
import { afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'

/**
 * Arranque de las pruebas: limpia el DOM entre casos e instala un
 * `matchMedia` simulable, porque jsdom no lo trae y `useTheme` lo necesita.
 */

type MediaQueryListener = (event: MediaQueryListEvent) => void

const listeners = new Map<string, Set<MediaQueryListener>>()
const matches = new Map<string, boolean>()

/**
 * Fija el resultado de una media query en las pruebas y avisa a quien la escuche.
 *
 * @param query Consulta exacta, por ejemplo `(prefers-color-scheme: dark)`.
 * @param value Valor que devolverá `matchMedia(query).matches`.
 */
export function setMediaQuery(query: string, value: boolean): void {
  matches.set(query, value)
  const event = { matches: value, media: query } as MediaQueryListEvent
  for (const listener of listeners.get(query) ?? []) listener(event)
}

window.matchMedia = vi.fn((query: string) => {
  const list: MediaQueryList = {
    matches: matches.get(query) ?? false,
    media: query,
    onchange: null,
    addEventListener: (_type: string, listener: EventListener) => {
      const set = listeners.get(query) ?? new Set()
      set.add(listener as MediaQueryListener)
      listeners.set(query, set)
    },
    removeEventListener: (_type: string, listener: EventListener) => {
      listeners.get(query)?.delete(listener as MediaQueryListener)
    },
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  }
  return list
}) as unknown as typeof window.matchMedia

afterEach(() => {
  cleanup()
  listeners.clear()
  matches.clear()
})
