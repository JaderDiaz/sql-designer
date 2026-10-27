# Implementation Plan: Lienzo y esquemas (Incremento 2)

**Branch**: `003-lienzo-esquemas` | **Date**: 2026-10-27 | **Spec**:
[`spec.md`](./spec.md)

**Input**: Feature specification from `/specs/003-lienzo-esquemas/spec.md`

## Summary

El Editor pasa de una tarjeta informativa a un espacio de trabajo de cinco
zonas, con un lienzo que se recorre y un modelo organizado en esquemas de color.
Son 46 requisitos repartidos en seis historias: el marco del Editor (P1), crear
y editar esquemas (P2), las zonas en el lienzo (P3), navegar (P4), enfocar (P5)
y eliminar (P6).

El enfoque técnico, resuelto en la Fase 0, cabe en cuatro frases. El lienzo es
DOM posicionado dentro de un único nodo transformado, así que mover la vista y
hacer zoom no vuelven a pintar las tarjetas (R1, R19). La geometría —dónde cae
cada tabla, qué rectángulo es cada zona, qué vista deja todo a la vista— son
funciones puras sin DOM en `src/lib/canvas/`, probables en Vitest (R4, R5, R10).
Los gestos se pintan sobre el nodo con una referencia y escriben al almacén
cuando terminan, de modo que un arrastre entero es un paso de deshacer (R3,
R16). Y el formato del archivo gana un único campo opcional,
`schemas[].position`, que solo existe mientras el esquema no tiene tablas (R6),
así que la versión del formato no cambia y los archivos ya guardados siguen
siendo válidos.

Este incremento es casi todo frontend: la frontera con Rust solo crece en dos
booleanos de preferencias para recordar qué zonas quedaron escondidas (R15).

## Technical Context

**Language/Version**: TypeScript 5.6 en modo `strict` (React 18.3) y Rust 1.75+
(edición 2021) para los dos campos de preferencias.

**Primary Dependencies**: Tauri 2.12.5, React 18, Zustand 4.5, Radix UI,
Tailwind 3.4 sobre los tokens de `src/styles/tokens.css`, Framer Motion 11,
`yaml` 2.9. **Nueva**: `@radix-ui/react-switch` para el interruptor de la
confirmación de eliminar (R14). Ninguna dependencia nueva de Rust.

**Storage**: el archivo `.yaml` del modelo (formato 1, sin subir de versión) y
`preferences.json` en el directorio de configuración, propiedad de Rust.

**Testing**: Vitest 2.1 sobre jsdom con Testing Library para lo puro, el almacén
y los componentes; WebdriverIO 10 con `@wdio/tauri-service` para el recorrido
sobre la aplicación real, donde van los gestos de puntero y de rueda (R17).

**Target Platform**: Windows 10+ (WebView2) y macOS 12+ (WebKit), el mismo
diseño en las dos.

**Project Type**: aplicación de escritorio Tauri; frontend en `src/`, backend en
`src-tauri/`.

**Performance Goals**: 60 cuadros por segundo mientras se arrastra, se mueve la
vista o se hace zoom en un modelo de 50 tablas y 60 relaciones, con respuesta al
primer gesto por debajo de 100 ms (SC-003); centrar un esquema en menos de 1 s
(SC-005).

**Constraints**: zoom entre 40 % y 200 %; la vista y el foco nunca se escriben
en el archivo; abrir un modelo sin posiciones no lo marca «Editado»; todo
alcanzable con el teclado y con contraste ≥ 4,5:1 en los dos temas; con
«Reducir movimiento» el resultado llega sin animación.

**Scale/Scope**: una pantalla (el Editor con sus cinco zonas), dos diálogos
(esquema y confirmación de eliminar), un menú contextual, tres piezas nuevas de
lienzo (zonas, tarjetas de tabla, minimapa y barra de zoom), una parte nueva del
almacén, 46 requisitos funcionales, modelos de hasta ~200 tablas.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Principios

