import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { PreferencesWindow } from '@/components/features/preferences/PreferencesWindow'
import { resetStore } from '@/test/helpers'
import { useAppStore } from '@/store'
import { DEFAULT_PREFERENCES } from '@/store/preferences'

vi.mock('@/lib/tauri/commands', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/tauri/commands')>()
  return { ...actual, preferencesUpdate: vi.fn() }
})

const { preferencesUpdate } = await import('@/lib/tauri/commands')

/** Abre Ajustes antes de cada prueba, como lo haría cualquiera de las tres vías. */
function renderOpen() {
  resetStore()
  useAppStore.setState({ isPreferencesOpen: true })
  return render(<PreferencesWindow />)
}

describe('Ajustes', () => {
  beforeEach(() => {
    vi.mocked(preferencesUpdate).mockImplementation((patch) =>
      Promise.resolve({ ...DEFAULT_PREFERENCES, ...patch }),
    )
  })

  it('ofrece los tres valores de tema y marca el elegido', async () => {
    const user = userEvent.setup()
    renderOpen()

    const sistema = screen.getByRole('radio', { name: 'Sistema' })
    const claro = screen.getByRole('radio', { name: 'Claro' })
    const oscuro = screen.getByRole('radio', { name: 'Oscuro' })

    expect(sistema).toBeChecked()

    await user.click(oscuro)
    expect(preferencesUpdate).toHaveBeenCalledWith({ theme: 'dark' })

    await user.click(claro)
    expect(preferencesUpdate).toHaveBeenCalledWith({ theme: 'light' })
  })

  it('no muestra ninguna otra preferencia', () => {
    renderOpen()

    // Tres opciones de tema, tres de trazado y tres de animación, y nada más.
    expect(screen.getAllByRole('radio')).toHaveLength(9)
    expect(
      screen.getAllByRole('radiogroup').map((group) => group.getAttribute('aria-label')),
    ).toEqual(['Tema', 'Trazado de relaciones', 'Animación de relaciones'])
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
    // Los dos prefijos del Incremento 5 son los únicos campos de texto.
    expect(screen.getAllByRole('textbox').map((box) => box.getAttribute('aria-label'))).toEqual([
      'Prefijo de índices',
      'Prefijo de únicos',
    ])
  })

  it('los prefijos se escriben al salir del campo y muestran lo guardado (FR-043)', async () => {
    vi.mocked(preferencesUpdate).mockImplementation((patch) =>
      Promise.resolve({ ...DEFAULT_PREFERENCES, ...patch, indexPrefix: 'ix_' }),
    )
    const user = userEvent.setup()
    renderOpen()

    const field = screen.getByRole('textbox', { name: 'Prefijo de índices' })
    expect(field).toHaveValue('idx_')
    expect(screen.getByText('Ejemplo: idx_pago_residente_id')).toBeInTheDocument()

    await user.clear(field)
    await user.type(field, ' IX_ ')
    expect(preferencesUpdate).not.toHaveBeenCalled()

    await user.tab()
    expect(preferencesUpdate).toHaveBeenCalledWith({ indexPrefix: ' IX_ ' })
    expect(await screen.findByText('Ejemplo: ix_pago_residente_id')).toBeInTheDocument()
    expect(field).toHaveValue('ix_')
  })

  it('Enter también escribe el prefijo de únicos (FR-043)', async () => {
    const user = userEvent.setup()
    renderOpen()

    const field = screen.getByRole('textbox', { name: 'Prefijo de únicos' })
    await user.clear(field)
    await user.type(field, 'un_{Enter}')

    expect(preferencesUpdate).toHaveBeenCalledWith({ uniquePrefix: 'un_' })
  })

  it('el control de tema se recorre y se activa solo con el teclado', async () => {
    const user = userEvent.setup()
    renderOpen()

    // Radix lleva el foco al primer control al abrir: la pestaña «General».
    expect(screen.getByRole('tab', { name: 'General' })).toHaveFocus()

    await user.tab()
    expect(screen.getByRole('radio', { name: 'Sistema' })).toHaveFocus()

    await user.keyboard('{ArrowRight}')

    expect(screen.getByRole('radio', { name: 'Claro' })).toHaveFocus()

    await user.keyboard(' ')
    expect(preferencesUpdate).toHaveBeenCalledWith({ theme: 'light' })

    await user.tab()
    expect(screen.getByRole('switch', { name: 'Ajustar a la cuadrícula' })).toHaveFocus()

    await user.tab()
    expect(screen.getByRole('radio', { name: 'Ortogonal' })).toHaveFocus()

    await user.tab()
    expect(screen.getByRole('radio', { name: 'Sutil' })).toHaveFocus()

    await user.tab()
    expect(screen.getByRole('textbox', { name: 'Prefijo de índices' })).toHaveFocus()

    await user.tab()
    expect(screen.getByRole('textbox', { name: 'Prefijo de únicos' })).toHaveFocus()

    await user.tab()
    expect(screen.getByRole('button', { name: 'Cerrar' })).toHaveFocus()
  })

  it('«Trazado de relaciones» escribe la preferencia sin cerrar la ventana (FR-017)', async () => {
    const user = userEvent.setup()
    renderOpen()

    await user.click(screen.getByRole('radio', { name: 'Curvas' }))

    expect(preferencesUpdate).toHaveBeenCalledWith({ relationRoute: 'curved' })
    // El lienzo ya tiene el trazado nuevo con Ajustes todavía abierto: la
    // preferencia no espera a que se cierre.
    expect(useAppStore.getState().preferences.relationRoute).toBe('curved')
    expect(useAppStore.getState().isPreferencesOpen).toBe(true)
  })

  it('«Animación de relaciones» escribe la preferencia y dice qué anima (FR-024)', async () => {
    const user = userEvent.setup()
    renderOpen()

    expect(screen.getByText('Los puntos que fluyen por las relaciones activas.')).toBeInTheDocument()

    await user.click(screen.getByRole('radio', { name: 'Viva' }))

    expect(preferencesUpdate).toHaveBeenCalledWith({ relationAnimation: 'lively' })
    expect(useAppStore.getState().preferences.relationAnimation).toBe('lively')
  })

  it('el valor guardado llega marcado al abrir la ventana (FR-017, FR-024)', () => {
    resetStore({ preferences: { relationRoute: 'straight', relationAnimation: 'off' } })
    useAppStore.setState({ isPreferencesOpen: true })
    render(<PreferencesWindow />)

    expect(screen.getByRole('radio', { name: 'Rectas' })).toBeChecked()
    expect(screen.getByRole('radio', { name: 'Apagada' })).toBeChecked()
  })

  it('«Ajustar a la cuadrícula» escribe la preferencia (FR-032)', async () => {
    const user = userEvent.setup()
    renderOpen()

    await user.click(screen.getByRole('switch', { name: 'Ajustar a la cuadrícula' }))

    expect(preferencesUpdate).toHaveBeenCalledWith({ snapToGrid: true })
    expect(
      screen.getByText('Las tablas se alinean a los puntos del lienzo al soltarlas'),
    ).toBeInTheDocument()
  })
})
