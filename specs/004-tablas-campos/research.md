# Fase 0 · Investigación del Incremento 3 (Tablas y campos)

Decisiones técnicas tomadas antes de diseñar, una por incógnita del
`spec.md`. Cada una dice qué se eligió, por qué, y qué se descartó. Las
referencias `R<n>` se citan desde `plan.md`, `data-model.md`,
`contracts/tables.md` y `tasks.md`.

El Incremento 2 dejó el lienzo, las zonas y la tarjeta compacta de tabla. Este
incremento convierte esa tarjeta en el objeto central del editor, así que seis
de estas decisiones **revisan** decisiones del Incremento 2 y se dicen como
tales (R1 revisa R4 del Incremento 2; R5 revisa su R3).

## R1 · El alto de la tarjeta de tabla pasa a depender de sus campos

**Decisión**: `TABLE_HEIGHT` deja de ser una constante y se sustituye por una
función pura `tableHeight(fieldCount)` = `TABLE_HEADER` (42) +
`FIELD_ROW_HEIGHT` (24) × campos, con un mínimo de una fila. La tarjeta dibuja
**todas** sus filas, sin tope. La función vive en `src/lib/canvas/constants.ts`
y la usan la tarjeta, la envolvente de zona de `geometry.ts`, el minimapa, la
búsqueda de hueco libre y la prueba de impacto del arrastre.

**Razón**: la marca PK/UK tiene que verse en la tabla del lienzo (FR-025), y
eso obliga a dibujar las filas. Si la geometría siguiera suponiendo 64 px, la
zona del esquema cortaría sus tablas y «Ajustar» dejaría filas fuera de la
vista, que es justo lo que FR-011 prohíbe. Son las medidas del tablero
`Editor`: 42 px de cabecera y 24 px por fila.

**Revisa**: R4 del Incremento 2, «la geometría son funciones puras **con alto
fijo**». Sigue siendo pura y sigue sin DOM; lo que cambia es que `schemaZones`
necesita el modelo para saber cuántos campos tiene cada tabla, que ya recibe.

**Alternativas descartadas**:
- Medir el alto real del DOM y guardarlo en el almacén: mete el navegador en la
  geometría, obliga a un `ResizeObserver` por tarjeta y hace que la envolvente
  dependa del orden de pintado.
- Tope de filas visibles con «+N campos más» en la tarjeta: ahorra alto en
  tablas grandes, pero esconde justo las marcas de llave que el requisito pide
  ver, y el tablero no lo hace.

## R2 · Catálogo de tipos por motor, en un módulo propio

**Decisión**: `src/lib/model/engines.ts` declara, por motor, la lista de tipos
y qué admite cada uno:

| Motor | Tipos | Con longitud | Con escala |
| ----- | ----- | ------------ | ---------- |
| PostgreSQL | `uuid`, `smallint`, `integer`, `bigint`, `serial`, `bigserial`, `numeric`, `real`, `double precision`, `boolean`, `varchar`, `char`, `text`, `date`, `time`, `timestamp`, `timestamptz`, `interval`, `json`, `jsonb`, `bytea`, `inet` | `varchar`, `char`, `numeric` | `numeric` |
| MySQL | `char`, `varchar`, `text`, `mediumtext`, `longtext`, `tinyint`, `smallint`, `int`, `bigint`, `decimal`, `float`, `double`, `boolean`, `date`, `datetime`, `timestamp`, `time`, `json`, `blob`, `binary` | `char`, `varchar`, `decimal`, `binary` | `decimal` |
| SQLite | `integer`, `real`, `text`, `blob`, `numeric` | — | — |

Del mismo módulo salen el campo `id` de FR-008 y los campos de las plantillas
de FR-027, por motor:

| Qué | PostgreSQL | MySQL | SQLite |
| --- | ---------- | ----- | ------ |
| Llave primaria `id` | `uuid` · `gen_random_uuid()` | `char(36)` · `(uuid())` | `text` · sin valor por defecto |
| `created_at`, `updated_at` | `timestamptz` · `now()` | `timestamp` · `CURRENT_TIMESTAMP` | `text` · `CURRENT_TIMESTAMP` |
| `deleted_at` | `timestamptz` · sin valor | `timestamp` · sin valor | `text` · sin valor |
| `created_by`, `updated_by` | `uuid` | `char(36)` | `text` |
| `activo` | `boolean` · `true` | `boolean` · `1` | `integer` · `1` |

