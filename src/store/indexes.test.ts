import { beforeEach, describe, expect, it } from 'vitest'

import { readFixture } from '@/lib/model/__fixtures__'
import {
  INDEX_NEEDS_COLUMN_MESSAGE,
  TAKEN_CONSTRAINT_NAME_MESSAGE,
  UNIQUE_NEEDS_TWO_COLUMNS_MESSAGE,
} from '@/lib/model/indexes'
import { parseModel } from '@/lib/model/parse'
import type { Model, Table } from '@/lib/model/types'
import { useAppStore } from '@/store'
import {
  CREATE_INDEX_LABEL,
  CREATE_UNIQUE_LABEL,
  DELETE_INDEX_LABEL,
  UPDATE_INDEX_LABEL,
} from '@/store/indexes'
import { resetStore } from '@/test/helpers'

/**
 * Las nueve acciones de índices y únicos (contracts/indexes.md §2).
 *
 * Además de lo de siempre —el cambio, un paso con su etiqueta y ⌘Z—, aquí se
 * afirma lo que el contrato promete de más: ninguna acción deja un índice sin
 * columnas ni un único compuesto con una (research R11).
 */

/** El modelo de ejemplo del recorrido: `pago` tiene dos claves foráneas sin índice. */
function enums(): Model {
  const text = readFixture('modelo-enums')
  const result = parseModel(text)
  if (!result.ok) throw new Error('el ejemplo no es un modelo válido')
  return result.model
}

/** Deja el almacén con ese modelo ya «guardado». */
function openModel(model: Model, preferences: { indexPrefix?: string; uniquePrefix?: string } = {}) {
  resetStore({ preferences })
  useAppStore.setState({ screen: 'editor', model, savedModel: model, isDirty: false })
}

/** Una tabla del modelo del almacén. */
function tableOf(name: string): Table {
  const { model } = useAppStore.getState()
  const table = (model?.tables ?? []).find((item) => item.name === name)
  if (table === undefined) throw new Error(`no hay tabla ${name}`)
  return table
}

/** La etiqueta del último paso del historial. */
function lastLabel(): string | undefined {
  const { past } = useAppStore.getState()
  return past[past.length - 1]?.label
}

describe('índices (FR-023 a FR-029, US3)', () => {
  beforeEach(() => openModel(enums()))

  it('añadir crea uno completo con la primera clave foránea sin índice', () => {
    // En el ejemplo de pruebas, residente_id ya abre un índice de pago; la
    // primera clave foránea sin índice es cuota_id.
    const name = useAppStore.getState().addIndex('pago')

    expect(name).toBe('idx_pago_cuota_id')
    expect(tableOf('pago').indexes?.at(-1)).toEqual({ name: 'idx_pago_cuota_id', fields: ['cuota_id'] })
    expect(useAppStore.getState().isDirty).toBe(true)
    expect(lastLabel()).toBe(CREATE_INDEX_LABEL)
  })

  it('el nombre lleva el prefijo de Ajustes', () => {
    openModel(enums(), { indexPrefix: 'ix_' })
    expect(useAppStore.getState().addIndex('pago')).toBe('ix_pago_cuota_id')
  })

  it('cambiar columnas conserva el orden y repropone el nombre propuesto', () => {
    const name = useAppStore.getState().addIndex('pago') as string

    const problem = useAppStore.getState().setIndexFields('pago', name, ['mes', 'cuota_id'])

    expect(problem).toBeNull()
    expect(tableOf('pago').indexes?.at(-1)).toEqual({
      name: 'idx_pago_mes_cuota_id',
      fields: ['mes', 'cuota_id'],
    })
    expect(lastLabel()).toBe(UPDATE_INDEX_LABEL)
  })

  it('un nombre escrito a mano se conserva al cambiar columnas', () => {
    const name = useAppStore.getState().addIndex('pago') as string
    useAppStore.getState().setIndexName('pago', name, 'por_cuota')

    useAppStore.getState().setIndexFields('pago', 'por_cuota', ['cuota_id', 'mes'])

    expect(tableOf('pago').indexes?.at(-1)?.name).toBe('por_cuota')
  })

  it('sin columnas no cambia nada y devuelve el mensaje', () => {
    const name = useAppStore.getState().addIndex('pago') as string
    const before = tableOf('pago')

    expect(useAppStore.getState().setIndexFields('pago', name, [])).toBe(INDEX_NEEDS_COLUMN_MESSAGE)
    expect(tableOf('pago')).toBe(before)
  })

  it('un nombre repetido o inválido no cambia nada', () => {
    const name = useAppStore.getState().addIndex('pago') as string
    const before = tableOf('pago')

    expect(useAppStore.getState().setIndexName('pago', name, 'uq_unidad_torre_numero')).toBe(
      TAKEN_CONSTRAINT_NAME_MESSAGE,
    )
    expect(useAppStore.getState().setIndexName('pago', name, '')).not.toBeNull()
    expect(tableOf('pago')).toBe(before)
  })

  it('escribir un nombre letra a letra es un solo paso', () => {
    const name = useAppStore.getState().addIndex('pago') as string
    const steps = useAppStore.getState().past.length

    for (const next of ['p', 'po', 'por', 'por_c']) {
      const previous = tableOf('pago').indexes?.at(-1)?.name as string
      useAppStore.getState().setIndexName('pago', previous, next)
    }

    expect(tableOf('pago').indexes?.at(-1)?.name).toBe('por_c')
    expect(useAppStore.getState().past).toHaveLength(steps + 1)
    useAppStore.getState().undo()
    expect(tableOf('pago').indexes?.at(-1)?.name).toBe(name)
  })

  it('la marca de único se pone y quitarla borra la clave', () => {
    const name = useAppStore.getState().addIndex('pago') as string

    useAppStore.getState().setIndexUnique('pago', name, true)
    expect(tableOf('pago').indexes?.at(-1)).toEqual({ name, fields: ['cuota_id'], unique: true })

    useAppStore.getState().setIndexUnique('pago', name, false)
    expect(tableOf('pago').indexes?.at(-1)).toEqual({ name, fields: ['cuota_id'] })
  })

  it('eliminar el último índice quita la lista y ⌘Z lo devuelve', () => {
    const before = tableOf('cuota')

    useAppStore.getState().deleteIndex('cuota', 'idx_cuota_unidad_id')

    expect(tableOf('cuota').indexes).toBeUndefined()
    expect(lastLabel()).toBe(DELETE_INDEX_LABEL)
    useAppStore.getState().undo()
    expect(tableOf('cuota')).toEqual(before)
  })
})

