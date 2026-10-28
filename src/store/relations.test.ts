import { beforeEach, describe, expect, it } from 'vitest'

import { readFixture } from '@/lib/model/__fixtures__'
import { fieldMarks } from '@/lib/model/marks'
import { parseModel } from '@/lib/model/parse'
import type { Model, Relation, Table } from '@/lib/model/types'
import { useAppStore } from '@/store'
import {
  addForeignKeyNotice,
  CLEAR_NOT_NULL_LABEL,
  DELETE_FOREIGN_KEY_LABEL,
  EDIT_FOREIGN_KEY_LABEL,
  NO_SELECTION_MESSAGE,
  NO_TARGET_ERROR,
  REFERENTIAL_ACTION_LABEL,
  SELF_COLUMN_ERROR,
} from '@/store/relations'
import { resetStore } from '@/test/helpers'

/**
 * Pruebas de las seis acciones de claves foráneas (contracts/relations.md §2).
 *
 * Lo que se afirma de cada una es siempre lo mismo: que cambia el modelo como
 * dice el contrato, que entra en el historial como **un** paso con su
 * etiqueta y que ⌘Z lo devuelve exactamente al estado anterior (FR-012,
 * SC-006).
 */

/** El modelo de ejemplo del incremento, con sus seis relaciones. */
function relaciones(): Model {
  const result = parseModel(readFixture('modelo-relaciones'))
  if (!result.ok) throw new Error('el ejemplo no es un modelo válido')
  return result.model
}

/** Deja el almacén con ese modelo ya «guardado». */
function openModel(model: Model) {
  resetStore()
  useAppStore.setState({ screen: 'editor', model, savedModel: model, isDirty: false })
}

/** El modelo que hay en el almacén ahora mismo. */
function current(): Model {
  const { model } = useAppStore.getState()
  if (model === null) throw new Error('no hay modelo')
  return model
}

/** Una tabla del modelo del almacén. */
function tableOf(name: string): Table {
  const table = (current().tables ?? []).find((item) => item.name === name)
  if (table === undefined) throw new Error(`no hay tabla ${name}`)
  return table
}

/** Una relación del modelo del almacén, o `undefined` si ya no está. */
function relationOf(name: string): Relation | undefined {
  return (current().relations ?? []).find((item) => item.name === name)
}

/** La etiqueta del último paso del historial. */
function lastLabel(): string | undefined {
  const { past } = useAppStore.getState()
  return past[past.length - 1]?.label
}

describe('requestForeignKey (FR-001 a FR-003)', () => {
  beforeEach(() => openModel(relaciones()))

  it('abre la ficha de la tabla que se le pasa y dice qué hacer', () => {
    useAppStore.getState().requestForeignKey('pedidos')

    const state = useAppStore.getState()
    expect(state.isFieldsPanelOpen).toBe(true)
    expect(state.fieldsPanelTable).toBe('pedidos')
    expect(state.panelTab).toBe('foreignKeys')
    expect(state.selectedTable).toBe('pedidos')
    expect(state.notice).toBe(addForeignKeyNotice('pedidos'))
  })

  it('sin tabla, usa la seleccionada', () => {
    useAppStore.setState({ selectedTable: 'pagos' })

    useAppStore.getState().requestForeignKey()

    expect(useAppStore.getState().fieldsPanelTable).toBe('pagos')
  })

  it('sin selección pide elegir la tabla y no toca el modelo (FR-002)', () => {
    const before = current()

    useAppStore.getState().requestForeignKey()

    const state = useAppStore.getState()
    expect(state.notice).toBe(NO_SELECTION_MESSAGE)
    expect(state.isFieldsPanelOpen).toBe(false)
    expect(state.model).toBe(before)
    expect(state.past).toHaveLength(0)
  })

  it('no crea ninguna relación: solo abre la ficha (FR-001)', () => {
    useAppStore.getState().requestForeignKey('pedidos')

    expect((current().relations ?? []).length).toBe(6)
  })
})

