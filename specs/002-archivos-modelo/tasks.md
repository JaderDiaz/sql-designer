---
description: "Tareas del Incremento 1 · Archivos de modelo"
---

# Tasks: Archivos de modelo (Incremento 1)

**Input**: documentos de diseño de `specs/002-archivos-modelo/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/`,
`quickstart.md`, `.specify/memory/constitution.md`

**Tests**: sí, obligatorias. La puerta 1 de la constitución exige typecheck y
`cargo check` sin avisos, la puerta 3 exige la prueba de ida y vuelta, y
`quickstart.md` lista las pruebas que no pueden faltar.

**Organization**: las fases van por historia de usuario, en orden de prioridad del
spec (P1 primero), para que cada una se pueda implementar y demostrar sola.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: se puede ejecutar en paralelo (archivos distintos, sin dependencias
  pendientes)
- **[Story]**: a qué historia pertenece (US1 … US7)
- Cada tarea nombra sus archivos exactos

## Path Conventions

Aplicación de escritorio Tauri: frontend en `src/`, backend en `src-tauri/src/`,
pruebas junto al código que prueban (convención del Incremento 0).

## Mapa de historias

| Historia | Spec | Prioridad | Fase |
| -------- | ---- | --------- | ---- |
| US1 · Crear un modelo nuevo | SF-1.1 | P1 | 3 |
| US3 · Abrir un modelo | SF-1.3 | P1 | 4 |
| US4 · Guardar y estado de cambios | SF-1.4 | P1 | 5 |
| US2 · Elegir la carpeta | SF-1.2 | P2 | 6 |
| US5 · Cerrar el modelo | SF-1.5 | P2 | 7 |
| US6 · Recientes | SF-1.6 | P2 | 8 |
| US7 · Acciones sobre un reciente | SF-1.7 | P3 | 9 |

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: dependencias nuevas, resueltas antes de tocar código

- [X] T001 Instalar las dependencias nuevas del frontend con `npm install yaml @radix-ui/react-select @radix-ui/react-context-menu` y comprobar que `package.json` queda con `yaml` ^2.9, `@radix-ui/react-select` ^2.4 y `@radix-ui/react-context-menu` ^2.4
- [X] T002 Añadir la dependencia de Rust con `cd src-tauri && cargo add trash@5 && cargo fetch`, y si crates.io no responde PARAR y avisar: el incremento se bloquea aquí, no a mitad (research.md R7)
- [X] T003 [P] Crear los modelos de ejemplo en `src/lib/model/__fixtures__/`: `modelo-postgres.yaml` (6 tablas y 6 relaciones), `modelo-mysql.yaml`, `modelo-sqlite.yaml`, `modelo-roto.yaml` (error de sintaxis en una línea conocida y documentada en un comentario del propio archivo de pruebas), `modelo-clave-desconocida.yaml` y `modelo-50-tablas.yaml` (50 tablas, 60 relaciones, para SC-003), todos conformes a `contracts/model.schema.json`

**Checkpoint**: dependencias disponibles y ejemplos listos

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: lo que todas las historias necesitan: almacén único, núcleo del modelo,
frontera Rust ↔ TypeScript y primitivos del sistema de diseño

**⚠️ CRITICAL**: ninguna historia puede empezar hasta que esta fase esté completa

### Almacén único (principio IV, research.md R11)

- [X] T004 Convertir `src/store/preferences.ts` en un creador de slice (`createPreferencesSlice`) sin cambiar su comportamiento, y crear `src/store/index.ts` con `useAppStore` que lo compone, manteniendo los selectores existentes
- [X] T005 Añadir a `src/store/index.ts` el slice de navegación en `src/store/navigation.ts` con `screen` (`'welcome' | 'editor'`), `dialog` (los nueve valores de data-model.md §3, `stale` incluido) y `pendingIntent` (`null | 'new-model' | 'open-model' | 'close'`)
- [X] T006 Actualizar los consumidores del Incremento 0 a `useAppStore`: `src/App.tsx`, `src/components/features/welcome/WelcomeScreen.tsx`, `ShowWelcomeToggle.tsx`, `WelcomeActions.tsx`, `src/components/features/preferences/PreferencesWindow.tsx` y `src/components/layout/Titlebar.tsx`
- [X] T007 Actualizar las pruebas del Incremento 0 que importan el almacén: `src/App.startup.test.tsx`, `src/store/preferences.test.ts`, `src/components/features/welcome/WelcomeScreen.test.tsx`, `WelcomeScreen.keyboard.test.tsx`, `src/components/features/preferences/PreferencesWindow.test.tsx` y `open-preferences.test.tsx`; `npm test` vuelve a verde sin cambiar ninguna expectativa de comportamiento

### Núcleo del modelo (research.md R1, R2, R3)

