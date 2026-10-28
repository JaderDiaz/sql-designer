---
description: "Tareas del Incremento 2 · Lienzo y esquemas"
---

# Tasks: Lienzo y esquemas (Incremento 2)

**Input**: documentos de diseño de `specs/003-lienzo-esquemas/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`,
`contracts/`, `quickstart.md`, `.specify/memory/constitution.md`

**Tests**: sí, obligatorias. La puerta 1 de la constitución exige typecheck y
`cargo check` sin avisos, la puerta 3 exige la prueba de ida y vuelta, y
`quickstart.md` lista las trece pruebas que no pueden faltar.

**Organization**: las fases van por historia de usuario, en el orden de
prioridad del spec (P1 primero), para que cada una se pueda implementar y
demostrar sola.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: se puede ejecutar en paralelo (archivos distintos, sin dependencias
  pendientes)
- **[Story]**: a qué historia pertenece (US1 … US6)
- Cada tarea nombra sus archivos exactos

## Path Conventions

Aplicación de escritorio Tauri: frontend en `src/`, backend en `src-tauri/src/`,
pruebas junto al código que prueban (convención del Incremento 0).

## Mapa de historias

| Historia | Spec | Prioridad | Fase |
| -------- | ---- | --------- | ---- |
| US1 · Estructura del Editor y modelo vacío | SF-2.1 | P1 | 3 |
| US2 · Crear y editar un esquema | SF-2.3 | P2 | 4 |
| US3 · Zonas de esquema en el lienzo | SF-2.5 | P3 | 5 |
| US4 · Navegar el lienzo | SF-2.2 | P4 | 6 |
| US5 · Enfocar un esquema | SF-2.6 | P5 | 7 |
| US6 · Eliminar un esquema | SF-2.4 | P6 | 8 |

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: dejar listo lo que todo lo demás necesita, antes de tocar código.

- [X] T001 Instalar la única dependencia nueva del incremento: `npm install @radix-ui/react-switch` (research.md R14). Confirmar que `package-lock.json` queda al día, porque CI usa `npm ci`
- [X] T002 [P] Exponer en `tailwind.config.js` los cuatro tokens de color que faltan para la paleta: `pink`, `yellow`, `brown` y `gray`, cada uno apuntando a su variable de `src/styles/tokens.css` (research.md R7)
- [X] T003 [P] Añadir a `src/lib/model/__fixtures__/index.ts` tres modelos de ejemplo: uno con tablas en tres esquemas de colores distintos y un cuarto esquema vacío, uno con `schemas[].position` en el esquema vacío y `tables[].position` en todas, y uno con posiciones imposibles (negativas y enormes)
- [X] T004 [P] Crear `e2e/soporte/modelo-esquemas.yaml`: tres esquemas con tablas y color, un cuarto vacío, y registrarlo en la preparación de la carpeta temporal de `e2e/wdio.conf.js` junto a los modelos que ya hay

**Checkpoint**: dependencia disponible, tokens completos y modelos de ejemplo
listos para las pruebas.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: el formato del archivo, la geometría pura, el estado y los
primitivos de interfaz. Nada de esto se ve en pantalla, y todas las historias lo
necesitan.

**⚠️ CRÍTICO**: ninguna historia puede empezar antes de terminar esta fase.

### El campo nuevo del formato (data-model.md §1, contracts/model.schema.json)

- [X] T005 Añadir `position?: Position` a `Schema` en `src/lib/model/types.ts`, con su JSDoc en español diciendo que solo existe mientras el esquema no tiene tablas (FR-026a)
- [X] T006 Aceptar `position` en el esquema en `src/lib/model/validate.ts`: añadirla a `ALLOWED_KEYS.schema` y validar su forma con las mismas reglas que la de la tabla — «La posición solo admite «x» e «y».» y ««x» de la posición tiene que ser un número.» (data-model.md §6)
- [X] T007 Escribir `position` en su orden en `src/lib/model/serialize.ts`: `name`, `abbreviation`, `color`, `position`, `comment` (data-model.md §1.1)
- [X] T008 Podar en `src/lib/model/parse.ts` la `position` de todo esquema que tenga al menos una tabla, sin tratar el archivo como inválido, para que el modelo en memoria nunca lleve un dato que el archivo no deba tener (research.md R6, data-model.md §1.2)
- [X] T009 Ampliar `src/lib/model/parse.test.ts`: la posición se lee en un esquema vacío, se descarta en uno con tablas, y una clave desconocida o una `x` no numérica sí invalidan el archivo (FR-026a, FR-044)
- [X] T010 Ampliar `src/lib/model/roundtrip.test.ts` con un modelo que trae `schemas[].position` y `tables[].position`: parsear → serializar → parsear da el mismo modelo y el mismo texto (puerta 3, FR-044)

### Paleta y propuesta de nombres (data-model.md §5, contracts/canvas.md §1)

- [X] T011 [P] Crear `src/lib/model/colors.ts` con `SchemaColor`, los once colores en orden (`gray` Grafito, `blue` Azul, `indigo` Índigo, `purple` Morado, `pink` Rosa, `red` Rojo, `orange` Naranja, `yellow` Amarillo, `brown` Marrón, `green` Verde, `teal` Teal), `DEFAULT_SCHEMA_COLOR = 'indigo'` y `resolveSchemaColor(color)` que cae al color por defecto con un identificador desconocido (FR-021)
- [X] T012 [P] Crear `src/lib/model/colors.test.ts`: los once identificadores están, el orden es el declarado, y un identificador que no existe cae a `indigo` sin lanzar
- [X] T013 [P] Crear `src/lib/model/propose.ts` con `toTechnicalName(name)` —sin acentos, minúsculas, lo que no es letra ni número pasa a guion bajo, no empieza por número, tope de `TECHNICAL_NAME_MAX_LENGTH` (63)— y `toAbbreviation(name)` —iniciales de las tres primeras palabras, o las tres primeras letras si hay una sola, en mayúsculas, rellenando con `X` si no llegan a tres— (FR-016, FR-043)
- [X] T014 [P] Crear `src/lib/model/propose.test.ts` con la tabla de `contracts/canvas.md` §1: «Ventas y cobros» → `ventas_y_cobros` / `VYC`, «Unidad residencial» → `unidad_residencial` / `URE`, «Área 51» → `area_51` / `A51`, «3 puertas» → `_3_puertas` / `3PU`, y el vacío devuelve cadena vacía

