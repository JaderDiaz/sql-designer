import { describe, expect, it } from 'vitest'

import { readFixture } from '@/lib/model/__fixtures__'
import { parseModel } from '@/lib/model/parse'

/**
 * Reglas del validador que estrena el Incremento 3 (FR-016, FR-026, FR-043,
 * FR-018a).
 *
 * `src/lib/model/validate.ts` no tenía prueba propia: solo la indirecta de
 * `parse.test.ts`, que mira el archivo entero. Aquí se entra por `parseModel`
 * igual que la aplicación, porque el validador trabaja sobre el documento ya
 * leído y necesita las líneas del archivo para situar cada fallo.
 */

/** Arma un modelo de una tabla con los campos que se le pasen. */
function modelWith(fields: string, extra = ''): string {
  return [
    'formatVersion: 1',
    'name: Prueba',
    'engine: postgres',
    'schemas:',
    '  - name: public',
    '    abbreviation: PUB',
    'tables:',
    '  - name: cosas',
    '    schema: public',
    '    fields:',
    fields,
    extra,
  ]
    .filter((line) => line !== '')
    .join('\n')
    .concat('\n')
}

/** Mensajes del informe de un modelo que no es válido. */
function messagesOf(text: string): string[] {
  const result = parseModel(text)
  if (result.ok) return []
  return result.errors.map((issue) => issue.message)
}

describe('longitud y escala del campo (FR-016)', () => {
  it('acepta una longitud y una escala enteras', () => {
    const result = parseModel(
      modelWith('      - name: importe\n        type: numeric\n        length: 12\n        scale: 2'),
    )

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.model.tables?.[0]?.fields[0]).toMatchObject({ length: 12, scale: 2 })
  })

  it('rechaza una longitud de cero', () => {
    expect(
      messagesOf(modelWith('      - name: nombre\n        type: varchar\n        length: 0')),
    ).toContain('La longitud tiene que ser un número entero mayor que cero.')
  })

  it('rechaza una longitud negativa y una con decimales', () => {
    expect(
      messagesOf(modelWith('      - name: nombre\n        type: varchar\n        length: -3')),
    ).toContain('La longitud tiene que ser un número entero mayor que cero.')
    expect(
      messagesOf(modelWith('      - name: nombre\n        type: varchar\n        length: 1.5')),
    ).toContain('La longitud tiene que ser un número entero mayor que cero.')
  })

  it('acepta una escala de cero', () => {
    const result = parseModel(
      modelWith('      - name: importe\n        type: numeric\n        length: 8\n        scale: 0'),
    )

    expect(result.ok).toBe(true)
  })

  it('rechaza una escala que no es entera', () => {
    expect(
      messagesOf(modelWith('      - name: importe\n        type: numeric\n        scale: dos')),
    ).toContain('La escala tiene que ser un número entero.')
  })

  it('rechaza una escala mayor que la longitud', () => {
    expect(
      messagesOf(
        modelWith('      - name: importe\n        type: numeric\n        length: 4\n        scale: 6'),
      ),
    ).toContain('La escala no puede pasar de la longitud.')
  })
})

describe('llave primaria y nulos (FR-026)', () => {
  it('rechaza un campo de la llave primaria que admite nulos', () => {
    const text = modelWith(
      '      - name: id\n        type: integer\n        nullable: true',
      '    primaryKey:\n      - id',
    )

    expect(messagesOf(text)).toContain('Un campo de la llave primaria no puede admitir nulos.')
  })

  it('acepta una llave primaria de dos campos no nulos', () => {
    const text = modelWith(
      '      - name: factura_id\n        type: integer\n      - name: linea\n        type: smallint',
      '    primaryKey:\n      - factura_id\n      - linea',
    )

    const result = parseModel(text)

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.model.tables?.[0]?.primaryKey).toEqual(['factura_id', 'linea'])
  })
})

describe('descripción de la tabla (FR-043)', () => {
  it('acepta 280 caracteres', () => {
    const text = modelWith('      - name: id\n        type: integer').replace(
      '    schema: public',
      `    schema: public\n    comment: ${'a'.repeat(280)}`,
    )

    expect(parseModel(text).ok).toBe(true)
  })

  it('rechaza 281 caracteres', () => {
    const text = modelWith('      - name: id\n        type: integer').replace(
      '    schema: public',
      `    schema: public\n    comment: ${'a'.repeat(281)}`,
    )

    expect(messagesOf(text)).toContain(
      'La descripción de la tabla no puede pasar de 280 caracteres.',
    )
  })
})

describe('tipos ajenos al motor (FR-018a)', () => {
  it('un modelo de SQLite con tipos de PostgreSQL sigue siendo válido', () => {
    // El archivo manda: el validador comprueba la forma de `length` y
    // `scale`, no el catálogo de tipos del motor. El aviso de que el tipo no
    // es del motor lo da la pantalla, no el archivo.
    const result = parseModel(readFixture('modelo-tipos-ajenos'))

    expect(result.ok).toBe(true)
    if (!result.ok) return
    const fields = result.model.tables?.[0]?.fields ?? []
    expect(fields.map((field) => field.type)).toEqual(['text', 'varchar', 'timestamptz', 'numeric'])
    expect(fields[1]).toMatchObject({ length: 120 })
  })
})