- [X] T008 [P] Crear `src/lib/model/types.ts` con los tipos del formato 1 de data-model.md §1: `Model`, `Schema`, `Table`, `Field`, `Relation`, `Enum`, `View`, `Engine` (`'postgres' | 'mysql' | 'sqlite'`), `FileStamp`; `name` de 1 a 120 caracteres sin saltos de línea, nombre técnico `^[a-z_][a-z0-9_]*$` de hasta 63 caracteres y `abbreviation` de exactamente 3 letras mayúsculas
- [X] T009 Crear `src/lib/model/validate.ts` que valide un documento ya parseado campo a campo contra data-model.md §1 y devuelva `{ path, message, line, column }` por fallo, incluidas las siete reglas de «Reglas de validación al cargar»: YAML válido, `formatVersion` igual a 1 (mayor ⇒ «versión más nueva»), campos obligatorios y tipos, **ninguna clave desconocida en ningún nivel**, al menos un esquema (RS-02), nombres técnicos conformes a RS-03 y únicos, y referencias cruzadas resueltas (`x-referenciasCruzadas` de `contracts/model.schema.json`)
- [X] T010 Crear `src/lib/model/parse.ts` que convierta texto YAML en `{ model }` o `{ errors }` usando la librería `yaml`, convirtiendo el `range` de cada nodo en línea y columna con `linePos()`, y distinguiendo el error de sintaxis del error de validación
- [X] T011 Crear `src/lib/model/serialize.ts`, **único serializador** del proyecto (principio II): escribe `formatVersion`, `name`, `engine`, `schemas` y después `enums`, `tables`, `relations`, `views` en ese orden, omitiendo las colecciones vacías
- [X] T012 [P] Escribir `src/lib/model/parse.test.ts`: error de sintaxis con la línea exacta de `modelo-roto.yaml`, clave desconocida con su línea con `modelo-clave-desconocida.yaml`, `formatVersion: 2` ⇒ «versión más nueva», y un modelo sin `schemas` ⇒ error de RS-02
- [X] T013 [P] Escribir `src/lib/model/roundtrip.test.ts` (puerta 3, FR-023, SC-004): parsear → serializar → parsear da el mismo modelo y el mismo texto, con un ejemplo por motor y con `modelo-50-tablas.yaml`

### Frontera Rust ↔ TypeScript (contracts/commands.md)

- [X] T014 Añadir en `src-tauri/src/commands.rs` los once códigos nuevos de `AppError` de `contracts/commands.md` («Códigos de error nuevos») y los constructores que los usan, sin tocar los tres del Incremento 0
- [X] T015 Crear `src-tauri/src/files.rs` con el núcleo del disco, declarando **`async fn`** todo comando que toque el disco (convención de `contracts/commands.md`, principio III): `read_model` (texto + sello), `write_model` (temporal en el mismo directorio y renombrado, con sello esperado y `model_stale` cuando no coincide, `force` para sobrescribir, `path_exists` cuando se crea y ya existe), `stat_paths` y el tipo `FileStamp { modified_ms, size_bytes }`
- [X] T016 [P] Escribir las pruebas de `src-tauri/src/files.rs` con directorios temporales al estilo de `preferences.rs`: escritura atómica, sello obsoleto, `force`, archivo inexistente, carpeta borrada entre operaciones y que un fallo no deja el archivo anterior truncado
- [X] T017 Crear `src-tauri/src/recents.rs`: lectura y escritura de `recents.json` conforme a `contracts/recents.schema.json`, orden por `usedAtMs` descendente, **máximo 10 entradas** descartando la más antigua, actualización en sitio por `path`, y recuperación con copia `.bak`, lista vacía y causa al registro cuando falta, está vacío, no es JSON o declara versión futura
- [X] T018 [P] Escribir las pruebas de `src-tauri/src/recents.rs`: insertar la 11.ª descarta la más antigua, una ruta repetida se actualiza y sube, y un `recents.json` dañado deja `.bak` y lista vacía
- [X] T019 Registrar en `src-tauri/src/main.rs` los módulos `files`, `recents`, `places` y `system` y sus comandos en el `invoke_handler`, con los estados que necesiten, sin añadir permisos nuevos a `src-tauri/capabilities/default.json` (contracts/commands.md, «Permisos»)
- [X] T020 Añadir a `src-tauri/src/preferences.rs` los campos `engine` (`postgres` por defecto) y `last_folder` (`None`), reconstruidos campo a campo como los demás, **sin subir `formatVersion`**, y aceptarlos junto a `last_model_path` en `PreferencesPatch` (research.md R18)
- [X] T021 [P] Ampliar las pruebas de `src-tauri/src/preferences.rs`: un `preferences.json` del Incremento 0 (sin `engine` ni `lastFolder`) carga con los valores por defecto y sin recuperación
- [X] T022 Añadir a `src/lib/tauri/types.ts` los tipos de la frontera de `contracts/commands.md`: `FileStamp`, `DirectoryEntry`, `Place`, `ModelReadResult`, `ModelWriteResult`, `PathStat`, `RecentEntryRecord`, `ListOnly` (`'folders' | 'models' | 'all'`) y los códigos nuevos de `AppErrorCode`
- [X] T023 Añadir a `src/lib/tauri/commands.ts` los envoltorios tipados de los trece comandos nuevos, cada uno con su JSDoc en español; sigue siendo el único archivo con `invoke` (lo verifica `scripts/check-layers.mjs`)
- [X] T024 [P] Añadir `measure_model_opened` y `measure_model_saved` en `src-tauri/src/measure.rs` y `commands.rs`, que solo anotan con `SQL_DESIGNER_MEDIR=1`, más sus envoltorios en `src/lib/tauri/commands.ts` (research.md R15)

### Primitivos del sistema de diseño (principio V, research.md R13)

- [X] T025 [P] Crear `src/components/ui/TextField.tsx`: etiqueta, valor controlado, pista, mensaje de error con `role="alert"` y `aria-describedby`, autofoco opcional; puro, solo tokens, sin importar del almacén
- [X] T026 [P] Crear `src/components/ui/SearchField.tsx` como variante de búsqueda con icono, `aria-label` y botón de limpiar
- [X] T027 [P] Crear `src/components/ui/Select.tsx` sobre `@radix-ui/react-select`, estilado con tokens, con opciones `{ value, label }`
- [X] T028 [P] Crear `src/components/ui/Sidebar.tsx`: lista de ubicaciones por secciones con título, icono, selección única y navegación con flechas
- [X] T029 [P] Crear `src/components/ui/FileList.tsx`: `listbox` de filas con icono, nombre, fecha, estado deshabilitado y selección única, con doble clic y Enter, y su estado vacío por composición
- [X] T030 [P] Crear `src/components/ui/ContextMenu.tsx` sobre `@radix-ui/react-context-menu`, con apertura por clic derecho, por ⇧F10 y por la tecla de menú, separadores, elementos deshabilitados y variante destructiva (RS-09)
- [X] T031 [P] Escribir las pruebas de los primitivos nuevos en `src/components/ui/` (uno por componente): foco visible, `aria` correcto, navegación con teclado y que ninguno importa del almacén