describe('addForeignKey (FR-004, FR-005)', () => {
  beforeEach(() => openModel(relaciones()))

  it('crea la columna propuesta y la relación en un solo paso', () => {
    const before = useAppStore.getState().past.length

    const error = useAppStore.getState().addForeignKey('metodos_pago', 'clientes')

    expect(error).toBeNull()
    const column = tableOf('metodos_pago').fields.at(-1)
    expect(column).toEqual({ name: 'clientes_id', type: 'integer' })
    expect(relationOf('fk_metodos_pago_clientes_id')).toMatchObject({
      fromTable: 'metodos_pago',
      fromFields: ['clientes_id'],
      toTable: 'clientes',
      toFields: ['id'],
    })
    expect(useAppStore.getState().past).toHaveLength(before + 1)
    expect(lastLabel()).toBe(EDIT_FOREIGN_KEY_LABEL)
    expect(useAppStore.getState().isDirty).toBe(true)
  })

  it('las dos reglas nacen en no_action, que no se escribe', () => {
    useAppStore.getState().addForeignKey('metodos_pago', 'clientes')

    const relation = relationOf('fk_metodos_pago_clientes_id')
    expect(relation?.onDelete).toBeUndefined()
    expect(relation?.onUpdate).toBeUndefined()
  })

  it('sin destino, elige la primera tabla a la que esta no apunta', () => {
    // `pedidos` ya apunta a `clientes` dos veces, así que la propuesta salta a
    // la siguiente tabla con llave primaria de una columna.
    useAppStore.getState().addForeignKey('pedidos')

    const added = (current().relations ?? []).at(-1)
    expect(added?.fromTable).toBe('pedidos')
    expect(added?.toTable).toBe('pagos')
  })

  it('cuando ya apunta a todas, se propone la propia tabla', () => {
    const model = relaciones()
    const dos: Model = {
      ...model,
      tables: (model.tables ?? []).filter((table) =>
        ['clientes', 'metodos_pago'].includes(table.name),
      ),
      relations: [
        {
          name: 'fk_metodos_pago_clientes_id',
          fromTable: 'metodos_pago',
          fromFields: ['nombre'],
          toTable: 'clientes',
          toFields: ['id'],
        },
      ],
    }
    openModel(dos)

    useAppStore.getState().addForeignKey('metodos_pago')

    expect((current().relations ?? []).at(-1)).toMatchObject({
      fromTable: 'metodos_pago',
      toTable: 'metodos_pago',
    })
  })

  it('con un destino de llave primaria compuesta, devuelve el motivo y no toca nada', () => {
    const before = current()

    const error = useAppStore.getState().addForeignKey('pagos', 'resenas')

    expect(error).toBe('resenas tiene llave primaria de varias columnas.')
    expect(current()).toBe(before)
    expect(useAppStore.getState().past).toHaveLength(0)
  })

  it('sin ninguna tabla con llave primaria de una columna, lo dice y no crea nada', () => {
    const model = relaciones()
    openModel({
      ...model,
      tables: (model.tables ?? [])
        .filter((table) => table.name === 'resenas')
        .map((table) => ({ ...table })),
      relations: [],
    })
    const before = current()

    expect(useAppStore.getState().addForeignKey('resenas')).toBe(NO_TARGET_ERROR)
    expect(current()).toBe(before)
  })

  it('abre la ficha de claves foráneas con el foco en la referencia', () => {
    useAppStore.getState().addForeignKey('metodos_pago', 'clientes')

    const state = useAppStore.getState()
    expect(state.isFieldsPanelOpen).toBe(true)
    expect(state.panelTab).toBe('foreignKeys')
    expect(state.focusedCell).toEqual({
      field: 'fk_metodos_pago_clientes_id',
      column: 'reference',
    })
  })

  it('crear la relación no escribe ninguna marca en el campo', () => {
    useAppStore.getState().addForeignKey('metodos_pago', 'clientes')

    const table = tableOf('metodos_pago')
    const column = table.fields.find((field) => field.name === 'clientes_id')
    // La marca no está en el campo: la deduce `fieldMarks` de la relación
    // (FR-029, FR-036).
    expect(Object.keys(column ?? {})).toEqual(['name', 'type'])
    expect(fieldMarks(table, current().relations ?? []).get('clientes_id')).toBe('FK')
  })

  it('el deshacer devuelve el modelo tal como estaba', () => {
    const before = current()

    useAppStore.getState().addForeignKey('metodos_pago', 'clientes')
    useAppStore.getState().undo()

    expect(current()).toEqual(before)
    expect(useAppStore.getState().isDirty).toBe(false)

    useAppStore.getState().redo()
    expect(relationOf('fk_metodos_pago_clientes_id')).toBeDefined()
  })
})