### Geometría pura del lienzo (research.md R4, R5, R10)

- [X] T015 [P] Crear `src/lib/canvas/constants.ts` con las medidas del lienzo: `TABLE_WIDTH = 200`, `TABLE_HEIGHT = 64`, `ZONE_PADDING = 20`, `ZONE_HEADER = 40`, `EMPTY_ZONE_WIDTH = 240`, `EMPTY_ZONE_HEIGHT = 180`, `ZOOM_MIN = 0.4`, `ZOOM_MAX = 2`, `FIT_MARGIN = 48`, y los tipos `Rect` y `View`
- [X] T016 Crear `src/lib/canvas/layout.ts` con `resolveLayout(model)`: devuelve la posición de cada tabla —la del archivo si la trae— y, para las que no, una rejilla de tres columnas por esquema con 40 px de separación, cada esquema a la derecha del anterior con 80 px de aire. Determinista y sin mutar el modelo (FR-013, FR-028)
- [X] T017 Crear `src/lib/canvas/geometry.ts` con `SchemaZone`, `schemaZones(model, layout)` —envolvente de las tablas más `ZONE_PADDING` a los lados y abajo y `ZONE_HEADER` arriba; una zona vacía toma `schemas[].position` o la posición determinista por su orden, con tamaño `EMPTY_ZONE_*`— y `contentBounds(zones)`, que devuelve `null` con un modelo sin nada (FR-023 a FR-026a)
- [X] T018 Crear `src/lib/canvas/zoom.ts` con `clampZoom(zoom)`, `zoomAt(view, zoom, pointer)` —el punto del modelo bajo el puntero sigue bajo el puntero— y `fitToContent(bounds, viewport)` —deja todo dentro con `FIT_MARGIN`, recorta a los topes y, con `bounds` nulo, devuelve `{ pan: {x: 0, y: 0}, zoom: 1 }`— (FR-008 a FR-011)
- [X] T019 [P] Crear `src/lib/canvas/layout.test.ts`: el mismo modelo da el mismo mapa, la posición del archivo se respeta sin tocar, las zonas resultantes no se solapan y el modelo no se muta (FR-013, FR-028)
- [X] T020 [P] Crear `src/lib/canvas/geometry.test.ts`: la zona envuelve sus tablas con el margen exacto, el alto mínimo con una sola tabla deja sitio al rótulo, la zona vacía mide 240 × 180, y las zonas salen en el orden del modelo (FR-023 a FR-025)
- [X] T021 [P] Crear `src/lib/canvas/zoom.test.ts`: los topes 40 % y 200 %, el punto bajo el puntero no se mueve, «Ajustar» con posiciones negativas y enormes las trae a la vista, y el modelo vacío da 100 % centrado (FR-008 a FR-011, SC-004)

### Estado (data-model.md §3, research.md R2)

- [X] T022 Crear `src/store/canvas.ts` con `createCanvasSlice`: `pan`, `zoom`, `focusedSchema`, `selectedSchema`, `isGesturing`, `isSidebarHidden`, `isInspectorHidden` y las acciones de `contracts/canvas.md` §2.1 (`setView`, `zoomBy`, `zoomTo`, `fitToModel`, `focusSchema`, `selectSchema`, `setGesturing`, `toggleSidebar`, `toggleInspector`)
- [X] T023 Crear `src/store/schemas.ts` con `createSchemasSlice`: `createSchema`, `updateSchema`, `deleteSchema` y `moveSchema`, cada una con su paso de historial etiquetado («crear el esquema», «editar el esquema», «eliminar el esquema», «mover el esquema» / «mover las tablas del esquema») y midiendo `isDirty` contra el modelo del archivo, como hace `renameModel` (contracts/canvas.md §2.2, research.md R16). Las cuatro se prueban en la fase de su historia —T046, T055 y T079—, porque cada prueba necesita el escenario completo de esa historia; aquí solo entran su firma, su efecto en el modelo y su paso de historial
- [X] T024 Componer las dos partes nuevas en `src/store/index.ts` y `src/store/types.ts`, en el orden del almacén existente
- [X] T025 Quitar el foco solo cuando desaparece su esquema o se cierra el modelo: en `src/store/schemas.ts` (`deleteSchema`) y en `src/store/model.ts` (`closeModel`, `openModel`, `createModel`), que además dejan la vista ajustada al modelo nuevo (FR-014, FR-032)

### Preferencias de la disposición (contracts/preferences.md)

- [X] T026 [P] Añadir `sidebar_hidden` e `inspector_hidden` a `Preferences` y a `PreferencesPatch` en `src-tauri/src/preferences.rs`, con `#[serde(default)]`, su `///` en español y su rama en `apply_patch`. `FORMAT_VERSION` sigue en `1`
- [X] T027 [P] Añadir las pruebas en `src-tauri/src/preferences.rs`: un `preferences.json` sin los campos nuevos los lee como `false` y no genera `.bak`, y un parche cambia uno sin tocar el otro
- [X] T028 Reflejar los dos campos en `src/lib/tauri/types.ts` (`Preferences` y el parche) y en `DEFAULT_PREFERENCES` de `src/store/preferences.ts`

### Primitivos del sistema de diseño (principio V, research.md R14)

- [X] T029 [P] Crear `src/components/ui/Switch.tsx` sobre `@radix-ui/react-switch`: puro, con etiqueta y pista opcionales, `role="switch"` del propio primitivo y estilos de token. No importa del almacén ni de `features` (puerta 7)
- [X] T030 [P] Crear `src/components/ui/ColorSwatches.tsx` sobre `@radix-ui/react-radio-group`: recibe la lista de colores con su nombre y el seleccionado, cada muestra con su nombre accesible («Índigo») y el grupo con `aria-label`. Puro, sin conocer la paleta del modelo
- [X] T031 [P] Declarar en `src/styles/screens.css` las clases de la zona del esquema, la tarjeta de tabla, el minimapa y la barra de zoom, con el color resuelto por `color-mix` sobre la variable del esquema: relleno al 4 %, borde al 18 % con tablas y al 40 % punteado sin tablas, radio 14 px, y la variante `is-dim` para la atenuación del foco. Ningún valor de color literal
- [X] T031a [P] Añadir a `scripts/check-layers.mjs` la tercera regla de la puerta 7: ningún archivo de `src/lib/` importa de `src/components/`. Hoy el script solo comprueba que `ui/` no importe del almacén ni de `features` y que `invoke` viva en `src/lib/tauri/`, así que la geometría pura no la vigilaba nadie (puerta 7)

