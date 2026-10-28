import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'

import { CanvasSurface } from '@/components/features/canvas/CanvasSurface'
import { readFixture } from '@/lib/model/__fixtures__'
import { emptyModel } from '@/lib/model/defaults'
import { parseModel } from '@/lib/model/parse'
import { useAppStore } from '@/store'
import { resetStore } from '@/test/helpers'

/**
 * Pruebas del lienzo: lo que dibuja, lo que selecciona y lo que mueve
 * (FR-023, FR-026, FR-033).
 *
 * El arrastre se escribe en el almacén una sola vez, al soltar, así que lo que
 * se comprueba del gesto es el modelo que queda y el único paso de deshacer,
 * no los píxeles intermedios.
 */

/** Deja el modelo de tres esquemas abierto y dibuja el lienzo. */
function renderCanvas() {
  const result = parseModel(readFixture('modelo-tres-esquemas'))
  if (!result.ok) throw new Error('el ejemplo no es un modelo válido')
  resetStore()
  act(() => {
    useAppStore.setState({
      screen: 'editor',
      model: result.model,
      savedModel: result.model,
      isDirty: false,
    })
  })
  return render(<CanvasSurface />)
}

/** Arrastra la zona de un esquema de un punto a otro. */
async function dragZone(name: string, from: [number, number], to: [number, number]) {
  const zone = screen.getByRole('button', { name: new RegExp(`^Esquema \\w+ · ${name},`) })
  await userEvent.pointer([
    { keys: '[MouseLeft>]', target: zone, coords: { clientX: from[0], clientY: from[1] } },
    { target: zone, coords: { clientX: to[0], clientY: to[1] } },
    { keys: '[/MouseLeft]', target: zone, coords: { clientX: to[0], clientY: to[1] } },
  ])
}

/** Deja el modelo de relaciones abierto y dibuja el lienzo. */
function renderRelations() {
  const result = parseModel(readFixture('modelo-relaciones'))
  if (!result.ok) throw new Error('el ejemplo no es un modelo válido')
  resetStore()
  act(() => {
    useAppStore.setState({
      screen: 'editor',
      model: result.model,
      savedModel: result.model,
      isDirty: false,
    })
  })
  return render(<CanvasSurface />)
}

/** El `d` del trazo de una relación tal como está pintado ahora. */
function pathOfRelation(container: HTMLElement, name: string): string {
  const node = container.querySelector(`[data-relation="${name}"] .sm-rel-line`)
  if (node === null) throw new Error(`no se pintó ${name}`)
  return node.getAttribute('d') ?? ''
}

describe('CanvasSurface y las relaciones (FR-013, FR-018, FR-019)', () => {
  it('pinta las líneas entre las zonas y las tarjetas (FR-018)', () => {
    const { container } = renderRelations()
    const stage = container.querySelector('.sm-stage')
    if (stage === null) throw new Error('no hay escenario')

    const kinds = Array.from(stage.querySelectorAll('.sm-zone, .sm-rel-layer, .sm-table')).map(
      (node) =>
        node.classList.contains('sm-zone')
          ? 'zone'
          : node.classList.contains('sm-rel-layer')
            ? 'lines'
            : 'card',
    )

    expect(kinds).toContain('lines')
    expect(kinds.indexOf('lines')).toBeGreaterThan(kinds.lastIndexOf('zone'))
    expect(kinds.indexOf('lines')).toBeLessThan(kinds.indexOf('card'))
  })

  it('arrastrar una tabla repinta solo sus relaciones (FR-019, research R6)', async () => {
    const { container } = renderRelations()
    const card = screen.getByRole('button', { name: /^Tabla pagos,/ })
    const before = {
      propia: pathOfRelation(container, 'fk_pagos_pedido_id'),
      ajena: pathOfRelation(container, 'fk_pedidos_cliente_id'),
    }

    await userEvent.pointer([
      { keys: '[MouseLeft>]', target: card, coords: { clientX: 400, clientY: 300 } },
      { target: card, coords: { clientX: 460, clientY: 340 } },
    ])

    expect(pathOfRelation(container, 'fk_pagos_pedido_id')).not.toBe(before.propia)
    expect(pathOfRelation(container, 'fk_pedidos_cliente_id')).toBe(before.ajena)

    await userEvent.pointer([
      { keys: '[/MouseLeft]', target: card, coords: { clientX: 460, clientY: 340 } },
    ])
  })

  it('arrastrar desde la fila de un campo solo mueve la tabla (FR-001a)', async () => {
    renderRelations()
    const card = screen.getByRole('button', { name: /^Tabla pagos,/ })
    const row = card.querySelector('.sm-field-row')
    if (row === null) throw new Error('la tarjeta no lista sus campos')
    const before = (useAppStore.getState().model?.relations ?? []).length

    await userEvent.pointer([
      { keys: '[MouseLeft>]', target: row, coords: { clientX: 400, clientY: 300 } },
      { target: row, coords: { clientX: 520, clientY: 300 } },
      { keys: '[/MouseLeft]', target: row, coords: { clientX: 520, clientY: 300 } },
    ])

    const model = useAppStore.getState().model
    expect((model?.relations ?? []).length).toBe(before)
    // Lo que sí pasó es que la tabla se movió: el gesto es el de siempre.
    const pagos = (model?.tables ?? []).find((table) => table.name === 'pagos')
    expect(pagos?.position?.x).not.toBe(936)
  })
})

