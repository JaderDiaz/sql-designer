import { useEffect } from 'react'

import { usePreferencesStore } from '@/store/preferences'
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
  const effectiveTheme = usePreferencesStore((state) => state.effectiveTheme)
  const setSystemPrefersDark = usePreferencesStore((state) => state.setSystemPrefersDark)

  useEffect(() => {
    const query = window.matchMedia(DARK_QUERY)
    setSystemPrefersDark(query.matches)

    const onChange = (event: MediaQueryListEvent) => setSystemPrefersDark(event.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [setSystemPrefersDark])

  useEffect(() => {
    document.documentElement.dataset['theme'] = effectiveTheme
  }, [effectiveTheme])

  return effectiveTheme
}