| Principio | Estado | Cómo se cumple |
| --------- | ------ | -------------- |
| I · Modelado local sin conexión | PASA | La única dependencia nueva, `@radix-ui/react-switch`, es un primitivo de interfaz: no habla por red. Sin drivers, sin telemetría, sin HTTP; el minimapa y el lienzo pintan lo que hay en memoria. |
| II · El archivo del modelo es la única fuente de verdad | PASA | Las posiciones y los colores que este incremento cambia viajan en el `.yaml` (FR-044). El serializador sigue siendo uno; el campo nuevo se escribe en su orden fijo y la ida y vuelta se prueba con un modelo que trae posición de esquema vacío (puerta 3). La vista y el foco **no** son del modelo y por eso no se escriben (FR-014, FR-032). |
| III · Frontera Rust ↔ TypeScript explícita | PASA | La frontera solo crece en dos booleanos de `preferences_update`, un comando que ya existe; no hay comandos nuevos ni permisos nuevos en `capabilities/`. El frontend no asume rutas ni separadores: no toca el disco. Ningún trabajo nuevo bloquea la interfaz (FR-045): el arrastre y el zoom van en el hilo de composición del navegador. |
| IV · Tipado estricto y estado único | PASA | Sin `any` ni `@ts-ignore`. La vista, el foco y la disposición entran en una parte nueva del almacén único (`src/store/canvas.ts`), no en un contexto ni en un segundo gestor (R2). Las zonas no se guardan: se derivan con funciones puras, así que no hay estado derivado duplicado (R4). El hover y el gesto en curso son estado efímero y se quedan en el componente, salvo el `isGesturing` que el lienzo necesita leer para pintar sin sombras. |
| V · Sistema de diseño por tokens | PASA | Los dos componentes nuevos (`Switch` sobre Radix, `ColorSwatches` sobre `@radix-ui/react-radio-group`) van en `src/components/ui/`, puros. La paleta son once identificadores de token, nunca un valor de color literal (R7); los rellenos y bordes de zona se declaran una vez en `src/styles/` con `color-mix` sobre el token del esquema. Menú contextual y diálogos sobre Radix: ni foco ni ARIA a mano. Claro, oscuro y `prefers-reduced-motion` ya resueltos por `MotionConfig`. **Desvío declarado**: FR-015 reparte «Nuevo esquema» por tres sitios y FR-033 «Eliminar…» por dos, contra la regla de no duplicar una acción en dos zonas; ver Complexity Tracking. |
| VI · Reversibilidad y confirmación | PASA | Crear, editar, eliminar y mover son deshacibles en un solo paso con etiqueta (FR-022, FR-027, FR-037, R16). Nada se escribe al archivo hasta Guardar. Eliminar pide confirmación, dice cuántas tablas quedan afectadas y deja elegir a dónde van (FR-034, FR-036); el último esquema no se elimina (FR-035). Los cuatro estados del incremento —modelo sin tablas, esquema sin tablas, nombre repetido, último esquema— tienen mensaje y salida (SC-009). |
| VII · Estructura por capas | PASA | Nada fuera del árbol: lienzo, zonas, minimapa y diálogos en `src/components/features/`, el marco de cinco zonas en `src/components/layout/`, geometría en `src/lib/canvas/`, estado en `src/store/`. `invoke` sigue solo en `src/lib/tauri/`; lo verifica `scripts/check-layers.mjs`, ya en `npm run lint`, que además gana aquí la regla de que `src/lib/` no importe de `src/components/` (T031a). |
| VIII · Documentación JSDoc en español | PASA | Cada función pura, componente, acción del almacén y campo de preferencias nuevo lleva su bloque en español; `///` en Rust para los dos campos. |

### Puertas de calidad

| Puerta | Estado | Nota |
| ------ | ------ | ---- |
| 1 · `cargo check` y typecheck sin avisos nuevos | Aplica | Las cinco puertas en cada tarea de cierre, y en los dos sistemas por el workflow `puertas.yml`. |
| 2 · Pruebas del generador SQL por motor | No aplica | Este incremento no genera SQL. El esquema se crea, se edita y se elimina en el modelo; `CREATE SCHEMA` es del incremento de exportación. |
| 3 · Ida y vuelta de cargar y guardar | Aplica | Se amplía `src/lib/model/roundtrip.test.ts` con un modelo que trae `schemas[].position` y `tables[].position`. |
| 4 · Atajo y entrada en la paleta de comandos | Parcial, justificado | Los atajos de vista, zoom, disposición y foco están declarados en `contracts/canvas.md`. «Nuevo esquema» no recibe tecla y la paleta de comandos no existe todavía: ver Complexity Tracking. |
| 5 · Revisión en claro, oscuro y movimiento reducido | Aplica | SC-010: Editor, diálogo de esquema y confirmación, en los tres estados, antes de cerrar. |
| 6 · Ningún artefacto copia el prototipo | Aplica | Del tablero `Editor` se toman medidas, textos y jerarquía; su HTML, su `support.js` y su `bundle.js` no entran al repositorio. Los tres desvíos deliberados están anotados en `research.md` R20. |
| 7 · Dirección de dependencias | Aplica, con una regla nueva | `Switch` y `ColorSwatches` no importan del almacén ni de `features`, lo que `scripts/check-layers.mjs` ya verifica. Que la geometría de `src/lib/canvas/` no importe de componentes **no** lo comprobaba nadie: el script gana esa tercera regla en este incremento (T031a). |
| 8 · JSDoc en todo símbolo nuevo o modificado | Aplica | Incluye `Schema.position` en `src/lib/model/types.ts` y los símbolos de `parse.ts` y `serialize.ts` que cambian. |

