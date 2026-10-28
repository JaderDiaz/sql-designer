---
description: "Tareas del Incremento 3 · Tablas y campos"
---

# Tasks: Tablas y campos (Incremento 3)

**Input**: documentos de diseño de `specs/004-tablas-campos/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`,
`contracts/`, `quickstart.md`, `.specify/memory/constitution.md`

**Tests**: sí, obligatorias. La puerta 1 de la constitución exige typecheck y
`cargo check` sin avisos, la puerta 3 exige la prueba de ida y vuelta, y
`quickstart.md` lista las dieciséis pruebas que no pueden faltar.

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
| US1 · Crear una tabla | SF-3.1 | P1 | 3 |
| US2 · Editor de campos | SF-3.4 | P2 | 4 |
| US3 · Llaves y plantillas de campos | SF-3.5 | P3 | 5 |
| US4 · Mover tablas | SF-3.2 | P4 | 6 |
| US5 · Renombrar, duplicar y eliminar tablas | SF-3.6 | P5 | 7 |
| US6 · Inspector de tabla | SF-3.3 | P6 | 8 |

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: dejar listos los modelos de ejemplo y los iconos que todo lo demás
necesita. **Sin dependencias nuevas** de npm ni de Rust (plan.md,
Technical Context).

- [X] T001 Ampliar `src/lib/model/__fixtures__/modelo-postgres.yaml` con lo que este incremento escribe: un campo `numeric` con `length: 12` y `scale: 2`, un `varchar` con `length: 120`, una `primaryKey` de dos campos, un `uniques` de un campo y `position` en todas las tablas; registrar el cambio en `src/lib/model/__fixtures__/index.ts`
- [X] T002 [P] Crear `src/lib/model/__fixtures__/modelo-tipos-ajenos.yaml`: modelo con `engine: sqlite` y un campo de tipo `timestamptz` con `length`, para probar que el archivo sigue siendo válido y el tipo se muestra como ajeno al motor (FR-018a)
- [X] T003 [P] Crear `e2e/soporte/modelo-tablas.yaml` —tres esquemas con tablas, una tabla de 40 campos, un campo con longitud y escala, una llave primaria compuesta, un único de un campo y dos relaciones— y registrarlo en la preparación de la carpeta temporal de `e2e/wdio.conf.js` junto a los modelos que ya hay
- [X] T004 [P] Añadir a `src/components/ui/Icon.tsx` los iconos que faltan para este incremento, tomados de Lucide como los demás: `table-properties`, `layout-template`, `chevron-up`, `text-cursor-input`, `folder-input`, `git-merge`, `archive`, `user-round`, `toggle-right` y `key-round`

**Checkpoint**: modelos de ejemplo y iconos listos; nada de esto se ve en
pantalla todavía.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: el formato del archivo, el catálogo de tipos, la geometría pura,
el estado, las preferencias y el hook de la rejilla. Nada de esto se ve en
pantalla, y todas las historias lo necesitan.

**⚠️ CRÍTICO**: ninguna historia puede empezar antes de terminar esta fase.

### El campo del formato gana longitud y escala (data-model.md §1, contracts/model.schema.json)

- [X] T005 Añadir `length?: number` y `scale?: number` a `Field` en `src/lib/model/types.ts`, con su JSDoc en español: `length` entero ≥ 1, `scale` entero ≥ 0 y nunca mayor que `length`, y `type` guarda solo el nombre del tipo sin paréntesis (research R3, FR-051a)
- [X] T006 Aceptar y validar los dos campos en `src/lib/model/validate.ts`: añadirlos a `ALLOWED_KEYS.field` y comprobar en `src/lib/model/validate.test.ts` «La longitud tiene que ser un número entero mayor que cero.», «La escala tiene que ser un número entero.» y «La escala no puede pasar de la longitud.»; **no** validarlos contra el catálogo de tipos del motor (data-model.md §1, FR-016, FR-018a)
- [X] T007 Añadir a `src/lib/model/validate.ts` las dos reglas que faltaban de la tabla: ningún campo de `primaryKey` con `nullable: true` —«Un campo de la llave primaria no puede admitir nulos.»— y `comment` de tabla de hasta 280 caracteres —«La descripción de la tabla no puede pasar de 280 caracteres.»— (FR-026, FR-043)
- [X] T008 Escribir `length` y `scale` en su orden exacto en `src/lib/model/serialize.ts`: `name`, `type`, `length`, `scale`, `nullable`, `default`, `comment`, omitiendo las claves ausentes (data-model.md §1, puerta 3)
- [X] T009 Leer los dos campos en `src/lib/model/parse.ts` sin transformarlos, dejando que el validador decida su forma
- [X] T010 [P] Crear `src/lib/model/validate.test.ts` —hoy `src/lib/model/validate.ts` no tiene prueba propia, solo la indirecta de `parse.test.ts`— con los casos de este incremento: `length: 0` y negativa rechazadas, `scale` mayor que `length` rechazada, campo de `primaryKey` con `nullable: true` rechazado, `comment` de 281 caracteres rechazado, y `modelo-tipos-ajenos.yaml` **aceptado** (quickstart.md)
- [X] T011 [P] Ampliar `src/lib/model/roundtrip.test.ts` con `modelo-postgres.yaml`: leer, guardar y volver a leer produce el mismo texto con `length`, `scale`, `primaryKey`, `uniques` y `position` (puerta 3, FR-051)

### Catálogo de tipos por motor (research R2, data-model.md §5)

- [X] T012 Crear `src/lib/model/engines.ts` con los datos puros del catálogo: la lista de tipos de PostgreSQL, MySQL y SQLite, cuáles admiten longitud (`varchar`, `char`, `numeric` en PostgreSQL; `char`, `varchar`, `decimal`, `binary` en MySQL; ninguno en SQLite) y cuáles escala (`numeric`, `decimal`), con las tablas de `research.md` R2 copiadas tal cual
- [X] T013 Añadir a `src/lib/model/engines.ts` las cuatro funciones de `contracts/tables.md` §1.2: `typesOf(engine)`, `typeTraits(engine, type)` —con `defaultLength` 120 en `varchar`, 1 en `char` y 12 en `numeric`/`decimal`, `defaultScale` 2, e `isUnknown` para un tipo ajeno—, `idField(engine)` y `templatesOf(engine)` con los cuatro grupos (auditoría, borrado lógico, autoría y activo)
- [X] T014 [P] Crear `src/lib/model/engines.test.ts`: `typesOf` de los tres motores; `typeTraits` de `varchar`, `numeric`, `integer` y de un tipo ajeno; `idField` de los tres motores (`uuid`/`gen_random_uuid()`, `char(36)`/`(uuid())`, `text` sin valor); `templatesOf` con los tipos de fecha de cada motor (puerta 2 adaptada)

### Marcas de llave y relaciones afectadas (research R12, R13)

- [X] T015 Crear `src/lib/model/marks.ts` con `fieldMarks(table, relations)` —`PK` si el campo está en `primaryKey`, `UK` si está en algún `uniques`, `FK` si una relación lo nombra en `fromFields`, y `PK` gana cuando es las dos cosas— y `relationsTouching(model, { table, field? })` (contracts/tables.md §1.2)
- [X] T016 [P] Crear `src/lib/model/marks.test.ts`: llave compuesta, único de un campo, único de varios campos, campo de relación, campo sin marca; `relationsTouching` por tabla y por campo, en los dos extremos

### Geometría con alto variable (research R1, R4, R5)

