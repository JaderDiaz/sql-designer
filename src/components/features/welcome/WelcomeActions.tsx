import { motion } from 'framer-motion'

import { Icon, type IconName } from '@/components/ui/Icon'
import { Kbd } from '@/components/ui/Kbd'
import { riseIn, stagger } from '@/lib/motion'
import { shortcutLabel } from '@/lib/platform'
import type { PlatformInfo } from '@/lib/tauri/types'

/** Props de las acciones de la Bienvenida. */
export interface WelcomeActionsProps {
  platform: PlatformInfo
  /** Abre el diálogo de Nuevo modelo (FR-002). */
  onNewModel: () => void
  /** Qué hacer con «Abrir modelo…»; en esta fase, avisar. */
  onOpenModel: () => void
  /** Abre la ventana de Ajustes (FR-020). */
  onOpenPreferences: () => void
}

/** Una fila del menú de inicio. */
interface ActionRow {
  label: string
  icon: IconName
  /** Tecla del atajo; el símbolo lo resuelve `shortcutLabel`. */
  key: string
  onClick: () => void
}

/**
 * Las filas de acción al pie de la barra lateral, como en el lienzo: icono,
 * texto y atajo (FR-003, FR-020). Entran escalonadas, una tras otra.
 *
 * «Abrir modelo…» queda habilitada y enfocable para que el teclado y el lector
 * de pantalla la alcancen (FR-014), aunque de momento solo avise de que llega
 * con la historia de abrir.
 */
export function WelcomeActions({
  platform,
  onNewModel,
  onOpenModel,
  onOpenPreferences,
}: WelcomeActionsProps) {
  const rows: ActionRow[] = [
    { label: 'Nuevo modelo…', icon: 'plus', key: 'N', onClick: onNewModel },
    { label: 'Abrir modelo…', icon: 'folder-open', key: 'O', onClick: onOpenModel },
    { label: 'Ajustes…', icon: 'settings', key: ',', onClick: onOpenPreferences },
  ]

  return (
    <motion.nav
      aria-label="Acciones de inicio"
      variants={stagger}
      className="mt-auto flex flex-col gap-0.5"
    >
      {rows.map((row) => (
        <motion.button
          key={row.label}
          type="button"
          variants={riseIn}
          onClick={row.onClick}
          className="sm-act h-[30px] gap-2.5 rounded-sm px-2.5 text-[13px] leading-[18px]"
        >
          <Icon name={row.icon} className="text-label-secondary" />
          <span className="min-w-0 flex-1">{row.label}</span>
          <Kbd>{shortcutLabel(platform, row.key)}</Kbd>
        </motion.button>
      ))}
    </motion.nav>
  )
}