**Checkpoint**: almacén único, modelo tipado con validación por línea, disco y
recientes en Rust, frontera tipada y primitivos listos. `npm run typecheck`,
`npm run lint`, `npm test`, `cargo check` y `cargo test` en verde.

---

## Phase 3: User Story 1 - Crear un modelo nuevo (Priority: P1) 🎯 MVP

**Goal**: desde la Bienvenida, crear un `.yaml` con nombre, motor y carpeta, y llegar
al Editor con el modelo vacío y su esquema por defecto.

**Independent Test**: escenario 1 de `quickstart.md`: nombre «Livy · Reservas» ⇒ ruta
`…/livy-reservas.yaml`, los tres errores de nombre, la frase por motor, y el Editor
con el archivo escrito en disco.

### Tests for User Story 1

- [X] T032 [P] [US1] Escribir `src/lib/model/slug.test.ts`: «Livy · Reservas» ⇒ `livy-reservas`, acentos y mayúsculas, cadena vacía, solo signos ⇒ vacío, recorte a 80 caracteres, y nombres reservados de Windows (`con`, `prn`, `aux`, `nul`, `com1`–`com9`, `lpt1`–`lpt9`) ⇒ prefijo `modelo-`
- [X] T033 [P] [US1] Escribir `src/lib/model/defaults.test.ts`: esquema por defecto `public`/`PUB` en PostgreSQL, nombre técnico del modelo en MySQL con abreviatura de sus 3 primeras letras rellenadas con `X`, y `main`/`MAI` en SQLite (FR-005, RS-02, RS-04)
- [X] T034 [P] [US1] Escribir `src/components/features/new-model/NewModelDialog.test.tsx`: la ruta final se actualiza al escribir; «Crear modelo» deshabilitado con «Escribe un nombre para el modelo.», con «Usa al menos una letra o un número.» y con «Ya existe <archivo>.yaml en esta carpeta. Elige otro nombre.»; la frase del motor cambia con cada motor; el motor inicial es el de Ajustes

### Implementation for User Story 1

- [X] T035 [P] [US1] Crear `src/lib/model/slug.ts`: NFD, quitar diacríticos, minúsculas, todo lo que no sea `[a-z0-9]` a `-`, colapsar y recortar guiones, máximo 80 caracteres, y la detección de vacío y de nombre reservado de Windows (data-model.md «Derivación del nombre de archivo»)
- [X] T036 [P] [US1] Crear `src/lib/model/defaults.ts` con `emptyModel(name, engine)`, que devuelve `formatVersion: 1`, el nombre, el motor y exactamente un esquema según la tabla «Esquema por defecto de un modelo nuevo» de data-model.md
- [X] T037 [US1] Implementar `path_build_model` en `src-tauri/src/files.rs` y `commands.rs`: devuelve `{ path, fileName, exists }`, rechaza con `path_invalid` un `fileStem` vacío, con separadores o reservado, y no toca el disco más que para comprobar la existencia
- [X] T038 [P] [US1] Escribir la prueba de `path_build_model` en `src-tauri/src/files.rs`: ruta compuesta con el separador del sistema, `exists` verdadero y falso, y los tres casos de `path_invalid`
- [X] T039 [US1] Añadir el slice `model` en `src/store/model.ts` (`model`, `path`, `stamp`, `isDirty`, `savedAtMs`, `saveError`) y componerlo en `src/store/index.ts`, con la acción `createModel({ name, engine, folder })` que arma el modelo vacío, serializa, llama a `model_write` sin sello esperado, registra en recientes con `recents_touch`, guarda `lastFolder` y `lastModelPath` en preferencias y pasa `screen` a `'editor'`
- [X] T040 [US1] Añadir al slice `browser` en `src/store/browser.ts` el borrador de Nuevo modelo (`draftName`, `draftEngine`, `draftFolder`) inicializado con el motor de Ajustes y con `lastFolder` o la carpeta de documentos, y componerlo en `src/store/index.ts`
- [X] T041 [US1] Crear `src/components/features/new-model/NewModelDialog.tsx` según `project/NuevoModelo.dc.html` del lienzo: título, descripción, `TextField` de nombre con pista «Puedes cambiarlo después.», `SegmentedControl` de motor con su frase descriptiva, fila de ubicación con el botón «Cambiar…», ruta final en monoespaciada, y «Cancelar» y «Crear modelo»
- [X] T042 [US1] Implementar en `NewModelDialog.tsx` la validación en vivo contra `path_build_model` (existencia) y `slug.ts` (nombre vacío o sin letras ni números), con los tres mensajes exactos de FR-003 y el botón deshabilitado mientras haya error
- [X] T043 [US1] Crear `src/components/features/editor/EditorScreen.tsx` con la tarjeta «Empieza a diseñar tu modelo» del estado de modelo vacío, y montarla en `src/App.tsx` cuando `screen` sea `'editor'`
- [X] T044 [US1] Conectar la Bienvenida: «Nuevo modelo…» y ⌘N / Ctrl+N abren el diálogo desde `src/components/features/welcome/WelcomeActions.tsx` y `src/hooks/useShortcut.ts`, retirando el aviso `NEXT_INCREMENT_NOTICE` del almacén para esa acción
- [X] T045 [US1] Anotar la medida de SC-002 con `measure_model_opened` en cuanto el Editor queda pintado tras crear, con el patrón de dos `requestAnimationFrame` de `src/App.tsx`

**Checkpoint**: crear un modelo funciona de principio a fin y el archivo existe en
disco. Escenario 1 de `quickstart.md` en verde.

---

## Phase 4: User Story 3 - Abrir un modelo (Priority: P1)

