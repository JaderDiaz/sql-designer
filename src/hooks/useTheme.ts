import { useEffect } from 'react'

import { measureThemeApplied } from '@/lib/tauri/commands'
import { takeThemeChange } from '@/lib/measure'
import { useAppStore } from '@/store'
import type { EffectiveTheme } from '@/lib/tauri/types'

/** Consulta con la que el sistema anuncia su tema (FR-007). */
export const DARK_QUERY = '(prefers-color-scheme: dark)'

/**
 * Aplica el tema efectivo al documento y lo mantiene al día.
 *
 * Pasos: lee el tema del sistema al montar y se suscribe a sus cambios;
 * escribe `data-theme` en `<html>`, que es lo que leen los tokens de
 * `src/styles/tokens.css`; con la preferencia «Sistema» el cambio del sistema
 * se refleja sin reiniciar y sin desmontar la pantalla (FR-007, SC-003).
 *
 * @returns El tema que se está pintando.
 */
export function useTheme(): EffectiveTheme {
  const effectiveTheme = useAppStore((state) => state.effectiveTheme)
  const setSystemPrefersDark = useAppStore((state) => state.setSystemPrefersDark)

  useEffect(() => {
    const query = window.matchMedia(DARK_QUERY)
    setSystemPrefersDark(query.matches)

    const onChange = (event: MediaQueryListEvent) => setSystemPrefersDark(event.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [setSystemPrefersDark])

  useEffect(() => {
    document.documentElement.dataset['theme'] = effectiveTheme

    // Dos fotogramas: el primero aplica los tokens, el segundo ya está
    // pintado con ellos. Solo mide si el cambio vino de Ajustes (SC-003).
    let second = 0
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => {
        const elapsed = takeThemeChange()
        if (elapsed !== null) void measureThemeApplied(elapsed).catch(() => undefined)
      })
    })
    return () => {
      cancelAnimationFrame(first)
      cancelAnimationFrame(second)
    }
  }, [effectiveTheme])

  return effectiveTheme
}
