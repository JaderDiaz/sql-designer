import { describe, expect, it } from 'vitest'

import { TABLE_WIDTH, tableHeight } from '@/lib/canvas/constants'
import {
  assignDetours,
  assignLanes,
  glyphOf,
  pathOf,
  relationAnchors,
  relationLayer,
  tableBoxes,
  touchedRelations,
} from '@/lib/canvas/relations'
import type { RelationAnchors, RelationRoute } from '@/lib/canvas/relations'
import { readFixture } from '@/lib/model/__fixtures__'
import { parseModel } from '@/lib/model/parse'
import { resolveLayout } from '@/lib/canvas/layout'
import type { Model, Position, Relation, Table } from '@/lib/model/types'

/**
 * Geometría de las líneas de relación (contracts/relations.md §1.1 y §1.3).
 *
 * Se prueba sin DOM a propósito: `jsdom` no implementa el layout de SVG, así
 * que de una línea solo se puede afirmar lo que la función pura devuelve —su
 * atributo `d`— y no dónde se ve (research R1).
 */

/** Tabla de prueba con los campos que se le pasen. */
function tableWith(name: string, fields: string[], extra: Partial<Table> = {}): Table {
  return {
    name,
    schema: 'ventas',
    fields: fields.map((field) => ({ name: field, type: 'integer' })),
    primaryKey: [fields[0] as string],
    ...extra,
  }
}

/** Modelo de prueba con las tablas y relaciones que se le pasen. */
function modelWith(tables: Table[], relations: Relation[] = []): Model {
  return {
    formatVersion: 1,
    name: 'Prueba',
    engine: 'postgres',
    schemas: [
      { name: 'ventas', abbreviation: 'VEN', color: 'blue' },
      { name: 'personas', abbreviation: 'PER', color: 'purple' },
    ],
    tables,
    relations,
  }
}

/** Relación de un campo. */
function relationWith(
  name: string,
  fromTable: string,
  fromField: string,
  toTable: string,
  toField: string,
): Relation {
  return { name, fromTable, fromFields: [fromField], toTable, toFields: [toField] }
}

/** Anclas de la única relación de un modelo, o un fallo de la prueba. */
function anchorsOf(model: Model, layout: Map<string, Position>, index = 0): RelationAnchors {
  const relation = (model.relations ?? [])[index] as Relation
  const anchors = relationAnchors(model, layout, relation)
  expect(anchors).not.toBeNull()
  return anchors as RelationAnchors
}

describe('relationAnchors (FR-013)', () => {
  const model = modelWith(
    [
      tableWith('pedidos', ['id', 'cliente_id', 'total', 'nota']),
      tableWith('clientes', ['id', 'nombre']),
    ],
    [relationWith('fk_pedidos_nota', 'pedidos', 'nota', 'clientes', 'id')],
  )

  it('el ejemplo fijado del contrato', () => {
    // Origen en {0, 0} con cuatro campos, clave foránea en el cuarto (índice
    // 3); destino en {320, 0}, llave primaria en el primero.
    const layout = new Map<string, Position>([
      ['pedidos', { x: 0, y: 0 }],
      ['clientes', { x: 320, y: 0 }],
    ])

    expect(anchorsOf(model, layout)).toMatchObject({
      ax: 200,
      ay: 126,
      bx: 320,
      by: 54,
      oa: 1,
      ob: -1,
      kind: 'h',
    })
  })

  it('con el destino a la izquierda, la línea sale por la izquierda', () => {
    const layout = new Map<string, Position>([
      ['pedidos', { x: 320, y: 0 }],
      ['clientes', { x: 0, y: 0 }],
    ])

    expect(anchorsOf(model, layout)).toMatchObject({ ax: 320, bx: 200, oa: -1, ob: 1, kind: 'h' })
  })

  it('con las tarjetas solapadas, las dos puntas salen por la derecha', () => {
    const layout = new Map<string, Position>([
      ['pedidos', { x: 0, y: 0 }],
      ['clientes', { x: 120, y: 400 }],
    ])

    expect(anchorsOf(model, layout)).toMatchObject({ ax: 200, bx: 320, oa: 1, ob: 1, kind: 'loop' })
  })

  it('una relación de una tabla hacia sí misma es un bucle (FR-013a)', () => {
    const loop = modelWith(
      [tableWith('clientes', ['id', 'nombre', 'recomendado_por'])],
      [relationWith('fk_clientes_recomendado', 'clientes', 'recomendado_por', 'clientes', 'id')],
    )
    const layout = new Map<string, Position>([['clientes', { x: 0, y: 0 }]])

    expect(anchorsOf(loop, layout)).toMatchObject({
      ax: 200,
      ay: 102,
      bx: 200,
      by: 54,
      oa: 1,
      ob: 1,
      kind: 'self',
    })
  })

  it('el canal de un salto largo se acerca al destino', () => {
    const layout = new Map<string, Position>([
      ['pedidos', { x: 0, y: 0 }],
      ['clientes', { x: 900, y: 0 }],
    ])

    // 900 − 200 = 700 de salto: el canal queda a 30 px del destino y no en
    // mitad del lienzo.
    expect(anchorsOf(model, layout).base).toBe(870)
  })

  it('una relación que nombra una tabla que no está no da anclas', () => {
    const layout = new Map<string, Position>([['pedidos', { x: 0, y: 0 }]])

    expect(
      relationAnchors(model, layout, relationWith('fk', 'pedidos', 'nota', 'fantasma', 'id')),
    ).toBeNull()
  })
})

