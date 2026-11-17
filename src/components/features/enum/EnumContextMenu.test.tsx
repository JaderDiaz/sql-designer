import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'

import { EnumContextMenu, enumMenuMeta } from '@/components/features/enum/EnumContextMenu'
import { readFixture } from '@/lib/model/__fixtures__'
import { parseModel } from '@/lib/model/parse'
import type { Enum } from '@/lib/model/types'
import { useAppStore } from '@/store'
import { resetStore } from '@/test/helpers'

/**
 * Menú contextual de un enum (FR-020): se abre con el puntero y con ⇧F10, y
 * sus tres entradas llevan a la hoja, a la copia y a la confirmación.
 */

/** Abre el modelo de enums y dibuja una fila con el menú de `estado_pago`. */
function renderMenu() {
  const result = parseModel(readFixture('modelo-enums'))
  if (!result.ok) throw new Error('el ejemplo no es un modelo válido')
  resetStore()
  act(() => {
    useAppStore.setState({ screen: 'editor', model: result.model, savedModel: result.model })
  })
  const value = result.model.enums?.[0] as Enum
  return render(
    <EnumContextMenu value={value}>
      <button type="button">fila</button>
    </EnumContextMenu>,
  )
}

describe('EnumContextMenu', () => {
  beforeEach(() => renderMenu())

  it('la cabecera dice valores y campos, en singular y en plural', () => {
    expect(enumMenuMeta(4, 2)).toBe('Enum · 4 valores · 2 campos')
    expect(enumMenuMeta(1, 1)).toBe('Enum · 1 valor · 1 campo')
    expect(enumMenuMeta(3, 0)).toBe('Enum · 3 valores · sin uso')
  })

  it('con el puntero, «Editar enum…» abre la hoja', async () => {
    fireEvent.contextMenu(screen.getByRole('button', { name: 'fila' }))
    await userEvent.click(await screen.findByRole('menuitem', { name: /Editar enum/ }))

    expect(useAppStore.getState().dialog).toBe('enum')
    expect(useAppStore.getState().enumTarget).toBe('estado_pago')
  })

  it('con ⇧F10, «Eliminar enum…» abre la confirmación', async () => {
    screen.getByRole('button', { name: 'fila' }).focus()
    await userEvent.keyboard('{Shift>}{F10}{/Shift}')
    await userEvent.click(await screen.findByRole('menuitem', { name: /Eliminar enum/ }))

    expect(useAppStore.getState().dialog).toBe('delete-enum')
  })
})
