/**
 * Atajos para hablar con la interfaz como lo haría una persona: por el nombre
 * accesible del control, no por su clase ni su posición. Si un selector deja
 * de encontrar algo, lo que cambió es el nombre que lee quien usa la
 * aplicación con el teclado o con un lector de pantalla, y eso es justo lo que
 * estas pruebas tienen que notar.
 *
 * Todo pasa por `browser.execute` en vez de por los `$` de WebdriverIO. El
 * servicio de Tauri se mete delante de cada `$`, `$$` y clic para averiguar
 * qué ventana está activa, y como su API no engancha, cada uno de esos
 * comandos se queda cinco segundos esperándola. `execute` no está en esa
 * lista, así que por aquí el recorrido va a la velocidad de la aplicación.
 */

/**
 * Tecla modificadora de los atajos del sistema: ⌘ en macOS, Ctrl en el resto
 * (RS-12).
 */
export const MODIFICADOR = process.platform === 'darwin' ? 'Meta' : 'Control'

/**
 * Pulsa un atajo del sistema con el modificador que toque.
 *
 * @param tecla Letra o signo del atajo, por ejemplo `s` para guardar.
 */
export async function atajo(tecla) {
  await browser.keys([MODIFICADOR, tecla])
}

/**
 * Cómo escribe la interfaz un atajo, que no es igual en los dos sistemas:
 * «⌘N» en macOS y «Ctrl+N» en Windows (`src/lib/platform.ts`).
 *
 * @param tecla Letra o signo del atajo.
 */
export function atajoEscrito(tecla) {
  return process.platform === 'darwin' ? `⌘${tecla}` : `Ctrl+${tecla}`
}

/** Cuánto se espera por algo que tiene que aparecer, en milisegundos. */
const ESPERA_MS = 15000

/**
 * Nombre accesible de un elemento, con las mismas reglas que usa la interfaz:
 * `aria-label`, la etiqueta enlazada o su propio texto.
 */
const NOMBRE = `(el) => (
  el.getAttribute('aria-label')
  || (el.labels && el.labels.length ? el.labels[0].textContent : '')
  || el.textContent
  || el.getAttribute('placeholder')
  || ''
).trim()`

/**
 * Espera a que una condición se cumpla en la página.
 *
 * @param guion Cuerpo de una función que se evalúa en la página y devuelve un
 *   valor; se espera hasta que no sea `null`.
 * @param queja Qué decir si no llega a tiempo.
 * @returns Lo que devolvió el guion.
 */
async function esperar(guion, queja) {
  let ultimo = null
  await browser.waitUntil(
    async () => {
      ultimo = await browser.execute(`return (${guion})()`)
      return ultimo !== null
    },
    { timeout: ESPERA_MS, timeoutMsg: queja },
  )
  return ultimo
}

/**
 * Dónde buscar las filas de una lista: dentro del diálogo de más arriba si hay
 * alguno abierto, y en toda la página si no.
 *
 * La pantalla de debajo sigue en el árbol mientras un diálogo está abierto, y
 * sus filas también son `role="option"`: buscar «modelo.yaml» con el
 * explorador abierto encontraba primero la fila de Recientes —que lleva el
 * nombre del archivo detrás del nombre del modelo— y el clic se iba a una
 * lista que nadie está viendo.
 */
const AMBITO = `(() => {
  const dialogos = [...document.querySelectorAll('[role="dialog"]')]
  return dialogos.length ? dialogos[dialogos.length - 1] : document
})()`

/** Texto visible de toda la pantalla. */
export async function texto() {
  return browser.execute('return document.body.innerText')
}

/**
 * Espera a que un texto aparezca en la pantalla.
 *
 * Mira el texto completo y no un selector por texto: lo que la interfaz
 * escribe en una frase suele venir repartido en varios elementos —«Se creará »
 * en uno y la ruta en otro—, y un selector por texto solo ve el primer trozo.
 *
 * @param esperado Texto que debe verse.
 */
export async function esperarTexto(esperado) {
  try {
    await browser.waitUntil(async () => (await texto()).includes(esperado), { timeout: ESPERA_MS })
  } catch {
    throw new Error(`No apareció «${esperado}» en la pantalla. Lo que se veía:\n${await resumen()}`)
  }
}

/**
 * Espera a que un texto desaparezca de la pantalla.
 *
 * @param esperado Texto que no debe verse.
 */
