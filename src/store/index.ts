import { create } from 'zustand'

import { createBrowserSlice } from '@/store/browser'
import { createModelSlice } from '@/store/model'
import { createNavigationSlice } from '@/store/navigation'
import { createPreferencesSlice } from '@/store/preferences'
import type { AppState } from '@/store/types'

/**
 * Almacén único de la aplicación (principio IV de la constitución).
 *
 * Se compone de una parte por dominio de estado; los componentes leen siempre
 * por selectores y ninguno de `src/components/ui/` lo importa.
 */
export const useAppStore = create<AppState>()((...args) => ({
  ...createPreferencesSlice(...args),
  ...createNavigationSlice(...args),
  ...createModelSlice(...args),
  ...createBrowserSlice(...args),
}))