- [X] T017 Reemplazar `TABLE_HEIGHT` en `src/lib/canvas/constants.ts` por `TABLE_HEADER` (42), `FIELD_ROW_HEIGHT` (24), `GRID_SNAP` (24) y la función `tableHeight(fieldCount)` = `TABLE_HEADER + FIELD_ROW_HEIGHT × max(1, campos)`, y actualizar en el mismo cambio a sus cuatro consumidores —`src/lib/canvas/geometry.ts`, `src/lib/canvas/layout.ts`, `src/components/features/canvas/TableCard.tsx` y `src/components/features/canvas/Minimap.tsx`— para que el typecheck no quede roto a medias
- [X] T018 Hacer que `tablesBounds` de `src/lib/canvas/geometry.ts` use el alto real de cada tabla: recibe las tablas, no solo sus nombres, y la envolvente de la zona crece con la tabla más alta (FR-030, research R1)
- [X] T019 Añadir a `src/lib/canvas/geometry.ts` las tres funciones puras nuevas de `contracts/tables.md` §1.1: `zoneAt(zones, point)` —la última zona del orden del modelo cuando hay solapes, `null` fuera de todas—, `snapToGrid(position, enabled)` con paso `GRID_SNAP` y `findFreeSpot(occupied, desired, size)`, que nunca devuelve `null`
- [X] T020 Ajustar la rejilla de `src/lib/canvas/layout.ts` para que las tablas sin posición se coloquen con el alto real de cada fila, de modo que dos tablas de alturas distintas no se solapen (FR-013 del Incremento 2)
- [X] T021 [P] Ampliar `src/lib/canvas/geometry.test.ts` y `src/lib/canvas/layout.test.ts` con los ejemplos fijados de `contracts/tables.md` §1.3: `tableHeight` con 0, 1, 4 y 40 campos; `zoneAt` con solapes y fuera; `snapToGrid({x: 37, y: 11}, true)` → `{x: 48, y: 0}`; `findFreeSpot` devuelve el punto pedido cuando está libre y uno desplazado cuando no

### Historial con clave de fusión (research R8)

- [X] T022 Añadir `coalesceKey?: string` a `HistoryStep` en `src/store/model.ts` y un ayudante `pushHistory(state, label, coalesceKey?)` que **reemplaza** el paso de arriba de `past` cuando la clave coincide y empuja uno nuevo cuando no, limpiando `future` en los dos casos (FR-024a, data-model.md §3)
- [X] T023 Pasar las acciones que ya existen (`renameModel`, las cuatro de `src/store/schemas.ts`) por `pushHistory`, sin cambiar su comportamiento: siguen empujando un paso sin clave
- [X] T024 [P] Ampliar `src/store/model.test.ts`: tres cambios con la misma clave dejan **un** paso y deshacer devuelve el valor inicial; un cambio con clave distinta cierra el anterior; un paso sin clave nunca se fusiona

### Estado del almacén (data-model.md §3)

- [X] T025 Añadir `selectedTable: string | null` y `selectTable(name | null)` a `src/store/canvas.ts`, que al seleccionar una tabla limpia `selectedSchema` y viceversa: el inspector mira una cosa a la vez (FR-007a)
- [X] T026 Crear `src/store/tables.ts` con la parte de las tablas y las siete acciones de tabla de `contracts/tables.md` §2.1 —`createTable`, `moveTable`, `setTableSchema`, `renameTable`, `duplicateTable`, `deleteTable`, `setTableComment`—, cada una con su etiqueta de historial de `data-model.md` §3 y sin tocar el disco
- [X] T027 Añadir a `src/store/tables.ts` las seis acciones de campo de `contracts/tables.md` §2.2 —`addField`, `updateField`, `moveFieldBy`, `deleteField`, `setFieldKey`, `applyTemplate`—, con la clave de fusión `campo:<tabla>.<campo>.<columna>` en `updateField` y en `setTableComment` (FR-024a)
- [X] T028 Crear `src/store/fieldsPanel.ts` con `isFieldsPanelOpen`, `fieldsPanelHeight` recortado a `[200, 560]`, `focusedCell`, `openFieldsPanel(table?, cell?)`, `closeFieldsPanel()` y `setFieldsPanelHeight(px, commit?)`, que solo escribe la preferencia cuando se le pasa `commit` (data-model.md §3, contracts/tables.md §2.3)
- [X] T029 Registrar las dos partes nuevas en `src/store/index.ts` y en `src/store/types.ts`, en el orden en que se componen las demás

### Preferencias (research R15, contracts/preferences.md)

- [X] T030 Añadir `snap_to_grid: bool` y `fields_panel_height: u32` a `Preferences` y a `PreferencesPatch` en `src-tauri/src/preferences.rs`, con `#[serde(default)]`, por defecto `false` y `320`, recorte a `[200, 560]` al leer y al escribir, y comentario `///` en español en cada uno
- [X] T031 Reflejar los dos campos en `src/lib/tauri/types.ts`, en `DEFAULT_PREFERENCES` de `src/store/preferences.ts` y en la aplicación inicial de preferencias al arrancar, de modo que `fieldsPanelHeight` llegue al almacén del panel (va en el **mismo cambio** que T030 o el typecheck falla en un lado)
- [X] T032 [P] Añadir a las pruebas de `src-tauri/src/preferences.rs`: un `preferences.json` sin los campos nuevos los lee como `false` y `320` sin generar `.bak`; un alto de `40` y uno de `5000` se recortan a 200 y 560; el parche cambia uno sin tocar el otro

### Navegación de la rejilla (research R7)

- [X] T033 Crear `src/hooks/useGridNavigation.ts` con el tabindex rotatorio del patrón WAI-ARIA de rejilla: una sola parada de tabulador, flechas entre celdas y filas, Inicio y Fin en los extremos de la fila, Intro para editar y Esc para cancelar, devolviendo los manejadores y el `tabIndex` de cada celda (FR-046a)
- [X] T034 [P] Crear `src/hooks/useGridNavigation.test.tsx`: las flechas mueven el foco en las dos direcciones y se detienen en los bordes, Inicio y Fin van a los extremos, el tabulador sale de la rejilla en una pulsación y el foco vuelve a la última celda al regresar

### El componente de interfaz que falta (FR-043)

- [X] T034a Crear `src/components/ui/TextArea.tsx`: campo de varias líneas sobre tokens, con `label`, `hint`, `maxLength`, cuenta de caracteres «`<n>`/`<max>`» anunciada con `aria-live="polite"` y el mismo foco visible que `src/components/ui/TextField.tsx`, del que copia la forma. Lo pide la descripción de la tabla de T093, y `src/components/features/schema/SchemaDialog.tsx` no se toca en este incremento
- [X] T034b [P] Crear `src/components/ui/TextArea.test.tsx`: la cuenta sigue a lo escrito, `maxLength` corta en el tope, la etiqueta queda ligada al control y la pista se anuncia

### Estilos (plan.md, Project Structure)

- [X] T035 Añadir a `src/styles/screens.css` las clases nuevas, todas sobre tokens: filas de campo de la tarjeta del lienzo, insignias de marca (`PK`, `UK`, `FK`), rejilla de nueve columnas con su fila de encabezado fija, fila enfocada, celda deshabilitada y tirador del panel inferior con su estado de foco

**Checkpoint**: el formato, el catálogo, la geometría, el estado, las
preferencias y el hook están listos y probados; la pantalla todavía no ha
cambiado.

---

## Phase 3: User Story 1 - Crear una tabla (Priority: P1) 🎯 MVP

**Goal**: crear tablas desde la barra superior, con la tecla `T` y con doble
clic en el lienzo, con llave primaria `id` y campos de auditoría opcionales, y
dejarlas seleccionadas con su editor abierto.

**Independent Test**: desde un modelo con al menos un esquema, crear tres tablas
por las tres vías, comprobar el error de nombre repetido e inválido, que la de
doble clic aparece donde se hizo el doble clic y que la tabla nueva queda
seleccionada.

