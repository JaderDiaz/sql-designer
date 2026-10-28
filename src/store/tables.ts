import { TABLE_WIDTH, tableHeight } from '@/lib/canvas/constants'
import type { Rect } from '@/lib/canvas/constants'
import { findFreeSpot, snapToGrid as snapPosition } from '@/lib/canvas/geometry'
import { resolveLayout } from '@/lib/canvas/layout'
import { toModelPoint } from '@/lib/canvas/zoom'
import { auditFields, idField, templatesOf, textTypeOf, typeTraits } from '@/lib/model/engines'
import type { FieldTemplate } from '@/lib/model/engines'
import { TECHNICAL_NAME_PATTERN, TABLE_COMMENT_MAX_LENGTH } from '@/lib/model/types'
import type { Field, Model, NamedFields, Position, Relation, Table } from '@/lib/model/types'
import { pushHistory } from '@/store/model'
import type { AppSlice } from '@/store/types'

/**
 * Parte de las tablas y de sus campos: crear, mover, renombrar, duplicar,
 * eliminar y describir (FR-001 a FR-041).
 *
 * Todas cambian el modelo en memoria, lo dejan «Editado» y entran en el
 * historial con su etiqueta, de modo que ⌘Z deshace el gesto entero en un
 * paso (RS-06). Ninguna escribe en el disco: eso lo hace Guardar. El contrato
 * completo está en `specs/004-tablas-campos/contracts/tables.md` §2.
 */

/** Lo que el diálogo Nueva tabla entrega, ya validado por él (FR-003). */
export interface TableDraft {
  /** Nombre técnico, único en el modelo (RS-03). */
  name: string
  /** Esquema de destino; tiene que existir. */
  schema: string
  /** Descripción, de hasta 280 caracteres. */
  comment?: string
  /** Si llega con el campo `id` de llave primaria (FR-008). */
  withId: boolean
  /** Si llega con los campos de auditoría (FR-008). */
  withAudit: boolean
  /** Punto del modelo donde dejarla; sin él, el centro visible (FR-006). */
  position?: Position
}

/** Qué se cambia de un campo en una sola pulsación (FR-012). */
export interface FieldPatch {
  name?: string
  type?: string
  length?: number | null
  scale?: number | null
  nullable?: boolean
  default?: string
  comment?: string
}

/** Marca de llave que la celda «Llave» puede fijar (FR-025). */
export type FieldKey = 'PK' | 'UK' | null

/** Campo en espera de confirmación de borrado (FR-019). */
export interface FieldTarget {
  table: string
  field: string
}

/** Etiqueta del paso de crear una tabla. */
export const CREATE_TABLE_LABEL = 'crear la tabla'

/** Etiqueta del paso de moverla. */
export const MOVE_TABLE_LABEL = 'mover la tabla'

/** Etiqueta del paso de cambiarla de esquema. */
export const SET_TABLE_SCHEMA_LABEL = 'cambiar la tabla de esquema'

/** Etiqueta del paso de renombrarla. */
export const RENAME_TABLE_LABEL = 'renombrar la tabla'

/** Etiqueta del paso de duplicarla. */
export const DUPLICATE_TABLE_LABEL = 'duplicar la tabla'

/** Etiqueta del paso de eliminarla. */
export const DELETE_TABLE_LABEL = 'eliminar la tabla'

/** Etiqueta del paso de cambiar su descripción. */
export const TABLE_COMMENT_LABEL = 'editar la descripción'

/** Etiqueta del paso de añadir un campo. */
export const ADD_FIELD_LABEL = 'añadir el campo'

/** Etiqueta del paso de editar un campo. */
export const UPDATE_FIELD_LABEL = 'editar el campo'

/** Etiqueta del paso de reordenar los campos. */
export const MOVE_FIELD_LABEL = 'reordenar los campos'

/** Etiqueta del paso de eliminar un campo. */
export const DELETE_FIELD_LABEL = 'eliminar el campo'

/** Etiqueta del paso de cambiar la llave de un campo. */
export const SET_FIELD_KEY_LABEL = 'cambiar la llave'

