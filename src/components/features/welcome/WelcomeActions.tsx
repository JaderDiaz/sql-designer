import { motion } from 'framer-motion'

import { Icon, type IconName } from '@/components/ui/Icon'
import { Kbd } from '@/components/ui/Kbd'
import { riseIn, stagger } from '@/lib/motion'
import { shortcutLabel } from '@/lib/platform'
import type { PlatformInfo } from '@/lib/tauri/types'

/** Props de las acciones de la Bienvenida. */
export interface WelcomeActionsProps {
  platform: PlatformInfo
  /** Qué hacer con «Nuevo modelo…» y «Abrir modelo…»; aquí, avisar. */
  onAction: () => void
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
 * «Nuevo modelo…» y «Abrir modelo…» quedan habilitadas y enfocables para que
 * el teclado y el lector de pantalla las alcancen (FR-014), pero en este
 * incremento solo avisan de que la acción llega después (FR-004).
 */
export function WelcomeActions({ platform, onAction, onOpenPreferences }: WelcomeActionsProps) {
  const rows: ActionRow[] = [
    { label: 'Nuevo modelo…', icon: 'plus', key: 'N', onClick: onAction },
    { label: 'Abrir modelo…', icon: 'folder-open', key: 'O', onClick: onAction },
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