### Tests for User Story 1

- [X] T036 [P] [US1] Crear `src/components/features/table/TableDialog.test.tsx`: el nombre técnico propuesto («Pagos pendientes» → `pagos_pendientes`), los tres errores de FR-004 (vacío, empieza por número, repetido), la vista previa con `id` y auditoría marcadas por defecto, el esquema propuesto y «Crear tabla» deshabilitada mientras hay error
- [X] T037 [P] [US1] Crear `src/store/tables.test.ts` con los casos de creación: crea con `id` y auditoría del motor del modelo (los tres motores), respeta la posición pedida, usa el centro visible cuando no hay posición, busca hueco libre, selecciona la tabla, abre el panel, marca «Editado» y deja un solo paso «crear la tabla»; no crea nada con nombre repetido ni con esquema inexistente

### Implementation for User Story 1

- [X] T038 [US1] Crear `src/components/features/table/TableDialog.tsx` con los campos de FR-003 —nombre, esquema, descripción— y las dos casillas «Llave primaria id» y «Campos de auditoría» marcadas por defecto, con la nota de qué campos añade cada una según el motor y la vista previa de la tabla resultante (research R2, tablero `TableForm`)
- [X] T039 [US1] Mostrar bajo el nombre el nombre técnico que se guardará y los errores de FR-004 junto al campo, reutilizando `toTechnicalName` de `src/lib/model/propose.ts`, en `src/components/features/table/TableDialog.tsx`
- [X] T040 [US1] Añadir el botón «+ Tabla» a la barra superior en `src/components/layout/EditorChrome.tsx`, que abre el diálogo con el esquema enfocado o el de la tabla seleccionada propuesto (FR-001, FR-005)
- [X] T041 [US1] Añadir el atajo `T` al lienzo en `src/components/features/canvas/CanvasSurface.tsx`, activo solo cuando el foco no está en un campo de texto, usando `src/hooks/useShortcut.ts` (research R16)
- [X] T042 [US1] Añadir el doble clic sobre el fondo del lienzo en `src/components/features/canvas/CanvasSurface.tsx`: convierte el punto de pantalla a coordenadas del modelo con `pan` y `zoom` y abre el diálogo con esa posición (FR-006)
- [X] T043 [US1] Enganchar «Crear la primera tabla» de `src/components/features/canvas/EmptyModelCard.tsx` al diálogo, que hasta ahora era informativa (FR-005 del Incremento 2)
- [X] T044 [US1] Impedir crear una tabla sin esquemas: con el modelo en blanco, el diálogo muestra «Primero crea un esquema: una tabla vive dentro de uno.» y un botón «Crear esquema…» que abre el diálogo del Incremento 2, sin crear nada (FR-002, contracts/tables.md §6)
- [X] T045 [US1] Seleccionar la tabla al pulsarla en el lienzo en `src/components/features/canvas/TableCard.tsx` y `src/components/features/canvas/CanvasSurface.tsx`, y quitar la selección con Esc y al pulsar el fondo (FR-007a, FR-045)
- [X] T046 [US1] Hacer que crear una tabla abra el panel inferior sobre ella en `src/store/tables.ts`: `createTable` llama a `openFieldsPanel` de `src/store/fieldsPanel.ts`, y el marco del panel llega en US2 —hasta entonces el estado queda abierto sin pintar nada— (FR-007)

**Checkpoint**: se pueden crear tablas por las tres vías, aparecen donde toca,
quedan seleccionadas y el lienzo las dibuja con la tarjeta del Incremento 2.
FR-007 queda a medias a propósito: la tabla nueva se selecciona y deja el panel
abierto en el estado (T046), pero el panel no se pinta hasta US2 (T051), así que
el requisito se cierra con esa historia.

---

## Phase 4: User Story 2 - Editor de campos (Priority: P2)

**Goal**: el panel inferior con la rejilla de nueve columnas, añadir, editar,
reordenar y eliminar campos, con el alto del panel entre 200 y 560 px.

**Independent Test**: sobre una tabla existente, añadir, editar, reordenar y
eliminar campos, comprobar que longitud y escala solo se piden cuando el tipo
las admite y que el alto del panel se puede cambiar entre los dos topes.

### Tests for User Story 2

- [X] T047 [P] [US2] Crear `src/components/features/table/FieldsGrid.test.tsx`: las nueve columnas en su orden, longitud y escala deshabilitadas en un tipo que no las admite con el nombre accesible «, no aplica a este tipo», las flechas y Inicio y Fin moviendo el foco, Intro editando, Esc cancelando y el tabulador saliendo en una pulsación
- [X] T048 [P] [US2] Crear `src/components/layout/BottomPanel.test.tsx`: topes 200 y 560 con el puntero y con las flechas en pasos de 24 px, `aria-valuenow` en píxeles, y cerrar el panel conserva la selección
- [X] T049 [P] [US2] Crear `src/store/tables.fields.test.ts`: añadir un campo deja la fila al final y enfocada; cambiar a un tipo sin longitud olvida `length` y `scale`; cambiar a uno con longitud propone su valor; nombre repetido o inválido devuelve error y conserva el valor anterior; reordenar con `moveFieldBy`; eliminar el último campo está prohibido; eliminar un campo con relación la elimina con él
- [X] T050 [P] [US2] Crear `src/components/features/canvas/TableCard.test.tsx`: la tarjeta lista sus campos con nombre y tipo, su alto sigue a `tableHeight` y su nombre accesible es el de `contracts/tables.md` §5

### Implementation for User Story 2

