# Implementation Plan: Tablas y campos (Incremento 3)

**Branch**: `004-tablas-campos` | **Date**: 2026-10-27 | **Spec**:
[`spec.md`](./spec.md)

**Input**: Feature specification from `/specs/004-tablas-campos/spec.md`

## Summary

El lienzo del Incremento 2 pasa de dibujar tablas a dejar crearlas, moverlas y
describirlas campo a campo. Son 57 requisitos en seis historias: crear una tabla
(P1), el editor de campos (P2), llaves y plantillas (P3), mover tablas (P4),
renombrar, duplicar y eliminar (P5) y el inspector de tabla (P6).

El enfoque técnico, resuelto en la Fase 0, cabe en cinco frases. El alto de la
tarjeta deja de ser constante y pasa a ser una función pura de su número de
campos, de la que dependen la zona del esquema, el minimapa y «Ajustar» (R1).
Los tipos salen de un catálogo por motor en `src/lib/model/engines.ts`, de donde
también salen el campo `id` y las plantillas (R2). El campo del archivo gana
`length` y `scale` opcionales, así que la versión del formato no cambia (R3). El
arrastre de una tabla copia el patrón ya medido del arrastre de zona: se pinta
en el nodo, se escribe al almacén al soltar y vale un paso de deshacer (R4). Y
el historial gana una clave de fusión, con la que escribir una celda entera
queda en un único paso sin depender de ningún reloj (R8).

Como el Incremento 2, es casi todo frontend: la frontera con Rust solo crece en
dos campos de preferencias —ajuste a la cuadrícula y alto del panel— sobre un
comando que ya existe (R15). Sin dependencias nuevas, de npm ni de Rust.

## Technical Context

**Language/Version**: TypeScript 5.6 en modo `strict` (React 18.3) y Rust 1.75+
(edición 2021) para los dos campos de preferencias.

**Primary Dependencies**: Tauri 2.12.5, React 18, Zustand 4.5, Radix UI,
Tailwind 3.4 sobre los tokens de `src/styles/tokens.css`, Framer Motion 11,
`yaml` 2.9. **Ninguna dependencia nueva**: la rejilla de campos se construye con
los componentes puros que ya existen y su navegación con un hook propio (R7).

**Storage**: el archivo `.yaml` del modelo (formato 1, sin subir de versión, con
`fields[].length` y `fields[].scale` nuevos) y `preferences.json` en el
directorio de configuración, propiedad de Rust.

**Testing**: Vitest 2.1 sobre jsdom con Testing Library para lo puro, el almacén
y los componentes; WebdriverIO 10 con `@wdio/tauri-service` para el recorrido
sobre la aplicación real, donde van los gestos de puntero y el reinicio que
comprueba las preferencias (R17).

**Target Platform**: Windows 10+ (WebView2) y macOS 12+ (WebKit), el mismo
diseño en los dos.

**Project Type**: aplicación de escritorio Tauri; frontend en `src/`, backend en
`src-tauri/`.

**Performance Goals**: 60 cuadros por segundo arrastrando una tabla en un modelo
de 50 tablas, con respuesta al primer gesto por debajo de 100 ms (SC-004); cada
pulsación en una celda visible en la fila y en la tarjeta en menos de 100 ms
(SC-005).

**Constraints**: el panel entre 200 y 560 px; descripción de tabla hasta 280
caracteres; una sola tabla seleccionada; `type` sin paréntesis y longitud y
escala como números; nada se escribe al archivo hasta Guardar; todo alcanzable
con el teclado con contraste ≥ 4,5:1 en los dos temas; con «Reducir movimiento»
el resultado llega sin animación.

**Scale/Scope**: una pantalla existente que crece (el Editor), un panel inferior
nuevo, cuatro diálogos (Nueva tabla, Renombrar y dos confirmaciones), un menú
contextual, dos partes nuevas del almacén, seis funciones puras nuevas, 57
requisitos funcionales, tablas de hasta 40 campos y modelos de hasta ~200
tablas.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Principios

