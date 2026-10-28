---
description: "Tareas del Incremento 4 · Relaciones"
---

# Tasks: Relaciones (Incremento 4)

**Input**: documentos de diseño de `specs/005-relaciones/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`,
`contracts/`, `quickstart.md`, `.specify/memory/constitution.md`

**Tests**: sí, obligatorias. La puerta 1 de la constitución exige typecheck y
`cargo check` sin avisos, la puerta 3 exige la prueba de ida y vuelta, y
`quickstart.md` lista las diez pruebas que no pueden faltar.

**Organization**: las fases van por historia de usuario, en el orden de
prioridad del spec (P1 primero), para que cada una se pueda implementar y
demostrar sola.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: se puede ejecutar en paralelo (archivos distintos, sin dependencias
  pendientes)
- **[Story]**: a qué historia pertenece (US1 … US5)
- Cada tarea nombra sus archivos exactos

## Path Conventions

Aplicación de escritorio Tauri: frontend en `src/`, backend en `src-tauri/src/`,
pruebas junto al código que prueban (convención del Incremento 0).

## Mapa de historias

| Historia | Spec | Prioridad | Fase |
| -------- | ---- | --------- | ---- |
| US1 · Crear una clave foránea | SF-4.1 | P1 | 3 |
| US2 · Ver las relaciones | SF-4.2 | P2 | 4 |
| US3 · Resaltar relaciones | SF-4.3 | P3 | 5 |
| US4 · Reglas al eliminar y actualizar | SF-4.4 | P4 | 6 |
| US5 · Eliminar una relación | SF-4.5 | P5 | 7 |

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: dejar listas la dependencia nueva, los modelos de ejemplo y los
iconos que todo lo demás necesita.

- [X] T001 Instalar la única dependencia nueva del incremento con `npm install @radix-ui/react-tabs` y comprobar que `package.json` y `package-lock.json` quedan con una versión fija, como los otros siete paquetes de Radix (research R9, plan.md Technical Context)
- [X] T002 [P] Crear `src/lib/model/__fixtures__/modelo-relaciones.yaml`: cuatro tablas con llave primaria de una columna, una relación por cada una de las cinco acciones referenciales —`no_action`, `restrict`, `cascade`, `set_null` y `set_default`—, una relación de una tabla hacia sí misma y una relación de dos columnas, y registrarlo en `src/lib/model/__fixtures__/index.ts`
- [X] T003 [P] Crear `e2e/soporte/modelo-relaciones.yaml` —cuatro tablas en dos esquemas, dos relaciones ya hechas (una con `CASCADE`), un bucle de una tabla hacia sí misma, una tabla con llave primaria de dos columnas para el destino deshabilitado y una columna de clave foránea sin índice— y registrarlo en la preparación de la carpeta temporal de `e2e/wdio.conf.js` junto a los modelos que ya hay
- [X] T004 [P] Ampliar `src/lib/model/__fixtures__/modelo-50-tablas.yaml` con 60 relaciones repartidas entre sus tablas, al menos cuatro de ellas compartiendo el mismo hueco vertical, para medir SC-003 y probar los carriles a escala
- [X] T005 [P] Añadir a `src/components/ui/Icon.tsx` los iconos que faltan, tomados de Lucide como los demás: `corner-up-left` para «Referenciada por», `arrow-up-right` para ir a la tabla referenciada y `plus` para «Añadir clave foránea» (`git-merge` y `key-round` ya están del Incremento 3)

**Checkpoint**: dependencia, modelos de ejemplo e iconos listos; nada de esto se
ve en pantalla todavía.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: el valor nuevo del formato, la geometría pura, el dominio, el
estado, las preferencias y los dos primitivos de interfaz. Nada de esto se ve en
pantalla, y todas las historias lo necesitan.

**⚠️ CRÍTICO**: ninguna historia puede empezar antes de terminar esta fase.

### El enum de las acciones referenciales gana `set_default` (data-model.md §1, contracts/model.schema.json)

- [X] T006 Añadir `'set_default'` a `ReferentialAction` en `src/lib/model/types.ts`, con su JSDoc en español explicando que el valor por defecto sigue siendo `no_action` y que ampliar el enum no sube la versión del formato (research R11, FR-028)
- [X] T007 Aceptar `set_default` en `REFERENTIAL_ACTIONS` de `src/lib/model/validate.ts` y añadir la regla que faltaba: `fromFields` y `toFields` de una relación tienen que tener la misma longitud, con el mensaje «Una relación tiene que referenciar tantos campos como lleva.»; cubrir las dos cosas en `src/lib/model/validate.test.ts` (data-model.md §6, invariante 1)
- [X] T008 Ampliar `src/lib/model/roundtrip.test.ts` con `modelo-relaciones.yaml`: guardar y volver a cargar conserva las cuatro relaciones, las cinco acciones, el bucle y la relación de dos columnas, con `formatVersion` en 1 y las reglas en `no_action` omitidas del archivo (puerta 3, FR-040, SC-007)

### Geometría de la línea (research R1 a R5, contracts/relations.md §1.1)

