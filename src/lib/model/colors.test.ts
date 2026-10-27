import { describe, expect, it } from 'vitest'

import {
  DEFAULT_SCHEMA_COLOR,
  SCHEMA_COLORS,
  resolveSchemaColor,
  schemaColorLabel,
} from '@/lib/model/colors'

/**
 * Pruebas de la paleta de los esquemas (FR-021).
 *
 * El orden importa: es el que ve el usuario en el diálogo, y cambiarlo mueve
 * de sitio los colores que ya tiene memorizados.
 */
describe('paleta de colores de los esquemas', () => {
  it('tiene los once colores en el orden declarado', () => {
    expect(SCHEMA_COLORS.map((color) => color.id)).toEqual([
      'gray',
      'blue',
      'indigo',
      'purple',
      'pink',
      'red',
      'orange',
      'yellow',
      'brown',
      'green',
      'teal',
    ])
  })

  it('da a cada color un nombre legible y distinto', () => {
    const labels = SCHEMA_COLORS.map((color) => color.label)

    expect(labels).toHaveLength(11)
    expect(new Set(labels).size).toBe(11)
    expect(labels).toContain('Índigo')
    expect(labels).toContain('Grafito')
  })

  it('resuelve un identificador de la paleta tal cual', () => {
    expect(resolveSchemaColor('teal')).toBe('teal')
  })

  it('cae al color por defecto con un identificador que no existe', () => {
    expect(resolveSchemaColor('fucsia')).toBe(DEFAULT_SCHEMA_COLOR)
    expect(resolveSchemaColor(undefined)).toBe(DEFAULT_SCHEMA_COLOR)
    expect(resolveSchemaColor('')).toBe(DEFAULT_SCHEMA_COLOR)
  })

  it('el color por defecto está en la paleta', () => {
    expect(SCHEMA_COLORS.some((color) => color.id === DEFAULT_SCHEMA_COLOR)).toBe(true)
  })

  it('nombra el color desconocido como el de por defecto, sin lanzar', () => {
    expect(() => schemaColorLabel('fucsia')).not.toThrow()
    expect(schemaColorLabel('fucsia')).toBe('Índigo')
    expect(schemaColorLabel('brown')).toBe('Marrón')
  })
})
