import { describe, expect, it } from 'vitest'

import {
  DUPLICATE_VALUES_MESSAGE,
  EMPTY_ENUM_NAME_MESSAGE,
  EMPTY_VALUES_MESSAGE,
  NO_VALUES_MESSAGE,
  TAKEN_ENUM_NAME_MESSAGE,
  cleanEnumValue,
  deleteEnumDescription,
  dropEnums,
  duplicateEnumName,
  enumNameProblem,
  enumUsage,
  enumValueProblems,
  renameEnumInFields,
  replacementTypeOf,
  typeKindOf,
} from '@/lib/model/enums'
import type { Engine, Enum, Model, Table } from '@/lib/model/types'

/**
 * Dominio de los enums (contracts/enums.md §1).
 *
 * Cada garantía del contrato tiene su caso, y los ejemplos fijados van tal
 * cual: son los que la pantalla y el recorrido dan por hechos.
 */

/** Tabla de prueba con los campos que se le pasen, como `nombre:tipo`. */
function tableWith(name: string, fields: string[]): Table {
  return {
    name,
    schema: 'finanzas',
    fields: fields.map((item) => {
      const [field, type] = item.split(':') as [string, string]
      return { name: field, type }
    }),
    primaryKey: ['id'],
  }
}

/** Modelo de prueba: dos tablas, el enum `estado_pago` usado por dos campos. */
function modelWith(engine: Engine = 'postgres', enums?: Enum[]): Model {
  return {
    formatVersion: 1,
    name: 'Prueba',
    engine,
    schemas: [{ name: 'finanzas', abbreviation: 'FIN' }],
    enums: enums ?? [
      { name: 'estado_pago', schema: 'finanzas', values: ['pendiente', 'pagado'] },
      { name: 'sin_uso', schema: 'finanzas', values: ['a'] },
    ],
    tables: [
      tableWith('pago', ['id:integer', 'estado:estado_pago', 'nota:text']),
      tableWith('cuota', ['id:integer', 'estado:estado_pago']),
    ],
  }
}

describe('typeKindOf (research R1)', () => {
  it('distingue tipo del motor, enum y desconocido', () => {
    const model = modelWith()
    expect(typeKindOf(model, 'estado_pago')).toBe('enum')
    expect(typeKindOf(model, 'integer')).toBe('engine')
    expect(typeKindOf(model, 'geometria')).toBe('unknown')
  })

  it('el tipo del motor gana al enum del mismo nombre', () => {
    const model = modelWith('postgres', [{ name: 'text', schema: 'finanzas', values: ['a'] }])
    expect(typeKindOf(model, 'text')).toBe('engine')
  })
})

describe('enumUsage (research R19)', () => {
  it('lista los campos en el orden de las tablas y de sus campos', () => {
    expect(enumUsage(modelWith(), 'estado_pago')).toEqual([
      { table: 'pago', field: 'estado' },
      { table: 'cuota', field: 'estado' },
    ])
  })

  it('vacía si nadie lo usa o si el nombre es un tipo del motor', () => {
    expect(enumUsage(modelWith(), 'sin_uso')).toEqual([])
    expect(enumUsage(modelWith(), 'text')).toEqual([])
  })
})

describe('enumNameProblem (FR-005)', () => {
  it('vacío, repetido o tipo del motor', () => {
    const model = modelWith()
    expect(enumNameProblem(model, '', null)).toBe(EMPTY_ENUM_NAME_MESSAGE)
    expect(enumNameProblem(model, 'sin_uso', null)).toBe(TAKEN_ENUM_NAME_MESSAGE)
    expect(enumNameProblem(model, 'integer', null)).toBe('Ese nombre ya lo usa otro tipo.')
    expect(enumNameProblem(model, 'x'.repeat(64), null)).not.toBeNull()
  })

  it('el enum que se edita no choca consigo mismo', () => {
    expect(enumNameProblem(modelWith(), 'estado_pago', 'estado_pago')).toBeNull()
    expect(enumNameProblem(modelWith(), 'estado_cobro', null)).toBeNull()
  })

  it('un tipo de otro motor sí sirve como nombre', () => {
    expect(enumNameProblem(modelWith('sqlite'), 'varchar', null)).toBeNull()
  })
})

describe('cleanEnumValue (FR-007)', () => {
  it('quita las comillas simples y recorta a 63', () => {
    expect(cleanEnumValue("o'neil")).toBe('oneil')
    expect(cleanEnumValue('a'.repeat(80))).toHaveLength(63)
    expect(cleanEnumValue(' con espacios ')).toBe(' con espacios ')
  })
})