describe('CanvasSurface y el resaltado (FR-021 a FR-023, FR-026, FR-027)', () => {
  /** La tarjeta de una tabla del ejemplo. */
  function cardOf(name: string): HTMLElement {
    return screen.getByRole('button', { name: new RegExp(`^Tabla ${name},`) })
  }

  /** El estado del grupo de una relación: `hot`, `dim` o nada. */
  function stateOf(container: HTMLElement, name: string): string | null {
    const node = container.querySelector(`[data-relation="${name}"]`)
    if (node === null) throw new Error(`no se pintó ${name}`)
    return node.getAttribute('data-state')
  }

  it('el cursor sobre una tabla resalta su grupo y atenúa el resto (FR-021, FR-022)', async () => {
    const { container } = renderRelations()

    await userEvent.hover(cardOf('pagos'))

    // `pagos` apunta a `pedidos` y a `metodos_pago`.
    expect(cardOf('pagos').className).toContain('is-hot')
    expect(cardOf('pedidos').className).toContain('is-linked')
    expect(cardOf('metodos_pago').className).toContain('is-linked')
    expect(cardOf('clientes').className).toContain('is-dim')
    expect(stateOf(container, 'fk_pagos_pedido_id')).toBe('hot')
    expect(stateOf(container, 'fk_pedidos_cliente_id')).toBe('dim')
  })

  it('llegar con el teclado resalta igual que el cursor (FR-021)', () => {
    const { container } = renderRelations()

    act(() => fireEvent.focus(cardOf('pagos')))

    expect(cardOf('pagos').className).toContain('is-hot')
    expect(stateOf(container, 'fk_pagos_metodo_id')).toBe('hot')
  })

  it('marca los campos de la relación en las dos tablas (FR-023)', async () => {
    renderRelations()

    await userEvent.hover(cardOf('pagos'))

    /** Los campos marcados de una tarjeta. */
    function hotFields(table: string): string[] {
      return Array.from(cardOf(table).querySelectorAll('.sm-field-row[data-hot]')).map(
        (row) => row.querySelector('.sm-field-name')?.textContent ?? '',
      )
    }

    expect(hotFields('pagos')).toEqual(['pedido_id', 'metodo_id'])
    // Y al otro lado, el campo referenciado.
    expect(hotFields('pedidos')).toEqual(['id'])
  })

  it('mientras se arrastra no se resalta nada (research R7)', async () => {
    const { container } = renderRelations()
    const card = cardOf('pagos')

    await userEvent.pointer([
      { keys: '[MouseLeft>]', target: card, coords: { clientX: 400, clientY: 300 } },
      { target: card, coords: { clientX: 470, clientY: 300 } },
    ])

    expect(cardOf('pagos').className).not.toContain('is-hot')
    expect(stateOf(container, 'fk_pagos_pedido_id')).toBeNull()

    await userEvent.pointer([
      { keys: '[/MouseLeft]', target: card, coords: { clientX: 470, clientY: 300 } },
    ])
  })

  it('el foco de esquema resalta por el mismo camino (FR-027)', () => {
    const { container } = renderRelations()

    act(() => {
      useAppStore.getState().focusSchema('ventas')
    })

    expect(cardOf('pedidos').className).toContain('is-hot')
    expect(cardOf('clientes').className).toContain('is-dim')
    // La relación entre dos tablas de `ventas` queda resaltada.
    expect(stateOf(container, 'fk_pagos_pedido_id')).toBe('hot')
    // Y la que vive dentro de `personas`, atenuada.
    expect(stateOf(container, 'fk_clientes_recomendado_por')).toBe('dim')
  })

  it('sin cursor ni selección no queda nada atenuado (FR-026)', async () => {
    const { container } = renderRelations()

    await userEvent.hover(cardOf('pagos'))
    await userEvent.unhover(cardOf('pagos'))

    expect(container.querySelectorAll('.sm-table.is-dim')).toHaveLength(0)
    expect(container.querySelectorAll('.sm-zone.is-dim')).toHaveLength(0)
    expect(container.querySelectorAll('.sm-rel[data-state]')).toHaveLength(0)
  })

  it('seleccionar una tabla también la resalta (FR-021)', async () => {
    renderRelations()

    await userEvent.click(cardOf('pagos'))
    await userEvent.unhover(cardOf('pagos'))

    expect(useAppStore.getState().selectedTable).toBe('pagos')
    expect(cardOf('pagos').className).toContain('is-hot')
  })
})

