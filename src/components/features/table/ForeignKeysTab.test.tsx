import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'

import {
  CLEAR_NOT_NULL_ACTION,
  ForeignKeysTab,
  SET_NULL_WARNING,
  multiColumnMessage,
  NO_FOREIGN_KEYS_MESSAGE,
} from '@/components/features/table/ForeignKeysTab'
import { relationLayer } from '@/lib/canvas/relations'
import { resolveLayout } from '@/lib/canvas/layout'
import { readFixture } from '@/lib/model/__fixtures__'
import { fieldMarks } from '@/lib/model/marks'
import { parseModel } from '@/lib/model/parse'
import type { Model, Table } from '@/lib/model/types'
import { useAppStore } from '@/store'
import { SELF_COLUMN_ERROR } from '@/store/relations'
import { resetStore } from '@/test/helpers'

/**
 * Pruebas de la ficha «Claves foráneas» (FR-006 a FR-010, FR-032, FR-038).
 *
 * Se mira que la ficha pida cada cosa en su columna, que las dos listas
 * ofrezcan lo que debe —todas las tablas, las imposibles deshabilitadas con su
 * motivo— y que al completar una fila la marca `FK` y la línea del lienzo
 * aparezcan sin que nadie las escriba, que es lo que afirma FR-010.
 */

/** Modelo de ejemplo con seis tablas y seis relaciones. */
function relations(): Model {
  const result = parseModel(readFixture('modelo-relaciones'))
  if (!result.ok) throw new Error('el ejemplo no es un modelo válido')
  return result.model
}

/** La tabla del modelo abierto, para volver a leerla tras cada cambio. */
function tableNamed(name: string): Table {
  const table = (useAppStore.getState().model?.tables ?? []).find((item) => item.name === name)
  if (table === undefined) throw new Error(`no hay tabla ${name}`)
  return table
}

/** Dibuja la ficha de una tabla del ejemplo. */
function renderTab(name = 'pagos') {
  // Las pruebas que miran otra tabla vuelven a llamar aquí, así que el árbol
  // anterior se suelta antes de pintar el nuevo.
  cleanup()
  resetStore()
  const model = relations()
  act(() => {
    useAppStore.setState({ screen: 'editor', model, savedModel: model, isDirty: false })
    useAppStore.getState().openFieldsPanel(name, undefined, 'foreignKeys')
  })
  /** Vuelve a pintar con la tabla que hay ahora en el almacén. */
  function Harness() {
    const current = useAppStore((state) =>
      (state.model?.tables ?? []).find((table) => table.name === name),
    )
    return current === undefined ? null : <ForeignKeysTab table={current} />
  }
  return render(<Harness />)
}

