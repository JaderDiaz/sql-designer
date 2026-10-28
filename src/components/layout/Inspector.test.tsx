import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { EditorScreen } from '@/components/features/editor/EditorScreen'
import {
  COMMENT_NOTE,
  Inspector,
  NO_RELATIONS,
  SUMMARY_FIELDS,
} from '@/components/layout/Inspector'
import { readFixture } from '@/lib/model/__fixtures__'
import { parseModel } from '@/lib/model/parse'
import { TABLE_COMMENT_MAX_LENGTH } from '@/lib/model/types'
import { useAppStore } from '@/store'
import { resetStore } from '@/test/helpers'

vi.mock('@/lib/tauri/commands', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/tauri/commands')>()
  return { ...actual, measureModelOpened: vi.fn().mockResolvedValue(undefined) }
})

/**
 * Pruebas del inspector (FR-003 del Incremento 2, FR-041 a FR-045).
 *
 * El inspector mira la tabla seleccionada: con una, enseña su ficha —nombre,
 * esquema, descripción, resumen de campos y relaciones—; sin ninguna, la del
 * modelo. Enfocar un esquema mueve el lienzo y filtra la barra lateral, pero
 * no toca este panel.
 */
function openEditor() {
  const result = parseModel(readFixture('modelo-tres-esquemas'))
  if (!result.ok) throw new Error('el ejemplo no es un modelo válido')
  resetStore()
  useAppStore.setState({ screen: 'editor', model: result.model })
}

describe('inspector', () => {
  beforeEach(openEditor)

  it('muestra la ficha del modelo con su motor y su resumen', () => {
    render(<Inspector />)

    expect(screen.getByRole('heading', { name: 'Comercio · Tres esquemas' })).toBeInTheDocument()
    expect(screen.getByText('Motor')).toBeInTheDocument()
    const resumen = within(screen.getByRole('list', { name: 'Resumen' }))
    expect(resumen.getByText('esquemas')).toBeInTheDocument()
    expect(resumen.getByText('tablas')).toBeInTheDocument()
  })

  it('enfocar un esquema no cambia el inspector (FR-003, FR-029)', async () => {
    const user = userEvent.setup()
    render(<EditorScreen />)

    await user.click(screen.getByRole('option', { name: 'ventas, 2 tablas' }))

    const inspector = within(screen.getByRole('complementary', { name: 'Inspector' }))
    expect(inspector.queryByRole('heading', { name: 'ventas' })).not.toBeInTheDocument()
    expect(inspector.getByText('Motor')).toBeInTheDocument()
  })
})