describe('CanvasSurface con el modelo en blanco', () => {
  it('un modelo sin esquemas ni tablas no dibuja nada (FR-005a)', () => {
    resetStore()
    act(() => {
      useAppStore.setState({ screen: 'editor', model: emptyModel('Livy', 'postgres') })
    })
    render(<CanvasSurface />)

    expect(screen.queryAllByRole('button', { name: /^Esquema / })).toHaveLength(0)
  })
})

describe('CanvasSurface con mandos encima', () => {
  it('el doble clic en un mando del lienzo no abre Nueva tabla (FR-006)', async () => {
    const result = parseModel(readFixture('modelo-tres-esquemas'))
    if (!result.ok) throw new Error('el ejemplo no es un modelo válido')
    resetStore()
    act(() => {
      useAppStore.setState({ screen: 'editor', model: result.model, savedModel: result.model })
    })
    render(
      <CanvasSurface
        overlay={
          <button type="button" className="sm-zoombar">
            Acercar
          </button>
        }
      />,
    )

    await userEvent.dblClick(screen.getByRole('button', { name: 'Acercar' }))

    expect(useAppStore.getState().dialog).toBeNull()
  })

  it('el doble clic en el fondo sí la abre (FR-006)', async () => {
    renderCanvas()

    await userEvent.dblClick(screen.getByRole('button', { name: /^Esquema VEN · ventas,/ }))

    expect(useAppStore.getState().dialog).toBe('table')
  })
})