**Resultado de la puerta (antes de la Fase 0)**: pasa, con el desvío de
Complexity Tracking.

**Re-evaluación tras la Fase 1**: pasa. El diseño no introdujo violaciones
nuevas y cerró dos riesgos. El principio II queda reforzado porque la poda de
`schemas[].position` ocurre al leer, no al escribir, de modo que el modelo en
memoria nunca contiene un dato que el archivo no deba llevar (R6) y la puerta 3
sigue comparando textos iguales. El principio IV queda reforzado porque las
zonas se derivan en lugar de guardarse: no hay un segundo sitio donde la
geometría pueda discrepar del modelo. El único desvío sigue siendo el de la
paleta de comandos, heredado del Incremento 1.

## Project Structure

### Documentation (this feature)

```text
specs/003-lienzo-esquemas/
├── plan.md                     # Este archivo
├── research.md                 # Fase 0: 20 decisiones técnicas
├── data-model.md               # Fase 1: archivo, preferencias, sesión y geometría
├── quickstart.md               # Fase 1: cómo validar el incremento
├── contracts/
│   ├── canvas.md               # Funciones puras, acciones, gestos, atajos y nombres accesibles
│   ├── model.schema.json       # Forma del `.yaml`, versión 1 + schemas[].position
│   └── preferences.md          # Delta de `preferences.json`: dos booleanos
├── checklists/
│   └── requirements.md         # Calidad del spec (ya existente, 16/16)
└── tasks.md                    # Fase 2 (`/speckit-tasks`, no lo crea este comando)
```

### Source Code (repository root)

```text
src-tauri/src/
└── preferences.rs              # + sidebarHidden e inspectorHidden, con serde(default)

src/
├── lib/
│   ├── canvas/
│   │   ├── constants.ts        # Medidas de diseño y topes de zoom
│   │   ├── layout.ts           # resolveLayout: posición de cada tabla (FR-013)
│   │   ├── geometry.ts         # schemaZones, contentBounds (FR-023 a FR-026a)
│   │   └── zoom.ts             # clampZoom, zoomAt, fitToContent (FR-008 a FR-011)
│   ├── model/
│   │   ├── types.ts            # + Schema.position
│   │   ├── parse.ts            # + lectura y poda de schemas[].position
│   │   ├── serialize.ts        # + schemas[].position en su orden
│   │   ├── validate.ts         # + forma de la posición del esquema
│   │   ├── colors.ts           # Paleta de once colores con nombre (FR-021)
│   │   └── propose.ts          # toTechnicalName, toAbbreviation (FR-016)
│   └── tauri/types.ts          # + los dos campos de Preferences y del parche
├── store/
│   ├── canvas.ts               # Vista, foco, selección y disposición (FR-006, FR-014, FR-029 a FR-032)
│   ├── schemas.ts              # createSchema, updateSchema, deleteSchema, moveSchema
│   └── index.ts                # + las dos partes nuevas
├── components/
│   ├── ui/
│   │   ├── Switch.tsx          # Interruptor sobre Radix (FR-034)
│   │   └── ColorSwatches.tsx   # Paleta como grupo de radio (FR-019)
│   ├── layout/
│   │   ├── EditorLayout.tsx    # Las cinco zonas, con las dos escondibles (FR-001, FR-006)
│   │   ├── EditorChrome.tsx    # + botones de disposición, zoom y Ajustar
│   │   ├── ModelSidebar.tsx    # Esquemas y tablas, con el filtro del foco (FR-002, FR-030)
│   │   ├── Inspector.tsx       # Datos del esquema seleccionado, o sin selección (FR-003)
│   │   └── StatusBar.tsx       # Motor, estado del archivo, zoom y contadores (FR-004)
│   └── features/
│       ├── canvas/
│       │   ├── CanvasSurface.tsx   # El nodo transformado y los gestos (FR-007 a FR-009)
│       │   ├── SchemaZone.tsx      # Una zona con su rótulo (FR-023 a FR-025)
│       │   ├── TableCard.tsx       # Tarjeta compacta de tabla, solo dibujo
│       │   ├── Minimap.tsx         # Minimapa y su recuadro (FR-012)
│       │   ├── ZoomBar.tsx         # −, porcentaje, +, Ajustar (FR-008, FR-010)
│       │   └── EmptyModelCard.tsx  # La tarjeta de inicio, extraída de EditorScreen (FR-005)
│       ├── schema/
│       │   ├── SchemaDialog.tsx        # Nuevo y Editar esquema (FR-015 a FR-022)
│       │   ├── DeleteSchemaDialog.tsx  # Confirmación con interruptor y destino (FR-034 a FR-037)
│       │   └── SchemaContextMenu.tsx   # Editar y Eliminar (FR-033, FR-035)
│       └── editor/
│           └── EditorScreen.tsx    # Pasa a orquestar el layout y el lienzo
├── styles/
│   └── screens.css             # + clases de zona, tarjeta, minimapa y barra de zoom
└── tailwind.config.js          # + tokens de color pink, yellow, brown y gray

e2e/
├── soporte/                    # + modelo-esquemas.yaml
└── specs/09-lienzo-y-esquemas.e2e.js
```

