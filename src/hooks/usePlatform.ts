import { usePreferencesStore } from '@/store/preferences'
import type { PlatformInfo } from '@/lib/tauri/types'

/**
 * Plataforma resuelta por el backend, para los textos y símbolos de atajo.
 *
 * @returns La plataforma del almacén; antes de cargar, la de Windows.
 */
export function usePlatform(): PlatformInfo {
  return usePreferencesStore((state) => state.platform)
}
