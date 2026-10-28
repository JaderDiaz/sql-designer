import { describe, expect, it } from 'vitest'

import {
  foreignKeyTargets,
  indexStateOf,
  proposeForeignKey,
  relationName,
} from '@/lib/model/relations'
import type { Model, Table } from '@/lib/model/types'

/**
 * Dominio de la clave foránea (contracts/relations.md §1.2 y §1.3).
 *
 * Los ejemplos fijados del contrato se prueban tal cual, con los nombres del
 * lienzo de diseño —`pago`, `unidad`, `pago_cargo`— para que se puedan leer en
 * el tablero y en la prueba sin traducir.
 */

/** Modelo del tablero de diseño, recortado a lo que estas funciones leen. */
function board(): Model {
  const unidad: Table = {
    name: 'unidad',
    schema: 'public',
    fields: [
      { name: 'id', type: 'uuid' },
      { name: 'torre_id', type: 'uuid' },
      { name: 'numero', type: 'varchar', length: 12 },
    ],
    primaryKey: ['id'],
    indexes: [{ name: 'unidad_torre_idx', fields: ['torre_id'] }],
  }
  const pago: Table = {
    name: 'pago',
    schema: 'public',
    fields: [
      { name: 'id', type: 'uuid' },
      { name: 'residente_id', type: 'uuid' },
      { name: 'valor', type: 'numeric', length: 12, scale: 2 },
    ],
    primaryKey: ['id'],
  }
  const cargo: Table = {
    name: 'cargo',
    schema: 'public',
    fields: [
      { name: 'id', type: 'uuid' },
      { name: 'unidad_id', type: 'uuid' },
    ],
    primaryKey: ['id'],
  }
  const pagoCargo: Table = {
    name: 'pago_cargo',
    schema: 'public',
    fields: [
      { name: 'pago_id', type: 'uuid' },
      { name: 'cargo_id', type: 'uuid' },
      { name: 'valor', type: 'numeric', length: 12, scale: 2 },
    ],
    primaryKey: ['pago_id', 'cargo_id'],
  }
  const bitacora: Table = {
    name: 'bitacora',
    schema: 'public',
    fields: [{ name: 'texto', type: 'text' }],
  }

  return {
    formatVersion: 1,
    name: 'Tablero',
    engine: 'postgres',
    schemas: [{ name: 'public', abbreviation: 'PUB' }],
    tables: [unidad, pago, cargo, pagoCargo, bitacora],
  }
}

describe('proposeForeignKey (FR-004, FR-009)', () => {
  it('el ejemplo fijado del contrato', () => {
    expect(proposeForeignKey(board(), 'pago', 'unidad', '{tabla}_{pk}')).toEqual({
      field: { name: 'unidad_id', type: 'uuid' },
      toField: 'id',
    })
  })

  it('el campo nace no nulo, que es la ausencia de la clave', () => {
    const proposal = proposeForeignKey(board(), 'pago', 'unidad', '{tabla}_{pk}')

    expect(proposal?.field.nullable).toBeUndefined()
  })

  it('copia la longitud y la escala de la llave primaria', () => {
    const model = board()
    const unidad = (model.tables ?? [])[0] as Table
    unidad.primaryKey = ['numero']

    expect(proposeForeignKey(model, 'pago', 'unidad', '{tabla}_{pk}')).toEqual({
      field: { name: 'unidad_numero', type: 'varchar', length: 12 },
      toField: 'numero',
    })
  })

  it('con el nombre ya usado, le pone sufijo', () => {
    const model = board()
    const pago = (model.tables ?? [])[1] as Table
    pago.fields = [...pago.fields, { name: 'unidad_id', type: 'uuid' }]

    expect(proposeForeignKey(model, 'pago', 'unidad', '{tabla}_{pk}')?.field.name).toBe(
      'unidad_id_2',
    )
  })

  it('respeta el patrón que traiga Ajustes', () => {
    expect(proposeForeignKey(board(), 'pago', 'unidad', 'id_{tabla}')?.field.name).toBe('id_unidad')
  })

  it('devuelve null con una llave primaria de dos columnas', () => {
    expect(proposeForeignKey(board(), 'pago', 'pago_cargo', '{tabla}_{pk}')).toBeNull()
  })

  it('devuelve null con una tabla sin llave primaria', () => {
    expect(proposeForeignKey(board(), 'pago', 'bitacora', '{tabla}_{pk}')).toBeNull()
  })

  it('devuelve null si alguna de las dos tablas no está en el modelo', () => {
    expect(proposeForeignKey(board(), 'pago', 'fantasma', '{tabla}_{pk}')).toBeNull()
    expect(proposeForeignKey(board(), 'fantasma', 'unidad', '{tabla}_{pk}')).toBeNull()
  })
})