- [X] T051 [US2] Crear `src/components/layout/BottomPanel.tsx`: marco del panel con su borde superior, el tirador `role="separator"` con `aria-orientation="horizontal"` y `aria-valuenow`, el cambio de alto con puntero y con flechas en pasos de 24 px recortado a `[200, 560]`, y el botón de cerrar (FR-022, FR-023)
- [X] T052 [US2] Colocar el panel en `src/components/layout/EditorLayout.tsx` entre el lienzo y la barra de estado, de modo que el lienzo ceda su alto y lo recupere al cerrarlo, sin que el inspector ni la barra lateral se muevan
- [X] T053 [US2] Escribir el alto en la preferencia al soltar el tirador —`setFieldsPanelHeight(px, true)`, no en cada `pointermove`— desde `src/store/fieldsPanel.ts`, usando `preferencesUpdate` de `src/lib/tauri/commands.ts` (contracts/preferences.md, contracts/tables.md §2.3)
- [X] T054 [US2] Crear `src/components/features/table/FieldsPanelHeader.tsx` con el chip del esquema, el nombre de la tabla, el contador de campos y los botones «Plantillas» y «Añadir campo»; «Plantillas» queda sin menú hasta US3 (FR-010)
- [X] T055 [US2] Crear `src/components/features/table/FieldsGrid.tsx` con `role="grid"`, su fila de encabezado —Llave, Nombre, Tipo, Long., Escala, No nulo, Por defecto, Comentario, Orden— y una fila por campo, con los componentes puros `TextField`, `Select` y `Checkbox` en las celdas (FR-011, FR-012)
- [X] T056 [US2] Enganchar `useGridNavigation` a la rejilla en `src/components/features/table/FieldsGrid.tsx`, con el borrador de la celda en estado local y la escritura al almacén en cada pulsación con su clave de fusión (FR-024a, FR-046a)
- [X] T057 [US2] Pedir longitud y escala solo donde el tipo las admite, en `src/components/features/table/FieldsGrid.tsx`: las celdas se deshabilitan con `typeTraits` del motor del modelo, el cambio de tipo olvida o propone valores, y una escala mayor que la longitud muestra «La escala no puede pasar de la longitud.» sin guardar (FR-015, FR-016)
- [X] T058 [US2] Mostrar los tipos del motor en la celda de tipo de `src/components/features/table/FieldsGrid.tsx` con `typesOf`, y un tipo que el motor no reconoce con su aviso «`<tipo>` no es un tipo de `<motor>`.» sin invalidar el archivo (FR-018, FR-018a)
- [X] T059 [US2] Implementar «Añadir campo» y el reordenado por fila en `src/components/features/table/FieldsGrid.tsx`: la fila nueva llega enfocada en su nombre, y las flechas de subir y bajar —con ⌥↑ y ⌥↓ como atajo— se deshabilitan en el primero y el último (FR-013, FR-014)
- [X] T060 [US2] Normalizar y validar el nombre del campo en la celda de `src/components/features/table/FieldsGrid.tsx`: minúsculas y guion bajo al escribir, `toTechnicalName` y unicidad al confirmar, con «Ya hay un campo `<nombre>` en esta tabla.» en la fila (FR-017, research R9)
- [X] T060a [US2] Propagar el nombre nuevo del campo dentro de `updateField` en `src/store/tables.ts`: al cambiar `name`, reescribirlo en `primaryKey`, en `uniques`, en `indexes` y en las relaciones que lo nombraban en `fromFields` o en `toFields`, en el mismo paso de historial, y mostrar en la celda de llave «La relación `<nombre>` usa este campo.» con `relationsTouching` (FR-021, contracts/tables.md §2.2 y §6)
- [X] T060b [P] [US2] Ampliar `src/store/tables.fields.test.ts` con el renombrado: un campo de la llave primaria renombrado sigue en `primaryKey`; un campo que una relación usa deja la relación apuntando al nombre nuevo en los dos extremos; deshacer devuelve el nombre viejo y la relación a la vez
- [X] T061 [US2] Crear `src/components/features/table/DeleteFieldDialog.tsx`: confirmación que nombra las relaciones que se van con el campo, y el botón de eliminar deshabilitado con «Una tabla necesita al menos un campo.» cuando es el único (FR-019, FR-020)
- [X] T062 [US2] Reescribir `src/components/features/canvas/TableCard.tsx` para que liste sus campos con nombre y tipo, con el alto de `tableHeight` y el nombre accesible completo, de modo que lo que se escribe en el panel se vea en el lienzo (FR-012, FR-047)
- [X] T063 [US2] Abrir el panel con doble clic sobre una tabla y con el atajo ⌥⌘E / Alt+Ctrl+E, en `src/components/features/canvas/CanvasSurface.tsx` y `src/components/layout/EditorChrome.tsx` (FR-023, research R16)

**Checkpoint**: una tabla se describe campo a campo, el lienzo lo refleja al
instante y el panel se ajusta de alto. Con US1, el objetivo del incremento ya
está cubierto.

---

## Phase 5: User Story 3 - Llaves y plantillas de campos (Priority: P3)

**Goal**: marcar campos como llave primaria o única, verlo en la tabla del
lienzo, y añadir grupos de campos comunes de una vez.

**Independent Test**: marcar PK y UK en campos de una tabla y comprobar la marca
en el lienzo; aplicar cada plantilla sobre una tabla vacía y sobre otra que ya
tiene esos campos.

### Tests for User Story 3

- [X] T064 [P] [US3] Ampliar `src/store/tables.fields.test.ts` con las llaves: `setFieldKey` a `PK` añade el campo a `primaryKey` y fuerza `nullable: false`; a `UK` crea `uq_<tabla>_<campo>`; a `null` quita las dos; dos campos `PK` forman una llave compuesta; un único de varios campos no se toca
- [X] T065 [P] [US3] Ampliar `src/store/tables.fields.test.ts` con las plantillas: `applyTemplate` añade solo los campos que faltan, no duplica ni marca «Editado» cuando ya están todos, usa los tipos del motor y deja un solo paso de historial
- [X] T066 [P] [US3] Ampliar `src/components/features/canvas/TableCard.test.tsx`: las insignias `PK`, `UK` y `FK` salen en la fila del campo y entran en su nombre accesible, y el color no es el único portador de la marca (FR-047)

### Implementation for User Story 3

- [X] T067 [US3] Implementar la celda «Llave» en `src/components/features/table/FieldsGrid.tsx` como un selector de `—`, `PK` y `UK`, y como etiqueta de solo lectura cuando una relación define el campo, con su título «Definida por una relación» (FR-025, research R12)
- [X] T068 [US3] Bloquear «No nulo» en un campo marcado `PK`, que queda no nulo y no puede dejar de serlo mientras lo esté, en `src/components/features/table/FieldsGrid.tsx` (FR-026)
- [X] T069 [US3] Dibujar las marcas en la tarjeta del lienzo con `fieldMarks` en `src/components/features/canvas/TableCard.tsx`, con las insignias de `src/styles/screens.css` y el texto en el nombre accesible (FR-025, FR-029)
- [X] T070 [US3] Crear `src/components/features/table/FieldTemplatesMenu.tsx` con los cuatro grupos de `templatesOf` —auditoría, borrado lógico, autoría y activo—, cada uno con los campos que añade, y los ya aplicados apagados con «Ya está en la tabla» (FR-027, FR-028)
- [X] T071 [US3] Enganchar el menú al botón «Plantillas» de `src/components/features/table/FieldsPanelHeader.tsx`, cerrándolo al aplicar y dejando el foco en la primera fila añadida

**Checkpoint**: la identidad de una tabla se define y se ve en el lienzo, y los
campos de siempre se añaden de una vez.

---

## Phase 6: User Story 4 - Mover tablas (Priority: P4)

**Goal**: arrastrar tablas por el lienzo, cambiarlas de esquema soltándolas en
otra zona y alinearlas a la cuadrícula si la preferencia está activa.

**Independent Test**: con un modelo de dos esquemas y tres tablas, arrastrar una
tabla dentro de su zona, soltarla en la zona del otro esquema y repetir con la
cuadrícula activada y desactivada.

### Tests for User Story 4

- [X] T072 [P] [US4] Ampliar `src/store/tables.test.ts` con el movimiento: `moveTable` suma el desplazamiento resolviendo primero la posición que no venía en el archivo, ajusta a la cuadrícula cuando la preferencia está activa, cambia el esquema cuando se le pasa uno, deja un solo paso —«mover la tabla» o «cambiar la tabla de esquema»— y no hace nada con desplazamiento cero y el mismo esquema
- [X] T073 [P] [US4] Crear `src/components/features/table/TableContextMenu.test.tsx`: «Editar campos…» abre el panel y «Mover a esquema» lista los demás esquemas con su abreviatura y su color

### Implementation for User Story 4

