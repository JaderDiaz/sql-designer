/**
 * Formato de fechas y tamaños en español, tal como los escribe el lienzo:
 * «Hoy, 9:12 a. m.», «Ayer», «20 oct 2026» y «28 KB».
 *
 * Todo pasa por `Intl` con la configuración `es`, para que los nombres de mes
 * y el separador decimal salgan del sistema y no de una tabla a mano (RS-12).
 */

/** Hora de un instante del día de hoy: «9:12 a. m.». */
const TIME = new Intl.DateTimeFormat('es', { hour: 'numeric', minute: '2-digit' })

/** Fecha de un día de este año o de otro: «20 oct 2026». */
const DATE = new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short', year: 'numeric' })

/** Milisegundos de un día. */
const DAY_MS = 86_400_000

/**
 * ¿Son el mismo día natural?
 *
 * @param left Un instante.
 * @param right El otro instante.
 */
function isSameDay(left: Date, right: Date): boolean {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  )
}

/**
 * Fecha de modificación como la escribe el lienzo.
 *
 * @param millis Instante en milisegundos desde la época.
 * @param now Instante que se toma como «ahora»; las pruebas lo fijan.
 */
export function formatModified(millis: number, now: number = Date.now()): string {
  if (!Number.isFinite(millis) || millis <= 0) return '—'
  const date = new Date(millis)
  const today = new Date(now)

  if (isSameDay(date, today)) return `Hoy, ${TIME.format(date)}`
  if (isSameDay(date, new Date(now - DAY_MS))) return 'Ayer'
  return DATE.format(date)
}

/**
 * Tamaño del archivo en la unidad que le queda corta: «940 bytes», «28 KB».
 *
 * @param bytes Tamaño en bytes.
 */
export function formatSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '—'
  if (bytes < 1024) return `${bytes} ${bytes === 1 ? 'byte' : 'bytes'}`
  const kilobytes = bytes / 1024
  if (kilobytes < 1024) return `${Math.round(kilobytes)} KB`
  return `${(kilobytes / 1024).toLocaleString('es', { maximumFractionDigits: 1 })} MB`
}
