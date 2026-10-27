import { describe, expect, it } from 'vitest'

import { readFixture } from '@/lib/model/__fixtures__'
import { parseModel } from '@/lib/model/parse'

/**
 * Pruebas de la lectura del archivo del modelo.
 *
 * El diálogo de archivo con errores enseña la línea (FR-016), así que lo que
 * se comprueba aquí no es solo que falle, sino dónde dice que falla.
 *
 * `modelo-roto.yaml` tiene una tabulación como sangría al principio de la
 * **línea 8**, que YAML no admite; `modelo-clave-desconocida.yaml` declara
 * `colour` en el esquema, en la **línea 7**.
 */
describe('parseModel', () => {
  it('lee un modelo válido con todas sus colecciones', () => {
    const result = parseModel(readFixture('modelo-postgres'))

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.model.name).toBe('Livy · Reservas')
    expect(result.model.engine).toBe('postgres')
    expect(result.model.schemas).toHaveLength(1)
    expect(result.model.tables).toHaveLength(6)
    expect(result.model.relations).toHaveLength(6)
    expect(result.model.enums).toHaveLength(1)
    expect(result.model.views).toHaveLength(1)
  })

  it('da la línea del error de sintaxis', () => {
    const result = parseModel(readFixture('modelo-roto'))

    expect(result.ok).toBe(false)
    if (result.ok) return
    const first = result.errors[0]
    expect(first?.code).toBe('syntax')
    expect(first?.line).toBe(8)
    expect(first?.message).toContain('no es YAML válido')
    // El mensaje de la librería viene en inglés; el diálogo lo tiene que
    // decir en español entero (FR-041).
    expect(first?.message).not.toMatch(/[a-z] [a-z]+ed /)
    expect(first?.message).toBe(
      'El archivo no es YAML válido: la sangría lleva tabuladores; se sangra con espacios.',
    )
  })

  it('rechaza una clave desconocida y dice en qué línea está', () => {
    const result = parseModel(readFixture('modelo-clave-desconocida'))

    expect(result.ok).toBe(false)
    if (result.ok) return
    const unknown = result.errors.find((issue) => issue.message.includes('colour'))
    expect(unknown).toBeDefined()
    expect(unknown?.code).toBe('invalid')
    expect(unknown?.line).toBe(7)
    expect(unknown?.path).toBe('schemas[0].colour')
  })

  it('avisa de que el archivo es de una versión más nueva', () => {
    const text = ['formatVersion: 2', 'name: Del futuro', 'engine: postgres'].join('\n')

    const result = parseModel(text)

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0]?.code).toBe('future_version')
    expect(result.errors[0]?.message).toContain('versión más nueva')
    expect(result.errors[0]?.line).toBe(1)
  })

  it('acepta un modelo sin esquemas, que es como nace uno nuevo (FR-005)', () => {
    const text = ['formatVersion: 1', 'name: Sin esquemas', 'engine: sqlite', 'schemas: []'].join(
      '\n',
    )

    const result = parseModel(text)

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.model.schemas).toEqual([])
  })

  it('exige que el esquema de una tabla exista', () => {
    const text = [
      'formatVersion: 1',
      'name: Esquema que falta',
      'engine: postgres',
      'schemas:',
      '  - name: public',
      '    abbreviation: PUB',
      'tables:',
      '  - name: clientes',
      '    schema: ventas',
      '    fields:',
      '      - name: id',
      '        type: integer',
    ].join('\n')

    const result = parseModel(text)

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errors[0]?.message).toContain('«ventas» no está declarado')
    expect(result.errors[0]?.line).toBe(9)
  })
  it('lee la posición de un esquema sin tablas', () => {
    const result = parseModel(readFixture('modelo-posiciones'))

    expect(result.ok).toBe(true)
    if (!result.ok) return
    const empty = result.model.schemas.find((schema) => schema.name === 'reportes')
    expect(empty?.position).toEqual({ x: 900, y: 120 })
  })

  it('descarta la posición de un esquema que sí tiene tablas', () => {
    // La posición de la zona dejó de aplicar en cuanto el esquema recibió una
    // tabla: no invalida el archivo, se poda al leer (FR-026a).
    const text = [
      'formatVersion: 1',
      'name: Con posición de más',
      'engine: postgres',
      'schemas:',
      '  - name: ventas',
      '    abbreviation: VEN',
      '    position:',
      '      x: 40',
      '      y: 60',
      'tables:',
      '  - name: facturas',
      '    schema: ventas',
      '    fields:',
      '      - name: id',
      '        type: integer',
    ].join('\n')

    const result = parseModel(text)

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.model.schemas[0]?.position).toBeUndefined()
  })

  it('rechaza una clave desconocida dentro de la posición del esquema', () => {
    const text = [
      'formatVersion: 1',
      'name: Posición con clave de más',
      'engine: postgres',
      'schemas:',
      '  - name: ventas',
      '    abbreviation: VEN',
      '    position:',
      '      x: 40',
      '      z: 60',
    ].join('\n')

    const result = parseModel(text)

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errors[0]?.message).toBe('La posición solo admite «x» e «y».')
  })

  it('rechaza una «x» que no es un número en la posición del esquema', () => {
    const text = [
      'formatVersion: 1',
      'name: Posición con texto',
      'engine: postgres',
      'schemas:',
      '  - name: ventas',
      '    abbreviation: VEN',
      '    position:',
      '      x: izquierda',
      '      y: 60',
    ].join('\n')

    const result = parseModel(text)

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errors[0]?.message).toBe('«x» de la posición tiene que ser un número.')
    expect(result.errors[0]?.line).toBe(8)
  })
})
