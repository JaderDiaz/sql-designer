import { beforeEach, describe, expect, it } from 'vitest'

import { readFixture } from '@/lib/model/__fixtures__'
import { parseModel } from '@/lib/model/parse'
import { TABLE_WIDTH, tableHeight } from '@/lib/canvas/constants'
import { FORMAT_VERSION } from '@/lib/model/types'
import type { Engine, Model } from '@/lib/model/types'
import { useAppStore } from '@/store'
import {
  CREATE_TABLE_LABEL,
  DELETE_TABLE_LABEL,
  DUPLICATE_TABLE_LABEL,
  MOVE_TABLE_LABEL,
  RENAME_TABLE_LABEL,
  NEW_FIELD_NAME,
  SET_TABLE_SCHEMA_LABEL,
} from '@/store/tables'
import { resetStore } from '@/test/helpers'

/**
 * Pruebas de las acciones de tablas del almacén (FR-002 a FR-009).
 *
 * Dos invariantes se repiten en todas: el modelo queda «Editado» en cuanto se
 * aparta del archivo, y cada operación se deshace en un solo paso con su
 * etiqueta.
 */

/** Modelo de ejemplo con tablas en tres esquemas y un cuarto vacío. */
function threeSchemas(): Model {
  const result = parseModel(readFixture('modelo-tres-esquemas'))
  if (!result.ok) throw new Error('el ejemplo no es un modelo válido')
  return result.model
}

/** Modelo de un solo esquema vacío, para mirar el motor sin ruido. */
function oneSchema(engine: Engine): Model {
  return {
    formatVersion: FORMAT_VERSION,
    name: 'Ejemplo',
    engine,
    schemas: [{ name: 'ventas', abbreviation: 'VEN', color: 'blue' }],
  }
}

/** Deja el almacén con ese modelo ya «guardado». */
function openModel(model: Model) {
  resetStore()
  useAppStore.setState({ screen: 'editor', model, savedModel: model, isDirty: false })
}

/** La tabla con ese nombre del modelo abierto. */
function tableNamed(name: string) {
  return (useAppStore.getState().model?.tables ?? []).find((table) => table.name === name)
}

