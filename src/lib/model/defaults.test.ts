import { describe, expect, it } from 'vitest'

import { emptyModel, isBlankModel, toAbbreviation, toTechnicalName } from '@/lib/model/defaults'

describe('emptyModel', () => {
  it('un modelo nuevo llega sin esquemas (FR-005)', () => {
    const model = emptyModel('Livy · Reservas', 'postgres')

    expect(model.schemas).toEqual([])
    expect(model.formatVersion).toBe(1)
    expect(model.name).toBe('Livy · Reservas')
    expect(model.tables).toBeUndefined()
  })

  it('ningún motor propone un esquema propio', () => {
    for (const engine of ['postgres', 'mysql', 'sqlite'] as const) {
      expect(emptyModel('Tienda Nube', engine).schemas).toEqual([])
    }
  })
})

describe('isBlankModel', () => {
  it('un modelo recién creado está en blanco (FR-005a)', () => {
    expect(isBlankModel(emptyModel('Livy · Reservas', 'postgres'))).toBe(true)
  })

  it('con un esquema ya no está en blanco (FR-005a)', () => {
    const model = emptyModel('Livy · Reservas', 'postgres')

    expect(isBlankModel({ ...model, schemas: [{ name: 'ventas', abbreviation: 'VEN' }] })).toBe(
      false,
    )
  })

  it('con una tabla tampoco, aunque no haya esquemas', () => {
    const model = emptyModel('Livy · Reservas', 'postgres')

    expect(
      isBlankModel({ ...model, tables: [{ name: 'pagos', schema: 'ventas', fields: [] }] }),
    ).toBe(false)
  })

  it('sin modelo abierto no hay nada en blanco', () => {
    expect(isBlankModel(null)).toBe(false)
  })
})

describe('toTechnicalName', () => {
  it('cambia los guiones por guion bajo', () => {
    expect(toTechnicalName('Livy · Reservas')).toBe('livy_reservas')
  })

  it('no deja que empiece por un número (RS-03)', () => {
    expect(toTechnicalName('2026 Ventas')).toBe('_2026_ventas')
  })

  it('cae a «modelo» cuando el nombre no deja nada', () => {
    expect(toTechnicalName('···')).toBe('modelo')
  })
})

describe('toAbbreviation', () => {
  it('toma las tres primeras letras en mayúsculas', () => {
    expect(toAbbreviation('livy_reservas')).toBe('LIV')
  })

  it('rellena con X lo que falte (RS-04)', () => {
    expect(toAbbreviation('ab')).toBe('ABX')
    expect(toAbbreviation('_2026_v')).toBe('VXX')
  })
})