**Razón**: lo decidió el usuario en Clarifications. Un modelo SQLite con un
campo `timestamptz` es un modelo que su motor no entiende, y el generador SQL
de un incremento posterior tendría que adivinar la traducción. Concentrarlo en
un módulo de datos puros lo hace probable en Vitest y deja un solo sitio al que
el generador podrá volver.

**Alternativas descartadas**:
- La lista única de PostgreSQL del tablero: más rápido hoy, pero guarda en el
  archivo tipos que el motor del modelo no tiene.
- Tipo libre escribible: el usuario lo descartó al elegir la opción de lista
  por motor; además abre la puerta a erratas que ninguna validación atrapa.

## R3 · `length` y `scale`: dos campos opcionales del campo

**Decisión**: `Field` gana `length?: number` y `scale?: number`, enteros
positivos. `type` guarda **solo** el nombre del tipo, sin paréntesis. El orden
del serializador pasa a ser `name`, `type`, `length`, `scale`, `nullable`,
`default`, `comment`. `formatVersion` **sigue en 1**.

El validador comprueba forma, no catálogo: entero ≥ 1, `scale` ≤ `length`, y
nada más. Un `length` sobre un tipo que el motor actual no admite **no**
invalida el archivo: se conserva y la interfaz lo muestra atenuado, porque el
motor del modelo se puede cambiar (Incremento 1) y un archivo válido no puede
dejar de serlo por eso.

**Razón**: decidido en Clarifications. Es el mismo patrón que `schemas[].position`
del Incremento 2: campo opcional, versión quieta, archivos viejos válidos. Y
deja la celda de longitud como un número, sin parsear ni recomponer texto en
cada lectura.

**Alternativas descartadas**:
- `varchar(120)` dentro de `type`: cada lectura parsea y cada escritura
  recompone; dos sitios donde el texto y los números pueden discrepar, y el
  selector de tipo tendría que comparar prefijos.
- Un solo campo `precision: [12, 2]`: ahorra una clave y pierde legibilidad en
  el archivo, que es lo que el principio II protege.
- Validar `length` contra el catálogo del motor: convierte un cambio de motor
  en un archivo inválido.

## R4 · Arrastrar una tabla reutiliza el gesto de la zona

**Decisión**: el arrastre de una tarjeta copia el patrón del Incremento 2: el
desplazamiento se pinta en el nodo con dos variables CSS escritas por
referencia, el almacén no se toca mientras el dedo está abajo, y al soltar se
hace **una** llamada a `moveTable(name, delta, { schema })`, que es el único
paso de deshacer del gesto (FR-033).

El esquema de destino sale de una función pura nueva, `zoneAt(zones, point)`,
que devuelve la zona que contiene el punto o `null`. Con zonas solapadas
devuelve **la última en el orden del modelo**, que es la que se dibuja encima
(FR-031).

**Razón**: el gesto ya está resuelto y medido a 60 cuadros por segundo en el
Incremento 2 (su R3 y R19); repetir el patrón evita un segundo camino de
arrastre. Que «la de encima» sea la última del orden del modelo lo hace
determinista y probable sin DOM.

**Alternativas descartadas**:
- Escribir la posición en el almacén en cada `pointermove`: un render por
  píxel, y 50 tarjetas volviendo a pintar.
- Decidir el esquema por la posición del centro de la tarjeta en lugar del
  punto del puntero: sorprende cuando la tabla es alta y el puntero está en su
  cabecera.

## R5 · La cuadrícula del lienzo es de 24 px y el ajuste es una función pura

**Decisión**: `GRID_SNAP = 24`, el mismo paso que los puntos que el lienzo ya
dibuja. `snapToGrid(position, enabled)` redondea en `src/lib/canvas/geometry.ts`
y se aplica **al soltar**, no durante el arrastre (FR-032).

**Razón**: el tablero usa 20 px, pero los puntos del fondo del lienzo que el
Incremento 2 ya pinta están cada 24 px. Ajustar a 20 dejaría las tablas
alineadas a nada visible, que es lo contrario de lo que la opción promete.

