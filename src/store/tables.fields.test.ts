import { beforeEach, describe, expect, it } from 'vitest'

import { readFixture } from '@/lib/model/__fixtures__'
import { parseModel } from '@/lib/model/parse'
import type { Model, Table } from '@/lib/model/types'
import { useAppStore } from '@/store'
import { templatesOf } from '@/lib/model/engines'
import {
  ADD_FIELD_LABEL,
  APPLY_TEMPLATE_LABEL,
  SET_FIELD_KEY_LABEL,
  DELETE_FIELD_LABEL,
  INVALID_FIELD_NAME_ERROR,
  NEW_FIELD_NAME,
  UPDATE_FIELD_LABEL,
  repeatedFieldError,
} from '@/store/tables'
import { resetStore } from '@/test/helpers'

/**
 * Pruebas de las acciones de campos del almacén (FR-012 a FR-021).
 *
 * El nombre de un campo es su única referencia: lo llevan la llave primaria,
 * los únicos, los índices y las relaciones de los dos extremos, así que
 * renombrarlo o eliminarlo tiene que arrastrar todo eso en el mismo paso.
 */

/** Modelo de ejemplo con seis tablas, seis relaciones y sus marcas. */
function postgres(): Model {
  const result = parseModel(readFixture('modelo-postgres'))
  if (!result.ok) throw new Error('el ejemplo no es un modelo válido')
  return result.model
}

/** Deja el almacén con ese modelo ya «guardado». */
function openModel(model: Model) {
  resetStore()
  useAppStore.setState({ screen: 'editor', model, savedModel: model, isDirty: false })
}

/** La tabla con ese nombre del modelo abierto. */
function tableNamed(name: string): Table | undefined {
  return (useAppStore.getState().model?.tables ?? []).find((table) => table.name === name)
}

/** El campo de esa tabla. */
function fieldNamed(table: string, field: string) {
  return tableNamed(table)?.fields.find((item) => item.name === field)
}

/** La relación con ese nombre del modelo abierto. */
function relationNamed(name: string) {
  return (useAppStore.getState().model?.relations ?? []).find((item) => item.name === name)
}

describe('addField', () => {
  beforeEach(() => openModel(postgres()))

  it('deja la fila nueva al final, enfocada en su nombre (FR-013)', () => {
    useAppStore.getState().addField('hoteles')

    const fields = tableNamed('hoteles')?.fields ?? []
    expect(fields.at(-1)).toEqual({ name: NEW_FIELD_NAME, type: 'text' })
    expect(useAppStore.getState().focusedCell).toEqual({ field: NEW_FIELD_NAME, column: 'name' })
    expect(useAppStore.getState().past.map((step) => step.label)).toEqual([ADD_FIELD_LABEL])
  })

  it('no repite el nombre del campo nuevo (RS-03)', () => {
    const add = useAppStore.getState().addField
    add('hoteles')
    add('hoteles')

    const names = (tableNamed('hoteles')?.fields ?? []).map((field) => field.name)
    expect(names).toContain(NEW_FIELD_NAME)
    expect(names).toContain(`${NEW_FIELD_NAME}_2`)
  })
})

