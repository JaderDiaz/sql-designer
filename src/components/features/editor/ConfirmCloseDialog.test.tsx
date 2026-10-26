import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ConfirmCloseDialog } from '@/components/features/editor/ConfirmCloseDialog'
import { emptyModel } from '@/lib/model/defaults'
import { useAppStore } from '@/store'
import { resetStore } from '@/test/helpers'

/** Respuestas recogidas en lugar de ejecutar la intención pendiente. */
const resolvePending = vi.fn()

/** Abre el diálogo con un modelo con cambios sin guardar. */
function renderDialog() {
  resetStore()
  useAppStore.setState({
    model: emptyModel('Livy · Reservas', 'postgres'),
    isDirty: true,
    screen: 'editor',
    dialog: 'confirm-close',
    pendingIntent: 'close',
    resolvePending,
  })
  return render(<ConfirmCloseDialog />)
}

describe('pregunta por los cambios sin guardar (FR-028)', () => {
  beforeEach(() => {
    resolvePending.mockReset()
    resolvePending.mockResolvedValue(undefined)
  })

  it('nombra el modelo y ofrece las tres respuestas', () => {
    renderDialog()

    expect(screen.getByRole('heading', { name: '¿Guardar los cambios?' })).toBeInTheDocument()
    expect(screen.getByText(/«Livy · Reservas» tiene cambios sin guardar/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Guardar' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'No guardar' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeInTheDocument()
  })

  it('cada botón manda su respuesta', async () => {
    const user = userEvent.setup()
    renderDialog()

    await user.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(resolvePending).toHaveBeenLastCalledWith('save')

    await user.click(screen.getByRole('button', { name: 'No guardar' }))
    expect(resolvePending).toHaveBeenLastCalledWith('discard')

    await user.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(resolvePending).toHaveBeenLastCalledWith('cancel')
  })

  it('Esc equivale a «Cancelar»', async () => {
    const user = userEvent.setup()
    renderDialog()

    await user.keyboard('{Escape}')

    expect(resolvePending).toHaveBeenCalledWith('cancel')
  })
})
