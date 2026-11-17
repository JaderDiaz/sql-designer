---
description: "Tareas del Incremento 5 · Enums, índices y únicos"
---

# Tasks: Enums, índices y únicos (Incremento 5)

**Input**: documentos de diseño de `specs/006-enums-indices-unicos/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`,
`contracts/`, `quickstart.md`, `.specify/memory/constitution.md`

**Tests**: sí, obligatorias. La puerta 1 de la constitución exige typecheck y
`cargo check` sin avisos, la puerta 3 exige la prueba de ida y vuelta, y
`quickstart.md` lista las catorce pruebas que no pueden faltar.

**Organization**: las fases van por historia de usuario, en el orden de
prioridad del spec (P1 primero), para que cada una se pueda implementar y
demostrar sola.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: se puede ejecutar en paralelo (archivos distintos, sin dependencias
  pendientes)
- **[Story]**: a qué historia pertenece (US1 … US4)
- Cada tarea nombra sus archivos exactos

## Path Conventions

Aplicación de escritorio Tauri: frontend en `src/`, backend en `src-tauri/src/`,
pruebas junto al código que prueban (convención del Incremento 0).

## Mapa de historias

| Historia | Spec | Prioridad | Fase |
| -------- | ---- | --------- | ---- |
| US1 · Crear y editar enums | SF-5.1 | P1 | 3 |
| US2 · Renombrar y eliminar enums en uso | SF-5.2 | P2 | 4 |
| US3 · Índices | SF-5.3 | P3 | 5 |
| US4 · Únicos compuestos | SF-5.4 | P4 | 6 |

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: poner la rama al día y dejar listos los modelos de ejemplo y los
iconos que todo lo demás necesita. No hay dependencias que instalar.

- [ ] T001 Traer a la rama `006-enums-indices-unicos` lo que cerró el Incremento 4 después de su etiqueta: con las PR #10 (rodeo de las líneas) y #11 (carrera del explorador de carpetas) ya mergeadas en `main`, hacer `git merge main` y comprobar que `npx tsc --noEmit`, `npm run lint` y `npx vitest run` siguen en verde (quickstart.md, Prerrequisitos)
- [ ] T002 [P] Crear `src/lib/model/__fixtures__/modelo-enums.yaml` y registrarlo en `src/lib/model/__fixtures__/index.ts`: dos esquemas y cuatro tablas; un enum de cuatro valores usado por dos campos de tablas distintas; un enum sin uso con `comment`; un enum con dos valores iguales, que el archivo admite (research R4); un índice de dos columnas; un índice con `unique: true`; un único de un campo y un único compuesto de dos columnas
- [ ] T003 [P] Crear `e2e/soporte/modelo-enums.yaml` —dos esquemas y cuatro tablas: una con llave primaria, un campo UK y dos claves foráneas sin índice; un enum de cuatro valores usado por dos campos de tablas distintas; un enum sin uso; un índice de dos columnas y un único compuesto ya hechos— y registrarlo en la preparación de la carpeta temporal de `e2e/soporte/entorno.js` junto a los modelos que ya hay
- [ ] T004 [P] Ampliar `src/lib/model/__fixtures__/modelo-50-tablas.yaml` con un enum `estado_general` de cuatro valores y cambiar a ese tipo dos campos de cada una de sus 50 tablas —campos que no sean llave primaria ni columna de una clave foránea, para no tocar las 60 relaciones—, de modo que lo usen 100 campos y se pueda medir SC-011; comprobar que `src/lib/model/roundtrip.test.ts` y `src/lib/canvas/relations.test.ts` siguen pasando con el modelo ampliado
- [ ] T005 [P] Añadir a `src/components/ui/Icon.tsx` los iconos que faltan, tomados de Lucide como los demás: `tags` para el enum, `lock` para los índices automáticos, `arrow-up` y `arrow-down` para reordenar valores y `copy` para «Duplicar enum»; no repetir los que ya estén (`plus`, `x`, `trash-2`, `pencil`, `key-round`, `arrow-up-right`)

**Checkpoint**: la rama incluye el cierre del Incremento 4, y los modelos de
ejemplo y los iconos están listos; nada de esto se ve en pantalla todavía.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: la marca nueva del formato, el dominio puro de enums e índices, el
esqueleto del estado, las preferencias, el selector de varias columnas y las
cuatro fichas del panel. Todas las historias lo necesitan.

**⚠️ CRÍTICO**: ninguna historia puede empezar antes de terminar esta fase.

### El índice gana la marca `unique` (research R8, data-model.md §1, contracts/model.schema.json)

- [ ] T006 Añadir a `src/lib/model/types.ts` el tipo `Index`, que extiende `NamedFields` con `unique?: boolean`, y cambiar `Table.indexes` a `Index[]`; JSDoc en español que diga que `unique` es «por defecto `false`; se omite cuando es `false`» y que el índice no lleva método (FR-029, FR-042, Clarifications)
- [ ] T007 Leer y escribir `unique` en `src/lib/model/parse.ts` y `src/lib/model/serialize.ts`: el orden de las claves del índice es `name`, `fields`, `unique`, y `unique` solo se escribe cuando vale `true`, para que un archivo anterior se reabra y se guarde idéntico (data-model.md §1 «Orden de las claves al escribir»)
- [ ] T008 Aceptar en `src/lib/model/validate.ts` la clave `unique` (booleano) dentro de `indexes[]` y seguir rechazándola en `uniques[]`, separando las claves permitidas de índice y de único; **no** añadir ninguna regla nueva a los enums (research R4); cubrir en `src/lib/model/validate.test.ts`: `unique` aceptado en un índice, rechazado en un único, `unique` que no es booleano rechazado, y un archivo sin `unique` sigue siendo válido
- [ ] T009 Ampliar `src/lib/model/roundtrip.test.ts` con `modelo-enums.yaml`: guardar y volver a cargar conserva los enums con el orden de sus valores y su `comment`, los índices con el orden de sus columnas, `unique` solo donde es `true` y el único compuesto, con `formatVersion` en 1; y los modelos anteriores, sin `unique`, salen idénticos (puerta 3, SC-007)

