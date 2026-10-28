import { Dialog } from '@/components/ui/Dialog'
import { Icon } from '@/components/ui/Icon'
import { SegmentedControl, type SegmentedOption } from '@/components/ui/SegmentedControl'
import { Switch } from '@/components/ui/Switch'
import type { RelationAnimation, RelationRoute, ThemePreference } from '@/lib/tauri/types'
import { useAppStore } from '@/store'

/** Las tres opciones de tema de este incremento (FR-008). */
const THEME_OPTIONS: ReadonlyArray<SegmentedOption<ThemePreference>> = [
  { value: 'system', label: 'Sistema', icon: 'monitor' },
  { value: 'light', label: 'Claro', icon: 'sun' },
  { value: 'dark', label: 'Oscuro', icon: 'moon' },
]

/**
 * Los tres trazados de relación de FR-017.
 *
 * Sin icono: ninguno del juego dibuja un trazo ortogonal, uno curvo y uno
 * recto de forma reconocible, y una etiqueta sola se lee mejor que un icono
 * que no significa nada.
 */
const ROUTE_OPTIONS: ReadonlyArray<SegmentedOption<RelationRoute>> = [
  { value: 'orthogonal', label: 'Ortogonal' },
  { value: 'curved', label: 'Curvas' },
  { value: 'straight', label: 'Rectas' },
]

/** Los tres niveles de animación de FR-024; «Sutil» es el valor inicial. */
const ANIMATION_OPTIONS: ReadonlyArray<SegmentedOption<RelationAnimation>> = [
  { value: 'off', label: 'Apagada' },
  { value: 'subtle', label: 'Sutil' },
  { value: 'lively', label: 'Viva' },
]

/**
 * Ventana de Ajustes, con la cabecera y la rejilla del lienzo: pestaña
 * «General» con «Tema» (FR-008 del Incremento 1), «Ajustar a la cuadrícula»
 * (FR-032 del Incremento 3) y «Trazado de relaciones» (FR-017 del Incremento
 * 4) y «Animación de relaciones» (FR-024). Los cambios se aplican en toda la aplicación sin reiniciar y sin cerrar
 * la ventana.
 *
 * La pestaña «Nomenclatura» del diseño llega con el editor; aquí se omite en
 * vez de dibujarla apagada.
 */
export function PreferencesWindow() {
  const isOpen = useAppStore((state) => state.isPreferencesOpen)
  const closePreferences = useAppStore((state) => state.closePreferences)
  const theme = useAppStore((state) => state.preferences.theme)
  const setTheme = useAppStore((state) => state.setTheme)
  const snapToGrid = useAppStore((state) => state.preferences.snapToGrid)
  const setSnapToGrid = useAppStore((state) => state.setSnapToGrid)
  const relationRoute = useAppStore((state) => state.preferences.relationRoute)
  const setRelationRoute = useAppStore((state) => state.setRelationRoute)
  const relationAnimation = useAppStore((state) => state.preferences.relationAnimation)
  const setRelationAnimation = useAppStore((state) => state.setRelationAnimation)
  const writeError = useAppStore((state) => state.writeError)

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
        <span className="sm-plabel">Cuadrícula</span>
        <Switch
          checked={snapToGrid}
          onCheckedChange={(value) => void setSnapToGrid(value)}
          label="Ajustar a la cuadrícula"
          hint="Las tablas se alinean a los puntos del lienzo al soltarlas"
        />

        <span className="sm-plabel">Relaciones</span>
        {/* La preferencia se escribe al cambiar el control, no al cerrar la
            ventana: las líneas del lienzo se redibujan con el cambio, con
            Ajustes todavía abierto (FR-017). */}
        <SegmentedControl
          label="Trazado de relaciones"
          value={relationRoute}
          options={ROUTE_OPTIONS}
          onValueChange={(value) => void setRelationRoute(value)}
        />

        <span className="sm-plabel">Animación</span>
        <div className="flex flex-col gap-1">
          <SegmentedControl
            label="Animación de relaciones"
            value={relationAnimation}
            options={ANIMATION_OPTIONS}
            onValueChange={(value) => void setRelationAnimation(value)}
          />
          <span className="text-[11px] leading-[14px] text-label-secondary">
            Los puntos que fluyen por las relaciones activas.
          </span>
        </div>

        {writeError ? (
          <p role="alert" className="col-start-2 text-[11px] leading-[14px] text-danger-text">
            {writeError}
          </p>
        ) : null}
      </div>
    </Dialog>
  )
}
