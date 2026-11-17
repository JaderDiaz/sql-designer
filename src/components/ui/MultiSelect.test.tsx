import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { MultiSelect, type MultiSelectOption } from '@/components/ui/MultiSelect'

/**
 * Selector de varias columnas (research R12, FR-025, FR-044).
 *
 * Lo que importa es el orden: el valor es la lista en el orden en que se
 * eligió, no en el de las opciones.
 */

const OPTIONS: MultiSelectOption[] = [
  { value: 'id', label: 'id' },
  { value: 'residente_id', label: 'residente_id' },
  { value: 'mes', label: 'mes' },
]

/** El selector con su propio estado, como lo usa una fila de la rejilla. */
function Harness({ initial = [], onChange = vi.fn() }: { initial?: string[]; onChange?: (value: string[]) => void }) {
  const [value, setValue] = useState(initial)
  return (
    <MultiSelect
      label="Columnas"
      options={OPTIONS}
      value={value}
      onValueChange={(next) => {
        setValue(next)
        onChange(next)
      }}
    />
  )
}

describe('MultiSelect', () => {
  it('el nombre accesible lista las elegidas en orden', () => {
    render(<Harness initial={['mes', 'id']} />)

    const trigger = screen.getByRole('button', { name: 'Columnas: mes, id' })
    expect(trigger).toHaveTextContent('mes, id')
  })

  it('sin nada elegido dice la etiqueta y el texto de relleno', () => {
    render(<Harness />)

    expect(screen.getByRole('button', { name: 'Columnas' })).toHaveTextContent('Elige')
  })

  it('conserva el orden de elección y no se cierra al marcar', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)

    await user.click(screen.getByRole('button', { name: 'Columnas' }))
    await user.click(screen.getByRole('menuitemcheckbox', { name: 'mes' }))
    await user.click(screen.getByRole('menuitemcheckbox', { name: 'id' }))

    expect(onChange).toHaveBeenLastCalledWith(['mes', 'id'])
    expect(screen.getByRole('menuitemcheckbox', { name: /mes/ })).toHaveAttribute('aria-checked', 'true')
  })

  it('desmarcar quita solo esa y no mueve el resto', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Harness initial={['mes', 'id', 'residente_id']} onChange={onChange} />)

    await user.click(screen.getByRole('button', { name: /^Columnas/ }))
    await user.click(screen.getByRole('menuitemcheckbox', { name: /^id/ }))

    expect(onChange).toHaveBeenLastCalledWith(['mes', 'residente_id'])
  })

  it('se abre, se recorre y se marca con el teclado', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)

    screen.getByRole('button', { name: 'Columnas' }).focus()
    await user.keyboard('{Enter}')
    await user.keyboard('{ArrowDown}{Enter}')

    expect(onChange).toHaveBeenCalledTimes(1)
    expect((onChange.mock.calls[0] as string[][])[0]).toHaveLength(1)
  })
})