- [X] T009 Crear `src/lib/canvas/relations.ts` con `relationAnchors(model, layout, relation)`: el extremo cae en el centro de la fila del campo —`y + TABLE_HEADER + FIELD_ROW_HEIGHT × índice + FIELD_ROW_HEIGHT / 2`—, el lado se decide por el hueco horizontal (`TABLE_WIDTH + GRID_SNAP`) y `kind` vale `'h'`, `'loop'` o `'self'`; con su JSDoc en español y sin medir el DOM (R1, FR-013)
- [X] T010 Añadir `assignLanes(anchors[])` a `src/lib/canvas/relations.ts`: agrupa por el canal redondeado a 60 px, reparte cada 14 px alrededor del centro del grupo, recorta el carril de un `'h'` al hueco entre las dos tarjetas y, con grupos de 2 a 5 y cruces, prueba las permutaciones y se queda con la de menos cruces; con más de 5 ordena por el extremo superior (R2, FR-016)
- [X] T011 Añadir `pathOf(anchors, lane, route)` a `src/lib/canvas/relations.ts` con los tres trazados: `'orthogonal'` → `M … H lane V … H …`, `'curved'` → cúbica con tiradores horizontales de `max(36, abs(bx − ax) / 2)`, `'straight'` → polilínea con 16 px de salida recta en cada extremo; los tres respetan el `kind: 'self'` del bucle (R3, R4, FR-013a, FR-017)
- [X] T012 Añadir `glyphOf(end, point, side)` a `src/lib/canvas/relations.ts`: `'one'` son dos barras verticales, `'many'` es la pata de gallo, `'zero-or-many'` es la pata de gallo con el círculo del cero y `'zero-or-one'` es barra con círculo; el glifo crece hacia dentro de la tarjeta según `side` (R5, FR-014)
- [X] T013 Añadir `relationLayer(model, layout, route)` y `touchedRelations(model, target)` a `src/lib/canvas/relations.ts`: la primera compone anclas, carriles, trazado y glifos y devuelve `{name, d, glyphA, glyphB, color, from, to}` con el color del esquema de `toTable`; la segunda devuelve qué relaciones hay que repintar al arrastrar una tabla o un esquema (R6, FR-015)
- [X] T014 Crear `src/lib/canvas/relations.test.ts` con los ejemplos fijados de `contracts/relations.md` §1.3 y, además: las tres `kind`, el bucle en los tres trazados, dos relaciones del mismo canal repartidas en `[253, 267]`, un grupo de cuatro donde la permutación baja los cruces, y que ningún trazado pasa por dentro del rectángulo de una tarjeta

### Dominio de la relación (research R5, R10, R13, contracts/relations.md §1.2)

- [X] T015 Partir la cardinalidad en dos en `src/lib/model/marks.ts`: `cardinalityOf(model, relation)` devuelve `{from: 'one', to: 'many' | 'zero-or-many' | 'one' | 'zero-or-one'}` leyendo el «no nulo» y la unicidad de la columna, y `relationCardinality` pasa a ser su formateador, sin cambiar el texto que el inspector ya muestra; actualizar su JSDoc y ampliar `src/lib/model/marks.test.ts` con los cuatro casos y con la afirmación de que los dos leen la misma función (R5, FR-014, SC-011)
- [X] T016 Crear `src/lib/model/relations.ts` con `proposeForeignKey(model, from, to, pattern)`: el nombre sale del patrón con `{tabla}` y `{pk}` resueltos y sufijo `_2`, `_3`… si ya existe en la tabla, `type` y `length` se copian de la llave primaria y el campo nace **no nulo**; devuelve `null` si la tabla destino no tiene llave primaria de exactamente una columna (R13, FR-004, FR-009)
- [X] T017 Añadir `relationName(table, field, existing)` a `src/lib/model/relations.ts`: `fk_<tabla>_<campo>` recortado a 63 caracteres y con sufijo numérico si choca, para que el nombre de la relación no se pida nunca al usuario (R10, FR-011)
- [X] T018 Añadir `foreignKeyTargets(model, table)` e `indexStateOf(table, field)` a `src/lib/model/relations.ts`: la primera devuelve todas las tablas del modelo —**incluida** la que se está editando— con `enabled` y el motivo cuando no tiene llave primaria o la tiene compuesta; la segunda devuelve `'indexed'` cuando el campo está solo o en primera posición en algún `indexes[]`, `uniques[]` o `primaryKey` (FR-009, FR-033)
- [X] T019 [P] Crear `src/lib/model/relations.test.ts` con los ejemplos fijados de `contracts/relations.md` §1.3: propuesta con patrón y sufijo, tipo copiado de la llave primaria, `null` con llave compuesta, nombre con choque, destinos deshabilitados con su motivo y los dos estados del índice

### Estado (research R12, contracts/relations.md §2)

- [X] T020 Crear `src/store/relations.ts` con `addForeignKey(table, target?)`, `setForeignKeyColumn(name, field)`, `setForeignKeyTarget(name, table)`, `setReferentialAction(name, key, action)`, `deleteForeignKey(name)` y `clearNotNull(table, field)`, cada una como **un** paso del historial con su etiqueta —«editar la clave foránea», «cambiar ON DELETE / UPDATE», «eliminar la clave foránea»—, y registrar la parte nueva en `src/store/index.ts`, que sigue siendo el único sitio donde vive una relación (R12, FR-012, FR-042)
- [X] T021 Implementar en `src/store/relations.ts` las reglas que las acciones no pueden romper: `addForeignKey` sin `target` elige la primera tabla a la que esta todavía no apunta y, si no queda ninguna, la propia tabla; `setForeignKeyTarget` renombra y retipa la columna **solo** si conserva el nombre que el patrón le puso; `setForeignKeyColumn` rechaza el campo referenciado cuando la relación apunta a su propia tabla; `deleteForeignKey` conserva la columna y solo le quita la marca FK si ninguna otra relación la usa (FR-005, FR-007, FR-009a, FR-035)
- [X] T022 Crear `src/store/relations.test.ts`: las seis acciones con su etiqueta y su paso único, el deshacer y rehacer de cada una, la columna que sobrevive al borrado de la relación, la marca FK que se mantiene cuando otra relación usa el campo, y que crear una relación **no** escribe ninguna marca en el campo porque `fieldMarks` la deduce (FR-012, FR-035, FR-036, SC-006)
- [X] T023 Añadir a `src/store/fieldsPanel.ts` la ficha abierta del panel —`panelTab: 'fields' | 'foreignKeys'`, con su acción para cambiarla— y dejar que `openFieldsPanel` reciba la ficha en la que abrirse; ampliar `FieldCell` para que `focusedCell` también apunte a celdas de la ficha de claves foráneas (data-model.md §3, FR-003)

### Preferencias (research R15, contracts/preferences.md)

