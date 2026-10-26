import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { ContextMenu, type ContextMenuAction } from '@/components/ui/ContextMenu'

/** Acciones de ejemplo, con la misma forma que las de un reciente (FR-034). */
function actions(onSelect = vi.fn()): ContextMenuAction[] {
  return [
    { id: 'open', label: 'Abrir', icon: 'folder-open', onSelect },
    { id: 'rename', label: 'Renombrar…', icon: 'pencil', onSelect },
    { id: 'copy', label: 'Copiar ruta', icon: 'copy', disabled: true, onSelect },
    {
      id: 'trash',
      label: 'Mover a la papelera…',
      icon: 'trash-2',
      destructive: true,
      separatorBefore: true,
      onSelect,
    },
  ]
}

describe('ContextMenu', () => {
  it('se abre con el botón derecho y lista todas las acciones', () => {
    render(
      <ContextMenu actions={actions()}>
        <button type="button">modelo.yaml</button>
      </ContextMenu>,
    )

    fireEvent.contextMenu(screen.getByRole('button', { name: 'modelo.yaml' }))

    expect(screen.getByRole('menu')).toBeInTheDocument()
    expect(screen.getAllByRole('menuitem')).toHaveLength(4)
    expect(screen.getByRole('menuitem', { name: 'Copiar ruta' })).toHaveAttribute('data-disabled')
  })

  it('se abre con ⇧F10, sin ratón (RS-09)', async () => {
    const user = userEvent.setup()
    render(
      <ContextMenu actions={actions()}>
        <button type="button">modelo.yaml</button>
      </ContextMenu>,
    )

    screen.getByRole('button', { name: 'modelo.yaml' }).focus()
    await user.keyboard('{Shift>}{F10}{/Shift}')

    expect(screen.getByRole('menu')).toBeInTheDocument()
  })

  it('ejecuta la acción elegida con el teclado', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(
      <ContextMenu actions={actions(onSelect)}>
        <button type="button">modelo.yaml</button>
      </ContextMenu>,
    )

    fireEvent.contextMenu(screen.getByRole('button', { name: 'modelo.yaml' }))
    await user.keyboard('{ArrowDown}{Enter}')

    expect(onSelect).toHaveBeenCalledTimes(1)
  })

  it('marca la acción destructiva para que se vea en rojo (RS-08)', () => {
    render(
      <ContextMenu actions={actions()}>
        <button type="button">modelo.yaml</button>
      </ContextMenu>,
    )

    fireEvent.contextMenu(screen.getByRole('button', { name: 'modelo.yaml' }))

    expect(screen.getByRole('menuitem', { name: 'Mover a la papelera…' })).toHaveClass('is-danger')
  })
})