describe('setForeignKeyColumn (FR-008, FR-009a)', () => {
  beforeEach(() => openModel(relaciones()))

  it('cambia la columna en un paso y recoloca la marca sola', () => {
    const error = useAppStore.getState().setForeignKeyColumn('fk_pagos_metodo_id', 'importe')

    expect(error).toBeNull()
    expect(relationOf('fk_pagos_metodo_id')?.fromFields).toEqual(['importe'])
    expect(lastLabel()).toBe(EDIT_FOREIGN_KEY_LABEL)

    const marks = fieldMarks(tableOf('pagos'), current().relations ?? [])
    expect(marks.get('importe')).toBe('FK')
    expect(marks.get('metodo_id')).toBeNull()
  })

  it('no hace nada si el campo es el que ya tiene', () => {
    const before = current()

    expect(useAppStore.getState().setForeignKeyColumn('fk_pagos_metodo_id', 'metodo_id')).toBeNull()
    expect(current()).toBe(before)
  })

  it('rechaza el campo al que apunta una relación hacia su propia tabla', () => {
    const before = current()

    const error = useAppStore.getState().setForeignKeyColumn('fk_clientes_recomendado_por', 'id')

    expect(error).toBe(SELF_COLUMN_ERROR)
    expect(current()).toBe(before)
  })

  it('el deshacer devuelve la columna anterior', () => {
    const before = current()

    useAppStore.getState().setForeignKeyColumn('fk_pagos_metodo_id', 'importe')
    useAppStore.getState().undo()

    expect(current()).toEqual(before)
  })
})

describe('setForeignKeyTarget (FR-007)', () => {
  beforeEach(() => openModel(relaciones()))

  it('apunta a la llave primaria de la tabla nueva y renombra la columna del patrón', () => {
    // `metodo_id` **no** es el nombre del patrón —el patrón daría
    // `metodos_pago_id`—, así que primero se crea una columna con el nombre
    // del patrón para ver el renombrado.
    useAppStore.getState().addForeignKey('pagos', 'metodos_pago')
    const created = (current().relations ?? []).at(-1) as Relation
    expect(created.fromFields).toEqual(['metodos_pago_id'])

    useAppStore.getState().setForeignKeyTarget(created.name, 'clientes')

    const relation = relationOf(created.name)
    expect(relation).toMatchObject({ toTable: 'clientes', toFields: ['id'] })
    expect(relation?.fromFields).toEqual(['clientes_id'])
    expect(tableOf('pagos').fields.some((field) => field.name === 'clientes_id')).toBe(true)
    expect(lastLabel()).toBe(EDIT_FOREIGN_KEY_LABEL)
  })

  it('no toca la columna que el usuario había renombrado', () => {
    useAppStore.getState().setForeignKeyTarget('fk_pagos_metodo_id', 'clientes')

    const relation = relationOf('fk_pagos_metodo_id')
    expect(relation).toMatchObject({ toTable: 'clientes', toFields: ['id'] })
    expect(relation?.fromFields).toEqual(['metodo_id'])
    expect(tableOf('pagos').fields.map((field) => field.name)).toContain('metodo_id')
  })

  it('no hace nada con una tabla de llave primaria compuesta', () => {
    const before = current()

    useAppStore.getState().setForeignKeyTarget('fk_pagos_metodo_id', 'resenas')

    expect(current()).toBe(before)
  })

  it('el deshacer devuelve el destino y el nombre de la columna', () => {
    useAppStore.getState().addForeignKey('pagos', 'metodos_pago')
    const created = (current().relations ?? []).at(-1) as Relation
    const before = current()

    useAppStore.getState().setForeignKeyTarget(created.name, 'clientes')
    useAppStore.getState().undo()

    expect(current()).toEqual(before)
  })
})