describe('createTable', () => {
  beforeEach(() => openModel(threeSchemas()))

  it('crea la tabla con el `id` y la auditoría del motor del modelo (FR-008)', () => {
    useAppStore
      .getState()
      .createTable({ name: 'recibos', schema: 'ventas', withId: true, withAudit: true })

    const recibos = tableNamed('recibos')
    expect(recibos?.schema).toBe('ventas')
    expect(recibos?.fields.map((field) => field.name)).toEqual(['id', 'created_at', 'updated_at'])
    expect(recibos?.fields[0]).toMatchObject({ type: 'uuid', default: 'gen_random_uuid()' })
    expect(recibos?.primaryKey).toEqual(['id'])
  })

  it.each([
    ['postgres', 'uuid', 'timestamptz'],
    ['mysql', 'char', 'timestamp'],
    ['sqlite', 'text', 'text'],
  ] as const)('usa los tipos de %s (FR-008, research R2)', (engine, idType, stampType) => {
    openModel(oneSchema(engine))
    useAppStore
      .getState()
      .createTable({ name: 'recibos', schema: 'ventas', withId: true, withAudit: true })

    const fields = tableNamed('recibos')?.fields ?? []
    expect(fields[0]?.type).toBe(idType)
    expect(fields[1]?.type).toBe(stampType)
  })

  it('sin ninguna opción nace con un campo de texto para empezar (FR-008)', () => {
    useAppStore
      .getState()
      .createTable({ name: 'recibos', schema: 'ventas', withId: false, withAudit: false })

    expect(tableNamed('recibos')?.fields).toEqual([{ name: NEW_FIELD_NAME, type: 'text' }])
    expect(tableNamed('recibos')?.primaryKey).toBeUndefined()
  })

  it('guarda la descripción recortada y no guarda la vacía (FR-004)', () => {
    const create = useAppStore.getState().createTable
    create({
      name: 'recibos',
      schema: 'ventas',
      comment: '  Cobros  ',
      withId: true,
      withAudit: false,
    })
    create({ name: 'notas', schema: 'ventas', comment: '   ', withId: true, withAudit: false })

    expect(tableNamed('recibos')?.comment).toBe('Cobros')
    expect(tableNamed('notas')?.comment).toBeUndefined()
  })

  it('respeta la posición pedida cuando está libre (FR-006)', () => {
    useAppStore.getState().createTable({
      name: 'recibos',
      schema: 'ventas',
      withId: true,
      withAudit: false,
      position: { x: 2000, y: 1200 },
    })

    expect(tableNamed('recibos')?.position).toEqual({ x: 2000, y: 1200 })
  })

  it('sin posición la deja en el centro visible (FR-006)', () => {
    useAppStore.setState({ pan: { x: 0, y: 0 }, zoom: 1 })
    useAppStore
      .getState()
      .createTable({ name: 'recibos', schema: 'ventas', withId: true, withAudit: false })

    const { viewport } = useAppStore.getState()
    expect(tableNamed('recibos')?.position).toEqual({
      x: viewport.x + viewport.width / 2 - TABLE_WIDTH / 2,
      y: viewport.y + viewport.height / 2 - 40,
    })
  })

  it('busca hueco libre si la posición pedida ya está ocupada (FR-038)', () => {
    const facturas = tableNamed('facturas')
    const taken = facturas?.position ?? { x: 0, y: 0 }
    useAppStore.getState().createTable({
      name: 'recibos',
      schema: 'ventas',
      withId: true,
      withAudit: true,
      position: { ...taken },
    })

    const spot = tableNamed('recibos')?.position
    expect(spot).not.toEqual(taken)
    const vertical = Math.abs((spot?.y ?? 0) - taken.y) >= tableHeight(3)
    const horizontal = Math.abs((spot?.x ?? 0) - taken.x) >= TABLE_WIDTH
    expect(vertical || horizontal).toBe(true)
  })

  it('alinea la posición a la cuadrícula si la preferencia está activa (FR-032)', () => {
    resetStore({ preferences: { snapToGrid: true } })
    const model = threeSchemas()
    useAppStore.setState({ screen: 'editor', model, savedModel: model, isDirty: false })
    useAppStore.getState().createTable({
      name: 'recibos',
      schema: 'ventas',
      withId: true,
      withAudit: false,
      position: { x: 2005, y: 1199 },
    })

    expect(tableNamed('recibos')?.position).toEqual({ x: 2016, y: 1200 })
  })

  it('selecciona la tabla, abre el panel y marca «Editado» (FR-007, FR-007a)', () => {
    useAppStore
      .getState()
      .createTable({ name: 'recibos', schema: 'ventas', withId: true, withAudit: true })

    const state = useAppStore.getState()
    expect(state.selectedTable).toBe('recibos')
    expect(state.selectedSchema).toBeNull()
    expect(state.isFieldsPanelOpen).toBe(true)
    expect(state.fieldsPanelTable).toBe('recibos')
    // Con el primer campo enfocado: así quien la crea con el teclado sigue
    // escribiendo en la rejilla (FR-044, SC-009).
    expect(state.focusedCell).toEqual({ field: 'id', column: 'name' })
    expect(state.dialog).toBeNull()
    expect(state.isDirty).toBe(true)
  })

  it('se deshace en un solo paso con su etiqueta (FR-045)', () => {
    useAppStore
      .getState()
      .createTable({ name: 'recibos', schema: 'ventas', withId: true, withAudit: true })

    expect(useAppStore.getState().past.map((step) => step.label)).toEqual([CREATE_TABLE_LABEL])
    useAppStore.getState().undo()
    expect(tableNamed('recibos')).toBeUndefined()
  })

  it('no crea nada con un nombre repetido ni con un esquema inexistente (RS-03)', () => {
    const create = useAppStore.getState().createTable
    create({ name: 'facturas', schema: 'ventas', withId: true, withAudit: true })
    create({ name: 'recibos', schema: 'fantasma', withId: true, withAudit: true })

    const state = useAppStore.getState()
    expect(tableNamed('recibos')).toBeUndefined()
    expect((state.model?.tables ?? []).filter((table) => table.name === 'facturas')).toHaveLength(1)
    expect(state.isDirty).toBe(false)
    expect(state.past).toHaveLength(0)
  })
})