- [X] T074 [US4] Implementar el arrastre de la tarjeta en `src/components/features/canvas/CanvasSurface.tsx` con el patrón del Incremento 2: umbral de 3 px, el desplazamiento pintado en variables CSS por referencia, el almacén intacto mientras el dedo está abajo y una sola llamada a `moveTable` al soltar (FR-030, FR-033, research R4)
- [X] T075 [US4] Decidir la prioridad del `pointerdown` en el nodo del lienzo una sola vez: tarjeta primero, zona después, fondo al final, y con Espacio mantenido o el botón central siempre mueve la vista, en `src/components/features/canvas/CanvasSurface.tsx` y `src/hooks/useCanvasView.ts`
- [X] T076 [US4] Cambiar el esquema al soltar con `zoneAt` sobre el punto del puntero, en `src/components/features/canvas/CanvasSurface.tsx` y `src/store/tables.ts`, conservando el esquema cuando cae fuera de toda zona y tomando la última zona del orden del modelo cuando hay solapes (FR-031)
- [X] T077 [US4] Aplicar `snapToGrid` al soltar según la preferencia, en `src/store/tables.ts`, sin ajustar durante el gesto (FR-032, research R5)
- [X] T078 [US4] Añadir «Ajustar a la cuadrícula» a `src/components/features/preferences/PreferencesWindow.tsx` con la nota «Las tablas se alinean a los puntos del lienzo al soltarlas», escribiendo `snapToGrid` (contracts/preferences.md)
- [X] T079 [US4] Mover la tabla seleccionada con las flechas del teclado —1 px, o un paso de cuadrícula con ⇧— con las mismas reglas de esquema y de ajuste, en `src/components/features/canvas/CanvasSurface.tsx` (FR-034)
- [X] T080 [US4] Crear `src/components/features/table/TableContextMenu.tsx` sobre `src/components/ui/ContextMenu.tsx` con «Editar campos…» y el submenú «Mover a esquema», y engancharlo a la tarjeta del lienzo; cada entrada con atajo lo muestra con `src/components/ui/Kbd.tsx` y el modificador de su sistema —⌘ en macOS, Ctrl en Windows, con `isMacOS` de `src/lib/platform.ts`—; las tres acciones de ciclo de vida las añade US5 (FR-035, FR-036, FR-046)
- [X] T081 [US4] Hacer que el lienzo siga a la tabla cuando el arrastre llega al borde del área visible y que el minimapa refleje la posición nueva, en `src/components/features/canvas/CanvasSurface.tsx` y `src/components/features/canvas/Minimap.tsx` (US4 escenario 7)

**Checkpoint**: el diagrama se acomoda y las tablas cambian de esquema
arrastrándolas. Con US1, US2 y US4, la demostración está completa salvo
renombrar.

---

## Phase 7: User Story 5 - Renombrar, duplicar y eliminar tablas (Priority: P5)

**Goal**: gestionar tablas existentes sin rehacerlas, con el nombre técnico a la
vista, una copia en un hueco libre y una confirmación que dice qué se lleva.

**Independent Test**: sobre una tabla existente, renombrarla a un nombre nuevo y
a uno ya usado, duplicarla dos veces y eliminarla desde su menú contextual.

### Tests for User Story 5

- [X] T082 [P] [US5] Crear `src/components/features/table/RenameTableDialog.test.tsx`: el nombre técnico a la vista, «Ya existe una tabla llamada `<nombre>`.», el nombre inválido sin poder confirmar y Esc dejando el modelo como estaba
- [X] T083 [P] [US5] Crear `src/components/features/table/DeleteTableDialog.test.tsx`: el título nombra la tabla, la descripción dice cuántas relaciones se eliminan y cancelar no cambia el modelo
- [X] T084 [P] [US5] Ampliar `src/store/tables.test.ts`: renombrar propaga el nombre a las relaciones y a los nombres de `uniques` e `indexes` que empezaban por el viejo; duplicar crea `<tabla>_copia` y `_copia_2`, copia campos, llaves, índices y descripción, no copia relaciones y deja la copia seleccionada; eliminar se lleva las relaciones, cierra el panel y se deshace entero

### Implementation for User Story 5

- [X] T085 [US5] Crear `src/components/features/table/RenameTableDialog.tsx` siguiendo el patrón de `src/components/features/editor/RenameModelDialog.tsx`, con el nombre técnico resultante a la vista y la validación de FR-037
- [X] T086 [US5] Añadir «Renombrar…», «Duplicar tabla» y «Eliminar tabla…» a `src/components/features/table/TableContextMenu.tsx`, la última con el estilo destructivo (FR-036)
- [X] T087 [US5] Crear `src/components/features/table/DeleteTableDialog.tsx` con el conteo de relaciones de `relationsTouching` y el aviso de que se puede deshacer (FR-039)
- [X] T088 [US5] Añadir los atajos ⌘D / Ctrl+D para duplicar y ⌫ / Supr para eliminar la tabla seleccionada —el segundo abre la confirmación, no borra— en `src/components/features/canvas/CanvasSurface.tsx` (research R16)
- [X] T089 [US5] Cerrar el panel y vaciar la selección cuando se elimina la tabla que estaba abierta, sin errores, en `src/store/tables.ts` y `src/store/fieldsPanel.ts` (FR-040)
- [X] T090 [US5] Colocar la copia en el hueco libre más cercano con `findFreeSpot` y avisar con el `showNotice` del Incremento 1 de cómo se llamó, en `src/store/tables.ts` (FR-038)

**Checkpoint**: el ciclo de vida de la tabla está completo y la demostración del
incremento —tres tablas con campos, moverlas entre esquemas y renombrarlas— se
puede hacer de principio a fin.

---

## Phase 8: User Story 6 - Inspector de tabla (Priority: P6)

**Goal**: ver y cambiar los datos principales de la tabla seleccionada sin abrir
el editor completo, con el resumen de campos y sus relaciones.

**Independent Test**: seleccionar una tabla de pocos campos y otra de más de
ocho, comprobar los datos, el tope de la descripción, el cambio de esquema y el
enlace al editor de campos.

### Tests for User Story 6

- [X] T091 [P] [US6] Ampliar `src/components/layout/Inspector.test.tsx`: con tabla seleccionada muestra nombre, descripción con cuenta de caracteres y tope de 280, esquema con abreviatura, los ocho primeros campos con su marca y su tipo, «Mostrar N más» y las relaciones; sin selección vuelve a la ficha del modelo
- [X] T092 [P] [US6] Ampliar `src/components/layout/ModelSidebar.test.tsx`: pulsar la fila de una tabla la selecciona y abre el inspector, y su menú contextual es el mismo de la tarjeta

### Implementation for User Story 6

- [X] T093 [US6] Añadir a `src/components/layout/Inspector.tsx` la ficha de la tabla seleccionada: nombre editable con la validación de FR-037, descripción en `TextArea` con cuenta y `maxLength` de 280 y su nota «Se exporta como COMMENT ON TABLE y aparece en el diccionario de datos», y selector de esquema que la mueve a esa zona (FR-042, FR-043)
- [X] T094 [US6] Añadir el resumen de campos a `src/components/layout/Inspector.tsx`: los ocho primeros con su insignia de `fieldMarks` y su tipo, «Mostrar N más» / «Mostrar menos», la nota «? = admite nulos» y el botón de abrir el editor de campos (FR-044, research R14)
- [X] T095 [US6] Hacer que pulsar un campo del resumen de `src/components/layout/Inspector.tsx` abra el panel con esa celda enfocada, usando `openFieldsPanel(table, cell)` de `src/store/fieldsPanel.ts` (FR-044)
- [X] T096 [US6] Añadir la sección de relaciones a `src/components/layout/Inspector.tsx`, con «Esta tabla todavía no tiene relaciones.» cuando no hay ninguna (FR-045)
- [X] T097 [US6] Añadir el menú de acciones de la tabla al inspector —el mismo `TableContextMenu`, abierto desde el botón de puntos suspensivos y con ⇧F10— y la selección desde la fila de la tabla en `src/components/layout/ModelSidebar.tsx` (FR-036)
- [X] T098 [US6] Actualizar el contador de tablas de `src/components/layout/StatusBar.tsx` para que siga al modelo de verdad y diga el esquema de la tabla seleccionada (FR-004 del Incremento 2)

**Checkpoint**: las seis historias están completas y el incremento es
demostrable de principio a fin.

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: el recorrido, las revisiones a mano, las medidas y el cierre del
incremento.