describe('CanvasSurface', () => {
  beforeEach(() => renderCanvas())

  it('dibuja una zona por esquema y una tarjeta por tabla (FR-023)', () => {
    expect(
      screen.getByRole('button', { name: /^Esquema VEN · ventas, 2 tablas$/ }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /^Esquema REP · reportes, sin tablas$/ }),
    ).toBeInTheDocument()
    expect(
      // El nombre sigue con un campo por frase, así que aquí basta el encabezado.
      screen.getByRole('button', { name: /^Tabla facturas, esquema VEN · ventas, 3 campos\./ }),
    ).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /^Tabla / })).toHaveLength(4)
  })

  it('pulsar una zona selecciona su esquema, que es lo que mira el inspector (FR-033)', async () => {
    await userEvent.click(screen.getByRole('button', { name: /^Esquema INV · inventario,/ }))

    expect(useAppStore.getState().selectedSchema).toBe('inventario')
  })

  it('arrastrar una zona mueve sus tablas y deja un solo paso de deshacer (FR-026, FR-027)', async () => {
    await dragZone('ventas', [100, 100], [160, 140])

    const tables = useAppStore.getState().model?.tables ?? []
    expect(tables.find((table) => table.name === 'facturas')?.position).toEqual({ x: 60, y: 40 })
    expect(tables.find((table) => table.name === 'pagos')?.position).toEqual({ x: 300, y: 40 })
    expect(tables.find((table) => table.name === 'productos')?.position).toBeUndefined()
    expect(useAppStore.getState().past).toHaveLength(1)
    expect(useAppStore.getState().isDirty).toBe(true)
  })

  it('arrastrar la zona de un esquema sin tablas escribe su posición (FR-026a)', async () => {
    await dragZone('reportes', [100, 100], [50, 125])

    const schema = useAppStore
      .getState()
      .model?.schemas.find((candidate) => candidate.name === 'reportes')
    expect(schema?.position).toEqual({ x: 1050, y: 25 })
  })

  it('el desplazamiento se mide en coordenadas del modelo, no de la pantalla (FR-026)', async () => {
    act(() => {
      useAppStore.getState().setView({ pan: { x: 0, y: 0 }, zoom: 2 })
    })

    await dragZone('ventas', [100, 100], [200, 100])

    expect(useAppStore.getState().model?.tables?.[0]?.position).toEqual({ x: 50, y: 0 })
  })

  it('un clic sin recorrido no mueve nada', async () => {
    await dragZone('ventas', [100, 100], [101, 100])

    expect(useAppStore.getState().past).toHaveLength(0)
    expect(useAppStore.getState().isDirty).toBe(false)
  })

  it('al terminar el gesto el lienzo vuelve a pintar normal (SC-003)', async () => {
    await dragZone('ventas', [100, 100], [160, 140])

    expect(useAppStore.getState().isGesturing).toBe(false)
  })
})

describe('CanvasSurface: mover la vista y hacer zoom (FR-007 a FR-011, FR-039)', () => {
  beforeEach(() => renderCanvas())

  /** El lienzo, por su nombre accesible. */
  function canvas(): HTMLElement {
    return screen.getByRole('application', { name: 'Lienzo del modelo' })
  }

  it('arrastrar desde un espacio vacío mueve la vista (FR-007)', async () => {
    await userEvent.pointer([
      { keys: '[MouseLeft>]', target: canvas(), coords: { clientX: 400, clientY: 300 } },
      { target: canvas(), coords: { clientX: 460, clientY: 340 } },
      { keys: '[/MouseLeft]', target: canvas(), coords: { clientX: 460, clientY: 340 } },
    ])

    await waitFor(() => {
      expect(useAppStore.getState().pan).toEqual({ x: 60, y: 40 })
    })
    expect(useAppStore.getState().zoom).toBe(1)
  })

  it('arrastrar con la rueda pulsada mueve la vista también encima de una zona (FR-007)', async () => {
    const zone = screen.getByRole('button', { name: /^Esquema VEN · ventas,/ })

    await userEvent.pointer([
      { keys: '[MouseMiddle>]', target: zone, coords: { clientX: 400, clientY: 300 } },
      { target: zone, coords: { clientX: 380, clientY: 280 } },
      { keys: '[/MouseMiddle]', target: zone, coords: { clientX: 380, clientY: 280 } },
    ])

    await waitFor(() => {
      expect(useAppStore.getState().pan).toEqual({ x: -20, y: -20 })
    })
    // La zona no se movió: el gesto era de la vista.
    expect(useAppStore.getState().model?.tables?.[0]?.position).toBeUndefined()
  })

  it('con la barra espaciadora mantenida, arrastrar una zona mueve la vista (FR-007)', async () => {
    const zone = screen.getByRole('button', { name: /^Esquema VEN · ventas,/ })
    fireEvent.keyDown(canvas(), { key: ' ', code: 'Space' })

    await userEvent.pointer([
      { keys: '[MouseLeft>]', target: zone, coords: { clientX: 400, clientY: 300 } },
      { target: zone, coords: { clientX: 450, clientY: 300 } },
      { keys: '[/MouseLeft]', target: zone, coords: { clientX: 450, clientY: 300 } },
    ])

    await waitFor(() => {
      expect(useAppStore.getState().pan).toEqual({ x: 50, y: 0 })
    })
    expect(useAppStore.getState().model?.tables?.[0]?.position).toBeUndefined()

    fireEvent.keyUp(canvas(), { key: ' ', code: 'Space' })
  })

  it('soltar la barra espaciadora devuelve el arrastre a la zona', async () => {
    fireEvent.keyDown(canvas(), { key: ' ', code: 'Space' })
    fireEvent.keyUp(canvas(), { key: ' ', code: 'Space' })

    await dragZone('ventas', [100, 100], [160, 140])

    expect(useAppStore.getState().model?.tables?.[0]?.position).toEqual({ x: 60, y: 40 })
  })

  it('la rueda sola mueve la vista (FR-007)', async () => {
    fireEvent.wheel(canvas(), { deltaX: 30, deltaY: 50 })

    await waitFor(() => {
      expect(useAppStore.getState().pan).toEqual({ x: -30, y: -50 })
    })
    expect(useAppStore.getState().zoom).toBe(1)
  })

  it('⌘ y la rueda acercan sin mover la escala al centro (FR-009)', async () => {
    fireEvent.wheel(canvas(), { deltaY: -200, metaKey: true })

    await waitFor(() => {
      expect(useAppStore.getState().zoom).toBeGreaterThan(1)
    })
  })

  it('el pellizco del panel táctil aleja igual que ⌘ y la rueda (FR-009)', async () => {
    fireEvent.wheel(canvas(), { deltaY: 200, ctrlKey: true })

    await waitFor(() => {
      expect(useAppStore.getState().zoom).toBeLessThan(1)
    })
  })

  it('el zoom de la rueda no se sale de los topes (FR-008)', async () => {
    for (let index = 0; index < 20; index += 1) {
      fireEvent.wheel(canvas(), { deltaY: -400, metaKey: true })
    }

    await waitFor(() => {
      expect(useAppStore.getState().zoom).toBe(2)
    })
  })

  it('las flechas mueven la vista (FR-039)', async () => {
    fireEvent.keyDown(canvas(), { key: 'ArrowRight' })

    await waitFor(() => {
      expect(useAppStore.getState().pan.x).toBeLessThan(0)
    })
  })

  it('⌘0 devuelve el 100 % y ⇧1 ajusta (FR-039)', () => {
    act(() => {
      useAppStore.getState().setView({ pan: { x: 0, y: 0 }, zoom: 1.8 })
    })

    fireEvent.keyDown(canvas(), { key: '0', metaKey: true })
    expect(useAppStore.getState().zoom).toBe(1)

    fireEvent.keyDown(canvas(), { key: '1', code: 'Digit1', shiftKey: true })
    expect(useAppStore.getState().zoom).not.toBe(1)
  })

  it('⌘+ y ⌘− cambian el zoom un paso (FR-039)', () => {
    fireEvent.keyDown(canvas(), { key: '=', metaKey: true })
    expect(useAppStore.getState().zoom).toBeCloseTo(1.1, 6)

    fireEvent.keyDown(canvas(), { key: '-', metaKey: true })
    expect(useAppStore.getState().zoom).toBeCloseTo(1, 6)
  })
})

