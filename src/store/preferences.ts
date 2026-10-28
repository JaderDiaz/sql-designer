import {
  CommandError,
  appIdentity,
  platformInfo,
  preferencesLoad,
  preferencesUpdate,
} from '@/lib/tauri/commands'
import { markThemeChange } from '@/lib/measure'
import { DEFAULT_PLATFORM } from '@/lib/platform'
import type {
  AppIdentity,
  EffectiveTheme,
  PlatformInfo,
  Preferences,
  RecoveredReason,
  ThemePreference,
} from '@/lib/tauri/types'
import type { AppSlice } from '@/store/types'

/**
 * Parte de preferencias del almacén único (principio IV de la constitución):
 * las preferencias cargadas, la identidad, la plataforma y el estado efímero
 * de Ajustes y los avisos. Se compone en `src/store/index.ts`; ningún
 * componente de `src/components/ui/` lo importa.
 */

/** Preferencias por defecto mientras el backend no ha respondido. */
export const DEFAULT_PREFERENCES: Preferences = {
  formatVersion: 1,
  theme: 'system',
  showWelcomeOnStart: true,
  window: null,
  lastModelPath: null,
  engine: 'postgres',
  lastFolder: null,
  sidebarHidden: false,
  inspectorHidden: false,
  snapToGrid: false,
  fieldsPanelHeight: 320,
}

/**
 * Resuelve el tema que se pinta a partir de la preferencia y del sistema.
 *
 * @param theme Preferencia elegida: `system`, `light` o `dark`.
 * @param systemPrefersDark Si el sistema operativo está en oscuro.
 */
export function resolveEffectiveTheme(
  theme: ThemePreference,
  systemPrefersDark: boolean,
): EffectiveTheme {
  if (theme === 'system') return systemPrefersDark ? 'dark' : 'light'
  return theme
}

/**
 * Mensaje visible para una recuperación de preferencias.
 *
 * @param reason Código que devolvió `preferences_load`.
 * @returns El aviso, o `null` cuando es un primer arranque sin archivo.
 */
export function loadErrorMessage(reason: RecoveredReason | null): string | null {
  switch (reason) {
    case null:
    case 'missing':
      return null
    case 'future_version':
      return 'Tus preferencias son de una versión más nueva de SQL Designer. La aplicación abrió con los valores por defecto y guardó una copia del archivo anterior.'
    default:
      return 'No se pudieron leer tus preferencias. La aplicación abrió con los valores por defecto y guardó una copia del archivo anterior.'
  }
}

/** Estado y acciones de la parte de preferencias. */
export interface PreferencesSlice {
  preferences: Preferences
  effectiveTheme: EffectiveTheme
  systemPrefersDark: boolean
  identity: AppIdentity | null
  platform: PlatformInfo
  isLoaded: boolean
  isPreferencesOpen: boolean
  loadError: string | null
  writeError: string | null
  notice: string | null
  load: () => Promise<void>
  setTheme: (theme: ThemePreference) => Promise<void>
  setShowWelcomeOnStart: (value: boolean) => Promise<void>
  setSnapToGrid: (value: boolean) => Promise<void>
  setSystemPrefersDark: (value: boolean) => void
  openPreferences: () => void
  closePreferences: () => void
  showNotice: (message: string) => void
  dismissNotice: () => void
}

/**
 * Crea la parte de preferencias del almacén.
 *
 * @param set Escritura del almacén compuesto.
 * @param get Lectura del almacén compuesto.
 */
