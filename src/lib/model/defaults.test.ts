import { describe, expect, it } from 'vitest'

import { emptyModel, toAbbreviation, toTechnicalName } from '@/lib/model/defaults'
import { ABBREVIATION_PATTERN, TECHNICAL_NAME_PATTERN } from '@/lib/model/types'

describe('emptyModel', () => {
  it('en PostgreSQL trae el esquema «public» (FR-005)', () => {
    const model = emptyModel('Livy · Reservas', 'postgres')

    expect(model.schemas).toEqual([{ name: 'public', abbreviation: 'PUB' }])
    expect(model.formatVersion).toBe(1)
    expect(model.name).toBe('Livy · Reservas')
    expect(model.tables).toBeUndefined()
  })

  it('en SQLite trae el esquema «main»', () => {
    expect(emptyModel('Notas de campo', 'sqlite').schemas).toEqual([
      { name: 'main', abbreviation: 'MAI' },
    ])
  })

  it('en MySQL el esquema se llama como el modelo, en nombre técnico', () => {
    expect(emptyModel('Livy · Reservas', 'mysql').schemas).toEqual([
      { name: 'livy_reservas', abbreviation: 'LIV' },
    ])
  })

  it('siempre trae exactamente un esquema (RS-02)', () => {
    for (const engine of ['postgres', 'mysql', 'sqlite'] as const) {
      expect(emptyModel('Tienda Nube', engine).schemas).toHaveLength(1)
    }
  })

  it('el esquema de MySQL cumple RS-03 y RS-04 con nombres difíciles', () => {
    for (const name of ['2026 Ventas', 'Ñ', 'a'.repeat(120), 'Ñandú · 2026']) {
      const schema = emptyModel(name, 'mysql').schemas[0]
      expect(schema?.name).toMatch(TECHNICAL_NAME_PATTERN)
      expect(schema?.abbreviation).toMatch(ABBREVIATION_PATTERN)
    }
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
