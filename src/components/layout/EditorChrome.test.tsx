import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { EditorChrome, saveStatusText } from '@/components/layout/EditorChrome'
import { emptyModel } from '@/lib/model/defaults'
import { useAppStore } from '@/store'
import { MACOS, resetStore } from '@/test/helpers'

vi.mock('@/lib/tauri/commands', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/tauri/commands')>()
  return { ...actual, windowControls: vi.fn(), modelWrite: vi.fn() }
})

/** Instante del escenario: 24 de octubre de 2026, 9:12. */
const SAVED_AT = new Date(2026, 9, 24, 9, 12).getTime()

/** Deja un modelo abierto y guardado, y pinta la cabecera. */
function renderChrome(engine: 'postgres' | 'mysql' = 'postgres') {
  resetStore({ platform: MACOS })
  const model = emptyModel('Livy · Reservas', engine)
  useAppStore.setState({
    model,
    savedModel: model,
    path: '/Users/ada/Proyectos/livy/livy-reservas.yaml',
    stamp: { modifiedMs: SAVED_AT, sizeBytes: 900 },
    isDirty: false,
    savedAtMs: SAVED_AT,
    screen: 'editor',
    past: [],
    future: [],
  })
  return render(<EditorChrome />)
}

describe('cabecera del Editor (FR-018, FR-019, RS-07)', () => {
  beforeEach(() => {
    resetStore({ platform: MACOS })
  })

  it('muestra el nombre del modelo y «Guardado · PostgreSQL» con la hora', () => {
    renderChrome()

    expect(screen.getByText('Livy · Reservas')).toBeInTheDocument()
    expect(screen.getByText('Guardado · PostgreSQL')).toBeInTheDocument()
    expect(screen.getByText(/Guardado a las 9:12/)).toBeInTheDocument()
  })

  it('tras renombrar dice «Editado» y el botón de cerrar lleva el indicador', () => {
    renderChrome()

    expect(screen.getByRole('button', { name: 'Cerrar' })).toBeInTheDocument()

    act(() => {
      useAppStore.getState().renameModel('Livy · Reservas 2026')
    })

    expect(screen.getByText('Editado · PostgreSQL')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cerrar (cambios sin guardar)' })).toHaveClass(
      'is-dirty',
    )
    expect(screen.getByText('Cambios sin guardar · ⌘S')).toBeInTheDocument()
  })

  it('el motor del modelo es el que se muestra', () => {
    renderChrome('mysql')

    expect(screen.getByText('Guardado · MySQL')).toBeInTheDocument()
  })

  it('deshacer y rehacer están deshabilitados sin historial', () => {
    renderChrome()

    expect(screen.getByRole('button', { name: 'Deshacer' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Rehacer' })).toBeDisabled()
  })

  it('renombrar abre su diálogo', async () => {
    const user = userEvent.setup()
    renderChrome()

    await user.click(screen.getByRole('button', { name: 'Renombrar modelo' }))

    expect(useAppStore.getState().dialog).toBe('rename')
  })

  it('cerrar sin cambios vuelve a la Bienvenida', async () => {
    const user = userEvent.setup()
    renderChrome()

    await user.click(screen.getByRole('button', { name: 'Cerrar' }))

    expect(useAppStore.getState().screen).toBe('welcome')
  })

  it('la ventana del Editor se cierra, se minimiza y se amplía (RS-01)', () => {
    renderChrome()

    // El Editor es la zona de trabajo: a diferencia de la Bienvenida, que es
    // un diálogo de tamaño fijo, aquí sí se puede agrandar la ventana.
    expect(screen.getByRole('button', { name: 'Cerrar' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Minimizar' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ampliar' })).toBeInTheDocument()
  })

  it('el texto del estado dice la hora solo cuando está guardado', () => {
    expect(saveStatusText(true, SAVED_AT)).toBe('Cambios sin guardar')
    expect(saveStatusText(false, null)).toBe('Guardado')
    expect(saveStatusText(false, SAVED_AT)).toBe('Guardado a las 9:12 a. m.')
  })
})