/** Etiqueta del paso de aplicar una plantilla. */
export const APPLY_TEMPLATE_LABEL = 'añadir los campos de la plantilla'

/** Nombre que lleva un campo recién añadido (FR-013). */
export const NEW_FIELD_NAME = 'nuevo_campo'

/** Lo que se dice cuando el nombre de un campo ya está en la tabla (FR-017). */
export function repeatedFieldError(name: string): string {
  return `Ya hay un campo \`${name}\` en esta tabla.`
}

/** Lo que se dice cuando el nombre de un campo no cumple RS-03. */
export const INVALID_FIELD_NAME_ERROR =
  'Usa letras, números y guion bajo; no empieces con un número.'

/** Estado y acciones de la parte de las tablas. */
export interface TablesSlice {
  /** Tabla que renombra el diálogo, o `null` (FR-037). */
  tableTarget: string | null
  /** Punto pedido para la tabla nueva, o `null` para el centro visible. */
  tableDraftPosition: Position | null
  /** Tabla en espera de confirmación de borrado (FR-039). */
  deleteTableTarget: string | null
  /** Campo en espera de confirmación de borrado (FR-019). */
  deleteFieldTarget: FieldTarget | null
  openTableDialog: (position?: Position) => void
  openRenameTableDialog: (name: string) => void
  openDeleteTableDialog: (name: string) => void
  openDeleteFieldDialog: (target: FieldTarget) => void
  createTable: (draft: TableDraft) => void
  moveTable: (name: string, delta: Position, options?: { schema?: string }) => void
  setTableSchema: (name: string, schema: string) => void
  renameTable: (name: string, next: string) => void
  duplicateTable: (name: string) => void
  deleteTable: (name: string) => void
  setTableComment: (name: string, comment: string) => void
  addField: (table: string) => void
  updateField: (
    table: string,
    field: string,
    patch: FieldPatch,
    coalesceKey?: string,
  ) => string | null
  moveFieldBy: (table: string, field: string, offset: number) => void
  deleteField: (table: string, field: string) => void
  setFieldKey: (table: string, field: string, key: FieldKey) => void
  applyTemplate: (table: string, template: FieldTemplate['key']) => void
}

/** Las tablas del modelo, que es la lista que estas acciones reescriben. */
function tablesOf(model: Model): Table[] {
  return model.tables ?? []
}

/** El modelo con otra lista de tablas, sin dejar la clave vacía. */
function withTables(model: Model, tables: Table[]): Model {
  if (tables.length === 0) {
    const next: Model = { ...model }
    delete next.tables
    return next
  }
  return { ...model, tables }
}

/** El modelo con otra lista de relaciones, sin dejar la clave vacía. */
function withRelations(model: Model, relations: Relation[]): Model {
  if (relations.length === 0) {
    const next: Model = { ...model }
    delete next.relations
    return next
  }
  return { ...model, relations }
}

/** La misma tabla con sus campos cambiados por los que se le pasen. */
function withFields(table: Table, fields: Field[]): Table {
  return { ...table, fields }
}

/** Reemplaza una tabla del modelo por otra, dejando el orden intacto. */
function replaceTable(model: Model, name: string, next: Table): Model {
  return withTables(
    model,
    tablesOf(model).map((table) => (table.name === name ? next : table)),
  )
}

/** Rectángulo que ocupa cada tabla del modelo, para buscar hueco libre. */
function occupiedRects(model: Model, except?: string): Rect[] {
  const layout = resolveLayout(model)
  return tablesOf(model)
    .filter((table) => table.name !== except)
    .map((table) => {
      const position = layout.get(table.name) ?? { x: 0, y: 0 }
      return {
        x: position.x,
        y: position.y,
        width: TABLE_WIDTH,
        height: tableHeight(table.fields.length),
      }
    })
}

