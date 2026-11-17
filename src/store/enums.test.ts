import { beforeEach, describe, expect, it } from 'vitest'

import { readFixture } from '@/lib/model/__fixtures__'
import { enumUsage } from '@/lib/model/enums'
import { parseModel } from '@/lib/model/parse'
import type { Engine, Model } from '@/lib/model/types'
import { useAppStore } from '@/store'
import {
  CREATE_ENUM_LABEL,
  DELETE_ENUM_LABEL,
  DUPLICATE_ENUM_LABEL,
  UPDATE_ENUM_LABEL,
} from '@/store/enums'
import { resetStore } from '@/test/helpers'

/**
 * Las cuatro acciones de los enums (contracts/enums.md §2).
 *
 * De cada una se afirma que cambia el modelo como dice el contrato, que entra
 * en el historial como **un** paso con su etiqueta y que ⌘Z lo devuelve
 * exactamente al estado anterior (FR-041, SC-006).
 */

/** El modelo de ejemplo del incremento: `estado_pago` lo usan pago y cuota. */
function enums(engine: Engine = 'postgres'): Model {
  const result = parseModel(readFixture('modelo-enums'))
  if (!result.ok) throw new Error('el ejemplo no es un modelo válido')
  return { ...result.model, engine }
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

/** La etiqueta del último paso del historial. */
function lastLabel(): string | undefined {
  const { past } = useAppStore.getState()
  return past[past.length - 1]?.label
}

/** El tipo de un campo del modelo del almacén. */
function typeOf(table: string, field: string): string | undefined {
  return (current().tables ?? [])
    .find((item) => item.name === table)
    ?.fields.find((item) => item.name === field)?.type
}

describe('crear y editar (FR-002 a FR-015, US1)', () => {
  beforeEach(() => openModel(enums()))

  it('crea al final de la lista, marca «Editado» y cierra la hoja', () => {
    useAppStore.setState({ dialog: 'enum', enumTarget: null })
    const ok = useAppStore
      .getState()
      .createEnum({ name: 'canal', schema: 'personas', values: ['correo', 'sms', 'app'] })

    expect(ok).toBe(true)
    const list = current().enums ?? []
    expect(list[list.length - 1]).toEqual({
      name: 'canal',
      schema: 'personas',
      values: ['correo', 'sms', 'app'],
    })
    expect(useAppStore.getState().isDirty).toBe(true)
    expect(useAppStore.getState().dialog).toBeNull()
    expect(lastLabel()).toBe(CREATE_ENUM_LABEL)
  })

  it('un solo paso que ⌘Z deshace', () => {
    const before = current()
    useAppStore.getState().createEnum({ name: 'canal', schema: 'personas', values: ['a'] })
    expect(useAppStore.getState().past).toHaveLength(1)

    useAppStore.getState().undo()

    expect(current()).toEqual(before)
    expect(useAppStore.getState().isDirty).toBe(false)
  })

  it('un borrador inválido no cambia nada', () => {
    const before = current()
    const store = useAppStore.getState()

    expect(store.createEnum({ name: 'estado_pago', schema: 'personas', values: ['a'] })).toBe(false)
    expect(store.createEnum({ name: 'canal', schema: 'personas', values: [] })).toBe(false)
    expect(store.createEnum({ name: 'canal', schema: 'personas', values: ['a', 'A'] })).toBe(false)
    expect(store.createEnum({ name: 'canal', schema: 'fantasma', values: ['a'] })).toBe(false)
    expect(store.createEnum({ name: 'integer', schema: 'personas', values: ['a'] })).toBe(false)

    expect(current()).toBe(before)
    expect(useAppStore.getState().past).toHaveLength(0)
  })

  it('editar valores y esquema no toca los campos que lo usan (FR-014)', () => {
    useAppStore.getState().updateEnum('estado_pago', {
      name: 'estado_pago',
      schema: 'personas',
      values: ['anulado', 'pendiente', 'pagado'],
    })

    const edited = current().enums?.find((item) => item.name === 'estado_pago')
    expect(edited).toEqual({
      name: 'estado_pago',
      schema: 'personas',
      values: ['anulado', 'pendiente', 'pagado'],
    })
    expect(typeOf('pago', 'estado')).toBe('estado_pago')
    expect(typeOf('cuota', 'estado')).toBe('estado_pago')
    expect(lastLabel()).toBe(UPDATE_ENUM_LABEL)
  })

  it('conserva la descripción, que la hoja no edita', () => {
    useAppStore.getState().updateEnum('tipo_documento', {
      name: 'tipo_documento',
      schema: 'personas',
      values: ['cedula'],
    })

    expect(current().enums?.find((item) => item.name === 'tipo_documento')?.comment).toBe(
      'Todavía sin uso',
    )
  })
})

describe('renombrar en uso (FR-015, SC-003, US2)', () => {
  beforeEach(() => openModel(enums()))

  it('los campos que lo usaban pasan al nombre nuevo', () => {
    useAppStore.getState().updateEnum('estado_pago', {
      name: 'estado_cobro',
      schema: 'finanzas',
      values: ['pendiente', 'pagado', 'vencido', 'anulado'],
    })

    expect(typeOf('pago', 'estado')).toBe('estado_cobro')
    expect(typeOf('cuota', 'estado')).toBe('estado_cobro')
    expect(enumUsage(current(), 'estado_pago')).toEqual([])
    expect(useAppStore.getState().past).toHaveLength(1)
  })

  it('un solo deshacer devuelve el enum y los campos a la vez', () => {
    const before = current()
    useAppStore.getState().updateEnum('estado_pago', {
      name: 'estado_cobro',
      schema: 'finanzas',
      values: ['pendiente'],
    })

    useAppStore.getState().undo()

    expect(current()).toEqual(before)
  })
})

describe('duplicar (FR-020, US2)', () => {
  beforeEach(() => openModel(enums()))

  it('la copia va justo después del original, en su esquema y sin uso', () => {
    const name = useAppStore.getState().duplicateEnum('estado_pago')

    expect(name).toBe('estado_pago_copia')
    const names = (current().enums ?? []).map((item) => item.name)
    expect(names.indexOf('estado_pago_copia')).toBe(names.indexOf('estado_pago') + 1)
    const copy = current().enums?.find((item) => item.name === 'estado_pago_copia')
    expect(copy).toEqual({
      name: 'estado_pago_copia',
      schema: 'finanzas',
      values: ['pendiente', 'pagado', 'vencido', 'anulado'],
    })
    expect(enumUsage(current(), 'estado_pago_copia')).toEqual([])
    expect(lastLabel()).toBe(DUPLICATE_ENUM_LABEL)
  })
})

describe('eliminar (FR-016 a FR-018, SC-004, US2)', () => {
  it('quita el enum, pasa sus campos a varchar(40) y cierra lo abierto', () => {
    openModel(enums())
    useAppStore.setState({ dialog: 'delete-enum', enumTarget: 'estado_pago' })

    useAppStore.getState().deleteEnum('estado_pago')

    expect(current().enums?.some((item) => item.name === 'estado_pago')).toBe(false)
    const estado = (current().tables ?? [])
      .find((item) => item.name === 'pago')
      ?.fields.find((item) => item.name === 'estado')
    expect(estado).toEqual({ name: 'estado', type: 'varchar', length: 40 })
    expect(typeOf('cuota', 'estado')).toBe('varchar')
    expect(useAppStore.getState().dialog).toBeNull()
    expect(useAppStore.getState().enumTarget).toBeNull()
    expect(lastLabel()).toBe(DELETE_ENUM_LABEL)
  })

  it('con SQLite pasan a text sin longitud', () => {
    openModel(enums('sqlite'))

    useAppStore.getState().deleteEnum('estado_pago')

    const estado = (current().tables ?? [])
      .find((item) => item.name === 'pago')
      ?.fields.find((item) => item.name === 'estado')
    expect(estado).toEqual({ name: 'estado', type: 'text' })
  })

  it('un solo deshacer lo devuelve todo', () => {
    openModel(enums())
    const before = current()

    useAppStore.getState().deleteEnum('estado_pago')
    useAppStore.getState().undo()

    expect(current()).toEqual(before)
  })
})