### Dominio de los enums (research R1 a R4, R19, contracts/enums.md §1)

- [ ] T010 Crear `src/lib/model/enums.ts` con las nueve funciones puras de `contracts/enums.md` §1, cada una con su JSDoc en español: `typeKindOf` (el tipo del motor gana al enum del mismo nombre), `enumUsage`, `enumNameProblem` (vacío, repetido en otro enum, igual a un tipo del catálogo del motor, o de más de 63 caracteres; el enum que se edita no cuenta), `cleanEnumValue` (sin comillas simples, recortado a 63), `enumValueProblems` (compara sin mayúsculas ni espacios de los extremos; un solo mensaje con la prioridad sin valores, repetidos, vacíos), `duplicateEnumName` (`<nombre>_copia`, luego `_copia_2`…, recortado a 63 conservando el sufijo), `renameEnumInFields` (no toca `length`, `scale` ni `default`), `replacementTypeOf` (`varchar` con 40 si el catálogo del motor lo ofrece; si no, `textTypeOf` sin longitud) y `dropEnums` (omite `enums` si queda vacía); exportar como constantes los mensajes de `contracts/enums.md` §5
- [ ] T011 Crear `src/lib/model/enums.test.ts` con un caso por garantía de `contracts/enums.md` §1 y los ocho ejemplos fijados tal cual, incluidos `replacementTypeOf('postgres')` → `{ type: 'varchar', length: 40 }`, `replacementTypeOf('mysql')` → lo mismo y `replacementTypeOf('sqlite')` → `{ type: 'text' }`

### Dominio de los índices y los únicos (research R9, R10, R13, R15, contracts/indexes.md §1)

- [ ] T012 Crear `src/lib/model/indexes.ts` con las diez funciones puras de `contracts/indexes.md` §1, cada una con su JSDoc en español: `automaticIndexes` (`pk_<tabla>` con `kind: 'PRIMARY KEY'` y después cada único con su nombre real y `kind: 'UNIQUE'`), `splitUniques` (uno → `single`; dos o más → `compound`), `constraintNames`, `proposeConstraintName` (`<prefijo><tabla>_<campo>_<campo>…`, recortado a 63, sufijo `_2`, `_3`… conservado dentro de los 63), `isProposedName`, `proposeIndexField` (primera clave foránea con `indexStateOf` en `'missing'`; si no, primer campo fuera de la llave primaria; si no, el primero), `proposeUniqueFields` (dos primeros campos fuera de la llave; se completa con los de la llave; `null` con menos de dos campos), `constraintNameProblem` (vacío, sin forma de nombre técnico, de más de 63, o usado por otro índice o único del modelo), `duplicateOf` (mismas columnas en el mismo orden) y `fieldDependents` (`shrunk`, `removedIndexes` —los que se quedan sin columnas y todos los `unique`— y `removedUniques` —solo compuestos—); exportar como constantes los mensajes de `contracts/indexes.md` §5
- [ ] T013 Crear `src/lib/model/indexes.test.ts` con un caso por garantía de `contracts/indexes.md` §1 y los ocho ejemplos fijados sobre la tabla `pago (id PK, residente_id FK, concepto, mes)`, más el recorte a 63 con sufijo y `fieldDependents` sobre un índice normal de dos columnas, un índice único y un único de un campo (que no se lista)

### Estado (research R5, R7, contracts/enums.md §2, contracts/indexes.md §2)

- [ ] T014 Añadir `'enum'` y `'delete-enum'` al tipo `Dialog` de `src/store/navigation.ts`, y `'indexes'` y `'uniques'` a `PanelTab` de `src/store/fieldsPanel.ts`, con su JSDoc; `setPanelTab` y `openFieldsPanel` aceptan las dos fichas nuevas
- [ ] T015 Crear `src/store/enums.ts` con `EnumsSlice`: el estado `enumTarget` (`string | null`), `openEnumDialog(name | null)` y `openDeleteEnumDialog(name)`, y las cuatro etiquetas de historial exportadas («crear el enum», «editar el enum», «duplicar el enum», «eliminar el enum»); registrarla en `src/store/index.ts` y `src/store/types.ts`; `createModel`, `openModel` y `closeModel` de `src/store/model.ts` reponen `enumTarget` a `null`, como ya hacen con la tabla seleccionada
- [ ] T016 Crear `src/store/indexes.ts` con `IndexesSlice` vacía de acciones todavía —solo las seis etiquetas de historial exportadas («crear el índice», «editar el índice», «eliminar el índice», «crear el único», «editar el único», «eliminar el único») y la función interna que reemplaza una tabla del modelo y llama a `pushHistory`— y registrarla en `src/store/index.ts` y `src/store/types.ts`

### Preferencias (research R17, contracts/preferences.md)

- [ ] T017 Añadir a `src-tauri/src/preferences.rs` los campos `index_prefix` (por defecto `idx_`) y `unique_prefix` (por defecto `uq_`) en `Preferences` y `PreferencesPatch`, con `#[serde(default = …)]` y `///` en español, y la función `clamp_name_prefix(text, default)`: recorta espacios, pasa a minúsculas, descarta lo que no sea letra sin acento, número o guion bajo, limita a 16 caracteres y vuelve al valor por defecto si no queda nada o empieza por número; pruebas del módulo para los seis casos de `contracts/preferences.md` (campo ausente, valor de otro tipo, mayúsculas y espacios, solo símbolos, empieza por número, más de 16 caracteres)
- [ ] T018 Añadir `indexPrefix` y `uniquePrefix` a `Preferences` y al parche en `src/lib/tauri/types.ts`, y a los valores por defecto y a la acción de actualizar de `src/store/preferences.ts`; cubrir en `src/store/preferences.test.ts` que el almacén se queda con el valor saneado que devuelve el comando

