# Implementation Plan: Base de la aplicación (Incremento 0)

**Branch**: `001-base-aplicacion` | **Date**: 2026-10-24 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/001-base-aplicacion/spec.md`

## Summary

La aplicación arranca en Windows y macOS y muestra la Bienvenida con su identidad
(icono, nombre, versión con fecha de compilación) y sus dos acciones; el tema sigue al
sistema y se puede forzar desde unos Ajustes que en este incremento solo contienen esa
preferencia; la ventana recuerda tamaño y posición, respeta un mínimo y desplaza solo la
sección que no cabe.

El enfoque técnico: una ventana Tauri sin decoración nativa en Windows con controles
propios, y con barra de título superpuesta en macOS para conservar los botones nativos;
un único archivo de preferencias en JSON escrito por Rust con escritura atómica y lectura
tolerante a archivo dañado; el tema aplicado en el webview con un atributo en `<html>`
sobre tokens CSS, sin recargar; la versión y la fecha de compilación inyectadas en el
binario y servidas por un comando tipado; y un registro local de errores de arranque y de
preferencias.

## Technical Context

**Language/Version**: Rust 1.75+ (edición 2021) en `src-tauri/`; TypeScript 5.x en modo
`strict` con React 18 en `src/`

**Primary Dependencies**: Tauri 2 (`tauri`, `tauri-plugin-window-state`,
`tauri-plugin-log`, `tauri-plugin-opener`), Vite 5, React 18, Tailwind CSS 3, Radix UI
(shadcn/ui), Framer Motion 11, Zustand 4, `serde`/`serde_json`

**Storage**: archivos locales. Preferencias en JSON dentro del directorio de
configuración de la app; registro de errores en el directorio de logs de la app. Ninguna
base de datos: el modelo `.yaml` no existe todavía en este incremento

**Testing**: `cargo test` para la lógica de Rust (lectura y escritura de preferencias,
recuperación ante archivo dañado, recorte de geometría al área visible, identidad de la
app); Vitest + Testing Library para el almacén, los hooks y los componentes; verificación
manual guiada por `quickstart.md` para el cromo de ventana y los temas en los dos sistemas

**Target Platform**: Windows 10/11 (WebView2) y macOS 13+ (WebKit), escritorio

**Project Type**: aplicación de escritorio (binario Tauri con interfaz web local)

**Performance Goals**: Bienvenida usable en ≤ 2 s desde el arranque (SC-001); cambio de
tema reflejado en ≤ 1 s sin reiniciar (SC-003); interacción a 60 fps con movimiento que
respeta la preferencia de reducirlo

**Constraints**: sin red y sin credenciales (FR-017); fuentes y assets empaquetados;
ventana con tamaño mínimo que no se puede reducir más; la ventana nunca se desplaza, solo
sus secciones (RS-01); textos en español; símbolos de atajo según el sistema (RS-12)

**Scale/Scope**: 2 pantallas (Bienvenida y Ajustes) más el cromo de ventana; 20 requisitos
funcionales; 10 criterios de éxito; 3 historias de usuario

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Evaluado contra `.specify/memory/constitution.md` v1.2.0.

| Principio | Puerta para este incremento | Estado |
|-----------|-----------------------------|--------|
| I. Modelado Local Sin Conexión | Sin drivers de base de datos, sin peticiones HTTP, sin telemetría; fuentes empaquetadas; el registro de errores se queda en el equipo | PASA |
| II. El Archivo del Modelo es la Única Fuente de Verdad | No aplica todavía: este incremento no lee ni escribe modelos. Las preferencias son de la instalación, no del modelo, y viven en su propio archivo | PASA (no aplica) |
| III. Frontera Rust ↔ TypeScript Explícita | Preferencias, geometría de ventana, identidad de la app, registro y menús nativos viven en Rust y se exponen como comandos tipados; el frontend no asume rutas ni APIs del sistema; los comandos devuelven errores como valores, sin `panic!` | PASA |
| IV. Tipado Estricto y Estado Único | TypeScript `strict`, sin `any`; un almacén Zustand para preferencias y estado de interfaz; los tipos de preferencias son uno solo, compartidos por almacén y comandos | PASA |
| V. Sistema de Diseño por Tokens | Tokens en `src/styles/` y `tailwind.config.js`; Bienvenida y Ajustes se construyen con componentes de `src/components/ui/` sobre Radix; claro y oscuro obligatorios; `prefers-reduced-motion` respetado | PASA |
| VI. Reversibilidad y Confirmación | Sin cambios al modelo que deshacer en este incremento. Lo que aplica: ninguna preferencia se pierde en silencio y un archivo dañado cae a valores por defecto con aviso en el registro | PASA (parcial por alcance) |
| VII. Estructura por Capas y Sistema de Diseño Puro | El árbol es el de la constitución; `components/ui` no importa de `store` ni de `features`; `invoke` solo en `src/lib/` | PASA |
| VIII. Documentación JSDoc en Español | Todo símbolo nuevo de `src/` lleva su bloque JSDoc en español y todo elemento público o comando de `src-tauri/src/` su `///`, breve y acorde a lo que hace; los procesos de varios pasos (preferencias, geometría, arranque) documentan su orden en el punto de entrada | PASA |