export async function esperarSinTexto(esperado) {
  try {
    await browser.waitUntil(async () => !(await texto()).includes(esperado), { timeout: ESPERA_MS })
  } catch {
    throw new Error(`Seguía viéndose «${esperado}» en la pantalla. Lo que se veía:\n${await resumen()}`)
  }
}

/**
 * Lo que se ve en la pantalla, recortado para que quepa en el mensaje de un
 * fallo.
 *
 * Una espera que no se cumple sin decir qué había en la pantalla obliga a
 * reproducir la ejecución para saberlo, y en el recorrido eso cuesta minutos.
 */
async function resumen() {
  const visible = (await texto()).replace(/\n{2,}/g, '\n').trim()
  return visible.length > 800 ? `${visible.slice(0, 800)}…` : visible
}

/**
 * Pulsa el control visible cuyo nombre accesible empieza por el texto dado.
 *
 * Es por el principio y no exacto porque varios llevan su atajo detrás
 * («Nuevo modelo… ⌘N»).
 *
 * @param nombre Nombre del control.
 * @param selector Qué controles mirar; por defecto botones y opciones.
 */
export async function pulsar(nombre, selector = 'button,[role="radio"],[role="menuitem"]') {
  const guion = `() => {
    const nombre = ${NOMBRE}
    const el = [...document.querySelectorAll(${JSON.stringify(selector)})]
      .filter((e) => e.offsetParent !== null && !e.disabled)
      .find((e) => nombre(e).startsWith(${JSON.stringify(nombre)}))
    if (!el) return null
    el.focus()
    el.click()
    return true
  }`
  await esperar(guion, `No se pudo pulsar «${nombre}».`)
}

/**
 * Escribe en un campo de texto por su etiqueta.
 *
 * El valor se pone con el asignador nativo y un evento `input`, que es como lo
 * recibe un campo controlado por React; asignar `value` a secas no le llega.
 *
 * @param etiqueta Etiqueta del campo.
 * @param valor Texto a escribir.
 */
export async function escribir(etiqueta, valor) {
  const guion = `() => {
    const nombre = ${NOMBRE}
    const el = [...document.querySelectorAll('input,textarea')]
      .filter((e) => e.offsetParent !== null)
      .find((e) => nombre(e) === ${JSON.stringify(etiqueta)})
    if (!el) return null
    const prototipo = el.tagName === 'INPUT' ? HTMLInputElement : HTMLTextAreaElement
    const asignar = Object.getOwnPropertyDescriptor(prototipo.prototype, 'value').set
    el.focus()
    asignar.call(el, ${JSON.stringify(valor)})
    el.dispatchEvent(new Event('input', { bubbles: true }))
    return true
  }`
  await esperar(guion, `No se encontró el campo «${etiqueta}».`)
}

/**
 * Valor de un campo de texto por su etiqueta.
 *
 * @param etiqueta Etiqueta del campo.
 */
export async function valor(etiqueta) {
  const guion = `() => {
    const nombre = ${NOMBRE}
    const el = [...document.querySelectorAll('input,textarea')]
      .filter((e) => e.offsetParent !== null)
      .find((e) => nombre(e) === ${JSON.stringify(etiqueta)})
    return el ? { v: el.value } : null
  }`
  const encontrado = await esperar(guion, `No se encontró el campo «${etiqueta}».`)
  return encontrado.v
}

/**
 * Estado de un control por su nombre accesible.
 *
 * @param nombre Nombre del control.
 * @param selector Qué controles mirar.
 * @returns Si está deshabilitado, si está marcado y su texto.
 */
export async function estado(nombre, selector = 'button,input,[role="radio"],[role="checkbox"]') {
  const guion = `() => {
    const nombre = ${NOMBRE}
    const el = [...document.querySelectorAll(${JSON.stringify(selector)})]
      .filter((e) => e.offsetParent !== null)
      .find((e) => nombre(e).startsWith(${JSON.stringify(nombre)}))
    if (!el) return null
    return {
      deshabilitado: el.disabled === true || el.getAttribute('aria-disabled') === 'true',
      marcado: el.getAttribute('aria-checked') === 'true' || el.checked === true,
      texto: nombre(el),
    }
  }`
  return esperar(guion, `No se encontró el control «${nombre}».`)
}

