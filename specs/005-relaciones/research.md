# Fase 0 · Investigación: Relaciones (Incremento 4)

Dieciocho decisiones técnicas, cada una con su alternativa descartada. Las que
tocan geometría se escriben como funciones puras para poder probarlas sin DOM,
porque `jsdom` no implementa `getBBox` ni el layout de SVG.

## R1 · Dónde se engancha la línea: geometría pura, no medida del DOM

**Decisión**: una función pura `relationAnchors(model, layout, relation)` en
`src/lib/canvas/relations.ts` devuelve los dos extremos en coordenadas del
modelo, calculados con las constantes que ya existen:
`y = position.y + TABLE_HEADER + FIELD_ROW_HEIGHT * índice + FIELD_ROW_HEIGHT / 2`,
y `x` en el borde izquierdo o derecho de la tarjeta (`TABLE_WIDTH`). El lado lo
decide la posición relativa: si la tabla de destino está a la derecha con al
menos `TABLE_WIDTH + GRID_SNAP` de hueco, la línea sale por la derecha de la de
origen y entra por la izquierda de la de destino; al revés si está a la
izquierda; y si las dos se solapan en horizontal, las dos salen por el mismo
lado y la línea rodea.

**Razón**: es el mismo principio que el Incremento 3 adoptó para el alto de la
tarjeta (R1 de aquel incremento): la geometría es una función del modelo, no una
medida del DOM. Permite probar el trazado con Vitest, dibujar relaciones de
tablas que están fuera de la pantalla y mantener el minimapa coherente sin leer
el layout.

**Alternativa descartada**: medir los nodos de los campos con
`getBoundingClientRect` y anclar a lo medido. Obliga a un paso de medición
después de cada render, se rompe con el zoom y no se puede probar en `jsdom`.

## R2 · Carriles: el reparto se calcula una vez y se congela durante el gesto

**Decisión**: `assignLanes(anchors[])` agrupa las líneas por el hueco vertical
que usan (la coordenada del canal redondeada a 60 px), las reparte cada 14 px
alrededor del centro del grupo y, cuando el grupo tiene entre 2 y 5 líneas y
hay cruces, prueba las permutaciones y se queda con la que menos cruces deja.
Con más de 5 se ordena por el extremo superior y se reparte sin permutar. El
resultado se recalcula cuando cambia el modelo, **no** en cada cuadro del
arrastre: mientras se arrastra, los carriles se quedan como estaban.

**Razón**: el reparto es lo que evita que dos líneas se superpongan, y 14 px es
la separación del tablero de diseño. Permutar 5 elementos son 120 pruebas, que
es nada una vez por cambio de modelo y demasiado sesenta veces por segundo.
Congelarlo durante el gesto además evita que las líneas salten de carril
mientras se mueve la tabla, que es lo que se vería si se recalculara.

**Alternativa descartada**: recalcular los carriles en cada `pointermove`.
Cuesta el presupuesto de los 16 ms y produce un parpadeo de carriles que se lee
como un defecto.

## R3 · Tres trazados, una sola función

**Decisión**: `pathOf(anchors, lane, route)` devuelve la cadena `d` del `path`:

- `ortogonal`: `M ax ay H lane V by H bx` (el valor inicial).
- `curvas`: una cúbica con los tiradores en horizontal, de longitud
  `max(36, |bx - ax| / 2)`.
- `rectas`: una polilínea con 16 px de salida recta en cada extremo.

**Razón**: son los tres del tablero de diseño y de Ajustes (FR-017), y las tres
se escriben con los mismos cuatro números que ya calcula R1. Una sola función
pura, tres ramas, tres pruebas.

**Alternativa descartada**: una biblioteca de enrutado de aristas (`elkjs`,
`dagre`). Son cientos de kilobytes para un trazado que cabe en veinte líneas, y
el principio I pide empaquetar lo mínimo.

## R4 · El bucle de una tabla hacia sí misma