describe('setReferentialAction (FR-028, FR-030)', () => {
  beforeEach(() => openModel(relaciones()))

  it('escribe la regla en un paso con su etiqueta', () => {
    useAppStore.getState().setReferentialAction('fk_pagos_metodo_id', 'onUpdate', 'cascade')

    expect(relationOf('fk_pagos_metodo_id')?.onUpdate).toBe('cascade')
    expect(lastLabel()).toBe(REFERENTIAL_ACTION_LABEL)
  })

  it('acepta las cinco acciones, set_default incluida', () => {
    for (const action of ['restrict', 'cascade', 'set_null', 'set_default'] as const) {
      useAppStore.getState().setReferentialAction('fk_pagos_metodo_id', 'onDelete', action)
      expect(relationOf('fk_pagos_metodo_id')?.onDelete).toBe(action)
    }
  })

  it('no_action quita la clave en lugar de escribirla', () => {
    useAppStore.getState().setReferentialAction('fk_pagos_pedido_id', 'onDelete', 'no_action')

    expect(relationOf('fk_pagos_pedido_id')).not.toHaveProperty('onDelete')
  })

  it('no hace nada si la regla ya vale eso', () => {
    const before = current()

    useAppStore.getState().setReferentialAction('fk_pagos_pedido_id', 'onDelete', 'cascade')
    expect(current()).toBe(before)

    // Y lo mismo con la que está ausente, que vale `no_action`.
    useAppStore.getState().setReferentialAction('fk_clientes_recomendado_por', 'onDelete', 'no_action')
    expect(current()).toBe(before)
  })

  it('el deshacer devuelve la regla anterior', () => {
    const before = current()

    useAppStore.getState().setReferentialAction('fk_pagos_pedido_id', 'onDelete', 'restrict')
    useAppStore.getState().undo()

    expect(current()).toEqual(before)
  })
})

describe('deleteForeignKey (FR-035, FR-036)', () => {
  beforeEach(() => openModel(relaciones()))

  it('quita la relación y conserva la columna entera', () => {
    const column = tableOf('pagos').fields.find((field) => field.name === 'metodo_id')

    useAppStore.getState().deleteForeignKey('fk_pagos_metodo_id')

    expect(relationOf('fk_pagos_metodo_id')).toBeUndefined()
    expect(tableOf('pagos').fields.find((field) => field.name === 'metodo_id')).toEqual(column)
    expect(fieldMarks(tableOf('pagos'), current().relations ?? []).get('metodo_id')).toBeNull()
    expect(lastLabel()).toBe(DELETE_FOREIGN_KEY_LABEL)
  })

  it('la marca FK se mantiene cuando otra relación usa el mismo campo', () => {
    // Dos relaciones sobre `pedidos.cliente_id`: al borrar una, la marca sigue
    // porque la otra la sostiene.
    const model = current()
    openModel({
      ...model,
      relations: [
        ...(model.relations ?? []),
        {
          name: 'fk_pedidos_cliente_id_2',
          fromTable: 'pedidos',
          fromFields: ['cliente_id'],
          toTable: 'clientes',
          toFields: ['id'],
        },
      ],
    })

    useAppStore.getState().deleteForeignKey('fk_pedidos_cliente_id')

    expect(fieldMarks(tableOf('pedidos'), current().relations ?? []).get('cliente_id')).toBe('FK')
  })

  it('el deshacer devuelve la relación con sus dos reglas', () => {
    const before = current()

    useAppStore.getState().setReferentialAction('fk_pagos_metodo_id', 'onUpdate', 'restrict')
    useAppStore.getState().deleteForeignKey('fk_pagos_metodo_id')
    useAppStore.getState().undo()

    expect(relationOf('fk_pagos_metodo_id')).toMatchObject({
      onDelete: 'set_null',
      onUpdate: 'restrict',
    })

    useAppStore.getState().undo()
    expect(current()).toEqual(before)
  })
})

describe('clearNotNull (FR-030)', () => {
  beforeEach(() => openModel(relaciones()))

  it('quita el «no nulo» de la columna con la etiqueta del campo', () => {
    useAppStore.getState().clearNotNull('pedidos', 'cliente_id')

    expect(tableOf('pedidos').fields.find((field) => field.name === 'cliente_id')?.nullable).toBe(
      true,
    )
    expect(lastLabel()).toBe(CLEAR_NOT_NULL_LABEL)
  })

  it('no toca una columna que ya admite nulos ni la llave primaria', () => {
    const before = current()

    useAppStore.getState().clearNotNull('pagos', 'metodo_id')
    useAppStore.getState().clearNotNull('pedidos', 'id')

    expect(current()).toBe(before)
  })

  it('el deshacer devuelve el «no nulo»', () => {
    const before = current()

    useAppStore.getState().clearNotNull('pedidos', 'cliente_id')
    useAppStore.getState().undo()

    expect(current()).toEqual(before)
  })
})
