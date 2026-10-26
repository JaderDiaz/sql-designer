import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { TextField } from '@/components/ui/TextField'

describe('TextField', () => {
  it('enlaza la etiqueta y avisa de cada pulsación', async () => {
    const user = userEvent.setup()
    const onValueChange = vi.fn()
    render(<TextField label="Nombre" value="" onValueChange={onValueChange} />)

    await user.type(screen.getByRole('textbox', { name: 'Nombre' }), 'Li')

    expect(onValueChange).toHaveBeenCalledTimes(2)
    expect(onValueChange).toHaveBeenNthCalledWith(1, 'L')
  })

  it('anuncia el error con role="alert" y lo enlaza al campo', () => {
    render(
      <TextField
        label="Nombre"
        value=""
        onValueChange={vi.fn()}
        hint="Puedes cambiarlo después."
        error="Escribe un nombre para el modelo."
      />,
    )

    const field = screen.getByRole('textbox', { name: 'Nombre' })
    const alert = screen.getByRole('alert')

    expect(alert).toHaveTextContent('Escribe un nombre para el modelo.')
    expect(field).toHaveAttribute('aria-invalid', 'true')
    expect(field).toHaveAccessibleDescription('Escribe un nombre para el modelo.')
    expect(screen.queryByText('Puedes cambiarlo después.')).not.toBeInTheDocument()
  })

  it('describe el campo con la pista cuando no hay error', () => {
    render(
      <TextField
        label="Nombre"
        value="Livy"
        onValueChange={vi.fn()}
        hint="Puedes cambiarlo después."
      />,
    )

    const field = screen.getByRole('textbox', { name: 'Nombre' })

    expect(field).toHaveAccessibleDescription('Puedes cambiarlo después.')
    expect(field).not.toHaveAttribute('aria-invalid')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
