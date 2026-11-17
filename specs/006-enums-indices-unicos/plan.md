# Implementation Plan: Enums, índices y únicos (Incremento 5)

**Branch**: `006-enums-indices-unicos` | **Date**: 2026-11-17 | **Spec**:
[`spec.md`](./spec.md)

**Input**: Feature specification from `/specs/006-enums-indices-unicos/spec.md`

## Summary

El modelo se completa con tres cosas que el archivo ya sabía guardar y ninguna
pantalla sabía crear. Son 48 requisitos en cuatro historias: crear y editar
enums (P1), renombrar y eliminar enums en uso (P2), índices (P3) y únicos
compuestos (P4).

El enfoque técnico, resuelto en la Fase 0, cabe en seis frases. Un campo usa un
enum por su nombre, y una sola función dice si un tipo es del motor, un enum o
desconocido (R1); por eso renombrar un enum es una única escritura que cambia el
enum y el tipo de sus campos a la vez (R2), y eliminarlo, otra que los pasa al
tipo de reemplazo que da el catálogo del motor (R3). La hoja del enum es un
borrador local que no toca el almacén hasta confirmar, y es ella —no el
validador del archivo— quien aplica las reglas nuevas (R4, R5). Los índices y
los únicos se editan en dos fichas del panel inferior cuyas acciones nunca dejan
el modelo inválido: nacen completos y un cambio inválido no llega al almacén
(R11). Todo lo que se puede deducir se deduce: los índices automáticos, si un
nombre es el propuesto, quién usa un enum (R9, R10, R19). La cardinalidad
aprende del índice único en la función que ya era su única fuente (R14). Y
eliminar un campo deja de convertir un único compuesto en una regla más estricta
(R15).

El archivo del modelo gana un solo dato: la marca `unique` del índice, opcional
y ausente por defecto, así que la versión **no** sube (R8). La frontera con Rust
crece en dos campos de preferencias sobre un comando que ya existe (R17). **No
hay dependencias nuevas**: el selector de varias columnas se monta sobre el menú
de Radix que el proyecto ya trae (R12).

## Technical Context

**Language/Version**: TypeScript 5.6 en modo `strict` (React 18.3) y Rust 1.75+
(edición 2021) para los dos campos de preferencias.

**Primary Dependencies**: Tauri 2.12.5, React 18, Zustand 4.5, Radix UI,
Tailwind 3.4 sobre los tokens de `src/styles/tokens.css`, `yaml` 2.9. **Ninguna
dependencia nueva**: `MultiSelect` se construye sobre
`@radix-ui/react-dropdown-menu`, ya instalado (R12).

**Storage**: el archivo `.yaml` del modelo (formato 1, sin subir de versión, con
`unique` opcional en cada índice) y `preferences.json` en el directorio de
configuración, propiedad de Rust.

**Testing**: Vitest 2.1 sobre jsdom con Testing Library para las funciones
puras, el almacén y los componentes; WebdriverIO 10 con `@wdio/tauri-service`
para el recorrido sobre la aplicación real, donde van la demostración completa,
guardar y reabrir, y la medida de SC-011 (R20).

**Target Platform**: Windows 10+ (WebView2) y macOS 12+ (WebKit), el mismo
diseño en los dos.

**Performance Goals**: renombrar un enum usado por 100 campos en un modelo de 50
tablas se ve en pantalla en menos de 200 ms (SC-011). Las demás acciones son
escrituras de una tabla y no tienen cifra propia.

**Constraints**: todo enum pertenece a un esquema; los índices no llevan método;
el tipo de reemplazo al eliminar un enum es fijo; un único compuesto tiene
siempre dos o más columnas y un índice al menos una; los nombres de índices y
únicos no se repiten en todo el modelo; nada se escribe al archivo hasta
Guardar; todo alcanzable con el teclado y con contraste ≥ 4,5:1 en texto.

**Scale/Scope**: una pantalla que crece (el Editor), una hoja nueva con su
confirmación, una sección nueva en la barra lateral con su menú contextual, dos
fichas nuevas en el panel inferior, un grupo nuevo en Ajustes, dos partes nuevas
del almacén, dos módulos de funciones puras nuevos que suman veinte funciones,
un componente puro nuevo, 48 requisitos funcionales, modelos de hasta ~200
tablas y unas decenas de enums.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Principios

