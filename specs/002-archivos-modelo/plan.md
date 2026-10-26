# Implementation Plan: Archivos de modelo (Incremento 1)

**Branch**: `002-archivos-modelo` | **Date**: 2026-10-26 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/002-archivos-modelo/spec.md`

## Summary

El Incremento 1 convierte la aplicación en un editor de archivos: crear un modelo
`.yaml` con nombre, motor y carpeta; elegir la carpeta en una pantalla propia;
abrir un modelo con vista previa y errores con número de línea; guardar con ⌘S
mostrando «Guardado · <motor>» o «Editado»; cerrar preguntando por los cambios; y
retomar los últimos diez modelos desde Recientes, con sus acciones de renombrar,
copiar ruta, quitar y mover a la papelera.

El reparto técnico es el de la constitución: **Rust posee el disco** (listar
ubicaciones y carpetas, leer y escribir bytes de forma atómica, sello de
obsolescencia, lista de recientes, papelera, revelar en el gestor de archivos,
portapapeles y construcción de rutas) y **TypeScript posee el modelo** (gramática
YAML, validación con línea y columna, tipos únicos del modelo, estado en el
almacén). La frontera son trece comandos nuevos, más dos de medida, en
`src/lib/tauri/commands.ts`, el único archivo que usa `invoke`; todos los que
tocan el disco son `async` para no bloquear la interfaz (principio III).

## Technical Context

**Language/Version**: TypeScript 5.6 en modo `strict` (frontend) y Rust 1.75,
edición 2021 (backend)

**Primary Dependencies**: Tauri 2.12 · React 18.3 · Zustand 4.5 · Radix UI
(`react-dialog`, `react-checkbox`, `react-radio-group` ya presentes; `react-select`
2.4 y `react-context-menu` 2.4 nuevos) · Tailwind 3.4 sobre tokens · Framer Motion
11 · lucide-react · **`yaml` 2.9 (nuevo, frontend)** · **crate `trash` 5 (nuevo,
backend)**

**Storage**: solo archivos locales. El modelo en `.yaml` elegido por el usuario;
`preferences.json` y `recents.json` en el directorio de configuración de la app.
Sin base de datos, sin red (principio I).

**Testing**: Vitest + Testing Library + user-event para el frontend (incluidas las
pruebas de ida y vuelta del serializador y de la validación con línea); `cargo
test` con directorios temporales para los módulos de Rust, como ya hace
`src-tauri/src/preferences.rs`.

**Target Platform**: macOS 12+ (WebKit) y Windows 10+ (WebView2), misma interfaz en
ambos; solo se adapta lo que depende del sistema (⌘/Ctrl, «Finder»/«Explorador»,
papelera, formato de rutas).

**Project Type**: aplicación de escritorio Tauri con frontend React en `src/` y
backend Rust en `src-tauri/`.

**Performance Goals**: crear y mostrar el Editor < 1 s (SC-002); abrir un modelo de
50 tablas y 60 relaciones < 2 s y guardarlo < 1 s (SC-003); listar una carpeta de
1 000 entradas sin bloquear la interfaz (FR-042).

**Constraints**: sin red ni telemetría; ventana mínima 820 × 500 y las pantallas
caben sin que crezca (RS-01); ninguna operación de archivo bloquea la interfaz;
nada se escribe hasta Guardar (RS-07); todo cambio al modelo es deshacible y
rehacible (RS-06), que en este incremento significa el renombrado del modelo.

**Scale/Scope**: 4 pantallas (Bienvenida con recientes, Nuevo modelo, Elegir
carpeta, Abrir modelo) + cabecera del Editor y 6 diálogos (error de archivo, no
encontrado, guardar al cerrar, renombrar, mover a la papelera, archivo cambiado en
el disco); 13 comandos nuevos más 2 de medida
de Tauri; 45 requisitos funcionales; modelos de hasta ~200 tablas.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Principios

| Principio | Estado | Cómo se cumple |
| --------- | ------ | -------------- |
| I · Modelado local sin conexión | PASA | Ninguna dependencia nueva habla por red: `yaml` parsea texto y `trash` llama a la papelera del sistema. Sin drivers, sin telemetría, sin HTTP. |
| II · El archivo del modelo es la única fuente de verdad | PASA | El `.yaml` define nombre, motor y esquemas; el motor viaja en el archivo y el de Ajustes solo fija el inicial (FR-006). El serializador es uno (`src/lib/model/serialize.ts`) y la ida y vuelta se prueba (puerta 3, FR-023). El formato lleva `formatVersion` y una versión futura se rechaza con mensaje (FR-025). |
| III · Frontera Rust ↔ TypeScript explícita | PASA | Disco, ubicaciones, papelera, portapapeles, revelar en el gestor y construcción de rutas son comandos de Rust tipados; el frontend nunca concatena separadores ni asume rutas. Todo fallo vuelve como `AppError`, sin `panic!`. **Todo comando que toque el disco se declara `async fn`**, para que Tauri lo ejecute fuera del hilo principal y listar una carpeta grande no congele el webview; la pantalla conserva salida visible. |
| IV · Tipado estricto y estado único | PASA con refactor | Sin `any` ni `@ts-ignore`. Obliga a unificar el almacén: `src/store/preferences.ts` pasa a ser un *slice* y nace `src/store/index.ts` con `useAppStore` (preferences, navigation, model, recents, browser). Los tipos del modelo son uno solo en `src/lib/model/types.ts`, compartidos por validador, serializador y almacén. |
| V · Sistema de diseño por tokens | PASA | Los componentes nuevos (`TextField`, `SearchField`, `Select`, `Sidebar`, `FileList`, `ContextMenu`) viven en `src/components/ui/`, son puros y se estilan con tokens de `src/styles/`. Menú contextual, selección y diálogos sobre Radix; nada de foco ni ARIA a mano. Tema claro y oscuro y `prefers-reduced-motion` ya resueltos por `MotionConfig`. |
| VI · Reversibilidad y confirmación | PASA | Nada se escribe hasta Guardar; «Editado» e indicador en cerrar; al cerrar se pregunta con tres respuestas; mover a la papelera confirma y dice qué archivo; además se añade la detección de archivo cambiado en disco antes de sobrescribir (FR-025). **El renombrado del modelo, único cambio al contenido de este incremento, es deshacible y rehacible con etiqueta de qué cambió (FR-044, RS-06)**: el historial nace aquí con una sola clase de cambio y el Incremento 2 lo amplía. Cada estado (vacío, con errores, no encontrado, repetido, sin resultados) tiene mensaje y salida. |
| VII · Estructura por capas | PASA | Nada nuevo fuera del árbol: pantallas en `src/components/features/`, cabecera del Editor en `src/components/layout/`, modelo y utilidades en `src/lib/`, estado en `src/store/`. `invoke` sigue solo en `src/lib/tauri/`. La puerta la verifica `scripts/check-layers.mjs`, ya en `npm run lint`. |
| VIII · Documentación JSDoc en español | PASA | Cada función, componente, hook y comando nuevo lleva su bloque en español; `///` en Rust. |

