import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { EditorScreen } from '@/components/features/editor/EditorScreen'
import { readFixture } from '@/lib/model/__fixtures__'
import { emptyModel } from '@/lib/model/defaults'
import { parseModel } from '@/lib/model/parse'
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

describe('la tarjeta del modelo vacío espera a que la ventana se asiente', () => {
  beforeEach(() => {
    resetStore()
  })

  it('mientras la ventana se mueve, la tarjeta no está puesta', () => {
    openEditor(true)

    render(<EditorScreen />)

    // El lienzo y las demás zonas sí: se estiran sin temblar porque no van
    // centradas. Lo único que espera es la tarjeta, que va en el centro.
    expect(screen.getByLabelText('Lienzo del modelo')).toBeInTheDocument()
    expect(screen.queryByText('Empieza a diseñar tu modelo')).not.toBeInTheDocument()
  })

  it('con la ventana en su sitio, la tarjeta entra', () => {
    openEditor(false)

    render(<EditorScreen />)

    expect(screen.getByText('Empieza a diseñar tu modelo')).toBeInTheDocument()
  })
})

describe('el Editor orquesta las cinco zonas', () => {
  beforeEach(() => {
    openEditor(false)
  })

  it('un modelo sin tablas muestra la tarjeta con sus tres filas (FR-005)', () => {
    render(<EditorScreen />)

    expect(screen.getByText('Crear la primera tabla')).toBeInTheDocument()
    expect(screen.getByText('Agregar un esquema')).toBeInTheDocument()
    expect(screen.getByText('Definir un enum')).toBeInTheDocument()
  })

  it('«Agregar un esquema» abre el diálogo Nuevo esquema (FR-005)', async () => {
    const user = userEvent.setup()
    render(<EditorScreen />)

    await user.click(screen.getByRole('button', { name: /Agregar un esquema/ }))

    expect(useAppStore.getState().dialog).toBe('schema')
  })

  it('con tablas, la tarjeta deja sitio al lienzo', () => {
    const result = parseModel(readFixture('modelo-tres-esquemas'))
    if (!result.ok) throw new Error('el ejemplo no es un modelo válido')
    useAppStore.setState({ model: result.model })

    render(<EditorScreen />)

    expect(screen.queryByText('Empieza a diseñar tu modelo')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Lienzo del modelo')).toBeInTheDocument()
  })
})