**Goal**: recorrer carpetas, ver la vista previa de un `.yaml`, abrirlo en el Editor y
ver el diálogo con la línea del error cuando está roto.

**Independent Test**: escenario 3 de `quickstart.md` con un modelo válido, uno roto y
archivos de otro tipo en la misma carpeta.

**Nota**: construye el explorador (ubicaciones, listado, búsqueda, Atrás y Adelante)
que la US2 reutiliza después.

### Tests for User Story 3

- [X] T046 [P] [US3] Escribir `src/lib/model/summary.test.ts`: motor, número de tablas y de relaciones de cada ejemplo; un archivo roto devuelve `invalid: true` con el mensaje y la línea
- [X] T047 [P] [US3] Escribir `src/store/browser.test.ts`: cambiar de ubicación carga su contenido, Atrás y Adelante recorren el historial y se deshabilitan en los extremos, la búsqueda filtra en memoria y deja «Sin resultados», y solo se puede seleccionar un `.yaml`
- [X] T048 [P] [US3] Escribir `src/components/features/open-model/OpenModelDialog.test.tsx`: la vista previa muestra los cinco datos, «Abrir» deshabilitado sin selección, doble clic abre, un archivo con errores marca la vista previa y abre el diálogo con la línea, y los archivos que no son `.yaml` salen atenuados y no seleccionables

### Implementation for User Story 3

- [X] T049 [P] [US3] Crear `src-tauri/src/places.rs` con `fs_user_places`: Recientes (virtual, sin ruta), Escritorio, Documentos, Descargas, Inicio, iCloud Drive solo en macOS si existe, y la raíz del volumen, **listando solo las que existen**, cada una con `id`, `label`, `icon`, `path` y `canCreateFolder` (research.md R6)
- [X] T050 [US3] Implementar `fs_list_directory` en `src-tauri/src/files.rs` y `commands.rs` con el filtro `only` (`folders`, `models`, `all`), carpetas primero y después orden natural insensible a mayúsculas, omitiendo ocultos e ilegibles, y devolviendo `DirectoryEntry` con `isModel` para los `.yaml`
- [X] T051 [P] [US3] Escribir las pruebas de `fs_list_directory` y `fs_user_places` en Rust: los tres filtros, el orden, los ocultos, `path_not_found`, `path_not_a_directory` y que no se lista una ubicación inexistente
- [X] T052 [P] [US3] Comprobar que listar una carpeta de 1 000 entradas no congela la interfaz: prueba en `src-tauri/src/files.rs` que el comando es `async` y medición manual anotada en el escenario 3 de `quickstart.md` (FR-042, principio III)
- [X] T053 [P] [US3] Crear `src/lib/model/summary.ts` que, a partir del texto de `model_read`, devuelva `ModelPreview` (`name`, `fileName`, `engine`, `tables`, `relations`, `sizeBytes`, `modifiedMs`, `invalid`, `error`) reutilizando `parse.ts`, sin un segundo parser
- [X] T054 [US3] Completar el slice `browser` en `src/store/browser.ts` con `placeId`, `path`, `entries`, `query`, `selection`, `history`, `future` y `preview`, y las acciones de navegar, entrar en una carpeta, buscar, seleccionar y refrescar la vista previa
- [X] T055 [US3] Añadir al slice `model` la acción `openModel(path)`: `model_read`, validación, `recents_touch` con los datos cacheados, `lastModelPath`, `screen` a `'editor'` y `measure_model_opened`; si la validación falla, no abre y deja el error para el diálogo (FR-016)
- [X] T056 [US3] Crear `src/components/features/open-model/OpenModelDialog.tsx` según `project/AbrirModelo.dc.html`: barra con Atrás, Adelante, ubicación y buscador; `Sidebar` de ubicaciones; `FileList` con Nombre y Modificado; panel de vista previa; pie con el `Select` de formato «Modelo SQL Designer (.yaml)», «Cancelar» y «Abrir»
- [X] T057 [US3] Implementar los estados vacíos del diálogo con los textos exactos: «No hay modelos aquí» con «Los modelos de SQL Designer son archivos .yaml.» y «Sin resultados» con el texto buscado (FR-009)
- [X] T058 [US3] Crear `src/components/features/open-model/FileErrorDialog.tsx`: título «No se pudo abrir «<archivo>»», descripción con la línea y la causa, y las salidas «Mostrar en Finder» / «Mostrar en el Explorador» y «Aceptar», quedándose en Abrir modelo al cerrar
- [X] T059 [US3] Crear `src-tauri/src/system.rs` con `reveal_in_file_manager` (`open -R` en macOS, `explorer /select,` en Windows) y registrarlo, devolviendo `path_not_found` o `system_command_failed` sin pánico (research.md R8)
- [X] T060 [US3] Conectar la Bienvenida: «Abrir modelo…» y ⌘O / Ctrl+O abren el diálogo desde `WelcomeActions.tsx` y `src/hooks/useShortcut.ts`

**Checkpoint**: abrir un modelo válido y ver el error de uno roto funcionan solos.
Escenario 3 de `quickstart.md` en verde.

---

## Phase 5: User Story 4 - Guardar y estado de cambios (Priority: P1)

**Goal**: el Editor dice «Guardado · <motor>» con la hora o «Editado» con indicador,
⌘S escribe, y el archivo cambiado por fuera se avisa antes de sobrescribir.

**Independent Test**: escenario 4 de `quickstart.md`, incluidos el guardado sin
cambios, el archivo tocado por fuera y el archivo sin permiso de escritura.

### Tests for User Story 4

