# Fase 0 · Investigación: Base de la aplicación (Incremento 0)

**Fecha**: 2026-10-24 · **Plan**: [plan.md](./plan.md)

Cada decisión cierra una incógnita del Technical Context. Donde la documentación
consultada es de Tauri 1 o de terceros, se marca **a confirmar en v2** y la tarea de
implementación debe verificar el nombre exacto de la API contra la referencia de Tauri 2
antes de fijarla.

## 1. Cromo de ventana por sistema (FR-012)

**Decisión**: una sola ventana. En Windows, sin decoración nativa
(`decorations: false`) y controles propios (minimizar, maximizar, cerrar) a la derecha,
dibujados con tokens. En macOS, barra de título superpuesta conservando los botones
nativos a la izquierda (`titleBarStyle` en modo superpuesto, título oculto). La zona
arrastrable se marca con `data-tauri-drag-region`.

**Razón**: es el único camino que da una barra superior propia —necesaria desde el
Incremento 2 para el Editor— sin perder los botones nativos de macOS, que el usuario
espera con su forma y su comportamiento exactos.

**Alternativas descartadas**: decoración nativa en ambos sistemas (imposible integrar la
barra superior del Editor y sus acciones); ventana sin decoración también en macOS con
botones dibujados a mano (los semáforos imitados nunca se comportan igual: menú
contextual, pantalla completa, colores del sistema).

**A confirmar en v2**: el nombre exacto del estilo de barra de título superpuesta y la
altura reservada, que varía entre versiones de macOS.

## 2. Tamaño mínimo de ventana y desplazamiento por sección (FR-011, FR-013)

**Decisión**: tamaño mínimo 1024 × 720 px lógicos, declarado en la configuración de la
ventana. El cuerpo de la aplicación nunca desplaza: cada región con contenido variable
—la lista de la Bienvenida, el cuerpo de Ajustes— es un contenedor propio con
desplazamiento interno (`ScrollRegion` en `src/components/layout/`).

**Razón**: 1024 × 720 es el menor tamaño en el que la Bienvenida cabe completa con su
lista de recientes (que llega en el Incremento 1) sin recortes, y deja margen para el
Editor sin volver a tocar el mínimo. Un contenedor por región es lo que hace cumplible
RS-01 de forma verificable: si la ventana desplaza, hay un `overflow` mal puesto.

**Alternativas descartadas**: mínimo 1280 × 800 (excluye portátiles de 1366 × 768 con
escalado); permitir que el documento entero desplace (rompe RS-01 y la barra superior
fija del Editor).

## 3. Geometría de ventana entre sesiones (FR-018)

**Decisión**: `tauri-plugin-window-state` con las banderas de estado reducidas a tamaño y
posición (`StateFlags::SIZE | StateFlags::POSITION`), dejando fuera la de maximizado, y
un recorte propio al restaurar: si el rectángulo guardado no cae dentro de los monitores
conectados, se reposiciona la ventana al monitor principal y se limita su tamaño al área
visible, nunca por debajo del mínimo.

**Razón**: el plugin ya resuelve el guardado al cerrar y la escritura del archivo; las
banderas son un mapa de bits, así que omitir el maximizado es exactamente lo que pide la
especificación. El recorte no lo cubre el plugin y es el caso que el usuario sí nota
(monitor desconectado), así que vive en `src-tauri/src/window_state.rs` y se prueba con
`cargo test` sobre rectángulos y monitores simulados.

**Alternativas descartadas**: implementación propia completa (reinventa el guardado y la
escritura segura del archivo sin ganar nada); guardar también maximizado y pantalla
completa (la especificación lo excluye y arrastra casos de borde entre sistemas).

**A confirmar en v2**: desde 2.0.0-rc.4 el tamaño se guarda en píxeles físicos; hay que
verificar la conversión al comparar con el mínimo lógico y con el área del monitor.

## 4. Tema claro y oscuro (FR-007, FR-008, FR-009)