**Revisa**: el valor de 20 px del tablero. Queda anotado en R18 como desvío
deliberado.

**Alternativas descartadas**:
- Ajustar durante el arrastre: la tarjeta salta bajo el dedo y el gesto se
  siente pegajoso.
- Cambiar los puntos del lienzo a 20 px para seguir al tablero: toca una
  pantalla ya revisada y aprobada por un valor sin consecuencia.

## R6 · El panel inferior: marco en `layout/`, contenido en `features/`

**Decisión**: `src/components/layout/BottomPanel.tsx` aporta el marco —alto,
borde, tirador de cambio de alto y cierre— y `src/components/features/table/`
aporta el contenido (`FieldsGrid.tsx` y su cabecera). El alto vive en la
preferencia `fieldsPanelHeight`, se recorta a `[200, 560]` y se escribe al
soltar el tirador o al cambiarlo con las flechas, en pasos de 24 px (FR-022).

**Razón**: la constitución nombra el «panel inferior» como parte de la
estructura de ventana, que es lo que vive en `layout/`; los campos son dominio
y no pueden vivir ahí. Separarlos deja el marco probable sin modelo y la
rejilla probable sin layout.

**Alternativas descartadas**:
- Todo el panel en `features/`: la estructura de ventana se partiría en dos
  sitios, contra el principio VII.
- Guardar el alto en el almacén sin persistirlo: el usuario lo ajusta una vez
  por sesión y lo pierde al cerrar, cuando ya hay un sitio para preferencias.

## R7 · La rejilla de campos se navega con tabindex rotatorio

**Decisión**: la rejilla usa el patrón WAI-ARIA de *data grid*: `role="grid"`,
`role="row"`, `role="gridcell"`, una sola parada de tabulador para toda la
rejilla y las flechas moviendo el foco entre celdas y filas, con Inicio y Fin
en los extremos de la fila, Intro para empezar a editar y Esc para cancelar
(FR-046a). Se implementa en un hook propio, `src/hooks/useGridNavigation.ts`,
probado en Vitest con Testing Library.

**Razón**: ni Radix ni las dependencias actuales traen un primitivo de rejilla;
el principio V exige Radix o React Aria para menú, diálogo, popover, selección
y atajos, y una rejilla no es ninguno de ellos. El hook es pequeño, no toca
ARIA de otros componentes y mantiene la navegación en un único sitio auditable.
Los controles de cada celda siguen siendo los componentes puros de
`src/components/ui/` (`TextField`, `Select`, `Checkbox`).

**Alternativas descartadas**:
- Añadir `react-aria`/`react-aria-components` por `useGrid`: trae un árbol de
  dependencias grande y una API de colecciones que obliga a modelar la tabla
  como estado de colección, para una sola pantalla.
- Una parada de tabulador por celda: con 40 campos son más de 300 tabulaciones
  para llegar a la última fila; incumple el espíritu de SC-009.

## R8 · Historial: un paso por celda, con clave de fusión

**Decisión**: `HistoryStep` gana `coalesceKey?: string`. Las acciones de edición
de celda pasan la clave `campo:<tabla>.<campo>.<columna>`; si el paso de arriba
de `past` ya tiene esa misma clave, **se reemplaza en lugar de empujar**. La
clave se limpia al salir de la celda, con Intro, con Esc y cuando cambia la
celda enfocada. El modelo se marca «Editado» con la primera pulsación
(FR-024a).

Así cada pulsación sí cambia el modelo —y por tanto la tarjeta del lienzo
responde al instante, que es SC-005— pero el historial guarda un único paso con
el valor anterior a empezar a escribir.

**Razón**: es la respuesta del usuario en Clarifications. La alternativa por
reloj del tablero (350 ms antes de guardar) hace que la prueba de deshacer
dependa de temporizadores, que es lo que vuelve frágiles los recorridos.

**Alternativas descartadas**:
- Escribir el modelo solo al salir de la celda: la tarjeta del lienzo dejaría
  de reflejar lo que se escribe y SC-005 no se podría medir.
- Agrupar por pausa: prueba dependiente de relojes y un paso distinto según lo
  rápido que se escriba.

## R9 · El nombre del campo se normaliza al escribir y se valida al confirmar

