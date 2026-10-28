import { describe, expect, it } from 'vitest'

import {
  cardinalityOf,
  fieldMarks,
  foreignKeyOf,
  relationCardinality,
  relationsTouching,
} from '@/lib/model/marks'
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

    expect([...marks.keys()]).toEqual(['factura_id', 'linea', 'articulo_id', 'codigo', 'nota'])
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
      relationsTouching(model, { table: 'factura_lineas', field: 'linea' }).map(
        (item) => item.name,
      ),
    ).toEqual(['fk_pagos_linea'])
    expect(relationsTouching(model, { table: 'factura_lineas', field: 'nota' })).toEqual([])
  })

  it('un modelo sin relaciones no afecta a nada', () => {
    const model: Model = modelWith([])
    delete model.relations

    expect(relationsTouching(model, { table: 'factura_lineas' })).toEqual([])
  })
})

describe('relationCardinality', () => {
  /** Modelo con la tabla de prueba tal como se le pase y una relación. */
  function model(extra: Partial<Table> = {}): Model {
    return {
      formatVersion: 1,
      name: 'Prueba',
      engine: 'postgres',
      schemas: [{ name: 'ventas', abbreviation: 'VEN' }],
      tables: [tableWith(extra)],
      relations: [relation()],
    }
  }

  it('una llave foránea obligatoria es de uno a muchos', () => {
    expect(relationCardinality(model(), relation())).toBe('Uno a muchos')
  })

  it('si admite nulos, de uno a cero o muchos', () => {
    const conNulos = model({
      fields: tableWith().fields.map((field) =>
        field.name === 'articulo_id' ? { ...field, nullable: true } : field,
      ),
    })

    expect(relationCardinality(conNulos, relation())).toBe('Uno a cero o muchos')
  })

  it('si además es única, de uno a uno', () => {
    const unica = model({ uniques: [{ name: 'uq_lineas_articulo', fields: ['articulo_id'] }] })

    expect(relationCardinality(unica, relation())).toBe('Uno a uno')
  })

  it('única y con nulos, de uno a cero o uno', () => {
    const unicaConNulos = model({
      uniques: [{ name: 'uq_lineas_articulo', fields: ['articulo_id'] }],
      fields: tableWith().fields.map((field) =>
        field.name === 'articulo_id' ? { ...field, nullable: true } : field,
      ),
    })

    expect(relationCardinality(unicaConNulos, relation())).toBe('Uno a cero o uno')
  })

  it('una relación cuya tabla no está en el modelo no rompe la lectura', () => {
    expect(relationCardinality(model(), relation({ fromTable: 'otra' }))).toBe('Uno a muchos')
  })
})

describe('cardinalityOf (FR-014, SC-011)', () => {
  /** Modelo con la tabla de prueba tal como se le pase y una relación. */
  function model(extra: Partial<Table> = {}): Model {
    return {
      formatVersion: 1,
      name: 'Prueba',
      engine: 'postgres',
      schemas: [{ name: 'ventas', abbreviation: 'VEN' }],
      tables: [tableWith(extra)],
      relations: [relation()],
    }
  }

  /** La tabla de prueba con `articulo_id` admitiendo nulos. */
  function withNulls(extra: Partial<Table> = {}): Partial<Table> {
    return {
      ...extra,
      fields: tableWith().fields.map((field) =>
        field.name === 'articulo_id' ? { ...field, nullable: true } : field,
      ),
    }
  }

  const unique = { name: 'uq_lineas_articulo', fields: ['articulo_id'] }

  it('obligatoria y no única: uno a muchos', () => {
    expect(cardinalityOf(model(), relation())).toEqual({ from: 'one', to: 'many' })
  })

  it('con nulos: uno a cero o muchos', () => {
    expect(cardinalityOf(model(withNulls()), relation())).toEqual({
      from: 'one',
      to: 'zero-or-many',
    })
  })

  it('única y obligatoria: uno a uno', () => {
    expect(cardinalityOf(model({ uniques: [unique] }), relation())).toEqual({
      from: 'one',
      to: 'one',
    })
  })

  it('única y con nulos: uno a cero o uno', () => {
    expect(cardinalityOf(model(withNulls({ uniques: [unique] })), relation())).toEqual({
      from: 'one',
      to: 'zero-or-one',
    })
  })

  it('el texto del inspector y el dato salen de la misma función', () => {
    // SC-011: si `relationCardinality` dedujera por su cuenta, el glifo del
    // lienzo y el texto podrían decir cosas distintas. Las cuatro lecturas se
    // comprueban contra el mismo dato.
    const cases: Array<[Partial<Table>, string]> = [
      [{}, 'Uno a muchos'],
      [withNulls(), 'Uno a cero o muchos'],
      [{ uniques: [unique] }, 'Uno a uno'],
      [withNulls({ uniques: [unique] }), 'Uno a cero o uno'],
    ]
    const labels: Record<string, string> = {
      many: 'muchos',
      'zero-or-many': 'cero o muchos',
      one: 'uno',
      'zero-or-one': 'cero o uno',
    }

    for (const [extra, text] of cases) {
      const current = model(extra)
      const data = cardinalityOf(current, relation())
      expect(relationCardinality(current, relation())).toBe(text)
      expect(text).toBe(`Uno a ${labels[data.to]}`)
    }
  })
})