describe('assignLanes (FR-016)', () => {
  /** Dos tablas por relación, todas en el mismo canal de `x = 260`. */
  function sameChannel(pairs: Array<[number, number]>): {
    model: Model
    layout: Map<string, Position>
  } {
    const tables: Table[] = []
    const relations: Relation[] = []
    const layout = new Map<string, Position>()

    pairs.forEach(([ay, by], index) => {
      const from = `origen_${index}`
      const to = `destino_${index}`
      tables.push(tableWith(from, ['id', 'ajeno_id']), tableWith(to, ['id']))
      // El campo de la clave foránea es el segundo, así que su fila cae 24 px
      // más abajo que la llave primaria del destino.
      relations.push(relationWith(`fk_${index}`, from, 'ajeno_id', to, 'id'))
      layout.set(from, { x: 0, y: ay - 78 })
      layout.set(to, { x: 320, y: by - 54 })
    })

    return { model: modelWith(tables, relations), layout }
  }

  /** Las anclas de todas las relaciones de un modelo. */
  function allAnchors(model: Model, layout: Map<string, Position>): RelationAnchors[] {
    return (model.relations ?? []).map((relation) => anchorsOf(model, layout, 0 + (model.relations ?? []).indexOf(relation)))
  }

  /** Cruces entre el tramo vertical de una línea y los horizontales de otra. */
  function crossings(anchors: RelationAnchors[], lanes: number[]): number {
    let total = 0
    anchors.forEach((a, i) => {
      anchors.forEach((b, j) => {
        if (i === j) return
        const vertical = lanes[j] as number
        const top = Math.min(b.ay, b.by)
        const bottom = Math.max(b.ay, b.by)
        const lane = lanes[i] as number
        for (const [x0, x1, y] of [
          [a.ax, lane, a.ay],
          [lane, a.bx, a.by],
        ] as Array<[number, number, number]>) {
          const left = Math.min(x0, x1)
          const right = Math.max(x0, x1)
          if (vertical > left && vertical < right && y > top && y < bottom) total += 1
        }
      })
    })
    return total
  }

  it('dos líneas del mismo canal se reparten en 253 y 267', () => {
    const { model, layout } = sameChannel([
      [54, 54],
      [154, 154],
    ])
    const anchors = allAnchors(model, layout)

    expect(anchors.map((anchor) => anchor.base)).toEqual([260, 260])
    expect(assignLanes(anchors).slice().sort((a, b) => a - b)).toEqual([253, 267])
  })

  it('un grupo de cuatro permuta hasta dejar cero cruces', () => {
    const { model, layout } = sameChannel([
      [54, 254],
      [154, 54],
      [454, 654],
      [554, 454],
    ])
    const anchors = allAnchors(model, layout)
    const lanes = assignLanes(anchors)

    // El orden natural —de arriba abajo— deja dos cruces; alguna de las 24
    // permutaciones los quita, y es la que gana (research R2).
    const natural = [239, 253, 267, 281]
    expect(crossings(anchors, natural)).toBe(2)
    expect(crossings(anchors, lanes)).toBe(0)
    expect(lanes).not.toEqual(natural)
  })

  it('el carril de una línea que cruza el hueco no se sale del hueco', () => {
    const { model, layout } = sameChannel([
      [54, 54],
      [78, 78],
      [102, 102],
      [126, 126],
      [150, 150],
    ])
    const anchors = allAnchors(model, layout)

    for (const lane of assignLanes(anchors)) {
      expect(lane).toBeGreaterThanOrEqual(212)
      expect(lane).toBeLessThanOrEqual(308)
    }
  })

  it('un grupo de más de cinco se reparte sin permutar', () => {
    const { model, layout } = sameChannel(
      Array.from({ length: 6 }, (_, index) => [54 + index * 24, 54 + index * 24] as [number, number]),
    )
    const anchors = allAnchors(model, layout)
    const lanes = assignLanes(anchors)

    // Seis líneas: el reparto sigue el orden del extremo superior, de arriba
    // abajo, sin probar las 720 permutaciones.
    expect(lanes).toEqual([...lanes].sort((a, b) => a - b))
  })
})