describe('inspector de la tabla seleccionada', () => {
  /** Deja el modelo de seis tablas abierto con una seleccionada. */
  function openWith(table: string) {
    const result = parseModel(readFixture('modelo-postgres'))
    if (!result.ok) throw new Error('el ejemplo no es un modelo válido')
    resetStore()
    act(() => {
      useAppStore.setState({
        screen: 'editor',
        model: result.model,
        savedModel: result.model,
        selectedTable: table,
      })
    })
    return render(<Inspector />)
  }

  it('muestra el nombre, el esquema con su abreviatura y el conteo (FR-041)', () => {
    openWith('hoteles')

    expect(screen.getByRole('heading', { name: 'hoteles' })).toBeInTheDocument()
    expect(screen.getByText('PUB · public · 3 campos')).toBeInTheDocument()
    expect(screen.getByLabelText('Nombre')).toHaveValue('hoteles')
  })

  it('la descripción tiene su cuenta y el tope de 280 (FR-043)', () => {
    openWith('hoteles')

    const area = screen.getByLabelText('Descripción')
    expect(area).toHaveAttribute('maxlength', String(TABLE_COMMENT_MAX_LENGTH))
    expect(screen.getByText(`20/${TABLE_COMMENT_MAX_LENGTH}`)).toBeInTheDocument()
    expect(screen.getByText(COMMENT_NOTE)).toBeInTheDocument()
  })

  it('escribir la descripción la guarda en el modelo (FR-043)', async () => {
    openWith('hoteles')

    await userEvent.type(screen.getByLabelText('Descripción'), '!')

    const table = (useAppStore.getState().model?.tables ?? []).find(
      (item) => item.name === 'hoteles',
    )
    expect(table?.comment).toBe('Hoteles de la cadena!')
  })

  it('cambiar el esquema mueve la tabla a esa zona (FR-042)', async () => {
    const result = parseModel(readFixture('modelo-tres-esquemas'))
    if (!result.ok) throw new Error('el ejemplo no es un modelo válido')
    resetStore()
    act(() => {
      useAppStore.setState({
        screen: 'editor',
        model: result.model,
        savedModel: result.model,
        selectedTable: 'facturas',
      })
    })
    render(<Inspector />)

    await userEvent.click(screen.getByRole('combobox', { name: 'Esquema de facturas' }))
    await userEvent.click(await screen.findByRole('option', { name: 'INV · inventario' }))

    const table = (useAppStore.getState().model?.tables ?? []).find(
      (item) => item.name === 'facturas',
    )
    expect(table?.schema).toBe('inventario')
  })

  it('el resumen muestra los ocho primeros campos y ofrece el resto (FR-044)', () => {
    openWith('resenas')

    const campos = within(screen.getByRole('region', { name: 'Campos' }))
    expect(campos.getByRole('heading', { name: 'Campos · 5' })).toBeInTheDocument()
    expect(
      campos.getByRole('button', { name: 'reserva_id, integer, llave primaria' }),
    ).toBeInTheDocument()
    expect(campos.getByRole('button', { name: 'texto, text, admite nulos' })).toBeInTheDocument()
    expect(campos.getByText('? = admite nulos')).toBeInTheDocument()
    expect(campos.queryByRole('button', { name: /^Mostrar / })).not.toBeInTheDocument()
  })

  it('con más de ocho campos esconde el resto tras «Mostrar N más» (FR-044)', async () => {
    const result = parseModel(readFixture('modelo-postgres'))
    if (!result.ok) throw new Error('el ejemplo no es un modelo válido')
    const many = {
      ...result.model,
      tables: (result.model.tables ?? []).map((table) =>
        table.name === 'hoteles'
          ? {
              ...table,
              fields: Array.from({ length: 11 }, (_, index) => ({
                name: `campo_${index + 1}`,
                type: 'text',
              })),
              primaryKey: ['campo_1'],
            }
          : table,
      ),
    }
    resetStore()
    act(() => {
      useAppStore.setState({
        screen: 'editor',
        model: many,
        savedModel: many,
        selectedTable: 'hoteles',
      })
    })
    render(<Inspector />)

    const campos = within(screen.getByRole('region', { name: 'Campos' }))
    expect(campos.getAllByRole('button', { name: /^campo_/ })).toHaveLength(SUMMARY_FIELDS)

    await userEvent.click(campos.getByRole('button', { name: 'Mostrar 3 más' }))
    expect(campos.getAllByRole('button', { name: /^campo_/ })).toHaveLength(11)

    await userEvent.click(campos.getByRole('button', { name: 'Mostrar menos' }))
    expect(campos.getAllByRole('button', { name: /^campo_/ })).toHaveLength(SUMMARY_FIELDS)
  })

  it('pulsar un campo abre el editor en esa celda (FR-044)', async () => {
    openWith('hoteles')

    await userEvent.click(screen.getByRole('button', { name: /^ciudad, text/ }))

    const state = useAppStore.getState()
    expect(state.isFieldsPanelOpen).toBe(true)
    expect(state.fieldsPanelTable).toBe('hoteles')
    expect(state.focusedCell).toEqual({ field: 'ciudad', column: 'name' })
  })

  it('lista las relaciones de la tabla (FR-045)', () => {
    openWith('reservas')

    const seccion = within(screen.getByRole('region', { name: 'Relaciones' }))
    expect(seccion.getByRole('heading', { name: 'Relaciones · 4' })).toBeInTheDocument()
    expect(seccion.getByText('reservas → pagos')).toBeInTheDocument()
  })

  it('lo dice cuando la tabla no tiene ninguna relación (FR-045)', () => {
    const result = parseModel(readFixture('modelo-tres-esquemas'))
    if (!result.ok) throw new Error('el ejemplo no es un modelo válido')
    const alone = { ...result.model }
    delete alone.relations
    resetStore()
    act(() => {
      useAppStore.setState({
        screen: 'editor',
        model: alone,
        savedModel: alone,
        selectedTable: 'facturas',
      })
    })
    render(<Inspector />)

    expect(screen.getByText(NO_RELATIONS)).toBeInTheDocument()
  })

  it('sin selección vuelve a la ficha del modelo (FR-003)', () => {
    openWith('hoteles')
    act(() => {
      useAppStore.getState().selectTable(null)
    })

    expect(screen.getByRole('heading', { name: 'Livy · Reservas' })).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Campos' })).not.toBeInTheDocument()
  })

  it('tiene el menú de acciones de la tabla (FR-036)', async () => {
    openWith('hoteles')

    await userEvent.click(screen.getByRole('button', { name: 'Acciones de hoteles' }))

    expect(await screen.findByRole('menuitem', { name: /^Editar campos…/ })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: /^Eliminar tabla…/ })).toBeInTheDocument()
  })
})