describe('CanvasSurface: foco de un esquema (FR-030, FR-031)', () => {
  beforeEach(() => renderCanvas())

  it('con un esquema enfocado, las demás zonas y sus tablas se atenúan (FR-030)', () => {
    act(() => {
      useAppStore.getState().focusSchema('ventas')
    })

    const ventas = screen.getByRole('button', { name: /^Esquema VEN · ventas,/ })
    const inventario = screen.getByRole('button', { name: /^Esquema INV · inventario,/ })
    const facturas = screen.getByRole('button', { name: /^Tabla facturas,/ })
    const productos = screen.getByRole('button', { name: /^Tabla productos,/ })

    expect(ventas.className).not.toContain('is-dim')
    expect(facturas.className).not.toContain('is-dim')
    expect(inventario.className).toContain('is-dim')
    expect(productos.className).toContain('is-dim')
  })

  it('Esc en el lienzo suelta el foco y deja la vista donde está (FR-031)', () => {
    act(() => {
      useAppStore.getState().focusSchema('ventas')
    })
    const view = { pan: useAppStore.getState().pan, zoom: useAppStore.getState().zoom }

    fireEvent.keyDown(screen.getByRole('application', { name: 'Lienzo del modelo' }), {
      key: 'Escape',
    })

    expect(useAppStore.getState().focusedSchema).toBeNull()
    expect(useAppStore.getState().pan).toEqual(view.pan)
    expect(useAppStore.getState().zoom).toBe(view.zoom)
  })
})