### Primitivo de interfaz (research R12, puerta 7)

- [ ] T019 [P] Crear `src/components/ui/MultiSelect.tsx`, puro y sin almacén, sobre `@radix-ui/react-dropdown-menu` con `CheckboxItem`: props `label`, `options`, `value: string[]`, `onValueChange`, `placeholder`, `tabIndex` y `disabled`; el menú no se cierra al marcar, el valor conserva el orden de elección, el disparador muestra las elegidas en ese orden y su nombre accesible es «<label>: a, b»; clases `au-*` y tokens, ningún valor literal
- [ ] T020 [P] Crear `src/components/ui/MultiSelect.test.tsx`: el orden de elección se conserva, desmarcar quita solo esa opción, el nombre accesible lista las elegidas, y el menú se abre, se recorre y se marca con el teclado (FR-025, FR-044)

### El panel inferior pasa a cuatro fichas (contracts/indexes.md §3)

- [ ] T021 Ampliar `src/components/layout/BottomPanel.tsx` a cuatro fichas en el orden del tablero —Campos · Índices · Claves foráneas · Únicos—, con el contador de «Índices» (índices propios de la tabla) y el de «Únicos» (los de un campo más los compuestos, con `splitUniques`), y hacer que `src/components/features/editor/EditorScreen.tsx` elija el contenido por `panelTab`, con las dos fichas nuevas vacías por ahora; actualizar `src/components/layout/BottomPanel.test.tsx` con las cuatro fichas y sus contadores (FR-030, FR-038)

**Checkpoint**: el formato acepta `unique`, el dominio de enums e índices está
probado, el estado y las preferencias tienen sitio para lo nuevo, y el panel
muestra las cuatro fichas. Las historias pueden empezar.

---

## Phase 3: User Story 1 - Crear y editar enums (Priority: P1) 🎯 MVP

**Goal**: definir una lista de valores con nombre y esquema, verla en la barra
lateral y usarla como tipo de un campo.

**Independent Test**: sobre `e2e/soporte/modelo-enums.yaml`, crear un enum de
cuatro valores solo con el teclado, reordenarlo, provocar los tres errores
(nombre repetido, valor vacío, valor repetido), y elegirlo como tipo de dos
campos de tablas distintas sin que aparezca el aviso de tipo desconocido.

### Tests de la historia 1

- [ ] T022 [P] [US1] Crear `src/store/enums.test.ts` con los casos de crear y editar: `createEnum` añade al final de `enums[]`, marca «Editado» y es un solo paso que deshacer quita; un borrador inválido devuelve `false` y no cambia nada; `updateEnum` cambia valores y esquema sin tocar los campos que usan el enum; el orden de los valores se conserva (FR-008, FR-014, FR-041)
- [ ] T023 [P] [US1] Crear `src/components/features/enum/EnumDialog.test.tsx`: el foco empieza en «Nombre»; Enter en «Nuevo valor» añade la fila y deja el foco en el campo; «Subir», «Bajar» y «Quitar» mueven y quitan; los mensajes «Ese nombre ya lo usa otro tipo.», «Hay valores repetidos.», «Hay valores vacíos.» y «Añade al menos un valor.» deshabilitan el botón de confirmar; «Se guardará como estado_pago» con un nombre con mayúsculas y espacios; el modelo sin esquemas muestra «Primero crea un esquema: un enum vive dentro de uno.» con el botón «Nuevo esquema»; en «Editar enum», «Usado por» lista los campos como `tabla.campo`, pulsar uno cierra la hoja y abre el panel de campos de esa tabla en ese campo, y un enum sin uso dice «Ningún campo lo usa todavía.»; cancelar y Escape no cambian el modelo (FR-001 a FR-009, FR-013, SC-009)

### Implementación de la historia 1