| Principio | Estado | Cómo se cumple |
| --------- | ------ | -------------- |
| I · Modelado local sin conexión | PASA | Sin dependencias nuevas, sin red, sin telemetría. El catálogo de tipos por motor son datos empaquetados, no una consulta a ningún sitio; nada se conecta a una base real. |
| II · El archivo del modelo es la única fuente de verdad | PASA | Tablas, campos, longitudes, escalas, marcas de llave, descripciones, esquema y posiciones viajan en el `.yaml` (FR-051). Un solo serializador, con `length` y `scale` en su orden fijo, y la puerta 3 se amplía con un modelo que los trae. Las marcas de llave **no** se guardan por campo: se derivan de `primaryKey` y `uniques` (R12), así que no hay dos verdades. Lo que no es del modelo —selección, celda enfocada, panel abierto— no se escribe. |
| III · Frontera Rust ↔ TypeScript explícita | PASA | La frontera crece en dos campos de `preferences_update`, un comando que ya existe; ningún comando nuevo y ningún permiso nuevo en `capabilities/`. El frontend no toca el disco. Ninguna acción bloquea la interfaz (FR-052): el arrastre va en el hilo de composición y escribir en una celda es una escritura al almacén, sin trabajo de archivo. |
| IV · Tipado estricto y estado único | PASA | Sin `any` ni `@ts-ignore`. Dos partes nuevas del almacén único (`src/store/tables.ts` y `src/store/fieldsPanel.ts`), ningún gestor paralelo. Los tipos del modelo siguen siendo unos solos, en `src/lib/model/types.ts`, compartidos por validador, serializador y almacén. El borrador de una celda mientras se escribe es estado efímero del componente; lo que el almacén guarda es el valor ya aplicado. |
| V · Sistema de diseño por tokens | PASA, con una nota | Las celdas de la rejilla son los componentes puros que ya existen (`TextField`, `Select`, `Checkbox`, `Button`); diálogos, menú contextual y confirmaciones sobre `Dialog` y `ContextMenu`, ya montados en Radix. Ningún valor literal de color, radio o duración: todo token. Claro, oscuro y `prefers-reduced-motion` ya resueltos por `MotionConfig`. **Nota**: la navegación de la rejilla se implementa en un hook propio porque ni Radix ni las dependencias actuales traen un primitivo de rejilla, y el principio V exige Radix o React Aria para menú, diálogo, popover, selección y atajos, no para una rejilla de datos (R7). **Desvío declarado**: FR-001 reparte «Nueva tabla» por tres vías y FR-036 reparte las acciones de tabla por el menú contextual y el inspector; ver Complexity Tracking. |
| VI · Reversibilidad y confirmación | PASA | Las catorce acciones del incremento son deshacibles con etiqueta (FR-024, FR-033, FR-041), y escribir una celda entera es **un** paso (FR-024a, R8). Nada se escribe al archivo hasta Guardar. Eliminar una tabla o un campo con relaciones pide confirmación y dice qué se lleva (FR-019, FR-039); el último campo de una tabla no se elimina (FR-020). Los cinco estados de SC-010 tienen mensaje y salida, listados en `contracts/tables.md` §6. |
| VII · Estructura por capas | PASA | Nada fuera del árbol. El marco del panel inferior va a `src/components/layout/`, que la constitución señala como el único sitio de la estructura de ventana; su contenido, a `src/components/features/table/`. Geometría en `src/lib/canvas/`, catálogo y marcas en `src/lib/model/`, estado en `src/store/`. `invoke` sigue solo en `src/lib/tauri/`, y `scripts/check-layers.mjs` ya verifica las tres reglas. |
| VIII · Documentación JSDoc en español | PASA | Cada función pura, componente, hook, acción del almacén y campo de preferencias nuevo lleva su bloque en español; `///` en Rust para los dos campos. Se actualizan los bloques de `Field` en `types.ts`, de `TableCard`, de `schemaZones` y de `resolveLayout`, que cambian de comportamiento. |

### Puertas de calidad

| Puerta | Estado | Nota |
| ------ | ------ | ---- |
| 1 · `cargo check` y typecheck sin avisos nuevos | Aplica | Las cinco comprobaciones en cada tarea de cierre y en los dos sistemas por el workflow `puertas.yml`. |
| 2 · Pruebas del generador SQL por motor | No aplica | Este incremento no genera SQL (Clarifications, FR-029). Lo que sí tiene prueba por motor es el catálogo de tipos: `src/lib/model/engines.test.ts` cubre PostgreSQL, MySQL y SQLite. |
| 3 · Ida y vuelta de cargar y guardar | Aplica | `src/lib/model/roundtrip.test.ts` se amplía con un modelo que trae `length`, `scale`, `primaryKey`, `uniques` y `position`. |
| 4 · Atajo y entrada en la paleta de comandos | Parcial, justificado | Los once atajos del incremento están declarados en `research.md` R16 y en `contracts/tables.md` §4. La paleta de comandos sigue siendo de un incremento posterior: ver Complexity Tracking. |
| 5 · Revisión en claro, oscuro y movimiento reducido | Aplica | SC-011: diálogo Nueva tabla, panel de campos, inspector, Renombrar, menú contextual y las dos confirmaciones, en los tres estados, antes de cerrar. |
| 6 · Ningún artefacto copia el prototipo | Aplica | Del tablero `Editor` y de los componentes `TableForm`, `TableEditorPanel`, `RenameDialog`, `ContextMenu` y `ConfirmDialog` se toman medidas, textos y jerarquía; su HTML, su `support.js` y su `bundle.js` no entran al repositorio. Los ocho desvíos deliberados —seis de comportamiento y dos de texto— están en `research.md` R18. |
| 7 · Dirección de dependencias | Aplica | De `src/components/ui/` solo crecen piezas puras y sin estado: diez iconos en `Icon.tsx` y el `TextArea.tsx` que la descripción de la tabla necesita, que no conocen el almacén. El hook de la rejilla vive en `src/hooks/` y tampoco importa del almacén. `src/lib/` sigue sin importar de `src/components/`. |
| 8 · JSDoc en todo símbolo nuevo o modificado | Aplica | Incluye `Field.length` y `Field.scale`, las seis funciones puras nuevas, las catorce acciones del almacén y los dos campos de preferencias. |