/** Texto del aviso de error visible, el que la interfaz marca con `role="alert"`. */
export async function alerta() {
  const guion = `() => {
    const el = document.querySelector('[role="alert"]')
    return el && el.offsetParent !== null ? { t: el.innerText.trim() } : null
  }`
  const encontrado = await esperar(guion, 'No apareció ningún aviso de error.')
  return encontrado.t
}

/** Espera a que no quede ningún aviso de error en pantalla. */
export async function esperarSinAlerta() {
  await browser.waitUntil(
    async () =>
      (await browser.execute('return document.querySelector(\'[role="alert"]\') === null')) === true,
    { timeout: ESPERA_MS, timeoutMsg: 'Seguía habiendo un aviso de error.' },
  )
}

/**
 * Textos de los diálogos abiertos.
 *
 * Son varios a la vez más de una vez: el explorador de carpetas se abre encima
 * de la hoja de Nuevo modelo, y quedarse con el primero devolvería siempre el
 * de debajo.
 */
export async function dialogos() {
  // Sin filtro de visibilidad: un diálogo de Radix va en posición fija y
  // entonces no tiene `offsetParent`, así que parecería oculto. Cuando se
  // cierra desaparece del árbol, que es la señal que vale.
  return browser.execute(`
    return [...document.querySelectorAll('[role="dialog"]')].map((el) => el.innerText)
  `)
}

/**
 * Espera a que se abra un diálogo cuyo texto empieza por el título dado.
 *
 * @param titulo Título del diálogo.
 */
export async function esperarDialogo(titulo) {
  await browser.waitUntil(
    async () => (await dialogos()).some((abierto) => abierto.startsWith(titulo)),
    { timeout: ESPERA_MS, timeoutMsg: `No se abrió el diálogo «${titulo}».` },
  )
}

/**
 * Espera a que un diálogo se cierre.
 *
 * @param titulo Título del diálogo; sin él, espera a que no quede ninguno.
 */
export async function esperarSinDialogo(titulo = null) {
  await browser.waitUntil(
    async () => {
      const abiertos = await dialogos()
      return titulo === null
        ? abiertos.length === 0
        : !abiertos.some((abierto) => abierto.startsWith(titulo))
    },
    {
      timeout: ESPERA_MS,
      timeoutMsg: titulo === null
        ? 'Seguía habiendo un diálogo abierto.'
        : `Seguía abierto el diálogo «${titulo}».`,
    },
  )
}

/**
 * Selecciona una fila de una lista por un trozo de su texto.
 *
 * Es por un trozo y no por el principio porque una fila de Recientes empieza
 * por el nombre del modelo y lleva el del archivo detrás.
 *
 * @param nombre Texto que aparece en la fila.
 */
export async function seleccionar(nombre) {
  const guion = `() => {
    const el = [...${AMBITO}.querySelectorAll('[role="option"]')]
      .find((e) => e.innerText.includes(${JSON.stringify(nombre)}))
    if (!el) return null
    el.focus()
    el.click()
    return true
  }`
  await esperar(guion, `No se encontró la fila «${nombre}».`)
}

/**
 * Abre una fila con doble clic, que es como se entra en una carpeta o se abre
 * un modelo.
 *
 * @param nombre Texto que aparece en la fila.
 */
export async function abrirFila(nombre) {
  const guion = `() => {
    const el = [...${AMBITO}.querySelectorAll('[role="option"]')]
      .find((e) => e.innerText.includes(${JSON.stringify(nombre)}))
    if (!el) return null
    el.click()
    el.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))
    return true
  }`
  await esperar(guion, `No se encontró la fila «${nombre}».`)
}

/**
 * Abre el menú contextual de una fila con la tecla que lo abre sin ratón.
 *
 * @param nombre Texto que aparece en la fila.
 */
export async function menuDeFila(nombre) {
  // Si quedaba un menú del paso anterior, Radix ignora el `contextmenu`
  // nuevo mientras el viejo se está cerrando.
  await esperarSinMenu()
  const guion = `() => {
    const el = [...${AMBITO}.querySelectorAll('[role="option"]')]
      .find((e) => e.innerText.includes(${JSON.stringify(nombre)}))
    if (!el) return null
    el.click()
    el.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 10, clientY: 10 }))
    return true
  }`
  await esperar(guion, `No se encontró la fila «${nombre}».`)
}

/**
 * Textos de las filas visibles de una lista.
 *
 * @param etiqueta Etiqueta accesible de la lista.
 */