**Decisión**: cuando `fromTable === toTable`, los dos extremos salen por el
mismo lado (el derecho) y el trazado va al carril, baja y vuelve: el mismo
`kind: 'self'` que el caso de dos tablas solapadas, con el carril en
`x + TABLE_WIDTH + 26` y un mínimo de 18 px de separación de la tarjeta. Los
tres trazados de R3 lo respetan, cada uno con su forma.

**Razón**: la clarificación 2 metió la relación de una tabla hacia sí misma en
el alcance (FR-013a) y el tablero de diseño no la dibuja, pero sí dibuja el
caso de dos tablas que se solapan, que es geométricamente el mismo problema:
dos extremos del mismo lado. Reusar ese camino evita una cuarta rama.

**Alternativa descartada**: un arco de circunferencia pegado al borde de la
tarjeta. Queda bonito con un campo y se cruza con la propia tarjeta cuando los
dos campos están lejos en la lista.

## R5 · La cardinalidad sale de un solo sitio

**Decisión**: `marks.ts` gana `cardinalityOf(model, relation)`, que devuelve
`{ from: 'one', to: 'many' | 'zero-or-many' | 'one' | 'zero-or-one' }`, y
`relationCardinality` —la que ya existe y devuelve el texto del inspector— pasa
a ser su formateador. El glifo del extremo lo elige `glyphOf(end, point, side)`
a partir de ese mismo valor: dos barras para «uno», pata de gallo para
«muchos», pata de gallo con círculo para «cero o muchos».

**Razón**: SC-011 exige que la línea y el texto del inspector digan lo mismo
siempre, y la única forma de garantizarlo es que los dos lean la misma función.
`relationCardinality` ya deducía las cuatro lecturas en el Incremento 3 a
partir del «no nulo» y de la unicidad; aquí solo se separa el dato del texto.

**Alternativa descartada**: guardar la cardinalidad en el archivo. Sería una
segunda verdad que puede contradecir al `NOT NULL` del campo, contra el
principio II.

## R6 · 60 cuadros por segundo mientras se arrastra: las líneas se pintan a mano

**Decisión**: la capa de relaciones registra sus `path` en un mapa de refs por
nombre de relación. `continueDrag` —el manejador que ya existe y que hoy pinta
la tarjeta escribiendo `--drag-x` y `--drag-y` en el escenario— llama a
`paintRelations(delta)`, que recalcula el atributo `d` **solo** de las
relaciones que tocan lo que se arrastra (las de la tabla, o las del esquema
entero cuando se arrastra una zona). Ni un render de React durante el gesto; al
soltar, el almacén cambia y la capa se vuelve a dibujar de la forma normal.

**Razón**: el Incremento 3 ya midió que mover una tarjeta con variables CSS
mantiene los 60 fps (R4 de aquel incremento), y una variable CSS no sirve aquí
porque en una relación solo se mueve un extremo: la forma del trazo cambia, y
eso no es una transformación. Escribir el atributo de dos o tres `path` por
cuadro es más barato que un render del lienzo.

**Alternativa descartada**: subir el delta del arrastre al estado de React y
dejar que la capa se redibuje. Son sesenta renders por segundo de un lienzo con
50 tarjetas, que es exactamente lo que SC-003 prohíbe.

## R7 · El resaltado es estado local del lienzo, con clases del escenario

**Decisión**: `CanvasSurface` guarda en un `useState` propio qué tabla está
caliente —por cursor o por foco de teclado— y de ahí derivan, en el mismo
render, las clases de cada tarjeta, de cada zona y de cada relación:
`is-hot` para la activa, `is-linked` para las relacionadas e `is-dim` para el
resto, con las opacidades del tablero (0,28 en tarjetas, 0,35 en zonas y 0,15
en líneas). El conjunto caliente lo calcula `relationsTouching`, que ya existe.
Mientras hay un gesto en curso el resaltado se apaga.