**Checkpoint**: el formato lee y escribe el campo nuevo, la geometría está
probada, el almacén tiene vista y esquemas, y los dos primitivos existen. Las
historias pueden empezar.

---

## Phase 3: User Story 1 - Estructura del Editor y modelo vacío (Priority: P1) 🎯 MVP

**Goal**: el Editor deja de ser una tarjeta y pasa a ser un espacio de trabajo de
cinco zonas, con el lienzo en el centro y dos zonas que se pueden esconder.

**Independent Test**: abrir cualquier modelo del Incremento 1 y comprobar que las
cinco zonas están, que un modelo sin tablas muestra la tarjeta de inicio con sus
tres filas, y que esconder y mostrar la barra lateral y el inspector devuelve ese
espacio al lienzo y lo recupera, también tras cerrar y abrir otro modelo.

### Tests for User Story 1

- [X] T032 [P] [US1] Crear `src/store/canvas.test.ts`: la vista arranca ajustada al modelo, esconder la barra lateral y el inspector escribe la preferencia con `preferencesUpdate`, y el foco se quita al cerrar el modelo (FR-006, FR-014)
- [X] T033 [P] [US1] Crear `src/components/layout/EditorLayout.test.tsx`: las cinco zonas están con su nombre accesible, esconder una la saca del árbol y el botón de la barra superior la devuelve (FR-001, FR-006)
- [X] T034 [P] [US1] Crear `src/components/layout/StatusBar.test.tsx`: dice el motor, el estado del archivo del Incremento 1, el porcentaje de zoom y el número de esquemas y de tablas (FR-004)
- [X] T035 [P] [US1] Crear `src/components/layout/Inspector.test.tsx`: sin selección dice que no hay nada seleccionado; al pulsar la fila de un esquema en la barra lateral muestra su nombre, nombre técnico, abreviatura, color, descripción y número de tablas (FR-003)

### Implementation for User Story 1

- [X] T036 [US1] Crear `src/components/layout/EditorLayout.tsx`: las cinco zonas de P-05 —barra lateral de 248 px, barra superior, lienzo, inspector de 300 px y barra de estado de 28 px—, con la barra lateral y el inspector escondibles y el lienzo ocupando el espacio liberado (FR-001, FR-006)
- [X] T037 [US1] Crear `src/components/layout/ModelSidebar.tsx`: sección «Esquemas» con «Todos los esquemas», la fila de cada esquema con su punto de color, su nombre y su número de tablas, y el botón «+» de Nuevo esquema; sección «Tablas» con las del modelo. Pulsar la fila de un esquema lo selecciona, de modo que el inspector muestre sus datos (FR-002, FR-003)
- [X] T038 [P] [US1] Crear `src/components/layout/Inspector.tsx`: datos del esquema seleccionado y, sin selección, el mensaje de que no hay nada seleccionado (FR-003)
- [X] T039 [P] [US1] Crear `src/components/layout/StatusBar.tsx` con el motor, el estado del archivo, el porcentaje de zoom y los contadores de esquemas y tablas, con `aria-live="polite"` en el estado del archivo (FR-004)
- [X] T040 [US1] Ampliar `src/components/layout/EditorChrome.tsx` con los dos botones de disposición (`panel-left`, `panel-right`), su `aria-pressed` y sus atajos ⌥⌘S / ⌥⌘I, además de lo que ya trae del Incremento 1 (FR-006, FR-038)
- [X] T041 [US1] Extraer la tarjeta del modelo vacío a `src/components/features/canvas/EmptyModelCard.tsx` desde `src/components/features/editor/EditorScreen.tsx`, cambiando la nota «El lienzo de tablas llega en el Incremento 2» y dejando «Agregar un esquema» como la única fila que actúa: abre el diálogo Nuevo esquema (FR-005, SC-009)
- [X] T042 [US1] Crear `src/components/features/canvas/CanvasSurface.tsx` con el nodo que recorta y el nodo interior transformado por `pan` y `zoom` del almacén, con `will-change: transform` y la rejilla de fondo. Sin gestos todavía: los trae la US4 (research.md R1)
- [X] T043 [US1] Reescribir `src/components/features/editor/EditorScreen.tsx` para que orqueste `EditorLayout` con la barra lateral, el chrome, el lienzo, el inspector y la barra de estado, conservando la medida de SC-002 y la espera de `isWindowSettling` que ya tenía
- [X] T044 [US1] Cargar la disposición al arrancar y escribirla al cambiarla: `src/store/preferences.ts` lleva `sidebarHidden` e `inspectorHidden` al almacén del lienzo al cargar, y `toggleSidebar`/`toggleInspector` llaman a `preferencesUpdate` (FR-006)
- [X] T045 [US1] Ampliar `src/components/features/editor/EditorScreen.test.tsx` para la estructura nueva, sustituyendo las aserciones que esperaban solo la tarjeta informativa

**Checkpoint**: el Editor tiene sus cinco zonas, el modelo vacío explica por
dónde empezar y la disposición sobrevive al cambio de modelo y al reinicio.

---

## Phase 4: User Story 2 - Crear y editar un esquema (Priority: P2)

**Goal**: crear un esquema escribiendo su nombre, con nombre técnico y
abreviatura propuestos, color de la paleta y vista previa; y editar uno existente
con las mismas reglas.

**Independent Test**: desde el Editor, crear tres esquemas con nombres legibles y
comprobar el nombre técnico y la abreviatura propuestos, el error de duplicado,
el color elegido y la zona vacía resultante en la barra lateral y en el lienzo.

### Tests for User Story 2

