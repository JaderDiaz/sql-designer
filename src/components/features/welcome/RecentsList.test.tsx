import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  EMPTY_RECENTS_HINT,
  EMPTY_RECENTS_TITLE,
  RecentsList,
} from '@/components/features/welcome/RecentsList'
import { WelcomeScreen } from '@/components/features/welcome/WelcomeScreen'
import { formatModified } from '@/lib/format'
import { useAppStore } from '@/store'
import type { RecentEntry } from '@/store/recents'
import { resetStore } from '@/test/helpers'

vi.mock('@/lib/tauri/commands', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/tauri/commands')>()
  return {
    ...actual,
    recentsList: vi.fn(),
    recentsTouch: vi.fn(),
    preferencesUpdate: vi.fn(),
  }
})

const { recentsList } = await import('@/lib/tauri/commands')

/** Abrir un reciente se observa aquí en vez de leer el disco. */
const openRecent = vi.fn()

/** Las fechas se cuentan desde ahora, para que no caduquen con el calendario. */
const NOW = Date.now()

const ENTRIES: RecentEntry[] = [
  {
    path: '/Users/ada/Proyectos/livy/modelo.yaml',
    name: 'Livy · Modelo de datos',
    fileName: 'modelo.yaml',
    folder: '/Users/ada/Proyectos/livy',
    engine: 'postgres',
    tables: 6,
    usedAtMs: NOW,
    state: 'ok',
  },
  {
    path: '/Users/ada/Proyectos/livy/facturacion.yaml',
    name: 'Livy · Facturación',
    fileName: 'facturacion.yaml',
    folder: '/Users/ada/Proyectos/livy',
    engine: 'postgres',
    tables: 9,
    usedAtMs: NOW - 86_400_000,
    state: 'invalid',
  },
  {
    path: '/Users/ada/Clientes/acme/inventario.yaml',
    name: 'Inventario bodega',
    fileName: 'inventario.yaml',
    folder: '/Users/ada/Clientes/acme',
    engine: 'mysql',
    tables: 1,
    usedAtMs: NOW - 86_400_000 * 14,
    state: 'missing',
  },
]

/**
 * Entrada de la frontera equivalente a una fila, para la lectura que hace la
 * Bienvenida al montar.
 *
 * @param entry Fila de ejemplo.
 */
function toRecord(entry: RecentEntry) {
  const stamp = { modifiedMs: 1_000, sizeBytes: 400 }
  return {
    path: entry.path,
    name: entry.name,
    engine: entry.engine,
    tables: entry.tables,
    stamp,
    invalid: entry.state === 'invalid',
    usedAtMs: entry.usedAtMs,
    exists: entry.state !== 'missing',
    diskStamp: entry.state === 'missing' ? null : stamp,
  }
}

/**
 * Pinta la lista con las filas de ejemplo.
 *
 * @param entries Filas que se quieren ver.
 */
function renderList(entries: RecentEntry[] = ENTRIES) {
  resetStore()
  useAppStore.setState({ recents: entries, openRecent })
  return render(<RecentsList />)
}

describe('lista de Recientes (FR-031 a FR-033)', () => {
  beforeEach(() => {
    openRecent.mockReset()
    openRecent.mockResolvedValue(undefined)
    vi.mocked(recentsList).mockResolvedValue([])
  })

  it('cada fila dice nombre, ruta, fecha y el motor con sus tablas', () => {
    renderList()

    const rows = screen.getAllByRole('option')
    expect(rows).toHaveLength(3)
    const first = within(rows[0] as HTMLElement)
    expect(first.getByText('Livy · Modelo de datos')).toBeInTheDocument()
    expect(first.getByText('/Users/ada/Proyectos/livy/modelo.yaml')).toBeInTheDocument()
    expect(first.getByText(formatModified(NOW))).toBeInTheDocument()
    expect(formatModified(NOW)).toMatch(/^Hoy, /)
    expect(first.getByText('PostgreSQL · 6 tablas')).toBeInTheDocument()
  })

  it('una sola tabla va en singular', () => {
    renderList([{ ...ENTRIES[0]!, tables: 1 }])

    expect(screen.getByText('PostgreSQL · 1 tabla')).toBeInTheDocument()
  })

  it('las filas con problema lo dicen en su sitio', () => {
    renderList()

    const rows = screen.getAllByRole('option')
    expect(within(rows[1] as HTMLElement).getByText('Archivo con errores')).toBeInTheDocument()
    expect(within(rows[2] as HTMLElement).getByText('No encontrado')).toBeInTheDocument()
  })

  it('el doble clic abre la fila', async () => {
    const user = userEvent.setup()
    renderList()

    await user.dblClick(screen.getAllByRole('option')[0] as HTMLElement)

    expect(openRecent).toHaveBeenCalledWith('/Users/ada/Proyectos/livy/modelo.yaml')
  })

  it('un clic selecciona y Enter abre lo seleccionado', async () => {
    const user = userEvent.setup()
    renderList()

    await user.click(screen.getAllByRole('option')[1] as HTMLElement)
    expect(screen.getAllByRole('option')[1]).toHaveAttribute('aria-selected', 'true')

    await user.keyboard('{Enter}')
    expect(openRecent).toHaveBeenCalledWith('/Users/ada/Proyectos/livy/facturacion.yaml')
  })

  it('las flechas mueven la selección', async () => {
    const user = userEvent.setup()
    renderList()

    await user.click(screen.getAllByRole('option')[0] as HTMLElement)
    await user.keyboard('{ArrowDown}')

    expect(useAppStore.getState().recentSelection).toBe(
      '/Users/ada/Proyectos/livy/facturacion.yaml',
    )
  })

  it('sin recientes se ve el mensaje de lista vacía', () => {
    renderList([])

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(screen.getByText(EMPTY_RECENTS_TITLE)).toBeInTheDocument()
    expect(screen.getByText(EMPTY_RECENTS_HINT)).toBeInTheDocument()
  })
})

describe('la Bienvenida con su lista (FR-031)', () => {
  beforeEach(() => {
    openRecent.mockReset()
    openRecent.mockResolvedValue(undefined)
    vi.mocked(recentsList).mockResolvedValue([])
  })

  it('el total acompaña al título y «Abrir» espera una selección', async () => {
    const user = userEvent.setup()
    resetStore()
    vi.mocked(recentsList).mockResolvedValue(ENTRIES.map(toRecord))
    useAppStore.setState({ recents: ENTRIES, openRecent })

    render(<WelcomeScreen />)

    expect(screen.getByText('3 modelos')).toBeInTheDocument()
    const open = screen.getByRole('button', { name: 'Abrir' })
    expect(open).toBeDisabled()

    await user.click(screen.getAllByRole('option')[0] as HTMLElement)
    expect(open).toBeEnabled()

    await user.click(open)
    expect(openRecent).toHaveBeenCalledWith('/Users/ada/Proyectos/livy/modelo.yaml')
  })
})