**Structure Decision**: se mantiene el árbol del proyecto tal como lo fija la
constitución y no nace ninguna carpeta de primer nivel. Dos aperturas dentro de
las que ya existen: `src/lib/canvas/` para la geometría pura —no es modelo, así
que no cabe en `src/lib/model/`, y no es componente— y
`src/components/features/canvas/` y `.../schema/` para el dominio del lienzo y
de los esquemas. El marco de cinco zonas va a `src/components/layout/`, que la
constitución señala como el único sitio donde vive la estructura de ventana; el
`EditorChrome` que el Incremento 1 dejó allí se amplía en lugar de duplicarse.

## Complexity Tracking

| Violación | Por qué hace falta | Alternativa más simple, y por qué se descarta |
| --------- | ------------------ | --------------------------------------------- |
| Principio V: una misma acción en varias zonas. FR-015 ofrece «Nuevo esquema» en la barra lateral, en la barra superior y en la tarjeta del modelo vacío; FR-033 ofrece «Eliminar…» en la fila de la barra lateral y en la zona del lienzo | La tarjeta del modelo vacío es un estado vacío, no una zona permanente: desaparece en cuanto el modelo tiene tablas, y su único trabajo es decir por dónde empezar, que es lo que pide el principio VI para cada estado del sistema. Las dos vías de «Eliminar…» son el mismo menú contextual del mismo objeto en sus dos representaciones, no dos controles distintos. Y la paleta de comandos, que es la salida que el principio V contempla, no existe hasta un incremento posterior | Dejar «Nuevo esquema» solo en la barra lateral: la tarjeta del modelo vacío quedaría prometiendo una acción que hay que ir a buscar a otra zona, y es justo la pantalla de alguien que abre su primer modelo. Dejar «Eliminar…» solo en la barra lateral: con el inspector y la barra lateral escondidos —que FR-006 permite— el esquema dejaría de poder eliminarse |
| Puerta 4 incompleta: ninguna acción de este incremento tiene entrada en la paleta de comandos, y «Nuevo esquema» no tiene atajo de tecla | La paleta de comandos (D-09) es de un incremento posterior, y las teclas únicas de creación (`T`, `R`) se reparten con el Incremento 3, que trae tablas y relaciones. Darle ahora una tecla a esquema obligaría a mover la de tabla después | Adelantar la paleta de comandos a este incremento: es una pantalla entera con su propio alcance, y arrastraría el buscador del modelo, que tampoco es de aquí. Inventar un atajo provisional: la memoria muscular que se gana se pierde al cambiarlo |
