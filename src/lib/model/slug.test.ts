import { describe, expect, it } from 'vitest'

import { FILE_STEM_MAX_LENGTH, RESERVED_PREFIX, toFileStem } from '@/lib/model/slug'

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