describe('updateField', () => {
  beforeEach(() => openModel(postgres()))

  it('cambiar a un tipo sin longitud olvida longitud y escala (FR-015)', () => {
    useAppStore.getState().updateField('pagos', 'importe', { type: 'integer' })

    expect(fieldNamed('pagos', 'importe')).toEqual({ name: 'importe', type: 'integer' })
  })

  it('cambiar a un tipo con longitud propone sus valores habituales (FR-015)', () => {
    useAppStore.getState().updateField('hoteles', 'ciudad', { type: 'varchar' })

    expect(fieldNamed('hoteles', 'ciudad')).toMatchObject({ type: 'varchar', length: 120 })
  })

  it('un nombre repetido devuelve su error y no toca el modelo (FR-017)', () => {
    const error = useAppStore.getState().updateField('hoteles', 'ciudad', { name: 'nombre' })

    expect(error).toBe(repeatedFieldError('nombre'))
    expect(fieldNamed('hoteles', 'ciudad')).toBeDefined()
    expect(useAppStore.getState().isDirty).toBe(false)
  })

  it('un nombre inválido devuelve su error y no toca el modelo (RS-03)', () => {
    const error = useAppStore.getState().updateField('hoteles', 'ciudad', { name: '2026_ciudad' })

    expect(error).toBe(INVALID_FIELD_NAME_ERROR)
    expect(fieldNamed('hoteles', 'ciudad')).toBeDefined()
    expect(useAppStore.getState().past).toHaveLength(0)
  })

  it('un campo de la llave primaria no admite nulos (FR-026)', () => {
    useAppStore.getState().updateField('hoteles', 'id', { nullable: true })

    expect(fieldNamed('hoteles', 'id')?.nullable).toBeUndefined()
  })

  it('las pulsaciones de la misma celda se deshacen en un paso (FR-024a)', () => {
    const update = useAppStore.getState().updateField
    update('hoteles', 'ciudad', { comment: 'Ciu' }, 'comment:hoteles:ciudad')
    update('hoteles', 'ciudad', { comment: 'Ciudad' }, 'comment:hoteles:ciudad')

    expect(useAppStore.getState().past.map((step) => step.label)).toEqual([UPDATE_FIELD_LABEL])
    useAppStore.getState().undo()
    expect(fieldNamed('hoteles', 'ciudad')?.comment).toBeUndefined()
  })

  it('renombrar un campo de la llave primaria lo deja en `primaryKey` (FR-021)', () => {
    useAppStore.getState().updateField('hoteles', 'id', { name: 'hotel_id' })

    expect(tableNamed('hoteles')?.primaryKey).toEqual(['hotel_id'])
    expect(fieldNamed('hoteles', 'hotel_id')).toBeDefined()
  })

  it('renombrar un campo lo reescribe en sus únicos y sus índices (FR-021)', () => {
    useAppStore.getState().updateField('clientes', 'correo', { name: 'email' })
    useAppStore.getState().updateField('hoteles', 'ciudad', { name: 'municipio' })

    expect(tableNamed('clientes')?.uniques?.[0]?.fields).toEqual(['email'])
    expect(tableNamed('hoteles')?.indexes?.[0]?.fields).toEqual(['municipio'])
  })

  it('renombrar un campo con relación la deja apuntando al nombre nuevo (FR-021)', () => {
    // `reserva_id` de `pagos` es el extremo `from` de `pagos_reserva_fk`.
    useAppStore.getState().updateField('pagos', 'reserva_id', { name: 'reservacion_id' })
    // `id` de `reservas` es el extremo `to` de esa misma relación.
    useAppStore.getState().updateField('reservas', 'id', { name: 'reserva_id' })

    expect(relationNamed('pagos_reserva_fk')?.fromFields).toEqual(['reservacion_id'])
    expect(relationNamed('pagos_reserva_fk')?.toFields).toEqual(['reserva_id'])
  })

  it('deshacer devuelve el nombre viejo y la relación a la vez (FR-021, FR-045)', () => {
    useAppStore.getState().updateField('pagos', 'reserva_id', { name: 'reservacion_id' })
    useAppStore.getState().undo()

    expect(fieldNamed('pagos', 'reserva_id')).toBeDefined()
    expect(relationNamed('pagos_reserva_fk')?.fromFields).toEqual(['reserva_id'])
  })

  it('el foco sigue al campo renombrado (FR-044)', () => {
    useAppStore.getState().focusCell({ field: 'ciudad', column: 'name' })
    useAppStore.getState().updateField('hoteles', 'ciudad', { name: 'municipio' })

    expect(useAppStore.getState().focusedCell).toEqual({ field: 'municipio', column: 'name' })
  })
})

describe('moveFieldBy', () => {
  beforeEach(() => openModel(postgres()))

  it('sube y baja el campo dentro de su tabla (FR-014)', () => {
    useAppStore.getState().moveFieldBy('hoteles', 'ciudad', -1)

    expect((tableNamed('hoteles')?.fields ?? []).map((field) => field.name)).toEqual([
      'id',
      'ciudad',
      'nombre',
    ])
  })

  it('no mueve el primero hacia arriba ni el último hacia abajo (FR-014)', () => {
    const move = useAppStore.getState().moveFieldBy
    move('hoteles', 'id', -1)
    move('hoteles', 'ciudad', 1)

    expect((tableNamed('hoteles')?.fields ?? []).map((field) => field.name)).toEqual([
      'id',
      'nombre',
      'ciudad',
    ])
    expect(useAppStore.getState().past).toHaveLength(0)
  })
})

describe('deleteField', () => {
  beforeEach(() => openModel(postgres()))

  it('quita el campo y sus marcas (FR-019)', () => {
    useAppStore.getState().deleteField('clientes', 'correo')

    expect(fieldNamed('clientes', 'correo')).toBeUndefined()
    expect(tableNamed('clientes')?.uniques).toBeUndefined()
    expect(useAppStore.getState().past.map((step) => step.label)).toEqual([DELETE_FIELD_LABEL])
  })

  it('se lleva las relaciones que lo usaban, en el mismo paso (FR-019, RS-08)', () => {
    useAppStore.getState().deleteField('pagos', 'reserva_id')

    expect(relationNamed('pagos_reserva_fk')).toBeUndefined()
    expect(useAppStore.getState().past).toHaveLength(1)
    useAppStore.getState().undo()
    expect(relationNamed('pagos_reserva_fk')).toBeDefined()
    expect(fieldNamed('pagos', 'reserva_id')).toBeDefined()
  })

  it('no elimina el único campo de la tabla (FR-020)', () => {
    const only: Model = {
      ...postgres(),
      tables: [{ name: 'notas', schema: 'public', fields: [{ name: 'texto', type: 'text' }] }],
      relations: [],
    }
    openModel(only)
    useAppStore.getState().deleteField('notas', 'texto')

    expect(tableNamed('notas')?.fields).toHaveLength(1)
    expect(useAppStore.getState().past).toHaveLength(0)
  })
})

