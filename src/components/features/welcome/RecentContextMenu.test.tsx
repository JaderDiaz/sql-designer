import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { RecentsList } from '@/components/features/welcome/RecentsList'
import { useAppStore } from '@/store'
import type { RecentEntry, RecentState } from '@/store/recents'
import { resetStore } from '@/test/helpers'

vi.mock('@/lib/tauri/commands', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/tauri/commands')>()
  return {
    ...actual,
    recentsRemove: vi.fn(),
    clipboardWriteText: vi.fn(),
    trashMove: vi.fn(),
    modelRead: vi.fn(),
  }
})

const { clipboardWriteText, recentsRemove } = await import('@/lib/tauri/commands')

const PATH = '/Users/ada/Proyectos/livy/modelo.yaml'

/**
 * Una fila con el estado que pide el escenario.
 *
 * @param state Estado de la fila.
 */
function entry(state: RecentState): RecentEntry {
  return {
    path: PATH,
    name: 'Livy · Modelo de datos',
    fileName: 'modelo.yaml',
    folder: '/Users/ada/Proyectos/livy',
    engine: 'postgres',
    tables: 6,
    usedAtMs: Date.now(),
    state,
  }
}

/**
 * Pinta la lista con una sola fila en el estado pedido.
 *
 * @param state Estado de la fila.
 */
function renderRow(state: RecentState = 'ok') {
  resetStore()
  useAppStore.setState({ recents: [entry(state)], recentSelection: PATH })
  return render(<RecentsList />)
}

/** Nombres de las acciones deshabilitadas del menú abierto. */
function disabledLabels(): string[] {
  return screen
    .getAllByRole('menuitem')
    .filter((item) => item.hasAttribute('data-disabled'))
    .map((item) => item.textContent ?? '')
}

describe('menú de una fila de Recientes (FR-035, FR-038, RS-09)', () => {
  beforeEach(() => {
    vi.mocked(recentsRemove).mockResolvedValue([])
    vi.mocked(clipboardWriteText).mockResolvedValue(undefined)
  })

  it('el clic derecho abre las cinco acciones y marca la fila', () => {
    renderRow()

    fireEvent.contextMenu(screen.getByRole('option'))

    expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual([
      'Abrir',
      'Renombrar…',
      'Copiar ruta',
      'Quitar de recientes',
      'Mover a la papelera…',
    ])
    expect(useAppStore.getState().recentSelection).toBe(PATH)
  })

  it('⇧F10 abre el mismo menú sin ratón', async () => {
    const user = userEvent.setup()
    renderRow()

    screen.getByRole('option').focus()
    await user.keyboard('{Shift>}{F10}{/Shift}')

    expect(screen.getByRole('menu')).toBeInTheDocument()
  })

  it('las flechas recorren el menú y Enter ejecuta la acción', async () => {
    const user = userEvent.setup()
    renderRow()
    fireEvent.contextMenu(screen.getByRole('option'))

    // Abrir, Renombrar…, Copiar ruta: la tercera copia al portapapeles.
    await user.keyboard('{ArrowDown}{ArrowDown}{ArrowDown}{Enter}')

    expect(clipboardWriteText).toHaveBeenCalledWith(PATH)
  })

  it('Esc cierra el menú sin hacer nada', async () => {
    const user = userEvent.setup()
    renderRow()
    fireEvent.contextMenu(screen.getByRole('option'))

    await user.keyboard('{Escape}')

    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(recentsRemove).not.toHaveBeenCalled()
  })

  it('«Quitar de recientes» no toca el archivo (FR-035)', async () => {
    const user = userEvent.setup()
    renderRow()
    fireEvent.contextMenu(screen.getByRole('option'))

    await user.click(screen.getByRole('menuitem', { name: 'Quitar de recientes' }))

    expect(recentsRemove).toHaveBeenCalledWith(PATH)
  })

  it('«Mover a la papelera…» pregunta antes de mover (RS-08)', async () => {
    const user = userEvent.setup()
    renderRow()
    fireEvent.contextMenu(screen.getByRole('option'))

    await user.click(screen.getByRole('menuitem', { name: 'Mover a la papelera…' }))

    expect(useAppStore.getState().dialog).toBe('trash')
    expect(useAppStore.getState().trashTarget?.path).toBe(PATH)
  })

  it('un reciente no encontrado no se abre, ni se renombra, ni va a la papelera', () => {
    renderRow('missing')

    fireEvent.contextMenu(screen.getByRole('option'))

    expect(disabledLabels()).toEqual(['Abrir', 'Renombrar…', 'Mover a la papelera…'])
  })

  it('un reciente con errores solo pierde el renombrado', () => {
    renderRow('invalid')

    fireEvent.contextMenu(screen.getByRole('option'))

    expect(disabledLabels()).toEqual(['Renombrar…'])
  })
})