describe('relationName (FR-011)', () => {
  it('el ejemplo fijado del contrato', () => {
    expect(relationName('pago', 'unidad_id', ['fk_pago_unidad_id'])).toBe('fk_pago_unidad_id_2')
  })

  it('sin choque, el nombre es fk_tabla_campo', () => {
    expect(relationName('pago', 'unidad_id', [])).toBe('fk_pago_unidad_id')
  })

  it('se recorta a 63 caracteres, con sufijo y sin él', () => {
    const long = 'c'.repeat(80)

    expect(relationName('pago', long, [])).toHaveLength(63)
    const taken = relationName('pago', long, [])
    const second = relationName('pago', long, [taken])
    expect(second).toHaveLength(63)
    expect(second.endsWith('_2')).toBe(true)
  })
})

describe('foreignKeyTargets (FR-009)', () => {
  it('lista todas las tablas, incluida la abierta', () => {
    expect(foreignKeyTargets(board(), 'pago').map((target) => target.name)).toEqual([
      'unidad',
      'pago',
      'cargo',
      'pago_cargo',
      'bitacora',
    ])
  })

  it('la tabla abierta se puede elegir y viene marcada', () => {
    const own = foreignKeyTargets(board(), 'pago').find((target) => target.name === 'pago')

    expect(own).toEqual({ name: 'pago', enabled: true, self: true })
  })

  it('deshabilita la de llave primaria compuesta con su motivo', () => {
    const target = foreignKeyTargets(board(), 'pago').find(
      (item) => item.name === 'pago_cargo',
    )

    expect(target).toEqual({
      name: 'pago_cargo',
      enabled: false,
      reason: 'pago_cargo tiene llave primaria de varias columnas.',
    })
  })

  it('deshabilita la que no tiene llave primaria con su motivo', () => {
    const target = foreignKeyTargets(board(), 'pago').find((item) => item.name === 'bitacora')

    expect(target).toEqual({
      name: 'bitacora',
      enabled: false,
      reason: 'bitacora no tiene llave primaria.',
    })
  })
})

describe('indexStateOf (FR-033)', () => {
  const unidad = (board().tables ?? [])[0] as Table
  const pagoCargo = (board().tables ?? [])[3] as Table

  it('la columna que no abre ningún índice está sin índice', () => {
    expect(indexStateOf(unidad, 'numero')).toBe('missing')
  })

  it('la columna de un índice propio está indexada', () => {
    expect(indexStateOf(unidad, 'torre_id')).toBe('indexed')
  })

  it('la llave primaria está indexada', () => {
    expect(indexStateOf(unidad, 'id')).toBe('indexed')
  })

  it('en una llave compuesta solo la primera columna cuenta', () => {
    expect(indexStateOf(pagoCargo, 'pago_id')).toBe('indexed')
    expect(indexStateOf(pagoCargo, 'cargo_id')).toBe('missing')
  })

  it('un único también indexa su primera columna', () => {
    const table: Table = {
      ...unidad,
      indexes: [],
      uniques: [{ name: 'unidad_numero_uk', fields: ['numero', 'torre_id'] }],
    }

    expect(indexStateOf(table, 'numero')).toBe('indexed')
    expect(indexStateOf(table, 'torre_id')).toBe('missing')
  })
})
