# Phase 0 · Investigación: Lienzo y esquemas (Incremento 2)

**Entrada**: `specs/003-lienzo-esquemas/spec.md` (46 requisitos funcionales, 10
criterios de éxito, tres clarificaciones cerradas el 2026-10-27).

**Referencias de diseño**: el lienzo «SQL Designer · Diseño de Pantallas»
(tablero `Editor` y los componentes `SchemaForm`, `ConfirmDialog`,
`ContextMenu`, `EmptyModelStart`) y el sistema «Aura» (`tokens.json`, que ya
está volcado en `src/styles/tokens.css`). El prototipo es referencia de diseño,
no base de código (constitución, puerta 6): de él se toman medidas, textos y
jerarquía, no su implementación.

---

## R1 · El lienzo es DOM posicionado dentro de una transformación

**Decisión**: el lienzo es un `div` que recorta, con un contenedor interior al
que se le aplica `transform: translate(panX, panY) scale(zoom)`. Dentro van las
zonas y las tablas como elementos posicionados en coordenadas del modelo. No se
usa `<canvas>` ni un `<svg>` para las tarjetas.

**Razón**: las zonas y las tablas tienen que recibir foco, menú contextual y
nombre accesible (FR-038, FR-040); en un `<canvas>` nada de eso existe y habría
que mantener un árbol accesible paralelo. Con el transform en un solo nodo,
mover la vista y hacer zoom no re-renderizan las tarjetas: cambia una propiedad
compuesta por el navegador, que es lo que sostiene los 60 cuadros por segundo de
SC-003.

**Alternativas descartadas**: `<canvas>` 2D (pierde accesibilidad y foco, y
obliga a un segundo árbol); `<svg>` con `<foreignObject>` (texto y foco
irregulares entre WebKit y WebView2); posicionar cada tarjeta ya multiplicada
por el zoom (vuelve a pintar 50 tarjetas por cuadro).

## R2 · Una parte nueva del almacén para la vista, el foco y la disposición

**Decisión**: se añade `src/store/canvas.ts` con `createCanvasSlice`, compuesta
en `src/store/index.ts` como las demás: `pan`, `zoom`, `focusedSchema`,
`selectedSchema`, `isSidebarHidden`, `isInspectorHidden` y sus acciones. Nada de
esto entra en `Model`.

**Razón**: principio IV, un solo almacén y sin estado derivado duplicado. La
vista y el foco son estado de la sesión (FR-014, FR-032) y los leen tres piezas
a la vez —el lienzo, la barra de zoom y el minimapa—, así que no pueden vivir
dentro de un componente. La disposición es preferencia de la aplicación
(FR-006): el almacén la refleja y la escribe en `preferences.json` (R15).

**Alternativas descartadas**: estado local en `EditorScreen` con props hacia
abajo (el minimapa y la barra de estado quedarían colgando de la misma rama);
un contexto de React aparte (gestor paralelo, prohibido por el principio IV);
guardar la vista en el modelo (lo prohíbe FR-014).

## R3 · El gesto se pinta en el nodo y se escribe al almacén cuando termina

**Decisión**: mientras un gesto está en curso —mover la vista, hacer zoom con la
rueda, arrastrar una zona— el componente escribe la transformación directamente
sobre el nodo con una referencia, coalescida en `requestAnimationFrame`, y
comitea al almacén al terminar: `pointerup` para el puntero, 120 ms sin ruedas
para la rueda. El zoom escribe además su porcentaje en cada cuadro, porque la
barra lo muestra en vivo (FR-008).

**Razón**: un `set` del almacén por evento de puntero vuelve a ejecutar los
selectores de la pantalla entera 60 veces por segundo; aplicar la
transformación por referencia deja el gesto en el hilo de composición. Y
arrastrar una zona comitea **una sola vez**: así el historial recibe un paso por
gesto y no uno por píxel (FR-027, RS-06).

**Alternativas descartadas**: un `set` por evento (re-render general, y el
historial se llena de pasos); un almacén aparte solo para la vista (dos fuentes
de verdad para lo mismo).

## R4 · La geometría de zonas y tablas son funciones puras con alto fijo

**Decisión**: `src/lib/canvas/geometry.ts` calcula la geometría sin tocar el
DOM. Una tabla mide `TABLE_WIDTH = 200` por `TABLE_HEIGHT = 64` —tarjeta
compacta: nombre, chip del esquema y número de campos, porque este incremento no
dibuja campos—. La zona de un esquema con tablas es el rectángulo que las
envuelve más `ZONE_PADDING = 20` a los lados y abajo y `ZONE_HEADER = 40`
arriba, para el rótulo. La zona de un esquema sin tablas mide
`EMPTY_ZONE = 240 × 180`.