- [X] T061 [P] [US4] Escribir `src/store/model.test.ts`: `renameModel` marca `isDirty`; `saveModel` con éxito limpia `isDirty` y fija `savedAtMs`; `saveModel` sin cambios no llama a `model_write`; `model_stale` deja `isDirty` y pide confirmación; un fallo de escritura deja `isDirty` y `saveError` sin descartar el cambio
- [X] T062 [P] [US4] Escribir `src/components/layout/EditorChrome.test.tsx`: «Guardado · PostgreSQL» con la hora, «Editado» tras renombrar, el indicador en el botón de cerrar, y el nombre del modelo en la cabecera
- [X] T063 [P] [US4] Escribir en `src/store/model.test.ts` las pruebas de deshacer y rehacer: ⌘Z tras renombrar devuelve el nombre anterior y, al coincidir otra vez con el archivo, el estado vuelve a «Guardado»; ⇧⌘Z repone el nombre nuevo y vuelve «Editado»; el historial se vacía al abrir o cerrar un modelo (FR-044, RS-06)

### Implementation for User Story 4

- [X] T064 [US4] Crear `src/components/layout/EditorChrome.tsx` con la cabecera del Editor: nombre del modelo, estado «Guardado · <motor>» con la hora del último guardado o «Editado», y botón de cerrar con indicador de cambios sin guardar (FR-018, FR-019, RS-07); la referencia visual está en `project/Editor.dc.html` del lienzo, que pesa 303 KB: descárgalo con la acción de lectura del artefacto e inspecciónalo con `grep` sobre el archivo guardado, nunca volcándolo entero
- [X] T065 [US4] Añadir al slice `model` la acción `renameModel(name)`, único cambio al contenido que permite este incremento, que cambia `name`, marca `isDirty` y no toca el nombre del archivo (FR-020)
- [X] T066 [US4] Añadir al slice `model` el historial `past` / `future` con `{ model, label }` y `savedModel`, y las acciones `undo()` y `redo()`; `isDirty` pasa a ser «el modelo no coincide con `savedModel`», de modo que deshacer hasta el estado guardado devuelve «Guardado» (FR-044, data-model.md §3)
- [X] T067 [US4] Registrar ⌘Z / ⇧⌘Z (Ctrl+Z / Ctrl+Y) en `src/hooks/useShortcut.ts` solo con el Editor activo, y mostrar con `src/components/ui/Toast.tsx` la etiqueta de qué se deshizo o rehízo, «Deshecho: renombrar el modelo» (FR-044, RS-06, RS-12)
- [X] T068 [US4] Crear `src/components/features/editor/RenameModelDialog.tsx` con el nombre actual precargado, la frase «El archivo sigue siendo <archivo>.», el error «Escribe un nombre para el modelo.» y «Renombrar» deshabilitado con el nombre vacío
- [X] T069 [US4] Añadir al slice `model` la acción `saveModel({ force })`: serializa, llama a `model_write` con `stamp`, actualiza `stamp`, `savedAtMs` e `isDirty`, refresca recientes con `recents_touch` y anota `measure_model_saved`; sin cambios no escribe (FR-021)
- [X] T070 [US4] Implementar el manejo de `model_stale` en el slice `model` y el diálogo de confirmación correspondiente en `src/components/features/editor/StaleFileDialog.tsx`, con sobrescribir (repite con `force: true`) y cancelar sin escribir nada (FR-025)
- [X] T071 [US4] Implementar el aviso de fallo al guardar: mensaje visible con la causa, el modelo sigue «Editado» y no se descarta ningún cambio (FR-024), reutilizando `src/components/ui/Toast.tsx` para el éxito «Guardado»
- [X] T072 [US4] Registrar ⌘S / Ctrl+S en `src/hooks/useShortcut.ts` solo cuando `screen` es `'editor'`, y mostrar el símbolo según plataforma (RS-12)

**Checkpoint**: el ciclo crear/abrir → editar → guardar es completo y seguro.
Escenario 4 de `quickstart.md` en verde.

---

## Phase 6: User Story 2 - Elegir la carpeta (Priority: P2)

**Goal**: elegir dónde se guarda el modelo nuevo, con búsqueda, Atrás y Adelante y
carpeta nueva, sin perder el borrador de Nuevo modelo.

**Independent Test**: escenario 2 de `quickstart.md`.

**Dependencia**: reutiliza el explorador que construyó la US3 (T049–T055).

### Tests for User Story 2

- [X] T073 [P] [US2] Escribir `src/components/features/choose-folder/ChooseFolderDialog.test.tsx`: solo se seleccionan carpetas, «Sin resultados» y «Carpeta vacía» con sus textos, «Nueva carpeta» deja «carpeta sin título» seleccionada, «Elegir» devuelve la carpeta al borrador y «Cancelar» lo deja intacto

### Implementation for User Story 2

- [X] T074 [US2] Implementar `fs_create_directory` en `src-tauri/src/files.rs` y `commands.rs`: crea la carpeta, **desambigua el nombre en Rust** numerando ` 2`, ` 3`… cuando ya existe, y devuelve `{ name, path }`; errores `path_invalid`, `path_denied` y `path_not_found` (FR-010)
- [X] T075 [P] [US2] Escribir la prueba de `fs_create_directory` en Rust: nombre libre, nombre repetido dos veces seguidas, nombre con separador ⇒ `path_invalid`, y padre inexistente ⇒ `path_not_found`
- [X] T076 [US2] Crear `src/components/features/choose-folder/ChooseFolderDialog.tsx` según `project/ElegirCarpeta.dc.html`: barra con Atrás, Adelante, ubicación y buscador, `Sidebar`, `FileList` en modo `only: 'folders'` con los archivos atenuados, pie con «Nueva carpeta», la ruta elegida en monoespaciada, «Cancelar» y «Elegir»
- [X] T077 [US2] Montar el diálogo encima de Nuevo modelo sin cerrarlo (`dialog: 'choose-folder'` sobre el borrador del slice `browser`), de modo que al volver el nombre y el motor escritos siguen ahí (FR-011)
- [X] T078 [US2] Deshabilitar «Nueva carpeta» donde no se puede escribir, usando el `canCreateFolder` que devuelve `fs_user_places`
- [X] T079 [US2] Implementar el guardado en otra carpeta cuando `model_write` devuelve `path_not_found`: reutilizar `ChooseFolderDialog` con `choosePurpose: 'relocate-save'`, guardar allí sin `expectedStamp`, adoptar la ruta nueva en el slice `model` y actualizar Recientes y `lastFolder` (FR-045, cierra el caso borde del archivo movido por fuera)