- [X] T046 [P] [US2] Crear `src/store/schemas.test.ts` con la parte de crear y editar: el esquema entra al final de `schemas`, el modelo queda «Editado», deshacer lo quita en un paso, y editar el nombre técnico lo propaga a las tablas, enums y vistas de ese esquema (FR-015, FR-020, FR-022, SC-006)
- [X] T047 [P] [US2] Crear `src/components/features/schema/SchemaDialog.test.tsx`: propone nombre técnico y abreviatura al escribir el nombre, deja de proponer cuando el usuario escribe a mano, muestra los seis errores de FR-018 sin dejar guardar, y la vista previa cambia con el color elegido (FR-016 a FR-019)

### Implementation for User Story 2

- [X] T048 [US2] Crear `src/components/features/schema/SchemaDialog.tsx` sobre `Dialog`: campos Nombre, Nombre técnico (mono) y Abreviatura (tres letras, 128 px), la paleta con `ColorSwatches`, la vista previa de la zona con el color elegido, y los botones Cancelar y «Crear esquema» / «Guardar cambios» (FR-015 a FR-020)
- [X] T049 [US2] Validar en el diálogo los seis casos de FR-018 con los mensajes de `data-model.md` §6: nombre legible vacío, nombre técnico vacío, con forma inválida o repetido, abreviatura que no son tres letras o repetida. El botón de guardar queda deshabilitado mientras haya error (FR-018, SC-009)
- [X] T050 [US2] Abrir el diálogo desde las tres vías de FR-015: el botón «+» de la sección Esquemas de `ModelSidebar`, un botón de `EditorChrome` y la fila «Agregar un esquema» de `EmptyModelCard`; el diálogo se declara en `src/store/navigation.ts` como un `dialog` más
- [X] T051 [US2] Mostrar el esquema nuevo en la barra lateral y en el lienzo como zona vacía con el texto «Aún no hay tablas en este esquema», y dejar el modelo «Editado» con su paso de deshacer (FR-025, FR-022, SC-009)
- [X] T052 [US2] Permitir editar un esquema existente desde su menú contextual en la barra lateral y desde el inspector, reusando el mismo diálogo en modo «editar» y reflejando el cambio en lienzo, barra lateral e inspector al confirmar (FR-020)
- [X] T052a [US2] Crear `src/components/features/schema/SchemaContextMenu.tsx` sobre `ContextMenu` con una sola entrada, «Editar esquema…», y engancharlo a la fila del esquema en `ModelSidebar`, también con ⇧F10. La entrada de eliminar la añade US6 (FR-020, FR-038)
- [X] T053 [US2] Dar al aviso breve de deshacer y rehacer las etiquetas nuevas, reutilizando el `showNotice` del Incremento 1 (FR-022, RS-06)

**Checkpoint**: crear tres esquemas con color funciona de principio a fin, con
sus errores, su vista previa y su deshacer.

---

## Phase 5: User Story 3 - Zonas de esquema en el lienzo (Priority: P3)

**Goal**: cada esquema es un área de su color que rodea sus tablas, con su
rótulo, y arrastrar el área mueve el esquema completo.

**Independent Test**: abrir un modelo con tablas repartidas en varios esquemas,
comprobar que cada zona rodea las suyas con su color y su rótulo, y arrastrar una
zona para ver que sus tablas la acompañan, que el modelo queda «Editado» y que
⌘Z lo devuelve en un paso.

### Tests for User Story 3

- [X] T054 [P] [US3] Crear `src/components/features/canvas/SchemaZone.test.tsx`: el rótulo trae abreviatura, nombre y número de tablas, una zona vacía muestra «Aún no hay tablas en este esquema», y el nombre accesible es el de `contracts/canvas.md` §5 (FR-024, FR-025, FR-040)
- [X] T055 [P] [US3] Ampliar `src/store/schemas.test.ts` con `moveSchema`: con tablas suma el desplazamiento a la `position` de cada una —resolviendo primero las que no la traían— y borra `schemas[].position`; sin tablas escribe `schemas[].position`; en los dos casos es un solo paso de deshacer (FR-026, FR-026a, FR-027, SC-006)

### Implementation for User Story 3

- [X] T056 [US3] Crear `src/components/features/canvas/TableCard.tsx`: tarjeta compacta de 200 × 64 con el nombre de la tabla, el chip de su esquema y el número de campos, solo dibujo —ni crear, ni editar, ni mover una tabla sola, que son del Incremento 3 (Clarifications)
- [X] T057 [US3] Crear `src/components/features/canvas/SchemaZone.tsx`: el rectángulo con el relleno y el borde del color del esquema, punteado cuando está vacía, y el rótulo con abreviatura, nombre y número de tablas (FR-023 a FR-025)
- [X] T058 [US3] Dibujar zonas y tarjetas en `CanvasSurface` a partir de `resolveLayout` y `schemaZones`, dentro del nodo transformado y sin que ninguna lea `pan` ni `zoom` (FR-023, research.md R19)
- [X] T059 [US3] Implementar el arrastre de una zona en `CanvasSurface` con Pointer Events y `setPointerCapture`: durante el gesto, el grupo se mueve por referencia y `isGesturing` queda en `true`; al soltar, una sola llamada a `moveSchema` (FR-026, research.md R3)
- [X] T060 [US3] Seleccionar el esquema al pulsar su zona, para que el inspector lo muestre, y abrir su menú contextual con el botón derecho y con ⇧F10 (FR-003, FR-033, FR-038)
- [X] T061 [US3] Comprobar que las posiciones nuevas llegan al archivo al guardar y que reabrir el modelo deja la zona donde se dejó, también la de un esquema vacío (FR-026, FR-026a, SC-007)

**Checkpoint**: las zonas rodean sus tablas, se mueven con ellas y lo que se
mueve se queda donde se dejó después de guardar y reabrir.

---

## Phase 6: User Story 4 - Navegar el lienzo (Priority: P4)

**Goal**: moverse por el modelo y acercarse, con las tres formas de mover, las
cuatro de hacer zoom, «Ajustar» y el minimapa.

**Independent Test**: abrir el modelo de 50 tablas y recorrerlo con las tres
formas de mover, las cuatro de hacer zoom, «Ajustar» y el minimapa, comprobando
el porcentaje mostrado y los topes.

### Tests for User Story 4

