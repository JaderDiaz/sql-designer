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
    throw new Error(
      `Seguía viéndose «${esperado}» en la pantalla. Lo que se veía:\n${await resumen()}`,
    )
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
 * Pulsa un control una y otra vez hasta que se apague.
 *
 * Mirar si está habilitado y pulsarlo en dos viajes distintos no sirve: el
 * lienzo apunta el zoom en vivo y lo comitea unos milisegundos después, así
 * que entre la pregunta y el clic el control puede apagarse y el clic falla.
 * Aquí las dos cosas pasan en la misma vuelta dentro de la página.
 *
 * @param nombre Nombre del control.
 * @param selector Qué controles mirar.
 */
export async function pulsarHastaApagar(nombre, selector = 'button') {
  const guion = `() => {
    const nombre = ${NOMBRE}
    const el = [...document.querySelectorAll(${JSON.stringify(selector)})]
      .filter((e) => e.offsetParent !== null && !e.disabled)
      .find((e) => nombre(e).startsWith(${JSON.stringify(nombre)}))
    if (!el) return true
    el.click()
    return null
  }`
  await esperar(guion, `«${nombre}» no se apagó por mucho que se pulsara.`)
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
      (await browser.execute('return document.querySelector(\'[role="alert"]\') === null')) ===
      true,
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
      timeoutMsg:
        titulo === null
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
      (await browser.execute('return document.querySelectorAll(\'[role="menuitem"]\').length')) ===
      0,
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

  await browser.waitUntil(async () => (await browser.execute('return document.hidden')) === false, {
    timeout: ESPERA_MS,
    timeoutMsg: 'La ventana siguió oculta: WebKit no pinta fotogramas así.',
  })
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
 * La vista del lienzo hecha texto: lo que desplaza y lo que escala, juntos.
 *
 * Son dos nodos y no uno porque la capa que el compositor promueve para
 * arrastrar no puede contener la escala sin pixelar el texto, así que el
 * recorrido lee los dos `transform` y los concatena.
 */
export async function vistaDelLienzo() {
  return esperar(
    `() => {
      const frame = document.querySelector('.sm-frame')
      const stage = document.querySelector('.sm-stage')
      return frame && stage ? { transform: frame.style.transform + ' ' + stage.style.transform } : null
    }`,
    'No se encontraron los nodos transformados del lienzo.',
  ).then((encontrado) => encontrado.transform)
}

/**
 * Espera a que la vista del lienzo deje de moverse.
 *
 * «Ajustar» y enfocar un esquema llevan la vista a su sitio con una
 * transición, y medir una zona o una tarjeta a mitad del viaje da la posición
 * de un fotograma que ya pasó: los gestos que apuntan a un punto de la
 * pantalla tienen que esperar aquí primero.
 */
export async function esperarVistaQuieta() {
  let anterior = null
  await browser.waitUntil(
    async () => {
      const ahora = await vistaDelLienzo()
      const quieta = ahora === anterior
      anterior = ahora
      return quieta
    },
    { timeout: ESPERA_MS, timeoutMsg: 'La vista del lienzo no se quedó quieta.' },
  )
}

/**
 * Pulsa el fondo del lienzo, sin arrastrarlo.
 *
 * Es el gesto que suelta el foco del esquema (FR-031): el puntero baja y sube
 * en el mismo punto, que es lo que distingue un clic de un arrastre.
 */
export async function pulsarElFondo() {
  await esperar(
    `() => {
      const el = document.querySelector('.sm-canvas')
      if (!el) return null
      const caja = el.getBoundingClientRect()
      const x = caja.left + 8
      const y = caja.bottom - 8
      const comun = (botones) => ({
        bubbles: true,
        cancelable: true,
        composed: true,
        pointerId: 1,
        pointerType: 'mouse',
        isPrimary: true,
        button: 0,
        buttons: botones,
        clientX: x,
        clientY: y,
      })
      el.dispatchEvent(new PointerEvent('pointerdown', comun(1)))
      el.dispatchEvent(new PointerEvent('pointerup', comun(0)))
      return true
    }`,
    'No se encontró el fondo del lienzo.',
  )
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

/**
 * Las tarjetas de tabla del lienzo, por su nombre accesible.
 *
 * Igual que {@link zonas}: cada tarjeta viene medida en píxeles de pantalla,
 * que es lo que se ve, y en coordenadas del modelo, que es lo que el archivo
 * guarda y lo que no depende del zoom.
 *
 * @returns Un objeto por tarjeta con su nombre, su tabla, sus dos cajas y si
 * está seleccionada.
 */
export async function tablas() {
  return browser.execute(`
    const nombre = (el) => (el.getAttribute('aria-label') || '').trim()
    // La vista previa del diálogo Nueva tabla también es una \`.sm-table\`, y
    // esa no está en el lienzo: solo cuentan las que se nombran «Tabla …».
    const tarjetas = [...document.querySelectorAll('.sm-table')]
      .filter((el) => nombre(el).startsWith('Tabla '))
    return tarjetas.map((el) => {
      const caja = el.getBoundingClientRect()
      const etiqueta = nombre(el)
      const corte = /^Tabla ([^,]+),/.exec(etiqueta)
      return {
        nombre: etiqueta,
        tabla: corte === null ? null : corte[1],
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
        seleccionada: el.getAttribute('aria-pressed') === 'true',
        atenuada: el.className.includes('is-dim'),
        resaltada: el.className.includes('is-hot'),
        relacionada: el.className.includes('is-linked'),
        camposMarcados: [...el.querySelectorAll('.sm-field-row[data-hot]')].map((fila) =>
          (fila.querySelector('.sm-field-name') || {}).textContent,
        ),
      }
    })
  `)
}

/**
 * Saca el cursor de las tarjetas del lienzo.
 *
 * El resaltado del Incremento 4 atenúa lo que no está en el grupo de la tabla
 * que tiene el cursor encima (FR-021), y en Windows el puntero físico se queda
 * donde lo dejó el último clic: encima de una tarjeta. Esto manda el
 * `pointerout` que el sistema mandaría al salir, para que una prueba que mira
 * la atenuación del foco de esquema no vea la del resaltado.
 */
export async function soltarElCursor() {
  await browser.execute(`
    for (const el of document.querySelectorAll('.sm-table')) {
      const comun = {
        bubbles: true,
        cancelable: true,
        composed: true,
        pointerId: 1,
        pointerType: 'mouse',
        isPrimary: true,
        relatedTarget: null,
      }
      el.dispatchEvent(new PointerEvent('pointerout', comun))
      el.dispatchEvent(new PointerEvent('pointerleave', { ...comun, bubbles: false }))
      el.blur()
    }
    return true
  `)
}

/**
 * Las líneas de relación que el lienzo tiene pintadas (FR-013 a FR-015).
 *
 * De cada una se devuelve su trazo —el atributo `d`, que es lo único que
 * `jsdom` no puede firmar y aquí sí se puede leer de la pantalla de verdad—,
 * su estado de resaltado, si lleva el trazo del flujo y sus etiquetas de
 * cardinalidad.
 *
 * @returns Un objeto por relación, en el orden en que están pintadas.
 */
export async function relaciones() {
  return browser.execute(`
    return [...document.querySelectorAll('.sm-rel')].map((el) => {
      const linea = el.querySelector('.sm-rel-line')
      return {
        nombre: el.getAttribute('data-relation'),
        d: linea ? linea.getAttribute('d') : null,
        estado: el.getAttribute('data-state'),
        flujo: el.querySelector('.sm-rel-flow') !== null,
        etiquetas: [...el.querySelectorAll('.sm-rel-label text')].map((t) => t.textContent),
        color: getComputedStyle(el).getPropertyValue('--rel').trim(),
      }
    })
  `)
}

/**
 * Arrastra una tarjeta midiendo cuánto tarda cada cuadro del gesto.
 *
 * El arrastre repinta las relaciones que toca dentro del propio
 * `pointermove`, así que el tiempo de cada `pointermove` **es** el trabajo del
 * cuadro: con 60 relaciones en el modelo, ninguno puede pasar de los 16 ms del
 * presupuesto (SC-003, research R6).
 *
 * El primer movimiento no cuenta. Es el que cruza el umbral del arrastre y
 * apunta en el almacén lo que se está moviendo, así que lleva pegado un
 * render entero del lienzo que no se repite en el resto del gesto.
 *
 * @param tabla Nombre técnico de la tabla que se arrastra.
 * @param dx Desplazamiento en horizontal, en píxeles de pantalla.
 * @param dy Desplazamiento en vertical.
 * @param pasos Cuántos cuadros tiene el gesto.
 * @returns Cuántos cuadros se midieron, su tiempo medio y el peor, en
 *   milisegundos.
 */
export async function arrastrarTablaMidiendo(tabla, dx, dy, pasos = 30) {
  const guion = `() => {
    const buscar = ${TARJETA}
    const el = buscar(${JSON.stringify(tabla)})
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
      button: 0,
      buttons: botones,
      clientX: cx,
      clientY: cy,
    })
    el.dispatchEvent(new PointerEvent('pointerdown', comun(x, y, 1)))
    const tiempos = []
    for (let paso = 1; paso <= ${pasos}; paso += 1) {
      const cx = x + (${dx} * paso) / ${pasos}
      const cy = y + (${dy} * paso) / ${pasos}
      const antes = performance.now()
      el.dispatchEvent(new PointerEvent('pointermove', comun(cx, cy, 1)))
      tiempos.push(performance.now() - antes)
    }
    el.dispatchEvent(new PointerEvent('pointerup', comun(x + ${dx}, y + ${dy}, 0)))
    const cuadros = tiempos.slice(1)
    const total = cuadros.reduce((suma, uno) => suma + uno, 0)
    return {
      cuadros: cuadros.length,
      media: Math.round((total / cuadros.length) * 100) / 100,
      peor: Math.round(Math.max(...cuadros) * 100) / 100,
      arranque: Math.round(tiempos[0] * 100) / 100,
    }
  }`
  return esperar(guion, `No se encontró la tarjeta de «${tabla}».`)
}

/** Busca una tarjeta de tabla por su nombre técnico, dentro de la página. */
const TARJETA = `(tabla) => [...document.querySelectorAll('.sm-table')]
  .find((e) => (e.getAttribute('aria-label') || '').startsWith('Tabla ' + tabla + ','))`

/**
 * Da dos clics sobre el fondo del lienzo, que es lo que crea una tabla donde
 * se pulsó (FR-001, FR-006).
 *
 * @param dx Distancia en horizontal desde el borde izquierdo del lienzo; en
 *   negativo, desde el derecho.
 * @param dy Distancia en vertical desde el borde de arriba; en negativo, desde
 *   el de abajo.
 * @returns El punto de la pantalla donde cayó el gesto.
 */
export async function dobleClicEnLienzo(dx, dy) {
  const guion = `() => {
    const el = document.querySelector('.sm-canvas')
    if (!el) return null
    const caja = el.getBoundingClientRect()
    const x = ${dx} < 0 ? caja.right + ${dx} : caja.left + ${dx}
    const y = ${dy} < 0 ? caja.bottom + ${dy} : caja.top + ${dy}
    const comun = (botones) => ({
      bubbles: true,
      cancelable: true,
      composed: true,
      pointerId: 1,
      pointerType: 'mouse',
      isPrimary: true,
      button: 0,
      buttons: botones,
      clientX: x,
      clientY: y,
    })
    el.dispatchEvent(new PointerEvent('pointerdown', comun(1)))
    el.dispatchEvent(new PointerEvent('pointerup', comun(0)))
    el.dispatchEvent(new MouseEvent('dblclick', { ...comun(0), detail: 2 }))
    return { x, y }
  }`
  return esperar(guion, 'No se encontró el fondo del lienzo.')
}

/**
 * Arrastra la tarjeta de una tabla por el lienzo.
 *
 * No vale {@link arrastrar}: la fila de la barra lateral se llama «Tabla
 * <nombre>, N campos» igual que la tarjeta, y está antes en el árbol, así que
 * el gesto se iba a la barra lateral, donde no hay nada que arrastrar.
 *
 * @param tabla Nombre técnico de la tabla.
 * @param dx Cuánto se mueve en horizontal, en píxeles de pantalla.
 * @param dy Cuánto se mueve en vertical.
 */
export async function arrastrarTabla(tabla, dx, dy) {
  const guion = `() => {
    const el = (${TARJETA})(${JSON.stringify(tabla)})
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
      button: 0,
      buttons: botones,
      clientX: cx,
      clientY: cy,
    })
    el.dispatchEvent(new PointerEvent('pointerdown', comun(x, y, 1)))
    for (let paso = 1; paso <= 4; paso += 1) {
      el.dispatchEvent(new PointerEvent('pointermove', comun(x + (${dx} * paso) / 4, y + (${dy} * paso) / 4, 1)))
    }
    el.dispatchEvent(new PointerEvent('pointerup', comun(x + ${dx}, y + ${dy}, 0)))
    return true
  }`
  await esperar(guion, `No se pudo arrastrar la tarjeta de «${tabla}».`)
}

/**
 * Abre el editor de campos de una tabla con dos clics sobre su tarjeta
 * (FR-023).
 *
 * @param tabla Nombre técnico de la tabla.
 */
export async function abrirTabla(tabla) {
  const guion = `() => {
    const el = (${TARJETA})(${JSON.stringify(tabla)})
    if (!el) return null
    el.click()
    el.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, detail: 2 }))
    return true
  }`
  await esperar(guion, `No se encontró la tarjeta de «${tabla}».`)
}

/**
 * Abre el menú contextual de una tabla del lienzo con la tecla que lo abre sin
 * ratón (⇧F10).
 *
 * @param tabla Nombre técnico de la tabla.
 */
export async function menuDeTabla(tabla) {
  await esperarSinMenu()
  const guion = `() => {
    const el = (${TARJETA})(${JSON.stringify(tabla)})
    if (!el) return null
    el.focus()
    el.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 10, clientY: 10 }))
    return true
  }`
  await esperar(guion, `No se encontró la tarjeta de «${tabla}».`)
}

/**
 * Arrastra el tirador del editor de tabla, que cambia su alto (FR-022).
 *
 * El tirador es un `role="separator"`, no un botón, así que no lo alcanza
 * {@link arrastrar}: este gesto va directo a su nodo.
 *
 * @param dy Cuánto se mueve en vertical, en píxeles de pantalla; negativo
 *   hacia arriba, que es lo que agranda el panel.
 */
export async function arrastrarTirador(dy) {
  const guion = `() => {
    const el = document.querySelector('.sm-panel-handle')
    if (!el) return null
    const caja = el.getBoundingClientRect()
    const x = caja.left + caja.width / 2
    const y = caja.top + caja.height / 2
    const comun = (cy, botones) => ({
      bubbles: true,
      cancelable: true,
      composed: true,
      pointerId: 1,
      pointerType: 'mouse',
      isPrimary: true,
      button: 0,
      buttons: botones,
      clientX: x,
      clientY: cy,
    })
    el.dispatchEvent(new PointerEvent('pointerdown', comun(y, 1)))
    for (let paso = 1; paso <= 6; paso += 1) {
      el.dispatchEvent(new PointerEvent('pointermove', comun(y + (${dy} * paso) / 6, 1)))
    }
    el.dispatchEvent(new PointerEvent('pointerup', comun(y + ${dy}, 0)))
    return true
  }`
  await esperar(guion, 'No se encontró el tirador del editor de tabla.')
}

/** Alto del editor de tabla, el que anuncia su tirador. */
export async function altoDelPanel() {
  const guion = `() => {
    const el = document.querySelector('.sm-panel-handle')
    return el ? { alto: Number(el.getAttribute('aria-valuenow')) } : null
  }`
  const tirador = await esperar(guion, 'No se encontró el tirador del editor de tabla.')
  return tirador.alto
}

/**
 * Elige una opción de un selector por la etiqueta del selector.
 *
 * Va por el teclado y no por el puntero: el primitivo abre con Intro, mueve
 * la marca con las flechas y confirma con Intro, y así el recorrido no depende
 * de en qué evento del puntero el primitivo decide cada cosa.
 *
 * @param etiqueta Texto accesible del selector.
 * @param opcion Texto de la opción.
 */
export async function elegir(etiqueta, opcion) {
  const abrir = `() => {
    const nombre = ${NOMBRE}
    const el = [...${AMBITO}.querySelectorAll('[role="combobox"]')]
      .filter((e) => e.offsetParent !== null && e.getAttribute('aria-disabled') !== 'true')
      .find((e) => nombre(e) === ${JSON.stringify(etiqueta)})
    if (!el) return null
    el.focus()
    return true
  }`
  await esperar(abrir, `No se encontró el selector «${etiqueta}».`)
  await browser.keys('Enter')

  // La lista del primitivo viaja a un portal al final del documento, así que
  // es la última del árbol; las de la barra lateral son anteriores.
  const lista = await esperar(
    `() => {
      const listas = [...document.querySelectorAll('[role="listbox"]')]
      const lista = listas[listas.length - 1]
      if (!lista) return null
      const opciones = [...lista.querySelectorAll('[role="option"]')]
      if (opciones.length === 0) return null
      return {
        // Una opción puede llevar segunda línea; lo que se elige es la
        // primera, así que la descripción no entra en el texto.
        textos: opciones.map((e) => {
          const desc = e.querySelector('.au-option-desc')
          const texto = desc ? e.textContent.replace(desc.textContent, '') : e.textContent
          return texto.trim()
        }),
        marcada: opciones.findIndex(
          (e) => e.hasAttribute('data-highlighted') || e.getAttribute('aria-selected') === 'true',
        ),
      }
    }`,
    `El selector «${etiqueta}» no abrió su lista.`,
  )

  const destino = lista.textos.indexOf(opcion)
  if (destino === -1) {
    throw new Error(
      `El selector «${etiqueta}» no trae «${opcion}»; trae: ${lista.textos.join(', ')}.`,
    )
  }

  const pasos = destino - (lista.marcada === -1 ? 0 : lista.marcada)
  const tecla = pasos > 0 ? 'ArrowDown' : 'ArrowUp'
  for (let paso = 0; paso < Math.abs(pasos); paso += 1) await browser.keys(tecla)
  await browser.keys('Enter')

  // La lista se va con su animación, y mientras está puesta tapa lo que haya
  // debajo: el paso siguiente espera a que no quede nada.
  await browser.waitUntil(
    async () =>
      (await browser.execute(
        "return document.querySelectorAll('[data-radix-select-viewport]').length",
      )) === 0,
    { timeout: ESPERA_MS, timeoutMsg: `La lista de «${etiqueta}» no se cerró.` },
  )
}

/**
 * Lo que un selector ofrece, sin elegir nada.
 *
 * {@link elegir} no sirve para firmar que una opción no se puede elegir: el
 * primitivo salta las opciones deshabilitadas con las flechas, así que el
 * gesto acaba en otra y la elige. Esto abre la lista, la lee y la cierra con
 * Escape, que no cambia nada.
 *
 * @param etiqueta Texto accesible del selector.
 * @returns Una entrada por opción con su texto, su segunda línea y si está
 *   deshabilitada.
 */
export async function opciones(etiqueta) {
  const abrir = `() => {
    const nombre = ${NOMBRE}
    const el = [...${AMBITO}.querySelectorAll('[role="combobox"]')]
      .filter((e) => e.offsetParent !== null && e.getAttribute('aria-disabled') !== 'true')
      .find((e) => nombre(e) === ${JSON.stringify(etiqueta)})
    if (!el) return null
    el.focus()
    return true
  }`
  await esperar(abrir, `No se encontró el selector «${etiqueta}».`)
  await browser.keys('Enter')

  const lista = await esperar(
    `() => {
      const listas = [...document.querySelectorAll('[role="listbox"]')]
      const lista = listas[listas.length - 1]
      if (!lista) return null
      const opciones = [...lista.querySelectorAll('[role="option"]')]
      if (opciones.length === 0) return null
      return {
        opciones: opciones.map((e) => {
          const desc = e.querySelector('.au-option-desc')
          const texto = desc ? e.textContent.replace(desc.textContent, '') : e.textContent
          return {
            texto: texto.trim(),
            descripcion: desc ? desc.textContent.trim() : null,
            deshabilitada:
              e.hasAttribute('data-disabled') || e.getAttribute('aria-disabled') === 'true',
          }
        }),
      }
    }`,
    `El selector «${etiqueta}» no abrió su lista.`,
  )

  await browser.keys('Escape')
  await browser.waitUntil(
    async () =>
      (await browser.execute(
        "return document.querySelectorAll('[data-radix-select-viewport]').length",
      )) === 0,
    { timeout: ESPERA_MS, timeoutMsg: `La lista de «${etiqueta}» no se cerró.` },
  )
  return lista.opciones
}

/**
 * Escribe en un campo con el teclado de verdad, pulsación a pulsación.
 *
 * {@link escribir} pone el valor de una vez, que es lo que hace falta para
 * llenar un formulario deprisa; esto es lo contrario: cada letra es un evento
 * de teclado, que es lo que fusiona el historial en un paso (FR-024a).
 *
 * @param etiqueta Etiqueta del campo.
 * @param texto Lo que se escribe, letra a letra.
 */
export async function escribirConTeclado(etiqueta, texto) {
  await enfocarCampo(etiqueta)
  await browser.keys(texto.split(''))
}

/**
 * Lleva el foco a un campo de texto por su etiqueta, sin escribir nada.
 *
 * @param etiqueta Etiqueta del campo.
 */
export async function enfocarCampo(etiqueta) {
  const guion = `() => {
    const nombre = ${NOMBRE}
    const el = [...document.querySelectorAll('input,textarea')]
      .filter((e) => e.offsetParent !== null && !e.disabled)
      .find((e) => nombre(e) === ${JSON.stringify(etiqueta)})
    if (!el) return null
    el.focus()
    if (typeof el.setSelectionRange === 'function' && el.type !== 'checkbox') {
      el.setSelectionRange(el.value.length, el.value.length)
    }
    return true
  }`
  await esperar(guion, `No se encontró el campo «${etiqueta}».`)
}

/**
 * Quién tiene el foco ahora mismo, con lo que hace falta para saber si se ve.
 *
 * @returns Su nombre accesible, su rol, su etiqueta de elemento y si el
 * navegador le está dibujando el anillo de foco.
 */
export async function enfocado() {
  return browser.execute(`
    const nombre = (el) => (
      el.getAttribute('aria-label')
      || (el.labels && el.labels.length ? el.labels[0].textContent : '')
      || el.textContent
      || ''
    ).trim()
    const el = document.activeElement
    if (!el || el === document.body) return { nombre: '', rol: null, etiqueta: 'body', visible: false }
    return {
      nombre: nombre(el),
      rol: el.getAttribute('role'),
      etiqueta: el.tagName.toLowerCase(),
      visible: el.matches(':focus-visible'),
    }
  `)
}

/**
 * Escribe en un campo de un diálogo concreto.
 *
 * Hace falta cuando la pantalla de debajo trae un campo con la misma
 * etiqueta: el inspector de tabla tiene su propio «Nombre», y sin acotar el
 * diálogo lo escrito se iba allí.
 *
 * @param titulo Título del diálogo.
 * @param etiqueta Etiqueta del campo.
 * @param valor Texto a escribir.
 */
export async function escribirEn(titulo, etiqueta, valor) {
  const guion = `() => {
    const nombre = ${NOMBRE}
    const dialogo = [...document.querySelectorAll('[role="dialog"]')]
      .find((d) => d.innerText.startsWith(${JSON.stringify(titulo)}))
    if (!dialogo) return null
    const el = [...dialogo.querySelectorAll('input,textarea')]
      .find((e) => nombre(e) === ${JSON.stringify(etiqueta)})
    if (!el) return null
    const prototipo = el.tagName === 'INPUT' ? HTMLInputElement : HTMLTextAreaElement
    const asignar = Object.getOwnPropertyDescriptor(prototipo.prototype, 'value').set
    el.focus()
    asignar.call(el, ${JSON.stringify(valor)})
    el.dispatchEvent(new Event('input', { bubbles: true }))
    return true
  }`
  await esperar(guion, `No se encontró el campo «${etiqueta}» en «${titulo}».`)
}

/**
 * Valor de un campo de un diálogo concreto.
 *
 * @param titulo Título del diálogo.
 * @param etiqueta Etiqueta del campo.
 */
export async function valorEn(titulo, etiqueta) {
  const guion = `() => {
    const nombre = ${NOMBRE}
    const dialogo = [...document.querySelectorAll('[role="dialog"]')]
      .find((d) => d.innerText.startsWith(${JSON.stringify(titulo)}))
    if (!dialogo) return null
    const el = [...dialogo.querySelectorAll('input,textarea')]
      .find((e) => nombre(e) === ${JSON.stringify(etiqueta)})
    return el ? { v: el.value } : null
  }`
  const encontrado = await esperar(guion, `No se encontró el campo «${etiqueta}» en «${titulo}».`)
  return encontrado.v
}

/**
 * Pulsa un control con la pareja entera de eventos del puntero.
 *
 * Los menús desplegables abren en el `pointerdown`, no en el `click`, así que
 * a ellos no les vale {@link pulsar}.
 *
 * @param nombre Nombre del control, por su principio.
 * @param selector Qué controles mirar.
 */
export async function pulsarPuntero(nombre, selector = 'button') {
  const guion = `() => {
    const nombre = ${NOMBRE}
    const el = [...document.querySelectorAll(${JSON.stringify(selector)})]
      .filter((e) => e.offsetParent !== null && !e.disabled)
      .find((e) => nombre(e).startsWith(${JSON.stringify(nombre)}))
    if (!el) return null
    const comun = (botones) => ({
      bubbles: true,
      cancelable: true,
      composed: true,
      pointerId: 1,
      pointerType: 'mouse',
      isPrimary: true,
      button: 0,
      buttons: botones,
    })
    el.focus()
    el.dispatchEvent(new PointerEvent('pointerdown', comun(1)))
    el.dispatchEvent(new PointerEvent('pointerup', comun(0)))
    el.dispatchEvent(new MouseEvent('click', comun(0)))
    return true
  }`
  await esperar(guion, `No se pudo pulsar «${nombre}».`)
}
