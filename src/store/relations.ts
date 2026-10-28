import {
  foreignKeyTargets,
  proposeForeignKey,
  relationName,
} from '@/lib/model/relations'
import { DEFAULT_REFERENTIAL_ACTION } from '@/lib/model/types'
import type { Field, Model, ReferentialAction, Relation, Table } from '@/lib/model/types'
import { pushHistory } from '@/store/model'
import {
  renameFieldInKeys,
  renameFieldInRelations,
  replaceTable,
  tablesOf,
  withRelations,
} from '@/store/tables'
import type { AppSlice } from '@/store/types'

/**
 * Parte de las claves foráneas: crearlas, cambiarlas, regularlas y
 * eliminarlas (FR-004 a FR-012, FR-028 a FR-036).
 *
 * Vive en su propia parte del almacén y no en la de las tablas porque es otro
 * dominio de estado —la relación es del modelo, no de una tabla—, y porque así
 * las seis acciones se leen juntas. Todas escriben por el historial del
 * Incremento 1: cada una es **un** paso deshacible con su etiqueta y deja el
 * modelo «Editado» (contracts/relations.md §2).
 */

/** Etiqueta del paso de crear o editar una clave foránea (FR-012). */
export const EDIT_FOREIGN_KEY_LABEL = 'editar la clave foránea'

/** Etiqueta del paso de cambiar una regla referencial (FR-012). */
export const REFERENTIAL_ACTION_LABEL = 'cambiar ON DELETE / UPDATE'

/** Etiqueta del paso de eliminar una clave foránea (FR-012). */
export const DELETE_FOREIGN_KEY_LABEL = 'eliminar la clave foránea'

/** Etiqueta del paso de quitar el «no nulo» de una columna (FR-030). */
export const CLEAR_NOT_NULL_LABEL = 'editar el campo'

/** Lo que se dice cuando ninguna tabla sirve de destino (FR-005). */
export const NO_TARGET_ERROR =
  'Ninguna tabla tiene llave primaria de una sola columna. Define una en la ficha «Campos».'

/** Lo que se pide cuando ninguna tabla está seleccionada (FR-002). */
export const NO_SELECTION_MESSAGE = 'Selecciona la tabla que tendrá la clave foránea.'

/**
 * Lo que se dice al abrir la ficha desde la barra superior o con `R` (§6).
 *
 * @param table Tabla que llevará la clave foránea.
 */
export function addForeignKeyNotice(table: string): string {
  return `Agrega la clave foránea de ${table}.`
}

/** Lo que se dice cuando la columna sería el campo al que apunta (FR-009a). */
export const SELF_COLUMN_ERROR = 'La columna no puede ser el mismo campo al que apunta.'

/** Las relaciones del modelo, que es la lista que estas acciones reescriben. */
function relationsOf(model: Model): Relation[] {
  return model.relations ?? []
}

/** El modelo con una relación cambiada por otra, dejando el orden intacto. */
function replaceRelation(model: Model, name: string, next: Relation): Model {
  return withRelations(
    model,
    relationsOf(model).map((relation) => (relation.name === name ? next : relation)),
  )
}

/**
 * Si la columna conserva el nombre que el patrón le puso (FR-007).
 *
 * Se compara con el nombre que el patrón daría para el destino **anterior**,
 * con y sin el sufijo numérico que FR-004 añade cuando choca: si coincide, el
 * usuario no la ha tocado y se puede renombrar al cambiar de destino; si no,
 * se respeta tal cual.
 */
function keepsPatternName(
  name: string,
  pattern: string,
  table: string,
  key: string | undefined,
): boolean {
  if (key === undefined) return false
  const base = pattern.replace('{tabla}', table).replace('{pk}', key)
  if (name === base) return true
  return name.startsWith(`${base}_`) && /^\d+$/.test(name.slice(base.length + 1))
}

/** La llave primaria de una tabla, si es de una sola columna. */
function singleKeyOf(table: Table | undefined): string | undefined {
  const key = table?.primaryKey ?? []
  return key.length === 1 ? key[0] : undefined
}

/** Estado y acciones de la parte de las claves foráneas. */
export interface RelationsSlice {
  requestForeignKey: (table?: string) => void
  addForeignKey: (table: string, target?: string) => string | null
  setForeignKeyColumn: (name: string, field: string) => string | null
  setForeignKeyTarget: (name: string, table: string) => void
  setReferentialAction: (
    name: string,
    key: 'onDelete' | 'onUpdate',
    action: ReferentialAction,
  ) => void
  deleteForeignKey: (name: string) => void
  clearNotNull: (table: string, field: string) => void
}

/**
 * Crea la parte de las claves foráneas.
 *
 * @param set Escritura del almacén compuesto.
 * @param get Lectura del almacén compuesto.
 */