| Principio | Estado | Cómo se cumple |
| --------- | ------ | -------------- |
| I · Modelado local sin conexión | PASA | Sin red, sin telemetría, sin driver de base de datos. Ninguna dependencia nueva. |
| II · El archivo del modelo es la única fuente de verdad | PASA, reforzado | Enums, índices y únicos viajan en las secciones que el formato 1 ya declara (FR-042); el serializador sigue siendo uno y escribe las claves en su orden fijo. Cinco cosas se **deducen** y no se guardan: los índices automáticos (R9), si un nombre es el propuesto (R10), qué campos usan un enum (R19), la cardinalidad (R14) y el estado del índice de una clave foránea. El validador del archivo no se endurece, así que ningún archivo válido deja de serlo (R4). Los prefijos son preferencias de quien modela, no del modelo (R17). La hoja del enum no muestra SQL: el generador único llega con Exportar (R22). |
| III · Frontera Rust ↔ TypeScript explícita | PASA | La frontera crece en dos campos de `preferences_update`, un comando que ya existe; ningún comando nuevo y ningún permiso nuevo en `capabilities/`. Ninguna acción bloquea la interfaz: todas son escrituras al almacén. |
| IV · Tipado estricto y estado único | PASA | Sin `any` ni `@ts-ignore`. Dos partes nuevas del almacén único (`src/store/enums.ts`, `src/store/indexes.ts`), ningún gestor paralelo. Los tipos del modelo siguen siendo unos solos en `src/lib/model/types.ts`, donde `Index` extiende a `NamedFields`. El borrador de la hoja y el de una celda de nombre son estado efímero de formulario y se quedan en el componente (R5, R11). |
| V · Sistema de diseño por tokens | PASA | La hoja es el `Sheet` que ya existe; las fichas, el `Tabs` del Incremento 4; el menú contextual, el `ContextMenu` puro. La única pieza nueva de `ui/` es `MultiSelect`, sobre el menú con casillas de Radix, que es de donde salen el foco, los roles y el teclado (R12). Ningún valor literal: el tinte del enum es el token `purple` del tablero. |
| VI · Reversibilidad y confirmación | PASA, reforzado | Las trece acciones del incremento son deshacibles con etiqueta (FR-041). Eliminar un enum confirma siempre y dice qué campos cambian y a qué tipo (FR-016, RS-08); eliminar un índice o un único no confirma —no arrastra nada y se deshace en un paso—. Eliminar un campo pasa a nombrar los índices y únicos que se lleva, y deja de crear en silencio una regla más estricta (R15). Los nueve estados de SC-009 tienen mensaje y salida, listados en `contracts/enums.md` §5 y `contracts/indexes.md` §5. |
| VII · Estructura por capas | PASA | Nada fuera del árbol. Dominio en `src/lib/model/enums.ts` e `indexes.ts`, estado en `src/store/`, la hoja y su menú en una carpeta nueva `src/components/features/enum/` —al lado de `schema/` y `table/`—, las dos fichas en `features/table/`, el selector en `ui/`. `invoke` sigue solo en `src/lib/tauri/`, y `scripts/check-layers.mjs` ya verifica las tres reglas. |
| VIII · Documentación JSDoc en español | PASA | Bloque en español en cada función pura, componente, acción del almacén y campo nuevo; `///` en Rust para los dos campos. Se actualizan los bloques de `cardinalityOf` (cuenta el índice único), `removeFieldFromKeys` (cambia de comportamiento), `typeTraits` y `FieldsGrid` (dejan de avisar de un enum), `BottomPanel` (cuatro fichas), `ModelSidebar` (sección nueva), `deleteSchema` (retipa) y `EmptyModelCard` (la entrada deja de ser futura). |

### Puertas de calidad