**Checkpoint**: crear un modelo en cualquier carpeta, incluida una recién creada.
Escenario 2 de `quickstart.md` en verde.

---

## Phase 7: User Story 5 - Cerrar el modelo (Priority: P2)

**Goal**: cerrar el modelo y volver a la Bienvenida, preguntando cuando hay cambios
sin guardar, también al cerrar la ventana o al abrir otro modelo.

**Independent Test**: escenario 5 de `quickstart.md`, con las tres respuestas del
diálogo y con el cierre de la ventana.

### Tests for User Story 5

- [X] T080 [P] [US5] Escribir `src/store/navigation.test.ts`: cerrar sin cambios vuelve a `'welcome'`; con cambios abre `confirm-close` guardando `pendingIntent`; «Guardar» guarda y continúa con la intención; «No guardar» continúa sin escribir; «Cancelar» deja el Editor y `isDirty`
- [X] T081 [P] [US5] Escribir `src/components/features/editor/ConfirmCloseDialog.test.tsx`: el diálogo nombra el modelo y ofrece «Guardar», «No guardar» y «Cancelar», y Esc equivale a «Cancelar»

### Implementation for User Story 5

- [X] T082 [US5] Añadir al slice `model` la acción `closeModel()` que limpia modelo, ruta, sello y estado, y al slice `navigation` la resolución de `pendingIntent` tras guardar o descartar (FR-027, FR-030)
- [X] T083 [US5] Crear `src/components/features/editor/ConfirmCloseDialog.tsx` con el título «¿Guardar los cambios?», el nombre del modelo afectado y las tres respuestas (FR-028)
- [X] T084 [US5] Conectar el botón de cerrar de `EditorChrome.tsx` y ⌘W / Ctrl+W en `src/hooks/useShortcut.ts` al flujo de cierre
- [X] T085 [US5] Interceptar el cierre de la ventana en `src-tauri/src/main.rs` (evento de cierre solicitado) y en `src/lib/tauri/events.ts` para preguntar antes de salir cuando hay cambios sin guardar, cerrando de verdad solo tras la respuesta (FR-028)
- [X] T086 [US5] Hacer que «Nuevo modelo» y «Abrir modelo» desde el Editor pasen por la misma pregunta antes de reemplazar el modelo abierto, con `pendingIntent` (FR-030)

**Checkpoint**: no se pierde trabajo por ninguna de las tres vías de salida.
Escenario 5 de `quickstart.md` en verde.

---

## Phase 8: User Story 6 - Recientes (Priority: P2)

**Goal**: la Bienvenida lista los diez últimos modelos con sus datos y sus marcas, y
los abre con doble clic o Enter.

**Independent Test**: escenario 6 de `quickstart.md`, pasos 1 a 4.

**Dependencia**: el backend de recientes ya está (T017, T018); esta fase añade el
slice y la interfaz.

### Tests for User Story 6

- [X] T087 [P] [US6] Escribir `src/store/recents.test.ts`: orden por último uso, sin duplicados por ruta, tope de 10, estado `missing` desde `exists: false`, estado `invalid` desde el caché y revalidación cuando el sello del disco no coincide
- [X] T088 [P] [US6] Escribir `src/components/features/welcome/RecentsList.test.tsx`: cada fila muestra nombre, ruta, fecha y «PostgreSQL · 6 tablas»; «No encontrado» y «Archivo con errores» en su fila; doble clic y Enter abren; el total aparece arriba; sin recientes se ve el mensaje de lista vacía

### Implementation for User Story 6

- [X] T089 [US6] Crear el slice `recents` en `src/store/recents.ts` con `entries`, `isLoading` y las acciones `refresh`, `revalidateStale`, `touch` y `remove`, y componerlo en `src/store/index.ts`
- [X] T090 [US6] Implementar la resolución de estado de cada entrada (`ok`, `missing`, `invalid`, `stale`) según la tabla «Estado de una entrada» de data-model.md §2, a partir de `recents_list`
- [X] T091 [US6] Implementar la revalidación perezosa: tras el primer fotograma de la Bienvenida, releer y validar solo las entradas cuyo sello del disco no coincide con el cacheado, actualizar su estado y refrescar el caché con `recents_touch`, sin bloquear la interfaz (FR-042, research.md R5)
- [X] T092 [US6] Crear `src/components/features/welcome/RecentsList.tsx` según `project/Main.dc.html`: título «Recientes» con el total, filas de 52 px con icono por estado, nombre, ruta, fecha y la línea «<motor> · N tabla(s)», selección única y apertura con doble clic y Enter
- [X] T093 [US6] Crear `src/components/features/welcome/RecentNotFoundDialog.tsx`: «No se encontró «<archivo>»», la explicación de que se movió o se eliminó, y las salidas «Quitar de recientes» y «Aceptar» (FR-034)
- [X] T094 [US6] Reutilizar `FileErrorDialog.tsx` para el reciente con errores, de modo que la línea del error se vea igual desde la Bienvenida y desde Abrir modelo (FR-034)
- [X] T095 [US6] Montar la lista en `src/components/features/welcome/WelcomeScreen.tsx` con su estado vacío, manteniendo las acciones de crear y abrir disponibles

**Checkpoint**: el ciclo completo del incremento (crear, cerrar, reabrir desde
Recientes, ver los errores de archivo) ya se puede demostrar.

---