- [X] T099 Crear `e2e/specs/10-tablas-y-campos.e2e.js` con los diez escenarios de `quickstart.md`: crear tres tablas por las tres vías, definir campos con marcas y plantilla, mover entre esquemas, cuadrícula, renombrar y duplicar, eliminar con relaciones, alto del panel con reinicio, deshacer por celda, solo teclado, y guardar y reabrir
- [X] T100 Ejecutar el recorrido completo en macOS (`npm run build && npm run e2e`) y arreglar lo que saque en `e2e/specs/10-tablas-y-campos.e2e.js` y en el código que señale, con atención al arrastre de tarjeta y al doble clic
- [X] T101 [P] Revisar en tema claro, tema oscuro y con «Reducir movimiento» las pantallas de `src/components/features/table/` y `src/components/layout/BottomPanel.tsx` —diálogo Nueva tabla, panel de campos, inspector de tabla, diálogo de renombrar, menú contextual y las dos confirmaciones—, sin texto de contenido por debajo de 4,5:1 ni metadatos de 10–11 px por debajo de 3:1 (SC-011, puerta 5)
- [X] T101a [P] Provocar a mano los cinco estados de SC-010 —modelo sin esquemas, nombre de tabla repetido, nombre de campo repetido, tabla con un solo campo y campo usado por una relación— y comprobar que cada uno muestra su mensaje de `contracts/tables.md` §6 y deja al menos una salida clara, anotando aquí lo que se vio
- [X] T102 [P] Recorrer el incremento entero solo con el teclado, con foco visible en cada paso, incluidas la rejilla de `src/components/features/table/FieldsGrid.tsx` y el tirador de `src/components/layout/BottomPanel.tsx`, y arreglar lo que falte (SC-009, puerta 4)
- [X] T103 Medir SC-004 y SC-005 con `modelo-50-tablas.yaml` y una tabla de 40 campos: arrastrar una tabla a 60 cuadros por segundo con respuesta al primer gesto por debajo de 100 ms, y cada pulsación visible en la fila y en la tarjeta por debajo de 100 ms, anotando las cifras en este archivo como hizo el Incremento 2
- [X] T104 [P] Cronometrar los tiempos de `quickstart.md`: crear una tabla en tres pasos y menos de 30 s (SC-001) y la demostración completa —tres tablas con campos, moverlas y renombrarlas— en menos de 6 minutos (SC-002)
- [X] T105 [P] Comprobar a mano la tabla de 40 campos de `e2e/soporte/modelo-tablas.yaml` y la ventana en su tamaño mínimo (820 × 500): la fila de encabezado se queda fija, el resumen del inspector no pasa de sus ocho filas y el panel a 200 px deja lienzo usable (SC-006)
- [X] T106 [P] Repasar la puerta 8 en todo lo nuevo de `src/` y `src-tauri/src/preferences.rs`: JSDoc en español en cada función pura, componente, hook, acción del almacén y campo, y `///` en los dos campos de Rust, incluidos los bloques de `Field`, `TableCard`, `schemaZones` y `resolveLayout`, que cambian de comportamiento
- [X] T107 [P] Repasar la puerta 6: ningún archivo del tablero copiado al repositorio, y los ocho desvíos deliberados de `specs/004-tablas-campos/research.md` R18 —seis de comportamiento y dos de texto— siguen siendo los únicos
- [X] T108 Pasar las cinco puertas en limpio desde la raíz y desde `src-tauri/`: `npx tsc --noEmit`, `npm run lint`, `npx vitest run`, `cargo check` y `cargo test`
- [X] T109 Subir la versión del producto a `1.3.0` en `package.json`, `src-tauri/tauri.conf.json` y `src-tauri/Cargo.toml`, y actualizar `README.md` con lo que el Editor hace ahora
- [ ] T110 Abrir el PR hacia `main`, esperar `.github/workflows/puertas.yml` y `.github/workflows/recorrido.yml` en verde en las dos plataformas, y dejar la etiqueta anotada `v1.3.0` sobre el commit que cierra el incremento (constitución, Versión del producto y etiquetas)

---

## Medidas del cierre (2026-10-28)

Tomadas con la aplicación en marcha, conducida por el servidor de WebDriver que
el binario monta con `--features webdriver`, sobre `modelo-tablas.yaml` —cinco
tablas, una de ellas de 40 campos— y `modelo-50-tablas.yaml`.

**T100 · El recorrido completo.** Los once archivos de `e2e/specs/` en verde,
48 s. Lo que sacó y hubo que arreglar: la fixture llevaba `default: true` sin
comillas y el validador la rechazaba; las zonas de esquema se solapaban y
`zoneAt` resuelve el solape con la última, así que el modelo del recorrido
reparte las tablas por esquema y el escenario busca un punto que caiga solo en
la zona de destino; el inspector y el diálogo llamaban igual a su selector de
esquema («Esquema de la tabla»), y el inspector, que está antes en el DOM, se
llevaba el gesto —ahora se llama «Esquema de `<tabla>`»—. Y tres del producto:
la clave de fusión del historial llevaba el nombre del campo, que cambia con
cada letra, y dejaba un paso de deshacer por letra (FR-024a); Intro no enviaba
ninguna hoja, porque el envío implícito del formulario no llega en esta
ventana, y ahora lo manda `requestSubmit`; y crear una tabla no dejaba el foco
en la rejilla, así que `createTable` enfoca su primera celda (SC-009).

**T101 · SC-011.** Las siete superficies nuevas, en tema claro y en tema
oscuro, midiendo el contraste de cada texto visible contra su fondo compuesto:

| Superficie | Contenido (claro / oscuro) | Metadatos de 10–11 px (claro / oscuro) |
| ---------- | -------------------------- | -------------------------------------- |
| Editor con el panel de campos y el inspector | 11.35:1 / 8.38:1 | 3.06:1 / 3.28:1 |
| Diálogo Nueva tabla | 5.99:1 / 6.30:1 | 4.16:1 / 4.27:1 |
| Nueva tabla con el error de nombre repetido | 5.99:1 / 6.30:1 | 4.16:1 / 4.27:1 |
| Menú contextual de la tabla | 5.79:1 / 5.82:1 | 5.53:1 / 7.42:1 |
| Diálogo Renombrar tabla | 5.99:1 / 6.30:1 | 4.16:1 / 4.27:1 |
| Confirmación de eliminar la tabla | 5.38:1 / 5.38:1 | 4.16:1 / 4.27:1 |
| Confirmación de eliminar un campo con relación | 5.38:1 / 5.38:1 | 4.16:1 / 4.27:1 |

El mínimo del texto de contenido es 5.38:1 («Eliminar tabla y relaciones»,
13 px) y el de los metadatos 3.06:1 en claro y 3.28:1 en oscuro, los dos del
Editor y los dos iguales a los del Incremento 2: son textos suyos, no de este
incremento.

La medida sacó un fallo real: el atajo de la fila marcada del menú se quedaba
gris sobre el relleno de acento —1.90:1 en claro y 1.76:1 en oscuro—, porque
`Kbd` pone su color en el propio `kbd` y un color puesto en el elemento gana a
lo que herede del contenedor. Arreglado en `src/styles/aura.css` nombrando ese
`kbd` en las reglas de `[data-highlighted]`, de acento y de peligro; con eso la
fila marcada pasa a 5.53:1 y 7.42:1.

Queda una excepción anotada: la etiqueta del botón primario **deshabilitado**
—«Crear tabla» con el nombre vacío, «Renombrar» sin cambios— mide 3.68:1 en
claro y 2.72:1 en oscuro. Es el estado deshabilitado del sistema Aura, que lo
pinta con opacidad 0.45, y es el único texto por debajo de su umbral en las
siete superficies. WCAG 1.4.3 exime a los controles inactivos y el motivo
también se dice con palabras —el error en el campo—, así que se deja como está;
cambiarlo sería tocar el token de deshabilitado de todo el producto.

