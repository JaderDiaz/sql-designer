import { schemaZones } from '@/lib/canvas/geometry'
import { resolveLayout } from '@/lib/canvas/layout'
import type { Model, Position, Schema } from '@/lib/model/types'
import { isSameModel } from '@/store/model'
import type { AppSlice } from '@/store/types'

/**
 * Parte de los esquemas: crear, editar, eliminar y mover.
 *
 * Las cuatro cambian el modelo en memoria, lo dejan «Editado» y entran en el
 * historial del Incremento 1 con su etiqueta, de modo que ⌘Z deshace el gesto
 * entero en un paso y el aviso dice qué se deshizo (FR-022, FR-027, FR-037,
 * RS-06). Ninguna escribe en el disco: eso lo hace Guardar (RS-07).
 */

/** Lo que el diálogo de esquema entrega, ya validado por él (FR-018). */
export interface SchemaDraft {
  /** Nombre técnico, único en el modelo (RS-03). */
  name: string
  /** Tres letras mayúsculas, únicas en el modelo (RS-04). */
  abbreviation: string
  /** Identificador de la paleta (FR-021). */
  color: string
  /** Descripción libre. */
  comment?: string
}

/** Qué hacer con las tablas del esquema que se elimina (FR-034, FR-036). */
export interface DeleteSchemaOptions {
  /** Si se eliminan también sus tablas, enums y vistas. */
  withTables: boolean
  /** Esquema de destino cuando no se eliminan: a dónde se mueven. */
  target: string | null
}

/** Etiqueta del paso de crear, la que se dice al deshacer (RS-06). */
export const CREATE_SCHEMA_LABEL = 'crear el esquema'

/** Etiqueta del paso de editar. */
export const UPDATE_SCHEMA_LABEL = 'editar el esquema'

/** Etiqueta del paso de eliminar. */
export const DELETE_SCHEMA_LABEL = 'eliminar el esquema'

/** Etiqueta del paso de mover la zona de un esquema sin tablas. */
export const MOVE_SCHEMA_LABEL = 'mover el esquema'

/** Etiqueta del paso de mover un esquema con sus tablas. */
export const MOVE_SCHEMA_TABLES_LABEL = 'mover las tablas del esquema'

/** Estado y acciones de la parte de los esquemas. */
export interface SchemasSlice {
  createSchema: (draft: SchemaDraft) => void
  updateSchema: (name: string, draft: SchemaDraft) => void
  deleteSchema: (name: string, options: DeleteSchemaOptions) => void
  moveSchema: (name: string, delta: Position) => void
}

/** Un esquema a partir de su borrador, sin claves vacías. */
function fromDraft(draft: SchemaDraft, position?: Position): Schema {
  const comment = draft.comment?.trim()
  return {
    name: draft.name,
    abbreviation: draft.abbreviation,
    color: draft.color,
    ...(position ? { position } : {}),
    ...(comment !== undefined && comment !== '' ? { comment } : {}),
  }
}

/** El mismo esquema sin su posición guardada. */
function omitPosition(schema: Schema): Schema {
  const next: Schema = { ...schema }
  delete next.position
  return next
}

/** Cambia el esquema al que apunta cada tabla, enum y vista que lo nombraba. */
function renameSchemaReferences(model: Model, from: string, to: string): Model {
  if (from === to) return model
  const move = <TItem extends { schema: string }>(items: TItem[] | undefined) =>
    items?.map((item) => (item.schema === from ? { ...item, schema: to } : item))

  return {
    ...model,
    ...(model.tables ? { tables: move(model.tables) ?? model.tables } : {}),
    ...(model.enums ? { enums: move(model.enums) ?? model.enums } : {}),
    ...(model.views ? { views: move(model.views) ?? model.views } : {}),
  }
}

/**
 * Crea la parte de los esquemas.
 *
 * @param set Escritura del almacén compuesto.
 * @param get Lectura del almacén compuesto.
 */