describe('únicos compuestos (FR-033 a FR-036, US4)', () => {
  beforeEach(() => openModel(enums()))

  it('añadir crea uno con dos columnas y el prefijo de únicos', () => {
    const name = useAppStore.getState().addUnique('pago')

    expect(name).toBe('uq_pago_referencia_residente_id')
    expect(tableOf('pago').uniques?.at(-1)).toEqual({
      name: 'uq_pago_referencia_residente_id',
      fields: ['referencia', 'residente_id'],
    })
    expect(lastLabel()).toBe(CREATE_UNIQUE_LABEL)
  })

  it('no hace nada en una tabla de menos de dos campos', () => {
    const model = enums()
    const solo: Table = { name: 'solo', schema: 'personas', fields: [{ name: 'id', type: 'integer' }] }
    openModel({ ...model, tables: [...(model.tables ?? []), solo] })

    expect(useAppStore.getState().addUnique('solo')).toBeNull()
    expect(useAppStore.getState().past).toHaveLength(0)
  })

  it('con menos de dos columnas no cambia nada', () => {
    const before = tableOf('unidad')

    expect(
      useAppStore.getState().setUniqueFields('unidad', 'uq_unidad_torre_numero', ['torre']),
    ).toBe(UNIQUE_NEEDS_TWO_COLUMNS_MESSAGE)
    expect(tableOf('unidad')).toBe(before)
  })

  it('repropone el nombre si era el propuesto', () => {
    useAppStore
      .getState()
      .setUniqueFields('unidad', 'uq_unidad_torre_numero', ['torre', 'numero', 'residente_id'])

    expect(tableOf('unidad').uniques).toEqual([
      { name: 'uq_unidad_torre_numero_residente_id', fields: ['torre', 'numero', 'residente_id'] },
    ])
  })

  it('las acciones no tocan el único de un campo de la marca UK', () => {
    const before = tableOf('pago')

    useAppStore.getState().setUniqueName('pago', 'uq_pago_referencia', 'otro')
    useAppStore.getState().deleteUnique('pago', 'uq_pago_referencia')

    expect(tableOf('pago')).toBe(before)
  })

  it('eliminar quita el compuesto y ⌘Z lo devuelve', () => {
    const before = tableOf('unidad')

    useAppStore.getState().deleteUnique('unidad', 'uq_unidad_torre_numero')

    expect(tableOf('unidad').uniques).toBeUndefined()
    useAppStore.getState().undo()
    expect(tableOf('unidad')).toEqual(before)
  })
})
