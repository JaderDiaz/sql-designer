import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { useContextMenuGuard } from '@/hooks/useContextMenuGuard'

/** Monta el guardia con un área que abre su propio menú. */
function Harness() {
  useContextMenuGuard()
  return (
    <div>
      <p data-testid="texto">Un párrafo cualquiera</p>
      <p
        data-testid="propio"
        onContextMenu={(event) => {
          // Es lo que hace Radix al abrir un menú contextual propio.
          event.preventDefault()
        }}
      >
        Fila de recientes
      </p>
    </div>
  )
}

/**
 * Lanza el menú contextual sobre un nodo y dice si quedó evitado.
 *
 * @param node Nodo sobre el que se hace clic derecho.
 */
function rightClick(node: Element): boolean {
  const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true })
  node.dispatchEvent(event)
  return event.defaultPrevented
}

describe('menús contextuales del sistema', () => {
  it('no sale el del navegador, y el propio sigue abriéndose', () => {
    const { getByTestId, unmount } = render(<Harness />)

    expect(rightClick(getByTestId('texto'))).toBe(true)
    expect(rightClick(getByTestId('propio'))).toBe(true)

    unmount()

    // Al desmontar deja de escuchar: nada queda enganchado al documento.
    expect(rightClick(document.body)).toBe(false)
  })
})