**Razón**: medidas tomadas del tablero `Editor` del lienzo. Al no depender de lo
que mida el navegador, la geometría se prueba con Vitest sobre jsdom, que no
calcula layout, y el resultado es el mismo en WebKit y en WebView2. La función
recibe el alto de cada tabla como dato, de modo que el Incremento 3, cuando las
tablas crezcan con sus campos, cambia el dato y no la función.

**Alternativas descartadas**: medir las tarjetas con `getBoundingClientRect` y
derivar la zona de la medida (imposible de probar en jsdom, y un cuadro de
desfase en cada cambio); alto fijo para siempre (el Incremento 3 lo rompe).

## R5 · La colocación de las tablas sin posición vive fuera del modelo

**Decisión**: `resolveLayout(model)` devuelve la posición de cada tabla: la del
archivo si la trae, o una calculada si no. La calculada recorre los esquemas en
el orden del modelo y, dentro de cada uno, las tablas en el orden del archivo,
en una rejilla de tres columnas con 40 px de separación; cada esquema arranca a
la derecha del anterior con 80 px de aire. Esas posiciones **no** se escriben en
el modelo.

**Razón**: FR-013 exige que abrir un modelo sin posiciones no lo marque
«Editado». Si la colocación entrase en el modelo, abrir el archivo lo ensuciaría
al instante. Siendo una capa de presentación, el modelo queda intacto y la
posición solo se escribe cuando el usuario mueve algo (FR-026). La rejilla por
esquema cumple además FR-028: las zonas de un modelo recién abierto sin
posiciones no se solapan.

**Alternativas descartadas**: escribir las posiciones al abrir (marca «Editado»
sin que el usuario toque nada); colocar al azar o con un algoritmo de fuerzas
(deja de ser determinista, y SC-007 compara dos aperturas).

## R6 · `schemas[].position`: campo opcional que se descarta cuando sobra

**Decisión**: el formato gana `schemas[].position` con la forma `{x, y}` que ya
tiene `tables[].position`. Es opcional y `formatVersion` sigue en `1`. Al leer,
`parseModel` **descarta** la posición de un esquema que tenga al menos una
tabla, sin tratar el archivo como inválido; al escribir, el serializador la
escribe donde esté en el modelo, que por lo anterior es solo en los esquemas
vacíos.

**Razón**: así la decisión de Clarifications («se escribe solo cuando el esquema
no tiene tablas y deja de escribirse cuando vuelve a tenerlas») se cumple en un
único lugar y la puerta 3 sigue en pie: leer, guardar y volver a leer da el mismo
modelo, porque la poda ocurre antes de que el modelo exista. Si la poda viviese
en el serializador, el modelo en memoria y el archivo discreparían.

**Alternativas descartadas**: subir el formato a la versión 2 (forzaría nota de
migración por un campo opcional); guardar la zona vacía en las preferencias
(saldría del archivo del modelo y rompería el principio II); podar al guardar
(discrepancia entre memoria y archivo).

## R7 · Paleta de once colores con nombre, sin color libre

**Decisión**: `src/lib/model/colors.ts` declara los once identificadores de la
paleta con su nombre en español —`gray` Grafito, `blue` Azul, `indigo` Índigo,
`purple` Morado, `pink` Rosa, `red` Rojo, `orange` Naranja, `yellow` Amarillo,
`brown` Marrón, `green` Verde, `teal` Teal—. El archivo guarda el identificador
en `schemas[].color`; uno que no esté en la lista cae a `indigo` sin invalidar el
archivo (FR-021). `tailwind.config.js` expone los cuatro tokens que aún no
estaban (`pink`, `yellow`, `brown`, `gray`).

**Razón**: el principio V prohíbe un valor de color literal en un componente. Un
selector hexadecimal metería colores fuera de los tokens en el archivo del
modelo y en la interfaz, y ni la imagen exportada ni el tema oscuro podrían
resolverlos. Los once son los mismos que ofrece el lienzo.

**Alternativas descartadas**: el color personalizado del lienzo (ver R20);
derivar el color del nombre del esquema (el usuario no podría cambiarlo).

## R8 · El nombre técnico y la abreviatura se proponen en TypeScript

**Decisión**: `src/lib/model/propose.ts` añade `toTechnicalName(name)`
—sin acentos, minúsculas, lo que no es letra ni número pasa a guion bajo, no
empieza por número, tope de `TECHNICAL_NAME_MAX_LENGTH`— y
`toAbbreviation(name)` —iniciales de las tres primeras palabras, o las tres
primeras letras si hay una sola, en mayúsculas; rellena con `X` si no llegan a
tres—. El diálogo deja de proponer en cuanto el usuario escribe en el campo
(FR-017).

