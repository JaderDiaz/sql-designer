import { describe, expect, it } from 'vitest'

import {
  FILE_STEM_MAX_LENGTH,
  INVALID_STEM_MESSAGE,
  LONG_STEM_MESSAGE,
  RESERVED_PREFIX,
  RESERVED_STEM_MESSAGE,
  fileStemProblem,
  normalizeTypedStem,
  toFileStem,
} from '@/lib/model/slug'

describe('toFileStem', () => {
  it('convierte el nombre del ejemplo del spec', () => {
    expect(toFileStem('Livy · Reservas')).toBe('livy-reservas')
  })

  it('quita acentos y pasa a minúsculas', () => {
    expect(toFileStem('Gestión de Pedidos ÑU')).toBe('gestion-de-pedidos-nu')
  })

  it('colapsa los separadores y recorta los de los extremos', () => {
    expect(toFileStem('  ¡¡Livy!!   ···   Reservas  ')).toBe('livy-reservas')
  })

  it('devuelve vacío cuando no queda ninguna letra ni número', () => {
    expect(toFileStem('')).toBe('')
    expect(toFileStem('   ')).toBe('')
    expect(toFileStem('··· ¿? ¡!')).toBe('')
  })

  it('conserva los números', () => {
    expect(toFileStem('Ventas 2026')).toBe('ventas-2026')
  })

  it(`recorta a ${FILE_STEM_MAX_LENGTH} caracteres sin dejar un guion al final`, () => {
    const stem = toFileStem('a'.repeat(100))
    expect(stem).toHaveLength(FILE_STEM_MAX_LENGTH)

    const cut = toFileStem(`${'a'.repeat(FILE_STEM_MAX_LENGTH)} reservas`)
    expect(cut).toBe('a'.repeat(FILE_STEM_MAX_LENGTH))
    expect(cut.endsWith('-')).toBe(false)
  })

  it('salva los nombres que Windows tiene reservados', () => {
    expect(toFileStem('CON')).toBe(`${RESERVED_PREFIX}con`)
    expect(toFileStem('nul')).toBe(`${RESERVED_PREFIX}nul`)
    for (const index of [1, 5, 9]) {
      expect(toFileStem(`com${index}`)).toBe(`${RESERVED_PREFIX}com${index}`)
      expect(toFileStem(`LPT${index}`)).toBe(`${RESERVED_PREFIX}lpt${index}`)
    }
  })

  it('no toca un nombre que solo empieza como uno reservado', () => {
    expect(toFileStem('contactos')).toBe('contactos')
    expect(toFileStem('com10')).toBe('com10')
  })
})

describe('normalizeTypedStem', () => {
  it('quita los espacios de los extremos', () => {
    expect(normalizeTypedStem('  reservas  ')).toBe('reservas')
  })

  it('quita la extensión si el usuario la escribe', () => {
    expect(normalizeTypedStem('reservas.yaml')).toBe('reservas')
    expect(normalizeTypedStem('reservas.YAML')).toBe('reservas')
  })

  it('deja los puntos que no son la extensión', () => {
    expect(normalizeTypedStem('reservas.v2')).toBe('reservas.v2')
  })
})

describe('fileStemProblem', () => {
  it('acepta letras, números, punto, guion y guion bajo', () => {
    expect(fileStemProblem('reservas_v2')).toBeNull()
    expect(fileStemProblem('Livy-2026.v2')).toBeNull()
  })

  it('rechaza los espacios y los caracteres que no valen', () => {
    expect(fileStemProblem('livy reservas')).toBe(INVALID_STEM_MESSAGE)
    expect(fileStemProblem('livy/reservas')).toBe(INVALID_STEM_MESSAGE)
    expect(fileStemProblem('')).toBe(INVALID_STEM_MESSAGE)
  })

  it('rechaza empezar por algo que no sea letra o número', () => {
    expect(fileStemProblem('-reservas')).toBe(INVALID_STEM_MESSAGE)
    expect(fileStemProblem('.reservas')).toBe(INVALID_STEM_MESSAGE)
  })

  it('rechaza pasarse de largo', () => {
    expect(fileStemProblem('a'.repeat(FILE_STEM_MAX_LENGTH))).toBeNull()
    expect(fileStemProblem('a'.repeat(FILE_STEM_MAX_LENGTH + 1))).toBe(LONG_STEM_MESSAGE)
  })

  it('rechaza los nombres que Windows reserva', () => {
    expect(fileStemProblem('CON')).toBe(RESERVED_STEM_MESSAGE)
    expect(fileStemProblem('lpt3')).toBe(RESERVED_STEM_MESSAGE)
    expect(fileStemProblem('contactos')).toBeNull()
  })
})
