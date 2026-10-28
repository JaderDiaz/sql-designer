import { describe, expect, it } from 'vitest'

import { fieldMarks, foreignKeyOf, relationsTouching } from '@/lib/model/marks'
import type { Model, Relation, Table } from '@/lib/model/types'

/** Tabla de prueba con las llaves que se le pasen. */
function tableWith(extra: Partial<Table> = {}): Table {
  return {
    name: 'factura_lineas',
    schema: 'ventas',
    fields: [
      { name: 'factura_id', type: 'uuid' },
      { name: 'linea', type: 'smallint' },
      { name: 'articulo_id', type: 'uuid' },
      { name: 'codigo', type: 'varchar', length: 24 },
      { name: 'nota', type: 'text', nullable: true },
    ],
    ...extra,
  }
}

/** Relación de prueba. */
function relation(extra: Partial<Relation> = {}): Relation {
  return {
    name: 'fk_lineas_articulo',
    fromTable: 'factura_lineas',
    fromFields: ['articulo_id'],
    toTable: 'articulos',
    toFields: ['id'],
    ...extra,
  }
}

/** Modelo de prueba con una tabla y las relaciones que se le pasen. */
function modelWith(relations: Relation[]): Model {
  return {
    formatVersion: 1,
    name: 'Prueba',
    engine: 'postgres',
    schemas: [{ name: 'ventas', abbreviation: 'VEN' }],
    tables: [tableWith()],
    relations,
  }
}

describe('fieldMarks', () => {
  it('marca los dos campos de una llave primaria compuesta', () => {
    const marks = fieldMarks(tableWith({ primaryKey: ['factura_id', 'linea'] }))

    expect(marks.get('factura_id')).toBe('PK')
    expect(marks.get('linea')).toBe('PK')
    expect(marks.get('nota')).toBeNull()
  })

  it('marca el campo de un único de un solo campo', () => {
    const marks = fieldMarks(
      tableWith({ uniques: [{ name: 'uq_lineas_codigo', fields: ['codigo'] }] }),
    )

    expect(marks.get('codigo')).toBe('UK')
  })

  it('marca todos los campos de un único de varios campos', () => {
    const marks = fieldMarks(
      tableWith({ uniques: [{ name: 'uq_lineas', fields: ['factura_id', 'linea'] }] }),
    )

    expect(marks.get('factura_id')).toBe('UK')
    expect(marks.get('linea')).toBe('UK')
  })

  it('marca el campo que una relación usa como llave foránea', () => {
    const marks = fieldMarks(tableWith(), [relation()])

    expect(marks.get('articulo_id')).toBe('FK')
  })

  it('la llave primaria gana a la foránea y a la única', () => {
    const marks = fieldMarks(
      tableWith({
        primaryKey: ['articulo_id'],
        uniques: [{ name: 'uq_lineas_articulo', fields: ['articulo_id'] }],
      }),
      [relation()],
    )

    expect(marks.get('articulo_id')).toBe('PK')
  })

  it('devuelve una entrada por campo, también sin marca', () => {
    const marks = fieldMarks(tableWith())

    expect([...marks.keys()]).toEqual([
      'factura_id',
      'linea',
      'articulo_id',
      'codigo',
      'nota',
    ])
    expect([...marks.values()].every((mark) => mark === null)).toBe(true)
  })

  it('ignora las relaciones de otras tablas y el extremo referenciado', () => {
    const otra = relation({
      name: 'fk_otra',
      fromTable: 'pagos',
      fromFields: ['factura_id'],
      toTable: 'factura_lineas',
      toFields: ['factura_id'],
    })

    expect(fieldMarks(tableWith(), [otra]).get('factura_id')).toBeNull()
  })
})

describe('foreignKeyOf', () => {
  it('da la relación que define la llave del campo', () => {
    const model = modelWith([relation()])

    expect(foreignKeyOf(model, { table: 'factura_lineas', field: 'articulo_id' })?.name).toBe(
      'fk_lineas_articulo',
    )
  })

  it('no mira el extremo referenciado ni la tabla sin campo', () => {
    const model = modelWith([relation()])

    expect(foreignKeyOf(model, { table: 'articulos', field: 'id' })).toBeNull()
    expect(foreignKeyOf(model, { table: 'factura_lineas' })).toBeNull()
  })
})

describe('relationsTouching', () => {
  const salida = relation()
  const entrada = relation({
    name: 'fk_pagos_linea',
    fromTable: 'pagos',
    fromFields: ['linea_id'],
    toTable: 'factura_lineas',
    toFields: ['linea'],
  })
  const ajena = relation({
    name: 'fk_ajena',
    fromTable: 'pagos',
    fromFields: ['caja_id'],
    toTable: 'cajas',
    toFields: ['id'],
  })

  it('por tabla, da las de los dos extremos', () => {
    const model = modelWith([salida, entrada, ajena])

    expect(relationsTouching(model, { table: 'factura_lineas' }).map((item) => item.name)).toEqual([
      'fk_lineas_articulo',
      'fk_pagos_linea',
    ])
  })

  it('por campo, da solo las que nombran ese campo', () => {
    const model = modelWith([salida, entrada, ajena])

    expect(
      relationsTouching(model, { table: 'factura_lineas', field: 'articulo_id' }).map(
        (item) => item.name,
      ),
    ).toEqual(['fk_lineas_articulo'])
    expect(
      relationsTouching(model, { table: 'factura_lineas', field: 'linea' }).map((item) => item.name),
    ).toEqual(['fk_pagos_linea'])
    expect(relationsTouching(model, { table: 'factura_lineas', field: 'nota' })).toEqual([])
  })

  it('un modelo sin relaciones no afecta a nada', () => {
    const model: Model = modelWith([])
    delete model.relations

    expect(relationsTouching(model, { table: 'factura_lineas' })).toEqual([])
  })
})