export const createPreferencesSlice: AppSlice<PreferencesSlice> = (set, get) => ({
  preferences: DEFAULT_PREFERENCES,
  effectiveTheme: 'light',
  systemPrefersDark: false,
  identity: null,
  platform: DEFAULT_PLATFORM,
  isLoaded: false,
  isPreferencesOpen: false,
  loadError: null,
  writeError: null,
  notice: null,

  /**
   * Carga preferencias, identidad y plataforma antes del primer render útil,
   * de modo que el tema correcto se aplique sin parpadeo (FR-007).
   *
   * Pasos: pide los tres comandos a la vez; deja el aviso de `loadError` si
   * las preferencias llegaron por defecto tras un archivo dañado; y calcula el
   * tema efectivo con lo que diga el sistema.
   */
  async load() {
    try {
      const [loaded, identity, platform] = await Promise.all([
        preferencesLoad(),
        appIdentity(),
        platformInfo(),
      ])
      set({
        preferences: loaded.preferences,
        identity,
        platform,
        loadError: loaded.recovered ? loadErrorMessage(loaded.recoveredReason) : null,
        effectiveTheme: resolveEffectiveTheme(loaded.preferences.theme, get().systemPrefersDark),
        isLoaded: true,
      })
      // La disposición del Editor es preferencia de la aplicación, así que se
      // aplica al arrancar, antes de que el Editor monte (FR-006).
      get().applyLayoutPreferences({
        sidebar: loaded.preferences.sidebarHidden,
        inspector: loaded.preferences.inspectorHidden,
      })
      // El alto del editor de campos también es preferencia, y el panel lo
      // necesita antes de abrirse por primera vez (FR-022).
      get().setFieldsPanelHeight(loaded.preferences.fieldsPanelHeight)
    } catch (error) {
      set({
        loadError:
          error instanceof CommandError
            ? `No se pudo arrancar con tus preferencias: ${error.message}`
            : 'No se pudo arrancar con tus preferencias.',
        isLoaded: true,
      })
    }
  },

  /**
   * Cambia el tema y lo persiste. Si la escritura falla, el estado vuelve al
   * valor anterior y queda un aviso en `writeError` (FR-009).
   *
   * @param theme Preferencia elegida en Ajustes.
   */
  async setTheme(theme) {
    markThemeChange()
    const previous = get().preferences
    set({
      preferences: { ...previous, theme },
      effectiveTheme: resolveEffectiveTheme(theme, get().systemPrefersDark),
      writeError: null,
    })
    try {
      const saved = await preferencesUpdate({ theme })
      set({
        preferences: saved,
        effectiveTheme: resolveEffectiveTheme(saved.theme, get().systemPrefersDark),
      })
    } catch (error) {
      set({
        preferences: previous,
        effectiveTheme: resolveEffectiveTheme(previous.theme, get().systemPrefersDark),
        writeError:
          error instanceof CommandError
            ? `No se pudo guardar el tema: ${error.message}`
            : 'No se pudo guardar el tema.',
      })
    }
  },

  /**
   * Cambia «Ajustar a la cuadrícula» y lo persiste (FR-032).
   *
   * @param value Nuevo estado de la casilla.
   */
  async setSnapToGrid(value) {
    const previous = get().preferences
    set({ preferences: { ...previous, snapToGrid: value }, writeError: null })
    try {
      const saved = await preferencesUpdate({ snapToGrid: value })
      set({ preferences: saved })
    } catch (error) {
      set({
        preferences: previous,
        writeError:
          error instanceof CommandError
            ? `No se pudo guardar la preferencia: ${error.message}`
            : 'No se pudo guardar la preferencia.',
      })
    }
  },

  /**
   * Cambia la casilla «Mostrar esta ventana al abrir» y la persiste (FR-005).
   *
   * @param value Nuevo estado de la casilla.
   */
  async setShowWelcomeOnStart(value) {
    const previous = get().preferences
    set({ preferences: { ...previous, showWelcomeOnStart: value }, writeError: null })
    try {
      const saved = await preferencesUpdate({ showWelcomeOnStart: value })
      set({ preferences: saved })
    } catch (error) {
      set({
        preferences: previous,
        writeError:
          error instanceof CommandError
            ? `No se pudo guardar la preferencia: ${error.message}`
            : 'No se pudo guardar la preferencia.',
      })
    }
  },

  /**
   * Registra el tema del sistema y recalcula el tema efectivo (FR-007).
   *
   * @param value Si el sistema está en oscuro.
   */
  setSystemPrefersDark(value) {
    set({
      systemPrefersDark: value,
      effectiveTheme: resolveEffectiveTheme(get().preferences.theme, value),
    })
  },

  /** Abre Ajustes. Las tres vías de FR-020 llaman aquí. */
  openPreferences() {
    set({ isPreferencesOpen: true })
  },

  /** Cierra Ajustes. */
  closePreferences() {
    set({ isPreferencesOpen: false })
  },

  /**
   * Muestra un aviso efímero en la pantalla.
   *
   * @param message Texto del aviso.
   */
  showNotice(message) {
    set({ notice: message })
  },

  /** Oculta el aviso visible. */
  dismissNotice() {
    set({ notice: null })
  },
})
