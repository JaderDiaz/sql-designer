/**
 * Paleta de colores de los esquemas (FR-021).
 *
 * En el archivo del modelo viaja el identificador, nunca el valor del color:
 * el valor sale del token `--<id>` de `src/styles/tokens.css`, de modo que el
 * mismo esquema se ve bien en tema claro y en tema oscuro sin que el archivo
 * sepa nada de temas (principio V de la constitución).
 */

/** Un color de la paleta: lo que viaja al archivo y lo que se lee en pantalla. */
export interface SchemaColor {
  /** Identificador que se escribe en el archivo y nombra al token. */
  id: string
  /** Nombre con el que se ofrece al usuario. */
  label: string
}

/** Los once colores de la paleta, en el orden en que se muestran. */
export const SCHEMA_COLORS: readonly SchemaColor[] = [
  { id: 'gray', label: 'Grafito' },
  { id: 'blue', label: 'Azul' },
  { id: 'indigo', label: 'Índigo' },
  { id: 'purple', label: 'Morado' },
  { id: 'pink', label: 'Rosa' },
  { id: 'red', label: 'Rojo' },
  { id: 'orange', label: 'Naranja' },
  { id: 'yellow', label: 'Amarillo' },
  { id: 'brown', label: 'Marrón' },
  { id: 'green', label: 'Verde' },
  { id: 'teal', label: 'Teal' },
]

/** Color de un esquema que no eligió ninguno, y destino de uno desconocido. */
export const DEFAULT_SCHEMA_COLOR = 'indigo'

/**
 * Resuelve el color de un esquema contra la paleta (FR-021).
 *
 * Un archivo escrito por una versión más nueva puede traer un identificador
 * que aquí no existe todavía: eso no invalida el modelo, se dibuja con el
 * color por defecto y el archivo conserva lo que traía.
 *
 * @param color Identificador que trae el esquema, o `undefined` si no trae.
 * @returns El identificador si está en la paleta, {@link DEFAULT_SCHEMA_COLOR}
 * si no.
 */
export function resolveSchemaColor(color: string | undefined): string {
  if (color === undefined) return DEFAULT_SCHEMA_COLOR
  return SCHEMA_COLORS.some((entry) => entry.id === color) ? color : DEFAULT_SCHEMA_COLOR
}

/**
 * Nombre con el que se lee un color de la paleta.
 *
 * @param color Identificador del color.
 * @returns El nombre del color, o el del color por defecto si no está.
 */
export function schemaColorLabel(color: string | undefined): string {
  const id = resolveSchemaColor(color)
  return SCHEMA_COLORS.find((entry) => entry.id === id)?.label ?? id
}
