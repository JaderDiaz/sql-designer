import { esperarTexto } from '../soporte/pantalla.js'

/**
 * Prueba de humo del recorrido: la aplicación arranca y pinta la Bienvenida.
 *
 * Si esta falla, lo que está roto es el montaje —binario sin
 * `--features webdriver`, servidor del frontend caído o el servidor de
 * WebDriver—, no el escenario que venga después.
 */
describe('Arranque', () => {
  it('abre la Bienvenida con el nombre y la versión de la aplicación', async () => {
    await esperarTexto('SQL Designer')
    await esperarTexto('Versión')
    await esperarTexto('Nuevo modelo…')
  })
})
