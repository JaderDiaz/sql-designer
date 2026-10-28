import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'

import { TextArea } from '@/components/ui/TextArea'

/** Área de texto controlada, como la usa el inspector. */
function Harness({ maxLength = 280, error }: { maxLength?: number; error?: string }) {
  const [value, setValue] = useState('')
  return (
    <TextArea
      label="Descripción"
      value={value}
      onValueChange={setValue}
      maxLength={maxLength}
      hint="Se exporta como COMMENT ON TABLE"
      {...(error ? { error } : {})}
    />
  )
}

describe('TextArea (FR-043)', () => {
  it('la etiqueta queda ligada al control', () => {
    render(<Harness />)

    expect(screen.getByLabelText('Descripción')).toBe(screen.getByRole('textbox'))
  })

  it('la cuenta sigue a lo escrito', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    expect(screen.getByText('0/280')).toBeInTheDocument()
    await user.type(screen.getByRole('textbox'), 'Cabecera')
    expect(screen.getByText('8/280')).toBeInTheDocument()
  })

  it('el tope corta lo que se escribe de más', async () => {
    const user = userEvent.setup()
    render(<Harness maxLength={5} />)

    await user.type(screen.getByRole('textbox'), 'doce caracteres')

    expect(screen.getByRole('textbox')).toHaveValue('doce ')
    expect(screen.getByText('5/5')).toBeInTheDocument()
  })

  it('la pista se anuncia y el error la sustituye como alerta', () => {
    const { unmount } = render(<Harness />)

    const field = screen.getByRole('textbox')
    expect(field).toHaveAccessibleDescription('Se exporta como COMMENT ON TABLE')
    expect(field).not.toHaveAttribute('aria-invalid')
    unmount()

    render(<Harness error="La descripción no puede pasar de 280 caracteres." />)

    expect(screen.getByRole('alert')).toHaveTextContent(
      'La descripción no puede pasar de 280 caracteres.',
    )
    expect(screen.getByRole('textbox')).toHaveAttribute('aria-invalid', 'true')
  })

  it('sin tope no muestra cuenta', () => {
    render(
      <TextArea label="Notas" value="algo" onValueChange={() => undefined} />,
    )

    expect(screen.queryByText(/\/\d+$/)).not.toBeInTheDocument()
  })
})