Puertas de calidad aplicables (sección Flujo de Desarrollo de la constitución): 1, 4, 5,
7 y 8. La puerta 2 (generador SQL por motor) y la 3 (ida y vuelta del `.yaml`) no aplican
porque este incremento no genera SQL ni abre modelos; la 6 (no copiar el prototipo de
diseño) no aplica porque no hay prototipo en el repositorio.

La puerta 4 se cumple a medias por alcance: las acciones de este incremento declaran su
atajo, pero no su entrada en la paleta de comandos porque la paleta llega con el editor
en un incremento posterior.

Sin violaciones. La sección Complexity Tracking queda vacía a propósito.

**Re-evaluación tras la Fase 1**: el diseño de
[data-model.md](./data-model.md), [contracts/commands.md](./contracts/commands.md) y
[contracts/preferences.schema.json](./contracts/preferences.schema.json) mantiene las
ocho puertas. Puntos que la re-evaluación confirma: todo acceso al sistema operativo
queda detrás de seis comandos tipados que devuelven errores como valores (III); el
esquema de preferencias es único y se valida al cargar (IV); el contrato obliga a que
`invoke` viva solo en `src/lib/tauri/` (VII); y el evento `preferences://open` existe
justamente para que las tres vías de FR-020 compartan una sola acción, en lugar de
duplicar lógica entre `layout` y `features` (V, «una misma acción no se duplica en dos
zonas»).

## Project Structure

### Documentation (this feature)

```text
specs/001-base-aplicacion/
├── plan.md              # Este archivo
├── research.md          # Fase 0
├── data-model.md        # Fase 1
├── quickstart.md        # Fase 1
├── contracts/           # Fase 1
│   ├── commands.md      # Comandos de Tauri expuestos al frontend
│   └── preferences.schema.json  # Forma del archivo de preferencias
├── checklists/
│   └── requirements.md  # Calidad de la especificación
└── tasks.md             # Fase 2 (/speckit-tasks, no lo crea /speckit-plan)
```

### Source Code (repository root)

```text
src-tauri/
├── src/
│   ├── main.rs                 # Arranque, ventana, menú nativo, registro de comandos
│   ├── commands.rs             # Comandos: preferencias, identidad, apertura de Ajustes
│   ├── preferences.rs          # Lectura, escritura atómica, valores por defecto, versión del archivo
│   ├── window_state.rs         # Geometría: guardado, restauración y recorte al área visible
│   ├── identity.rs             # Versión y fecha de compilación
│   └── logging.rs              # Registro local de errores
├── build.rs                    # Inyecta la fecha de compilación
├── tauri.conf.json             # Ventana, decoración por sistema, permisos mínimos
├── capabilities/default.json   # Permisos de los plugins usados
└── Cargo.toml

src/
├── assets/fonts/               # Geist y Geist Mono empaquetadas
├── components/
│   ├── ui/                     # Button, Checkbox, Dialog, SegmentedControl, Icon, Kbd…
│   ├── layout/                 # Titlebar (controles por sistema), AppShell, ScrollRegion
│   └── features/
│       ├── welcome/            # Pantalla Bienvenida
│       └── preferences/        # Ventana de Ajustes (solo tema)
├── hooks/                      # useTheme, useShortcut, usePlatform
├── lib/
│   ├── tauri/                  # Envoltorios tipados de cada comando (único sitio con invoke)
│   ├── platform.ts             # macOS/Windows: símbolos de atajo y textos
│   └── cn.ts                   # Composición de clases de Tailwind
├── store/preferences.ts        # Almacén Zustand
├── styles/tokens.css           # Tokens de color, sombra, radio, duración y curva
├── test/setup.ts               # Arranque de Vitest: jsdom y matchMedia simulable
├── App.tsx
└── main.tsx

scripts/check-layers.mjs        # Puerta 7: dirección de dependencias e `invoke` solo en `src/lib/`
index.html
tailwind.config.js
vite.config.ts
```

**Structure Decision**: se adopta tal cual el árbol de la sección Estructura del Proyecto
de la constitución; este incremento crea las carpetas y solo los archivos que necesita.
`src/components/features/` arranca con `welcome/` y `preferences/`, y
`src/components/ui/` con los componentes que esas dos pantallas consumen, sin adelantar
el resto del sistema de diseño.

Dos rutas no salen del árbol de la constitución, que describe el producto: `src/test/`
guarda el arranque de las pruebas y `scripts/` las comprobaciones de las puertas de
calidad. Ninguna de las dos contiene código que se empaquete con la aplicación.

## Complexity Tracking

> Sin violaciones de la constitución; nada que justificar.