- [ ] T024 [US1] Añadir a `src/store/enums.ts` las acciones `createEnum(draft)` y `updateEnum(name, draft)`, con `draft` como `{ name, schema, values }` ya técnico y recortado: validan con `enumNameProblem` y `enumValueProblems`, escriben con **un solo** `pushHistory` y cierran el diálogo; `updateEnum` aplica `renameEnumInFields` en la misma escritura cuando el nombre cambia y conserva el `comment` del enum (research R2, FR-003, FR-015)
- [ ] T025 [US1] Crear `src/components/features/enum/EnumDialog.tsx` sobre `Sheet`, con borrador local (research R5): título «Nuevo enum» / «Editar enum», campo «Nombre» con `toTechnicalName` y la pista «Se guardará como <nombre>», selector «Esquema» con el esquema enfocado o el primero como propuesta, lista de valores numerada con «Valor N», «Subir», «Bajar» y «Quitar <valor>», campo «Nuevo valor» con Enter y «Añadir», contador «4 valores», y botón «Crear enum» / «Guardar» deshabilitado mientras haya errores; los valores pasan por `cleanEnumValue` al escribir (FR-002 a FR-009, contracts/enums.md §3 a §5)
- [ ] T026 [US1] Añadir a `src/components/features/enum/EnumDialog.tsx` el estado sin esquemas —el mensaje y el botón «Nuevo esquema», que abre el diálogo de esquema como hace `TableDialog`— y, en «Editar enum», el bloque «Usado por» con `enumUsage`: una ficha «Abrir <tabla>.<campo> en el editor» por campo, que cierra la hoja y llama a `openFieldsPanel` con esa tabla y ese campo en la ficha «Campos», o «Ningún campo lo usa todavía.» (FR-004, FR-013)
- [ ] T027 [P] [US1] Añadir a `src/components/layout/ModelSidebar.tsx` la sección «Enums» debajo de «Tablas»: cabecera con el botón «Nuevo enum», una fila por enum con el icono `tags` en `purple`, su nombre y su número de valores, nombre accesible «<nombre>, 4 valores», filtro por esquema enfocado con el título «Enums de <esquema>», y clic o Enter que abre «Editar enum»; ampliar `src/components/layout/ModelSidebar.test.tsx` con la sección, el contador y el filtro (FR-010, research R18)
- [ ] T028 [P] [US1] Ofrecer los enums en el selector de tipo de `src/components/features/table/FieldsGrid.tsx`: después de los tipos del motor, todos los enums del modelo con la segunda línea «enum»; un campo de tipo enum no muestra ni guarda longitud ni escala, y deja de llevar el aviso de tipo desconocido porque la rejilla pregunta a `typeKindOf` y no solo a `typeTraits`; elegir un enum borra `length` y `scale` del campo; ampliar `src/components/features/table/FieldsGrid.test.tsx` (FR-011, research R1)
- [ ] T029 [P] [US1] Repasar `src/components/features/canvas/TableCard.tsx` y `src/components/layout/Inspector.tsx` para que un campo de tipo enum muestre el nombre del enum como tipo y no se marque como tipo desconocido donde hoy se consulte `typeTraits`; cubrirlo en `src/components/features/canvas/TableCard.test.tsx` (FR-011)
- [ ] T030 [P] [US1] Activar «Definir un enum» en `src/components/features/canvas/EmptyModelCard.tsx`: deja de anunciarse como futura y llama a `openEnumDialog(null)`; actualizar su JSDoc y crear `src/components/features/canvas/EmptyModelCard.test.tsx`, que todavía no existe, con ese caso (FR-001)
- [ ] T031 [US1] Montar `EnumDialog` en `src/components/features/editor/EditorScreen.tsx` junto a los demás diálogos, y añadir a `src/styles/screens.css` las clases de la fila de valor, de la fila marcada como repetida o vacía y de la ficha de «Usado por», solo con tokens (FR-045)

**Checkpoint**: se crean y se editan enums, aparecen en la barra lateral y se
eligen como tipo de campo. El incremento ya se puede enseñar.

---

## Phase 4: User Story 2 - Renombrar y eliminar enums en uso (Priority: P2)

**Goal**: cambiar el nombre de un enum sin romper sus campos, eliminarlo
sabiendo qué campos cambian y a qué tipo, y tener Editar, Duplicar y Eliminar en
su menú.

**Independent Test**: sobre el enum de `modelo-enums.yaml` que usan dos campos
de tablas distintas: renombrarlo y ver el nombre nuevo en los dos, deshacer,
duplicarlo, y eliminarlo comprobando que la confirmación nombra los dos campos
y que quedan como `varchar(40)`.

### Tests de la historia 2

- [ ] T032 [P] [US2] Ampliar `src/store/enums.test.ts`: renombrar cambia el tipo de todos los campos que lo usaban y un solo deshacer devuelve el enum y los campos a la vez; `duplicateEnum` deja la copia justo después del original, en su esquema, con `_copia` y sin uso; `deleteEnum` quita el enum, pasa sus campos a `varchar` con longitud 40 —`text` sin longitud con el motor SQLite—, cierra la hoja y la confirmación, y un solo deshacer lo devuelve todo (FR-015 a FR-018, FR-020, SC-003, SC-004, SC-006)
- [ ] T033 [P] [US2] Ampliar `src/store/schemas.test.ts`: eliminar un esquema con su contenido, cuando uno de sus enums lo usa un campo de una tabla de otro esquema, deja ese campo con el tipo de reemplazo, en el mismo paso deshacible (FR-019)
- [ ] T034 [P] [US2] Crear `src/components/features/enum/DeleteEnumDialog.test.tsx`: con dos campos dice «2 campos lo usan (pago.estado, cuota.estado) y pasarán a varchar(40).»; con uno, en singular; sin uso, «Ningún campo lo usa.»; con SQLite dice «text»; «Cancelar» no cambia nada (FR-016, FR-017)

### Implementación de la historia 2

- [ ] T035 [US2] Añadir a `src/store/enums.ts` las acciones `duplicateEnum(name)` —con `duplicateEnumName`, la copia justo después del original— y `deleteEnum(name)` —con `dropEnums`, cerrando la hoja y la confirmación—, cada una con su etiqueta y un solo `pushHistory` (FR-018, FR-020)
- [ ] T036 [P] [US2] Crear `src/components/features/enum/DeleteEnumDialog.tsx` sobre `Sheet`, con el título «¿Eliminar el enum «<nombre>»?», la descripción formada con `enumUsage` y `replacementTypeOf` del motor del modelo, y los botones «Cancelar» y «Eliminar enum»; montarlo en `src/components/features/editor/EditorScreen.tsx` (FR-016 a FR-018, contracts/enums.md §5)
- [ ] T037 [P] [US2] Crear `src/components/features/enum/EnumContextMenu.tsx` sobre `ContextMenu`, con la cabecera «Enum · 4 valores · 2 campos» y las entradas «Editar enum…», «Duplicar enum» y «Eliminar enum…»; y su prueba `src/components/features/enum/EnumContextMenu.test.tsx` con el puntero y con ⇧F10 (FR-020)
- [ ] T038 [US2] Envolver cada fila de la sección «Enums» de `src/components/layout/ModelSidebar.tsx` en `EnumContextMenu`, y ampliar `src/components/layout/ModelSidebar.test.tsx` con el menú (FR-020)
- [ ] T039 [US2] Añadir a `src/components/features/enum/EnumDialog.tsx`, solo en «Editar enum», el botón «Eliminar enum» que abre la misma confirmación, y cubrirlo en `src/components/features/enum/EnumDialog.test.tsx` (FR-020)
- [ ] T040 [US2] Hacer que `deleteSchema` de `src/store/schemas.ts` pase los enums que se van por `dropEnums` cuando se lleva el contenido del esquema, y que `src/components/features/schema/DeleteSchemaDialog.tsx` cuente con `enumUsage` los campos de otras tablas que cambian y diga a qué tipo pasan; actualizar el JSDoc de las dos piezas y `src/components/features/schema/DeleteSchemaDialog.test.tsx` (FR-019, research R16)

