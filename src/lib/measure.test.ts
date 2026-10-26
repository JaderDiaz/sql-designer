import { describe, expect, it } from 'vitest'

import { markThemeChange, takeThemeChange } from '@/lib/measure'

describe('marcas de tiempo de la interfaz', () => {
  it('sin marca previa no hay medida', () => {
    takeThemeChange()
    expect(takeThemeChange()).toBeNull()
  })

  it('la marca se consume una sola vez', () => {
    markThemeChange()
    const elapsed = takeThemeChange()
    expect(elapsed).not.toBeNull()
    expect(elapsed).toBeGreaterThanOrEqual(0)
    expect(takeThemeChange()).toBeNull()
  })
})