describe('pathOf (FR-017, FR-013a)', () => {
  const anchors: RelationAnchors = {
    ax: 200,
    ay: 126,
    bx: 320,
    by: 54,
    oa: 1,
    ob: -1,
    kind: 'h',
    base: 260,
  }

  it('el ejemplo fijado del contrato, en ortogonal', () => {
    expect(pathOf(anchors, 260, 'orthogonal')).toBe('M200 126 H260 V54 H320')
  })

  it('en curvas saca los tiradores en horizontal', () => {
    expect(pathOf(anchors, 260, 'curved')).toBe('M200 126 C260 126, 260 54, 320 54')
  })

  it('en rectas deja 16 px de salida recta en cada extremo', () => {
    expect(pathOf(anchors, 260, 'straight')).toBe('M200 126 L216 126 L304 54 L320 54')
  })

  it('los tres trazados dibujan el bucle', () => {
    const loop: RelationAnchors = {
      ax: 200,
      ay: 102,
      bx: 200,
      by: 54,
      oa: 1,
      ob: 1,
      kind: 'self',
      base: 226,
    }

    for (const route of ['orthogonal', 'curved', 'straight'] as RelationRoute[]) {
      const d = pathOf(loop, 226, route)
      expect(d.startsWith('M200 102')).toBe(true)
      // Cada trazado termina a su manera, pero los tres vuelven al mismo
      // punto: `H200` el ortogonal, `200 54` el curvo y el recto.
      expect(/(H200|L200 54|, 200 54)$/.test(d)).toBe(true)
      // El bucle sale por la derecha y vuelve: ningún número del trazado se va
      // a la izquierda de la tarjeta.
      for (const value of d.match(/-?\d+(\.\d+)?/g) ?? []) {
        expect(Number(value)).toBeGreaterThanOrEqual(0)
      }
    }
  })

  it('ningún trazado pasa por dentro del rectángulo de una tarjeta', () => {
    const model = modelWith(
      [
        tableWith('pedidos', ['id', 'cliente_id']),
        tableWith('clientes', ['id', 'nombre', 'correo']),
      ],
      [relationWith('fk_pedidos_cliente_id', 'pedidos', 'cliente_id', 'clientes', 'id')],
    )
    const layout = new Map<string, Position>([
      ['pedidos', { x: 0, y: 0 }],
      ['clientes', { x: 320, y: 48 }],
    ])
    const cards = (model.tables ?? []).map((table) => {
      const position = layout.get(table.name) as Position
      return {
        left: position.x,
        right: position.x + TABLE_WIDTH,
        top: position.y,
        bottom: position.y + tableHeight(table.fields.length),
      }
    })

    for (const route of ['orthogonal', 'curved', 'straight'] as RelationRoute[]) {
      const [line] = relationLayer(model, layout, route)
      const numbers = (line?.d.match(/-?\d+(\.\d+)?/g) ?? []).map(Number)
      // Se miran los vértices del trazado: con los extremos justo en el borde
      // de la tarjeta, ninguno cae dentro del rectángulo de ninguna.
      for (let index = 0; index + 1 < numbers.length; index += 2) {
        const x = numbers[index] as number
        const y = numbers[index + 1] as number
        for (const card of cards) {
          const inside = x > card.left && x < card.right && y > card.top && y < card.bottom
          expect(inside, `${route} en ${x},${y}`).toBe(false)
        }
      }
    }
  })
})

