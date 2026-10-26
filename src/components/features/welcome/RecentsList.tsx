import { useRef, type KeyboardEvent } from 'react'

import { RecentContextMenu } from '@/components/features/welcome/RecentContextMenu'
import { Icon, type IconName } from '@/components/ui/Icon'
import { cn } from '@/lib/cn'
import { formatModified } from '@/lib/format'
import { ENGINE_LABELS } from '@/lib/model/types'
import { useAppStore } from '@/store'
import { recentStateLabel, type RecentEntry, type RecentState } from '@/store/recents'

/**
 * Lista de Recientes de la Bienvenida (FR-031 a FR-034).
 *
 * Es un `listbox` de verdad: cada fila es una opción con su estado de
 * selección, las flechas la mueven y Enter abre, igual que el doble clic
 * (RS-09). Las filas con problema no se esconden: dicen qué les pasa en el
 * sitio donde las demás dicen el motor y las tablas, y al abrirlas sale el
 * aviso que corresponda (FR-033, FR-034).
 */

/** Título de la lista cuando está vacía (FR-031). */
export const EMPTY_RECENTS_TITLE = 'Todavía no has abierto ningún modelo.'

/** Pista debajo del título de la lista vacía. */
export const EMPTY_RECENTS_HINT = 'Crea uno nuevo o abre un archivo .yaml que ya tengas.'

/** Icono, tinte y fondo de la fila según su estado, como en el lienzo. */
const LOOK: Record<RecentState, { icon: IconName; tint: string; soft: string }> = {
  ok: { icon: 'file-code', tint: 'text-indigo', soft: 'bg-accent-soft' },
  stale: { icon: 'file-code', tint: 'text-indigo', soft: 'bg-accent-soft' },
  missing: { icon: 'file-question', tint: 'text-label-tertiary', soft: 'bg-fill-hover' },
  invalid: { icon: 'file-warning', tint: 'text-orange', soft: 'bg-warning-soft' },
}

/**
 * Segunda línea de la derecha: el motor y las tablas, o el problema.
 *
 * @param entry Fila de la lista.
 */
export function recentMeta(entry: RecentEntry): string {
  const problem = recentStateLabel(entry.state)
  if (problem !== null) return problem
  const tables = `${entry.tables} ${entry.tables === 1 ? 'tabla' : 'tablas'}`
  return `${ENGINE_LABELS[entry.engine]} · ${tables}`
}

/**
 * Total que acompaña al título «Recientes».
 *
 * @param total Número de filas de la lista.
 */
export function recentsCountLabel(total: number): string {
  return `${total} ${total === 1 ? 'modelo' : 'modelos'}`
}

export function RecentsList() {
  const recents = useAppStore((state) => state.recents)
  const selection = useAppStore((state) => state.recentSelection)
  const selectRecent = useAppStore((state) => state.selectRecent)
  const openRecent = useAppStore((state) => state.openRecent)
  const container = useRef<HTMLDivElement>(null)

  /** Mueve la selección con las flechas y abre con Enter (RS-09). */
  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    // El menú de una fila se pinta en un portal que, en el árbol de React,
    // sigue colgando de esta lista: sus teclas llegan hasta aquí. Sin este
    // filtro, Enter sobre «Copiar ruta» copiaría y además abriría el modelo.
    if ((event.target as HTMLElement).closest('[role="menu"]') !== null) return

    if (event.key === 'Enter' && selection !== null) {
      event.preventDefault()
      void openRecent(selection)
      return
    }
    const index = recents.findIndex((entry) => entry.path === selection)
    let next = index
    if (event.key === 'ArrowDown') next = Math.min(recents.length - 1, index + 1)
    else if (event.key === 'ArrowUp') next = Math.max(0, index - 1)
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = recents.length - 1
    else return

    event.preventDefault()
    const target = recents[next]
    if (target === undefined || target.path === selection) return
    selectRecent(target.path)
    container.current?.querySelector<HTMLButtonElement>(`[data-path="${target.path}"]`)?.focus()
  }

  if (recents.length === 0) {
    return (
      <div
        data-tauri-drag-region
        className="flex min-h-0 flex-1 flex-col items-center justify-center gap-1 px-6 text-center"
      >
        <p className="text-[13px] leading-[18px] text-label-secondary">{EMPTY_RECENTS_TITLE}</p>
        <p className="text-[11px] leading-[14px] text-label-secondary">{EMPTY_RECENTS_HINT}</p>
      </div>
    )
  }

  return (
    <div
      ref={container}
      role="listbox"
      aria-label="Modelos recientes"
      onKeyDown={onKeyDown}
      className="-my-1 flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-3 py-2"
      style={{ overscrollBehavior: 'contain' }}
    >
      {recents.map((entry, index) => {
        const selected = entry.path === selection
        const look = LOOK[entry.state]
        return (
          <RecentContextMenu key={entry.path} entry={entry}>
            <button
              type="button"
              data-path={entry.path}
              role="option"
              aria-selected={selected}
              tabIndex={selected || (selection === null && index === 0) ? 0 : -1}
              title="Doble clic para abrir · clic derecho para más acciones"
              onClick={() => selectRecent(entry.path)}
              onDoubleClick={() => void openRecent(entry.path)}
              className={cn(
                'sm-row h-[52px] gap-3 rounded-md pl-2.5 pr-3',
                selected ? 'is-sel' : null,
              )}
              style={{ animationDelay: `${index * 40}ms` }}
            >
              <span
                className={cn(
                  'flex h-8 w-8 flex-none items-center justify-center rounded-md',
                  look.soft,
                )}
              >
                <Icon name={look.icon} className={look.tint} />
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate text-[13px] font-semibold leading-[18px]">
                  {entry.name}
                </span>
                <span className="truncate font-mono text-[11px] leading-[14px] text-label-secondary">
                  {entry.folder}/{entry.fileName}
                </span>
              </span>
              <span className="flex flex-none flex-col items-end gap-0.5 text-[11px] leading-[14px] text-label-secondary [font-variant-numeric:tabular-nums]">
                <span>{formatModified(entry.usedAtMs)}</span>
                <span>{recentMeta(entry)}</span>
              </span>
            </button>
          </RecentContextMenu>
        )
      })}
    </div>
  )
}
