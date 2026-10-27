import { beforeEach, describe, expect, it } from 'vitest'

import { readFixture } from '@/lib/model/__fixtures__'
import { parseModel } from '@/lib/model/parse'
import { serializeModel } from '@/lib/model/serialize'
import type { Model } from '@/lib/model/types'
import { useAppStore } from '@/store'
import {
  CREATE_SCHEMA_LABEL,
  DELETE_SCHEMA_LABEL,
  MOVE_SCHEMA_LABEL,
  MOVE_SCHEMA_TABLES_LABEL,
  UPDATE_SCHEMA_LABEL,
} from '@/store/schemas'
import { resetStore } from '@/test/helpers'

/**
 * Pruebas de crear, editar y eliminar esquemas (FR-015, FR-020, FR-022,
 * SC-006).
 *
 * Todo gira alrededor de dos invariantes: el modelo queda «Editado» en cuanto
 * se aparta del archivo, y cada operación se deshace en un solo paso con su
 * etiqueta.
 */

/** Modelo de ejemplo con tablas en tres esquemas y un cuarto vacío. */
function threeSchemas(): Model {
  const result = parseModel(readFixture('modelo-tres-esquemas'))
  if (!result.ok) throw new Error('el ejemplo no es un modelo válido')
  return result.model
}

/** Deja el almacén con ese modelo ya «guardado». */
function openModel(model: Model) {
  resetStore()
  useAppStore.setState({ screen: 'editor', model, savedModel: model, isDirty: false })
}

describe('createSchema', () => {
  beforeEach(() => openModel(threeSchemas()))

  it('añade el esquema al final y deja el modelo «Editado» (FR-015, FR-022)', () => {
    useAppStore.getState().createSchema({
      name: 'contabilidad',
      abbreviation: 'CON',
      color: 'teal',
      comment: 'Cuentas y asientos',
    })

    const { model, isDirty, past } = useAppStore.getState()
    expect(model?.schemas).toHaveLength(5)
    expect(model?.schemas.at(-1)).toEqual({
      name: 'contabilidad',
      abbreviation: 'CON',
      color: 'teal',
      comment: 'Cuentas y asientos',
    })
    expect(isDirty).toBe(true)
    expect(past.at(-1)?.label).toBe(CREATE_SCHEMA_LABEL)
  })

  it('omite la descripción vacía en lugar de escribirla en blanco', () => {
    useAppStore.getState().createSchema({
      name: 'contabilidad',
      abbreviation: 'CON',
      color: 'teal',
      comment: '   ',
    })

    expect(useAppStore.getState().model?.schemas.at(-1)).not.toHaveProperty('comment')
  })

  it('deshacer lo quita en un paso y el modelo vuelve a «Guardado» (SC-006)', () => {
    useAppStore.getState().createSchema({ name: 'contabilidad', abbreviation: 'CON', color: 'teal' })

    useAppStore.getState().undo()

    const { model, isDirty, notice } = useAppStore.getState()
    expect(model?.schemas).toHaveLength(4)
    expect(isDirty).toBe(false)
    expect(notice).toBe(`Deshecho: ${CREATE_SCHEMA_LABEL}`)
  })

  it('rehacer lo devuelve y lo dice (FR-022)', () => {
    useAppStore.getState().createSchema({ name: 'contabilidad', abbreviation: 'CON', color: 'teal' })
    useAppStore.getState().undo()

    useAppStore.getState().redo()

    expect(useAppStore.getState().model?.schemas).toHaveLength(5)
    expect(useAppStore.getState().notice).toBe(`Rehecho: ${CREATE_SCHEMA_LABEL}`)
  })

  it('no escribe nada con el nombre técnico o la abreviatura repetidos (FR-018)', () => {
    useAppStore.getState().createSchema({ name: 'ventas', abbreviation: 'XXX', color: 'teal' })
    useAppStore.getState().createSchema({ name: 'otra_cosa', abbreviation: 'VEN', color: 'teal' })

    expect(useAppStore.getState().model?.schemas).toHaveLength(4)
    expect(useAppStore.getState().isDirty).toBe(false)
  })

  it('deja seleccionado el esquema nuevo, para que el inspector lo muestre', () => {
    useAppStore.getState().createSchema({ name: 'contabilidad', abbreviation: 'CON', color: 'teal' })

    expect(useAppStore.getState().selectedSchema).toBe('contabilidad')
  })
})