- [X] T024 Añadir a `src-tauri/src/preferences.rs` los tres campos nuevos con `#[serde(default = "…")]` y su función de valor por defecto —`relation_route` a `"orthogonal"`, `relation_animation` a `"subtle"` y `foreign_key_pattern` a `"{tabla}_{pk}"`—, el recorte del patrón a 64 caracteres al lado del recorte del alto del panel, el valor fuera del enum que cae al valor por defecto, y `///` en español en los tres; `formatVersion` de las preferencias **sigue en 1** (FR-041)
- [X] T025 Ampliar las pruebas de `src-tauri/src/preferences.rs`: los tres campos ausentes caen a su valor por defecto sin aviso, un `relationRoute` desconocido cae a `"orthogonal"`, un patrón de 100 caracteres se recorta a 64 y un patrón vacío cae al valor por defecto
- [X] T026 Añadir los tres campos a `Preferences` y a `PreferencesPatch` en `src/lib/tauri/types.ts` y al estado y las acciones de `src/store/preferences.ts`, con su JSDoc en español y la prueba en `src/store/preferences.test.ts` de que el parche no toca lo que no nombra y de que los tres caen a su valor por defecto cuando faltan (FR-041)

### Primitivos de interfaz (research R9, puerta 7)

- [X] T027 [P] Crear `src/components/ui/Tabs.tsx`: lista de fichas sobre `@radix-ui/react-tabs`, componente **puro** —recibe las fichas, la activa y el `onChange`, y no importa del almacén—, con el contador opcional de cada ficha y los tokens de `src/styles/tokens.css`; probarlo en `src/components/ui/Tabs.test.tsx` (rol `tablist`, flechas y `aria-controls`)
- [X] T028 [P] Crear `src/components/ui/Badge.tsx`: insignia de estado con tono verde y naranja y punto opcional, para «Indexada» y «Sin índice», puro y con los tokens de estado; probarlo en `src/components/ui/Badge.test.tsx`

### El panel inferior pasa a tener fichas (research R9, FR-003, FR-034)

- [X] T029 Convertir `src/components/layout/BottomPanel.tsx` en «Editor de tabla»: la lista de fichas de `Tabs.tsx` con «Campos» y «Claves foráneas» y su contador, el contenido de la ficha activa dentro del marco que ya existe, y el tirador y el botón de cerrar sin cambios; actualizar su JSDoc
- [X] T030 Actualizar los nombres accesibles que cambian con las fichas y las pruebas que los usan —`src/components/layout/BottomPanel.test.tsx`, lo que nombre «Editor de campos» en `src/components/features/table/*.test.tsx` y el helper de `e2e/soporte/pantalla.js` si lo nombra—, según `contracts/relations.md` §5; el panel pasa a llamarse «Editor de tabla» y la rejilla de campos sigue llamándose igual

**Checkpoint**: el formato acepta las cinco acciones, la geometría y el dominio
están probados, el almacén sabe crear y borrar relaciones y el panel tiene dos
fichas, con la de claves foráneas todavía vacía.

---

## Phase 3: User Story 1 - Crear una clave foránea (Priority: P1) 🎯 MVP

**Goal**: relacionar dos tablas desde la tabla que llevará la clave, con la
columna propuesta y la línea apareciendo en el diagrama.

**Independent Test**: sobre `e2e/soporte/modelo-relaciones.yaml`, crear las
cuatro relaciones por las tres vías de entrada y comprobar el nombre y el tipo
propuestos, la marca FK en el panel y en la tarjeta, y el aviso cuando no hay
tabla seleccionada.

- [X] T031 [US1] Crear `src/components/features/table/ForeignKeysTab.tsx` con el armazón de la ficha: la rejilla de seis columnas —`Columna`, `Referencia`, `ON DELETE`, `ON UPDATE`, `Índice` y la acción de eliminar— con su fila de encabezado, el botón «Añadir clave foránea» y el texto de la tabla sin claves foráneas de `contracts/relations.md` §6 (FR-006, FR-032)
- [X] T032 [US1] Pintar en `ForeignKeysTab.tsx` una fila por clave foránea de la tabla abierta: el selector de columna con los campos de la tabla, el selector de tabla referenciada con `foreignKeyTargets` —las deshabilitadas con su motivo— y, al lado, el campo referenciado en monoespaciada y el botón «Ir a <tabla>» (FR-006, FR-009)
- [X] T033 [US1] Enganchar las acciones del almacén a la fila: el selector de columna llama a `setForeignKeyColumn`, el de tabla a `setForeignKeyTarget` y «Añadir clave foránea» a `addForeignKey`, que deja el foco en la celda «Referencia» de la fila nueva; cuando `addForeignKey` no puede crear nada, mostrar su motivo; en cuanto la fila queda con columna y referencia válidas, el campo aparece marcado FK en la ficha «Campos» y en la tarjeta y su línea en el diagrama sin ningún trabajo extra, porque las dos marcas se deducen del modelo (FR-004, FR-005, FR-007, FR-008, FR-010)
- [X] T034 [US1] Reutilizar `useGridNavigation` en `ForeignKeysTab.tsx` con sus seis columnas y la celda enfocada de `src/store/fieldsPanel.ts`: el tabulador entra y sale en una pulsación, las flechas mueven de celda y de fila, Inicio y Fin van a los extremos, Intro abre el selector de la celda y Esc lo cierra sin cambiar nada (FR-038)
- [X] T035 [P] [US1] Añadir el botón «Relación» a `src/components/layout/EditorChrome.tsx` con el icono `git-merge` y el título «Nueva relación (R)»: con una tabla seleccionada abre el panel en la ficha «Claves foráneas» y avisa «Agrega la clave foránea de <tabla>.»; sin selección muestra «Selecciona la tabla que tendrá la clave foránea.» y no cambia el modelo (FR-001 a FR-003)
- [X] T036 [P] [US1] Añadir la tecla `R` al mismo sitio donde el Incremento 3 declara `T`, con la misma regla de no actuar mientras el foco está en un campo de texto, y «Nueva clave foránea…» con el icono `key-round` a `src/components/features/table/TableContextMenu.tsx`, que abre la ficha con esa tabla ya elegida (FR-001, contracts/relations.md §4)
- [X] T037 [US1] Impedir en `ForeignKeysTab.tsx` la combinación que FR-009a prohíbe: en una relación hacia la propia tabla, el campo referenciado no se ofrece como columna y, si se intenta, la fila dice «La columna no puede ser el mismo campo al que apunta.» (FR-009a)
- [X] T038 [US1] Crear `src/components/features/table/ForeignKeysTab.test.tsx` con lo de esta historia: las seis columnas y su encabezado, la fila nueva con la columna propuesta, el destino deshabilitado con su motivo, la tabla editada presente en la lista, el mensaje de la tabla sin claves foráneas, el rechazo de FR-009a, el recorrido de la rejilla con el teclado y la afirmación de FR-010: con la fila completa, `fieldMarks` devuelve la marca FK del campo y `relationLayer` devuelve su línea
- [X] T039 [P] [US1] Ampliar `src/components/layout/EditorChrome.test.tsx` y `src/components/features/table/TableContextMenu.test.tsx`: las tres vías abren la ficha con la tabla correcta, y sin selección aparece el aviso y el modelo no cambia