describe('ForeignKeysTab', () => {
  beforeEach(() => renderTab())

  it('pide las seis columnas de FR-006 en su orden', () => {
    const headers = screen.getAllByRole('columnheader').map((cell) => cell.textContent)

    expect(headers).toEqual(['Columna', 'Referencia', 'ON DELETE', 'ON UPDATE', 'Índice', ''])
  })

  it('se anuncia como la rejilla de su tabla, con la columna de la referencia (§5)', () => {
    const grid = screen.getByRole('grid', { name: 'Claves foráneas de pagos' })

    expect(grid).toHaveAttribute('aria-colcount', '6')
    // Dos claves foráneas y la fila de encabezado.
    expect(grid).toHaveAttribute('aria-rowcount', '3')
    expect(screen.getByRole('columnheader', { name: 'Tabla referenciada' })).toBeInTheDocument()
  })

  it('cada fila lee su columna, su destino y su campo referenciado (FR-006)', () => {
    expect(screen.getByLabelText('Columna de fk_pagos_pedido_id')).toHaveTextContent('pedido_id')
    expect(screen.getByLabelText('Tabla referenciada de fk_pagos_pedido_id')).toHaveTextContent(
      'pedidos',
    )
    expect(screen.getByLabelText('ON DELETE de fk_pagos_pedido_id')).toHaveTextContent('CASCADE')
    expect(screen.getByLabelText('ON UPDATE de fk_pagos_metodo_id')).toHaveTextContent(
      'NO ACTION',
    )
    expect(screen.getByRole('button', { name: 'Ir a pedidos' })).toBeInTheDocument()
  })

  it('dice si la columna abre un índice (FR-033)', () => {
    // `pedido_id` no abre ninguno en `pagos`.
    expect(screen.getByLabelText('Índice de fk_pagos_pedido_id')).toHaveTextContent('Sin índice')

    renderTab('comentarios')
    // `resena_pedido_id` es la primera columna de un único, así que está
    // indexada.
    expect(screen.getByLabelText('Índice de fk_comentarios_resena')).toHaveTextContent(
      'Indexada',
    )
  })

  it('la lista de destinos trae todas las tablas, con las imposibles deshabilitadas (FR-009)', async () => {
    const user = userEvent.setup()
    screen.getByLabelText('Tabla referenciada de fk_pagos_pedido_id').focus()
    await user.keyboard('{Enter}')

    const options = screen.getAllByRole('option').map((option) => option.textContent)
    expect(options?.length).toBe(6)
    // La tabla abierta también se puede elegir: una relación puede apuntar a
    // su propia tabla (FR-009).
    expect(screen.getByRole('option', { name: /^pagos/ })).not.toHaveAttribute('data-disabled')
    // El nombre accesible de la opción es el de la tabla: el motivo viaja en
    // la segunda línea, que el primitivo no suma al nombre.
    const composite = screen.getByRole('option', { name: 'resenas' })
    expect(composite).toHaveAttribute('data-disabled')
    expect(composite).toHaveTextContent('resenas tiene llave primaria de varias columnas.')
  })

  it('la tabla sin claves foráneas lo dice y ofrece el botón (FR-032)', () => {
    renderTab('metodos_pago')

    expect(screen.getByText(NO_FOREIGN_KEYS_MESSAGE)).toBeInTheDocument()
    expect(screen.queryByRole('grid')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Añadir clave foránea/ })).toBeInTheDocument()
  })

  it('«Añadir clave foránea» crea la columna propuesta y la deja enfocada (FR-004, FR-007)', async () => {
    renderTab('metodos_pago')
    await userEvent.click(screen.getByRole('button', { name: /Añadir clave foránea/ }))

    // El patrón por defecto es `{tabla}_{pk}` y el primer destino libre es
    // `clientes`, que tiene llave primaria de una columna.
    expect(tableNamed('metodos_pago').fields.map((field) => field.name)).toContain('clientes_id')
    const name = 'fk_metodos_pago_clientes_id'
    expect(screen.getByLabelText(`Columna de ${name}`)).toHaveTextContent('clientes_id')
    expect(screen.getByLabelText(`Tabla referenciada de ${name}`)).toHaveTextContent('clientes')
    expect(useAppStore.getState().focusedCell).toEqual({ field: name, column: 'reference' })
  })

  it('la columna propuesta nace con el tipo de la llave primaria (FR-004)', async () => {
    renderTab('metodos_pago')
    await userEvent.click(screen.getByRole('button', { name: /Añadir clave foránea/ }))

    const field = tableNamed('metodos_pago').fields.find((item) => item.name === 'clientes_id')
    expect(field?.type).toBe('integer')
  })

  it('con la fila completa, el campo queda marcado FK y la línea aparece (FR-010)', async () => {
    renderTab('metodos_pago')
    await userEvent.click(screen.getByRole('button', { name: /Añadir clave foránea/ }))

    const model = useAppStore.getState().model as Model
    const marks = fieldMarks(tableNamed('metodos_pago'), model.relations ?? [])
    expect(marks.get('clientes_id')).toBe('FK')

    const lines = relationLayer(model, resolveLayout(model), 'orthogonal')
    expect(lines.map((line) => line.name)).toContain('fk_metodos_pago_clientes_id')
  })

  it('una relación a la propia tabla no ofrece como columna el campo al que apunta (FR-009a)', async () => {
    renderTab('clientes')
    const user = userEvent.setup()
    screen.getByLabelText('Columna de fk_clientes_recomendado_por').focus()
    await user.keyboard('{Enter}')

    const options = screen.getAllByRole('option').map((option) => option.textContent)
    expect(options).toEqual(['nombre', 'recomendado_por'])
    // Y si se intenta por otra vía, el almacén lo rechaza con su motivo.
    expect(useAppStore.getState().setForeignKeyColumn('fk_clientes_recomendado_por', 'id')).toBe(
      SELF_COLUMN_ERROR,
    )
  })

  it('cambiar la columna la escribe en la relación (FR-008)', async () => {
    const user = userEvent.setup()
    screen.getByLabelText('Columna de fk_pagos_metodo_id').focus()
    await user.keyboard('{Enter}')
    await user.click(screen.getByRole('option', { name: 'importe' }))

    const relation = (useAppStore.getState().model?.relations ?? []).find(
      (item) => item.name === 'fk_pagos_metodo_id',
    )
    expect(relation?.fromFields).toEqual(['importe'])
  })

  it('las flechas mueven el foco de celda y de fila (FR-038)', () => {
    act(() => {
      useAppStore.getState().focusCell({ field: 'fk_pagos_pedido_id', column: 'column' })
    })
    const grid = screen.getByRole('grid', { name: 'Claves foráneas de pagos' })

    act(() => fireEvent.keyDown(grid, { key: 'ArrowRight' }))
    expect(useAppStore.getState().focusedCell).toEqual({
      field: 'fk_pagos_pedido_id',
      column: 'reference',
    })

    act(() => fireEvent.keyDown(grid, { key: 'ArrowDown' }))
    expect(useAppStore.getState().focusedCell).toEqual({
      field: 'fk_pagos_metodo_id',
      column: 'reference',
    })
  })

  it('Inicio y Fin van a los extremos de la fila (FR-038)', () => {
    act(() => {
      useAppStore.getState().focusCell({ field: 'fk_pagos_metodo_id', column: 'onDelete' })
    })
    const grid = screen.getByRole('grid', { name: 'Claves foráneas de pagos' })

    act(() => fireEvent.keyDown(grid, { key: 'End' }))
    expect(useAppStore.getState().focusedCell).toEqual({
      field: 'fk_pagos_metodo_id',
      column: 'remove',
    })

    act(() => fireEvent.keyDown(grid, { key: 'Home' }))
    expect(useAppStore.getState().focusedCell).toEqual({
      field: 'fk_pagos_metodo_id',
      column: 'column',
    })
  })

  it('la relación de varias columnas se muestra, se lee y dice por qué (FR-020)', () => {
    renderTab('comentarios')

    expect(
      screen.getByText(multiColumnMessage(['resena_pedido_id', 'resena_cliente_id'])),
    ).toBeInTheDocument()
    // Sin selector: las dos primeras celdas solo leen lo que trae el archivo.
    expect(screen.getByLabelText('Columna de fk_comentarios_resena')).toHaveTextContent(
      'resena_pedido_id, resena_cliente_id',
    )
    expect(screen.queryByRole('combobox', { name: 'Columna de fk_comentarios_resena' })).toBeNull()
    expect(
      screen.queryByRole('combobox', { name: 'Tabla referenciada de fk_comentarios_resena' }),
    ).toBeNull()
    // Sus reglas sí se cambian, y se puede eliminar.
    expect(
      screen.getByRole('combobox', { name: 'ON UPDATE de fk_comentarios_resena' }),
    ).toHaveTextContent('CASCADE')
    expect(screen.getByRole('button', { name: 'Eliminar la clave foránea' })).toBeInTheDocument()
  })

  it('las flechas saltan las celdas que no se editan (FR-020, FR-038)', () => {
    renderTab('comentarios')
    act(() => {
      useAppStore.getState().focusCell({ field: 'fk_comentarios_resena', column: 'onDelete' })
    })

    act(() =>
      fireEvent.keyDown(screen.getByRole('grid', { name: 'Claves foráneas de comentarios' }), {
        key: 'Home',
      }),
    )

    // Inicio cae en la primera celda que acepta el foco, no en «Columna».
    expect(useAppStore.getState().focusedCell).toEqual({
      field: 'fk_comentarios_resena',
      column: 'onDelete',
    })
  })

  it('los dos selectores ofrecen las cinco acciones, en mayúsculas (FR-028)', async () => {
    const user = userEvent.setup()
    screen.getByLabelText('ON DELETE de fk_pagos_pedido_id').focus()
    await user.keyboard('{Enter}')

    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual([
      'NO ACTION',
      'RESTRICT',
      'CASCADE',
      'SET NULL',
      'SET DEFAULT',
    ])
  })

  it('cambiar una regla la escribe en la relación (FR-028)', async () => {
    const user = userEvent.setup()
    screen.getByLabelText('ON UPDATE de fk_pagos_pedido_id').focus()
    await user.keyboard('{Enter}')
    await user.click(screen.getByRole('option', { name: 'RESTRICT' }))

    const relation = (useAppStore.getState().model?.relations ?? []).find(
      (item) => item.name === 'fk_pagos_pedido_id',
    )
    expect(relation?.onUpdate).toBe('restrict')
  })

  it('SET NULL sobre una columna no nula avisa, se guarda y ofrece la salida (FR-030)', async () => {
    const user = userEvent.setup()
    // `pedido_id` de `pagos` no admite nulos.
    screen.getByLabelText('ON DELETE de fk_pagos_pedido_id').focus()
    await user.keyboard('{Enter}')
    await user.click(screen.getByRole('option', { name: 'SET NULL' }))

    expect(screen.getByRole('alert')).toHaveTextContent(SET_NULL_WARNING)
    // La regla se guarda igual: es una regla válida del archivo.
    const relation = (useAppStore.getState().model?.relations ?? []).find(
      (item) => item.name === 'fk_pagos_pedido_id',
    )
    expect(relation?.onDelete).toBe('set_null')

    await user.click(screen.getByRole('button', { name: CLEAR_NOT_NULL_ACTION }))

    const field = tableNamed('pagos').fields.find((item) => item.name === 'pedido_id')
    expect(field?.nullable).toBe(true)
    expect(screen.queryByText(SET_NULL_WARNING)).toBeNull()
  })

  it('con la columna ya nula, SET NULL no avisa (FR-030)', async () => {
    const user = userEvent.setup()
    // `metodo_id` sí admite nulos, y su regla ya es SET NULL en el ejemplo.
    expect(screen.getByLabelText('ON DELETE de fk_pagos_metodo_id')).toHaveTextContent('SET NULL')

    expect(screen.queryByText(SET_NULL_WARNING)).toBeNull()
    await user.keyboard('{Escape}')
  })

  it('«Referenciada por» dice quién apunta a la tabla y lleva allí (FR-031)', async () => {
    renderTab('clientes')

    const section = screen.getByRole('region', { name: 'Referenciada por' })
    expect(section).toHaveTextContent('pedidos.cliente_id')
    expect(section).toHaveTextContent('pedidos.responsable_id')

    await userEvent.click(screen.getByRole('button', { name: /pedidos\.cliente_id/ }))

    expect(useAppStore.getState().selectedTable).toBe('pedidos')
    expect(useAppStore.getState().fieldsPanelTable).toBe('pedidos')
  })

  it('sin nadie que la referencie, la sección no se dibuja (FR-032)', () => {
    renderTab('comentarios')

    expect(screen.queryByRole('region', { name: 'Referenciada por' })).toBeNull()
  })

  it('eliminar quita la fila, la línea y la marca FK, y conserva el campo (FR-035, FR-042)', async () => {
    const user = userEvent.setup()
    const remove = screen.getAllByRole('button', { name: 'Eliminar la clave foránea' })[0]
    if (remove === undefined) throw new Error('no hay botón de eliminar')

    await user.click(remove)

    // La fila se va de la rejilla y queda la otra.
    expect(screen.queryByLabelText('Columna de fk_pagos_pedido_id')).toBeNull()
    expect(screen.getByLabelText('Columna de fk_pagos_metodo_id')).toBeInTheDocument()

    const model = useAppStore.getState().model as Model
    // La columna se conserva entera: lo que se borra es la relación.
    const field = tableNamed('pagos').fields.find((item) => item.name === 'pedido_id')
    expect(field).toEqual({ name: 'pedido_id', type: 'integer' })
    // Y las otras tres vistas dicen lo mismo: ni marca ni línea.
    expect(fieldMarks(tableNamed('pagos'), model.relations ?? []).get('pedido_id')).toBeNull()
    expect(
      relationLayer(model, resolveLayout(model), 'orthogonal').map((line) => line.name),
    ).not.toContain('fk_pagos_pedido_id')
    // El foco se queda en el panel, en la rejilla que sigue ahí.
    expect(screen.getByRole('grid', { name: 'Claves foráneas de pagos' })).toBeInTheDocument()
  })

  it('con dos relaciones sobre el mismo campo, la marca FK se mantiene (FR-035)', async () => {
    const user = userEvent.setup()
    act(() => {
      const model = useAppStore.getState().model as Model
      useAppStore.setState({
        model: {
          ...model,
          relations: [
            ...(model.relations ?? []),
            {
              name: 'fk_pagos_pedido_id_2',
              fromTable: 'pagos',
              fromFields: ['pedido_id'],
              toTable: 'pedidos',
              toFields: ['id'],
            },
          ],
        },
      })
    })

    await user.click(screen.getAllByRole('button', { name: 'Eliminar la clave foránea' })[0] as HTMLElement)

    const model = useAppStore.getState().model as Model
    expect(fieldMarks(tableNamed('pagos'), model.relations ?? []).get('pedido_id')).toBe('FK')
  })

  it('la rejilla tiene una sola parada de tabulador (FR-038)', () => {
    const stops = screen
      .getByRole('grid', { name: 'Claves foráneas de pagos' })
      .querySelectorAll('[tabindex="0"]')

    expect(stops).toHaveLength(1)
  })
})