Sobre «Reducir movimiento»: las reglas del ajuste solo anulan duraciones y
animaciones —`src/styles/tokens.css` 208-225, `src/styles/screens.css` 88, 153
y 241, y esta última solo para la barra de la pantalla de arranque—, así que no
tocan ningún color ni ninguna caja y el contraste sale igual con el ajuste
puesto.

**T101a · SC-010.** Los cinco estados, provocados uno a uno:

| Estado | Lo que se vio |
| ------ | ------------- |
| Modelo sin esquemas | «Primero crea un esquema: una tabla vive dentro de uno.» con «Crear esquema…» habilitado |
| Nombre de tabla repetido | «Ya existe una tabla llamada `facturas`.», «Crear tabla» apagada y el foco en «Nombre» |
| Nombre de campo repetido | «Ya hay un campo `nombre` en esta tabla.» y la tarjeta sigue diciendo `correo` |
| Tabla con un solo campo | «Tabla solo_id, 1 campo»: la confirmación dice «Una tabla necesita al menos un campo.» y «Eliminar campo» está apagada con ese mismo título |
| Campo usado por una relación | En la celda de llave, «La relación `fk_factura_lineas_factura` usa este campo.»; al eliminarlo, «Se eliminará también la relación `fk_factura_lineas_factura`.» con «Cancelar» y «Eliminar campo» |

Los cinco traen su mensaje de `contracts/tables.md` §6 y los cinco dejan
salida.

**T102 · SC-009.** Cada control de las superficies nuevas recibe el foco y lo
marca, mirando por separado las paradas de tabulador y los controles de
tabindex rotatorio, que no son paradas porque se recorren con las flechas:

| Superficie | Paradas de tabulador | De tabindex rotatorio |
| ---------- | -------------------- | --------------------- |
| Editor con la rejilla de 40 campos y el inspector | 51 | 381 |
| Diálogo Nueva tabla | 7 | 1 |
| Menú contextual de la tabla | 1 | 5 |
| Diálogo Renombrar tabla | 3 | 0 |
| Confirmación de eliminar la tabla | 2 | 0 |

Ninguno se quedó sin marca: las paradas sacan su anillo de 2 px y las celdas de
la rejilla y las filas del menú lo marcan con `:focus-visible` o con el relleno
de acento de `data-highlighted`. Las 381 celdas son las nueve columnas de las
40 filas más sus botones de orden y borrado, que es toda la rejilla.

Sigue valiendo lo que anotó el Incremento 2 (T089): lo que depende de una
acción por defecto del navegador —tabular, o activar un botón con Enter— no se
puede comprobar con el recorrido, porque las teclas que manda llegan con
`isTrusted` en falso. Por eso la cadena se mide por el DOM, enfocando cada
control en orden. Lo que sí es de la aplicación se comprueba con teclas de
verdad en el escenario 9 de `e2e/specs/10-tablas-y-campos.e2e.js`: `T` abre el
diálogo, Intro lo envía, el foco cae en la primera celda, las flechas recorren
la rejilla y ⌥↑ y ⌥↓ reordenan.

**T103 · SC-004 y SC-005.** Con `modelo-50-tablas.yaml` abierto, arrastrando
una tarjeta 60 pasos, uno por fotograma:

| Medida | Valor |
| ------ | ----- |
| Respuesta al primer gesto | 21–32 ms |
| Trabajo por paso (media / p95 / peor) | 11.6 / 12 / 13 ms |
| Pasos en los que la tarjeta se movió | 60 de 60 |
| Fotograma durante el gesto | 32 ms (31 por segundo) |

El trabajo por paso es el manejador más el estilo y la maquetación que arrastra,
con la lectura forzada para que la maquetación entre en la cuenta: el peor caso,
13 ms, cabe en los 16,7 ms de un fotograma de 60, y cada paso movió la tarjeta
antes del fotograma siguiente.

El ritmo de fotogramas no llega a 60 por lo mismo que anotó el Incremento 2
(T090): con el Modo de bajo consumo encendido WebKit pinta a unos 30 por
segundo, con gesto y sin él. La cifra de 60 de SC-004 queda por medir con ese
modo apagado.

Escribir en la celda de nombre de la tabla de 40 campos, diez pulsaciones
seguidas, midiendo hasta que la fila y la tarjeta del lienzo muestran el texto
nuevo: 79, 87, 83, 94, 77, 82, 78, 87, 81 y 91 ms; media 84 ms y peor caso
94 ms, por debajo de los 100 ms de SC-005. Cada pulsación renombra el campo de
verdad, así que la cifra incluye reescribir el nombre en la tarjeta del lienzo.

**T104 · SC-001 y SC-002.** Crear una tabla son tres pasos —`T`, escribir el
nombre, confirmar— y 171 ms de reloj. La demostración entera —tres tablas por
las tres vías, con un campo cada una, renombradas y movidas de esquema—
2 015 ms. Son los tiempos de la mecánica, conducida por el recorrido: el tope
de 30 s y de 6 min de SC-001 y SC-002 es para una persona, que además lee y
teclea, y lo que esto mide es el suelo.

**T105 · SC-006.** Con la ventana en su tamaño mínimo (820 × 500 medidos dentro
de la ventana) y el panel en su tope de abajo, 200 px:

| Medida | Valor |
| ------ | ----- |
| Fila de encabezado de la rejilla | se queda en y = 241 con la rejilla desplazada 1 087 px |
| Celdas de nombre en la rejilla | 40, todas en el árbol |
| Resumen del inspector | 8 filas y «Mostrar 32 más» |
| Lienzo que queda | 147 px de alto |

El encabezado no se va y el resumen no crece. Los 147 px de lienzo dan para la
tarjeta seleccionada y poco más: con la ventana en su mínimo y el panel abierto,
el sitio es para editar campos, no para acomodar el diagrama; cerrar el panel
devuelve el lienzo entero y la selección se conserva (FR-023).

**T106 · Puerta 8.** Los ocho archivos nuevos de `src/` —`BottomPanel.tsx`,
`Menu.tsx`, `TextArea.tsx`, `useGridNavigation.ts`, `engines.ts`, `marks.ts`,
`fieldsPanel.ts` y `tables.ts`— y los nueve de `features/table/` llevan su
bloque de cabecera y sus props documentadas, cada entrada nueva de
`src/store/types.ts` lleva su comentario, y los dos campos de Rust llevan `///`
(`src-tauri/src/preferences.rs` 68 y 71). Los componentes se documentan en la
cabecera del archivo, que es la convención del repositorio desde el
Incremento 1.

**T107 · Puerta 6.** Ningún archivo del tablero en el repositorio: no hay
`support.js`, `bundle.js` ni HTML del lienzo en `git ls-files`. Los ocho
desvíos de R18 siguen siendo los únicos: una sola tabla seleccionada
(`selectedTable: string | null`), el panel con «Campos» y sin control
segmentado, el campo con relación que se confirma y se elimina, deshacer por
celda sin ningún `setTimeout` en el estado, `GRID_SNAP = 24`, los tipos por
motor de `engines.ts`, y los dos términos del enunciado, «Llave primaria id» y
«Campos de auditoría», sin rastro de los del tablero.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (fase 1)**: sin dependencias; las cuatro tareas pueden ir a la vez
- **Foundational (fase 2)**: depende de la fase 1 y **bloquea las seis
  historias**
- **US1 (fase 3)**: depende de la fase 2. Es la historia sin la que no hay nada
  que editar
- **US2 (fase 4)**: depende de la fase 2 y de la selección de US1 (T045)
- **US3 (fase 5)**: depende de US2, porque la columna «Llave» y el botón
  «Plantillas» viven en la rejilla y en la cabecera que US2 crea
- **US4 (fase 6)**: depende de la fase 2 y del `TableCard` reescrito de US2
  (T062), que es el nodo que se arrastra
