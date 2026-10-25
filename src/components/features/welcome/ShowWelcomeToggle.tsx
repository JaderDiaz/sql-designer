import { Checkbox } from '@/components/ui/Checkbox'
import { usePreferencesStore } from '@/store/preferences'

/**
 * Casilla «Mostrar esta ventana al abrir SQL Designer» (FR-005).
 *
 * El cambio se persiste al momento; si la escritura falla, el almacén revierte
 * el valor y aquí se muestra el aviso para que el usuario no crea que quedó
 * guardado.
 */
export function ShowWelcomeToggle() {
  const showWelcomeOnStart = usePreferencesStore((state) => state.preferences.showWelcomeOnStart)
  const setShowWelcomeOnStart = usePreferencesStore((state) => state.setShowWelcomeOnStart)
  const writeError = usePreferencesStore((state) => state.writeError)

  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <Checkbox
        checked={showWelcomeOnStart}
        onCheckedChange={(checked) => void setShowWelcomeOnStart(checked)}
        label="Mostrar esta ventana al abrir SQL Designer"
      />
      {writeError ? (
        <p role="alert" className="text-[11px] leading-[14px] text-danger-text">
          {writeError}
        </p>
      ) : null}
    </div>
  )
}