**Checkpoint**: se pueden crear claves foráneas y el campo queda marcado FK en
el panel y en la tarjeta; en el lienzo todavía no hay líneas.

---

## Phase 4: User Story 2 - Ver las relaciones (Priority: P2)

**Goal**: cada relación se ve en el diagrama como una línea entre dos campos,
con su cardinalidad, su color y su trazado elegido en Ajustes.

**Independent Test**: con un modelo de cuatro tablas y cinco relaciones —dos
compartiendo hueco— comprobar los extremos, el color del esquema de la tabla con
la llave primaria, el reparto en carriles y los tres trazados de Ajustes.

- [X] T040 [US2] Crear `src/components/features/canvas/RelationsLayer.tsx`: un `<svg>` con `aria-hidden`, `pointer-events: none` y `overflow: visible` que pinta `relationLayer(model, layout, route)` —un grupo por relación con su trazo y sus dos glifos—, dentro del escenario del lienzo y **antes** de las tarjetas para que quede por debajo (FR-013 a FR-015, FR-018)
- [X] T041 [US2] Añadir a `src/styles/screens.css` las reglas de la capa: `.sm-rel` con su transición de trazo, el grosor en reposo y resaltado, el color tomado del token del esquema y los glifos con el mismo trazo que la línea; sin un solo valor literal de color (FR-015, FR-039)
- [X] T042 [US2] Montar la capa en `src/components/features/canvas/CanvasSurface.tsx` entre las zonas y las tarjetas, leyendo el trazado de las preferencias, y memorizar `relationLayer` con la misma dependencia del modelo que ya usa `resolveLayout` y `schemaZones` (FR-013, FR-019)
- [X] T043 [US2] Hacer que las líneas sigan al arrastre sin un render de React: `RelationsLayer` registra sus `path` en un mapa de refs por nombre de relación y expone `paintRelations(delta, target)`, y `continueDrag` de `CanvasSurface.tsx` lo llama justo donde ya escribe `--drag-x` y `--drag-y`, repintando solo lo que devuelve `touchedRelations`; los carriles se quedan como estaban y se recalculan al soltar (research R6, R2, SC-003)
- [X] T044 [P] [US2] Añadir «Trazado de relaciones» a `src/components/features/preferences/PreferencesWindow.tsx` con `SegmentedControl` y las tres opciones —Ortogonal, Curvas y Rectas—, escribiendo la preferencia al cambiar el control, sin esperar a cerrar la ventana y con las líneas redibujadas en menos de 100 ms (FR-017)
- [X] T045 [US2] Mostrar y conservar las relaciones que esta pantalla no edita: las de varias columnas se dibujan ancladas a su primer campo y su fila de `ForeignKeysTab.tsx` aparece en solo lectura diciendo por qué (FR-020)
- [X] T046 [US2] Crear `src/components/features/canvas/RelationsLayer.test.tsx`: cuántos `path` se pintan y con qué `d`, el color del esquema de la tabla con la llave primaria, los glifos de los cuatro casos de cardinalidad, `aria-hidden` y que la capa no captura el puntero
- [X] T047 [P] [US2] Ampliar `src/components/features/canvas/CanvasSurface.test.tsx` con el orden de pintado —zonas, líneas, tarjetas— y con el repintado del arrastre: al mover una tabla, los `path` de sus relaciones cambian de `d` y los de las demás no; y que arrastrar desde la fila de un campo hasta otra tabla no crea ni empieza ninguna relación, solo mueve la tabla (FR-001a)

**Checkpoint**: el diagrama muestra las relaciones con su cardinalidad y su
color, los tres trazados funcionan y arrastrar una tabla no despega las líneas.

---

## Phase 5: User Story 3 - Resaltar relaciones (Priority: P3)

**Goal**: pasar el cursor por una tabla —o llegar a ella con el teclado—
resalta su grupo y atenúa el resto.

**Independent Test**: con cuatro tablas y cinco relaciones, resaltar cada tabla
con el cursor, con la selección y con el teclado, y repetir con las tres
animaciones y con «Reducir movimiento» del sistema activo.