describe('glyphOf (FR-014)', () => {
  const point = { x: 200, y: 100 }

  it('«uno» son dos barras', () => {
    expect(glyphOf('one', point, 1)).toBe('M206 95 V105 M210 95 V105')
  })

  it('«muchos» es la pata de gallo con su barra', () => {
    expect(glyphOf('many', point, 1)).toBe(
      'M212 100 L200 94 M212 100 L200 106 M215 95 V105',
    )
  })

  it('«cero o muchos» cambia la barra por el círculo del cero', () => {
    const d = glyphOf('zero-or-many', point, 1)

    expect(d).toContain('M212 100 L200 94')
    expect(d).toContain('a3.5 3.5 0 1 0 7 0')
  })

  it('«cero o uno» es una barra con el círculo', () => {
    const d = glyphOf('zero-or-one', point, 1)

    expect(d).toContain('M206 95 V105')
    expect(d).toContain('a3.5 3.5 0 1 0 7 0')
    expect(d).not.toContain('L200 94')
  })

  it('el glifo crece hacia el lado por el que sale la línea', () => {
    expect(glyphOf('one', point, -1)).toBe('M194 95 V105 M190 95 V105')
  })
})

describe('relationLayer (FR-015)', () => {
  const model = modelWith(
    [
      tableWith('pedidos', ['id', 'cliente_id']),
      tableWith('clientes', ['id', 'nombre'], { schema: 'personas' }),
    ],
    [relationWith('fk_pedidos_cliente_id', 'pedidos', 'cliente_id', 'clientes', 'id')],
  )
  const layout = new Map<string, Position>([
    ['pedidos', { x: 0, y: 0 }],
    ['clientes', { x: 320, y: 0 }],
  ])

  it('el color es el del esquema de la tabla con la llave primaria', () => {
    expect(relationLayer(model, layout, 'orthogonal')).toEqual([
      {
        name: 'fk_pedidos_cliente_id',
        d: 'M200 78 H260 V54 H320',
        lane: 260,
        detour: null,
        glyphA: glyphOf('many', { x: 200, y: 78 }, 1),
        glyphB: glyphOf('one', { x: 320, y: 54 }, -1),
        color: 'purple',
        from: 'pedidos',
        to: 'clientes',
      },
    ])
  })

  it('el extremo de la clave foránea lleva el glifo de la cardinalidad deducida', () => {
    const nullable = modelWith(
      [
        tableWith('pedidos', ['id', 'cliente_id'], {
          fields: [
            { name: 'id', type: 'integer' },
            { name: 'cliente_id', type: 'integer', nullable: true },
          ],
        }),
        tableWith('clientes', ['id', 'nombre'], { schema: 'personas' }),
      ],
      [relationWith('fk_pedidos_cliente_id', 'pedidos', 'cliente_id', 'clientes', 'id')],
    )

    expect(relationLayer(nullable, layout, 'orthogonal')[0]?.glyphA).toBe(
      glyphOf('zero-or-many', { x: 200, y: 78 }, 1),
    )
  })

  it('una relación que nombra una tabla que no está se queda fuera', () => {
    const roto = modelWith(
      [tableWith('pedidos', ['id', 'cliente_id'])],
      [relationWith('fk', 'pedidos', 'cliente_id', 'fantasma', 'id')],
    )

    expect(relationLayer(roto, layout, 'orthogonal')).toEqual([])
  })
})