- **US5 (fase 7)**: depende de US1 (hay que poder crear para poder renombrar) y
  del menú contextual que US4 crea (T080)
- **US6 (fase 8)**: depende de US2 para el enlace a la celda del panel y de US4
  para el menú de acciones; funciona sin US3 y sin US5, mostrando el resumen sin
  insignias de llave
- **Polish (fase 9)**: depende de las seis historias

### Dependencias no obvias

- **T017 es una sola tarea a propósito**: quitar `TABLE_HEIGHT` rompe cuatro
  archivos a la vez (`geometry.ts`, `layout.ts`, `TableCard.tsx` y
  `Minimap.tsx`). Partirla deja el typecheck roto entre commits
- **T022 antes que T027**: `updateField` y `setTableComment` necesitan
  `pushHistory` con clave; sin él cada pulsación sería un paso y SC-007 fallaría
- **T030 y T031 van juntas**: el campo en Rust y su tipo en TypeScript tienen
  que entrar en el mismo cambio, o el typecheck falla en uno de los dos lados
- **T033 antes que T055 y T056**: la rejilla se construye sobre el hook, no al
  revés; escribir las celdas primero obliga a reescribirlas al enganchar el foco
- **T025 antes que T045, T093 y T098**: `selectedTable` es lo que leen la
  tarjeta, el inspector y la barra de estado
- **T034a antes que T093**: la descripción de la tabla necesita cuenta de
  caracteres y tope de 280, y `src/components/ui/` no tiene campo de varias
  líneas: el Incremento 2 usó `TextField` sin contador para la del esquema
- **T060a dentro de `updateField`, no aparte**: renombrar un campo y reescribir
  su nombre en `primaryKey`, `uniques`, `indexes` y las relaciones tiene que
  caer en el mismo paso de historial, o deshacer dejaría la relación apuntando
  a un campo que ya no existe (FR-021)
- **T046 antes que T051**: `createTable` deja el panel «abierto» en el estado
  desde US1, y US2 es quien lo pinta. Entre las dos historias el estado existe
  sin pintar nada, y es deliberado para que US1 sea independiente
- **T062 antes que T069 y T074**: las tres tocan `TableCard.tsx`; hacerlas en
  paralelo termina en conflicto. El orden es: listar campos, luego las marcas,
  luego el arrastre
- **T075 antes que T079 y T081**: la prioridad del `pointerdown` —tarjeta, zona,
  fondo— se decide una vez; el teclado y el seguimiento del borde se cuelgan de
  esa decisión
- **T080 antes que T086 y T097**: el menú contextual de la tabla nace en US4 con
  «Editar campos…» y «Mover a esquema»; US5 le añade las tres acciones de ciclo
  de vida y US6 lo reutiliza desde el inspector. Si naciera en US5, US4 no
  tendría vía de teclado para cambiar de esquema
- **T019 antes que T076 y T090**: `zoneAt` y `findFreeSpot` son de la fase 2
  porque las usan dos historias distintas (US4 al soltar, US1 y US5 al colocar)
- **T015 antes que T061, T069, T087 y T094**: `fieldMarks` y
  `relationsTouching` alimentan la rejilla, la tarjeta, las dos confirmaciones y
  el resumen del inspector
- **T001, T002 y T003 antes de casi toda prueba**: los modelos de ejemplo son la
  entrada de las pruebas del validador, del almacén y del recorrido
- **T026 y T027 se implementan en la fase 2 pero se prueban en las fases 3 a 8**:
  es la única excepción a la regla de escribir la prueba antes, y es deliberada
  —las trece acciones bloquean a todas las historias y cada prueba necesita el
  escenario completo de la suya—. Quien tome T026 y T027 deja las firmas, las
  etiquetas de historial y las claves de fusión; quien tome T037, T049, T064,
  T065, T072 y T084 las prueba

### Parallel Opportunities

- Fase 1: las cuatro tareas a la vez, no se tocan
- Fase 2: seis frentes independientes — formato (T005 a T011), catálogo y
  marcas (T012 a T016), geometría (T017 a T021), estado e historial (T022 a
  T029), preferencias y hook (T030 a T034) y el `TextArea` con sus estilos
  (T034a, T034b, T035)
- Las pruebas de cada historia marcadas [P] son archivos distintos y van juntas
- US3 y US4 pueden repartirse entre dos personas en cuanto US2 cierre, con una
  salvedad: las dos tocan `TableCard.tsx` (T069 y T074), así que ese archivo lo
  cierra una antes de que la otra empiece
- Fase 9: T101, T102, T104, T105, T106 y T107 en paralelo

---

## Parallel Example: Phase 2

```bash
# Cinco frentes sin solape, en cuanto la fase 1 esté:
Tarea: "Añadir length y scale a Field en src/lib/model/types.ts"
Tarea: "Crear src/lib/model/engines.ts con el catálogo de tipos por motor"
Tarea: "Crear src/lib/model/marks.ts con fieldMarks y relationsTouching"
Tarea: "Reemplazar TABLE_HEIGHT por tableHeight en src/lib/canvas/constants.ts"
Tarea: "Añadir snap_to_grid y fields_panel_height a src-tauri/src/preferences.rs"
Tarea: "Crear src/hooks/useGridNavigation.ts"
Tarea: "Crear src/components/ui/TextArea.tsx con cuenta de caracteres"
```

## Parallel Example: User Story 2

```bash
# Las cuatro pruebas de la historia, archivos distintos:
Tarea: "Crear src/components/features/table/FieldsGrid.test.tsx"
Tarea: "Crear src/components/layout/BottomPanel.test.tsx"
Tarea: "Crear src/store/tables.fields.test.ts"
Tarea: "Crear src/components/features/canvas/TableCard.test.tsx"
```

---

## Implementation Strategy

### MVP primero (solo US1)

1. Fase 1: Setup
2. Fase 2: Foundational (bloquea todo lo demás)
3. Fase 3: US1
4. **PARAR Y VALIDAR**: se crean tablas por las tres vías, aparecen donde toca y
   quedan seleccionadas
5. Demostrable: el modelo ya tiene entidades, aunque todavía no se describan

### Entrega incremental

1. Setup + Foundational → cimiento listo
2. US1 → crear tablas (MVP)
3. US2 → los campos: con esto el objetivo del incremento está cubierto
4. US3 → llaves y plantillas, que es lo que hace rápido crear las tres tablas
5. US4 → mover entre esquemas: el tercer paso de la demostración
6. US5 → renombrar, que cierra la demostración, más duplicar y eliminar
7. US6 → el inspector, comodidad sobre lo que ya se puede hacer

Tras US5 la demostración del incremento está completa: crear tres tablas con sus
campos, moverlas entre esquemas y renombrarlas.

### Reparto entre dos personas

1. Fases 1 y 2 juntas, que es donde están las decisiones
2. Con US1 cerrada: una persona con US2 y US3 (`features/table/`), la otra
   preparando US4 (`features/canvas/`), con la salvedad de `TableCard.tsx`
3. Con US2 cerrada: una con US4 y US5, la otra con US6 (`layout/`)

---

## Notes

- `[P]` = archivos distintos y sin dependencias pendientes
- `[Story]` liga la tarea a su historia para poder rastrearla
- Las pruebas se escriben antes de la implementación de su tarea y han de fallar
  primero. La única excepción declarada son T026 y T027: ver Dependencias no
  obvias
- Un commit por tarea o por grupo lógico, con las cinco puertas en verde antes
  de darla por hecha
- La puerta 2 (SQL por motor) no aplica a este incremento; su equivalente es
  T014, el catálogo de tipos probado en los tres motores
- La versión y la etiqueta son lo último (T109, T110), nunca a mitad de la
  implementación