- [X] T062 [P] [US4] Ampliar `src/store/canvas.test.ts`: `zoomBy` y `zoomTo` recortan a los topes y conservan el punto bajo el puntero, `fitToModel` usa el envolvente del modelo entero, y la vista no se escribe en el archivo (FR-008 a FR-011, FR-014)
- [X] T063 [P] [US4] Crear `src/components/features/canvas/ZoomBar.test.tsx`: el porcentaje se muestra, el botón del tope alcanzado queda deshabilitado, y «Ajustar» llama a `fitToModel` (FR-008, FR-010)
- [X] T064 [P] [US4] Crear `src/components/features/canvas/Minimap.test.tsx`: dibuja una marca por tabla y el contorno de cada zona, muestra el recuadro del área visible, y pulsar dentro mueve la vista (FR-012)

### Implementation for User Story 4

- [X] T065 [US4] Mover la vista en `CanvasSurface` de las tres formas de FR-007: arrastrar desde un espacio vacío, arrastrar con la rueda presionada (`button === 1`, cancelando el autoscroll de Windows con `preventDefault` en `mousedown` y `auxclick`) y Espacio mantenido —que cambia el cursor a `grab` y se suelta también en `blur`—. Las dos últimas MUST funcionar también encima de una tabla o de una zona, no solo sobre el fondo (FR-007, research.md R9)
- [X] T066 [US4] Escuchar la rueda con `addEventListener('wheel', …, { passive: false })`: con ⌘/Ctrl o con el pellizco del panel táctil hace zoom en el puntero, sin modificador mueve la vista; comitear al almacén tras 120 ms sin ruedas (FR-007 a FR-009, research.md R3, R9)
- [X] T067 [P] [US4] Crear `src/components/features/canvas/ZoomBar.tsx` abajo a la izquierda: «−», el porcentaje con `aria-live="polite"`, «+», separador y «Ajustar», con el botón del tope alcanzado deshabilitado (FR-008, FR-010)
- [X] T068 [P] [US4] Crear `src/components/features/canvas/Minimap.tsx` de 168 × 108 abajo a la derecha, con la escala derivada del envolvente, una marca por tabla con el color de su esquema, el contorno de cada zona y el recuadro del área visible; pulsar o arrastrar dentro mueve la vista (FR-012, research.md R11)
- [X] T069 [US4] Dar al lienzo su forma sin ratón: `tabIndex=0` con `aria-label="Lienzo del modelo"`, flechas que mueven la vista, ⌘+ / ⌘− para el zoom, ⌘0 al 100 %, ⇧1 para ajustar, y el tabulador recorriendo zonas y tablas (FR-039, contracts/canvas.md §4)
- [X] T070 [US4] Arrancar la vista ajustada al abrir un modelo y no escribirla nunca en el archivo, también al cambiar de modelo (FR-014)
- [X] T071 [US4] Pintar sin sombras ni transiciones mientras `isGesturing` está en `true`, y marcar `contain: layout paint` en las tarjetas (SC-003, research.md R19)

**Checkpoint**: un modelo que no cabe en la pantalla se recorre y se encuadra,
con el porcentaje a la vista y el minimapa diciendo dónde está la vista.

---

## Phase 7: User Story 5 - Enfocar un esquema (Priority: P5)

**Goal**: centrarse en un dominio: el lienzo se centra en su zona, el resto se
atenúa y la lista de tablas se filtra.

**Independent Test**: con un modelo de tres esquemas, enfocar cada uno desde la
barra lateral y comprobar el centrado, la atenuación del resto, el filtrado de la
lista y la vuelta con «Todos los esquemas» y con Esc.

### Tests for User Story 5

- [X] T072 [P] [US5] Ampliar `src/store/canvas.test.ts` con el foco: `focusSchema` centra en la zona del esquema, `null` lo quita, y el foco se quita solo al eliminar el esquema enfocado y al cerrar el modelo (FR-029, FR-031, FR-032)
- [X] T073 [P] [US5] Ampliar `src/components/layout/ModelSidebar.test.tsx`: con un esquema enfocado la lista de tablas trae solo las suyas, el título dice de cuál y `aria-current` marca la fila; un esquema vacío enfocado dice que no tiene tablas (FR-030, US5 esc. 7)

### Implementation for User Story 5

- [X] T074 [US5] Enfocar desde el nombre del esquema en `ModelSidebar` y quitar el foco con «Todos los esquemas», centrando el lienzo con `centerOnZone` —`fitToContent` sobre el envolvente de esa zona— (FR-029, FR-031)
- [X] T075 [US5] Atenuar las demás zonas y sus tablas con la clase `is-dim` de `src/styles/screens.css`, y filtrar la lista de tablas de la barra lateral a las del esquema enfocado (FR-030)
- [X] T076 [US5] Decir cuál está enfocado en la barra lateral y en la barra de estado (FR-030)
- [X] T077 [US5] Quitar el foco con Esc en el lienzo (FR-031)
- [X] T078 [US5] Llegar al resultado sin animación con «Reducir movimiento» del sistema: la transición del nodo transformado sale del `MotionConfig` del proyecto y se anula con `prefers-reduced-motion` (FR-042, research.md R12)

**Checkpoint**: enfocar y desenfocar los tres esquemas funciona desde la barra
lateral, con el teclado y con movimiento reducido.

---

## Phase 8: User Story 6 - Eliminar un esquema (Priority: P6)

**Goal**: eliminar un esquema diciendo antes qué queda afectado, con el
interruptor que decide si sus tablas se van con él y el selector del esquema de
destino.

**Independent Test**: con un modelo de tres esquemas, eliminar uno con el
interruptor apagado eligiendo destino y otro con el interruptor encendido, y
comprobar que en un modelo de un solo esquema la opción está deshabilitada.

### Tests for User Story 6

- [X] T079 [P] [US6] Ampliar `src/store/schemas.test.ts` con `deleteSchema`: con el interruptor apagado las tablas, enums y vistas pasan al destino elegido; con él encendido se van con el esquema junto a las relaciones que los tocaban; el único esquema del modelo no se elimina; todo en un solo paso de deshacer (FR-035 a FR-037, SC-006)
- [X] T080 [P] [US6] Crear `src/components/features/schema/DeleteSchemaDialog.test.tsx`: el interruptor arranca apagado, con tres esquemas hay selector de destino que propone el primero del modelo distinto del que se elimina, con dos el destino se nombra sin selector, y el texto dice cuántas tablas quedan afectadas (FR-034, FR-036)

