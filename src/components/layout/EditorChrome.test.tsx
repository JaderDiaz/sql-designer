import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { EditorChrome, saveStatusText } from '@/components/layout/EditorChrome'
import { emptyModel } from '@/lib/model/defaults'
import { useAppStore } from '@/store'
import { addForeignKeyNotice, NO_SELECTION_MESSAGE } from '@/store/relations'
import { MACOS, resetStore } from '@/test/helpers'

vi.mock('@/lib/tauri/commands', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/tauri/commands')>()
  return { ...actual, windowControls: vi.fn(), modelWrite: vi.fn() }
})

/** Tabla del escenario, para las tres vías de la clave foránea (FR-001). */
const PAGOS = {
  name: 'pagos',
  schema: 'public',
  fields: [{ name: 'id', type: 'integer' }],
  primaryKey: ['id'],
}

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
  })

  it('tras renombrar dice «Editado»', () => {
    renderChrome()

    act(() => {
      useAppStore.getState().renameModel('Livy · Reservas 2026')
    })

    expect(screen.getByText('Editado · PostgreSQL')).toBeInTheDocument()
  })

  it('con la barra lateral a la vista no lleva los controles de la ventana', () => {
    renderChrome()

    // Viven en la barra lateral mientras se ve, que es la primera fila de la
    // ventana por la izquierda.
    expect(screen.queryByRole('button', { name: 'Cerrar' })).not.toBeInTheDocument()
  })

  it('con la barra lateral escondida, los controles de la ventana vuelven aquí (RS-01)', () => {
    renderChrome()

    act(() => {
      useAppStore.setState({ isSidebarHidden: true })
    })

    expect(screen.getByRole('button', { name: 'Cerrar' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Minimizar' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ampliar' })).toBeInTheDocument()
  })

  it('cada zona escondible se recoge por su lado (FR-006)', () => {
    renderChrome()

    const header = screen.getByRole('banner')
    const buttons = [...header.querySelectorAll('button')].map((button) =>
      button.getAttribute('aria-label'),
    )

    expect(buttons[0]).toBe('Ocultar barra lateral')
    expect(buttons[buttons.length - 1]).toBe('Ocultar inspector')
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

    act(() => {
      useAppStore.setState({ isSidebarHidden: true })
    })

    await user.click(screen.getByRole('button', { name: 'Cerrar' }))

    expect(useAppStore.getState().screen).toBe('welcome')
  })

  it('«Relación» abre la ficha de claves foráneas de la tabla seleccionada (FR-001)', async () => {
    const user = userEvent.setup()
    renderChrome()
    act(() => {
      useAppStore.setState({
        model: { ...emptyModel('Livy · Reservas', 'postgres'), tables: [PAGOS] },
        selectedTable: 'pagos',
      })
    })

    await user.click(screen.getByRole('button', { name: 'Relación' }))

    const state = useAppStore.getState()
    expect(state.isFieldsPanelOpen).toBe(true)
    expect(state.fieldsPanelTable).toBe('pagos')
    expect(state.panelTab).toBe('foreignKeys')
    expect(state.notice).toBe(addForeignKeyNotice('pagos'))
  })

  it('sin tabla seleccionada, «Relación» solo pide elegirla (FR-002)', async () => {
    const user = userEvent.setup()
    renderChrome()
    const before = useAppStore.getState().model

    await user.click(screen.getByRole('button', { name: 'Relación' }))

    const state = useAppStore.getState()
    expect(state.notice).toBe(NO_SELECTION_MESSAGE)
    expect(state.isFieldsPanelOpen).toBe(false)
    expect(state.model).toBe(before)
  })

  it('el texto del estado dice la hora solo cuando está guardado', () => {
    expect(saveStatusText(true, SAVED_AT)).toBe('Cambios sin guardar')
    expect(saveStatusText(false, null)).toBe('Guardado')
    expect(saveStatusText(false, SAVED_AT)).toBe('Guardado a las 9:12 a. m.')
  })
})