### Puertas de calidad

| Puerta | Estado | Nota |
| ------ | ------ | ---- |
| 1 · `cargo check` y typecheck sin avisos nuevos | Aplica | `npm run typecheck`, `npm run lint` y `cargo check` en cada tarea de cierre. |
| 2 · Pruebas del generador SQL por motor | No aplica | Este incremento no genera SQL. El motor solo se guarda y se muestra. |
| 3 · Ida y vuelta de cargar y guardar | Aplica | Es FR-023 y SC-004: prueba de ida y vuelta sobre un juego de modelos de ejemplo, incluidos los tres motores. |
| 4 · Atajo y entrada en la paleta de comandos | Parcial, justificado | Los atajos están (⌘N, ⌘O, ⌘S, ⌘W, ⇧F10). La paleta de comandos (D-09) no existe hasta un incremento posterior: ver Complexity Tracking. |
| 5 · Revisión en claro, oscuro y movimiento reducido | Aplica | Tarea de revisión por pantalla antes de cerrar el incremento. |
| 6 · Ningún artefacto copia el prototipo | Aplica | El lienzo «SQL Designer · Diseño de Pantallas» es referencia visual: se leen medidas, copia y jerarquía, no se importa su HTML ni su `support.js`. |
| 7 · Dirección de dependencias | Aplica | `scripts/check-layers.mjs` ya falla si `ui/` importa del almacén o si `invoke` se escapa de `src/lib/tauri/`. |
| 8 · JSDoc en todo símbolo nuevo o modificado | Aplica | Incluye los símbolos de `preferences.ts` que cambian al pasar a *slice*. |

**Resultado de la puerta (antes de la Fase 0)**: pasa, con los desvíos de
Complexity Tracking.

**Re-evaluación tras la Fase 1**: pasa. El diseño no introdujo violaciones nuevas y
cerró dos riesgos: el principio II queda reforzado porque guardar serializa el
modelo en memoria completo con validación estricta (R3), y el principio III no
necesita permisos nuevos en `capabilities/default.json` porque la papelera, el
gestor de archivos y el portapapeles se resuelven en código propio de Rust (R8).
Los tres desvíos de Complexity Tracking siguen siendo los únicos.

## Project Structure

### Documentation (this feature)

```text
specs/002-archivos-modelo/
├── plan.md                     # Este archivo
├── research.md                 # Fase 0: decisiones técnicas
├── data-model.md               # Fase 1: formato del modelo, recientes y estado
├── quickstart.md               # Fase 1: cómo validar el incremento
├── contracts/
│   ├── commands.md             # Comandos de Tauri del incremento
│   ├── model.schema.json       # Forma del `.yaml` del modelo, versión 1
│   └── recents.schema.json     # Forma de `recents.json`
├── checklists/
│   └── requirements.md         # Calidad del spec (ya existente)
└── tasks.md                    # Fase 2 (`/speckit-tasks`, no lo crea este comando)
```