## Phase 9: User Story 7 - Acciones sobre un reciente (Priority: P3)

**Goal**: renombrar, copiar ruta, quitar y mover a la papelera un reciente sin
abrirlo, con las acciones que no aplican deshabilitadas.

**Independent Test**: escenario 6 de `quickstart.md`, pasos 5 a 9.

### Tests for User Story 7

- [ ] T096 [P] [US7] Escribir `src/components/features/welcome/RecentContextMenu.test.tsx`: las cinco acciones con clic derecho y con ⇧F10, recorrido con flechas, cierre con Esc, y los conjuntos deshabilitados de un reciente «No encontrado» (Abrir, Renombrar…, Mover a la papelera…) y de uno «Archivo con errores» (Renombrar…)
- [ ] T097 [P] [US7] Escribir la prueba del renombrado desde Recientes en `src/store/recents.test.ts`: cambia `name` en el archivo y en la lista, el nombre del archivo no cambia, y un nombre vacío no se puede confirmar

### Implementation for User Story 7

- [ ] T098 [US7] Crear `src/components/features/welcome/RecentContextMenu.tsx` sobre `src/components/ui/ContextMenu.tsx` con «Abrir», «Renombrar…», «Copiar ruta», separador, «Quitar de recientes» y «Mover a la papelera…» en variante destructiva (FR-035, RS-09)
- [ ] T099 [US7] Implementar `rename` en el slice `recents`: `model_read`, validar, cambiar `name`, `model_write` con el sello leído, `recents_touch`; si el archivo cambió por fuera, el mismo aviso de `model_stale` de la US4 (FR-036)
- [ ] T100 [US7] Reutilizar el diálogo de renombrar de la US4 desde la Bienvenida, con la frase «El archivo sigue siendo <archivo>.» (FR-036)
- [ ] T101 [US7] Implementar `clipboard_write_text` en `src-tauri/src/system.rs` (`pbcopy` en macOS, `powershell -NoProfile -Command Set-Clipboard` en Windows) y conectarlo a «Copiar ruta» con su aviso breve de confirmación (FR-035, escenario US7-3, research.md R8)
- [ ] T102 [US7] Implementar `trash_move` en `src-tauri/src/system.rs` con el crate `trash`, devolviendo `trash_unavailable` sin borrar cuando falla, y conectarlo a «Mover a la papelera…» seguido de `recents_remove` (FR-037, RS-08)
- [ ] T103 [US7] Crear `src/components/features/welcome/TrashConfirmDialog.tsx`: título «¿Mover «<archivo>» a la papelera?», descripción con la carpeta de origen y que se puede recuperar, y las acciones «Cancelar» y «Mover a la papelera» en variante destructiva (FR-037, RS-08)
- [ ] T104 [US7] Implementar el estado deshabilitado de las acciones según el estado del reciente, con las dos combinaciones de FR-038
- [ ] T105 [US7] Conectar «Quitar de recientes» a `recents_remove` dejando el archivo intacto (FR-035, escenario US7-4)

**Checkpoint**: las siete historias funcionan de forma independiente.

---

## Phase 10: Polish & Cross-Cutting Concerns

**Purpose**: las puertas de calidad de la constitución y la validación del incremento

- [ ] T106 Revisar las dos pantallas y las nueve superficies modales de `data-model.md` §3 en tema claro, tema oscuro y con movimiento reducido, corrigiendo cualquier valor literal que se haya colado fuera de los tokens (FR-039, puerta 5, principio V, SC-009)
- [ ] T107 Pasada completa de teclado por las dos pantallas y las nueve superficies modales de `data-model.md` §3: toda acción alcanzable, foco visible, Esc cierra, y símbolos ⌘ / Ctrl correctos por plataforma (FR-040, SC-007, RS-12)
- [ ] T108 Verificar a 820 × 500, el tamaño mínimo de la ventana, que Nuevo modelo, Elegir carpeta y Abrir modelo caben sin que la ventana crezca y que lo que no cabe hace scroll dentro de su sección, con `src/components/layout/ScrollRegion.tsx` (FR-043, RS-01)
- [ ] T109 [P] Revisar que todo símbolo nuevo o con firma modificada lleva su JSDoc en español y todo elemento público de Rust su `///`, incluidos los que cambiaron en el refactor del almacén; revisar de paso que todo texto visible está en español y que los nombres técnicos derivados cumplen RS-03 (puerta 8, principio VIII, FR-041)
- [ ] T110 [P] Ejecutar `npm run typecheck`, `npm run lint` (incluye la puerta 7 de capas e `invoke`), `npm test`, `cargo check` y `cargo test`, y dejarlos sin avisos nuevos (puertas 1 y 7)
- [ ] T111 Ejecutar los ocho escenarios de `quickstart.md` en macOS y anotar el resultado de cada uno
- [ ] T112 Ejecutar el escenario 8 de `quickstart.md` con `SQL_DESIGNER_MEDIR=1` y comprobar SC-002 (< 1 000 ms) y SC-003 (abrir < 2 000 ms, guardar < 1 000 ms) con `modelo-50-tablas.yaml`
- [ ] T113 Dejar anotada la verificación en Windows como tarea manual pendiente (símbolos de atajo, «Mostrar en el Explorador», papelera, unidad del sistema, sin iCloud Drive y formato de rutas), siguiendo la pauta del Incremento 0
- [ ] T114 Guardar en Engram con `mem_save` los hallazgos reales de la implementación: bugs con su causa raíz y cada desvío del plan (CLAUDE.md, fase `speckit-implement`)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (fase 1)**: sin dependencias. T002 es bloqueante y puede detener el
  incremento: hazla primero.
