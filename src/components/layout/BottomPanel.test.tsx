import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { BottomPanel } from '@/components/layout/BottomPanel'
import { useAppStore } from '@/store'
import {
  FIELDS_PANEL_DEFAULT_HEIGHT,
  FIELDS_PANEL_MAX_HEIGHT,
  FIELDS_PANEL_MIN_HEIGHT,
  FIELDS_PANEL_STEP,
} from '@/store/fieldsPanel'
import { resetStore } from '@/test/helpers'
import type { Table } from '@/lib/model/types'

vi.mock('@/lib/tauri/commands', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/tauri/commands')>()
  return { ...actual, preferencesUpdate: vi.fn(async () => undefined) }
})

const { preferencesUpdate } = await import('@/lib/tauri/commands')

/**
 * Pruebas del marco del panel inferior (FR-022, FR-023).
 *
 * El alto es una preferencia de la aplicación, así que el panel tiene dos
 * trabajos: quedarse entre 200 y 560 px por donde se le empuje, y escribir la
 * preferencia al soltar el tirador, no en cada movimiento del puntero.
 */

/** Tabla abierta en el panel, de la que salen los contadores de las fichas. */
const PAGOS: Table = {
  name: 'pagos',
  schema: 'public',
  fields: [
    { name: 'id', type: 'uuid' },
    { name: 'unidad_id', type: 'uuid' },
  ],
  primaryKey: ['id'],
}

/** Dibuja el panel con el almacén en el Editor. */
function renderPanel() {
  resetStore()
  act(() => {
    useAppStore.setState({
      screen: 'editor',
      isFieldsPanelOpen: true,
      fieldsPanelTable: 'pagos',
      model: {
        formatVersion: 1,
        name: 'Tablero',
        engine: 'postgres',
        schemas: [{ name: 'public', abbreviation: 'PUB' }],
        tables: [PAGOS],
        relations: [
          {
            name: 'fk_pagos_unidad_id',
            fromTable: 'pagos',
            fromFields: ['unidad_id'],
            toTable: 'unidad',
            toFields: ['id'],
          },
        ],
      },
    })
  })
  return render(
    <BottomPanel table={PAGOS}>
      <p>Campos</p>
    </BottomPanel>,
  )
}

/** El tirador del alto. */
function handle(): HTMLElement {
  return screen.getByRole('separator', { name: 'Cambiar el alto del editor de tabla' })
}

/** Arrastra el tirador por los puntos dados, en píxeles de pantalla. */
async function drag(...steps: number[]) {
  const target = handle()
  target.setPointerCapture = () => undefined
  target.releasePointerCapture = () => undefined
  target.hasPointerCapture = () => true
  const last = steps.at(-1) ?? 400
  await userEvent.pointer([
    { keys: '[MouseLeft>]', target, coords: { clientX: 0, clientY: 400 } },
    ...steps.map((y) => ({ target, coords: { clientX: 0, clientY: y } })),
    { keys: '[/MouseLeft]', target, coords: { clientX: 0, clientY: last } },
  ])
}

describe('BottomPanel', () => {
  beforeEach(() => {
    vi.mocked(preferencesUpdate).mockClear()
    renderPanel()
  })

  it('anuncia el alto del panel en píxeles (§5)', () => {
    expect(handle()).toHaveAttribute('aria-valuenow', String(FIELDS_PANEL_DEFAULT_HEIGHT))
    expect(handle()).toHaveAttribute('aria-valuemin', String(FIELDS_PANEL_MIN_HEIGHT))
    expect(handle()).toHaveAttribute('aria-valuemax', String(FIELDS_PANEL_MAX_HEIGHT))
    expect(handle()).toHaveAttribute('aria-orientation', 'horizontal')
  })

  it('el puntero cambia el alto y se queda en el tope de arriba (FR-022)', async () => {
    await drag(340)
    expect(useAppStore.getState().fieldsPanelHeight).toBe(FIELDS_PANEL_DEFAULT_HEIGHT + 60)

    await drag(-1000)
    expect(useAppStore.getState().fieldsPanelHeight).toBe(FIELDS_PANEL_MAX_HEIGHT)
  })

  it('se queda en el tope de abajo (FR-022)', async () => {
    await drag(1400)

    expect(useAppStore.getState().fieldsPanelHeight).toBe(FIELDS_PANEL_MIN_HEIGHT)
  })

  it('escribe la preferencia al soltar, no en cada movimiento (contracts/preferences.md)', async () => {
    const target = handle()
    target.setPointerCapture = () => undefined
    target.releasePointerCapture = () => undefined
    target.hasPointerCapture = () => true
    await userEvent.pointer([
      { keys: '[MouseLeft>]', target, coords: { clientX: 0, clientY: 400 } },
      { target, coords: { clientX: 0, clientY: 380 } },
      { target, coords: { clientX: 0, clientY: 360 } },
    ])
    expect(preferencesUpdate).not.toHaveBeenCalled()

    fireEvent.pointerUp(target, { pointerId: 1, clientY: 360 })
    expect(preferencesUpdate).toHaveBeenCalledWith({
      fieldsPanelHeight: FIELDS_PANEL_DEFAULT_HEIGHT + 40,
    })
  })

  it('las flechas cambian el alto en pasos de 24 px (FR-022, FR-046)', async () => {
    handle().focus()
    await userEvent.keyboard('{ArrowUp}')
    expect(useAppStore.getState().fieldsPanelHeight).toBe(
      FIELDS_PANEL_DEFAULT_HEIGHT + FIELDS_PANEL_STEP,
    )

    await userEvent.keyboard('{ArrowDown}{ArrowDown}')
    expect(useAppStore.getState().fieldsPanelHeight).toBe(
      FIELDS_PANEL_DEFAULT_HEIGHT - FIELDS_PANEL_STEP,
    )
    expect(preferencesUpdate).toHaveBeenCalledTimes(3)
  })

  it('es el editor de tabla, con sus dos fichas y sus contadores (FR-003, §5)', () => {
    expect(screen.getByRole('region', { name: 'Editor de tabla' })).toBeInTheDocument()
    const tabs = screen.getByRole('tablist', { name: 'Secciones de la tabla' })
    expect(tabs).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Campos 2' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    expect(screen.getByRole('tab', { name: 'Claves foráneas 1' })).toBeInTheDocument()
  })

  it('cambiar de ficha cambia la ficha activa del almacén (FR-003)', async () => {
    await userEvent.click(screen.getByRole('tab', { name: 'Claves foráneas 1' }))

    expect(useAppStore.getState().panelTab).toBe('foreignKeys')
  })

  it('cerrar el panel conserva la selección de la tabla (FR-023)', async () => {
    act(() => {
      useAppStore.setState({ selectedTable: 'pagos' })
    })
    await userEvent.click(screen.getByRole('button', { name: 'Cerrar el editor de tabla' }))

    const state = useAppStore.getState()
    expect(state.isFieldsPanelOpen).toBe(false)
    expect(state.selectedTable).toBe('pagos')
  })
})
