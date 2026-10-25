import { Dialog } from '@/components/ui/Dialog'
import { Icon } from '@/components/ui/Icon'
import { SegmentedControl, type SegmentedOption } from '@/components/ui/SegmentedControl'
import type { ThemePreference } from '@/lib/tauri/types'
import { usePreferencesStore } from '@/store/preferences'

/** Las tres opciones de tema de este incremento (FR-008). */
const THEME_OPTIONS: ReadonlyArray<SegmentedOption<ThemePreference>> = [
  { value: 'system', label: 'Sistema', icon: 'monitor' },
  { value: 'light', label: 'Claro', icon: 'sun' },
  { value: 'dark', label: 'Oscuro', icon: 'moon' },
]

/**
 * Ventana de Ajustes, con la cabecera y la rejilla del lienzo: pestaña
 * «General» y una sola fila, «Tema» (FR-008). El cambio se aplica en toda la
 * aplicación sin reiniciar.
 *
 * La pestaña «Nomenclatura» del diseño llega con el editor; aquí se omite en
 * vez de dibujarla apagada.
 */
export function PreferencesWindow() {
  const isOpen = usePreferencesStore((state) => state.isPreferencesOpen)
  const closePreferences = usePreferencesStore((state) => state.closePreferences)
  const theme = usePreferencesStore((state) => state.preferences.theme)
  const setTheme = usePreferencesStore((state) => state.setTheme)
  const writeError = usePreferencesStore((state) => state.writeError)

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) closePreferences()
      }}
      title="General"
      description="Elige cómo se ve SQL Designer."
      tabs={
        <button type="button" role="tab" aria-selected className="sm-ptab is-on">
          <Icon name="settings" size={18} />
          <span>General</span>
        </button>
      }
    >
      <div className="sm-pform">
        <span className="sm-plabel">Tema</span>
        <SegmentedControl
          label="Tema"
          value={theme}
          options={THEME_OPTIONS}
          onValueChange={(value) => void setTheme(value)}
        />
        {writeError ? (
          <p role="alert" className="col-start-2 text-[11px] leading-[14px] text-danger-text">
            {writeError}
          </p>
        ) : null}
      </div>
    </Dialog>
  )
}