describe('touchedRelations (research R6)', () => {
  const model = modelWith(
    [
      tableWith('pedidos', ['id', 'cliente_id']),
      tableWith('pagos', ['id', 'pedido_id']),
      tableWith('clientes', ['id'], { schema: 'personas' }),
    ],
    [
      relationWith('fk_pedidos_cliente_id', 'pedidos', 'cliente_id', 'clientes', 'id'),
      relationWith('fk_pagos_pedido_id', 'pagos', 'pedido_id', 'pedidos', 'id'),
    ],
  )

  it('al arrastrar una tabla se repintan sus dos lados', () => {
    expect(touchedRelations(model, { kind: 'table', name: 'pedidos' })).toEqual([
      'fk_pedidos_cliente_id',
      'fk_pagos_pedido_id',
    ])
  })

  it('al arrastrar una zona se repintan las de todas sus tablas', () => {
    expect(touchedRelations(model, { kind: 'schema', name: 'personas' })).toEqual([
      'fk_pedidos_cliente_id',
    ])
  })

  it('lo que no toca nada no repinta nada', () => {
    expect(touchedRelations(model, { kind: 'table', name: 'fantasma' })).toEqual([])
  })
})

describe('los carriles a escala (T004, SC-005)', () => {
  it('el modelo de 50 tablas tiene 60 relaciones y al menos cuatro en un canal', () => {
    const result = parseModel(readFixture('modelo-50-tablas'))
    expect(result.ok).toBe(true)
    if (!result.ok) return

    const model = result.model
    const layout = resolveLayout(model)
    const anchors = (model.relations ?? [])
      .map((relation) => relationAnchors(model, layout, relation))
      .filter((anchor): anchor is RelationAnchors => anchor !== null)

    expect(model.relations ?? []).toHaveLength(60)
    expect(anchors).toHaveLength(60)

    const channels = new Map<number, number>()
    for (const anchor of anchors) {
      const key = Math.round(anchor.base / 60)
      channels.set(key, (channels.get(key) ?? 0) + 1)
    }
    expect(Math.max(...channels.values())).toBeGreaterThanOrEqual(4)

    // Y el reparto da un carril a cada una, sin dos líneas en el mismo sitio
    // dentro de un canal.
    const lanes = assignLanes(anchors)
    expect(lanes).toHaveLength(60)
    const byChannel = new Map<number, number[]>()
    anchors.forEach((anchor, index) => {
      const key = Math.round(anchor.base / 60)
      byChannel.set(key, [...(byChannel.get(key) ?? []), lanes[index] as number])
    })
    for (const group of byChannel.values()) {
      if (group.length > 1 && new Set(group).size === 1) {
        // Dos líneas del mismo canal con el mismo carril solo pasa cuando el
        // hueco es tan estrecho que no cabe el reparto; el modelo de carga no
        // tiene ese caso.
        expect(group.length).toBe(1)
      }
    }
  })

  it('ninguna línea ortogonal atraviesa una tarjeta, ni con cincuenta (FR-016, SC-005)', () => {
    for (const nombre of ['modelo-50-tablas', 'modelo-relaciones'] as const) {
      const result = parseModel(readFixture(nombre))
      expect(result.ok).toBe(true)
      if (!result.ok) return

      const model = result.model
      const layout = resolveLayout(model)
      const boxes = tableBoxes(model, layout)
      const lines = relationLayer(model, layout, 'orthogonal')

      const crossings = lines.flatMap((line) =>
        cardsUnder(line.d, boxes).map((hit) => `${nombre}: ${line.name} en ${hit}`),
      )
      expect(crossings).toEqual([])
    }
  })

  it('las veinte líneas que saltan una columna llevan rodeo y las demás no', () => {
    const result = parseModel(readFixture('modelo-50-tablas'))
    expect(result.ok).toBe(true)
    if (!result.ok) return

    const layout = resolveLayout(result.model)
    const lines = relationLayer(result.model, layout, 'orthogonal')
    const rerouted = lines.filter((line) => line.detour !== null)

    expect(rerouted).toHaveLength(20)
    // Los otros dos trazados no tienen tramos que apartar.
    expect(relationLayer(result.model, layout, 'curved').every((line) => line.detour === null)).toBe(
      true,
    )
  })
})

