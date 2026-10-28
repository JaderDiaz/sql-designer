import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { Badge } from '@/components/ui/Badge'

describe('Badge', () => {
  it('muestra su texto con el tono verde', () => {
    render(
      <Badge tone="green" icon="check">
        Indexada
      </Badge>,
    )

    const badge = screen.getByText('Indexada')

    expect(badge).toHaveClass('au-badge-green')
  })

  it('el tono naranja puede llevar punto en lugar de icono', () => {
    const { container } = render(
      <Badge tone="orange" dot>
        Sin índice
      </Badge>,
    )

    expect(screen.getByText('Sin índice')).toHaveClass('au-badge-orange')
    expect(container.querySelector('.au-badge-dot')).not.toBeNull()
    expect(container.querySelector('.au-icon')).toBeNull()
  })

  it('el estado se lee sin el color, porque el texto siempre está', () => {
    render(
      <Badge tone="orange" dot>
        Sin índice
      </Badge>,
    )

    expect(screen.getByText('Sin índice').textContent).toBe('Sin índice')
  })
})