**Razón**: es la misma frontera que ya fijó el Incremento 1 para el nombre de
archivo (`research.md` R10 de `specs/002-archivos-modelo`): derivar texto es
cosa del frontend, construir rutas es cosa de Rust. Las reglas son las del
producto (RS-03, RS-04) y se prueban con Vitest.

**Alternativas descartadas**: proponer en Rust (cruzar la frontera para
transformar una cadena); reutilizar `toFileStem` (usa guiones y admite puntos:
no es un nombre técnico válido).

## R9 · Gestos: Pointer Events, rueda no pasiva y el autoscroll de Windows

**Decisión**: todo el arrastre va con Pointer Events y `setPointerCapture`. La
rueda se escucha con un `addEventListener('wheel', …, { passive: false })` sobre
el nodo del lienzo para poder llamar a `preventDefault`. El pellizco del panel
táctil llega como `wheel` con `ctrlKey` en los dos navegadores, así que comparte
camino con ⌘/Ctrl + rueda. El botón central se captura en `pointerdown` con
`button === 1` y se cancela el autoscroll de Windows con `preventDefault` en
`mousedown` y en `auxclick`. Espacio mantenido cambia el cursor a `grab` y
convierte el arrastre en movimiento de vista, y se suelta también en `blur` de la
ventana.

**Razón**: WebView2 arranca el autoscroll nativo con el botón central y se queda
desplazando por encima de nuestro gesto; es el mismo tipo de diferencia de
plataforma que el recorrido en Windows ya sacó a la luz en el Incremento 1. Un
`wheel` pasivo no se puede frenar y la página entera haría zoom.

**Alternativas descartadas**: eventos de ratón (`mousedown`/`mousemove`) sin
captura (el gesto se pierde al salir de la ventana); `gesturechange` de WebKit
(no existe en WebView2).

## R10 · Zoom: topes, punto fijo bajo el puntero y Ajustar con margen

**Decisión**: `ZOOM_MIN = 0.4`, `ZOOM_MAX = 2`, los botones «−» y «+» mueven en
pasos de 0,1 y la rueda multiplica por `exp(-deltaY / 100)`, todo recortado a los
topes; el botón del tope alcanzado se deshabilita (FR-008). `zoomAt(state, zoom,
pointer)` recalcula el desplazamiento para que el punto del modelo bajo el
puntero siga bajo el puntero (FR-009). `fitToContent(bounds, viewport)` toma el
envolvente de todas las zonas y tablas, deja 48 px de margen, recorta el zoom a
los topes y centra; con un modelo sin nada devuelve zoom 1 y desplazamiento 0
(FR-010).

**Razón**: son dos funciones puras sobre números, lo único que hace falta para
cumplir FR-009, FR-010 y FR-011 y lo único que se puede probar sin navegador.
Que «Ajustar» parta del envolvente —y no de la lista de tablas— es lo que
garantiza que una coordenada negativa o enorme vuelva a la vista.

**Alternativas descartadas**: un zoom con pasos fijos en una lista (el pellizco
necesita valores continuos); limitar el desplazamiento a un lienzo de tamaño
fijo (las posiciones del archivo pueden caer fuera, y FR-011 exige alcanzarlas).

## R11 · El minimapa deriva su escala del contenido

**Decisión**: el minimapa mide 168 × 108, se pinta abajo a la derecha y calcula
su escala dividiendo su caja interior por el envolvente de zonas y tablas, con el
mismo factor en los dos ejes. Dibuja un rectángulo por tabla con el color de su
esquema, el contorno de cada zona y un recuadro del área visible; pulsar o
arrastrar dentro mueve la vista a ese punto (FR-012).

**Razón**: con una escala fija (lo que hace el prototipo, 0,15) un modelo
disperso se sale del minimapa y deja de decir dónde está la vista. Derivarla del
envolvente hace que el minimapa siempre muestre el modelo completo, que es su
único trabajo.

**Alternativas descartadas**: escala fija; redibujar el minimapa en un
`<canvas>` (50 rectángulos en DOM no justifican un segundo camino de pintado).

## R12 · Foco de esquema: atenuación por clase y centrado animado

