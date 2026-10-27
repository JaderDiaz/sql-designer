import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { EMPTY_ZONE_TEXT, SchemaZone } from '@/components/features/canvas/SchemaZone'
import type { SchemaZone as Zone } from '@/lib/canvas/geometry'
import type { Schema } from '@/lib/model/types'

/**
 * Pruebas de la zona de un esquema (FR-023 a FR-025, FR-040).
 *
 * El rótulo es lo que hace que el color no sea el único portador de la
 * información, así que lo que se comprueba es que la abreviatura, el nombre y
 * el número de tablas estén siempre, también cuando la zona está vacía.
 */

/** Esquema del escenario. */
const VENTAS: Schema = { name: 'ventas', abbreviation: 'VEN', color: 'blue' }

/** Zona del escenario, con las tablas que se digan. */
function zone(overrides: Partial<Zone> = {}): Zone {
  return {
    schema: 'ventas',
    rect: { x: 40, y: 80, width: 280, height: 180 },
    isEmpty: false,
    color: 'blue',
    tableCount: 3,
    ...overrides,
  }
}

describe('SchemaZone', () => {
  it('el rótulo trae abreviatura, nombre y número de tablas (FR-024)', () => {
    render(<SchemaZone zone={zone()} schema={VENTAS} isSelected={false} isDim={false} />)

    const button = screen.getByRole('button')
    expect(button).toHaveTextContent('VEN')
    expect(button).toHaveTextContent('ventas')
    expect(button).toHaveTextContent('3 tablas')
  })

  it('su nombre accesible es el del contrato (contracts/canvas.md §5)', () => {
    render(<SchemaZone zone={zone()} schema={VENTAS} isSelected={false} isDim={false} />)

    expect(screen.getByRole('button', { name: 'Esquema VEN · ventas, 3 tablas' })).toBeInTheDocument()
  })

  it('una sola tabla se cuenta en singular', () => {
    render(
      <SchemaZone
        zone={zone({ tableCount: 1 })}
        schema={VENTAS}
        isSelected={false}
        isDim={false}
      />,
    )

    expect(screen.getByRole('button', { name: 'Esquema VEN · ventas, 1 tabla' })).toBeInTheDocument()
  })

  it('una zona vacía dice que todavía no hay tablas (FR-025)', () => {
    render(
      <SchemaZone
        zone={zone({ isEmpty: true, tableCount: 0 })}
        schema={VENTAS}
        isSelected={false}
        isDim={false}
      />,
    )

    expect(screen.getByText(EMPTY_ZONE_TEXT)).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Esquema VEN · ventas, sin tablas' }),
    ).toBeInTheDocument()
  })

  it('se coloca donde dice la geometría, con el color del esquema (FR-023)', () => {
    render(<SchemaZone zone={zone()} schema={VENTAS} isSelected={false} isDim={false} />)

    const button = screen.getByRole('button')
    expect(button.style.left).toBe('40px')
    expect(button.style.top).toBe('80px')
    expect(button.style.width).toBe('280px')
    expect(button.style.height).toBe('180px')
    expect(button.style.getPropertyValue('--zone')).toBe('var(--blue)')
  })

  it('dice si está seleccionada, que es lo que mira el inspector (FR-003)', () => {
    render(<SchemaZone zone={zone()} schema={VENTAS} isSelected isDim={false} />)

    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button').className).toContain('is-sel')
  })

  it('se atenúa cuando el foco está en otro esquema (FR-030)', () => {
    render(<SchemaZone zone={zone()} schema={VENTAS} isSelected={false} isDim />)

    expect(screen.getByRole('button').className).toContain('is-dim')
  })

  it('avisa al pulsarla', async () => {
    const onClick = vi.fn()
    render(
      <SchemaZone zone={zone()} schema={VENTAS} isSelected={false} isDim={false} onClick={onClick} />,
    )

    await userEvent.click(screen.getByRole('button'))

    expect(onClick).toHaveBeenCalledTimes(1)
  })
})