| Puerta | Estado | Nota |
| ------ | ------ | ---- |
| 1 · `cargo check` y typecheck sin avisos nuevos | Aplica | Las cinco comprobaciones en cada tarea de cierre y en los dos sistemas por el workflow `puertas.yml`. |
| 2 · Pruebas del generador SQL por motor | No aplica | Este incremento no genera SQL: los enums, los índices y los únicos se guardan y se ven, y su `CREATE TYPE`, `CREATE INDEX` y `UNIQUE` son del incremento de exportación (Assumptions). |
| 3 · Ida y vuelta de cargar y guardar | Aplica | `src/lib/model/roundtrip.test.ts` se amplía con `modelo-enums.yaml`: dos enums con el orden de sus valores, un índice de dos columnas, otro con `unique: true` y un único compuesto. Y se comprueba que los modelos anteriores, sin `unique`, salen idénticos. |
| 4 · Atajo y entrada en la paleta de comandos | Parcial, justificado | Ninguna de las trece acciones nuevas gana atajo: el tablero no le da ninguno a «Nuevo enum», y las demás —duplicar y eliminar un enum, y añadir, cambiar y eliminar índices y únicos— son acciones de fila o de menú contextual, que se alcanzan con el teclado dentro de su rejilla o de su menú, como las de campos y claves foráneas. La paleta de comandos sigue siendo de un incremento posterior: ver Complexity Tracking. |
| 5 · Revisión en claro, oscuro y movimiento reducido | Aplica | SC-010: la hoja del enum con sus errores, la sección «Enums», el menú contextual, la confirmación, las dos fichas y el grupo «Nombres» de Ajustes, en claro y en oscuro. El incremento no añade animaciones propias; las de la hoja y el menú son las de sus componentes, que ya respetan «Reducir movimiento». |
| 6 · Ningún artefacto copia el prototipo | Aplica | Del tablero `Editor` —componentes `EnumForm`, `ContextMenu`, `ConfirmDialog`, `TableEditorPanel` en sus variantes `indices` y `unicos`, y `PreferencesWindow`— se toman medidas, textos y jerarquía; su HTML, su `support.js` y su `bundle.js` no entran al repositorio. Los ocho desvíos deliberados están en `research.md` R22. |
| 7 · Dirección de dependencias | Aplica | De `src/components/ui/` solo crece una pieza pura: `MultiSelect.tsx`, que no conoce el almacén. `src/lib/` sigue sin importar de `src/components/`. |
| 8 · JSDoc en todo símbolo nuevo o modificado | Aplica | Incluye el tipo `Index`, las veinte funciones puras —diecinueve nuevas y `cardinalityOf`, que amplía su regla—, las trece acciones del almacén, `removeFieldFromKeys`, `deleteSchema` y los dos campos de preferencias. |

**Resultado de la puerta (antes de la Fase 0)**: pasa, con el desvío de
Complexity Tracking.

**Re-evaluación tras la Fase 1**: pasa. El diseño no introdujo violaciones
nuevas y cerró tres riesgos. El principio II queda reforzado porque las reglas
nuevas viven en la hoja y no en el validador (R4), de modo que ningún archivo
existente deja de abrirse, y porque la marca `unique` se omite cuando es falsa,
de modo que ningún archivo existente cambia al guardarse (R8). El principio VI
queda reforzado porque el diálogo de eliminar un campo y la acción leen la misma
función, así que lo anunciado es lo que ocurre (R15). Y el principio IV queda
reforzado porque el modelo en memoria no puede quedar inválido por una fila a
medio rellenar (R11).

## Project Structure

### Documentation (this feature)

```text
specs/006-enums-indices-unicos/
├── plan.md                     # Este archivo
├── research.md                 # Fase 0: 22 decisiones técnicas
├── data-model.md               # Fase 1: archivo, preferencias, sesión y lo que se deduce
├── quickstart.md               # Fase 1: cómo validar el incremento
├── contracts/
│   ├── enums.md                # Funciones puras, acciones, entradas, nombres accesibles y mensajes
│   ├── indexes.md              # Lo mismo para índices y únicos, y las dos fichas
│   ├── model.schema.json       # Forma del `.yaml`, formato 1 + `unique` en el índice
│   └── preferences.md          # Delta de `preferences.json`: los dos prefijos
├── checklists/
│   └── requirements.md         # Calidad del spec (ya existente, 16/16)
└── tasks.md                    # Fase 2 (`/speckit-tasks`, no lo crea este comando)
```

### Source Code (repository root)

