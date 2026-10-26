import {
  esperarDialogo,
  esperarSinDialogo,
  esperarTexto,
  estado,
  pulsar,
  pulsarEn,
  texto,
} from '../soporte/pantalla.js'

/**
 * Escenario 7 de `quickstart.md`: teclado y temas (FR-037 a FR-041, SC-007,
 * SC-009).
 *
 * Lo que no se puede automatizar queda anotado en `quickstart.md`: «Reducir
 * movimiento» y el tema del propio sistema son ajustes de macOS, y cambiarlos
 * necesita una persona.
 */
describe('Escenario 7 · Teclado y temas', () => {
  /**
   * Comprueba que Esc cierra un diálogo.
   *
   * @param abrir Qué hacer para abrirlo.
   * @param titulo Título del diálogo.
   */
  async function cierraConEsc(abrir, titulo) {
    await abrir()
    await esperarDialogo(titulo)
    await browser.keys('Escape')
    await esperarSinDialogo(titulo)
  }

  it('Esc cierra cada diálogo de la Bienvenida', async () => {
    await cierraConEsc(() => pulsar('Nuevo modelo'), 'Nuevo modelo')
    await cierraConEsc(() => pulsar('Abrir modelo'), 'Abrir modelo')
    await cierraConEsc(() => pulsar('Ajustes'), 'General')
  })

  it('el foco se queda dentro del diálogo abierto', async () => {
    await pulsar('Nuevo modelo')
    await esperarDialogo('Nuevo modelo')

    for (let paso = 0; paso < 12; paso += 1) {
      await browser.keys('Tab')
      const dentro = await browser.execute(`
        const dialogo = document.querySelector('[role="dialog"]')
        return dialogo !== null && dialogo.contains(document.activeElement)
      `)
      expect(dentro).toBe(true)
    }

    await browser.keys('Escape')
    await esperarSinDialogo('Nuevo modelo')
  })

  it('cada control enfocado se ve, con su anillo y sin recortes', async () => {
    await pulsar('Nuevo modelo')
    await esperarDialogo('Nuevo modelo')

    const recortes = await browser.execute(`
      const malos = []
      const dialogo = document.querySelector('[role="dialog"]')
      const focos = [...dialogo.querySelectorAll('input,button,[tabindex]:not([tabindex="-1"])')]
        .filter((el) => !el.disabled)
      for (const el of focos) {
        el.focus()
        const r = el.getBoundingClientRect()
        const anillo = { top: r.top - 7, left: r.left - 7, right: r.right + 7, bottom: r.bottom + 7 }
        let padre = el.parentElement
        while (padre) {
          const estilo = getComputedStyle(padre)
          if (/auto|scroll|hidden/.test(estilo.overflowX + estilo.overflowY)) {
            const pr = padre.getBoundingClientRect()
            const falta = [
              pr.top - anillo.top,
              anillo.bottom - pr.bottom,
              pr.left - anillo.left,
              anillo.right - pr.right,
            ].some((hueco) => hueco > 0.5)
            if (falta) malos.push(el.getAttribute('aria-label') || el.innerText || el.type)
            break
          }
          padre = padre.parentElement
        }
      }
      return malos
    `)

    expect(recortes).toEqual([])
    await browser.keys('Escape')
    await esperarSinDialogo('Nuevo modelo')
  })

  it('los atajos salen con los símbolos de macOS', async () => {
    const pantalla = await texto()
    expect(pantalla).toContain('⌘N')
    expect(pantalla).toContain('⌘O')
    expect(pantalla).toContain('⌘,')
  })

  it('el tema cambia a oscuro, a claro y vuelve al del sistema', async () => {
    await pulsar('Ajustes')
    await esperarDialogo('General')

    await pulsarEn('General', 'Oscuro')
    await browser.waitUntil(
      async () =>
        (await browser.execute('return document.documentElement.getAttribute("data-theme")')) ===
        'dark',
      { timeout: 15000, timeoutMsg: 'El tema no pasó a oscuro.' },
    )
    expect((await estado('Oscuro')).marcado).toBe(true)

    await pulsarEn('General', 'Claro')
    await browser.waitUntil(
      async () =>
        (await browser.execute('return document.documentElement.getAttribute("data-theme")')) ===
        'light',
      { timeout: 15000, timeoutMsg: 'El tema no pasó a claro.' },
    )

    await pulsarEn('General', 'Sistema')
    await browser.keys('Escape')
    await esperarSinDialogo('General')
  })

  it('ninguna pantalla desplaza la ventana entera', async () => {
    const desborda = await browser.execute(`
      return {
        vertical: document.documentElement.scrollHeight > window.innerHeight + 1,
        horizontal: document.documentElement.scrollWidth > window.innerWidth + 1,
      }
    `)

    expect(desborda.vertical).toBe(false)
    expect(desborda.horizontal).toBe(false)
  })

  after(async () => {
    await esperarTexto('Nuevo modelo…')
  })
})
