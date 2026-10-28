import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { Tabs, type TabItem } from '@/components/ui/Tabs'

const ITEMS: Array<TabItem<'fields' | 'foreignKeys'>> = [
  { value: 'fields', label: 'Campos', count: 5 },
  { value: 'foreignKeys', label: 'Claves foráneas', count: 2 },
]

describe('Tabs', () => {
  it('es una lista de fichas con su nombre y sus contadores', () => {
    render(
      <Tabs value="fields" onValueChange={vi.fn()} items={ITEMS} label="Secciones de la tabla" />,
    )

    expect(screen.getByRole('tablist', { name: 'Secciones de la tabla' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Campos 5' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'Claves foráneas 2' })).toHaveAttribute(
      'aria-selected',
      'false',
    )
  })

  it('cada ficha dice qué panel controla', () => {
    render(
      <Tabs value="fields" onValueChange={vi.fn()} items={ITEMS} label="Secciones de la tabla" />,
    )

    expect(screen.getByRole('tab', { name: 'Campos 5' })).toHaveAttribute('aria-controls')
  })

  it('las flechas cambian de ficha', async () => {
    const user = userEvent.setup()
    const onValueChange = vi.fn()
    render(
      <Tabs
        value="fields"
        onValueChange={onValueChange}
        items={ITEMS}
        label="Secciones de la tabla"
      />,
    )

    screen.getByRole('tab', { name: 'Campos 5' }).focus()
    await user.keyboard('{ArrowRight}')

    expect(onValueChange).toHaveBeenCalledWith('foreignKeys')
  })

  it('el clic en una ficha la activa', async () => {
    const user = userEvent.setup()
    const onValueChange = vi.fn()
    render(
      <Tabs
        value="fields"
        onValueChange={onValueChange}
        items={ITEMS}
        label="Secciones de la tabla"
      />,
    )

    await user.click(screen.getByRole('tab', { name: 'Claves foráneas 2' }))

    expect(onValueChange).toHaveBeenCalledWith('foreignKeys')
  })

  it('una ficha sin contador muestra solo su nombre', () => {
    render(
      <Tabs
        value="fields"
        onValueChange={vi.fn()}
        items={[{ value: 'fields', label: 'Campos' }]}
        label="Secciones de la tabla"
      />,
    )

    expect(screen.getByRole('tab', { name: 'Campos' })).toBeInTheDocument()
  })
})