/** Centro visible del lienzo, en coordenadas del modelo (FR-006). */
function visibleCenter(view: { pan: Position; zoom: number; viewport: Rect }): Position {
  const center = {
    x: view.viewport.x + view.viewport.width / 2,
    y: view.viewport.y + view.viewport.height / 2,
  }
  const point = toModelPoint({ pan: view.pan, zoom: view.zoom }, center)
  return { x: Math.round(point.x - TABLE_WIDTH / 2), y: Math.round(point.y - 40) }
}

/** Nombre libre para la copia: `<tabla>_copia`, `_copia_2`… (FR-038). */
function copyName(taken: Set<string>, name: string): string {
  const first = `${name}_copia`
  if (!taken.has(first)) return first
  for (let index = 2; index < 1000; index += 1) {
    const candidate = `${first}_${index}`
    if (!taken.has(candidate)) return candidate
  }
  return `${first}_${Date.now()}`
}

/** El mismo nombre con otro prefijo de tabla, para únicos e índices. */
function renamePrefix(items: NamedFields[] | undefined, from: string, to: string): NamedFields[] {
  return (items ?? []).map((item) =>
    item.name.startsWith(`${from}_`) || item.name === from
      ? { ...item, name: `${to}${item.name.slice(from.length)}` }
      : item,
  )
}

/** Cambia el nombre de un campo dentro de las llaves, únicos e índices. */
function renameFieldInKeys(table: Table, from: string, to: string): Table {
  const swap = (list: string[]) => list.map((item) => (item === from ? to : item))
  const next: Table = { ...table }
  if (next.primaryKey) next.primaryKey = swap(next.primaryKey)
  if (next.uniques)
    next.uniques = next.uniques.map((item) => ({ ...item, fields: swap(item.fields) }))
  if (next.indexes)
    next.indexes = next.indexes.map((item) => ({ ...item, fields: swap(item.fields) }))
  return next
}

/** Cambia el nombre de un campo dentro de las relaciones que lo nombraban. */
function renameFieldInRelations(
  relations: Relation[],
  table: string,
  from: string,
  to: string,
): Relation[] {
  const swap = (list: string[]) => list.map((item) => (item === from ? to : item))
  return relations.map((relation) => {
    let next = relation
    if (relation.fromTable === table && relation.fromFields.includes(from)) {
      next = { ...next, fromFields: swap(next.fromFields) }
    }
    if (relation.toTable === table && relation.toFields.includes(from)) {
      next = { ...next, toFields: swap(next.toFields) }
    }
    return next
  })
}

/** La tabla sin el campo que se elimina, también en sus llaves (FR-019). */
function removeFieldFromKeys(table: Table, field: string): Table {
  const next: Table = { ...table, fields: table.fields.filter((item) => item.name !== field) }
  const primaryKey = (table.primaryKey ?? []).filter((item) => item !== field)
  if (table.primaryKey) {
    if (primaryKey.length === 0) delete next.primaryKey
    else next.primaryKey = primaryKey
  }
  for (const key of ['uniques', 'indexes'] as const) {
    const list = table[key]
    if (list === undefined) continue
    const kept = list
      .map((item) => ({ ...item, fields: item.fields.filter((name) => name !== field) }))
      .filter((item) => item.fields.length > 0)
    if (kept.length === 0) delete next[key]
    else next[key] = kept
  }
  return next
}

/** El campo con la longitud y la escala que su tipo nuevo admite (FR-015). */
function fitSize(field: Field, engine: Model['engine'], type: string): Field {
  const traits = typeTraits(engine, type)
  const next: Field = { ...field, type }
  if (traits.hasLength) {
    if (next.length === undefined && traits.defaultLength !== undefined) {
      next.length = traits.defaultLength
    }
  } else {
    delete next.length
  }
  if (traits.hasScale) {
    if (next.scale === undefined && traits.defaultScale !== undefined) {
      next.scale = traits.defaultScale
    }
  } else {
    delete next.scale
  }
  return next
}