export const createRelationsSlice: AppSlice<RelationsSlice> = (set, get) => ({
  /**
   * Abre la ficha «Claves foráneas» de una tabla (FR-001 a FR-003).
   *
   * Es la puerta que comparten las tres vías de entrada: el botón «Relación»
   * de la barra superior, la tecla `R` y «Nueva clave foránea…» del menú de la
   * tarjeta. No crea nada: deja la ficha a la vista con la tabla ya elegida y
   * dice lo que toca hacer allí. Sin tabla —ni la del parámetro ni la
   * seleccionada— solo pide elegirla, y el modelo no cambia (FR-002).
   *
   * @param table Tabla que llevará la clave foránea; sin ella, la seleccionada.
   */
  requestForeignKey(table) {
    const state = get()
    const name = table ?? state.selectedTable
    if (name === null) {
      state.showNotice(NO_SELECTION_MESSAGE)
      return
    }
    if (state.selectedTable !== name) state.selectTable(name)
    state.openFieldsPanel(name, undefined, 'foreignKeys')
    state.showNotice(addForeignKeyNotice(name))
  },

  /**
   * Crea la columna propuesta y la relación que la usa (FR-004, FR-005).
   *
   * Sin `target`, el destino es la primera tabla a la que esta todavía no
   * apunta y, si no queda ninguna, la propia tabla. La relación nace con las
   * dos reglas en `no_action`, que es el valor por defecto y por eso no se
   * escribe en el archivo. El foco queda en la celda «Referencia» de la fila
   * nueva, que es lo siguiente que el usuario va a querer cambiar.
   *
   * @param table Tabla que llevará la clave foránea.
   * @param target Tabla destino, si ya se sabe.
   * @returns El motivo por el que no se pudo crear, o `null` si se creó.
   */
  addForeignKey(table, target) {
    const state = get()
    const { model } = state
    if (model === null) return NO_TARGET_ERROR
    const source = tablesOf(model).find((item) => item.name === table)
    if (source === undefined) return NO_TARGET_ERROR

    const candidates = foreignKeyTargets(model, table)
    let chosen: string | undefined = target
    if (chosen !== undefined) {
      const asked = candidates.find((candidate) => candidate.name === chosen)
      if (asked === undefined) return NO_TARGET_ERROR
      if (!asked.enabled) return asked.reason ?? NO_TARGET_ERROR
    } else {
      const pointed = new Set(
        relationsOf(model)
          .filter((relation) => relation.fromTable === table)
          .map((relation) => relation.toTable),
      )
      const free = candidates.find(
        (candidate) => candidate.enabled && candidate.name !== table && !pointed.has(candidate.name),
      )
      const own = candidates.find((candidate) => candidate.name === table && candidate.enabled)
      const any = candidates.find((candidate) => candidate.enabled)
      chosen = (free ?? own ?? any)?.name
      if (chosen === undefined) return NO_TARGET_ERROR
    }

    const pattern = state.preferences.foreignKeyPattern
    const proposal = proposeForeignKey(model, table, chosen, pattern)
    if (proposal === null) return NO_TARGET_ERROR

    // Una relación hacia la propia tabla no puede usar como columna el campo
    // al que apunta, así que la columna propuesta nunca es la llave primaria
    // (FR-009a); el nombre del patrón ya la distingue.
    const next: Relation = {
      name: relationName(
        table,
        proposal.field.name,
        relationsOf(model).map((relation) => relation.name),
      ),
      fromTable: table,
      fromFields: [proposal.field.name],
      toTable: chosen,
      toFields: [proposal.toField],
    }

    const withColumn = replaceTable(model, table, {
      ...source,
      fields: [...source.fields, proposal.field],
    })

    set(
      pushHistory(
        state,
        withRelations(withColumn, [...relationsOf(withColumn), next]),
        EDIT_FOREIGN_KEY_LABEL,
      ),
    )
    get().openFieldsPanel(table, { field: next.name, column: 'reference' }, 'foreignKeys')
    return null
  },

  /**
   * Cambia la columna que lleva la clave foránea (FR-008, FR-009a).
   *
   * No escribe ninguna marca: `fieldMarks` deduce la FK de la relación, así
   * que la marca se recoloca sola al cambiar `fromFields`.
   *
   * @param name Nombre técnico de la relación.
   * @param field Campo de la tabla que llevará la clave.
   * @returns El motivo del rechazo, o `null` si se guardó.
   */
  setForeignKeyColumn(name, field) {
    const state = get()
    const { model } = state
    if (model === null) return null
    const relation = relationsOf(model).find((item) => item.name === name)
    if (relation === undefined) return null
    if (relation.fromFields.length !== 1) return null
    if (relation.fromFields[0] === field) return null

    const source = tablesOf(model).find((item) => item.name === relation.fromTable)
    if (source === undefined || !source.fields.some((item) => item.name === field)) return null
    if (relation.fromTable === relation.toTable && relation.toFields.includes(field)) {
      return SELF_COLUMN_ERROR
    }

    set(
      pushHistory(
        state,
        replaceRelation(model, name, { ...relation, fromFields: [field] }),
        EDIT_FOREIGN_KEY_LABEL,
      ),
    )
    return null
  },

  /**
   * Cambia la tabla referenciada (FR-007).
   *
   * Apunta la relación a la llave primaria de la tabla nueva y, solo si la
   * columna conserva el nombre que el patrón le había puesto, la renombra y la
   * retipa; si el usuario ya la había renombrado, se queda como está.
   *
   * @param name Nombre técnico de la relación.
   * @param table Tabla destino nueva.
   */
  setForeignKeyTarget(name, table) {
    const state = get()
    const { model } = state
    if (model === null) return
    const relation = relationsOf(model).find((item) => item.name === name)
    if (relation === undefined || relation.toTable === table) return
    if (relation.fromFields.length !== 1) return

    const tables = tablesOf(model)
    const target = tables.find((item) => item.name === table)
    const source = tables.find((item) => item.name === relation.fromTable)
    const key = singleKeyOf(target)
    if (target === undefined || source === undefined || key === undefined) return

    const column = relation.fromFields[0] as string
    const generated = keepsPatternName(
      column,
      state.preferences.foreignKeyPattern,
      relation.toTable,
      singleKeyOf(tables.find((item) => item.name === relation.toTable)),
    )
    const proposal = generated
      ? proposeForeignKey(model, relation.fromTable, table, state.preferences.foreignKeyPattern)
      : null

    let next: Model = model
    let fromFields = relation.fromFields

    if (proposal !== null) {
      const keyField = target.fields.find((item) => item.name === key)
      const renamed: Field = {
        ...(source.fields.find((item) => item.name === column) as Field),
        name: proposal.field.name,
        type: proposal.field.type,
      }
      if (proposal.field.length === undefined) delete renamed.length
      else renamed.length = proposal.field.length
      if (keyField?.scale === undefined) delete renamed.scale
      else renamed.scale = keyField.scale

      const table2 = renameFieldInKeys(
        {
          ...source,
          fields: source.fields.map((item) => (item.name === column ? renamed : item)),
        },
        column,
        renamed.name,
      )
      next = replaceTable(model, source.name, table2)
      next = withRelations(
        next,
        renameFieldInRelations(relationsOf(next), source.name, column, renamed.name),
      )
      fromFields = [renamed.name]
    }

    const current = relationsOf(next).find((item) => item.name === name) as Relation
    set(
      pushHistory(
        state,
        replaceRelation(next, name, {
          ...current,
          fromFields,
          toTable: table,
          toFields: [key],
        }),
        EDIT_FOREIGN_KEY_LABEL,
      ),
    )
  },

  /**
   * Escribe ON DELETE o ON UPDATE (FR-028, FR-030).
   *
   * `no_action` es el valor por defecto del formato, así que la clave se quita
   * del archivo en lugar de escribirse. No valida contra el «no nulo» de la
   * columna: eso lo avisa la pantalla y no bloquea el guardado.
   *
   * @param name Nombre técnico de la relación.
   * @param key Cuál de las dos reglas.
   * @param action Acción elegida.
   */
  setReferentialAction(name, key, action) {
    const state = get()
    const { model } = state
    if (model === null) return
    const relation = relationsOf(model).find((item) => item.name === name)
    if (relation === undefined) return
    if ((relation[key] ?? DEFAULT_REFERENTIAL_ACTION) === action) return

    const next: Relation = { ...relation }
    if (action === DEFAULT_REFERENTIAL_ACTION) delete next[key]
    else next[key] = action

    set(pushHistory(state, replaceRelation(model, name, next), REFERENTIAL_ACTION_LABEL))
  },

  /**
   * Elimina una clave foránea y conserva su columna (FR-035, FR-036).
   *
   * La columna se queda con su nombre, su tipo y sus demás propiedades: solo
   * pierde la marca FK, y únicamente si ninguna otra relación la usa, porque
   * la marca se deduce de las relaciones.
   *
   * @param name Nombre técnico de la relación.
   */
  deleteForeignKey(name) {
    const state = get()
    const { model } = state
    if (model === null) return
    if (!relationsOf(model).some((relation) => relation.name === name)) return

    set(
      pushHistory(
        state,
        withRelations(
          model,
          relationsOf(model).filter((relation) => relation.name !== name),
        ),
        DELETE_FOREIGN_KEY_LABEL,
      ),
    )
  },

  /**
   * Quita el «no nulo» de una columna (FR-030).
   *
   * Es la salida del aviso de SET NULL: la regla se guarda igual, y esto es lo
   * que hace que pueda aplicarse. Entra en el historial con la etiqueta de
   * editar el campo, porque es exactamente eso.
   *
   * @param table Tabla de la columna.
   * @param field Nombre de la columna.
   */
  clearNotNull(table, field) {
    const state = get()
    const { model } = state
    if (model === null) return
    const current = tablesOf(model).find((item) => item.name === table)
    const target = current?.fields.find((item) => item.name === field)
    if (current === undefined || target === undefined) return
    if (target.nullable === true) return
    // La llave primaria no admite nulos: ahí el aviso no tiene esta salida.
    if ((current.primaryKey ?? []).includes(field)) return

    set(
      pushHistory(
        state,
        replaceTable(model, table, {
          ...current,
          fields: current.fields.map((item) =>
            item.name === field ? { ...item, nullable: true } : item,
          ),
        }),
        CLEAR_NOT_NULL_LABEL,
      ),
    )
  },
})