**Checkpoint**: un enum en uso se renombra, se duplica y se elimina sin dejar
ningún campo con un tipo que no existe.

---

## Phase 5: User Story 3 - Índices (Priority: P3)

**Goal**: ver los índices que ya crean las restricciones y crear los propios,
con nombre propuesto, una o varias columnas en orden y la marca de único.

**Independent Test**: sobre la tabla de `modelo-enums.yaml` con llave primaria,
un campo UK y dos claves foráneas sin índice: ver los dos índices automáticos,
«Añadir índice» y comprobar que propone la primera clave foránea y que su fila
de «Claves foráneas» pasa a «Indexada», añadir una segunda columna, marcar
«Único» y eliminarlo.

### Tests de la historia 3

- [ ] T041 [P] [US3] Crear `src/store/indexes.test.ts` con los casos de índices: `addIndex` crea uno completo con la columna y el nombre propuestos y devuelve su nombre; `setIndexFields` conserva el orden recibido, repropone el nombre si era el propuesto, lo conserva si se había escrito a mano y no cambia nada con la lista vacía; `setIndexName` con un nombre inválido o repetido no cambia nada y devuelve el mensaje; `setIndexUnique(false)` borra la clave `unique`; `deleteIndex` borra `indexes` cuando queda vacía; cada acción es un solo paso (FR-023 a FR-029, SC-006)
- [ ] T042 [P] [US3] Ampliar `src/lib/model/marks.test.ts`: `cardinalityOf` da «uno a uno» con un índice `unique: true` de una sola columna sobre la columna de la clave foránea, no cambia con uno de dos columnas ni con uno sin la marca, y `relationCardinality` formatea ese mismo dato (FR-029a, SC-013)
- [ ] T043 [P] [US3] Crear `src/components/features/table/IndexesTab.test.tsx`: el bloque «Creados por restricciones» lista `pk_<tabla>` y cada único sin mandos; una tabla sin llave ni únicos lo dice; una tabla sin índices propios muestra «Sin índices adicionales…»; los mensajes de nombre vacío, inválido y repetido se ven en la fila y no cambian el modelo; «Un índice necesita al menos una columna.» al quitar la última; el aviso «Repite las columnas de <nombre>.»; y la rejilla se recorre con el tabulador y las flechas (FR-021, FR-027, FR-028, FR-030, FR-044, SC-009)

### Implementación de la historia 3

- [ ] T044 [US3] Añadir a `src/store/indexes.ts` las cinco acciones de índice de `contracts/indexes.md` §2 —`addIndex`, `setIndexName` (fusionado mientras se escribe, con clave de gesto por índice), `setIndexFields`, `setIndexUnique` y `deleteIndex`—, leyendo `indexPrefix` de las preferencias al proponer y usando `proposeIndexField`, `proposeConstraintName`, `isProposedName` y `constraintNameProblem`; ninguna puede dejar un índice sin columnas (research R10, R11)
- [ ] T045 [US3] Hacer que `cardinalityOf` de `src/lib/model/marks.ts` cuente como única la columna que es la única de un índice con `unique: true`, y actualizar su JSDoc; los índices únicos de varias columnas no cuentan (research R14, FR-029a)
- [ ] T046 [US3] Crear `src/components/features/table/IndexesTab.tsx`: el bloque «Creados por restricciones» con `automaticIndexes` —candado, nombre, columnas entre paréntesis y clase, sin mandos, o el mensaje de que la tabla no tiene ninguno—; el bloque «Índices» con la rejilla de cuatro columnas (Nombre, Columnas con `MultiSelect`, casilla «Índice único» y «Eliminar índice») recorrida con `useGridNavigation`; la celda de nombre guarda un borrador local con su error y solo escribe valores válidos; el aviso de `duplicateOf`; el estado vacío; y el botón «Añadir índice», que deja el foco en la fila nueva (FR-021 a FR-030, contracts/indexes.md §3 a §5)
- [ ] T047 [US3] Montar `IndexesTab` en `src/components/features/editor/EditorScreen.tsx` para `panelTab === 'indexes'` y añadir a `src/styles/screens.css` las clases de la línea de solo lectura y de la rejilla de índices, solo con tokens (FR-045)
- [ ] T048 [P] [US3] Añadir a `src/components/features/preferences/PreferencesWindow.tsx` el grupo «Nombres» con los campos de texto «Prefijo de índices» y «Prefijo de únicos», cada uno con su ejemplo debajo («Ejemplo: idx_pago_residente_id»), que escriben al perder el foco o con Enter y muestran después el valor saneado; ampliar `src/components/features/preferences/PreferencesWindow.test.tsx` (FR-043, contracts/preferences.md «Interfaz»)
- [ ] T049 [US3] Ampliar `src/components/features/table/ForeignKeysTab.test.tsx`: crear con `addIndex` un índice sobre la columna de una clave foránea pasa su fila de «Sin índice» a «Indexada», y eliminarlo la devuelve (FR-031, SC-005, SC-012)

**Checkpoint**: los índices se ven, se crean y se editan; las claves foráneas
dicen la verdad sobre su índice y la cardinalidad sigue al índice único.

---

## Phase 6: User Story 4 - Únicos compuestos (Priority: P4)

**Goal**: impedir combinaciones repetidas de varias columnas, viendo en la misma
ficha los únicos de un campo que vienen de la marca UK.