export const createSchemasSlice: AppSlice<SchemasSlice> = (set, get) => ({
  /**
   * Añade un esquema al final del modelo (FR-015 a FR-022).
   *
   * El diálogo ya comprobó que el nombre técnico y la abreviatura no estén
   * repetidos (FR-018); aquí se vuelve a comprobar para no escribir un modelo
   * inválido si alguna vía llamara sin validar.
   *
   * @param draft Nombre técnico, abreviatura, color y descripción.
   */
  createSchema(draft) {
    const { model, savedModel, past } = get()
    if (model === null) return
    const repeated = model.schemas.some(
      (schema) => schema.name === draft.name || schema.abbreviation === draft.abbreviation,
    )
    if (repeated) return

    const next: Model = { ...model, schemas: [...model.schemas, fromDraft(draft)] }
    set({
      model: next,
      past: [...past, { model, label: CREATE_SCHEMA_LABEL }],
      future: [],
      isDirty: !isSameModel(next, savedModel),
      selectedSchema: draft.name,
    })
  },

  /**
   * Cambia los campos de un esquema existente (FR-020, FR-022).
   *
   * Si el nombre técnico cambia, se propaga a las tablas, los enums y las
   * vistas de ese esquema, porque el nombre es la única referencia que tienen.
   * La posición de la zona se conserva: moverla y editarla son dos cosas
   * distintas.
   *
   * @param name Nombre técnico actual del esquema.
   * @param draft Valores nuevos, ya validados por el diálogo.
   */
  updateSchema(name, draft) {
    const { model, savedModel, past, focusedSchema, selectedSchema } = get()
    if (model === null) return
    const current = model.schemas.find((schema) => schema.name === name)
    if (current === undefined) return
    const repeated = model.schemas.some(
      (schema) =>
        schema.name !== name &&
        (schema.name === draft.name || schema.abbreviation === draft.abbreviation),
    )
    if (repeated) return

    const renamed = renameSchemaReferences(model, name, draft.name)
    const next: Model = {
      ...renamed,
      schemas: renamed.schemas.map((schema) =>
        schema.name === name ? fromDraft(draft, current.position) : schema,
      ),
    }
    set({
      model: next,
      past: [...past, { model, label: UPDATE_SCHEMA_LABEL }],
      future: [],
      isDirty: !isSameModel(next, savedModel),
      // El esquema sigue siendo el mismo objeto aunque haya cambiado de
      // nombre: el foco y la selección lo siguen.
      focusedSchema: focusedSchema === name ? draft.name : focusedSchema,
      selectedSchema: selectedSchema === name ? draft.name : selectedSchema,
    })
  },

  /**
   * Elimina un esquema, con sus tablas o moviéndolas a otro (FR-033 a FR-037).
   *
   * El último esquema del modelo no se elimina: un modelo necesita al menos
   * uno (RS-02, FR-035). Con `withTables` se van también sus enums, sus vistas
   * y las relaciones que tocaban a sus tablas, porque una relación sin sus dos
   * extremos no es nada.
   *
   * @param name Nombre técnico del esquema.
   * @param options Si se eliminan sus tablas y, si no, a qué esquema pasan.
   */
  deleteSchema(name, options) {
    const { model, savedModel, past, focusedSchema, selectedSchema } = get()
    if (model === null) return
    if (model.schemas.length <= 1) return
    if (model.schemas.every((schema) => schema.name !== name)) return

    let next: Model
    if (options.withTables) {
      const doomed = new Set(
        (model.tables ?? []).filter((table) => table.schema === name).map((table) => table.name),
      )
      const tables = model.tables?.filter((table) => table.schema !== name)
      const enums = model.enums?.filter((value) => value.schema !== name)
      const views = model.views?.filter(
        (view) => view.schema !== name && !view.tables.some((table) => doomed.has(table)),
      )
      const relations = model.relations?.filter(
        (relation) => !doomed.has(relation.fromTable) && !doomed.has(relation.toTable),
      )
      next = {
        ...model,
        schemas: model.schemas.filter((schema) => schema.name !== name),
        ...(enums ? { enums } : {}),
        ...(tables ? { tables } : {}),
        ...(relations ? { relations } : {}),
        ...(views ? { views } : {}),
      }
    } else {
      const target = options.target
      if (target === null || model.schemas.every((schema) => schema.name !== target)) return
      const moved = renameSchemaReferences(model, name, target)
      next = { ...moved, schemas: moved.schemas.filter((schema) => schema.name !== name) }
    }

    set({
      model: next,
      past: [...past, { model, label: DELETE_SCHEMA_LABEL }],
      future: [],
      isDirty: !isSameModel(next, savedModel),
      // El esquema enfocado o seleccionado ya no existe (FR-032).
      focusedSchema: focusedSchema === name ? null : focusedSchema,
      selectedSchema: selectedSchema === name ? null : selectedSchema,
    })
  },

  /**
   * Mueve un esquema por el lienzo, un gesto entero en un paso (FR-026,
   * FR-026a, FR-027).
   *
   * Con tablas, el desplazamiento se suma a la posición de cada una
   * —resolviendo primero las que el archivo no traía, para que la zona entera
   * se mueva igual— y la posición del esquema se borra, porque deja de
   * aplicar. Sin tablas, se escribe la posición del esquema.
   *
   * @param name Nombre técnico del esquema.
   * @param delta Desplazamiento del gesto, en coordenadas del modelo.
   */
  moveSchema(name, delta) {
    const { model, savedModel, past } = get()
    if (model === null) return
    if (model.schemas.every((schema) => schema.name !== name)) return
    if (delta.x === 0 && delta.y === 0) return

    const layout = resolveLayout(model)
    const own = (model.tables ?? []).filter((table) => table.schema === name)

    if (own.length === 0) {
      const zone = schemaZones(model, layout).find((candidate) => candidate.schema === name)
      if (zone === undefined) return
      const position = { x: zone.rect.x + delta.x, y: zone.rect.y + delta.y }
      const next: Model = {
        ...model,
        schemas: model.schemas.map((schema) =>
          schema.name === name ? { ...schema, position } : schema,
        ),
      }
      set({
        model: next,
        past: [...past, { model, label: MOVE_SCHEMA_LABEL }],
        future: [],
        isDirty: !isSameModel(next, savedModel),
      })
      return
    }

    const next: Model = {
      ...model,
      schemas: model.schemas.map((schema) => {
        if (schema.name !== name || schema.position === undefined) return schema
        // La posición del esquema deja de aplicar en cuanto tiene tablas: la
        // zona pasa a deducirse de ellas (FR-026a).
        return omitPosition(schema)
      }),
      tables: (model.tables ?? []).map((table) => {
        if (table.schema !== name) return table
        const base = table.position ?? layout.get(table.name) ?? { x: 0, y: 0 }
        return { ...table, position: { x: base.x + delta.x, y: base.y + delta.y } }
      }),
    }
    set({
      model: next,
      past: [...past, { model, label: MOVE_SCHEMA_TABLES_LABEL }],
      future: [],
      isDirty: !isSameModel(next, savedModel),
    })
  },
})