**Razón**: el hover y el foco son estado efímero de interfaz, que el principio
IV deja fuera del estado del modelo, y nadie fuera del lienzo los necesita: el
inspector trabaja con la selección, que ya está en el almacén. Un cambio de
hover es un render, no sesenta por segundo.

**Alternativa descartada**: `hoveredTable` en el almacén. Haría que cualquier
suscriptor del almacén se vuelva a evaluar al pasar el cursor, y el almacén
único quedaría lleno de estado que no es del modelo ni de la sesión.

## R8 · La animación del flujo es CSS, no Framer Motion

**Decisión**: la relación resaltada añade un segundo `path` con
`stroke-dasharray` y una animación de `stroke-dashoffset` por `@keyframes` en
`src/styles/screens.css`, con tres niveles por clase en el escenario
(`sm-anim-apagada`, `sm-anim-sutil`, `sm-anim-viva`) y una regla
`@media (prefers-reduced-motion: reduce)` que la apaga.

**Razón**: el principio V pide Framer Motion «con resortes antes que curvas de
tiempo» para el movimiento de la interfaz, y esto no es un movimiento de
interfaz: es un bucle infinito sobre un atributo de trazo SVG, que es
exactamente lo que `@keyframes` hace sin coste de JavaScript. Framer Motion no
anima `stroke-dashoffset` en bucle sin un `animate` propio por relación.
Queda declarado como nota en la puerta del principio V.

**Alternativa descartada**: `motion.path` con `repeat: Infinity`. Un
componente de Framer por relación, sesenta relaciones, y el respeto a «reducir
movimiento» lo da igual `MotionConfig`; se gana nada y se paga por relación.

## R9 · El panel inferior gana fichas, y las fichas son de Radix

**Decisión**: `BottomPanel` pasa de «Editor de campos» a «Editor de tabla» con
una lista de fichas: «Campos» y «Claves foráneas», cada una con su contador.
Se construye con `@radix-ui/react-tabs`, **una dependencia nueva**, envuelta en
`src/components/ui/Tabs.tsx` como componente puro.

**Razón**: el principio V prohíbe reimplementar a mano el foco, el rol ARIA y
la navegación de teclado de un primitivo, y una lista de fichas es justo eso
—`role="tablist"`, flechas, `aria-controls`—. La excepción que el Incremento 3
se concedió con la rejilla existía porque Radix no tiene primitivo de rejilla;
aquí sí tiene `Tabs`, de la misma familia que los siete paquetes de Radix que
ya están en el proyecto. El alta de la dependencia se justifica en `plan.md`.

**Alternativa descartada**: reutilizar `SegmentedControl`, que ya existe. Es un
grupo de radios: semánticamente es «elige un valor», no «mira otra parte de
este panel», y los lectores de pantalla lo anuncian como tal.

## R10 · El nombre de la relación lo genera la aplicación

**Decisión**: `relationName(table, field, existing)` devuelve
`fk_<tabla>_<campo>` recortado a 63 caracteres y, si ya existe, con sufijo
`_2`, `_3`… El nombre se recalcula cuando cambia la columna o la tabla
referenciada, salvo que el usuario lo haya hecho único a mano, cosa que esta
pantalla no permite: aquí el nombre no se muestra como campo editable
(FR-011).

**Razón**: el formato exige `name` único por relación y el tablero de diseño no
pide ninguno: el generador SQL del tablero construye `fk_<tabla>_<columna>`, así
que ese es el nombre que el producto ya asume. Mantenerlo derivado evita un
campo más en la pantalla y un error más que validar.

**Alternativa descartada**: un identificador opaco (`rel_1a2b3c`). Sobrevive a
cualquier cambio, pero el nombre viaja al SQL y a los mensajes de error, donde
`fk_pago_unidad_id` se lee y `rel_1a2b3c` no.

## R11 · `set_default` entra en el enum y la versión del formato no sube