**Independent Test**: sobre una tabla de cuatro campos con uno marcado UK: verlo
arriba como único de un campo, «Añadir único», añadirle una tercera columna,
intentar dejarlo en una y, desde «Campos», eliminar uno de sus campos
comprobando que la confirmación nombra el único y que desaparece entero.

### Tests de la historia 4

- [ ] T050 [P] [US4] Ampliar `src/store/indexes.test.ts` con los casos de únicos: `addUnique` crea uno con dos columnas y el nombre propuesto con `uniquePrefix`, y no hace nada con menos de dos campos; `setUniqueFields` no cambia nada con menos de dos columnas y repropone el nombre si era el propuesto; `setUniqueName` y `deleteUnique` como sus pares de índice; ninguna acción puede dejar un único compuesto con una columna (FR-033 a FR-036, SC-006)
- [ ] T051 [P] [US4] Ampliar `src/store/tables.test.ts`: al eliminar un campo, un índice normal de dos columnas se queda con la otra, un índice normal de una columna desaparece, un índice marcado `unique` desaparece entero, un único compuesto desaparece entero y el único de un campo se va con la marca UK; un solo deshacer lo devuelve todo (FR-039, research R15)
- [ ] T052 [P] [US4] Crear `src/components/features/table/UniquesTab.test.tsx`: el bloque «Desde la columna Llave (UK)» lista los únicos de un campo sin mandos y refleja marcar y quitar UK en «Campos»; el estado vacío con su ejemplo; «Añadir único» deshabilitado con su motivo en una tabla de un campo; el mensaje «Un único compuesto necesita al menos dos columnas. El de un solo campo se marca con UK en «Campos».» al intentar dejarlo en una; los errores de nombre; el aviso «Repite las columnas de <nombre>.» cuando coincide con la llave primaria o con otro único, sin impedir guardarlo; y el recorrido de la rejilla con el teclado (FR-032, FR-033, FR-035, FR-037, FR-038, FR-044, SC-009)

### Implementación de la historia 4

- [ ] T053 [US4] Añadir a `src/store/indexes.ts` las cuatro acciones de único de `contracts/indexes.md` §2 —`addUnique`, `setUniqueName` (fusionado mientras se escribe), `setUniqueFields` y `deleteUnique`—, que solo tocan los únicos de dos o más columnas y leen `uniquePrefix` de las preferencias al proponer (research R11, R13)
- [ ] T053a [US4] Hacer que `setFieldKey` de `src/store/tables.ts` nombre el único de la marca UK con `proposeConstraintName(uniquePrefix, tabla, [campo], constraintNames(model))` en lugar de `uq_` fijo, de modo que siga el prefijo de Ajustes y no repita ningún nombre del modelo; los únicos de un campo que ya existan conservan su nombre; cubrir en `src/store/tables.test.ts` el prefijo inicial (`uq_<tabla>_<campo>`, igual que antes), un prefijo cambiado y un choque que acaba en `_2` (FR-038a, research R13)
- [ ] T054 [US4] Crear `src/components/features/table/UniquesTab.tsx`: el bloque «Desde la columna Llave (UK)» con `splitUniques(table).single` —icono `key-round`, nombre y columna, sin mandos—; el bloque «Únicos compuestos» con la rejilla de tres columnas (Nombre, Columnas con `MultiSelect` y «Eliminar restricción») recorrida con `useGridNavigation`, con el mismo borrador de nombre que la ficha de índices; el aviso de `duplicateOf`; el estado vacío; y el botón «Añadir único», deshabilitado con su motivo en el título cuando la tabla tiene menos de dos campos (FR-032 a FR-038, contracts/indexes.md §3 a §5)
- [ ] T055 [US4] Montar `UniquesTab` en `src/components/features/editor/EditorScreen.tsx` para `panelTab === 'uniques'` y añadir a `src/styles/screens.css` la rejilla de únicos (FR-045)
- [ ] T056 [US4] Cambiar `removeFieldFromKeys` de `src/store/tables.ts` para que aplique `fieldDependents` —el índice no único pierde la columna o desaparece si era la única; el índice único y el único compuesto desaparecen enteros—, sin dejar de quitar el único de un campo del campo eliminado, que no es un dependiente sino su propia marca UK, y actualizar su JSDoc, que hoy describe el comportamiento anterior (FR-039, research R15)
- [ ] T057 [US4] Hacer que `src/components/features/table/DeleteFieldDialog.tsx` nombre con `fieldDependents` cada índice y cada único afectado —«El índice <nombre> perderá esta columna.», «El índice <nombre> se eliminará con él.», «El único <nombre> se eliminará con él.»— además de las relaciones que ya nombra; ampliar `src/components/features/table/DeleteFieldDialog.test.tsx` (FR-039, RS-08)
- [ ] T058 [US4] Ampliar `src/store/tables.test.ts` con renombrar un campo, renombrar una tabla, eliminar una tabla y duplicarla cuando tiene un índice con `unique` y un único compuesto: los nombres de campo y de tabla se propagan a `fields` de cada índice y único, eliminar la tabla se los lleva, y la copia conserva `unique` y las columnas en su orden con nombres que no repiten ninguno del modelo; si `duplicateTable` o `renameTable` de `src/store/tables.ts` pierden `unique` o producen un nombre repetido, corregirlos ahí para que copien el índice entero y pasen el nombre por `proposeConstraintName` (FR-040)

**Checkpoint**: las cuatro historias funcionan; quedan el recorrido, las
revisiones a mano, las medidas y el cierre.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: el recorrido sobre la aplicación real, las revisiones a mano, las
medidas y el cierre del incremento.