**Decisión**: mientras se escribe, la celda baja a minúsculas y cambia espacios
por guion bajo. Al confirmar la celda se aplica `toTechnicalName` de
`src/lib/model/propose.ts` y se comprueba RS-03 y la unicidad dentro de la
tabla; si falla, la fila muestra el error y el valor anterior se conserva en el
modelo (FR-017).

**Razón**: reutiliza la función que el Incremento 2 ya probó para esquemas y
deja un solo sitio con la regla del nombre técnico. Normalizar al escribir
evita que el usuario vea un nombre con espacios que luego cambia solo.

**Alternativas descartadas**:
- Validar en cada pulsación: `pag` es un nombre intermedio legítimo y marcarlo
  en rojo mientras se escribe es ruido.
- Aceptar el nombre tal cual y arreglarlo al guardar el archivo: el archivo
  dejaría de reflejar lo que la pantalla muestra.

## R10 · Crear una tabla: posición pedida y hueco libre

**Decisión**: el diálogo recibe una posición opcional. Con doble clic es el
punto del modelo bajo el puntero, que el lienzo convierte con la vista; sin
ella, el centro del área visible. Antes de crear, una función pura nueva,
`findFreeSpot(occupied, desired, size)`, busca el primer sitio libre probando
el pedido y, si choca, desplazamientos en espiral corta a la derecha, abajo,
derecha-abajo, izquierda y arriba (FR-006).

**Razón**: la misma función resuelve el hueco del duplicado (FR-038), así que
hay un único criterio de «sitio libre» y una sola prueba. Pura y determinista:
el mismo modelo y el mismo punto dan el mismo resultado.

**Alternativas descartadas**:
- Crear siempre en el centro y dejar que el usuario mueva: dos tablas creadas
  seguidas quedan una encima de otra.
- Rejilla incremental global: coloca lejos de donde el usuario está mirando.

## R11 · Duplicar: nombre libre y nombres de restricciones renombrados

**Decisión**: `duplicateTable(name)` copia campos, `primaryKey`, `uniques`,
`indexes` y `comment`, en el mismo esquema, con nombre `<tabla>_copia` y, si
está tomado, `<tabla>_copia_2`, `_copia_3`… Los nombres de `uniques` e
`indexes` que empiezan por el nombre de la tabla original se reescriben con el
nombre nuevo. Las relaciones **no** se copian.

**Razón**: una copia con el nombre de restricción de la original produce SQL que
el motor rechaza, y este incremento ya escribe esos nombres al marcar un UK.
Copiar relaciones duplicaría llaves foráneas que el usuario no pidió.

**Alternativas descartadas**:
- `copia de <tabla>`: incumple RS-03 (espacios) y el enunciado pide
  `<tabla>_copia`.
- Copiar también las relaciones: una llave foránea duplicada apunta al mismo
  destino y el diagrama se vuelve ilegible.

## R12 · Las marcas de llave se derivan, no se guardan por campo

**Decisión**: el archivo sigue guardando la llave en la tabla
(`primaryKey: [...]`, `uniques: [{name, fields}]`). La marca de cada campo la
deriva una función pura, `fieldMarks(table, relations)`, que devuelve `PK`,
`UK`, `FK` o nada por campo. Marcar un campo como UK crea un único de un solo
campo llamado `uq_<tabla>_<campo>`; quitarlo lo elimina. Un único de varios
campos **no** se puede crear aquí y su marca se muestra igual en los campos que
lo forman.

**Razón**: el mismo criterio que el Incremento 2 usó con las zonas: lo derivado
no se guarda, para que no haya un segundo sitio donde la verdad discrepe
(principio IV). Y el formato no cambia.

**Alternativas descartadas**:
- Un campo `key: 'PK' | 'UK'` por campo: duplica lo que `primaryKey` y
  `uniques` ya dicen y obliga a mantener los dos en acuerdo.
- Crear el único con nombre generado aleatorio: el nombre entra en el SQL y
  tiene que ser estable entre guardados.

## R13 · Eliminar un campo o una tabla: qué se lleva por delante

**Decisión**: una función pura `relationsTouching(model, { table, field })`
devuelve las relaciones afectadas; el diálogo de confirmación las nombra.
Confirmar elimina el campo o la tabla **y** esas relaciones en un solo paso de
historial (FR-019, FR-039). Eliminar el último campo de una tabla está
prohibido con mensaje (FR-020). Renombrar un campo propaga el nombre nuevo a
`primaryKey`, `uniques`, `indexes` y a las relaciones que lo nombran (FR-021).