### Implementation for User Story 6

- [X] T081 [US6] Añadir a `src/components/features/schema/SchemaContextMenu.tsx` la entrada «Eliminar esquema…», deshabilitada con un solo esquema en el modelo y diciendo por qué (FR-033, FR-035, SC-009)
- [X] T082 [US6] Ofrecer el menú contextual en los dos sitios de FR-033: la fila del esquema en `ModelSidebar` y su zona en el lienzo, las dos también con ⇧F10 (FR-033, FR-038)
- [X] T083 [US6] Crear `src/components/features/schema/DeleteSchemaDialog.tsx`: título «¿Eliminar «<nombre>»?», el recuento de tablas, el `Switch` «Eliminar también sus N tablas» apagado por defecto, el selector de destino cuando quedan dos o más esquemas —proponiendo el primero del modelo distinto del que se elimina— y los botones Cancelar y «Eliminar esquema» / «Eliminar esquema y tablas» en variante destructiva (FR-034, FR-036)
- [X] T084 [US6] Mover también los enums y las vistas del esquema al destino, y decirlo en el diálogo (US6 esc. 8, FR-036)
- [X] T085 [US6] Dejar el modelo «Editado» y deshacer la eliminación completa —esquema, color, tablas y sus posiciones— en un solo paso (FR-037)

**Checkpoint**: las seis historias funcionan de forma independiente.

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: lo que cruza las seis historias y lo que cierra el incremento.

- [X] T086 Crear `e2e/specs/09-lienzo-y-esquemas.e2e.js` con los nueve escenarios de `quickstart.md`: las cinco zonas, esconder y recuperar, mover la vista de las tres formas, el zoom con sus topes, crear tres esquemas, arrastrar una zona con tablas y guardar, arrastrar una zona vacía y guardar, enfocar, y eliminar con y sin tablas
- [X] T087 Ejecutar el recorrido completo en macOS (`npm run e2e`) y arreglar lo que saque, con atención al botón central y al autoscroll en Windows
- [X] T088 [P] Revisar el Editor, el diálogo de esquema y la confirmación de eliminar en tema claro, tema oscuro y con «Reducir movimiento», sin texto por debajo de 4,5:1 de contraste (SC-010, FR-041, puerta 5)
- [X] T089 [P] Recorrer el incremento entero solo con el teclado, con foco visible en cada paso, y arreglar lo que falte (SC-008, puerta 4)
- [ ] T090 Medir SC-003 con `modelo-50-tablas.yaml` y el panel de rendimiento: 60 cuadros por segundo durante los gestos y respuesta al primer gesto por debajo de 100 ms, con la ventana respondiendo en todo momento (SC-003, FR-045)
- [X] T090a Cronometrar los tiempos de `quickstart.md`: crear un esquema en tres pasos y menos de 30 s (SC-001), crear tres esquemas, moverlos y enfocarlos en menos de 3 min (SC-002), y enfocar un esquema en menos de 1 s (SC-005)
- [X] T091 [P] Repasar la puerta 8 en todo lo nuevo: JSDoc en español en cada función, componente, acción del almacén y campo, y `///` en los dos campos de Rust
- [X] T092 [P] Repasar la puerta 6: ningún archivo del lienzo copiado al repositorio, y los tres desvíos deliberados de `research.md` R20 siguen siendo los únicos
- [X] T093 Pasar las cinco puertas en limpio: `npx tsc --noEmit`, `npm run lint`, `npx vitest run`, `cargo check` y `cargo test`
- [X] T094 Subir la versión del producto a `1.2.0` en `package.json`, `src-tauri/tauri.conf.json` y `src-tauri/Cargo.toml`, y actualizar `README.md` con lo que el Editor hace ahora
- [ ] T095 Abrir el PR hacia `main`, esperar `puertas.yml` y `recorrido.yml` en verde en las dos plataformas, y dejar la etiqueta anotada `v1.2.0` sobre el commit que cierra el incremento (constitución, Versión del producto y etiquetas)

### Ajuste al diseño actualizado (2026-10-27)

**Purpose**: lo que salió de probar el Editor con la aplicación en marcha y de releer el tablero `Editor` del lienzo. El alcance es estructura y colocación: solo lo que ya tiene función, sin el buscador, el conmutador de vista ni los contadores que llegan con el Incremento 3.