**Decisión**: la preferencia es de tres estados (`system`, `light`, `dark`) y vive en el
archivo de preferencias. El tema efectivo se aplica en el webview con un atributo
`data-theme` en `<html>` sobre los tokens CSS, sin recargar nada. Con `system`, el tema
efectivo se sigue con `matchMedia('(prefers-color-scheme: dark)')` y su escucha de
cambios. Además se informa a la ventana nativa del tema elegido para que el cromo del
sistema acompañe.

**Razón**: `data-theme` más tokens es un cambio de una clase en la raíz: instantáneo, sin
desmontar componentes, y conserva el estado de la pantalla como pide el escenario 4 de la
historia 2. `matchMedia` funciona igual en WebView2 y en WebKit, así que no hace falta
un camino por sistema.

**Alternativas descartadas**: `tauri-plugin-theme` de terceros (dependencia externa para
algo que resuelven dos líneas, y en Windows exige una versión mínima de WebView2 para
aplicarse sin reiniciar); recargar la ventana al cambiar de tema (pierde el estado de la
pantalla y se ve el parpadeo).

**A confirmar en v2**: el nombre del evento de cambio de tema del sistema en la API de
ventana y la firma de `setTheme`.

## 5. Archivo de preferencias (FR-005, FR-009, FR-016, FR-018)

**Decisión**: un archivo JSON propio en el directorio de configuración de la aplicación,
con una clave de versión de formato. Rust es el único que lo lee y lo escribe: escritura
atómica (archivo temporal más renombrado) y lectura tolerante —si el archivo falta, está
vacío, no es JSON válido o no cumple el esquema, se arranca con los valores por defecto
(`theme: system`, `showWelcomeOnStart: true`) y se deja la causa en el registro. El
archivo dañado se conserva con sufijo `.bak` antes de escribir el nuevo.

**Razón**: un solo esquema versionado y validado al cargar es lo que hace que el
principio IV (tipos del modelo únicos y validados) se cumpla también para las
preferencias, y la escritura atómica evita el archivo a medias si la app muere al cerrar.
Guardar la copia dañada deja material para diagnosticar sin bloquear el arranque.

**Alternativas descartadas**: `tauri-plugin-store` (impone su propia forma de clave-valor
y sus permisos, y deja la validación del esquema fuera); preferencias en
`localStorage` del webview (el frontend no debe poseer estado que el backend necesita al
arrancar, y se pierde al limpiar datos del webview).

## 6. Versión e identidad con fecha de compilación (FR-002)

**Decisión**: la versión sale de `tauri.conf.json` y la fecha de la compilación se inyecta
en el binario desde `src-tauri/build.rs` como variable de entorno de compilación. Un
comando `app_identity` devuelve `{ name, version, buildDate }` y la Bienvenida solo
formatea lo que recibe.

**Razón**: así la fecha queda atada al empaquetado del binario, que es lo que el usuario
reporta en soporte, y la prueba de la pantalla se escribe contra el valor del comando, no
contra una cadena escrita a mano que envejece.

**Alternativas descartadas**: inyectar la fecha con `define` de Vite (quedaría atada al
build del frontend, que puede no coincidir con el del binario); escribirla a mano en el
código de la pantalla (la especificación lo prohíbe explícitamente).

## 7. Registro local de errores (FR-019, SC-010)

**Decisión**: `tauri-plugin-log` con destino al directorio de logs de la aplicación,
rotación por tamaño y sin ningún destino de red. Se registran los fallos de arranque y
los errores de lectura o escritura de preferencias y de geometría, con fecha y
descripción por línea. Un fallo al escribir el registro se ignora y no impide el arranque.

**Razón**: el plugin ya resuelve ruta por sistema, formato y rotación, que es justo lo
aburrido de hacer a mano; y el destino de archivo es el único que se activa, así que nada
sale del equipo.

**Alternativas descartadas**: escritor propio (hay que resolver rutas por sistema,
concurrencia y rotación para igualar lo que ya existe); registrar en consola únicamente
(se pierde al cerrar y no sirve para soporte).

