import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { FileList, type FileRow } from '@/components/ui/FileList'

const ROWS: FileRow[] = [
  { id: 'livy', name: 'livy', meta: 'Hoy, 9:12', icon: 'folder' },
  { id: 'modelo', name: 'modelo.yaml', meta: 'Ayer', icon: 'file-code' },
  { id: 'notas', name: 'notas.md', meta: 'Ayer', icon: 'file', disabled: true },
]

describe('FileList', () => {
  it('es un listbox con una opción por fila y marca la seleccionada', () => {
    render(
      <FileList
        rows={ROWS}
        value="modelo"
        onValueChange={vi.fn()}
        label="Contenido de livy"
        metaLabel="Modificado"
      />,
    )

    expect(screen.getByRole('listbox', { name: 'Contenido de livy' })).toBeInTheDocument()
    expect(screen.getAllByRole('option')).toHaveLength(3)
    expect(screen.getByRole('option', { name: /modelo\.yaml/ })).toHaveAttribute(
      'aria-selected',
      'true',
    )
  })

  it('deja ver pero no elegir las filas deshabilitadas', async () => {
    const user = userEvent.setup()
    const onValueChange = vi.fn()
    render(
      <FileList
        rows={ROWS}
        value={null}
        onValueChange={onValueChange}
        label="Contenido de livy"
        metaLabel="Modificado"
      />,
    )

    await user.click(screen.getByRole('option', { name: /notas\.md/ }))

    expect(onValueChange).not.toHaveBeenCalled()
  })

  it('mueve la selección con las flechas saltando las filas deshabilitadas', async () => {
    const user = userEvent.setup()
    const onValueChange = vi.fn()
    render(
      <FileList
        rows={ROWS}
        value="modelo"
        onValueChange={onValueChange}
        label="Contenido de livy"
        metaLabel="Modificado"
      />,
    )

    screen.getByRole('option', { name: /modelo\.yaml/ }).focus()
    await user.keyboard('{ArrowDown}')

    expect(onValueChange).not.toHaveBeenCalled()

    await user.keyboard('{ArrowUp}')
    expect(onValueChange).toHaveBeenCalledWith('livy')
  })

  it('activa la fila con Enter y con doble clic', async () => {
    const user = userEvent.setup()
    const onActivate = vi.fn()
    render(
      <FileList
        rows={ROWS}
        value="modelo"
        onValueChange={vi.fn()}
        onActivate={onActivate}
        label="Contenido de livy"
        metaLabel="Modificado"
      />,
    )

    screen.getByRole('option', { name: /modelo\.yaml/ }).focus()
    await user.keyboard('{Enter}')
    expect(onActivate).toHaveBeenCalledWith('modelo')

    await user.dblClick(screen.getByRole('option', { name: /livy/ }))
    expect(onActivate).toHaveBeenLastCalledWith('livy')
  })

  it('muestra el estado vacío cuando no hay filas', () => {
    render(
      <FileList
        rows={[]}
        value={null}
        onValueChange={vi.fn()}
        label="Contenido de livy"
        metaLabel="Modificado"
        empty={<span>Sin resultados</span>}
      />,
    )

    expect(screen.getByText('Sin resultados')).toBeInTheDocument()
    expect(screen.queryAllByRole('option')).toHaveLength(0)
  })
})