export async function filas(etiqueta) {
  return browser.execute(`
    const lista = document.querySelector('[aria-label=' + JSON.stringify(${JSON.stringify(etiqueta)}) + ']')
    if (!lista) return []
    return [...lista.querySelectorAll('[role="option"]')].map((e) => e.innerText.trim())
  `)
}

/**
 * Pulsa un control dentro de un diálogo concreto.
 *
 * Hace falta cuando hay dos diálogos encima del otro y los dos traen un botón
 * con el mismo nombre: el explorador de carpetas se abre sobre la hoja de
 * Nuevo modelo, y «Cancelar» está en los dos.
 *
 * @param titulo Título del diálogo.
 * @param nombre Nombre del control.
 * @param selector Qué controles mirar.
 */
export async function pulsarEn(titulo, nombre, selector = 'button,[role="radio"]') {
  const guion = `() => {
    const nombre = ${NOMBRE}
    const dialogo = [...document.querySelectorAll('[role="dialog"]')]
      .find((d) => d.innerText.startsWith(${JSON.stringify(titulo)}))
    if (!dialogo) return null
    const el = [...dialogo.querySelectorAll(${JSON.stringify(selector)})]
      .filter((e) => !e.disabled)
      .find((e) => nombre(e).startsWith(${JSON.stringify(nombre)}))
    if (!el) return null
    el.focus()
    el.click()
    return true
  }`
  await esperar(guion, `No se pudo pulsar «${nombre}» en «${titulo}».`)
}

/**
 * Estado de un control dentro de un diálogo concreto.
 *
 * Igual que {@link pulsarEn}: la pantalla de debajo sigue en el árbol, y un
 * nombre como «Abrir» está tanto en la Bienvenida como en el diálogo.
 *
 * @param titulo Título del diálogo.
 * @param nombre Nombre del control.
 * @param selector Qué controles mirar.
 */
export async function estadoEn(titulo, nombre, selector = 'button,input,[role="radio"]') {
  const guion = `() => {
    const nombre = ${NOMBRE}
    const dialogo = [...document.querySelectorAll('[role="dialog"]')]
      .find((d) => d.innerText.startsWith(${JSON.stringify(titulo)}))
    if (!dialogo) return null
    const el = [...dialogo.querySelectorAll(${JSON.stringify(selector)})]
      .find((e) => nombre(e).startsWith(${JSON.stringify(nombre)}))
    if (!el) return null
    return {
      deshabilitado: el.disabled === true || el.getAttribute('aria-disabled') === 'true',
      marcado: el.getAttribute('aria-checked') === 'true' || el.checked === true,
      texto: nombre(el),
    }
  }`
  return esperar(guion, `No se encontró «${nombre}» en «${titulo}».`)
}

/**
 * Si una fila de la lista está deshabilitada.
 *
 * @param nombre Texto que aparece en la fila.
 */
export async function filaDeshabilitada(nombre) {
  const guion = `() => {
    const el = [...${AMBITO}.querySelectorAll('[role="option"]')]
      .find((e) => e.innerText.includes(${JSON.stringify(nombre)}))
    return el ? { deshabilitada: el.disabled === true } : null
  }`
  const fila = await esperar(guion, `No se encontró la fila «${nombre}».`)
  return fila.deshabilitada
}

/** Espera a que no quede ningún menú contextual abierto. */
export async function esperarSinMenu() {
  await browser.waitUntil(
    async () =>
      (await browser.execute('return document.querySelectorAll(\'[role="menuitem"]\').length')) === 0,
    { timeout: ESPERA_MS, timeoutMsg: 'El menú contextual siguió abierto.' },
  )
}

/**
 * Trae la ventana al frente y espera a que WebKit la dé por visible.
 *
 * Una ventana tapada por otra cuenta como oculta (`document.hidden`), y
 * entonces WebKit suspende `requestAnimationFrame`: la animación de entrada no
 * avanza nunca y la aplicación se queda en la pantalla de carga. Con la ventana
 * al frente los fotogramas vuelven.
 */
export async function alFrente() {
  await browser.execute(`
    const ventana = window.__TAURI__.window.getCurrentWindow()
    void Promise.resolve()
      .then(() => ventana.unminimize())
      .then(() => ventana.show())
      .then(() => ventana.setFocus())
      .catch(() => undefined)
  `)

  await browser.waitUntil(
    async () => (await browser.execute('return document.hidden')) === false,
    { timeout: ESPERA_MS, timeoutMsg: 'La ventana siguió oculta: WebKit no pinta fotogramas así.' },
  )
}