## 8. Apertura de Ajustes: atajo, menú nativo y control visible (FR-020)

**Decisión**: tres vías. En macOS, un menú de aplicación nativo con el elemento
Preferencias y su acelerador `Cmd+,`, que emite el mismo evento que las demás vías. En
Windows, como el diseño no tiene barra de menú nativa, el atajo `Ctrl+,` se atiende en el
webview y la entrada equivalente vive en el menú de la aplicación accesible desde la
barra de título propia. En los dos sistemas, un control visible en la Bienvenida. Las
tres vías llaman a la misma acción del almacén.

**Razón**: el acelerador en el menú nativo de macOS es lo que hace que el atajo funcione
aunque el foco no esté en el webview, y es donde los usuarios de macOS lo buscan. En
Windows no existe ese menú en este diseño, así que el webview es el sitio correcto. Una
sola acción compartida evita que las tres vías se desincronicen.

**Alternativas descartadas**: atajo global del sistema (se lo quitaría a otras apps y no
es lo que pide un atajo de aplicación); solo el atajo (invisible, no demostrable);
solo el control visible (deja el atajo de la especificación sin cumplir).

## 9. Movimiento reducido (FR-010)

**Decisión**: `MotionConfig` de Framer Motion con `reducedMotion="user"` envolviendo la
aplicación, y `@media (prefers-reduced-motion: reduce)` para las transiciones escritas en
CSS, que anula duraciones a cero usando los tokens de duración.

**Razón**: con `reducedMotion="user"` cada animación declarada respeta la preferencia sin
condicionales repartidos por los componentes, y el media query cubre lo que no pasa por
Framer Motion.

**Alternativas descartadas**: comprobar la preferencia en cada componente (se olvida en
alguno); desactivar toda animación siempre (pierde el movimiento orgánico que pide la
constitución).

## 10. Estrategia de pruebas

**Decisión**: `cargo test` para la lógica de Rust —preferencias (defaults, archivo
dañado, ida y vuelta, copia `.bak`), recorte de geometría, identidad— y Vitest con
Testing Library para el almacén, los hooks y las dos pantallas, incluidos los tres
caminos de apertura de Ajustes y el recorrido con teclado. El cromo de ventana, los
botones del sistema y la revisión visual de los dos temas se verifican a mano con
`quickstart.md` en cada sistema.

**Razón**: lo que se puede probar sin arrancar la app se prueba barato y en cada cambio;
lo que depende del gestor de ventanas de cada sistema no se simula de forma fiable y
cuesta más mantener el arnés que ejecutarlo a mano en dos máquinas.

**Alternativas descartadas**: pruebas de extremo a extremo con `tauri-driver` y
WebdriverIO en este incremento (el arnés y su configuración por sistema valen más cuando
haya flujos de archivo que recorrer, en el Incremento 1; queda anotado como trabajo
futuro, no como deuda silenciosa).

## Incógnitas resueltas

Ninguna marca NEEDS CLARIFICATION queda abierta en el Technical Context. Lo único
pendiente son las tres verificaciones de API marcadas **a confirmar en v2**, que son
tareas de implementación, no decisiones.

## Fuentes

- [Tauri 2 · Window Customization](https://v2.tauri.app/learn/window-customization/)
- [Tauri 2 · window-state (referencia JavaScript)](https://v2.tauri.app/reference/javascript/window-state/)
- [Tauri 2 · window-state, todas las versiones](https://v2.tauri.app/release/window-state/all-versions/)
- [Tauri 2 · Logging](https://v2.tauri.app/plugin/logging/)
- [docs.rs · tauri-plugin-log](https://docs.rs/tauri-plugin-log)
- [Tauri 2 · notas de `@tauri-apps/api` 2.0.0-rc.6 (`setTheme`)](https://v2.tauri.app/release/@tauri-apps/api/v2.0.0-rc.6/)
- [Tauri 1 · configuración de ventana (`titleBarStyle: Overlay`)](https://v1.tauri.app/api/config/)