describe('moveTable', () => {
  beforeEach(() => openModel(threeSchemas()))

  it('suma el desplazamiento a la posición que el archivo no traía (FR-030)', () => {
    // `facturas` no trae posición: la del lienzo es la de `resolveLayout`.
    const base = useAppStore.getState().model?.tables?.[0]?.position
    expect(base).toBeUndefined()

    useAppStore.getState().moveTable('facturas', { x: 30, y: -10 })

    const moved = tableNamed('facturas')?.position
    expect(moved).toEqual({ x: 30, y: -10 })
    expect(useAppStore.getState().past.map((step) => step.label)).toEqual([MOVE_TABLE_LABEL])
  })

  it('suma sobre la posición que ya tenía (FR-030)', () => {
    const move = useAppStore.getState().moveTable
    move('facturas', { x: 100, y: 100 })
    move('facturas', { x: -40, y: 25 })

    expect(tableNamed('facturas')?.position).toEqual({ x: 60, y: 125 })
  })

  it('ajusta a la cuadrícula cuando la preferencia está activa (FR-032)', () => {
    resetStore({ preferences: { snapToGrid: true } })
    const model = threeSchemas()
    useAppStore.setState({ screen: 'editor', model, savedModel: model, isDirty: false })

    useAppStore.getState().moveTable('facturas', { x: 29, y: 13 })

    expect(tableNamed('facturas')?.position).toEqual({ x: 24, y: 24 })
  })

  it('cambia de esquema cuando se le pasa uno, con su propia etiqueta (FR-031)', () => {
    useAppStore.getState().moveTable('facturas', { x: 400, y: 0 }, { schema: 'inventario' })

    expect(tableNamed('facturas')?.schema).toBe('inventario')
    expect(useAppStore.getState().past.map((step) => step.label)).toEqual([SET_TABLE_SCHEMA_LABEL])
  })

  it('no hace nada con desplazamiento cero y el mismo esquema (FR-030)', () => {
    useAppStore.getState().moveTable('facturas', { x: 0, y: 0 }, { schema: 'ventas' })

    expect(tableNamed('facturas')?.position).toBeUndefined()
    expect(useAppStore.getState().isDirty).toBe(false)
    expect(useAppStore.getState().past).toHaveLength(0)
  })

  it('no acepta un esquema que no existe (RS-03)', () => {
    useAppStore.getState().moveTable('facturas', { x: 30, y: 30 }, { schema: 'fantasma' })

    expect(tableNamed('facturas')?.schema).toBe('ventas')
    expect(tableNamed('facturas')?.position).toBeUndefined()
  })

  it('se deshace en un paso y devuelve la tabla a su sitio (FR-045)', () => {
    useAppStore.getState().moveTable('facturas', { x: 30, y: 30 }, { schema: 'inventario' })
    useAppStore.getState().undo()

    expect(tableNamed('facturas')?.schema).toBe('ventas')
    expect(tableNamed('facturas')?.position).toBeUndefined()
  })
})

describe('renameTable', () => {
  beforeEach(() => openModel(threeSchemas()))

  it('propaga el nombre nuevo a las relaciones de los dos extremos (FR-037)', () => {
    // `pagos_factura_fk` va de `pagos` a `facturas`.
    useAppStore.getState().renameTable('facturas', 'facturas_emitidas')

    const relation = (useAppStore.getState().model?.relations ?? []).find(
      (item) => item.name === 'pagos_factura_fk',
    )
    expect(relation?.toTable).toBe('facturas_emitidas')
    expect(tableNamed('facturas')).toBeUndefined()
    expect(useAppStore.getState().past.map((step) => step.label)).toEqual([RENAME_TABLE_LABEL])
  })

  it('reescribe el nombre en sus vistas (FR-037)', () => {
    useAppStore.getState().renameTable('facturas', 'facturas_emitidas')

    expect(useAppStore.getState().model?.views?.[0]?.tables).toContain('facturas_emitidas')
  })

  it('no renombra a un nombre ya usado ni a uno mal formado (RS-03)', () => {
    const rename = useAppStore.getState().renameTable
    rename('facturas', 'productos')
    rename('facturas', '2026_facturas')

    expect(tableNamed('facturas')).toBeDefined()
    expect(useAppStore.getState().past).toHaveLength(0)
  })

  it('se deshace en un paso, con la relación incluida (FR-045)', () => {
    useAppStore.getState().renameTable('facturas', 'facturas_emitidas')
    useAppStore.getState().undo()

    const relation = (useAppStore.getState().model?.relations ?? []).find(
      (item) => item.name === 'pagos_factura_fk',
    )
    expect(tableNamed('facturas')).toBeDefined()
    expect(relation?.toTable).toBe('facturas')
  })
})