/**
 * Deja la aplicación en la Bienvenida antes de que el recorrido empiece.
 *
 * Cada archivo de escenario abre su propia ventana, pero no un estado propio:
 * el arranque reabre el último modelo cuando las preferencias lo recuerdan
 * (`lastModelPath`, en `src/App.tsx`), así que un escenario puede heredar el
 * Editor que dejó abierto el anterior y no encontrar ni «Nuevo modelo…» ni
 * «Abrir modelo». Esto cierra lo que haya —diálogo, menú o modelo, guardando
 * nada— hasta volver a la Bienvenida.
 */
export async function desdeLaBienvenida() {
  await alFrente()

  await browser.waitUntil(async () => (await texto()).length > 0, {
    timeout: ESPERA_MS,
    timeoutMsg: 'La ventana no llegó a pintar nada.',
  })

  for (let intento = 0; intento < 10; intento += 1) {
    if ((await texto()).includes('Nuevo modelo…')) return

    const abiertos = await dialogos()
    if (abiertos.some((abierto) => abierto.startsWith('¿Guardar los cambios'))) {
      await pulsarEn('¿Guardar los cambios', 'No guardar')
    } else if (abiertos.length > 0) {
      await browser.keys('Escape')
    } else {
      await atajo('w')
    }
    await browser.pause(300)
  }

  throw new Error('La aplicación no volvió a la Bienvenida antes de empezar el escenario.')
}

/**
 * Espera a que el Editor esté pintado, con el modelo que sea.
 *
 * No sirve la tarjeta «Empieza a diseñar tu modelo»: esa solo sale con un
 * modelo sin tablas (FR-005). Lo que hay siempre es la fila «Todos los
 * esquemas» de la barra lateral.
 */
export async function esperarEditor() {
  await esperarTexto('Todos los esquemas')
}

/** Qué elementos puede señalar un gesto: lo que tiene nombre accesible. */
const SENALABLES = 'button,[role="application"],[role="group"]'

/**
 * Arrastra con el puntero desde el centro de un elemento.
 *
 * Los eventos se emiten a mano porque el gesto del lienzo es de Pointer
 * Events, y el `moveTo` de WebdriverIO no llega a la ventana de Tauri.
 *
 * @param nombre Nombre accesible del elemento, por su principio.
 * @param dx Cuánto se mueve en horizontal, en píxeles de pantalla.
 * @param dy Cuánto se mueve en vertical.
 * @param opciones `boton` 0 es el principal y 1 la rueda pulsada.
 */
export async function arrastrar(nombre, dx, dy, { boton = 0 } = {}) {
  const guion = `() => {
    const nombre = ${NOMBRE}
    const el = [...document.querySelectorAll(${JSON.stringify(SENALABLES)})]
      .filter((e) => e.offsetParent !== null)
      .find((e) => nombre(e).startsWith(${JSON.stringify(nombre)}))
    if (!el) return null
    const caja = el.getBoundingClientRect()
    const x = caja.left + caja.width / 2
    const y = caja.top + caja.height / 2
    const comun = (cx, cy, botones) => ({
      bubbles: true,
      cancelable: true,
      composed: true,
      pointerId: 1,
      pointerType: 'mouse',
      isPrimary: true,
      button: ${boton},
      buttons: botones,
      clientX: cx,
      clientY: cy,
    })
    const botones = ${boton} === 1 ? 4 : 1
    el.dispatchEvent(new PointerEvent('pointerdown', comun(x, y, botones)))
    for (let paso = 1; paso <= 4; paso += 1) {
      const px = x + (${dx} * paso) / 4
      const py = y + (${dy} * paso) / 4
      el.dispatchEvent(new PointerEvent('pointermove', comun(px, py, botones)))
    }
    el.dispatchEvent(new PointerEvent('pointerup', comun(x + ${dx}, y + ${dy}, 0)))
    return true
  }`
  await esperar(guion, `No se pudo arrastrar «${nombre}».`)
}

/**
 * Gira la rueda sobre un elemento.
 *
 * @param nombre Nombre accesible del elemento, por su principio.
 * @param opciones `dx`, `dy` y `meta` para el zoom (⌘ o Ctrl).
 */
