/**
 * Marcas de tiempo del lado de la interfaz para la verificación manual de
 * `specs/001-base-aplicacion/quickstart.md`.
 *
 * Aquí solo se guarda el instante de la última elección de tema; quien decide
 * si eso llega al registro es el binario, que calla salvo que se arranque con
 * `SQL_DESIGNER_MEDIR=1`.
 */

/** Instante de la última elección de tema, o `null` si ya se consumió. */
let themeChangeAt: number | null = null

/** Marca el momento en que se elige un tema en Ajustes (SC-003). */
export function markThemeChange(): void {
  themeChangeAt = performance.now()
}

/**
 * Consume la marca pendiente y devuelve lo que ha tardado el cambio.
 *
 * @returns Milisegundos desde la elección, o `null` si no había marca: así el
 * tema que cambia por el sistema, y no por Ajustes, no cuenta como medida.
 */
export function takeThemeChange(): number | null {
  if (themeChangeAt === null) return null
  const elapsed = performance.now() - themeChangeAt
  themeChangeAt = null
  return elapsed
}