- [X] T048 [US3] Añadir a `src/components/features/canvas/CanvasSurface.tsx` el estado local `hotTable` —cursor o foco de teclado sobre una tarjeta, apagado mientras hay un gesto en curso— y derivar de él, con `relationsTouching`, qué tarjetas quedan activas, relacionadas o atenuadas y qué relaciones se resaltan (research R7, FR-021)
- [X] T049 [US3] Pasar esas clases a sus nodos: `is-hot`, `is-linked` e `is-dim` en `src/components/features/canvas/TableCard.tsx` y en la zona del esquema, e `is-dim` en los grupos de `RelationsLayer.tsx`; el foco y el desenfoque de la tarjeta usan los mismos manejadores que el cursor (FR-021, FR-022)
- [X] T050 [US3] Añadir a `src/styles/screens.css` el atenuado y el realce con los valores del tablero —0,28 en tarjetas, 0,35 en zonas y 0,15 en líneas, anillo completo en la activa y más tenue en las relacionadas, cabecera teñida— como tokens de la hoja, con transición de opacidad (FR-021, FR-022)
- [X] T051 [US3] Marcar en `TableCard.tsx` los campos que forman cada relación resaltada, en la tabla de origen y en la de destino, con el relleno de la fila del campo que el tablero usa (FR-023)
- [X] T052 [US3] Añadir a `RelationsLayer.tsx` el trazo del flujo de las relaciones resaltadas y las etiquetas de cardinalidad junto a sus extremos —`1 / N`, `1 / 0..N` o `1 / 1`, tomadas de `cardinalityOf`—, y a `src/styles/screens.css` la animación en `@keyframes` con los tres niveles por clase del escenario y la regla `@media (prefers-reduced-motion: reduce)` que la apaga (research R8, FR-024, FR-025)
- [X] T053 [P] [US3] Añadir «Animación de relaciones» a `src/components/features/preferences/PreferencesWindow.tsx` con `SegmentedControl` y las tres opciones —Apagada, Sutil y Viva— y la pista «Los puntos que fluyen por las relaciones activas.» (FR-024)
- [X] T054 [US3] Hacer que el foco de esquema del Incremento 2 resalte con estas mismas reglas en lugar de con las suyas, para que el lienzo tenga un solo camino de atenuado (FR-027)
- [X] T055 [US3] Ampliar `src/components/features/canvas/CanvasSurface.test.tsx` y `src/components/features/canvas/TableCard.test.tsx` con el resaltado: qué tarjetas quedan en cada clase al pasar el cursor y al enfocar con el teclado, los campos marcados en las dos tablas, el resaltado apagado durante un gesto, el foco de esquema usando el mismo camino, y que al quitar el cursor y la selección no queda ni una clase atenuada en tarjetas, zonas ni líneas (FR-026)
- [X] T056 [P] [US3] Ampliar `src/components/features/preferences/PreferencesWindow.test.tsx` con los dos controles nuevos: cada opción escribe su preferencia y el valor guardado llega marcado al abrir la ventana

**Checkpoint**: el diagrama se lee de un vistazo; con «Reducir movimiento» el
resaltado llega igual sin animarse.

---

## Phase 6: User Story 4 - Reglas al eliminar y actualizar (Priority: P4)

**Goal**: elegir ON DELETE y ON UPDATE de cada clave foránea, ver qué tablas
referencian a esta y saber si la columna está indexada.

**Independent Test**: sobre una tabla con dos claves foráneas, cambiar las
reglas, guardar y reabrir el modelo, y comprobar «Referenciada por» desde la
tabla referenciada.

- [X] T057 [US4] Añadir a cada fila de `src/components/features/table/ForeignKeysTab.tsx` los selectores ON DELETE y ON UPDATE con las cinco acciones —`NO ACTION`, `RESTRICT`, `CASCADE`, `SET NULL` y `SET DEFAULT`, en mayúsculas porque son palabras de SQL—, enganchados a `setReferentialAction` y empezando los dos en `NO ACTION` (FR-028, FR-029)
- [X] T058 [US4] Mostrar el aviso de FR-030 en la fila cuando la regla es `SET NULL` y la columna no admite nulos: «La columna no admite nulos, así que SET NULL no podrá aplicarse.», con la salida «Quitar «no nulo»» que llama a `clearNotNull`; la regla se guarda igual (FR-030)
- [X] T059 [P] [US4] Crear `src/components/features/table/ReferencedByList.tsx`: las tablas que referencian a la abierta, cada una con la abreviatura y el color de su esquema y el nombre `tabla.columna`, y pulsar una selecciona esa tabla en el lienzo; la sección no se muestra cuando no hay ninguna (FR-031, FR-032)
- [X] T060 [US4] Mostrar en la columna «Índice» de cada fila la insignia de `indexStateOf` con `Badge.tsx` —«Indexada» en verde y «Sin índice» en naranja—, sin ofrecer crear el índice, que es del incremento siguiente (FR-033)
- [X] T061 [US4] Poner el contador de la ficha «Claves foráneas» en `src/components/layout/BottomPanel.tsx` con las relaciones cuyo `fromTable` es la tabla abierta, igual que el contador de «Campos» (FR-034)
- [X] T062 [US4] Ampliar `src/components/features/table/ForeignKeysTab.test.tsx` con esta historia: las cinco acciones en los dos selectores, el aviso de SET NULL con su salida y la regla que se guarda igual, las dos insignias del índice y el contador de la ficha
- [X] T063 [P] [US4] Crear `src/components/features/table/ReferencedByList.test.tsx`: las tablas listadas con su abreviatura y su columna, la navegación al pulsar una y la sección ausente cuando nadie referencia a la tabla

**Checkpoint**: las reglas se eligen, se guardan y se leen; la ficha dice quién
referencia a la tabla y si la columna está indexada.

---

## Phase 7: User Story 5 - Eliminar una relación (Priority: P5)

**Goal**: quitar una clave foránea sin perder la columna, y poder deshacerlo.

**Independent Test**: sobre una tabla con dos claves foráneas, eliminar una y
comprobar la línea que desaparece, la columna que se queda sin marca FK y el
deshacer; repetir con una columna que usan dos relaciones.

- [X] T064 [US5] Añadir a cada fila de `src/components/features/table/ForeignKeysTab.tsx` el botón de eliminar con el icono `trash-2`, el nombre accesible «Eliminar la clave foránea» y el título «Eliminar la clave foránea (el campo se conserva)», enganchado a `deleteForeignKey` (FR-035, contracts/relations.md §5)
- [X] T065 [US5] Comprobar que eliminar deja el lienzo y el panel coherentes: la línea desaparece de `RelationsLayer.tsx`, la marca FK se va de la tarjeta y de la ficha «Campos» —o se mantiene si otra relación usa el campo— y la fila se va de la rejilla sin mover el foco fuera del panel; las cuatro vistas —lienzo, inspector, ficha «Campos» y ficha «Claves foráneas»— dicen lo mismo en cada paso (FR-035, FR-042)
- [X] T066 [P] [US5] Ampliar `src/components/features/table/ForeignKeysTab.test.tsx` y `src/store/relations.test.ts` con el borrado: la columna conservada con todas sus propiedades, la marca FK que se mantiene con dos relaciones sobre el mismo campo, y el deshacer que devuelve la relación con sus dos reglas (FR-035, FR-036)
- [X] T067 [US5] Comprobar que las confirmaciones del Incremento 3 siguen contando bien ahora que hay relaciones de verdad: eliminar la tabla o el campo nombra las relaciones que se van y se las lleva en el mismo paso deshacible, con la prueba en `src/components/features/table/DeleteTableDialog.test.tsx` y `src/components/features/table/DeleteFieldDialog.test.tsx` (FR-037)

