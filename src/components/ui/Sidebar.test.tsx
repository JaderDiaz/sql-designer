import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { Sidebar, type SidebarSection } from '@/components/ui/Sidebar'

const SECTIONS: SidebarSection[] = [
  {
    title: 'Favoritos',
    items: [
      { id: 'recents', label: 'Recientes', icon: 'clock' },
      { id: 'desktop', label: 'Escritorio', icon: 'monitor' },
    ],
  },
  { title: 'Ubicaciones', items: [{ id: 'root', label: 'Macintosh HD', icon: 'hard-drive' }] },
]

describe('Sidebar', () => {
  it('marca la ubicación elegida y deja solo esa en el orden de tabulación', () => {
    render(
      <Sidebar sections={SECTIONS} value="desktop" onValueChange={vi.fn()} label="Ubicaciones" />,
    )

    const chosen = screen.getByRole('button', { name: 'Escritorio' })

    expect(chosen).toHaveAttribute('aria-current', 'true')
    expect(chosen).toHaveAttribute('tabindex', '0')
    expect(screen.getByRole('button', { name: 'Recientes' })).toHaveAttribute('tabindex', '-1')
  })

  it('cambia de ubicación con las flechas y cruza las secciones', async () => {
    const user = userEvent.setup()
    const onValueChange = vi.fn()
    render(
      <Sidebar
        sections={SECTIONS}
        value="desktop"
        onValueChange={onValueChange}
        label="Ubicaciones"
      />,
    )

    screen.getByRole('button', { name: 'Escritorio' }).focus()
    await user.keyboard('{ArrowDown}')

    expect(onValueChange).toHaveBeenCalledWith('root')

    await user.keyboard('{ArrowUp}')
    expect(onValueChange).toHaveBeenLastCalledWith('recents')
  })

  it('no se sale de la lista en los extremos', async () => {
    const user = userEvent.setup()
    const onValueChange = vi.fn()
    render(
      <Sidebar
        sections={SECTIONS}
        value="recents"
        onValueChange={onValueChange}
        label="Ubicaciones"
      />,
    )

    screen.getByRole('button', { name: 'Recientes' }).focus()
    await user.keyboard('{ArrowUp}')

    expect(onValueChange).not.toHaveBeenCalled()
  })
})
