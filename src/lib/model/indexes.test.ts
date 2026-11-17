import { describe, expect, it } from 'vitest'

import {
  EMPTY_CONSTRAINT_NAME_MESSAGE,
  INVALID_CONSTRAINT_NAME_MESSAGE,
  TAKEN_CONSTRAINT_NAME_MESSAGE,
  automaticIndexes,
  constraintNameProblem,
  constraintNames,
  duplicateOf,
  fieldDependents,
  fieldDependentsMessages,
  isProposedName,
  proposeConstraintName,
  proposeIndexField,
  proposeUniqueFields,
  splitUniques,
} from '@/lib/model/indexes'
import type { Model, Table } from '@/lib/model/types'

/**
 * Dominio de los índices y los únicos (contracts/indexes.md §1).
 *
 * Los ejemplos fijados usan la tabla del contrato:
 * `pago (id PK, residente_id FK, concepto, mes)`.
 */

/** La tabla del contrato, con lo que se le añada. */
function pago(extra: Partial<Table> = {}): Table {
  return {
    name: 'pago',
    schema: 'finanzas',
    fields: [
      { name: 'id', type: 'integer' },
      { name: 'residente_id', type: 'integer' },
      { name: 'concepto', type: 'text' },
      { name: 'mes', type: 'date' },
    ],
    primaryKey: ['id'],
    ...extra,
  }
}

/** Modelo con la tabla `pago`, `residente` y la clave foránea entre ellas. */
function modelWith(table: Table = pago(), others: Table[] = []): Model {
  return {
    formatVersion: 1,
    name: 'Prueba',
    engine: 'postgres',
    schemas: [{ name: 'finanzas', abbreviation: 'FIN' }],
    tables: [
      table,
      { name: 'residente', schema: 'finanzas', fields: [{ name: 'id', type: 'integer' }], primaryKey: ['id'] },
      ...others,
    ],
    relations: [
      {
        name: 'fk_pago_residente_id',
        fromTable: 'pago',
        fromFields: ['residente_id'],
        toTable: 'residente',
        toFields: ['id'],
      },
    ],
  }
}

describe('automaticIndexes (FR-021, research R9)', () => {
  it('el ejemplo fijado: solo la llave primaria', () => {
    expect(automaticIndexes(pago())).toEqual([
      { name: 'pk_pago', fields: ['id'], kind: 'PRIMARY KEY' },
    ])
  })

  it('después de la llave, cada único con su nombre real', () => {
    const table = pago({
      uniques: [
        { name: 'uq_raro', fields: ['concepto'] },
        { name: 'uq_pago_residente_id_mes', fields: ['residente_id', 'mes'] },
      ],
    })
    expect(automaticIndexes(table).map((item) => `${item.kind} ${item.name}`)).toEqual([
      'PRIMARY KEY pk_pago',
      'UNIQUE uq_raro',
      'UNIQUE uq_pago_residente_id_mes',
    ])
  })

  it('vacía sin llave ni únicos', () => {
    const table = pago()
    delete table.primaryKey
    expect(automaticIndexes(table)).toEqual([])
  })
})

describe('splitUniques (research R13)', () => {
  it('separa por número de columnas y conserva el orden', () => {
    const table = pago({
      uniques: [
        { name: 'b', fields: ['residente_id', 'mes'] },
        { name: 'a', fields: ['concepto'] },
      ],
    })
    expect(splitUniques(table)).toEqual({
      single: [{ name: 'a', fields: ['concepto'] }],
      compound: [{ name: 'b', fields: ['residente_id', 'mes'] }],
    })
  })
})

describe('constraintNames', () => {
  it('reúne índices y únicos de todas las tablas', () => {
    const model = modelWith(
      pago({ indexes: [{ name: 'idx_a', fields: ['mes'] }], uniques: [{ name: 'uq_b', fields: ['concepto'] }] }),
    )
    expect([...constraintNames(model)].sort()).toEqual(['idx_a', 'uq_b'])
  })
})

describe('nombres propuestos (FR-024, FR-034, research R10)', () => {
  it('los ejemplos fijados', () => {
    expect(proposeConstraintName('idx_', 'pago', ['residente_id'], new Set())).toBe(
      'idx_pago_residente_id',
    )
    expect(
      proposeConstraintName('idx_', 'pago', ['residente_id'], new Set(['idx_pago_residente_id'])),
    ).toBe('idx_pago_residente_id_2')
    expect(proposeConstraintName('uq_', 'pago', ['residente_id', 'mes'], new Set())).toBe(
      'uq_pago_residente_id_mes',
    )
  })

  it('recorta a 63 y el sufijo cabe dentro', () => {
    const fields = ['columna_muy_larga_numero_uno', 'columna_muy_larga_numero_dos']
    const first = proposeConstraintName('idx_', 'pago', fields, new Set())
    expect(first.length).toBeLessThanOrEqual(63)
    const second = proposeConstraintName('idx_', 'pago', fields, new Set([first]))
    expect(second).toHaveLength(first.length <= 61 ? first.length + 2 : 63)
    expect(second.endsWith('_2')).toBe(true)
  })

  it('isProposedName reconoce la propuesta con y sin sufijo', () => {
    expect(isProposedName('idx_', 'pago', ['residente_id'], 'idx_pago_residente_id')).toBe(true)
    expect(isProposedName('idx_', 'pago', ['residente_id'], 'idx_pago_residente_id_2')).toBe(true)
    expect(isProposedName('idx_', 'pago', ['residente_id'], 'idx_pago_residente_id_1')).toBe(false)
    expect(isProposedName('idx_', 'pago', ['residente_id'], 'por_residente')).toBe(false)
    expect(isProposedName('idx_', 'pago', ['mes'], 'idx_pago_residente_id')).toBe(false)
  })
})