**Checkpoint**: las cinco historias funcionan; queda el recorrido, las medidas y
el cierre.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: el recorrido, las revisiones a mano, las medidas y el cierre del
incremento.

- [X] T068 Crear `e2e/specs/11-relaciones.e2e.js` con los doce escenarios de `quickstart.md`: las tres vías de entrada, relacionar cuatro tablas, la tabla consigo misma, el destino imposible, resaltar con cursor y teclado, trazado y animación, las reglas con el aviso de SET NULL, «Referenciada por», eliminar y deshacer, guardar y reabrir, el reinicio de las preferencias y el arrastre con 60 relaciones; al reabrir, las relaciones, sus reglas, sus marcas FK y el trazado y la animación elegidos siguen como se dejaron (SC-007)
- [X] T069 Ejecutar el recorrido completo en macOS (`npm run build && npm run e2e`) y arreglar lo que saque en `e2e/specs/11-relaciones.e2e.js` y en el código que señale, con atención a los nombres accesibles que cambian con las fichas del panel
- [X] T070 [P] Revisar en tema claro, tema oscuro y con «Reducir movimiento» la ficha «Claves foráneas», las líneas con sus glifos, el resaltado y los dos controles nuevos de Ajustes, sin texto de contenido por debajo de 4,5:1 ni metadatos de 10–11 px por debajo de 3:1, y sin línea de relación por debajo de 3:1 contra el fondo del lienzo; y sobre `modelo-50-tablas.yaml`, con sus 60 relaciones y al menos cuatro compartiendo hueco, comprobar que ninguna línea atraviesa una tarjeta y que las del mismo canal se distinguen una de otra (SC-005, SC-010, puerta 5)
- [X] T071 [P] Provocar a mano los seis estados de `contracts/relations.md` §6 —sin tabla seleccionada, tabla sin claves foráneas, sin «Referenciada por», destino sin llave primaria, destino con llave compuesta y SET NULL sobre una columna no nula— y comprobar que cada uno muestra su mensaje y deja al menos una salida clara, anotando aquí lo que se vio (SC-009)
- [X] T072 [P] Recorrer el incremento entero solo con el teclado, con foco visible en cada paso, incluidas la rejilla de `ForeignKeysTab.tsx` y la lista de fichas del panel, y arreglar lo que falte (SC-008, puerta 4)
- [X] T073 Medir SC-003 y SC-004 con `modelo-50-tablas.yaml` y sus 60 relaciones: arrastrar una tabla a 60 cuadros por segundo con las líneas pegadas, y el resaltado del grupo por debajo de 100 ms, anotando las cifras en este archivo con el Modo de bajo consumo del sistema **apagado**
- [X] T074 [P] Cronometrar los tiempos de `quickstart.md`: crear una clave foránea en tres pasos (SC-002) y la demostración completa —cuatro relaciones, resaltar una y cambiar sus reglas— en menos de 5 minutos (SC-001), y el cambio de trazado en Ajustes, que tiene que redibujar todas las líneas en menos de 100 ms con la ventana abierta (FR-017)
- [X] T075 [P] Comprobar a mano SC-011 sobre `modelo-relaciones.yaml`: en las cuatro combinaciones de columna —no nula, nulable, única y única nulable— el glifo del extremo y el texto del inspector dicen lo mismo
- [X] T076 [P] Repasar la puerta 8 en todo lo nuevo de `src/` y `src-tauri/src/preferences.rs`: JSDoc en español en cada función pura, componente, acción del almacén y campo, y `///` en los tres campos de Rust, incluidos los bloques de `relationCardinality`, `BottomPanel` y `CanvasSurface`, que cambian de comportamiento
- [X] T077 [P] Repasar la puerta 6: ningún archivo del tablero copiado al repositorio, y los siete desvíos deliberados de `specs/005-relaciones/research.md` R18 siguen siendo los únicos
- [X] T078 Pasar las cinco puertas en limpio desde la raíz y desde `src-tauri/`: `npx tsc --noEmit`, `npm run lint`, `npx vitest run`, `cargo check` y `cargo test`
- [X] T079 Subir la versión del producto a `1.4.0` en `package.json`, `src-tauri/tauri.conf.json` y `src-tauri/Cargo.toml` —los tres dicen `1.3.0`, así que este cambio cierra también el desajuste con la etiqueta `v1.3.1`— y actualizar `README.md` con lo que el Editor hace ahora
- [X] T080 Renombrar el job «Los ocho escenarios» de `.github/workflows/recorrido.yml`, que ya son doce archivos, y comprobar que el workflow ejecuta el archivo nuevo
- [ ] T081 Abrir el PR hacia `main`, esperar `.github/workflows/puertas.yml` y `.github/workflows/recorrido.yml` en verde en las dos plataformas, y dejar la etiqueta anotada `v1.4.0` sobre el commit que cierra el incremento (constitución, Versión del producto y etiquetas)

---

## Dependencies & Execution Order

### Dependencias entre fases

- **Fase 1 · Setup**: sin dependencias, empieza de inmediato. T001 bloquea T027.
- **Fase 2 · Foundational**: depende de la Fase 1 y **bloquea todas las
  historias**. Dentro de ella: T006 antes de T007 y T008; T009 antes de T010 a
  T013; T015 a T018 antes de T020; T020 y T021 antes de T022; T024 antes de T026;
  T027 antes de T029; T029 antes de T030.
- **Fases 3 a 7 · Historias**: todas dependen de la Fase 2 cerrada.
- **Fase 8 · Polish**: depende de las cinco historias.

### Dependencias entre historias

- **US1 (P1)**: solo necesita la Fase 2. Es el MVP: sin ella no hay relaciones
  que ver, resaltar, regular ni eliminar.
- **US2 (P2)**: necesita relaciones en el modelo, así que se prueba con las que
  trae `modelo-relaciones.yaml` aunque US1 no esté. Toca solo archivos del
  lienzo, así que **puede ir en paralelo con US1**.