### Source Code (repository root)

```text
src-tauri/src/
├── main.rs                     # + registro de los comandos y estados nuevos
├── commands.rs                 # + comandos de archivos, recientes, papelera y sistema
├── files.rs                    # NUEVO: listar, leer, escribir atómico, sello, crear carpeta
├── places.rs                   # NUEVO: ubicaciones del usuario y raíz del volumen
├── recents.rs                  # NUEVO: recents.json (máximo 10, recuperación con .bak)
├── system.rs                   # NUEVO: papelera, revelar en el gestor, portapapeles
├── preferences.rs              # + campos `engine` y `lastFolder`
├── identity.rs · logging.rs · measure.rs · window_state.rs   # sin cambios de forma

src/
├── lib/
│   ├── model/
│   │   ├── types.ts            # NUEVO: tipos únicos del modelo (principio IV)
│   │   ├── parse.ts            # NUEVO: YAML → modelo, con línea y columna del error
│   │   ├── serialize.ts        # NUEVO: modelo → YAML (único serializador)
│   │   ├── validate.ts         # NUEVO: validación campo a campo sobre el AST
│   │   ├── defaults.ts         # NUEVO: modelo vacío y esquema por defecto por motor
│   │   ├── slug.ts             # NUEVO: nombre → nombre de archivo
│   │   └── summary.ts          # NUEVO: motor, tablas y relaciones para la vista previa
│   └── tauri/
│       ├── commands.ts         # + envoltorios de los comandos nuevos
│       └── types.ts            # + tipos de la frontera
├── store/
│   ├── index.ts                # NUEVO: `useAppStore` con los cinco slices
│   ├── preferences.ts          # pasa de almacén a slice
│   ├── navigation.ts           # NUEVO: pantalla activa y diálogo abierto
│   ├── model.ts                # NUEVO: modelo abierto, sello, estado guardado/editado
│   ├── recents.ts              # NUEVO: lista, revalidación perezosa y acciones
│   └── browser.ts              # NUEVO: estado del explorador (ubicación, búsqueda, selección)
├── components/
│   ├── features/
│   │   ├── welcome/            # + lista de recientes, menú contextual y sus diálogos
│   │   ├── new-model/          # NUEVO: NewModelDialog
│   │   ├── choose-folder/      # NUEVO: ChooseFolderDialog
│   │   ├── open-model/         # NUEVO: OpenModelDialog y su vista previa
│   │   └── editor/             # NUEVO: EditorScreen (cabecera, estado, modelo vacío, renombrar)
│   ├── layout/
│   │   └── EditorChrome.tsx    # NUEVO: cabecera del Editor dentro del layout
│   └── ui/
│       ├── TextField.tsx · SearchField.tsx · Select.tsx      # NUEVOS
│       ├── Sidebar.tsx · FileList.tsx · ContextMenu.tsx      # NUEVOS
│       └── Button · Checkbox · Dialog · Icon · Kbd · Toast   # existentes
└── hooks/
    └── useShortcut.ts          # + ⌘N, ⌘O, ⌘S, ⌘W según la pantalla activa
```

**Structure Decision**: se mantiene el árbol de la constitución tal como lo dejó
el Incremento 0. Lo único estructural nuevo es `src/lib/model/`, que concentra los
tipos del modelo y su gramática (un solo serializador, principio II), y la
unificación del almacén en `src/store/index.ts` para cumplir el estado único del
principio IV. En Rust se parte `commands.rs` en módulos por responsabilidad
(`files`, `places`, `recents`, `system`) para que cada comando siga siendo una
función corta sobre un módulo probado con directorios temporales.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
| --------- | ---------- | ------------------------------------ |
| Puerta 4: las acciones nuevas no tienen entrada en la paleta de comandos | La paleta (D-09) es una pantalla de un incremento posterior; crearla ahora metería búsqueda de tablas, campos y esquemas que todavía no existen | Adelantar la paleta multiplicaría el alcance del incremento y habría que rehacerla cuando existan tablas y esquemas reales. Los atajos sí están declarados (⌘N, ⌘O, ⌘S, ⌘W, ⇧F10) y la paleta los recogerá cuando llegue |
| La lista de ubicaciones no es la del mock del lienzo (que muestra «Proyectos» e «iCloud Drive» fijos) | Las ubicaciones se preguntan al sistema y solo se listan las que existen: Recientes (virtual), Escritorio, Documentos, Descargas, Inicio, iCloud Drive solo en macOS si está, y la raíz del volumen | Copiar la lista del mock mostraría carpetas inventadas que en la máquina del usuario no existen, y el mock es referencia de diseño, no de datos (puerta 6) |
| Dependencia nueva en Rust: crate `trash` | «Mover a la papelera…» es FR-035 y RS-08; la papelera del sistema no está en la API de Tauri 2 | Llamar a `osascript` en macOS y a PowerShell en Windows es frágil, lento y silencioso ante errores; no implementar la acción incumpliría el spec |