```text
src-tauri/src/
└── preferences.rs              # + indexPrefix y uniquePrefix, con su saneado (R17)

src/
├── lib/
│   ├── model/
│   │   ├── types.ts            # + Index (NamedFields con `unique`); Table.indexes pasa a Index[] (R8)
│   │   ├── enums.ts            # Nuevo: clase de tipo, uso, validación de la hoja, renombrado y borrado (R1 a R4, R19)
│   │   ├── indexes.ts          # Nuevo: automáticos, propuestas, nombres y dependientes de un campo (R9, R10, R13, R15)
│   │   ├── marks.ts            # cardinalityOf cuenta el índice único de una columna (R14)
│   │   ├── parse.ts            # + `unique` del índice
│   │   ├── serialize.ts        # + `unique`, solo cuando es `true`
│   │   ├── validate.ts         # + `unique` permitido en indexes[] y rechazado en uniques[]
│   │   └── __fixtures__/       # + modelo-enums.yaml; + un enum usado por 100 campos en modelo-50-tablas.yaml
│   └── tauri/types.ts          # + los dos campos de Preferences y del parche
├── store/
│   ├── enums.ts                # Nuevo: las cuatro acciones del enum y sus dos diálogos (R5, R7)
│   ├── indexes.ts              # Nuevo: las nueve acciones de índices y únicos (R7, R11)
│   ├── navigation.ts           # + los diálogos 'enum' y 'delete-enum'
│   ├── fieldsPanel.ts          # PanelTab gana 'indexes' y 'uniques'
│   ├── tables.ts               # removeFieldFromKeys aplica fieldDependents (R15); setFieldKey nombra con el prefijo (R13)
│   ├── schemas.ts              # deleteSchema retipa con dropEnums (R16)
│   ├── preferences.ts          # + los dos campos nuevos
│   └── index.ts                # + las dos partes nuevas
├── components/
│   ├── ui/
│   │   ├── MultiSelect.tsx     # Nuevo: selector de varias columnas con orden de elección (R12)
│   │   └── Icon.tsx            # + tags, lock y los que pida la hoja
│   ├── layout/
│   │   ├── ModelSidebar.tsx    # + la sección «Enums» con su contador y su filtro (R18)
│   │   └── BottomPanel.tsx     # Cuatro fichas: Campos · Índices · Claves foráneas · Únicos
│   └── features/
│       ├── enum/
│       │   ├── EnumDialog.tsx          # La hoja «Nuevo enum» / «Editar enum» (FR-001 a FR-013)
│       │   ├── DeleteEnumDialog.tsx    # La confirmación con los campos y el tipo (FR-016 a FR-018)
│       │   └── EnumContextMenu.tsx     # Editar, Duplicar y Eliminar (FR-020)
│       ├── table/
│       │   ├── IndexesTab.tsx          # Los dos bloques de «Índices» (FR-021 a FR-030)
│       │   ├── UniquesTab.tsx          # Los dos bloques de «Únicos» (FR-032 a FR-038)
│       │   ├── FieldsGrid.tsx          # El selector de tipo ofrece los enums; sin longitud ni escala (FR-011)
│       │   └── DeleteFieldDialog.tsx   # Nombra los índices y únicos que se lleva (FR-039)
│       ├── schema/
│       │   └── DeleteSchemaDialog.tsx  # Dice qué campos de fuera se retipan (FR-019)
│       ├── canvas/
│       │   └── EmptyModelCard.tsx      # «Definir un enum» deja de estar anunciada (FR-001)
│       ├── editor/
│       │   └── EditorScreen.tsx        # Monta las dos fichas y los dos diálogos
│       └── preferences/
│           └── PreferencesWindow.tsx   # + el grupo «Nombres» con los dos prefijos (FR-043)
├── hooks/
│   └── useGridNavigation.ts    # Se reutiliza tal cual para las dos rejillas
└── styles/
    └── screens.css             # + filas de valor de la hoja, líneas de solo lectura y las dos rejillas

e2e/
├── soporte/modelo-enums.yaml           # Dos esquemas, cuatro tablas, dos enums, un índice y un único
└── specs/12-enums-indices-unicos.e2e.js

.github/workflows/
└── recorrido.yml                       # El job pasa a nombrar los trece escenarios
```

**Structure Decision**: se mantiene el árbol que fija la constitución. Nace una
sola carpeta, `src/components/features/enum/`, del mismo nivel que `schema/` y
`table/`, porque el enum es el tercer objeto del modelo con hoja, confirmación y
menú propios. Las dos fichas nuevas entran en `features/table/`, junto a la de
campos y la de claves foráneas: son la misma tabla vista de otra manera. El
dominio se reparte en dos módulos y no en uno porque los enums son del modelo y
los índices de la tabla, y ninguno necesita al otro.

## Complexity Tracking

| Violación | Por qué hace falta | Alternativa más simple, y por qué se descarta |
| --------- | ------------------ | --------------------------------------------- |
| Puerta 4 incompleta: «Nuevo enum…» no tiene entrada en la paleta de comandos y la paleta no lista los enums, como dibuja el tablero | La paleta (D-09) es de un incremento posterior, igual que en los Incrementos 1 a 4, y el spec lo deja fuera en Assumptions («Sin paleta de comandos»). Las acciones que la paleta llamará —`openEnumDialog(null)` y `openEnumDialog(nombre)`— quedan hechas y probadas; las dos entradas de FR-001 sí entran | Adelantar la paleta de comandos: es una pantalla entera con su propio alcance y arrastra el buscador del modelo, que tampoco es de aquí (R21) |