**Resultado de la puerta (antes de la Fase 0)**: pasa, con los dos desvíos de
Complexity Tracking.

**Re-evaluación tras la Fase 1**: pasa. El diseño no introdujo violaciones
nuevas y cerró tres riesgos. El principio II queda reforzado porque las marcas
de llave se derivan de `primaryKey` y `uniques` en lugar de guardarse por campo
(R12) y porque `length` y `scale` son números en el archivo, sin texto que
parsear (R3). El principio IV queda reforzado porque el alto de la tarjeta es
una función pura del modelo y no una medida del DOM guardada en el almacén
(R1). Y el principio VI queda reforzado por la clave de fusión del historial,
que hace que un valor escrito sea un paso sin depender de temporizadores (R8).
Los dos desvíos siguen siendo los mismos de antes de la Fase 0, los dos
heredados de incrementos anteriores.

## Project Structure

### Documentation (this feature)

```text
specs/004-tablas-campos/
├── plan.md                     # Este archivo
├── research.md                 # Fase 0: 20 decisiones técnicas
├── data-model.md               # Fase 1: archivo, preferencias, sesión y geometría
├── quickstart.md               # Fase 1: cómo validar el incremento
├── contracts/
│   ├── tables.md               # Funciones puras, acciones, gestos, atajos, nombres accesibles y mensajes
│   ├── model.schema.json       # Forma del `.yaml`, formato 1 + fields[].length y fields[].scale
│   └── preferences.md          # Delta de `preferences.json`: snapToGrid y fieldsPanelHeight
├── checklists/
│   └── requirements.md         # Calidad del spec (ya existente, 17/17)
└── tasks.md                    # Fase 2 (`/speckit-tasks`, no lo crea este comando)
```

### Source Code (repository root)

