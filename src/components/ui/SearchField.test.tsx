import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { SearchField } from '@/components/ui/SearchField'

describe('SearchField', () => {
  it('lleva texto accesible aunque no tenga etiqueta visible', () => {
    render(<SearchField value="" onValueChange={vi.fn()} label="Buscar carpetas" />)

    expect(screen.getByRole('searchbox', { name: 'Buscar carpetas' })).toBeInTheDocument()
  })

  it('solo muestra el botón de limpiar cuando hay texto, y limpia al pulsarlo', async () => {
    const user = userEvent.setup()
    const onValueChange = vi.fn()
    const { rerender } = render(
      <SearchField value="" onValueChange={onValueChange} label="Buscar carpetas" />,
    )

    expect(screen.queryByRole('button', { name: 'Limpiar la búsqueda' })).not.toBeInTheDocument()

    rerender(<SearchField value="liv" onValueChange={onValueChange} label="Buscar carpetas" />)
    await user.click(screen.getByRole('button', { name: 'Limpiar la búsqueda' }))

    expect(onValueChange).toHaveBeenCalledWith('')
  })
})
