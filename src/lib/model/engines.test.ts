import { describe, expect, it } from 'vitest'

import {
  auditFields,
  idField,
  templatesOf,
  textTypeOf,
  typeTraits,
  typesOf,
} from '@/lib/model/engines'
import { ENGINES } from '@/lib/model/types'

/**
 * El catálogo de tipos por motor (FR-008, FR-015, FR-018, FR-027).
 *
 * Es el equivalente de la puerta 2 de la constitución en este incremento: lo
 * que el producto propone tiene que ser correcto en los tres motores, no solo
 * en PostgreSQL.
 */
describe('typesOf', () => {
  it('da la lista de cada motor con sus tipos propios', () => {
    expect(typesOf('postgres')).toContain('timestamptz')
    expect(typesOf('postgres')).toContain('jsonb')
    expect(typesOf('mysql')).toContain('datetime')
    expect(typesOf('mysql')).toContain('decimal')
    expect(typesOf('sqlite')).toEqual(['integer', 'real', 'text', 'blob', 'numeric'])
  })

  it('ningún motor ofrece el tipo de otro', () => {
    expect(typesOf('mysql')).not.toContain('timestamptz')
    expect(typesOf('sqlite')).not.toContain('varchar')
    expect(typesOf('postgres')).not.toContain('decimal')
  })

  it('el tipo de texto del campo nuevo está en la lista de su motor', () => {
    for (const engine of ENGINES) {
      expect(typesOf(engine)).toContain(textTypeOf(engine))
    }
  })
})

describe('typeTraits', () => {
  it('varchar lleva longitud y propone 120', () => {
    expect(typeTraits('postgres', 'varchar')).toEqual({
      hasLength: true,
      hasScale: false,
      defaultLength: 120,
      isUnknown: false,
    })
  })

  it('char propone longitud 1', () => {
    expect(typeTraits('mysql', 'char').defaultLength).toBe(1)
  })

  it('numeric lleva longitud y escala, y propone 12,2', () => {
    expect(typeTraits('postgres', 'numeric')).toEqual({
      hasLength: true,
      hasScale: true,
      defaultLength: 12,
      defaultScale: 2,
      isUnknown: false,
    })
    expect(typeTraits('mysql', 'decimal').defaultScale).toBe(2)
  })

  it('integer no lleva ni longitud ni escala', () => {
    expect(typeTraits('postgres', 'integer')).toEqual({
      hasLength: false,
      hasScale: false,
      isUnknown: false,
    })
  })

  it('en SQLite ningún tipo lleva longitud', () => {
    for (const type of typesOf('sqlite')) {
      expect(typeTraits('sqlite', type).hasLength).toBe(false)
    }
  })

  it('un tipo que el motor no conoce se marca y no pide longitud', () => {
    expect(typeTraits('sqlite', 'timestamptz')).toEqual({
      hasLength: false,
      hasScale: false,
      isUnknown: true,
    })
    expect(typeTraits('postgres', 'timestamptz').isUnknown).toBe(false)
  })
})

describe('idField', () => {
  it('da el identificador de cada motor', () => {
    expect(idField('postgres')).toEqual({
      name: 'id',
      type: 'uuid',
      default: 'gen_random_uuid()',
    })
    expect(idField('mysql')).toEqual({
      name: 'id',
      type: 'char',
      length: 36,
      default: '(uuid())',
    })
    expect(idField('sqlite')).toEqual({ name: 'id', type: 'text' })
  })

  it('el tipo del identificador está en la lista de su motor', () => {
    for (const engine of ENGINES) {
      expect(typesOf(engine)).toContain(idField(engine).type)
    }
  })
})

describe('templatesOf', () => {
  it('da los cuatro grupos en el mismo orden', () => {
    expect(templatesOf('postgres').map((template) => template.key)).toEqual([
      'audit',
      'softDelete',
      'authorship',
      'active',
    ])
  })

  it('las fechas de auditoría usan el tipo y el valor de cada motor', () => {
    expect(auditFields('postgres')).toEqual([
      { name: 'created_at', type: 'timestamptz', default: 'now()' },
      { name: 'updated_at', type: 'timestamptz', default: 'now()' },
    ])
    expect(auditFields('mysql')[0]).toMatchObject({
      type: 'timestamp',
      default: 'CURRENT_TIMESTAMP',
    })
    expect(auditFields('sqlite')[0]).toMatchObject({ type: 'text' })
  })

  it('el grupo de auditoría es el mismo que propone el diálogo', () => {
    for (const engine of ENGINES) {
      expect(templatesOf(engine)[0]?.fields).toEqual(auditFields(engine))
    }
  })

  it('el borrado lógico admite nulos y la autoría también', () => {
    const [, softDelete, authorship] = templatesOf('postgres')
    expect(softDelete?.fields).toEqual([
      { name: 'deleted_at', type: 'timestamptz', nullable: true },
    ])
    expect(authorship?.fields.map((field) => field.name)).toEqual(['created_by', 'updated_by'])
    expect(authorship?.fields.every((field) => field.nullable === true)).toBe(true)
  })

  it('el campo activo usa el tipo booleano de cada motor', () => {
    expect(templatesOf('postgres')[3]?.fields[0]).toEqual({
      name: 'activo',
      type: 'boolean',
      default: 'true',
    })
    expect(templatesOf('mysql')[3]?.fields[0]).toMatchObject({ type: 'boolean', default: '1' })
    expect(templatesOf('sqlite')[3]?.fields[0]).toMatchObject({ type: 'integer', default: '1' })
  })

  it('todos los tipos de todas las plantillas están en la lista de su motor', () => {
    for (const engine of ENGINES) {
      for (const template of templatesOf(engine)) {
        for (const field of template.fields) {
          expect(typesOf(engine)).toContain(field.type)
        }
      }
    }
  })
})