describe('updateSchema', () => {
  beforeEach(() => openModel(threeSchemas()))

  it('cambia los campos y deja su paso de historial (FR-020, FR-022)', () => {
    useAppStore.getState().updateSchema('inventario', {
      name: 'inventario',
      abbreviation: 'STK',
      color: 'pink',
      comment: 'Existencias',
    })

    const { model, past } = useAppStore.getState()
    const schema = model?.schemas.find((candidate) => candidate.name === 'inventario')
    expect(schema).toEqual({
      name: 'inventario',
      abbreviation: 'STK',
      color: 'pink',
      comment: 'Existencias',
    })
    expect(past.at(-1)?.label).toBe(UPDATE_SCHEMA_LABEL)
  })

  it('propaga el nombre técnico nuevo a sus tablas, enums y vistas (FR-020)', () => {
    useAppStore.getState().updateSchema('ventas', {
      name: 'facturacion',
      abbreviation: 'VEN',
      color: 'blue',
    })

    const model = useAppStore.getState().model
    expect(model?.schemas.map((schema) => schema.name)).toContain('facturacion')
    expect(model?.tables?.filter((table) => table.schema === 'facturacion')).toHaveLength(2)
    expect(model?.enums?.[0]?.schema).toBe('facturacion')
    expect(model?.views?.[0]?.schema).toBe('facturacion')
    expect(model?.tables?.some((table) => table.schema === 'ventas')).toBe(false)
  })

  it('el foco y la selección siguen al esquema renombrado', () => {
    useAppStore.setState({ focusedSchema: 'ventas', selectedSchema: 'ventas' })

    useAppStore.getState().updateSchema('ventas', {
      name: 'facturacion',
      abbreviation: 'VEN',
      color: 'blue',
    })

    expect(useAppStore.getState().focusedSchema).toBe('facturacion')
    expect(useAppStore.getState().selectedSchema).toBe('facturacion')
  })

  it('no escribe nada si el nombre técnico nuevo ya lo usa otro (FR-018)', () => {
    useAppStore.getState().updateSchema('inventario', {
      name: 'ventas',
      abbreviation: 'INV',
      color: 'green',
    })

    expect(useAppStore.getState().isDirty).toBe(false)
    expect(useAppStore.getState().model?.schemas.map((schema) => schema.name)).toEqual([
      'ventas',
      'inventario',
      'personas',
      'reportes',
    ])
  })

  it('deshacer devuelve el esquema y sus referencias en un paso (SC-006)', () => {
    const before = useAppStore.getState().model

    useAppStore.getState().updateSchema('ventas', {
      name: 'facturacion',
      abbreviation: 'FAC',
      color: 'red',
    })
    useAppStore.getState().undo()

    expect(useAppStore.getState().model).toEqual(before)
    expect(useAppStore.getState().isDirty).toBe(false)
  })
})

describe('deleteSchema', () => {
  beforeEach(() => openModel(threeSchemas()))

  it('con el interruptor encendido se lleva sus tablas y sus relaciones (FR-036)', () => {
    useAppStore.getState().deleteSchema('ventas', { withTables: true, target: null })

    const model = useAppStore.getState().model
    expect(model?.schemas.map((schema) => schema.name)).toEqual([
      'inventario',
      'personas',
      'reportes',
    ])
    expect(model?.tables?.map((table) => table.name)).toEqual(['productos', 'clientes'])
    expect(model?.relations ?? []).toHaveLength(0)
    expect(model?.enums ?? []).toHaveLength(0)
    expect(model?.views ?? []).toHaveLength(0)
    expect(useAppStore.getState().past.at(-1)?.label).toBe(DELETE_SCHEMA_LABEL)
  })

  it('con el interruptor apagado mueve sus tablas al destino (FR-036)', () => {
    useAppStore.getState().deleteSchema('ventas', { withTables: false, target: 'inventario' })

    const model = useAppStore.getState().model
    expect(model?.schemas.map((schema) => schema.name)).toEqual([
      'inventario',
      'personas',
      'reportes',
    ])
    expect(model?.tables?.filter((table) => table.schema === 'inventario')).toHaveLength(3)
    expect(model?.enums?.[0]?.schema).toBe('inventario')
    expect(model?.views?.[0]?.schema).toBe('inventario')
  })

  it('no hace nada si es el único esquema del modelo (FR-035)', () => {
    openModel({
      formatVersion: 1,
      name: 'Uno',
      engine: 'postgres',
      schemas: [{ name: 'public', abbreviation: 'PUB' }],
    })

    useAppStore.getState().deleteSchema('public', { withTables: true, target: null })

    expect(useAppStore.getState().model?.schemas).toHaveLength(1)
    expect(useAppStore.getState().isDirty).toBe(false)
  })

  it('no hace nada si el destino no existe', () => {
    useAppStore.getState().deleteSchema('ventas', { withTables: false, target: 'contabilidad' })

    expect(useAppStore.getState().model?.schemas).toHaveLength(4)
    expect(useAppStore.getState().isDirty).toBe(false)
  })

  it('quita el foco y la selección del esquema que desaparece (FR-032)', () => {
    useAppStore.setState({ focusedSchema: 'ventas', selectedSchema: 'ventas' })

    useAppStore.getState().deleteSchema('ventas', { withTables: true, target: null })

    expect(useAppStore.getState().focusedSchema).toBeNull()
    expect(useAppStore.getState().selectedSchema).toBeNull()
  })

  it('deshacer devuelve el esquema, sus tablas y sus relaciones en un paso (SC-006)', () => {
    const before = useAppStore.getState().model

    useAppStore.getState().deleteSchema('ventas', { withTables: true, target: null })
    useAppStore.getState().undo()

    expect(useAppStore.getState().model).toEqual(before)
    expect(useAppStore.getState().isDirty).toBe(false)
  })
})

