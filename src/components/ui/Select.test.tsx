import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { Select, type SelectOption } from '@/components/ui/Select'

const OPTIONS: SelectOption[] = [
  { value: 'yaml', label: 'Modelo SQL Designer (.yaml)' },
  { value: 'sql', label: 'Script SQL (.sql)', disabled: true },
]

describe('Select', () => {
  it('muestra la opción elegida con su texto accesible', () => {
    render(
      <Select
        value="yaml"
        onValueChange={vi.fn()}
        options={OPTIONS}
        label="Formato de archivo"
      />,
    )

    const trigger = screen.getByRole('combobox', { name: 'Formato de archivo' })

    expect(trigger).toHaveTextContent('Modelo SQL Designer (.yaml)')
  })

  it('se abre con el teclado y recorre las opciones', async () => {
    const user = userEvent.setup()
    render(
      <Select
        value="yaml"
        onValueChange={vi.fn()}
        options={OPTIONS}
        label="Formato de archivo"
      />,
    )

    screen.getByRole('combobox', { name: 'Formato de archivo' }).focus()
    await user.keyboard('{Enter}')

    const options = screen.getAllByRole('option')
    expect(options).toHaveLength(2)
    expect(options[0]).toHaveAttribute('aria-selected', 'true')
    expect(options[1]).toHaveAttribute('data-disabled')
  })

  it('no se puede usar cuando está deshabilitado', () => {
    render(
      <Select
        value="yaml"
        onValueChange={vi.fn()}
        options={OPTIONS}
        label="Formato de archivo"
        disabled
      />,
    )

    expect(screen.getByRole('combobox', { name: 'Formato de archivo' })).toBeDisabled()
  })
})