**Decisión**: enfocar escribe `focusedSchema` en el almacén, lo que añade
`is-dim` a las zonas y tablas de los demás esquemas —opacidad de token— y filtra
la lista de tablas de la barra lateral. El centrado llama a
`centerOnZone(zone, viewport)`, que reutiliza `fitToContent` sobre el envolvente
de esa zona, y el contenedor transformado lleva una transición CSS de
`--duration-slow` que se anula con `prefers-reduced-motion` (FR-042). Esc en el
lienzo y «Todos los esquemas» lo quitan; el almacén lo quita solo cuando el
esquema enfocado desaparece o se cierra el modelo (FR-032).

**Razón**: la atenuación es aspecto, así que va en CSS sobre tokens y no en una
rama de JavaScript por tarjeta. Centrar es el mismo cálculo que «Ajustar» con
otro envolvente: una función, dos usos.

**Alternativas descartadas**: ocultar las demás zonas (el usuario pierde la
referencia de dónde está el esquema dentro del modelo); animar con Framer Motion
el nodo transformado (pelea con la transformación que el gesto escribe por
referencia, R3).

## R13 · Eliminar un esquema: el diálogo deja elegir el destino

**Decisión**: la confirmación nombra el esquema y cuántas tablas tiene, trae el
interruptor «Eliminar también sus N tablas» apagado y, con el interruptor
apagado y dos o más esquemas restantes, un selector de destino que propone el
primer esquema del modelo distinto del que se elimina; con un solo destino
posible lo nombra sin selector (FR-036, decidido en Clarifications). Confirmar
mueve tablas, enums y vistas de ese esquema al destino y lo hace en un solo paso
de historial (FR-037).

**Razón**: eliminar es la acción menos reversible del incremento y el principio
VI obliga a declarar qué queda afectado. El prototipo decide el destino solo
(ver R20); la decisión del usuario manda.

**Alternativas descartadas**: destino automático (el prototipo); un esquema de
reserva creado al vuelo (inventa un objeto que el usuario no pidió).

## R14 · Componentes nuevos del sistema de diseño

**Decisión**: se añaden a `src/components/ui/`, puros y sobre Radix:
`Switch` (sobre `@radix-ui/react-switch`, **dependencia nueva**) para el
interruptor de la confirmación, y `ColorSwatches` (sobre
`@radix-ui/react-radio-group`, ya instalado) para la paleta con nombre
accesible. El minimapa, las zonas, las tarjetas y la barra de zoom son dominio y
viven en `src/components/features/canvas/`.

**Razón**: el principio V prohíbe reimplementar foco, rol y teclado; un
interruptor con `role="switch"` y su estado anunciado es exactamente lo que da
Radix. La paleta es un grupo de radio con flechas, también de Radix.

**Alternativas descartadas**: usar el `Checkbox` existente con aspecto de
interruptor (anuncia `checkbox`, no `switch`: el lector de pantalla diría otra
cosa); escribir el interruptor a mano (prohibido).

## R15 · Preferencias: dos campos nuevos, sin subir la versión del formato

**Decisión**: `preferences.json` gana `sidebarHidden` y `inspectorHidden`
(booleanos, por defecto `false`), declarados en `src-tauri/src/preferences.rs`
con `#[serde(default)]` y aceptados por `PreferencesPatch`. `formatVersion`
sigue en `1`.

**Razón**: es el mismo caso que `engine` y `lastFolder` en el Incremento 1
(`research.md` R18 de `specs/002-archivos-modelo`): el lector reconstruye campo
a campo y da el valor por defecto a lo que falte, así que un archivo anterior se
abre sin aviso, y serde ignora los campos que no conoce, así que una build
anterior tampoco se rompe. Subir la versión forzaría una recuperación con `.bak`
y un aviso en la cara del usuario por dos booleanos.

**Alternativas descartadas**: subir a `formatVersion: 2`; guardar la disposición
en el archivo del modelo (lo prohíbe FR-006: es preferencia de la aplicación);
guardarla solo en memoria (se perdería entre sesiones).

## R16 · Historial: un paso por gesto, con su etiqueta

**Decisión**: se reutiliza el historial del Incremento 1 (`past`/`future` con
copias del modelo y una etiqueta). Las etiquetas nuevas son «crear el esquema»,
«editar el esquema», «eliminar el esquema», «mover el esquema» y «mover las
tablas del esquema». Un arrastre entero es un paso (R3).

**Razón**: el historial ya existe, guarda el modelo completo y mide `isDirty`
contra el modelo del archivo, así que deshacer hasta el estado guardado devuelve
el Editor a «Guardado» sin nada añadido. Copiar un modelo de 50 tablas por paso
cuesta microsegundos y evita el aparato de un historial por diferencias.

**Alternativas descartadas**: historial por diferencias (complejidad sin
problema que la pida); un paso por cuadro del arrastre (⌘Z devolvería un píxel).