describe('columnas propuestas (FR-023, FR-033)', () => {
  it('el ejemplo fijado: la clave foránea sin índice', () => {
    expect(proposeIndexField(modelWith(), 'pago')).toBe('residente_id')
  })

  it('con la clave foránea indexada, el primer campo fuera de la llave', () => {
    const model = modelWith(pago({ indexes: [{ name: 'idx', fields: ['residente_id'] }] }))
    expect(proposeIndexField(model, 'pago')).toBe('residente_id')
    const sinRelaciones: Model = { ...model, relations: [] }
    expect(proposeIndexField(sinRelaciones, 'pago')).toBe('residente_id')
    const sinFk = modelWith(pago({ fields: [{ name: 'id', type: 'integer' }, { name: 'mes', type: 'date' }] }))
    expect(proposeIndexField({ ...sinFk, relations: [] }, 'pago')).toBe('mes')
  })

  it('con todos los campos en la llave, el primero', () => {
    const table = pago({ fields: [{ name: 'id', type: 'integer' }] })
    expect(proposeIndexField({ ...modelWith(table), relations: [] }, 'pago')).toBe('id')
  })

  it('el ejemplo fijado de un único, y el relleno con la llave', () => {
    expect(proposeUniqueFields(pago())).toEqual(['residente_id', 'concepto'])
    const dos = pago({ fields: [{ name: 'id', type: 'integer' }, { name: 'mes', type: 'date' }] })
    expect(proposeUniqueFields(dos)).toEqual(['mes', 'id'])
    expect(proposeUniqueFields(pago({ fields: [{ name: 'id', type: 'integer' }] }))).toBeNull()
  })
})

describe('constraintNameProblem (FR-027, FR-036)', () => {
  const model = modelWith(pago({ indexes: [{ name: 'idx_pago_mes', fields: ['mes'] }] }))

  it('vacío, forma inválida, largo y repetido', () => {
    expect(constraintNameProblem(model, '', null)).toBe(EMPTY_CONSTRAINT_NAME_MESSAGE)
    expect(constraintNameProblem(model, '1idx', null)).toBe(INVALID_CONSTRAINT_NAME_MESSAGE)
    expect(constraintNameProblem(model, 'Idx', null)).toBe(INVALID_CONSTRAINT_NAME_MESSAGE)
    expect(constraintNameProblem(model, 'i'.repeat(64), null)).not.toBeNull()
    expect(constraintNameProblem(model, 'idx_pago_mes', null)).toBe(TAKEN_CONSTRAINT_NAME_MESSAGE)
  })

  it('el que se edita no choca consigo mismo', () => {
    expect(constraintNameProblem(model, 'idx_pago_mes', 'idx_pago_mes')).toBeNull()
    expect(constraintNameProblem(model, 'otro', 'idx_pago_mes')).toBeNull()
  })
})

describe('duplicateOf (FR-028, FR-037)', () => {
  const table = pago({
    uniques: [{ name: 'uq_a', fields: ['residente_id', 'mes'] }],
    indexes: [{ name: 'idx_b', fields: ['concepto'] }],
  })

  it('encuentra la llave, un único o un índice con las mismas columnas en el mismo orden', () => {
    expect(duplicateOf(table, ['id'], 'nuevo')).toBe('pk_pago')
    expect(duplicateOf(table, ['residente_id', 'mes'], 'nuevo')).toBe('uq_a')
    expect(duplicateOf(table, ['concepto'], 'nuevo')).toBe('idx_b')
  })

  it('el orden cuenta, y el que se edita no se compara consigo', () => {
    expect(duplicateOf(table, ['mes', 'residente_id'], 'nuevo')).toBeNull()
    expect(duplicateOf(table, ['concepto'], 'idx_b')).toBeNull()
  })
})

describe('fieldDependents (FR-039, research R15)', () => {
  const table = pago({
    uniques: [
      { name: 'uq_pago_concepto', fields: ['concepto'] },
      { name: 'uq_pago_residente_id_mes', fields: ['residente_id', 'mes'] },
    ],
    indexes: [
      { name: 'idx_dos', fields: ['mes', 'concepto'] },
      { name: 'idx_uno', fields: ['mes'] },
      { name: 'idx_unico', fields: ['mes', 'residente_id'], unique: true },
    ],
  })

  it('el ejemplo fijado y los tres destinos de un índice', () => {
    expect(fieldDependents(table, 'mes')).toEqual({
      shrunk: ['idx_dos'],
      removedIndexes: ['idx_uno', 'idx_unico'],
      removedUniques: ['uq_pago_residente_id_mes'],
    })
  })

  it('el único de un campo no es un dependiente', () => {
    expect(fieldDependents(table, 'concepto')).toEqual({
      shrunk: ['idx_dos'],
      removedIndexes: [],
      removedUniques: [],
    })
  })

  it('las frases de la confirmación', () => {
    expect(fieldDependentsMessages(fieldDependents(table, 'mes'))).toEqual([
      'El índice idx_dos perderá esta columna.',
      'El índice idx_uno se eliminará con él.',
      'El índice idx_unico se eliminará con él.',
      'El único uq_pago_residente_id_mes se eliminará con él.',
    ])
  })
})
