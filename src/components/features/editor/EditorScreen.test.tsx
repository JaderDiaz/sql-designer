import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { EditorScreen } from '@/components/features/editor/EditorScreen'
import { emptyModel } from '@/lib/model/defaults'
import { useAppStore } from '@/store'
import { resetStore } from '@/test/helpers'

vi.mock('@/lib/tauri/commands', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/tauri/commands')>()
  return { ...actual, measureModelOpened: vi.fn().mockResolvedValue(undefined) }
})

/** Deja el Editor abierto con un modelo vacío. */
function openEditor(settling: boolean) {
  resetStore()
  useAppStore.setState({
    screen: 'editor',
    model: emptyModel('Livy · Reservas', 'postgres'),
    isWindowSettling: settling,
  })
}

describe('el lienzo espera a que la ventana se asiente', () => {
  beforeEach(() => {
    resetStore()
  })

  it('mientras la ventana se mueve, el lienzo no está puesto', () => {
    openEditor(true)

    render(<EditorScreen />)

    // La cabecera sí: se estira sin temblar porque no va centrada.
    expect(screen.getByLabelText('Lienzo del modelo')).toBeInTheDocument()
    expect(screen.queryByText('Empieza a diseñar tu modelo')).not.toBeInTheDocument()
  })

  it('con la ventana en su sitio, el lienzo entra', () => {
    openEditor(false)

    render(<EditorScreen />)

    expect(screen.getByText('Empieza a diseñar tu modelo')).toBeInTheDocument()
  })
})