- [ ] T059 Añadir a `e2e/soporte/pantalla.js` los apoyos que el escenario necesita y que todavía no existan: elegir varias opciones de un `MultiSelect` por su etiqueta, leer las filas de una ficha del panel y abrir el menú contextual de una fila de la barra lateral con ⇧F10; recordar que `esperarTexto` no ve un `aria-label` y que su volcado se corta a 800 caracteres
- [ ] T060 Crear `e2e/specs/12-enums-indices-unicos.e2e.js` con los quince pasos de `quickstart.md` sobre `e2e/soporte/modelo-enums.yaml` y, para el paso 15, sobre `modelo-50-tablas.yaml`: crear, validar, usar como tipo, renombrar y deshacer, duplicar, eliminar y deshacer, índices automáticos, «Añadir índice» con «Indexada», segunda columna y «Único», «Añadir único» con el intento de dejarlo en una columna, eliminar un campo del único, la cardinalidad «uno a uno» con el índice único, el prefijo `ix_` de Ajustes, y guardar y reabrir; en el paso del renombrado, comprobar a la vez la barra lateral, la tarjeta del lienzo y el panel de campos, que tienen que decir el mismo nombre (SC-001, SC-007, FR-046)
- [ ] T061 Medir SC-011 en `e2e/specs/12-enums-indices-unicos.e2e.js`: renombrar `estado_general` en `modelo-50-tablas.yaml` y comprobar que el nombre nuevo se ve en una tarjeta en menos de 200 ms desde que se confirma la hoja; anotar la cifra en «Medidas del cierre»
- [ ] T062 Renombrar el job de `.github/workflows/recorrido.yml` para que nombre los trece archivos de `e2e/specs/` y comprobar que el workflow ejecuta el nuevo
- [ ] T063 Ejecutar el recorrido completo en local con `caffeinate -d npm run e2e` —la pantalla apagada congela la aplicación en la pantalla de carga— y dejarlo en verde con los trece archivos
- [ ] T064 [P] Revisar SC-010 en tema claro y en tema oscuro: la hoja del enum con un error de cada clase, la sección «Enums», el menú contextual, la confirmación de eliminar, las dos fichas con y sin filas y el grupo «Nombres» de Ajustes; medir el contraste de cada texto de contenido contra su fondo y corregir en `src/styles/screens.css` lo que no llegue a 4,5:1
- [ ] T065 [P] Provocar uno a uno los nueve estados de SC-009 —modelo sin esquemas, nombre de enum repetido, enum sin valores, valor vacío, valor repetido, tabla sin índices propios, tabla sin únicos compuestos, único compuesto que se quedaría con una columna, y nombre de índice o único repetido— y comprobar que cada uno muestra el mensaje de `contracts/enums.md` §5 o `contracts/indexes.md` §5 y una salida
- [ ] T066 [P] Comprobar SC-008 con el teclado solo: crear un enum de cuatro valores en menos de 30 segundos (SC-002), abrir el menú contextual de un enum, y añadir, cambiar y eliminar un índice y un único, con foco visible en cada paso
- [ ] T067 [P] Repetir crear un enum y eliminarlo en uso con los tres motores: la confirmación dice `varchar(40)` en PostgreSQL y MySQL y `text` en SQLite, y en los tres el enum se ofrece como tipo sin aviso de tipo desconocido (FR-012, FR-018)
- [ ] T068 [P] Abrir `e2e/soporte/modelo-relaciones.yaml`, guardar sin cambios y comprobar con `git diff --no-index` que el archivo no cambia: ningún `unique` aparece y ninguna clave se reordena (SC-007)
- [ ] T069 [P] Repasar la puerta 8 en todo lo nuevo y lo cambiado: JSDoc en español en `src/lib/model/enums.ts`, `src/lib/model/indexes.ts`, el tipo `Index`, `src/store/enums.ts`, `src/store/indexes.ts`, los componentes de `src/components/features/enum/`, `IndexesTab`, `UniquesTab` y `MultiSelect`; y los bloques que cambian de comportamiento: `cardinalityOf`, `removeFieldFromKeys`, `deleteSchema`, `BottomPanel`, `ModelSidebar`, `FieldsGrid` y `EmptyModelCard`; `///` en los dos campos de `src-tauri/src/preferences.rs`
- [ ] T070 [P] Repasar la puerta 6: ningún archivo del tablero copiado al repositorio, y los ocho desvíos deliberados de `specs/006-enums-indices-unicos/research.md` R22 siguen siendo los únicos
- [ ] T071 Pasar las cinco puertas en limpio desde la raíz y desde `src-tauri/`: `npx tsc --noEmit`, `npm run lint`, `npx vitest run`, `cargo check` y `cargo test`
- [ ] T072 Subir la versión del producto a `1.5.0` en `package.json`, `src-tauri/tauri.conf.json` y `src-tauri/Cargo.toml`, y actualizar `README.md` con lo que el Editor hace ahora y con el incremento que sigue
- [ ] T073 Abrir el PR hacia `main`, esperar `.github/workflows/puertas.yml` y `.github/workflows/recorrido.yml` en verde en las dos plataformas, y dejar la etiqueta anotada `v1.5.0` sobre el commit de merge (constitución, Versión del producto y etiquetas)

---

## Dependencies & Execution Order

### Dependencias entre fases

- **Fase 1 (Setup)**: sin dependencias. T001 va primero; T002 a T005 pueden ir a
  la vez después.
- **Fase 2 (Foundational)**: después de la Fase 1. Bloquea todas las historias.
- **Fases 3 a 6 (historias)**: después de la Fase 2.
- **Fase 7 (Polish)**: después de las cuatro historias.

### Dependencias entre historias

| Historia | Necesita | Por qué |
| -------- | -------- | ------- |
| US1 | Fase 2 | Es la primera que añade un objeto al modelo |
| US2 | US1 | Renombra, duplica y elimina los enums que US1 crea, y añade botones a su hoja y a su sección |
| US3 | Fase 2 | No toca los enums |
| US4 | Fase 2, y T044 de US3 | Comparte archivo de almacén con US3 |