describe('enumValueProblems (FR-006, FR-007)', () => {
  it('el ejemplo fijado: repetido sin mayúsculas ni espacios, y vacío', () => {
    expect(enumValueProblems(['activo', ' Activo ', ''])).toEqual({
      rows: [null, 'duplicate', 'empty'],
      message: DUPLICATE_VALUES_MESSAGE,
    })
  })

  it('sin valores', () => {
    expect(enumValueProblems([])).toEqual({ rows: [], message: NO_VALUES_MESSAGE })
  })

  it('solo vacíos dice vacíos, y una lista limpia no dice nada', () => {
    expect(enumValueProblems(['a', '  ']).message).toBe(EMPTY_VALUES_MESSAGE)
    expect(enumValueProblems(['a', 'b'])).toEqual({ rows: [null, null], message: null })
  })

  it('marca la segunda aparición y las siguientes, no la primera', () => {
    expect(enumValueProblems(['a', 'b', 'a', 'A']).rows).toEqual([null, null, 'duplicate', 'duplicate'])
  })
})

describe('duplicateEnumName (FR-020)', () => {
  it('el ejemplo fijado: numera si la copia ya existe', () => {
    const model = modelWith('postgres', [
      { name: 'estado_pago', schema: 'finanzas', values: ['a'] },
      { name: 'estado_pago_copia', schema: 'finanzas', values: ['a'] },
    ])
    expect(duplicateEnumName(model, 'estado_pago')).toBe('estado_pago_copia_2')
    expect(duplicateEnumName(modelWith(), 'sin_uso')).toBe('sin_uso_copia')
  })

  it('recorta el original para que el sufijo quepa en 63', () => {
    const long = 'e'.repeat(63)
    const name = duplicateEnumName(modelWith(), long)
    expect(name).toHaveLength(63)
    expect(name.endsWith('_copia')).toBe(true)
  })
})

describe('renameEnumInFields (research R2)', () => {
  it('cambia el tipo de todos los campos y nada más', () => {
    const model = modelWith()
    const pago = model.tables?.[0]
    if (pago !== undefined) pago.fields[1] = { name: 'estado', type: 'estado_pago', default: "'pendiente'" }
    const next = renameEnumInFields(model, 'estado_pago', 'estado_cobro')

    expect(enumUsage(next, 'estado_cobro')).toHaveLength(2)
    expect(enumUsage(next, 'estado_pago')).toHaveLength(0)
    expect(next.tables?.[0]?.fields[1]).toEqual({
      name: 'estado',
      type: 'estado_cobro',
      default: "'pendiente'",
    })
  })

  it('devuelve el mismo modelo si nadie lo usa o si es un tipo del motor', () => {
    const model = modelWith()
    expect(renameEnumInFields(model, 'sin_uso', 'otro')).toBe(model)
    expect(renameEnumInFields(model, 'text', 'otro')).toBe(model)
  })
})

describe('replacementTypeOf (research R3)', () => {
  it('los ejemplos fijados de los tres motores', () => {
    expect(replacementTypeOf('postgres')).toEqual({ type: 'varchar', length: 40 })
    expect(replacementTypeOf('mysql')).toEqual({ type: 'varchar', length: 40 })
    expect(replacementTypeOf('sqlite')).toEqual({ type: 'text' })
  })
})

describe('dropEnums (FR-018, FR-019)', () => {
  it('quita el enum y pasa sus campos a varchar(40)', () => {
    const next = dropEnums(modelWith(), ['estado_pago'])

    expect(next.enums?.map((item) => item.name)).toEqual(['sin_uso'])
    expect(next.tables?.[0]?.fields[1]).toEqual({ name: 'estado', type: 'varchar', length: 40 })
    expect(next.tables?.[1]?.fields[1]).toEqual({ name: 'estado', type: 'varchar', length: 40 })
  })

  it('en SQLite pasan a text sin longitud', () => {
    const next = dropEnums(modelWith('sqlite'), ['estado_pago'])
    expect(next.tables?.[0]?.fields[1]).toEqual({ name: 'estado', type: 'text' })
  })

  it('omite la lista si queda vacía', () => {
    expect(dropEnums(modelWith(), ['estado_pago', 'sin_uso']).enums).toBeUndefined()
  })
})

describe('deleteEnumDescription (FR-016, FR-017)', () => {
  it('nombra los campos y el tipo, en plural y en singular', () => {
    const usage = enumUsage(modelWith(), 'estado_pago')
    expect(deleteEnumDescription(usage, replacementTypeOf('postgres'))).toBe(
      '2 campos lo usan (pago.estado, cuota.estado) y pasarán a varchar(40).',
    )
    expect(deleteEnumDescription(usage.slice(0, 1), replacementTypeOf('sqlite'))).toBe(
      '1 campo lo usa (pago.estado) y pasará a text.',
    )
    expect(deleteEnumDescription([], replacementTypeOf('postgres'))).toBe('Ningún campo lo usa.')
  })
})