/** Un tramo recto de un trazo ortogonal. */
interface Stretch {
  x0: number
  y0: number
  x1: number
  y1: number
}

/**
 * Los tramos de un trazo ortogonal, leyendo su atributo `d`.
 *
 * Solo entiende `M`, `H` y `V`, que es todo lo que escribe ese trazado.
 */
function stretchesOf(d: string): Stretch[] {
  const stretches: Stretch[] = []
  let x = 0
  let y = 0
  for (const [, command, values] of d.matchAll(/([MHV])([^MHV]*)/g)) {
    const numbers = (values as string).trim().split(/[ ,]+/).map(Number)
    if (command === 'M') {
      x = numbers[0] as number
      y = numbers[1] as number
      continue
    }
    const x1 = command === 'H' ? (numbers[0] as number) : x
    const y1 = command === 'V' ? (numbers[0] as number) : y
    stretches.push({ x0: x, y0: y, x1, y1 })
    x = x1
    y = y1
  }
  return stretches
}

/**
 * Tarjetas por las que pasa un trazo ortogonal: muestrea cada tramo cada 4 px
 * con 3 px de holgura en el borde de la tarjeta.
 */
function cardsUnder(
  d: string,
  boxes: ReadonlyArray<{ left: number; right: number; top: number; bottom: number }>,
): string[] {
  const hits = new Set<string>()
  for (const { x0, y0, x1, y1 } of stretchesOf(d)) {
    const steps = Math.max(1, Math.round(Math.hypot(x1 - x0, y1 - y0) / 4))
    for (let step = 0; step <= steps; step += 1) {
      const px = x0 + ((x1 - x0) * step) / steps
      const py = y0 + ((y1 - y0) * step) / steps
      const hit = boxes.find(
        (box) => px > box.left + 3 && px < box.right - 3 && py > box.top + 3 && py < box.bottom - 3,
      )
      if (hit !== undefined) hits.add(`${hit.left},${hit.top}`)
    }
  }
  return [...hits]
}

/**
 * Dice si dos trazos ortogonales comparten algún trecho, uno encima del otro.
 *
 * El último tramo no cuenta: dos claves que apuntan al mismo campo entran a la
 * tarjeta por el mismo sitio, y eso no lo decide el rodeo.
 */
function shareStretch(first: string, second: string): boolean {
  return stretchesOf(first).slice(0, -1).some((a) =>
    stretchesOf(second).slice(0, -1).some((b) => {
      const bothVertical = a.x0 === a.x1 && b.x0 === b.x1 && Math.abs(a.x0 - b.x0) < 4
      const bothHorizontal = a.y0 === a.y1 && b.y0 === b.y1 && Math.abs(a.y0 - b.y0) < 4
      if (bothVertical) {
        return Math.min(a.y0, a.y1) < Math.max(b.y0, b.y1) - 1 && Math.max(a.y0, a.y1) > Math.min(b.y0, b.y1) + 1
      }
      if (bothHorizontal) {
        return Math.min(a.x0, a.x1) < Math.max(b.x0, b.x1) - 1 && Math.max(a.x0, a.x1) > Math.min(b.x0, b.x1) + 1
      }
      return false
    }),
  )
}