- [X] T096 Quitar toda promoción de capa del compositor en el lienzo: separar el desplazamiento y el zoom en `.sm-frame` y `.sm-stage` con `transform` en dos dimensiones, sin `will-change` ni `translate3d`, en `src/components/features/canvas/CanvasSurface.tsx`, `src/hooks/useCanvasView.ts` y `src/styles/screens.css`, para que el texto no se pixele al acercar ni durante el gesto
- [X] T097 Añadir la variante destructiva del botón (`.au-btn-destructive`) en `src/styles/aura.css`, que no existía y dejaba el botón de confirmar en texto plano
- [X] T098 Ajustar la ventana del Editor al tablero del lienzo en estructura y colocación: la barra lateral como tarjeta a la izquierda de todo con los controles de la ventana (`src/components/layout/ModelSidebar.tsx`, `src/components/layout/EditorLayout.tsx`), la barra superior con el botón de cada zona escondible en su propio lado (`src/components/layout/EditorChrome.tsx`), la ficha del modelo en el inspector sin selección (`src/components/layout/Inspector.tsx`), la barra de estado y la barra de zoom con sus medidas (`src/components/layout/StatusBar.tsx`, `src/styles/screens.css`) y los iconos que faltaban (`src/components/ui/Icon.tsx`)
- [X] T099 Actualizar las pruebas de la estructura nueva en `src/components/layout/EditorLayout.test.tsx` y `src/components/layout/EditorChrome.test.tsx`: los rótulos «Ocultar/Mostrar …», los controles de la ventana que cambian de sitio y la barra superior sin la hora de guardado
- [X] T100 Adaptar el recorrido a la estructura nueva: `vistaDelLienzo()` lee los dos nodos transformados en `e2e/soporte/pantalla.js`, y `e2e/specs/09-lienzo-y-esquemas.e2e.js` espera los títulos de la barra lateral sin mayúsculas y los rótulos «Ocultar/Mostrar inspector»; `npm run e2e` en verde (10/10)
- [X] T101 Pegar la zona de esquema a su tablero: anclar el rótulo a la esquina —un `button` centra su contenido y en la zona vacía el nombre quedaba a media altura— y quitarle el halo a la zona seleccionada, que se leía como foco del teclado, en `src/styles/screens.css`
- [X] T102 Un modelo nuevo llega sin ningún esquema, tampoco el del motor: `emptyModel` ya no propone `public`, `main` ni el nombre del modelo, y la validación acepta cero esquemas (`src/lib/model/defaults.ts`, `src/lib/model/validate.ts`, FR-005a)
- [X] T103 El lienzo de un modelo en blanco no dibuja ninguna zona y la tarjeta «Empieza a diseñar tu modelo» sale solo entonces; con un esquema o una tabla, la tarjeta se va y el lienzo dibuja (`src/lib/model/defaults.ts` con `isBlankModel`, `src/components/features/canvas/CanvasSurface.tsx`, `src/components/features/editor/EditorScreen.tsx`, FR-005, FR-005a)
- [X] T104 El inspector mira la tabla seleccionada, que llega con el Incremento 3: hasta entonces muestra siempre la ficha del modelo y enfocar un esquema no lo cambia (`src/components/layout/Inspector.tsx`, FR-003)
- [X] T105 El porcentaje de zoom es del usuario: abrir un modelo lo centra al 100 %, enfocar un esquema centra su zona sin cambiar la escala, y solo «Ajustar» ajusta; pulsar el fondo del lienzo suelta el foco (`src/lib/canvas/zoom.ts` con `centerOnContent`, `src/store/canvas.ts`, `src/hooks/useCanvasView.ts`, FR-014, FR-029, FR-031)
- [X] T106 Quitar la transición de `transform` del lienzo: el navegador la anima en el compositor, promueve la capa y el texto se ve borroso mientras dura (`src/styles/screens.css`); lo mismo con el `filter` del realce y de la atenuación de la zona, que se sustituyen por `color-mix` y opacidad
- [X] T107 El porcentaje de la barra de zoom se escribe: pulsarlo abre un campo con el valor, Intro lo aplica recortado a los topes y Esc lo deja como estaba (`src/components/features/canvas/ZoomBar.tsx`, `src/styles/screens.css`, FR-009a)
- [X] T108 Eliminar el único esquema del modelo deja de estar prohibido: el menú ya no lo deshabilita, el almacén lo permite y el diálogo dice que sus tablas se van con él porque no hay destino (`src/components/features/schema/SchemaContextMenu.tsx`, `src/store/schemas.ts`, `src/components/features/schema/DeleteSchemaDialog.tsx`, FR-035)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (fase 1)**: sin dependencias. T001 es bloqueante para T029 y para todo
  lo que use `Switch`
- **Foundational (fase 2)**: depende de la fase 1 y **bloquea las seis
  historias**
- **US1 (fase 3)**: depende de la fase 2. Es el marco donde viven las demás
- **US2 (fase 4)**: depende de la fase 2 y, para que el esquema nuevo se vea, de
  la barra lateral de US1
- **US3 (fase 5)**: depende de la fase 2 y del `CanvasSurface` de US1 (T042)
- **US4 (fase 6)**: depende de la fase 2 y de T042; se aprovecha de US3 pero no
  la necesita
- **US5 (fase 7)**: depende de US3 (necesita zonas que centrar y atenuar) y de
  `fitToContent`
- **US6 (fase 8)**: depende de US2 (hay que poder crear para poder eliminar, y
  de ahí sale el menú contextual que T052a crea)
- **Polish (fase 9)**: depende de las seis historias

### Dependencias no obvias

- **T008 antes que T010**: la prueba de ida y vuelta solo pasa si la poda ocurre
  al leer; si se intenta en el serializador, el texto de ida y el de vuelta
  dejan de coincidir
- **T016 antes que T017**: `schemaZones` toma el mapa de `resolveLayout`, no el
  modelo crudo
- **T042 antes que T058, T059 y T065**: todos escriben dentro del mismo nodo
  transformado; hacerlo a la vez en dos archivos distintos termina en conflicto
- **T022 antes que T044**: `toggleSidebar` tiene que existir antes de que las
  preferencias lo llamen
- **T026 y T028 van juntas**: el campo en Rust y su tipo en TypeScript tienen que
  entrar en el mismo cambio, o el typecheck falla en uno de los dos lados
- **T059 (arrastre de zona) antes que T065 (mover la vista)**: los dos escuchan
  `pointerdown` en el mismo nodo y el orden de prioridad —zona primero, fondo
  después— se decide una vez
- **T052a antes que T060, T081 y T082**: el menú contextual del esquema se crea una
  vez, en US2, con «Editar esquema…»; T060 lo engancha a la zona del lienzo y
  T081 le añade «Eliminar esquema…». Si naciera en US6, US2 no tendría vía para
  editar un esquema y dejaría de ser independiente
- **T001 antes que T029 y T083**: sin la dependencia instalada no hay `Switch`
- **T003 y T004 antes que casi toda prueba**: los modelos de ejemplo son la
  entrada de las pruebas de geometría, de almacén y del recorrido
- **T023 se implementa en la fase 2 pero se prueba en las fases 4, 5 y 8**: es la
  única excepción a la regla de escribir la prueba antes, y es deliberada —las
  cuatro acciones bloquean a todas las historias, y cada prueba necesita el
  escenario completo de la suya—. Quien tome T023 deja sus firmas y su paso de
  historial; quien tome T046, T055 y T079 las prueba

### Parallel Opportunities

- Fase 1: T002, T003 y T004 en paralelo, tras T001
- Fase 2: tres grupos independientes a la vez — paleta y propuesta (T011 a T014),
  geometría (T015 a T021) y preferencias (T026, T027); los primitivos (T029 a
  T031) y la regla de capas (T031a) también, en cuanto T001 esté
- Las pruebas de cada historia marcadas [P] son archivos distintos y van juntas
- US2 y US3 pueden repartirse entre dos personas en cuanto US1 cierre: tocan
  archivos distintos (`features/schema/` y `features/canvas/`)
- Fase 9: T088, T089, T091 y T092 en paralelo

---

## Parallel Example: Phase 2