**Razón**: lo decidió el usuario en Clarifications, contra lo que hace el
tablero. En este incremento las relaciones solo pueden venir del archivo, así
que sin esta salida un modelo abierto tendría campos que no se pueden borrar y
ninguna pantalla donde quitar la relación.

**Alternativas descartadas**:
- Bloquear el borrado como el tablero: deja al usuario sin salida hasta el
  incremento de relaciones.
- Eliminar el campo y dejar la relación apuntando a un campo que no existe:
  produce un archivo que el propio validador rechaza al abrirlo.

## R14 · El inspector de tabla muestra ocho campos

**Decisión**: el resumen lista los ocho primeros campos con su marca y su tipo,
y debajo «Mostrar N más» / «Mostrar menos»; un campo del resumen abre el panel
con esa celda enfocada (FR-044). La descripción usa `TextArea` con cuenta de
caracteres y tope de 280 (FR-043).

**Razón**: son las medidas del tablero y mantienen el inspector de 300 px de
ancho sin barra de desplazamiento propia en el caso normal, que es lo que pide
SC-006.

**Alternativas descartadas**:
- Listar todos los campos: el inspector se vuelve una segunda rejilla peor que
  la del panel.
- Tope fijo sin poder ampliar: obliga a abrir el panel para ver el campo nueve.

## R15 · Preferencias: dos campos nuevos, versión quieta

**Decisión**: `preferences.json` gana `snapToGrid` (booleano, por defecto
`false`) y `fieldsPanelHeight` (entero, por defecto 320, recortado a
`[200, 560]` al leer). Los dos con `#[serde(default)]` en Rust y como
`Option<...>` en `PreferencesPatch`. `formatVersion` de las preferencias sigue
en `1`.

**Razón**: es el patrón que el Incremento 2 dejó con `sidebarHidden` e
`inspectorHidden`, y mantiene la frontera con Rust creciendo solo en datos, sin
comandos ni permisos nuevos.

**Alternativas descartadas**:
- Guardar el alto del panel en el archivo del modelo: no es del modelo; dos
  personas con el mismo archivo no tienen por qué querer el mismo alto.
- `localStorage`: el frontend dejaría de pedir sus preferencias a Rust, contra
  el principio III.

## R16 · Atajos de teclado de este incremento

**Decisión**:

| Atajo (macOS / Windows) | Acción | Requisito |
| ----------------------- | ------ | --------- |
| `T` | Nueva tabla | FR-001 |
| Doble clic en el fondo | Nueva tabla ahí | FR-001, FR-006 |
| Doble clic en una tabla | Abrir el panel de campos | FR-023 |
| ⌘D / Ctrl+D | Duplicar la tabla seleccionada | FR-036 |
| ⌫ / Supr | Eliminar la tabla seleccionada, con confirmación | FR-039 |
| ⌥⌘E / Alt+Ctrl+E | Abrir y cerrar el panel de campos | FR-023 |
| Flechas con una tabla seleccionada | Moverla 1 px, o un paso de cuadrícula con ⇧ | FR-034 |
| Flechas dentro de la rejilla | Mover el foco de celda | FR-046a |
| Intro / Esc en una celda | Editar y cancelar | FR-046a |
| ⌥↑ / ⌥↓ en una fila | Subir y bajar el campo | FR-014 |
| Esc en el lienzo | Quitar la selección | FR-045 |

`T` no lleva modificador porque el lienzo solo la recibe cuando el foco no está
en un campo de texto, igual que el tablero.

**Razón**: son las teclas del tablero y las que el Incremento 2 dejó libres.
`R`, de nueva relación, se reserva al incremento siguiente.

**Alternativas descartadas**:
- `⌘T` para nueva tabla: en macOS es «nueva pestaña» en toda app con pestañas y
  el tablero usa `T` sola.
- `Supr` sin confirmación: incumple el principio VI.

## R17 · Pruebas: lo puro y el almacén en Vitest, los gestos en el recorrido