describe('assignDetours (FR-016, SC-005, T082)', () => {
  /** Tres tarjetas en fila: la de en medio estorba entre las de los extremos. */
  const tables = [
    tableWith('origen', ['id', 'destino_id']),
    tableWith('medio', ['id', 'nota']),
    tableWith('destino', ['id']),
  ]
  const model = modelWith(tables, [relationWith('fk', 'origen', 'destino_id', 'destino', 'id')])
  const layout = new Map<string, Position>([
    ['origen', { x: 0, y: 0 }],
    ['medio', { x: 240, y: 0 }],
    ['destino', { x: 480, y: 0 }],
  ])
  const boxes = tableBoxes(model, layout)

  it('una línea que pasa limpia conserva su carril y no lleva rodeo', () => {
    const near = modelWith(tables, [relationWith('fk', 'origen', 'destino_id', 'medio', 'id')])
    const anchors = [anchorsOf(near, layout)]
    const lanes = assignLanes(anchors, boxes)

    expect(assignDetours(anchors, lanes, boxes)).toEqual([{ lane: lanes[0], detour: null }])
  })

  it('sin cajas no se rodea nada', () => {
    const anchors = [anchorsOf(model, layout)]
    expect(assignDetours(anchors, [450], [])).toEqual([{ lane: 450, detour: null }])
  })

  it('la tarjeta de en medio se rodea por un pasillo libre', () => {
    const anchors = anchorsOf(model, layout)
    const lanes = assignLanes([anchors], boxes)
    const [routing] = assignDetours([anchors], lanes, boxes)

    expect(routing?.detour).not.toBeNull()
    const d = pathOf(anchors, routing?.lane as number, 'orthogonal', routing?.detour)
    expect(cardsUnder(d, boxes)).toEqual([])
    // Sale hacia la derecha de la tarjeta de origen y deja sitio al glifo.
    expect(routing?.detour?.exit).toBeGreaterThanOrEqual(10)
    // Y cruza por encima o por debajo de la tarjeta de en medio, con su aire.
    const corridor = routing?.detour?.corridor as number
    const middle = boxes[1] as { top: number; bottom: number }
    expect(corridor <= middle.top - 10 || corridor >= middle.bottom + 10).toBe(true)
  })

  it('dos rodeos por el mismo hueco no se pisan', () => {
    const twin = modelWith(
      [
        tableWith('origen', ['id', 'destino_id', 'otro_id']),
        tableWith('medio', ['id', 'nota', 'alta', 'baja']),
        tableWith('destino', ['id']),
      ],
      [
        relationWith('fk_a', 'origen', 'destino_id', 'destino', 'id'),
        relationWith('fk_b', 'origen', 'otro_id', 'destino', 'id'),
      ],
    )
    const twinBoxes = tableBoxes(twin, layout)
    const anchors = [anchorsOf(twin, layout, 0), anchorsOf(twin, layout, 1)]
    const routings = assignDetours(anchors, assignLanes(anchors, twinBoxes), twinBoxes)

    expect(routings.every((routing) => routing.detour !== null)).toBe(true)
    const [first, second] = routings.map((routing, index) =>
      pathOf(anchors[index] as RelationAnchors, routing.lane, 'orthogonal', routing.detour),
    )
    expect(cardsUnder(first as string, twinBoxes)).toEqual([])
    expect(cardsUnder(second as string, twinBoxes)).toEqual([])
    expect(shareStretch(first as string, second as string)).toBe(false)
  })

  it('una línea encajonada sin pasillo se queda con sus tres tramos', () => {
    // Las tarjetas se tocan: no hay hueco por el que salir.
    const tight = new Map<string, Position>([
      ['origen', { x: 0, y: 0 }],
      ['medio', { x: 200, y: 0 }],
      ['destino', { x: 448, y: 0 }],
    ])
    const tightBoxes = tableBoxes(model, tight)
    const anchors = [anchorsOf(model, tight)]
    const lanes = assignLanes(anchors, tightBoxes)

    expect(assignDetours(anchors, lanes, tightBoxes)).toEqual([{ lane: lanes[0], detour: null }])
  })
})

describe('pathOf con rodeo (T082)', () => {
  const anchors: RelationAnchors = {
    ax: 200,
    ay: 78,
    bx: 480,
    by: 54,
    oa: 1,
    ob: -1,
    kind: 'h',
    base: 450,
  }
  const detour = { exit: 22, corridor: 196 }

  it('el ortogonal dibuja los cinco tramos', () => {
    expect(pathOf(anchors, 458, 'orthogonal', detour)).toBe('M200 78 H222 V196 H458 V54 H480')
  })

  it('el curvo y el recto no lo usan', () => {
    for (const route of ['curved', 'straight'] as const) {
      expect(pathOf(anchors, 458, route, detour)).toBe(pathOf(anchors, 458, route))
    }
  })
})