**Decisión**: `ReferentialAction` y `REFERENTIAL_ACTIONS` ganan `set_default`,
igual que el `enum` de `contracts/model.schema.json`. `formatVersion` del
archivo del modelo **sigue en 1**.

**Razón**: FR-028 pide las cinco acciones del estándar y hoy hay cuatro. Ampliar
un enum no invalida ningún archivo ya guardado: todos los valores anteriores
siguen siendo válidos y se leen igual, que es lo que el principio II exige de un
cambio compatible. Es el mismo criterio con el que el Incremento 3 añadió
`length` y `scale` sin subir de versión.

**Alternativa descartada**: subir a `formatVersion: 2`. Obligaría a una nota de
migración y a código de lectura de la versión 1 para ganar un valor de enum que
ningún archivo existente usa.

## R12 · Las relaciones viven en su propia parte del almacén

**Decisión**: `src/store/relations.ts`, con seis acciones deshacibles:
`addForeignKey`, `setForeignKeyColumn`, `setForeignKeyTarget`,
`setReferentialAction`, `deleteForeignKey` y `removeNotNull` —la salida del
aviso de SET NULL—. Cada una con su etiqueta de historial, las del tablero:
«editar la clave foránea», «eliminar la clave foránea» y «cambiar ON DELETE /
UPDATE». La marca FK del campo **no** se escribe: `fieldMarks` ya la deduce de
las relaciones.

**Razón**: es el reparto por dominio que `src/store/` ya usa, y la marca
derivada es lo que hace que crear la relación marque el campo sin un segundo
cambio que pueda desincronizarse (principio II).

**Alternativa descartada**: meter las acciones en `src/store/tables.ts`, que ya
tiene 14. Crece hacia un archivo de mil líneas y mezcla dos dominios que el
panel ya muestra en dos fichas.

## R13 · La columna propuesta sale del patrón de Ajustes

**Decisión**: `proposeForeignKey(model, from, to, pattern)` en
`src/lib/model/relations.ts` devuelve el campo que se va a crear: nombre por el
patrón (`{tabla}` y `{pk}`, con sufijo numérico si choca), `type` y `length` de
la llave primaria referenciada, `nullable` sin poner —es decir, no nulo
(FR-004)—. Si la tabla de destino no tiene llave primaria de una sola columna,
devuelve `null` y la pantalla dice por qué (FR-009).

**Razón**: el patrón es una preferencia del usuario (R15) y la propuesta tiene
que poder probarse sin pintar nada. Que el tipo venga de la llave primaria es lo
que hace que la clave foránea sirva sin tocar la celda «Tipo».

**Alternativa descartada**: proponer siempre `<tabla>_id`. Ignora el patrón que
Ajustes declara y falla en cuanto la llave primaria no se llama `id`.

## R14 · El tipo se propone, no se obliga

**Decisión**: cambiar la columna de una clave foránea a un campo de otro tipo se
permite sin aviso; el único retipado automático es el de FR-007, cuando la
columna conserva el nombre que el patrón le puso.

**Razón**: la especificación no lo pide, y el modelado real tiene casos
legítimos (un `bigint` que referencia un `int` en SQLite, un dominio con
`citext`). Comprobar la compatibilidad de tipos de verdad es trabajo del
validador del motor, que es del incremento de exportación.

**Alternativa descartada**: bloquear la columna a los campos del mismo tipo que
la llave primaria. Deja fuera combinaciones válidas y esconde el error en vez de
mostrarlo.

## R15 · Tres preferencias nuevas, el mismo comando

**Decisión**: `preferences.json` gana `relationRoute`
(`orthogonal` | `curved` | `straight`, por defecto `orthogonal`),
`relationAnimation` (`off` | `subtle` | `lively`, por defecto `subtle`) y
`foreignKeyPattern` (`string`, por defecto `{tabla}_{pk}`). En Rust, los tres
con `#[serde(default = "…")]` y recorte del patrón a 64 caracteres; en el
frontend, los tres en `Preferences` y en `PreferencesPatch`. `formatVersion` de
las preferencias **sigue en 1**.