export async function rueda(nombre, { dx = 0, dy = 0, meta = false } = {}) {
  const guion = `() => {
    const nombre = ${NOMBRE}
    const el = [...document.querySelectorAll(${JSON.stringify(SENALABLES)})]
      .filter((e) => e.offsetParent !== null)
      .find((e) => nombre(e).startsWith(${JSON.stringify(nombre)}))
    if (!el) return null
    const caja = el.getBoundingClientRect()
    el.dispatchEvent(new WheelEvent('wheel', {
      bubbles: true,
      cancelable: true,
      deltaX: ${dx},
      deltaY: ${dy},
      ctrlKey: ${meta},
      clientX: caja.left + caja.width / 2,
      clientY: caja.top + caja.height / 2,
    }))
    return true
  }`
  await esperar(guion, `No se pudo girar la rueda sobre «${nombre}».`)
}

/**
 * Mantiene o suelta una tecla sobre un elemento.
 *
 * Hace falta para la barra espaciadora: el gesto necesita la tecla abajo
 * mientras el puntero se mueve, y `browser.keys` la pulsa y la suelta de
 * seguido.
 *
 * @param nombre Nombre accesible del elemento, por su principio.
 * @param tipo `keydown` o `keyup`.
 * @param init Campos del evento, por ejemplo `{ key: ' ', code: 'Space' }`.
 */
export async function tecla(nombre, tipo, init) {
  const guion = `() => {
    const nombre = ${NOMBRE}
    const el = [...document.querySelectorAll(${JSON.stringify(SENALABLES)})]
      .filter((e) => e.offsetParent !== null)
      .find((e) => nombre(e).startsWith(${JSON.stringify(nombre)}))
    if (!el) return null
    el.focus()
    el.dispatchEvent(new KeyboardEvent(${JSON.stringify(tipo)}, {
      bubbles: true,
      cancelable: true,
      ...${JSON.stringify(init)},
    }))
    return true
  }`
  await esperar(guion, `No se pudo pulsar una tecla sobre «${nombre}».`)
}

/**
 * La transformación del nodo que contiene el modelo, que es la vista del
 * lienzo hecha texto: `translate3d(…) scale(…)`.
 */
export async function vistaDelLienzo() {
  return esperar(
    `() => {
      const el = document.querySelector('.sm-stage')
      return el ? { transform: el.style.transform } : null
    }`,
    'No se encontró el nodo transformado del lienzo.',
  ).then((encontrado) => encontrado.transform)
}

/**
 * Las zonas del lienzo, por su nombre accesible.
 *
 * Cada zona viene medida dos veces: en píxeles de pantalla, que es lo que se
 * ve, y en coordenadas del modelo, que es lo que el archivo guarda. Lo segundo
 * sale de su propio estilo y no depende del zoom ni de la transición del
 * lienzo, así que es con lo que se comparan posiciones y tamaños.
 *
 * @returns Un objeto por zona con su nombre, su caja en pantalla y su caja en
 * el modelo.
 */
export async function zonas() {
  return browser.execute(`
    const nombre = (el) => (el.getAttribute('aria-label') || '').trim()
    return [...document.querySelectorAll('.sm-zone')].map((el) => {
      const caja = el.getBoundingClientRect()
      return {
        nombre: nombre(el),
        x: Math.round(caja.left),
        y: Math.round(caja.top),
        ancho: Math.round(caja.width),
        alto: Math.round(caja.height),
        modelo: {
          x: parseFloat(el.style.left),
          y: parseFloat(el.style.top),
          ancho: parseFloat(el.style.width),
          alto: parseFloat(el.style.height),
        },
        atenuada: el.className.includes('is-dim'),
      }
    })
  `)
}

/**
 * Abre el menú contextual de una zona del lienzo con la tecla que lo abre sin
 * ratón (⇧F10).
 *
 * @param nombre Nombre técnico del esquema.
 */
export async function menuDeZona(nombre) {
  await esperarSinMenu()
  const guion = `() => {
    const el = [...document.querySelectorAll('.sm-zone')]
      .find((e) => (e.getAttribute('aria-label') || '').includes(${JSON.stringify(nombre)}))
    if (!el) return null
    el.focus()
    el.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 10, clientY: 10 }))
    return true
  }`
  await esperar(guion, `No se encontró la zona de «${nombre}».`)
}
