import type { ReactNode } from 'react'

import { ContextMenu, type ContextMenuAction } from '@/components/ui/ContextMenu'
import { useAppStore } from '@/store'
import type { RecentEntry } from '@/store/recents'

/**
 * Menú contextual de una fila de Recientes (FR-035 a FR-038).
 *
 * Las acciones que no aplican al estado de la fila se ven deshabilitadas en
 * lugar de desaparecer, para que el menú no cambie de forma entre filas
 * (FR-038): un archivo que ya no está no se puede renombrar ni mandar a la
 * papelera, y uno con errores no se puede renombrar porque no se puede leer.
 * Abrirlo sí se puede: de ahí sale el aviso con la línea del error.
 */

/** Props del menú de una fila. */
export interface RecentContextMenuProps {
  entry: RecentEntry
  /** La fila sobre la que se abre el menú. */
  children: ReactNode
}

export function RecentContextMenu({ entry, children }: RecentContextMenuProps) {
  const openRecent = useAppStore((state) => state.openRecent)
  const startRenameRecent = useAppStore((state) => state.startRenameRecent)
  const copyRecentPath = useAppStore((state) => state.copyRecentPath)
  const removeRecent = useAppStore((state) => state.removeRecent)
  const startTrashRecent = useAppStore((state) => state.startTrashRecent)
  const selectRecent = useAppStore((state) => state.selectRecent)

  const missing = entry.state === 'missing'
  const unreadable = missing || entry.state === 'invalid'

  const actions: ContextMenuAction[] = [
    {
      id: 'open',
      label: 'Abrir',
      icon: 'folder-open',
      disabled: missing,
      onSelect: () => void openRecent(entry.path),
    },
    {
      id: 'rename',
      label: 'Renombrar…',
      icon: 'pencil',
      disabled: unreadable,
      onSelect: () => startRenameRecent(entry.path),
    },
    {
      id: 'copy',
      label: 'Copiar ruta',
      icon: 'clipboard-copy',
      onSelect: () => void copyRecentPath(entry.path),
    },
    {
      id: 'remove',
      label: 'Quitar de recientes',
      icon: 'circle-minus',
      separatorBefore: true,
      onSelect: () => void removeRecent(entry.path),
    },
    {
      id: 'trash',
      label: 'Mover a la papelera…',
      icon: 'trash-2',
      destructive: true,
      disabled: missing,
      onSelect: () => startTrashRecent(entry.path),
    },
  ]

  return (
    <ContextMenu
      actions={actions}
      title={
        <span className="flex min-w-0 flex-col">
          <span className="truncate font-semibold">{entry.name}</span>
          <span className="truncate font-mono text-[11px] leading-[14px] text-label-secondary">
            {entry.folder}/{entry.fileName}
          </span>
        </span>
      }
      onOpen={() => selectRecent(entry.path)}
    >
      {children}
    </ContextMenu>
  )
}