## R17 · Pruebas: lo puro en Vitest, los gestos en el recorrido

**Decisión**: Vitest cubre las funciones puras (geometría, colocación, zoom,
ajuste, propuesta de nombre y abreviatura, paleta), las operaciones del almacén
(crear, editar, eliminar un esquema, mover una zona, deshacer y rehacer, foco) y
los componentes del diálogo, la confirmación y la barra lateral con Testing
Library. El recorrido de WebdriverIO gana escenarios para lo que necesita
navegador de verdad: mover la vista, el zoom con rueda y modificador, «Ajustar»,
arrastrar una zona y guardar, y el botón central en Windows.

**Razón**: jsdom no calcula layout ni entrega eventos de rueda con `ctrlKey`
útiles, así que probar allí los gestos daría una prueba que pasa sin que el
gesto funcione. La frontera es la misma que ya usa el proyecto: lo que se puede
decidir con números se prueba en Vitest.

**Alternativas descartadas**: simular los gestos en jsdom (prueba falsa); dejar
los gestos sin prueba automática (el Incremento 1 ya pagó el precio de probar a
mano).

## R18 · Atajos de teclado de este incremento

**Decisión**: ⌥⌘S / Alt+Ctrl+S esconde y muestra la barra lateral, ⌥⌘I /
Alt+Ctrl+I el inspector, ⌘0 / Ctrl+0 vuelve al 100 %, ⌘+ y ⌘− cambian el zoom,
⇧1 ajusta, Esc quita el foco y las flechas mueven la vista cuando el lienzo
tiene el foco. **Nuevo esquema no recibe atajo de tecla**: se alcanza con el
botón «+» de la sección Esquemas de la barra lateral, con el botón de la barra
superior y con la tarjeta del modelo vacío, los tres alcanzables con el
tabulador.

**Razón**: la puerta 4 pide declarar el atajo o justificar su ausencia. Las
teclas únicas de creación (`T` para tabla, `R` para relación en el lienzo) son
del Incremento 3 y reparten un espacio que conviene decidir de una vez con la
paleta de comandos; darle ahora una a esquema obligaría a mover la de tabla
después. La paleta de comandos todavía no existe, así que ninguna acción de este
incremento tiene entrada allí.

**Alternativas descartadas**: `S` sobre el lienzo (choca con la memoria muscular
de ⌘S y se queda huérfana cuando llegue la paleta); adelantar la paleta de
comandos (alcance de otro incremento).

## R19 · Rendimiento: lo que no se vuelve a pintar

**Decisión**: las tarjetas y las zonas no leen `pan` ni `zoom` —van dentro del
nodo transformado—, así que mover la vista no las re-renderiza; solo lo hacen el
lienzo, la barra de zoom y el minimapa. El nodo transformado lleva
`will-change: transform`, cada tarjeta `contain: layout paint`, y mientras hay
un arrastre en curso se añade una clase que quita sombras y transiciones.

**Razón**: SC-003 pide 60 cuadros por segundo con 50 tablas y respuesta por
debajo de 100 ms al primer gesto. El coste que se puede evitar es volver a pintar
50 tarjetas por cuadro; lo demás es composición del navegador.

**Alternativas descartadas**: virtualizar las tarjetas fuera de la vista (50
tablas no lo justifican, y romperían «Ajustar» y el minimapa); medir con un
comando nuevo de Rust (SC-003 se verifica en el recorrido del `quickstart.md`,
sin ampliar la frontera).

## R20 · Desvíos deliberados del lienzo

Tres, todos por decisión tomada en la especificación o en Clarifications; se
anotan aquí para que la revisión no los lea como un descuido:

1. **Texto de la zona vacía**: el lienzo dice «Arrastra una tabla aquí»; aquí
   dice «Aún no hay tablas en este esquema», porque arrastrar tablas llega en el
   Incremento 3 y el texto prometería algo que no existe (FR-025).
2. **Color del esquema**: el lienzo ofrece además un color personalizado
   hexadecimal; aquí la paleta es cerrada (R7, principio V).
3. **Destino al eliminar**: el lienzo decide el destino solo; aquí lo elige el
   usuario (R13, Clarifications).

Y dos piezas del tablero `Editor` que **no** entran en este incremento, porque
son de otros: el control segmentado de vista (Diagrama / Diccionario), la
búsqueda con la paleta de comandos, el panel editor de tabla, las relaciones
dibujadas, y los contadores de errores y advertencias de la barra de estado. La
barra de estado muestra lo que FR-004 pide y nada más.
