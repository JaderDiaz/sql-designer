import { describe, expect, it } from 'vitest'

import { formatModified, formatSize } from '@/lib/format'

/** Instante fijo del escenario: 24 de octubre de 2026, 15:00 local. */
const NOW = new Date(2026, 9, 24, 15, 0).getTime()

describe('formato de fechas y tamaños (RS-12)', () => {
  it('hoy lleva la hora, ayer no, y lo anterior lleva la fecha', () => {
    const hoy = new Date(2026, 9, 24, 9, 12).getTime()
    const ayer = new Date(2026, 9, 23, 9, 12).getTime()
    const antes = new Date(2026, 9, 20, 9, 12).getTime()

    expect(formatModified(hoy, NOW)).toMatch(/^Hoy, 9:12/)
    expect(formatModified(ayer, NOW)).toBe('Ayer')
    expect(formatModified(antes, NOW)).toContain('oct')
    expect(formatModified(antes, NOW)).toContain('2026')
  })

  it('un instante que el sistema no sabe dar se dibuja como raya', () => {
    expect(formatModified(0, NOW)).toBe('—')
  })

  it('el tamaño sube de unidad cuando se queda corta', () => {
    expect(formatSize(1)).toBe('1 byte')
    expect(formatSize(940)).toBe('940 bytes')
    expect(formatSize(28 * 1024)).toBe('28 KB')
    expect(formatSize(3 * 1024 * 1024)).toBe('3 MB')
    expect(formatSize(-1)).toBe('—')
  })
})