/** Aplica un parche a un campo, quitando las claves que se vacían. */
function applyPatch(field: Field, patch: FieldPatch, engine: Model['engine']): Field {
  let next: Field = { ...field }
  if (patch.type !== undefined && patch.type !== field.type)
    next = fitSize(next, engine, patch.type)
  if (patch.name !== undefined) next.name = patch.name
  for (const key of ['length', 'scale'] as const) {
    const value = patch[key]
    if (value === undefined) continue
    if (value === null) delete next[key]
    else next[key] = value
  }
  if (patch.nullable !== undefined) {
    if (patch.nullable) next.nullable = true
    else delete next.nullable
  }
  for (const key of ['default', 'comment'] as const) {
    const value = patch[key]
    if (value === undefined) continue
    if (value.trim() === '') delete next[key]
    else next[key] = value
  }
  return next
}

/**
 * Crea la parte de las tablas.
 *
 * @param set Escritura del almacén compuesto.
 * @param get Lectura del almacén compuesto.
 */
export const createTablesSlice: AppSlice<TablesSlice> = (set, get) => ({
  tableTarget: null,
  tableDraftPosition: null,
  deleteTableTarget: null,
  deleteFieldTarget: null,

  /**
   * Abre el diálogo Nueva tabla (FR-001, FR-006).
   *
   * @param position Punto del modelo donde dejarla, si se pidió con doble clic.
   */
  openTableDialog(position) {
    set({ tableDraftPosition: position ?? null, dialog: 'table' })
  },

  /**
   * Abre el diálogo de renombrar una tabla (FR-037).
   *
   * @param name Nombre técnico actual.
   */
  openRenameTableDialog(name) {
    set({ tableTarget: name, dialog: 'rename-table' })
  },

  /**
   * Abre la confirmación de eliminar una tabla (FR-039).
   *
   * @param name Nombre técnico de la tabla.
   */
  openDeleteTableDialog(name) {
    set({ deleteTableTarget: name, dialog: 'delete-table' })
  },

  /**
   * Abre la confirmación de eliminar un campo que una relación usa (FR-019).
   *
   * @param target Tabla y campo.
   */
  openDeleteFieldDialog(target) {
    set({ deleteFieldTarget: target, dialog: 'delete-field' })
  },

  /**
   * Añade una tabla al modelo, la selecciona y abre su editor (FR-001 a
   * FR-008).
   *
   * El diálogo ya comprobó el nombre; aquí se vuelve a comprobar para no
   * escribir un modelo inválido si alguna vía llamara sin validar. La posición
   * es la pedida o el centro visible, y en los dos casos se busca hueco libre
   * para no dejar la tabla nueva debajo de otra.
   *
   * @param draft Nombre, esquema, descripción y las dos opciones de campos.
   */
  createTable(draft) {
    const state = get()
    const { model, preferences } = state
    if (model === null) return
    if (model.schemas.every((schema) => schema.name !== draft.schema)) return
    if (tablesOf(model).some((table) => table.name === draft.name)) return

    const fields: Field[] = []
    if (draft.withId) fields.push(idField(model.engine))
    if (draft.withAudit) fields.push(...auditFields(model.engine))
    if (fields.length === 0) fields.push({ name: NEW_FIELD_NAME, type: textTypeOf(model.engine) })

    const desired = draft.position ?? visibleCenter(state)
    const size = { x: 0, y: 0, width: TABLE_WIDTH, height: tableHeight(fields.length) }
    const spot = snapPosition(
      findFreeSpot(occupiedRects(model), desired, size),
      preferences.snapToGrid,
    )
    const comment = draft.comment?.trim()

    const table: Table = {
      name: draft.name,
      schema: draft.schema,
      ...(comment !== undefined && comment !== '' ? { comment } : {}),
      fields,
      ...(draft.withId ? { primaryKey: [fields[0]?.name ?? 'id'] } : {}),
      position: spot,
    }

    set({
      ...pushHistory(state, withTables(model, [...tablesOf(model), table]), CREATE_TABLE_LABEL),
      selectedTable: draft.name,
      selectedSchema: null,
      tableDraftPosition: null,
      dialog: null,
    })
    // El editor abre con el primer campo enfocado: quien crea la tabla con el
    // teclado sigue escribiendo en la rejilla sin tocar el ratón (FR-007,
    // FR-044, SC-009).
    get().openFieldsPanel(draft.name, { field: fields[0]?.name ?? '', column: 'name' })
  },

  /**
   * Mueve una tabla por el lienzo, y la cambia de esquema si se le dice
   * (FR-030 a FR-033).
   *
   * El desplazamiento se suma a la posición actual, resolviendo primero la que
   * el archivo no traía, para que la tabla no salte al primer arrastre. El
   * ajuste a la cuadrícula se aplica al soltar, no durante el gesto (FR-032).
   *
   * @param name Nombre técnico de la tabla.
   * @param delta Desplazamiento del gesto, en coordenadas del modelo.
   * @param options Esquema de destino, si la tabla cambia de zona.
   */
  moveTable(name, delta, options) {
    const state = get()
    const { model, preferences } = state
    if (model === null) return
    const current = tablesOf(model).find((table) => table.name === name)
    if (current === undefined) return
    const schema = options?.schema
    const changesSchema = schema !== undefined && schema !== current.schema
    if (schema !== undefined && model.schemas.every((item) => item.name !== schema)) return
    if (delta.x === 0 && delta.y === 0 && !changesSchema) return

    const base = current.position ?? resolveLayout(model).get(name) ?? { x: 0, y: 0 }
    const moved = snapPosition({ x: base.x + delta.x, y: base.y + delta.y }, preferences.snapToGrid)
    const next: Table = {
      ...current,
      ...(changesSchema ? { schema: schema as string } : {}),
      position: moved,
    }

    set(
      pushHistory(
        state,
        replaceTable(model, name, next),
        changesSchema ? SET_TABLE_SCHEMA_LABEL : MOVE_TABLE_LABEL,
      ),
    )
  },

  /**
   * Cambia el esquema de una tabla sin moverla (FR-035).
   *
   * @param name Nombre técnico de la tabla.
   * @param schema Esquema de destino.
   */
  setTableSchema(name, schema) {
    const state = get()
    const { model } = state
    if (model === null) return
    const current = tablesOf(model).find((table) => table.name === name)
    if (current === undefined || current.schema === schema) return
    if (model.schemas.every((item) => item.name !== schema)) return

    set(
      pushHistory(state, replaceTable(model, name, { ...current, schema }), SET_TABLE_SCHEMA_LABEL),
    )
  },

  /**
   * Renombra una tabla y propaga el nombre nuevo (FR-037).
   *
   * El nombre de una tabla es su única referencia: lo llevan las relaciones,
   * los nombres de sus únicos e índices y las vistas que la nombran.
   *
   * @param name Nombre técnico actual.
   * @param next Nombre técnico nuevo.
   */
  renameTable(name, next) {
    const state = get()
    const { model, selectedTable } = state
    if (model === null || name === next) return
    if (!TECHNICAL_NAME_PATTERN.test(next)) return
    const current = tablesOf(model).find((table) => table.name === name)
    if (current === undefined) return
    if (tablesOf(model).some((table) => table.name === next)) return

    const renamed: Table = {
      ...current,
      name: next,
      ...(current.uniques ? { uniques: renamePrefix(current.uniques, name, next) } : {}),
      ...(current.indexes ? { indexes: renamePrefix(current.indexes, name, next) } : {}),
    }
    let model2 = replaceTable(model, name, renamed)
    model2 = withRelations(
      model2,
      (model2.relations ?? []).map((relation) => ({
        ...relation,
        ...(relation.fromTable === name ? { fromTable: next } : {}),
        ...(relation.toTable === name ? { toTable: next } : {}),
      })),
    )
    if (model2.views) {
      model2 = {
        ...model2,
        views: model2.views.map((view) => ({
          ...view,
          tables: view.tables.map((table) => (table === name ? next : table)),
        })),
      }
    }

    set({
      ...pushHistory(state, model2, RENAME_TABLE_LABEL),
      ...(selectedTable === name ? { selectedTable: next } : {}),
      tableTarget: null,
      dialog: null,
    })
  },

  /**
   * Duplica una tabla en el hueco libre más cercano (FR-038).
   *
   * Copia campos, llaves, índices y descripción; no copia relaciones, porque
   * una llave foránea duplicada apuntaría dos veces a la misma fila y eso lo
   * decide el usuario en el incremento de las relaciones (research R11).
   *
   * @param name Nombre técnico de la tabla a duplicar.
   */
  duplicateTable(name) {
    const state = get()
    const { model } = state
    if (model === null) return
    const current = tablesOf(model).find((table) => table.name === name)
    if (current === undefined) return

    const taken = new Set(tablesOf(model).map((table) => table.name))
    const copy = copyName(taken, name)
    const base = current.position ?? resolveLayout(model).get(name) ?? { x: 0, y: 0 }
    const size = { x: 0, y: 0, width: TABLE_WIDTH, height: tableHeight(current.fields.length) }
    const spot = findFreeSpot(
      occupiedRects(model),
      { x: base.x + TABLE_WIDTH + 40, y: base.y },
      size,
    )

    const table: Table = {
      ...current,
      name: copy,
      ...(current.uniques ? { uniques: renamePrefix(current.uniques, name, copy) } : {}),
      ...(current.indexes ? { indexes: renamePrefix(current.indexes, name, copy) } : {}),
      fields: current.fields.map((field) => ({ ...field })),
      position: spot,
    }

    set({
      ...pushHistory(state, withTables(model, [...tablesOf(model), table]), DUPLICATE_TABLE_LABEL),
      selectedTable: copy,
      selectedSchema: null,
    })
    get().showNotice(`Duplicada como \`${copy}\``)
  },

  /**
   * Elimina una tabla y las relaciones que la tocaban (FR-039, FR-040).
   *
   * @param name Nombre técnico de la tabla.
   */
  deleteTable(name) {
    const state = get()
    const { model, selectedTable, isFieldsPanelOpen, fieldsPanelTable } = state
    if (model === null) return
    if (tablesOf(model).every((table) => table.name !== name)) return

    let next = withTables(
      model,
      tablesOf(model).filter((table) => table.name !== name),
    )
    next = withRelations(
      next,
      (next.relations ?? []).filter(
        (relation) => relation.fromTable !== name && relation.toTable !== name,
      ),
    )
    if (next.views) {
      next = { ...next, views: next.views.filter((view) => !view.tables.includes(name)) }
    }

    const closesPanel = isFieldsPanelOpen && fieldsPanelTable === name
    set({
      ...pushHistory(state, next, DELETE_TABLE_LABEL),
      ...(selectedTable === name ? { selectedTable: null } : {}),
      ...(closesPanel
        ? { isFieldsPanelOpen: false, fieldsPanelTable: null, focusedCell: null }
        : {}),
      deleteTableTarget: null,
      dialog: null,
    })
  },

  /**
   * Escribe la descripción de una tabla, recortada a 280 (FR-043).
   *
   * Entra con clave de fusión: escribir la descripción entera es un solo paso
   * de deshacer (FR-024a).
   *
   * @param name Nombre técnico de la tabla.
   * @param comment Texto, tal como se está escribiendo.
   */
  setTableComment(name, comment) {
    const state = get()
    const { model } = state
    if (model === null) return
    const current = tablesOf(model).find((table) => table.name === name)
    if (current === undefined) return

    const text = comment.slice(0, TABLE_COMMENT_MAX_LENGTH)
    if ((current.comment ?? '') === text) return
    const next: Table = { ...current }
    if (text.trim() === '') delete next.comment
    else next.comment = text

    set(
      pushHistory(
        state,
        replaceTable(model, name, next),
        TABLE_COMMENT_LABEL,
        `descripcion:${name}`,
      ),
    )
  },

  /**
   * Añade un campo al final de la tabla y lo deja enfocado (FR-013).
   *
   * @param table Nombre técnico de la tabla.
   */
  addField(table) {
    const state = get()
    const { model } = state
    if (model === null) return
    const current = tablesOf(model).find((item) => item.name === table)
    if (current === undefined) return

    const taken = new Set(current.fields.map((field) => field.name))
    let name = NEW_FIELD_NAME
    for (let index = 2; taken.has(name); index += 1) name = `${NEW_FIELD_NAME}_${index}`
    const field = fitSize(
      { name, type: textTypeOf(model.engine) },
      model.engine,
      textTypeOf(model.engine),
    )

    set(
      pushHistory(
        state,
        replaceTable(model, table, withFields(current, [...current.fields, field])),
        ADD_FIELD_LABEL,
      ),
    )
    get().openFieldsPanel(table, { field: name, column: 'name' })
  },

  /**
   * Cambia una propiedad de un campo (FR-012, FR-015 a FR-018).
   *
   * Devuelve el error de la fila cuando el nombre nuevo está repetido o
   * incumple RS-03, y entonces no toca el modelo: la celda conserva el valor
   * que tenía (FR-017).
   *
   * @param table Nombre técnico de la tabla.
   * @param field Nombre técnico del campo.
   * @param patch Lo que cambia.
   * @param coalesceKey Clave del gesto, para fusionar pulsaciones (FR-024a).
   * @returns El error que la fila tiene que mostrar, o `null`.
   */
  updateField(table, field, patch, coalesceKey) {
    const state = get()
    const { model } = state
    if (model === null) return null
    const current = tablesOf(model).find((item) => item.name === table)
    if (current === undefined) return null
    const target = current.fields.find((item) => item.name === field)
    if (target === undefined) return null

    const renamed = patch.name !== undefined && patch.name !== field
    if (renamed) {
      const name = patch.name as string
      if (!TECHNICAL_NAME_PATTERN.test(name)) return INVALID_FIELD_NAME_ERROR
      if (current.fields.some((item) => item.name === name)) return repeatedFieldError(name)
    }

    const next = applyPatch(target, patch, model.engine)
    // Un campo de la llave primaria no puede admitir nulos (FR-026).
    if ((current.primaryKey ?? []).includes(field)) delete next.nullable

    let table2 = withFields(
      current,
      current.fields.map((item) => (item.name === field ? next : item)),
    )
    let model2 = model
    if (renamed) {
      // El nombre del campo es su única referencia: lo llevan las llaves, los
      // únicos, los índices y las relaciones de los dos extremos (FR-021).
      table2 = renameFieldInKeys(table2, field, next.name)
      model2 = withRelations(
        model,
        renameFieldInRelations(model.relations ?? [], table, field, next.name),
      )
    }

    // El paso de historial guarda el modelo de antes, `state.model`: pasar
    // `model2` dejaba las relaciones renombradas dentro del paso y deshacer
    // devolvía el nombre viejo del campo con la relación ya cambiada.
    set(pushHistory(state, replaceTable(model2, table, table2), UPDATE_FIELD_LABEL, coalesceKey))
    if (renamed) {
      const { focusedCell } = get()
      if (focusedCell?.field === field) {
        set({ focusedCell: { field: next.name, column: focusedCell.column } })
      }
    }
    return null
  },

  /**
   * Sube o baja un campo dentro de su tabla (FR-014).
   *
   * @param table Nombre técnico de la tabla.
   * @param field Nombre técnico del campo.
   * @param offset `-1` para subirlo, `+1` para bajarlo.
   */
  moveFieldBy(table, field, offset) {
    const state = get()
    const { model } = state
    if (model === null) return
    const current = tablesOf(model).find((item) => item.name === table)
    if (current === undefined) return
    const index = current.fields.findIndex((item) => item.name === field)
    const target = index + offset
    if (index === -1 || target < 0 || target >= current.fields.length) return

    const fields = [...current.fields]
    const [moved] = fields.splice(index, 1)
    if (moved === undefined) return
    fields.splice(target, 0, moved)

    set(
      pushHistory(state, replaceTable(model, table, withFields(current, fields)), MOVE_FIELD_LABEL),
    )
  },

  /**
   * Elimina un campo, sus marcas y las relaciones que lo usaban (FR-019,
   * FR-020).
   *
   * No elimina el último campo de la tabla: el archivo exige al menos uno. La
   * confirmación de las relaciones la pide la pantalla antes de llamar.
   *
   * @param table Nombre técnico de la tabla.
   * @param field Nombre técnico del campo.
   */
  deleteField(table, field) {
    const state = get()
    const { model } = state
    if (model === null) return
    const current = tablesOf(model).find((item) => item.name === table)
    if (current === undefined) return
    if (current.fields.length <= 1) return
    if (current.fields.every((item) => item.name !== field)) return

    const next = withRelations(
      replaceTable(model, table, removeFieldFromKeys(current, field)),
      (model.relations ?? []).filter(
        (relation) =>
          !(relation.fromTable === table && relation.fromFields.includes(field)) &&
          !(relation.toTable === table && relation.toFields.includes(field)),
      ),
    )

    set({
      ...pushHistory(state, next, DELETE_FIELD_LABEL),
      deleteFieldTarget: null,
      ...(get().focusedCell?.field === field ? { focusedCell: null } : {}),
      ...(get().dialog === 'delete-field' ? { dialog: null } : {}),
    })
  },

  /**
   * Marca un campo como llave primaria, única o ninguna (FR-025, FR-026).
   *
   * `PK` añade el campo a la llave primaria —que puede ser de varios campos— y
   * lo deja no nulo. `UK` crea el único `uq_<tabla>_<campo>`. Un único de
   * varios campos no se toca: eso se edita en su propia sección, de otro
   * incremento (research R12).
   *
   * @param table Nombre técnico de la tabla.
   * @param field Nombre técnico del campo.
   * @param key Marca que se quiere, o `null` para quitarla.
   */
  setFieldKey(table, field, key) {
    const state = get()
    const { model } = state
    if (model === null) return
    const current = tablesOf(model).find((item) => item.name === table)
    if (current === undefined) return
    if (current.fields.every((item) => item.name !== field)) return

    const next: Table = { ...current }
    const uniqueName = `uq_${table}_${field}`

    const primaryKey = (current.primaryKey ?? []).filter((item) => item !== field)
    const uniques = (current.uniques ?? []).filter(
      (item) => !(item.fields.length === 1 && item.fields[0] === field),
    )

    if (key === 'PK') {
      next.primaryKey = [...primaryKey, field]
      next.fields = current.fields.map((item) => {
        if (item.name !== field) return item
        const field2: Field = { ...item }
        delete field2.nullable
        return field2
      })
    } else if (primaryKey.length === 0) delete next.primaryKey
    else next.primaryKey = primaryKey

    if (key === 'UK') next.uniques = [...uniques, { name: uniqueName, fields: [field] }]
    else if (uniques.length === 0) delete next.uniques
    else next.uniques = uniques

    set(pushHistory(state, replaceTable(model, table, next), SET_FIELD_KEY_LABEL))
  },

  /**
   * Añade los campos de una plantilla que falten (FR-027, FR-028).
   *
   * Si ya están todos no hace nada: ni paso de historial ni «Editado».
   *
   * @param table Nombre técnico de la tabla.
   * @param template Clave del grupo.
   */
  applyTemplate(table, template) {
    const state = get()
    const { model } = state
    if (model === null) return
    const current = tablesOf(model).find((item) => item.name === table)
    if (current === undefined) return
    const group = templatesOf(model.engine).find((item) => item.key === template)
    if (group === undefined) return

    const taken = new Set(current.fields.map((field) => field.name))
    const missing = group.fields.filter((field) => !taken.has(field.name))
    if (missing.length === 0) return

    set(
      pushHistory(
        state,
        replaceTable(model, table, withFields(current, [...current.fields, ...missing])),
        APPLY_TEMPLATE_LABEL,
      ),
    )
    const first = missing[0]
    if (first !== undefined) get().openFieldsPanel(table, { field: first.name, column: 'name' })
  },
})