```bash
# Tres frentes sin solape, una vez instalada la dependencia:
Tarea: "Crear src/lib/model/colors.ts con los once colores de la paleta"
Tarea: "Crear src/lib/canvas/constants.ts con las medidas y los topes de zoom"
Tarea: "Añadir sidebar_hidden e inspector_hidden a src-tauri/src/preferences.rs"
Tarea: "Crear src/components/ui/Switch.tsx sobre @radix-ui/react-switch"
```

## Parallel Example: User Story 1

```bash
# Las cuatro pruebas de la historia, archivos distintos:
Tarea: "Crear src/store/canvas.test.ts"
Tarea: "Crear src/components/layout/EditorLayout.test.tsx"
Tarea: "Crear src/components/layout/StatusBar.test.tsx"
Tarea: "Crear src/components/layout/Inspector.test.tsx"
```

---

## Implementation Strategy

### MVP primero (solo US1)

1. Fase 1: Setup
2. Fase 2: Foundational (bloquea todo lo demás)
3. Fase 3: US1
4. **PARAR Y VALIDAR**: el Editor tiene sus cinco zonas, el modelo vacío explica
   por dónde empezar y la disposición se recuerda
5. Demostrable: ya es un espacio de trabajo, aunque el lienzo todavía esté vacío

### Entrega incremental

1. Setup + Foundational → cimiento listo
2. US1 → el marco de cinco zonas (MVP)
3. US2 → crear tres esquemas con color: la primera mitad de la demostración
4. US3 → las zonas en el lienzo y moverlas: la segunda mitad
5. US4 → navegar, que es lo que hace usable un modelo grande
6. US5 → enfocar, el tercer paso de la demostración
7. US6 → eliminar, que cierra el ciclo de vida del esquema

Tras US3, la demostración del incremento —crear tres esquemas, moverlos por el
lienzo y enfocarlos— está completa salvo el enfoque; tras US5 lo está del todo.

### Reparto entre dos personas

1. Fases 1 y 2 juntas, que es donde están las decisiones
2. Con US1 cerrada: una persona con US2 y US6 (`features/schema/`), la otra con
   US3 y US4 (`features/canvas/`); US5 la toma quien acabe antes, porque necesita
   zonas de la una y `fitToContent` de la otra

---

## Medidas del cierre (2026-10-27)

Tomadas con la aplicación en marcha, conducida por el servidor de WebDriver que
el binario monta con `--features webdriver`.

**T088 · SC-010.** El Editor, el diálogo de esquema y la confirmación de
eliminar, en tema claro y oscuro y con las reglas de «Reducir movimiento»
puestas a la fuerza: ningún texto por debajo de su umbral. El mínimo del texto
de contenido es 5.38:1 («Eliminar esquema», 13 px) y el de los metadatos de 10 u
11 px, 3.06:1 en claro y 3.28:1 en oscuro. Las reglas de movimiento reducido
solo tocan duraciones y animaciones, así que el contraste sale igual con ellas.

**T089 · SC-008.** Los 28 controles del Editor —los tres de la ventana, la
barra lateral entera, las dos zonas que se esconden, el lienzo, las cuatro zonas
de esquema, las cuatro tablas, la barra de zoom, el minimapa y la barra de
estado— reciben el foco y sacan su anillo de 2 px; el del campo de texto lo
dibuja su envoltura con `:focus-within`, y las opciones de menú lo marcan con el
relleno de acento, en rojo la destructiva. Con teclas: ⌘⌥S y ⌘⌥I esconden y
devuelven las dos zonas, las flechas mueven la vista, ⇧F10 abre el menú de la
zona, las flechas lo recorren y Enter elige. Ningún paso sin foco visible.

No se puede comprobar con el recorrido lo que depende de una acción por defecto
del navegador —tabular y activar un botón con Enter—: las teclas que manda
llegan con `isTrusted` en falso, así que WebKit corre los manejadores de la
aplicación pero no las suyas. Por eso la cadena del tabulador se mide por el
DOM, enfocando cada control en orden.

**T090 · SC-003.** Con `modelo-50-tablas.yaml` abierto (50 tablas, 1 esquema),
60 pasos por gesto, uno por fotograma:

| Gesto | Respuesta al primero | Trabajo por paso (media / p95 / peor) |
| ----- | -------------------- | ------------------------------------- |
| Arrastrar una zona | 33–56 ms | 4 / 5 / 6 ms |
| Mover la vista | 19–35 ms | 1 / 2 / 2 ms |
| Zoom con la rueda | 23–41 ms | 1 / 2 / 3 ms |

El trabajo por paso es el manejador más el estilo y la maquetación que arrastra,
con la lectura forzada para que la maquetación entre en la cuenta: el peor caso,
6 ms, cabe tres veces en los 16,7 ms de un fotograma de 60.

El ritmo de los fotogramas no llega a 60 en esta máquina, pero no por la
aplicación: con el Modo de bajo consumo encendido WebKit pinta a unos 30 por
segundo, y el mismo ritmo sale sin ningún gesto. Medido en los tres monitores:
28 ms por fotograma en el principal de 144 Hz (36 por segundo) y 33 ms en el
segundo de 60 Hz y en el interno (30 por segundo), idénticos en reposo y durante
el gesto. La cifra de 60 queda por medir con el Modo de bajo consumo apagado.

**T090a · SC-001, SC-002 y SC-005.** Crear un esquema son tres pasos —abrir el
diálogo, escribir el nombre, confirmar— y 114 ms de reloj. Los tres esquemas de
la demostración, moverlos los tres y enfocar cada uno: 1 768 ms. Enfocar deja la
zona entera dentro del lienzo y centrada al píxel (dx 0, dy 0) en 47, 55 y
62 ms.

---

## Notes

- `[P]` = archivos distintos y sin dependencias pendientes
- `[Story]` liga la tarea a su historia para poder rastrearla
- Las pruebas se escriben antes de la implementación de su tarea y han de fallar
  primero. La única excepción declarada es T023, que la fase 2 implementa y las
  fases 4, 5 y 8 prueban: ver Dependencias no obvias
- Un commit por tarea o por grupo lógico, con las cinco puertas en verde antes de
  darla por hecha
- La versión y la etiqueta son lo último (T094, T095), nunca a mitad de la
  implementación