```text
src-tauri/src/
└── preferences.rs              # + snapToGrid y fieldsPanelHeight, con serde(default) y recorte

src/
├── lib/
│   ├── canvas/
│   │   ├── constants.ts        # + tableHeight, TABLE_HEADER, FIELD_ROW_HEIGHT, GRID_SNAP; − TABLE_HEIGHT
│   │   ├── geometry.ts         # + zoneAt, snapToGrid, findFreeSpot; envolvente con alto variable (R1)
│   │   └── layout.ts           # Rejilla de las tablas sin posición, con el alto real de cada una
│   ├── model/
│   │   ├── types.ts            # + Field.length y Field.scale
│   │   ├── engines.ts          # Nuevo: catálogo de tipos, campo id y plantillas por motor (R2)
│   │   ├── marks.ts            # Nuevo: fieldMarks y relationsTouching (R12, R13)
│   │   ├── serialize.ts        # + length y scale en el orden del formato
│   │   ├── validate.ts         # + forma de length y scale, primaryKey no nulo, comment ≤ 280
│   │   └── parse.ts            # + lectura de los dos campos nuevos
│   ├── model/__fixtures__/     # + modelo-tipos-ajenos.yaml y longitud, escala y llaves en modelo-postgres.yaml
│   └── tauri/types.ts          # + los dos campos de Preferences y del parche
├── hooks/
│   ├── useGridNavigation.ts    # Nuevo: tabindex rotatorio de la rejilla (R7, FR-046a)
│   └── useCanvasView.ts        # La prioridad del pointerdown: tarjeta, zona, fondo
├── store/
│   ├── tables.ts               # Nuevo: crear, mover, renombrar, duplicar, eliminar y los campos
│   ├── fieldsPanel.ts          # Nuevo: panel abierto, alto y celda enfocada
│   ├── canvas.ts               # + selectedTable y selectTable (FR-007a)
│   ├── model.ts                # + HistoryStep.coalesceKey y la fusión de pasos (R8)
│   ├── preferences.ts          # + snapToGrid y fieldsPanelHeight
│   └── index.ts                # + las dos partes nuevas
├── components/
│   ├── ui/
│   │   ├── Icon.tsx            # + diez iconos de Lucide para los menús y la rejilla
│   │   └── TextArea.tsx        # Nuevo: campo de varias líneas con cuenta de caracteres (FR-043)
│   ├── layout/
│   │   ├── BottomPanel.tsx     # Nuevo: marco del panel, tirador y alto 200–560 (FR-022)
│   │   ├── EditorLayout.tsx    # + el panel inferior entre el lienzo y la barra de estado
│   │   ├── EditorChrome.tsx    # + «+ Tabla» y el botón del panel de campos
│   │   ├── ModelSidebar.tsx    # + selección de tabla desde su fila y su menú contextual
│   │   ├── Inspector.tsx       # + ficha de la tabla seleccionada (FR-042 a FR-045)
│   │   └── StatusBar.tsx       # El contador de tablas pasa a moverse de verdad
│   └── features/
│       ├── table/
│       │   ├── TableDialog.tsx         # Nueva tabla, con vista previa (FR-003 a FR-009)
│       │   ├── FieldsGrid.tsx          # Las nueve columnas y su navegación (FR-010 a FR-021)
│       │   ├── FieldsPanelHeader.tsx   # Nombre, contador, Plantillas y Añadir campo (FR-027)
│       │   ├── FieldTemplatesMenu.tsx  # Los cuatro grupos, con los ya aplicados apagados
│       │   ├── TableContextMenu.tsx    # Editar campos, Renombrar, Duplicar, Mover, Eliminar
│       │   ├── RenameTableDialog.tsx   # Con el nombre técnico a la vista (FR-037)
│       │   ├── DeleteTableDialog.tsx   # Confirmación con el conteo de relaciones (FR-039)
│       │   └── DeleteFieldDialog.tsx   # Confirmación cuando una relación usa el campo (FR-019)
│       ├── canvas/
│       │   ├── TableCard.tsx       # Pasa a listar campos con sus marcas y a arrastrarse
│       │   ├── CanvasSurface.tsx   # + doble clic, arrastre de tabla y zoneAt al soltar
│       │   ├── EmptyModelCard.tsx  # «Crear la primera tabla» pasa a abrir el diálogo
│       │   └── Minimap.tsx         # Usa el alto variable de cada tarjeta
│       └── preferences/
│           └── PreferencesWindow.tsx  # + «Ajustar a la cuadrícula» (FR-032)
└── styles/
    └── screens.css             # + filas de tarjeta, marcas de llave, rejilla y tirador del panel

e2e/
├── wdio.conf.js                # + el modelo del recorrido en la carpeta temporal
├── soporte/modelo-tablas.yaml  # Tres esquemas, una tabla de 40 campos y dos relaciones
└── specs/10-tablas-y-campos.e2e.js
```

**Structure Decision**: se mantiene el árbol que fija la constitución y no nace
ninguna carpeta de primer nivel. Una apertura dentro de las que ya existen,
`src/components/features/table/`, para el dominio de la tabla y sus campos, al
lado de `features/schema/` del Incremento 2. El panel inferior se parte a
propósito en dos: su marco en `layout/`, que es donde la constitución pone la
estructura de ventana —y donde ya viven la barra lateral y el inspector—, y su
contenido en `features/table/`, porque los campos son dominio. Las dos partes
nuevas del almacén siguen el reparto por dominio que `src/store/` ya usa.

## Complexity Tracking

| Violación | Por qué hace falta | Alternativa más simple, y por qué se descarta |
| --------- | ------------------ | --------------------------------------------- |
| Principio V: una misma acción en varias zonas. FR-001 ofrece «Nueva tabla» en la barra superior, con la tecla `T` y con doble clic en el lienzo; FR-036 ofrece renombrar, duplicar y eliminar en el menú contextual de la tarjeta, en la fila de la barra lateral y en las acciones del inspector | Las tres vías de creación son la misma acción en sus tres gramáticas: el botón para quien busca con la vista, la tecla para quien ya sabe, y el doble clic porque es lo único que permite decir *dónde* va la tabla, que es FR-006. Las acciones de tabla son el mismo menú del mismo objeto en sus dos representaciones —tarjeta y fila—, más el inspector, que FR-006 del Incremento 2 permite dejar como única zona visible | Dejar solo el botón de la barra superior: la tabla nacería siempre en el centro y colocarla sería un segundo gesto obligatorio. Dejar las acciones solo en el menú contextual de la tarjeta: con el lienzo lleno y la tabla fuera de vista habría que buscarla para renombrarla, cuando la barra lateral ya la lista |
| Puerta 4 incompleta: las acciones de este incremento tienen atajo pero ninguna tiene entrada en la paleta de comandos | La paleta (D-09) es de un incremento posterior, igual que en los Incrementos 1 y 2. Los once atajos del incremento sí están declarados, y `T`, ⌘D y ⌫ son los del tablero | Adelantar la paleta de comandos: es una pantalla entera con su propio alcance y arrastra el buscador del modelo, que tampoco es de aquí |