describe('setFieldKey', () => {
  beforeEach(() => openModel(postgres()))

  it('`PK` añade el campo a la llave primaria y lo deja no nulo (FR-025, FR-026)', () => {
    useAppStore.getState().setFieldKey('clientes', 'telefono', 'PK')

    expect(tableNamed('clientes')?.primaryKey).toEqual(['id', 'telefono'])
    expect(fieldNamed('clientes', 'telefono')?.nullable).toBeUndefined()
    expect(useAppStore.getState().past.map((step) => step.label)).toEqual([SET_FIELD_KEY_LABEL])
  })

  it('dos campos `PK` forman una llave compuesta (FR-025)', () => {
    const setKey = useAppStore.getState().setFieldKey
    setKey('pagos', 'reserva_id', 'PK')
    setKey('pagos', 'importe', 'PK')

    expect(tableNamed('pagos')?.primaryKey).toEqual(['id', 'reserva_id', 'importe'])
  })

  it('`UK` crea el único `uq_<tabla>_<campo>` (FR-025)', () => {
    useAppStore.getState().setFieldKey('hoteles', 'nombre', 'UK')

    expect(tableNamed('hoteles')?.uniques).toEqual([
      { name: 'uq_hoteles_nombre', fields: ['nombre'] },
    ])
  })

  it('`null` quita la llave primaria y el único de ese campo (FR-025)', () => {
    const setKey = useAppStore.getState().setFieldKey
    setKey('clientes', 'correo', null)
    setKey('clientes', 'id', null)

    expect(tableNamed('clientes')?.uniques).toBeUndefined()
    expect(tableNamed('clientes')?.primaryKey).toBeUndefined()
  })

  it('un único de varios campos no se toca (research R12)', () => {
    // `habitaciones_hotel_numero_key` es de dos campos.
    useAppStore.getState().setFieldKey('habitaciones', 'numero', null)

    expect(tableNamed('habitaciones')?.uniques?.[0]?.fields).toEqual(['hotel_id', 'numero'])
  })
})

describe('applyTemplate', () => {
  beforeEach(() => openModel(postgres()))

  it('añade los campos del grupo con los tipos del motor (FR-027)', () => {
    useAppStore.getState().applyTemplate('hoteles', 'audit')

    const names = (tableNamed('hoteles')?.fields ?? []).map((field) => field.name)
    expect(names).toEqual(['id', 'nombre', 'ciudad', 'created_at', 'updated_at'])
    expect(fieldNamed('hoteles', 'created_at')).toMatchObject({
      type: 'timestamptz',
      default: 'now()',
    })
    expect(useAppStore.getState().past.map((step) => step.label)).toEqual([APPLY_TEMPLATE_LABEL])
  })

  it('añade solo los campos que faltan, sin duplicar (FR-028)', () => {
    useAppStore.getState().updateField('hoteles', 'ciudad', { name: 'created_at' })
    useAppStore.getState().applyTemplate('hoteles', 'audit')

    const names = (tableNamed('hoteles')?.fields ?? []).map((field) => field.name)
    expect(names.filter((name) => name === 'created_at')).toHaveLength(1)
    expect(names).toContain('updated_at')
  })

  it('no hace nada ni marca «Editado» si ya están todos (FR-028)', () => {
    const apply = useAppStore.getState().applyTemplate
    apply('hoteles', 'audit')
    useAppStore.setState({ savedModel: useAppStore.getState().model, isDirty: false, past: [] })
    apply('hoteles', 'audit')

    expect(useAppStore.getState().isDirty).toBe(false)
    expect(useAppStore.getState().past).toHaveLength(0)
  })

  it('deja el foco en el primer campo añadido (FR-027)', () => {
    useAppStore.getState().applyTemplate('hoteles', 'active')

    const first = templatesOf('postgres').find((group) => group.key === 'active')?.fields[0]?.name
    expect(useAppStore.getState().focusedCell).toEqual({ field: first, column: 'name' })
  })

  it('los cuatro grupos son los de `templatesOf` (FR-027)', () => {
    expect(templatesOf('postgres').map((group) => group.key)).toEqual([
      'audit',
      'softDelete',
      'authorship',
      'active',
    ])
  })
})