describe('moveSchema', () => {
  beforeEach(() => openModel(threeSchemas()))

  it('con tablas suma el desplazamiento a cada una, incluidas las que no traían posición (FR-026)', () => {
    useAppStore.getState().moveSchema('ventas', { x: 30, y: 40 })

    const tables = useAppStore.getState().model?.tables ?? []
    expect(tables.find((table) => table.name === 'facturas')?.position).toEqual({ x: 30, y: 40 })
    expect(tables.find((table) => table.name === 'pagos')?.position).toEqual({ x: 270, y: 40 })
    expect(useAppStore.getState().past.at(-1)?.label).toBe(MOVE_SCHEMA_TABLES_LABEL)
  })

  it('no toca las tablas de los demás esquemas', () => {
    useAppStore.getState().moveSchema('ventas', { x: 30, y: 40 })

    const tables = useAppStore.getState().model?.tables ?? []
    expect(tables.find((table) => table.name === 'productos')?.position).toBeUndefined()
    expect(tables.find((table) => table.name === 'clientes')?.position).toBeUndefined()
  })

  it('borra la posición del esquema cuando tiene tablas, porque deja de aplicar (FR-026a)', () => {
    const model = threeSchemas()
    openModel({
      ...model,
      schemas: model.schemas.map((schema) =>
        schema.name === 'ventas' ? { ...schema, position: { x: 500, y: 500 } } : schema,
      ),
    })

    useAppStore.getState().moveSchema('ventas', { x: 10, y: 10 })

    const schema = useAppStore.getState().model?.schemas[0]
    expect(schema?.position).toBeUndefined()
    expect(useAppStore.getState().model?.tables?.[0]?.position).toEqual({ x: 10, y: 10 })
  })

  it('sin tablas escribe la posición del esquema (FR-026a)', () => {
    useAppStore.getState().moveSchema('reportes', { x: -50, y: 25 })

    const schema = useAppStore
      .getState()
      .model?.schemas.find((candidate) => candidate.name === 'reportes')
    expect(schema?.position).toEqual({ x: 1050, y: 25 })
    expect(useAppStore.getState().past.at(-1)?.label).toBe(MOVE_SCHEMA_LABEL)
  })

  it('mover dos veces parte de donde quedó, no de la rejilla', () => {
    useAppStore.getState().moveSchema('reportes', { x: 100, y: 0 })
    useAppStore.getState().moveSchema('reportes', { x: 100, y: 0 })

    const schema = useAppStore
      .getState()
      .model?.schemas.find((candidate) => candidate.name === 'reportes')
    expect(schema?.position).toEqual({ x: 1300, y: 0 })
  })

  it('un gesto es un solo paso de deshacer, con tablas y sin ellas (FR-027, SC-006)', () => {
    const before = useAppStore.getState().model

    useAppStore.getState().moveSchema('ventas', { x: 30, y: 40 })
    expect(useAppStore.getState().past).toHaveLength(1)
    useAppStore.getState().undo()

    expect(useAppStore.getState().model).toEqual(before)
    expect(useAppStore.getState().isDirty).toBe(false)
    expect(useAppStore.getState().notice).toBe(`Deshecho: ${MOVE_SCHEMA_TABLES_LABEL}`)
  })

  it('un desplazamiento nulo no deja paso ni ensucia el modelo', () => {
    useAppStore.getState().moveSchema('ventas', { x: 0, y: 0 })

    expect(useAppStore.getState().past).toHaveLength(0)
    expect(useAppStore.getState().isDirty).toBe(false)
  })

  it('no hace nada con un esquema que no está en el modelo', () => {
    useAppStore.getState().moveSchema('contabilidad', { x: 10, y: 10 })

    expect(useAppStore.getState().isDirty).toBe(false)
  })
})

describe('ida y vuelta de las posiciones (FR-026, FR-026a, SC-007)', () => {
  beforeEach(() => openModel(threeSchemas()))

  it('lo que se movió llega al archivo y reabrirlo lo deja donde se dejó', () => {
    useAppStore.getState().moveSchema('ventas', { x: 30, y: 40 })
    useAppStore.getState().moveSchema('reportes', { x: -50, y: 25 })
    const moved = useAppStore.getState().model
    if (moved === null) throw new Error('el modelo debería estar abierto')

    const text = serializeModel(moved)
    expect(text).toContain('position:')

    const reopened = parseModel(text)
    expect(reopened.ok).toBe(true)
    if (!reopened.ok) return
    expect(reopened.model).toEqual(moved)
  })

  it('un modelo que nadie movió no gana ninguna posición en el archivo (FR-013)', () => {
    const model = useAppStore.getState().model
    if (model === null) throw new Error('el modelo debería estar abierto')

    expect(serializeModel(model)).not.toContain('position:')
  })
})
