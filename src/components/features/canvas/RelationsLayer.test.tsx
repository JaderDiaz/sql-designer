import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { RelationsLayer } from '@/components/features/canvas/RelationsLayer'
import { resolveLayout } from '@/lib/canvas/layout'
import { glyphOf, relationAnchors, relationLayer } from '@/lib/canvas/relations'
import type { RelationRoute } from '@/lib/canvas/relations'
import { readFixture } from '@/lib/model/__fixtures__'
import { cardinalityOf } from '@/lib/model/marks'
import { parseModel } from '@/lib/model/parse'
import type { Model, Relation, Table } from '@/lib/model/types'

/**
 * Pruebas de la capa de relaciones (FR-013 a FR-015, FR-018).
 *
 * `jsdom` no hace layout de SVG, así que no se mide nada: lo que se afirma es
 * el atributo `d` de cada trazo y de cada glifo, el color que lleva el grupo y
 * que la capa no aporta nada al árbol de accesibilidad. La geometría en sí es
 * de `src/lib/canvas/relations.ts` y tiene sus propias pruebas.
 */

/** El modelo de ejemplo del incremento, con sus seis relaciones. */
function relations(): Model {
  const result = parseModel(readFixture('modelo-relaciones'))
  if (!result.ok) throw new Error('el ejemplo no es un modelo válido')
  return result.model
}

/** Dibuja la capa de un modelo con el trazado dado. */
function renderLayer(model: Model, route: RelationRoute = 'orthogonal') {
  const layout = resolveLayout(model)
  const result = render(
    <RelationsLayer
      model={model}
      layout={layout}
      lines={relationLayer(model, layout, route)}
      route={route}
    />,
  )
  return { ...result, layout }
}

/** El grupo de una relación. */
function group(container: HTMLElement, name: string): Element {
  const node = container.querySelector(`[data-relation="${name}"]`)
  if (node === null) throw new Error(`no se pintó ${name}`)
  return node
}

/** Una relación del modelo. */
function relationOf(model: Model, name: string): Relation {
  const relation = (model.relations ?? []).find((item) => item.name === name)
  if (relation === undefined) throw new Error(`no hay relación ${name}`)
  return relation
}

describe('RelationsLayer', () => {
  it('pinta un grupo con su trazo y sus dos glifos por relación (FR-013)', () => {
    const model = relations()
    const { container } = renderLayer(model)

    expect(container.querySelectorAll('.sm-rel')).toHaveLength(6)
    expect(container.querySelectorAll('.sm-rel-line')).toHaveLength(6)
    expect(container.querySelectorAll('.sm-rel-glyph')).toHaveLength(12)
  })

  it('el trazo lleva la `d` de la geometría, y cambia con el trazado (FR-017)', () => {
    const model = relations()
    const layout = resolveLayout(model)
    const expected = relationLayer(model, layout, 'orthogonal')[0]

    const { container } = renderLayer(model)
    const line = group(container, expected?.name ?? '').querySelector('.sm-rel-line')
    expect(line).toHaveAttribute('d', expected?.d ?? '')
    expect(expected?.d.startsWith('M')).toBe(true)

    const curved = renderLayer(model, 'curved')
    const other = curved.container.querySelector(
      `[data-relation="${expected?.name ?? ''}"] .sm-rel-line`,
    )
    expect(other?.getAttribute('d')).not.toBe(expected?.d)
    expect(other?.getAttribute('d')).toContain('C')
  })

  it('el color es el del esquema de la tabla con la llave primaria (FR-015, RS-05)', () => {
    const model = relations()
    const { container } = renderLayer(model)

    // `pedidos` es de `ventas` (azul) y apunta a `clientes`, de `personas`
    // (morado): el color es el del destino, que es quien tiene la PK.
    expect(group(container, 'fk_pedidos_cliente_id')).toHaveStyle({ '--rel': 'var(--purple)' })
    // `pagos` apunta a `pedidos`, las dos de `ventas`.
    expect(group(container, 'fk_pagos_pedido_id')).toHaveStyle({ '--rel': 'var(--blue)' })
  })

  it('el glifo del extremo de la clave foránea sale de la cardinalidad deducida (SC-011)', () => {
    const model = relations()
    const { container, layout } = renderLayer(model)

    /** El `d` que debería llevar el glifo de la clave foránea. */
    function expectedGlyph(name: string): string {
      const relation = relationOf(model, name)
      const anchors = relationAnchors(model, layout, relation)
      if (anchors === null) throw new Error(`no hay anclas de ${name}`)
      return glyphOf(cardinalityOf(model, relation).to, { x: anchors.ax, y: anchors.ay }, anchors.oa)
    }

    // Muchos: la columna no es única y no admite nulos.
    expect(group(container, 'fk_pedidos_cliente_id').querySelector('.sm-rel-glyph')).toHaveAttribute(
      'd',
      expectedGlyph('fk_pedidos_cliente_id'),
    )
    // Cero o muchos: `metodo_id` admite nulos.
    expect(group(container, 'fk_pagos_metodo_id').querySelector('.sm-rel-glyph')).toHaveAttribute(
      'd',
      expectedGlyph('fk_pagos_metodo_id'),
    )
    // Uno: las dos columnas de `comentarios` forman un único.
    expect(cardinalityOf(model, relationOf(model, 'fk_comentarios_resena')).to).toBe('one')
    expect(
      group(container, 'fk_comentarios_resena').querySelector('.sm-rel-glyph'),
    ).toHaveAttribute('d', expectedGlyph('fk_comentarios_resena'))
  })

  it('cero o uno: un único que admite nulos (SC-011)', () => {
    const model = relations()
    const comentarios = (model.tables ?? []).find((table) => table.name === 'comentarios') as Table
    comentarios.fields = comentarios.fields.map((field) =>
      field.name === 'resena_pedido_id' ? { ...field, nullable: true } : field,
    )

    expect(cardinalityOf(model, relationOf(model, 'fk_comentarios_resena')).to).toBe('zero-or-one')

    const { container, layout } = renderLayer(model)
    const relation = relationOf(model, 'fk_comentarios_resena')
    const anchors = relationAnchors(model, layout, relation)
    expect(
      group(container, 'fk_comentarios_resena').querySelector('.sm-rel-glyph'),
    ).toHaveAttribute(
      'd',
      glyphOf('zero-or-one', { x: anchors?.ax ?? 0, y: anchors?.ay ?? 0 }, anchors?.oa ?? 1),
    )
  })

  it('no aporta nada al árbol de accesibilidad ni captura el puntero (FR-018)', () => {
    const { container } = renderLayer(relations())
    const svg = container.querySelector('svg')

    expect(svg).toHaveAttribute('aria-hidden', 'true')
    // `pointer-events: none` y `overflow: visible` los pone la hoja por esta
    // clase: `jsdom` no carga las hojas, así que lo que se afirma aquí es que
    // la capa la lleva (`src/styles/screens.css`).
    expect(svg).toHaveClass('sm-rel-layer')
    expect(container.querySelector('button')).toBeNull()
  })

  it('una relación que nombra una tabla que no está no se pinta', () => {
    const model = relations()
    model.relations = [
      ...(model.relations ?? []),
      {
        name: 'fk_fantasma',
        fromTable: 'pagos',
        fromFields: ['importe'],
        toTable: 'fantasma',
        toFields: ['id'],
      },
    ]

    const { container } = renderLayer(model)

    expect(container.querySelectorAll('.sm-rel')).toHaveLength(6)
  })
})
