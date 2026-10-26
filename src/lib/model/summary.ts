import { parseModel } from '@/lib/model/parse'
import { ENGINE_LABELS, type Engine } from '@/lib/model/types'
import type { ValidationIssue } from '@/lib/model/validate'

/**
 * Resumen de un archivo de modelo para la vista previa de Abrir modelo y para
 * las filas de Recientes (FR-013, FR-031).
 *
 * No hay un segundo lector del formato: esto se apoya en `parse.ts`
 * (principio II). Lo que no sale del archivo —tamaño y fecha— lo trae el
 * sello de `model_read`.
 */

/** Datos de un archivo de modelo tal como se muestran en la vista previa. */
export interface ModelPreview {
  /** Nombre legible del modelo, o el del archivo si no se pudo leer. */
  name: string
  /** Nombre del archivo con su extensión. */
  fileName: string
  /** Motor del modelo, o `null` si el archivo no es válido. */
  engine: Engine | null
  tables: number
  relations: number
  sizeBytes: number
  modifiedMs: number
  invalid: boolean
  /** Primer fallo del archivo, para el diálogo de archivo con errores. */
  error: ValidationIssue | null
}

/** Lo que hace falta para resumir un archivo ya leído. */
export interface SummaryInput {
  /** Ruta del archivo, de la que sale el nombre que se muestra. */
  path: string
  /** Texto completo tal como lo devolvió `model_read`. */
  text: string
  sizeBytes: number
  modifiedMs: number
}

/**
 * Nombre del archivo de una ruta, con los dos separadores en juego.
 *
 * @param path Ruta absoluta del archivo.
 */
export function fileNameOf(path: string): string {
  const parts = path.split(/[/\\]/)
  return parts[parts.length - 1] ?? path
}

/**
 * Carpeta que contiene una ruta, sin barra final.
 *
 * @param path Ruta absoluta del archivo.
 */
export function folderOf(path: string): string {
  const cut = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'))
  return cut <= 0 ? path.slice(0, cut + 1) : path.slice(0, cut)
}

/**
 * Resume un archivo de modelo ya leído.
 *
 * Un archivo roto no es una excepción: vuelve con `invalid: true` y el primer
 * fallo con su línea, que es lo que pinta la vista previa y lo que dice el
 * diálogo de archivo con errores (FR-015, FR-016).
 *
 * @param input Ruta, texto y sello del archivo.
 */
export function summarizeModel(input: SummaryInput): ModelPreview {
  const fileName = fileNameOf(input.path)
  const base = {
    fileName,
    sizeBytes: input.sizeBytes,
    modifiedMs: input.modifiedMs,
  }
  const result = parseModel(input.text)

  if (!result.ok) {
    return {
      ...base,
      name: fileName,
      engine: null,
      tables: 0,
      relations: 0,
      invalid: true,
      error: result.errors[0] ?? null,
    }
  }

  return {
    ...base,
    name: result.model.name,
    engine: result.model.engine,
    tables: result.model.tables?.length ?? 0,
    relations: result.model.relations?.length ?? 0,
    invalid: false,
    error: null,
  }
}

/**
 * Línea que resume el modelo bajo su nombre: «PostgreSQL · 6 tablas».
 *
 * @param engine Motor del modelo, o `null` si no se pudo leer.
 * @param tables Número de tablas.
 */
export function previewLine(engine: Engine | null, tables: number): string {
  const label = engine === null ? 'Modelo' : ENGINE_LABELS[engine]
  return `${label} · ${tables === 1 ? '1 tabla' : `${tables} tablas`}`
}