describe('duplicateTable', () => {
  beforeEach(() => openModel(threeSchemas()))

  it('crea `<tabla>_copia` con los mismos campos y descripción (FR-038)', () => {
    useAppStore.getState().duplicateTable('facturas')

    const original = (useAppStore.getState().savedModel?.tables ?? []).find(
      (table) => table.name === 'facturas',
    )
    const copy = tableNamed('facturas_copia')
    expect(copy?.fields).toEqual(original?.fields)
    expect(copy?.comment).toBe(original?.comment)
    expect(copy?.schema).toBe('ventas')
    expect(useAppStore.getState().past.map((step) => step.label)).toEqual([DUPLICATE_TABLE_LABEL])
  })

  it('la segunda copia se llama `_copia_2` (FR-038)', () => {
    const duplicate = useAppStore.getState().duplicateTable
    duplicate('facturas')
    duplicate('facturas')

    expect(tableNamed('facturas_copia')).toBeDefined()
    expect(tableNamed('facturas_copia_2')).toBeDefined()
  })

  it('no copia las relaciones de la original (research R11)', () => {
    const before = (useAppStore.getState().model?.relations ?? []).length
    useAppStore.getState().duplicateTable('facturas')

    expect((useAppStore.getState().model?.relations ?? []).length).toBe(before)
  })

  it('deja la copia en un hueco libre, no encima de nadie (FR-038)', () => {
    useAppStore.getState().duplicateTable('facturas')

    const copy = tableNamed('facturas_copia')?.position
    const others = (useAppStore.getState().model?.tables ?? [])
      .filter((table) => table.name !== 'facturas_copia')
      .map((table) => table.position)
    expect(copy).toBeDefined()
    expect(others).not.toContainEqual(copy)
  })

  it('selecciona la copia y avisa de cómo se llamó (FR-038)', () => {
    useAppStore.getState().duplicateTable('facturas')

    const state = useAppStore.getState()
    expect(state.selectedTable).toBe('facturas_copia')
    expect(state.notice).toBe('Duplicada como `facturas_copia`')
  })
})

describe('deleteTable', () => {
  beforeEach(() => openModel(threeSchemas()))

  it('se lleva la tabla y las relaciones que la tocaban (FR-039)', () => {
    useAppStore.getState().deleteTable('facturas')

    expect(tableNamed('facturas')).toBeUndefined()
    expect(
      (useAppStore.getState().model?.relations ?? []).some(
        (relation) => relation.name === 'pagos_factura_fk',
      ),
    ).toBe(false)
    expect(useAppStore.getState().past.map((step) => step.label)).toEqual([DELETE_TABLE_LABEL])
  })

  it('cierra el panel y suelta la selección de esa tabla (FR-040)', () => {
    useAppStore.getState().openFieldsPanel('facturas')
    useAppStore.getState().deleteTable('facturas')

    const state = useAppStore.getState()
    expect(state.isFieldsPanelOpen).toBe(false)
    expect(state.fieldsPanelTable).toBeNull()
    expect(state.selectedTable).toBeNull()
  })

  it('deja el panel abierto si la tabla era otra (FR-040)', () => {
    useAppStore.getState().openFieldsPanel('productos')
    useAppStore.getState().deleteTable('facturas')

    expect(useAppStore.getState().isFieldsPanelOpen).toBe(true)
    expect(useAppStore.getState().fieldsPanelTable).toBe('productos')
  })

  it('se deshace entero, con sus relaciones (FR-045)', () => {
    useAppStore.getState().deleteTable('facturas')
    useAppStore.getState().undo()

    expect(tableNamed('facturas')).toBeDefined()
    expect(
      (useAppStore.getState().model?.relations ?? []).some(
        (relation) => relation.name === 'pagos_factura_fk',
      ),
    ).toBe(true)
  })
})