- **Foundational (fase 2)**: depende del Setup y **bloquea todas las historias**.
- **US1 (fase 3)**, **US3 (fase 4)**, **US4 (fase 5)**: dependen de la fase 2.
- **US2 (fase 6)**: depende de la fase 2 y del explorador de la US3 (T049–T055).
- **US5 (fase 7)**: depende de la fase 2 y de la cabecera del Editor de la US4 (T064).
- **US6 (fase 8)**: depende de la fase 2 (el backend de recientes está en T017–T018).
- **US7 (fase 9)**: depende de la US6 (lista y menú) y reutiliza el diálogo de
  renombrar de la US4 (T068) y el aviso de `model_stale` (T070).
- **Polish (fase 10)**: depende de las historias que se quieran entregar.

### Dependencias no obvias

1. **T002 antes que T102**: sin el crate `trash` descargado, «Mover a la papelera» no
   compila. Y crates.io no respondió al preparar el plan: si falla, se decide antes de
   escribir una línea.
2. **T004–T007 antes que cualquier pantalla nueva**: el refactor del almacén toca los
   archivos del Incremento 0. Hacerlo después obligaría a reescribir las pantallas
   nuevas.
3. **T017–T018 (recientes en Rust) están en Foundational aunque la interfaz sea de la
   US6**: la US1, la US3 y la US4 registran en recientes al crear, abrir y guardar. Sin
   el backend, esas historias tendrían que llamar a algo que no existe.
4. **T053 (`summary.ts`) reutiliza `parse.ts`**: no se escribe un segundo parser para
   la vista previa; el principio II prohíbe dos caminos.
5. **T056 y T076 comparten el slice `browser`**: la US3 lo crea entero (T054) y la US2
   solo añade el modo de carpetas y «Nueva carpeta». No son paralelas entre sí.
6. **T064 antes de T084 y T086**: el botón de cerrar del Editor vive en la cabecera.
7. **T094 y T100 reutilizan componentes de fases anteriores** (diálogo de error de la
   US3, diálogo de renombrar de la US4): si se entrega la US6 o la US7 sin esas fases,
   hay que crear esos diálogos en la propia fase.
8. **T037 (`path_build_model`) vive en `files.rs` igual que T015, T050 y T074**: cuatro
   tareas en el mismo archivo de Rust, ninguna marcada [P] entre sí.
9. **T019 (registro en `main.rs`) se toca en varias fases**: al añadir los comandos de
   las US2, US3 y US7 hay que volver a ella; por eso no está marcada [P].

### Parallel Opportunities

- Fase 1: T003 en paralelo con T001 y T002.
- Fase 2: T008 con T014; T012 y T013 entre sí una vez estén T009–T011; T016, T018,
  T021 y T024 entre sí; los siete primitivos T025–T031 son todos paralelos.
- Fase 3: T032, T033 y T034 en paralelo; T035, T036 y T038 en paralelo.
- Fase 4: T046, T047 y T048 en paralelo; T049, T051, T052 y T053 en paralelo.
- Fase 5: T061, T062 y T063 en paralelo.
- Fase 6: T073 con T075.
- Fase 8: T087 con T088.
- Fase 9: T096 con T097.
- Fase 10: T109 con T110.

---

## Parallel Example: fase 2, primitivos del sistema de diseño

```bash
# Siete componentes puros, archivos distintos, ninguna dependencia entre ellos:
Task: "Crear src/components/ui/TextField.tsx"
Task: "Crear src/components/ui/SearchField.tsx"
Task: "Crear src/components/ui/Select.tsx"
Task: "Crear src/components/ui/Sidebar.tsx"
Task: "Crear src/components/ui/FileList.tsx"
Task: "Crear src/components/ui/ContextMenu.tsx"
Task: "Escribir las pruebas de los primitivos nuevos"
```

## Parallel Example: fase 4, pruebas de la US3

```bash
Task: "Escribir src/lib/model/summary.test.ts"
Task: "Escribir src/store/browser.test.ts"
Task: "Escribir src/components/features/open-model/OpenModelDialog.test.tsx"
```

---

## Implementation Strategy

### MVP primero (US1)

1. Fase 1: Setup, empezando por T002.
2. Fase 2: Foundational (bloquea todo).
3. Fase 3: US1.
4. **PARAR y VALIDAR**: escenario 1 de `quickstart.md`. Ya se puede crear un modelo y
   el archivo existe en disco.

### Entrega incremental

1. Setup + Foundational → base lista.
2. US1 → crear un modelo. **MVP.**
3. US3 → abrir un modelo y ver los errores de archivo.
4. US4 → guardar y estado de cambios. Con esto el ciclo de trabajo ya es seguro.
5. US2 → elegir la carpeta.
6. US5 → cerrar sin perder trabajo.
7. US6 → Recientes. **Aquí se demuestra el incremento completo** (crear, cerrar,
   reabrir desde Recientes, ver los errores de archivo).
8. US7 → acciones sobre un reciente.
9. Fase 10 → puertas de calidad y validación en las dos plataformas.

### Equipo en paralelo

Tras la fase 2, con la fase 4 (US3) terminada, se pueden repartir: US2 y US5 por un
lado, US6 y US7 por otro. La US4 conviene hacerla antes de repartir, porque la
cabecera del Editor y el aviso de archivo cambiado los reutilizan la US5 y la US7.

---

## Notes

- `[P]` = archivos distintos y sin dependencias pendientes.
- La etiqueta `[Story]` traza cada tarea a su historia del spec.
- Cada historia se puede completar y probar sola; los puntos de control lo dicen.
- Las pruebas de una fase se escriben antes de su implementación y deben fallar
  primero.
- Commit por tarea o por grupo lógico, con mensaje convencional (`feat(002): …`).
- El lienzo «SQL Designer · Diseño de Pantallas» es referencia de diseño: se leen
  medidas, copia y jerarquía; no se importa su HTML ni su `support.js` (puerta 6).
- Cada hallazgo real de la implementación (bug con su causa, desvío del plan) se
  guarda en Engram en el momento, no al final (CLAUDE.md).