**Decisión**: Vitest cubre las funciones puras nuevas (`tableHeight`, `zoneAt`,
`snapToGrid`, `findFreeSpot`, `fieldMarks`, `relationsTouching`, el catálogo de
motores), las acciones del almacén (crear, mover, renombrar, duplicar,
eliminar, editar campos, plantillas, deshacer con fusión), los componentes
nuevos y el hook de la rejilla. El recorrido de WebdriverIO gana
`e2e/specs/10-tablas-y-campos.e2e.js` con lo que necesita puntero real:
arrastrar una tabla a otra zona, doble clic en el lienzo, cambiar el alto del
panel y el ajuste a la cuadrícula. La ida y vuelta de la puerta 3 se amplía con
un modelo que trae `length`, `scale`, `primaryKey` y `uniques`.

**Razón**: es el reparto que el Incremento 2 ya usó y que mantiene rápido el
`npm test`.

**Alternativas descartadas**:
- Probar el arrastre en jsdom: no hay `PointerEvent` fiable ni medidas; las
  pruebas pasan sin que el gesto funcione.

## R18 · Desvíos deliberados del tablero de diseño

Del tablero `Editor` y de los componentes `TableForm`, `TableEditorPanel`,
`RenameDialog`, `ContextMenu` y `ConfirmDialog` se toman medidas, textos y
jerarquía. Su HTML, su `support.js` y su `bundle.js` no entran al repositorio
(puerta 6). Seis desvíos, todos decididos:

| Desvío | Qué hace el tablero | Qué hace este incremento | Por qué |
| ------ | ------------------- | ------------------------ | ------- |
| Selección múltiple | Clic con ⇧, recuadro de arrastre, ficha «Selección» y acciones en lote | Una sola tabla seleccionada | Clarifications del `spec.md` |
| Secciones del panel | Control segmentado con Campos, Índices, Claves foráneas, Únicos y SQL | Solo «Campos», sin control segmentado | Las otras cuatro son de incrementos posteriores; un control con una sola opción es ruido |
| Campo con relación | Borrado deshabilitado con aviso | Confirmar y eliminar campo y relación | Clarifications del `spec.md` |
| Deshacer al escribir | Guardado agrupado por pausa de 350 ms | Un paso por celda, cerrado al salir o con Intro | Clarifications; evita pruebas dependientes de relojes |
| Cuadrícula | 20 px | 24 px | Es el paso de los puntos que el lienzo ya dibuja (R5) |
| Tipos | Lista única de PostgreSQL | Lista del motor del modelo | Clarifications (R2) |

Dos más, de texto: el tablero titula las dos opciones del diálogo «Clave
primaria id» y «Fechas de auditoría»; el producto usa **«Llave primaria id»** y
**«Campos de auditoría»**, que son los términos del enunciado, y el mismo
término se usa en la plantilla equivalente del panel.

## R19 · Rendimiento: qué se vuelve a pintar al escribir

**Decisión**: la rejilla lee el modelo por selectores de tabla, no de modelo
completo, de modo que escribir en una celda vuelve a pintar su fila y la
tarjeta de su tabla, no las 50 tarjetas. La geometría (`resolveLayout` +
`schemaZones`) se sigue recalculando en un `useMemo` sobre el modelo; es O(n)
sobre tablas y campos y con 50 tablas queda por debajo del milisegundo, medido
en el Incremento 2. El alto de una tarjeta solo cambia cuando cambia el número
de campos, así que escribir un nombre no mueve ninguna zona.

**Razón**: SC-005 pide que la pulsación se vea en menos de 100 ms en la fila y
en la tarjeta a la vez.

**Alternativas descartadas**:
- Memoizar la geometría por tabla: complica el invalidado para ahorrar
  microsegundos.
- No reflejar lo escrito en la tarjeta hasta salir de la celda: incumple
  FR-012.

## R20 · Lo que este incremento **no** toca

- No genera SQL: ni `CREATE TABLE`, ni la sección «SQL» del panel, ni
  «Copiar SQL» (Clarifications, FR-029). La puerta 2 no aplica.
- No crea ni dibuja relaciones: las lee del archivo para contarlas en las
  confirmaciones y para marcar `FK`.
- No crea únicos de varias columnas, índices, enums ni vistas.
- No sube la versión del formato del modelo ni de las preferencias.
- No añade comandos de Tauri ni permisos en `capabilities/`.