- **US3 (P3)**: necesita las líneas de US2 para atenuarlas; sin US2 el resaltado
  solo se ve en las tarjetas.
- **US4 (P4)** y **US5 (P5)**: necesitan filas en la ficha, que es US1.

### La dependencia no obvia

**US1, US4 y US5 escriben el mismo archivo**,
`src/components/features/table/ForeignKeysTab.tsx`, y su misma prueba. No se
pueden paralelizar entre ellas aunque sus requisitos sean independientes: van en
orden de prioridad. Lo que sí se reparte es el otro eje: **US2 y US3 solo tocan
`features/canvas/` y `screens.css`**, así que una persona puede llevar la ficha
(US1 → US4 → US5) mientras otra lleva el lienzo (US2 → US3), y las dos ramas
solo se encuentran en `RelationsLayer.tsx`, que US5 lee pero no cambia.

Las otras dos que no se ven venir:

- **T043 toca `continueDrag`**, que es código del Incremento 2 y del 3; es la
  única tarea del incremento que entra en un manejador caliente, y por eso su
  medida (T073) es la que puede obligar a volver sobre ella.
- **T030 cambia nombres accesibles que ya usan pruebas verdes**; si se deja para
  después de las historias, la Fase 8 empieza con pruebas rojas que no son del
  trabajo nuevo. Va en la Fase 2 a propósito.

### Oportunidades de paralelismo

- Fase 1: T002 a T005 en paralelo, después de T001.
- Fase 2: el bloque de geometría (T009 a T014) en paralelo con el de
  preferencias (T024 a T026) y con los primitivos (T027, T028); T019 es hoja, y
  T025 va detrás de T024 porque es el mismo archivo.
- Fases 3 a 7: la rama de la ficha y la rama del lienzo, como arriba.
- Fase 8: T070 a T072 y T074 a T077 en paralelo; T069, T073, T078 y T081 en
  serie.

---

## Parallel Example: Fase 2

```bash
# Geometría, preferencias y primitivos no se tocan entre sí:
Tarea: "T009 relationAnchors en src/lib/canvas/relations.ts"
Tarea: "T024 los tres campos en src-tauri/src/preferences.rs"
Tarea: "T027 src/components/ui/Tabs.tsx"
Tarea: "T028 src/components/ui/Badge.tsx"
```

## Parallel Example: dos ramas de trabajo

```bash
# Rama de la ficha:
Tarea: "T031 a T039 — ForeignKeysTab y las tres vías de entrada (US1)"
# Rama del lienzo, a la vez:
Tarea: "T040 a T047 — RelationsLayer y el trazado (US2)"
```

---

## Implementation Strategy

### MVP primero (US1 sola)

1. Fase 1 · Setup.
2. Fase 2 · Foundational, completa: es lo que bloquea todo.
3. Fase 3 · US1.
4. **Parar y validar**: crear una clave foránea desde las tres vías, ver la
   marca FK en el panel y en la tarjeta, deshacer.
5. A partir de aquí el incremento ya guarda relaciones en el archivo, aunque el
   lienzo todavía no las dibuje.

### Entrega incremental

1. Setup + Foundational → base lista.
2. US1 → la relación se crea y se guarda (MVP).
3. US2 → la relación se ve en el diagrama.
4. US3 → el diagrama se lee de un vistazo.
5. US4 → las reglas y la vuelta («Referenciada por»).
6. US5 → el ciclo de vida cerrado.
7. Fase 8 → recorrido, medidas y cierre.

### Con dos personas

1. Las dos cierran Setup y Foundational juntas, repartiendo los tres bloques
   paralelos de la Fase 2.
2. Después: una lleva la ficha (US1 → US4 → US5) y otra el lienzo (US2 → US3).
3. Se encuentran en T065, que comprueba que borrar una relación limpia las dos
   mitades.

---

## Notes

- Las tareas `[P]` son de archivos distintos y sin dependencias pendientes.
- Cada historia se puede demostrar sola en su checkpoint.
- Confirmar que una prueba falla antes de implementar lo que la pone verde.
- Comentar en español, con JSDoc en todo símbolo nuevo o modificado (puerta 8).
- Hacer un commit por tarea o por grupo lógico, con el prefijo `005` del
  incremento.
- Nada de valores literales de color, radio o duración: todo token (puerta 5).

---

## Medidas del cierre (2026-10-28)

Tomadas con la aplicación en marcha, conducida por el servidor de WebDriver que
el binario monta con `--features webdriver`, sobre `modelo-relaciones.yaml`
—cuatro tablas, tres relaciones y un bucle—, `modelo-50-tablas.yaml` —cincuenta
tablas y sesenta relaciones— y un modelo de cardinalidades escrito para la
ocasión, con el Modo de bajo consumo del sistema **apagado**.

**T069 · El recorrido completo.** Los doce archivos de `e2e/specs/` en verde,
55 s. Lo que sacó y hubo que arreglar, en el producto: la tabla seleccionada y
el editor de tabla sobrevivían al cambio de modelo, así que «Relación» pedía la
clave foránea de una tabla del modelo anterior (`src/store/model.ts`, con su
prueba en `src/store/model.test.ts`); y el seguimiento del borde leía
`getBoundingClientRect` por cuadro del arrastre, lo que forzaba un recálculo de
disposición y se comía el presupuesto de SC-003 (`src/hooks/useCanvasView.ts`).
Y tres del propio recorrido: `esperarTexto` lee el texto visible, así que un
`aria-label` como «Secciones de la tabla» nunca aparece; Ajustes se cierra con
Escape y no con «Cerrar»; y `elegir` navega con las flechas, que saltan las
opciones deshabilitadas y acaban eligiendo otra —para eso está el helper nuevo
`opciones()` de `e2e/soporte/pantalla.js`—.

**T070 · SC-010.** Las tres superficies nuevas, en tema claro y en tema oscuro,
midiendo cada texto visible contra su fondo compuesto:

| Superficie | Contenido (claro / oscuro) | Metadatos de 10–11 px (claro / oscuro) |
| ---------- | -------------------------- | -------------------------------------- |
| Ficha «Claves foráneas» con «Referenciada por» | 4.90:1 / 5.79:1 | 4.61:1 / 5.79:1 |
| La misma con el aviso de SET NULL y su salida | 4.90:1 / 5.79:1 | 4.56:1 / 4.87:1 |
| Ajustes con los dos controles nuevos | 4.90:1 / 5.79:1 | 5.99:1 / 7.53:1 |

El trazo de la línea más tenue contra el fondo del lienzo da 4.02:1 en claro y
4.57:1 en oscuro, por encima del 3:1 de un elemento gráfico. La medida sacó un
incumplimiento: el contador de la ficha inactiva iba en `--label-tertiary` y a
12 px se quedaba en 3.40:1, por debajo del 4.5:1 de contenido; ahora va en
`--label-secondary` y el activo en `--label` (`src/styles/aura.css`).

**T070b · SC-005, con un límite anotado.** Sobre `modelo-50-tablas.yaml`, con
sus 60 relaciones, 50 tarjetas, dos canales de cuatro o más líneas y 60 trazos
distintos: ninguna de las 60 líneas tiene su tramo vertical dentro de una
tarjeta, porque `assignLanes` ahora aparta el carril al pasillo libre más
cercano (`avoidTables`, probado en `src/lib/canvas/relations.test.ts`). En el
modelo del incremento ningún tramo de ninguna línea pisa una tarjeta.

Lo que **no** cumple: en el modelo de carga, 20 de las 60 relaciones unen
tablas separadas por varias columnas, y su tramo **horizontal** —el que sale de
la tarjeta a la altura del campo— cruza las tarjetas que quedan en medio.
Esquivarlas pide un trazado de cinco tramos que baje por el pasillo entre filas,
que es otro enrutador y no el de tres tramos que decidió research R3. Queda
anotado como T082.

**T071 · Los seis estados de `contracts/relations.md` §6**, provocados uno a
uno:

| Estado | Lo que se vio |
| ------ | ------------- |
| Sin tabla seleccionada | «Selecciona la tabla que tendrá la clave foránea.», y el modelo no cambia |
| Tabla sin claves foráneas | «Esta tabla no referencia a otras.» con la salida «Añadir clave foránea» |
| Sin «Referenciada por» | La sección no se dibuja: `pagos` no la trae y `pedidos` sí |
| Destino sin llave primaria | «sin_clave no tiene llave primaria.» en la opción, deshabilitada |
| Destino con llave compuesta | «pedido_lineas tiene llave primaria de varias columnas.», deshabilitada |
| SET NULL sobre columna no nula | El aviso con «Quitar «no nulo»», que lo resuelve y hace desaparecer el aviso |

**T072 · SC-008.** La rejilla de claves foráneas tiene una sola parada de
tabulador (una celda con `tabindex="0"` y seis con `-1`) y las flechas recorren
sus seis celdas en orden —Columna, Tabla referenciada, ON DELETE, ON UPDATE,
Índice y Eliminar—, cada una con su anillo de foco; la lista de fichas del panel
cambia de ficha con las flechas. El tabulador entre controles que no son campos
de texto depende del ajuste «Usar la navegación por teclado» de macOS, que el
recorrido no toca: por eso el paseo se comprobó con el tabindex rotatorio y las
flechas, que es lo que el incremento añade.

**T073 · SC-003 y SC-004.** Arrastrando una tabla del modelo de carga, con sus
60 relaciones: 39 cuadros medidos, 0.05 ms de media y 1 ms el peor, contra los
16 ms del presupuesto. El primer movimiento, que cruza el umbral y apunta el
gesto en el almacén, cuesta 21 ms y no se cuenta: es un render del lienzo, no un
cuadro del gesto. El resaltado del grupo al pasar el cursor llega en 13 ms,
contra los 100 de SC-004.

**T074 · FR-017.** Cambiar el trazado con la ventana de Ajustes abierta
redibuja las 60 líneas en 20 ms, contra los 100 ms que pide FR-017; las tres
opciones y las tres de animación quedan escritas en `preferences.json` y vuelven
marcadas al reabrir (escenario 11 del recorrido). Crear una clave foránea son
tres pasos —abrir la ficha, «Añadir clave foránea» y elegir el destino— y la
demostración entera del `quickstart.md` corre en 5,4 s de reloj de máquina, muy
por debajo de los 5 minutos de SC-001.

**T075 · SC-011.** Las cuatro combinaciones de columna, con el glifo del lienzo
y el texto del inspector leídos a la vez:

| Columna | Glifo del extremo | Inspector |
| ------- | ----------------- | --------- |
| Única y no nula | `1` | «Uno a uno» |
| Única y nulable | `0..1` | «Uno a cero o uno» |
| No única y no nula | `N` | «Uno a muchos» |
| No única y nulable | `0..N` | «Uno a cero o muchos» |

**T076 · Puerta 8.** Todo lo nuevo de `src/` lleva su bloque: las funciones
puras y las acciones del almacén con JSDoc propio, y los componentes con el
bloque de módulo que los documenta, que es la convención del repositorio. Los
tres campos nuevos de `src-tauri/src/preferences.rs` —`relation_route`,
`relation_animation` y `foreign_key_pattern`— llevan `///`.

**T077 · Puerta 6.** Ningún archivo del tablero en el repositorio: no hay
`support.js` ni `bundle.js` fuera de `node_modules`. Los siete desvíos de
`research.md` R18 siguen siendo los únicos; el contador de la ficha cambió de
token por contraste (T070), que es un ajuste del sistema Aura y no un desvío del
tablero.

**T078 · Las cinco puertas.** `npx tsc --noEmit`, `npm run lint` (195 archivos),
`npx vitest run` (818 pruebas en 77 archivos), `cargo check` y `cargo test` (72
pruebas), todas en verde.

## Trabajo pendiente detectado al cerrar

- [ ] T082 Esquivar las tarjetas también con el tramo horizontal de la línea ortogonal: hoy 20 de las 60 relaciones de `modelo-50-tablas.yaml` cruzan una tarjeta intermedia cuando las dos tablas están a varias columnas de distancia, porque el trazado de tres tramos de research R3 solo aparta el tramo vertical (`src/lib/canvas/relations.ts`, FR-016, SC-005)