US1 y US3 se pueden empezar a la vez. US2 solo después de US1.

### Las dependencias no obvias

**T001 depende de algo que no es código.** La rama salió de `main` antes de que
las PR #10 y #11 se mergearan. Si no están mergeadas cuando se empiece, T001
espera; implementar sin ellas deja el recorrido con el intermitente del
escenario 2 y obliga a resolver conflictos en `src/lib/canvas/relations.ts` al
final.

**US3 y US4 escriben el mismo archivo de almacén.** `src/store/indexes.ts`
recibe las acciones de índice en T044 y las de único en T053, y
`src/store/indexes.test.ts` nace en T041 y se amplía en T050. Por eso T050 y
T053 no llevan paralelismo con T041 y T044 aunque sean de historias distintas.

**US1 y US2 escriben los mismos tres archivos.** `src/store/enums.ts` (T024,
T035), `src/components/features/enum/EnumDialog.tsx` (T025, T026, T039) y
`src/components/layout/ModelSidebar.tsx` (T027, T038). Dentro de cada archivo el
orden es el de los números.

**El renombrado que propaga está en US1, no en US2.** `updateEnum` (T024) aplica
`renameEnumInFields` desde el primer día, porque una edición que cambiara el
nombre sin retipar dejaría campos rotos aunque US2 no estuviera hecha. US2
aporta sus pruebas (T032) y el resto del ciclo de vida.

**FR-039 vive en US4 pero cubre también a los índices.** `fieldDependents` se
escribe en la Fase 2 (T012) y se aplica en T056 y T057. Hasta entonces, eliminar
un campo sigue con el comportamiento del Incremento 3. Si US3 se entrega sin
US4, un índice único puede quedar reducido al eliminar un campo.

**T021 necesita T012 y T014.** El contador de «Únicos» usa `splitUniques`
(T012) y las fichas nuevas son valores de `PanelTab` (T014), así que T021 va
después de las dos aunque toque otros archivos.

**T015 y T016 no son paralelas.** Cada una crea su parte del almacén, pero las
dos se registran en `src/store/index.ts` y `src/store/types.ts`.

**T053a cambia una acción del Incremento 3.** `setFieldKey` pasa a nombrar el
único de la marca UK con el prefijo de Ajustes. Con el prefijo inicial el nombre
no cambia, así que las pruebas y los modelos de ejemplo existentes siguen
valiendo; va en US4 porque depende de `uniquePrefix` (T018) y de
`proposeConstraintName` (T012).

**T028 y T029 dependen de T010**, no de T024: el selector de tipo solo necesita
`typeKindOf` y los enums que traiga el archivo, así que se pueden hacer mientras
la hoja está a medias.

### Oportunidades de paralelismo

- **Fase 1**: T002, T003, T004 y T005, después de T001.
- **Fase 2**: los dos módulos de dominio (T010–T011 y T012–T013) entre sí y con
  el formato (T006–T009); Rust (T017) con todo lo de TypeScript; `MultiSelect`
  (T019, T020) con todo. T014, T015, T016 y T021 van en ese orden.
- **US1**: las dos pruebas (T022, T023) entre sí; T027, T028, T029 y T030 entre
  sí, porque tocan cuatro archivos distintos.
- **US2**: las tres pruebas (T032–T034); T036 y T037 entre sí.
- **US3**: las tres pruebas (T041–T043); T048 con todo lo demás de la historia.
- **US4**: las tres pruebas (T050–T052).
- **Fase 7**: las revisiones a mano (T064 a T070) entre sí.

---

## Parallel Example: Fase 2

```text
Rama A (formato):   T006 → T007 → T008 → T009
Rama B (enums):     T010 → T011
Rama C (índices):   T012 → T013
Rama D (Rust):      T017 → T018
Rama E (interfaz):  T019 + T020
Después de A a C:   T014 → T015 → T016 → T021
```

## Parallel Example: dos ramas de trabajo

```text
Persona 1:  US1 (T022–T031) → US2 (T032–T040)
Persona 2:  US3 (T041–T049) → US4 (T050–T058)
Las dos:    Fase 7
```

---

## Implementation Strategy

### MVP primero (US1 sola)

1. Fase 1 y Fase 2.
2. Fase 3: crear y editar enums y usarlos como tipo.
3. **Parar y validar**: los pasos 1 a 3 de `quickstart.md`.

Con eso ya hay algo que enseñar: el modelo gana listas de valores.

### Entrega incremental

1. US1 → enums creados y usados.
2. US2 → enums que se pueden cambiar sin miedo. Aquí la mitad de la
   demostración está hecha.
3. US3 → índices, y el aviso «Sin índice» del Incremento 4 por fin tiene salida.
4. US4 → únicos compuestos, y eliminar un campo deja de crear reglas más
   estrictas.
5. Fase 7 → recorrido, medidas y cierre.

### Con dos personas

Una lleva los enums (US1 y US2) y otra los índices y los únicos (US3 y US4). No
comparten ningún archivo salvo `EditorScreen.tsx` y `screens.css`, donde cada
una añade sus líneas.

---

## Notes

- Las tareas **[P]** tocan archivos distintos y no dependen de nada pendiente.
- Cada tarea de almacén es un solo `pushHistory`: si una acción necesita dos,
  está mal partida.
- Ninguna acción de índices ni de únicos deja el modelo inválido; una prueba que
  consiga un índice sin columnas o un único compuesto con una es un fallo
  (research R11).
- El validador del archivo no gana reglas para los enums (research R4): no
  «arreglar» T008 añadiéndolas.
- La paleta de comandos no existe y el spec la deja fuera (Assumptions, «Sin
  paleta de comandos»). No crear una entrada de paleta suelta.
- Sin commits ni PR hasta que el usuario lo pida, salvo T073.
- Engram: un `mem_save` por hallazgo real durante la implementación.
