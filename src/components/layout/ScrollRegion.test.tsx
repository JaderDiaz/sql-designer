import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { ScrollRegion } from '@/components/layout/ScrollRegion'

describe('ScrollRegion', () => {
  it('desplaza dentro de la región y no propaga al documento', () => {
    render(
      <ScrollRegion label="Contenido">
        <div style={{ height: '5000px' }}>mucho contenido</div>
      </ScrollRegion>,
    )

    const region = screen.getByLabelText('Contenido')

    expect(region.style.overflowY).toBe('auto')
    expect(region.style.overscrollBehavior).toBe('contain')

    region.scrollTop = 400

    expect(region.scrollTop).toBe(400)
    expect(document.documentElement.scrollTop).toBe(0)
    expect(document.body.scrollTop).toBe(0)
  })
})