**Razón**: es el camino que el Incremento 3 ya recorrió con `snapToGrid` y
`fieldsPanelHeight`: campos nuevos con valor por defecto cuando faltan, sobre
`preferences_update`, que ya existe. Ningún comando nuevo, ningún permiso nuevo.

**Alternativa descartada**: guardar el trazado en el archivo del modelo. Es una
preferencia de quien mira, no una propiedad del modelo: dos personas con el
mismo `.yaml` pueden querer verlo distinto.

## R16 · Qué se prueba con qué

**Decisión**: tres niveles, como en los incrementos anteriores.

- **Vitest puro** (`src/lib/canvas/relations.test.ts`,
  `src/lib/model/relations.test.ts`, `marks.test.ts`): anclas, carriles,
  trazados, bucle, glifos, cardinalidad estructurada, propuesta de columna y
  nombre de relación. Se comparan cadenas `d` y objetos, sin DOM.
- **Vitest con Testing Library**: la ficha «Claves foráneas» (filas, selectores,
  badges, «Referenciada por», mensajes), el aviso de SET NULL, la capa de
  relaciones (cuántos `path` y con qué `d`) y las seis acciones del almacén con
  su deshacer.
- **Recorrido WebdriverIO** (`e2e/specs/11-relaciones.e2e.js`): crear las cuatro
  relaciones por las tres vías, el resaltado con el cursor y con el teclado, el
  cambio de trazado en Ajustes, guardar y reabrir, y el reinicio que comprueba
  que el trazado elegido persiste.

**Razón**: `jsdom` no hace layout de SVG, así que lo que se puede afirmar sobre
una línea en una prueba de componente es su atributo `d`, no su forma en
pantalla; la forma se mira en el recorrido y en la revisión de los tres temas.

**Alternativa descartada**: comparar capturas de pantalla. Añade una
dependencia de imágenes y un mantenimiento por tema y por sistema operativo.

## R17 · El minimapa y la imagen exportada se quedan fuera

**Decisión**: el minimapa sigue dibujando solo tarjetas y zonas; las relaciones
no entran en él. La imagen exportada es del incremento de exportación.

**Razón**: la especificación no las pide (FR-013 a FR-020 hablan del lienzo), y
a la escala del minimapa sesenta líneas de 1,25 px son una mancha. El tablero de
diseño tampoco las dibuja ahí.

**Alternativa descartada**: pintarlas en el minimapa con una opacidad baja.
Cuesta otro cálculo de carriles a otra escala y no ayuda a situarse.

## R18 · Desvíos deliberados del tablero de diseño

Lo que este incremento hace distinto del tablero, y por qué:

1. **La tabla editada aparece como destino** (el tablero la excluye): lo pidió
   la clarificación 2, para las jerarquías.
2. **El bucle sobre la propia tarjeta** no existe en el tablero: es la
   consecuencia del punto anterior (R4).
3. **El glifo del extremo distingue «cero o muchos» y «uno»** (el tablero
   siempre dibuja uno a muchos): lo pidió la clarificación 5, para que la línea
   y el inspector digan lo mismo (R5).
4. **El aviso de SET NULL sobre una columna no nula** no está en el tablero: la
   columna propuesta nace no nula (FR-004), así que la regla sería imposible.
5. **Las fichas del panel son dos**, no cinco: «Índices», «Únicos» y «SQL»
   llegan con sus incrementos.
6. **La columna «Índice» solo informa**: el tablero muestra el mismo badge, y
   crear el índice que falta es del incremento de índices (FR-033).
7. **El nombre de la relación no se muestra**: el tablero tampoco lo pide, pero
   conviene dejar escrito que es decisión y no olvido (R10).

Del tablero se toman medidas, textos y jerarquía; su HTML, su `support.js` y su
`bundle.js` no entran al repositorio (constitución, puerta 6).
