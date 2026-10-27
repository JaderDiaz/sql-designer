import { describe, expect, it } from 'vitest'

import { toAbbreviation, toTechnicalName } from '@/lib/model/propose'
import { TECHNICAL_NAME_MAX_LENGTH, TECHNICAL_NAME_PATTERN } from '@/lib/model/types'

/**
 * Pruebas de la propuesta de nombre técnico y abreviatura (FR-016, FR-043).
 *
 * La tabla es la de `specs/003-lienzo-esquemas/contracts/canvas.md` §1, con
 * una corrección: «Ventas y cobros» propone `VYC` y no `VEN`, porque la regla
 * del contrato es la inicial de cada una de las tres primeras palabras y tres
 * palabras dan tres iniciales.
 */
const EXAMPLES: Array<[string, string, string]> = [
  ['Ventas y cobros', 'ventas_y_cobros', 'VYC'],
  ['Unidad residencial', 'unidad_residencial', 'URE'],
  ['Cartera', 'cartera', 'CAR'],
  ['Área 51', 'area_51', 'A51'],
  ['3 puertas', '_3_puertas', '3PU'],
  ['  ', '', ''],
]

describe('propuesta del nombre técnico y la abreviatura', () => {
  it.each(EXAMPLES)('«%s» propone %s y %s', (name, technical, abbreviation) => {
    expect(toTechnicalName(name)).toBe(technical)
    expect(toAbbreviation(name)).toBe(abbreviation)
  })

  it('el nombre técnico propuesto siempre tiene la forma que exige el formato', () => {
    for (const [name] of EXAMPLES) {
      const proposed = toTechnicalName(name)
      if (proposed === '') continue
      expect(TECHNICAL_NAME_PATTERN.test(proposed)).toBe(true)
    }
  })

  it('corta el nombre técnico al largo del formato sin dejar guion bajo al final', () => {
    const long = `${'palabra '.repeat(20)}final`

    const proposed = toTechnicalName(long)

    expect(proposed.length).toBeLessThanOrEqual(TECHNICAL_NAME_MAX_LENGTH)
    expect(proposed.endsWith('_')).toBe(false)
    expect(TECHNICAL_NAME_PATTERN.test(proposed)).toBe(true)
  })

  it('rellena con X la abreviatura de un nombre de menos de tres caracteres', () => {
    expect(toAbbreviation('ñ')).toBe('NXX')
    expect(toAbbreviation('Al')).toBe('ALX')
  })

  it('no se queda con más de tres palabras', () => {
    expect(toAbbreviation('Uno dos tres cuatro cinco')).toBe('UDT')
  })

  it('ignora los signos y los espacios de sobra', () => {
    expect(toTechnicalName('  Ventas···y   cobros  ')).toBe('ventas_y_cobros')
    expect(toAbbreviation('  Ventas···y   cobros  ')).toBe('VYC')
  })

  it('es determinista: el mismo nombre propone siempre lo mismo', () => {
    expect(toTechnicalName('Área 51')).toBe(toTechnicalName('Área 51'))
    expect(toAbbreviation('Área 51')).toBe(toAbbreviation('Área 51'))
  })
})
