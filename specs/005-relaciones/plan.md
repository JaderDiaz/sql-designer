# Implementation Plan: Relaciones (Incremento 4)

**Branch**: `005-relaciones` | **Date**: 2026-10-28 | **Spec**:
[`spec.md`](./spec.md)

**Input**: Feature specification from `/specs/005-relaciones/spec.md`

## Summary

Las tablas del Incremento 3 pasan a conectarse. Son 45 requisitos en cinco
historias: crear una clave foránea (P1), ver las relaciones en el diagrama (P2),
resaltar una tabla con lo que toca (P3), elegir ON DELETE y ON UPDATE (P4) y
eliminar una relación (P5).

El enfoque técnico, resuelto en la Fase 0, cabe en seis frases. La geometría de
la línea es una función pura del modelo y del layout, no una medida del DOM
(R1), y el reparto en carriles se calcula al cambiar el modelo y se congela
mientras se arrastra (R2). Los tres trazados de Ajustes y el bucle de una tabla
hacia sí misma salen de la misma función de trazado (R3, R4). La cardinalidad
del glifo y el texto del inspector leen una sola función, que es lo que
garantiza SC-011 (R5). Durante el arrastre las líneas se pintan escribiendo el
atributo `d` de las dos o tres relaciones afectadas desde el manejador que ya
corre por cuadro, sin un solo render de React (R6). El resaltado es estado
local del lienzo y clases CSS, con la animación del flujo en `@keyframes` (R7,
R8). Y las relaciones estrenan su propia parte del almacén, donde la marca FK
del campo no se escribe porque `fieldMarks` ya la deduce (R12).

El archivo del modelo apenas se mueve: `relations[]` con sus dos reglas ya está
en la versión 1 del formato, así que lo único que cambia es el enum de las
acciones referenciales, que gana `set_default`, y la versión **no** sube (R11).
La frontera con Rust crece en tres campos de preferencias sobre un comando que
ya existe (R15). Hay **una dependencia nueva**, `@radix-ui/react-tabs`, para las
fichas del panel inferior (R9).

## Technical Context

**Language/Version**: TypeScript 5.6 en modo `strict` (React 18.3) y Rust 1.75+
(edición 2021) para los tres campos de preferencias.

**Primary Dependencies**: Tauri 2.12.5, React 18, Zustand 4.5, Radix UI,
Tailwind 3.4 sobre los tokens de `src/styles/tokens.css`, Framer Motion 11,
`yaml` 2.9. **Una dependencia nueva**: `@radix-ui/react-tabs` para la lista de
fichas del panel inferior, envuelta en un componente puro de
`src/components/ui/` (R9). El trazado de las líneas se dibuja con SVG a mano,
sin biblioteca de enrutado (R3).

**Storage**: el archivo `.yaml` del modelo (formato 1, sin subir de versión, con
`set_default` nuevo en el enum de `onDelete` y `onUpdate`) y `preferences.json`
en el directorio de configuración, propiedad de Rust.

**Testing**: Vitest 2.1 sobre jsdom con Testing Library para las funciones
puras, el almacén y los componentes —de una línea se afirma su atributo `d`,
porque `jsdom` no hace layout de SVG—; WebdriverIO 10 con `@wdio/tauri-service`
para el recorrido sobre la aplicación real, donde van el resaltado con el
cursor, el cambio de trazado y el reinicio que comprueba las preferencias
(R16).

**Target Platform**: Windows 10+ (WebView2) y macOS 12+ (WebKit), el mismo
diseño en los dos.

**Performance Goals**: 60 cuadros por segundo arrastrando una tabla en un
modelo de 50 tablas y 60 relaciones, con las líneas pegadas a sus campos
(SC-003); el resaltado del grupo de una tabla en menos de 100 ms (SC-004).

**Constraints**: una clave foránea de una sola columna contra una llave primaria
de una sola columna; la columna propuesta nace no nula; la cardinalidad no se
guarda, se deduce; las líneas no capturan el puntero; nada se escribe al archivo
hasta Guardar; todo alcanzable con el teclado, con contraste ≥ 4,5:1 en texto y
≥ 3:1 en las líneas contra el fondo del lienzo; con «Reducir movimiento» el
resaltado llega sin animación.

**Scale/Scope**: una pantalla que crece (el Editor), una ficha nueva en el panel
inferior, una capa SVG nueva en el lienzo, dos controles nuevos en Ajustes, una
parte nueva del almacén, dos módulos de funciones puras nuevos que suman once
funciones con `marks.ts`, 45 requisitos funcionales, modelos de hasta ~200
tablas y ~250 relaciones.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Principios

| Principio | Estado | Cómo se cumple |
| --------- | ------ | -------------- |
| I · Modelado local sin conexión | PASA | Sin red, sin telemetría, sin driver de base de datos. La dependencia nueva es un primitivo de interfaz que se empaqueta con la aplicación, como los siete paquetes de Radix que ya están. El trazado se calcula en casa, sin biblioteca de enrutado (R3). |
| II · El archivo del modelo es la única fuente de verdad | PASA, reforzado | Las relaciones viajan en `relations[]` del `.yaml` con sus dos reglas (FR-040); el serializador sigue siendo uno y escribe las claves en su orden fijo. Tres cosas se **deducen** y no se guardan: la marca FK del campo (`fieldMarks`), la cardinalidad de la línea (`cardinalityOf`, R5) y el estado del índice de la columna; así no hay dos verdades. El trazado y la animación no son del modelo: son preferencias de quien mira (R15). |
| III · Frontera Rust ↔ TypeScript explícita | PASA | La frontera crece en tres campos de `preferences_update`, un comando que ya existe; ningún comando nuevo y ningún permiso nuevo en `capabilities/`. Ninguna acción bloquea la interfaz: el arrastre pinta en el nodo (R6) y editar una fila es una escritura al almacén. |
| IV · Tipado estricto y estado único | PASA | Sin `any` ni `@ts-ignore`. Una parte nueva del almacén único (`src/store/relations.ts`), ningún gestor paralelo. Los tipos del modelo siguen siendo unos solos en `src/lib/model/types.ts`. El resaltado por cursor y por foco es estado efímero del lienzo y se queda en el componente, como el principio pide (R7). |
| V · Sistema de diseño por tokens | PASA, con una nota | Las celdas de la ficha son los componentes puros que ya existen (`Select`, `Button`, y la insignia del índice sobre los tokens de estado); las fichas, sobre `@radix-ui/react-tabs`, que es seguir el principio y no saltárselo: una lista de fichas es foco, rol ARIA y navegación de teclado, justo lo que prohíbe hacer a mano (R9). Ningún valor literal: el color de la línea es el token del esquema y las opacidades del atenuado son tokens nuevos de `screens.css`. **Nota**: la animación del flujo se escribe en `@keyframes` y no en Framer Motion, porque es un bucle infinito sobre `stroke-dashoffset`, no una transición con resorte; `prefers-reduced-motion` se respeta en la propia hoja (R8). |
| VI · Reversibilidad y confirmación | PASA | Las seis acciones del incremento son deshacibles con etiqueta (FR-012, FR-036). Nada se escribe al archivo hasta Guardar. Eliminar una clave foránea no pide confirmación —no se pierde trabajo: el campo se queda y el paso se deshace (FR-035)—, mientras que eliminar la tabla o el campo que la relación usa sigue confirmando y diciendo qué se lleva (FR-037, RS-08). Los seis estados de SC-009 tienen mensaje y salida, listados en `contracts/relations.md` §6. |
| VII · Estructura por capas | PASA | Nada fuera del árbol. Geometría en `src/lib/canvas/relations.ts`, dominio en `src/lib/model/relations.ts`, estado en `src/store/relations.ts`, la ficha en `src/components/features/table/`, la capa del lienzo en `src/components/features/canvas/`, el primitivo de fichas en `src/components/ui/`. `invoke` sigue solo en `src/lib/tauri/`, y `scripts/check-layers.mjs` ya verifica las tres reglas. |
| VIII · Documentación JSDoc en español | PASA | Bloque en español en cada función pura, componente, acción del almacén y campo nuevo; `///` en Rust para los tres campos. Se actualizan los bloques de `relationCardinality` (cambia de implementación), de `BottomPanel` (pasa a tener fichas) y de `CanvasSurface` (gana la capa y el resaltado). |

### Puertas de calidad

| Puerta | Estado | Nota |
| ------ | ------ | ---- |
| 1 · `cargo check` y typecheck sin avisos nuevos | Aplica | Las cinco comprobaciones en cada tarea de cierre y en los dos sistemas por el workflow `puertas.yml`. |
| 2 · Pruebas del generador SQL por motor | No aplica | Este incremento no genera SQL: las reglas se guardan y se ven, y el `ALTER TABLE … FOREIGN KEY` es del incremento de exportación (Assumptions). |
| 3 · Ida y vuelta de cargar y guardar | Aplica | `src/lib/model/roundtrip.test.ts` se amplía con un modelo que trae cuatro relaciones, las cinco acciones referenciales —`set_default` incluida— y una relación de una tabla hacia sí misma. |
| 4 · Atajo y entrada en la paleta de comandos | Parcial, justificado | La tecla `R` de FR-001 queda declarada en `contracts/relations.md` §4. La paleta de comandos sigue siendo de un incremento posterior: ver Complexity Tracking. |
| 5 · Revisión en claro, oscuro y movimiento reducido | Aplica | SC-010: la ficha «Claves foráneas», las líneas con sus glifos, el resaltado y los dos controles de Ajustes, en los tres estados, antes de cerrar. La línea se mide contra el fondo del lienzo, que es contraste de elemento no textual (≥ 3:1). |
| 6 · Ningún artefacto copia el prototipo | Aplica | Del tablero `Editor` y del componente `TableEditorPanel` en su variante `fks` se toman medidas, textos y jerarquía; su HTML, su `support.js` y su `bundle.js` no entran al repositorio. Los siete desvíos deliberados están en `research.md` R18. |
| 7 · Dirección de dependencias | Aplica | De `src/components/ui/` solo crece una pieza pura: `Tabs.tsx`, que no conoce el almacén. `src/lib/` sigue sin importar de `src/components/`. La capa de relaciones del lienzo lee del almacén porque vive en `features/`. |
| 8 · JSDoc en todo símbolo nuevo o modificado | Aplica | Incluye `ReferentialAction` (gana un valor), las once funciones puras —diez nuevas y `relationCardinality`, que cambia de papel—, las seis acciones del almacén y los tres campos de preferencias. |

**Resultado de la puerta (antes de la Fase 0)**: pasa, con los dos desvíos de
Complexity Tracking.

**Re-evaluación tras la Fase 1**: pasa. El diseño no introdujo violaciones
nuevas y cerró tres riesgos. El principio II queda reforzado porque la
cardinalidad se deduce en un solo sitio y la línea y el inspector no pueden
discrepar (R5), y porque la marca FK sigue derivándose de las relaciones en vez
de escribirse en el campo (R12). El principio IV queda reforzado porque la
geometría de la línea es una función pura del modelo y no una medición del DOM
(R1). Y el principio VI queda reforzado porque eliminar la clave foránea
conserva la columna, así que el paso deshacible no tiene que recuperar un campo
borrado (FR-035). La dependencia nueva se declara en Technical Context y no es
un desvío: es la lectura literal del principio V (R9).

## Project Structure

### Documentation (this feature)

```text
specs/005-relaciones/
├── plan.md                     # Este archivo
├── research.md                 # Fase 0: 18 decisiones técnicas
├── data-model.md               # Fase 1: archivo, preferencias, sesión y geometría
├── quickstart.md               # Fase 1: cómo validar el incremento
├── contracts/
│   ├── relations.md            # Funciones puras, acciones, gestos, atajos, nombres accesibles y mensajes
│   ├── model.schema.json       # Forma del `.yaml`, formato 1 + set_default en las dos acciones
│   └── preferences.md          # Delta de `preferences.json`: trazado, animación y patrón
├── checklists/
│   └── requirements.md         # Calidad del spec (ya existente, 16/16)
└── tasks.md                    # Fase 2 (`/speckit-tasks`, no lo crea este comando)
```

### Source Code (repository root)

```text
src-tauri/src/
└── preferences.rs              # + relationRoute, relationAnimation y foreignKeyPattern (R15)

src/
├── lib/
│   ├── canvas/
│   │   └── relations.ts        # Nuevo: anclas, carriles, trazados, bucle y glifos (R1 a R5)
│   ├── model/
│   │   ├── types.ts            # + set_default en ReferentialAction (R11)
│   │   ├── relations.ts        # Nuevo: propuesta de columna, nombre y destinos válidos (R10, R13)
│   │   ├── marks.ts            # + cardinalityOf; relationCardinality pasa a formatearla (R5)
│   │   ├── validate.ts         # + set_default y fromFields.length === toFields.length
│   │   └── __fixtures__/       # + modelo-relaciones.yaml (cuatro tablas, bucle y las cinco acciones)
│   │                           # + 60 relaciones en modelo-50-tablas.yaml, para medir a escala
│   └── tauri/types.ts          # + los tres campos de Preferences y del parche
├── store/
│   ├── relations.ts            # Nuevo: las seis acciones deshacibles (R12)
│   ├── fieldsPanel.ts          # + la ficha activa del panel («Campos» | «Claves foráneas»)
│   ├── preferences.ts          # + los tres campos nuevos
│   └── index.ts                # + la parte nueva
├── components/
│   ├── ui/
│   │   ├── Tabs.tsx            # Nuevo: lista de fichas sobre @radix-ui/react-tabs (R9)
│   │   ├── Badge.tsx           # Nuevo: insignia «Indexada» / «Sin índice» (FR-033)
│   │   └── Icon.tsx            # + git-merge, key-round, corner-up-left y arrow-up-right
│   ├── layout/
│   │   ├── BottomPanel.tsx     # «Editor de campos» pasa a «Editor de tabla» con fichas (R9)
│   │   ├── EditorChrome.tsx    # + «Relación» y la tecla R (FR-001)
│   │   └── Inspector.tsx       # Las relaciones de la ficha de tabla usan cardinalityOf
│   └── features/
│       ├── table/
│       │   ├── ForeignKeysTab.tsx      # La rejilla de seis columnas (FR-006 a FR-010, FR-028 a FR-034)
│       │   ├── ReferencedByList.tsx    # «Referenciada por», con ir a la tabla (FR-031)
│       │   └── TableContextMenu.tsx    # + «Nueva clave foránea…» (FR-001)
│       ├── canvas/
│       │   ├── RelationsLayer.tsx      # La capa SVG, sus glifos y el pintado a mano (R6)
│       │   ├── CanvasSurface.tsx       # + la capa, el resaltado y paintRelations en el arrastre
│       │   └── TableCard.tsx           # + is-hot, is-linked y el marcado de los campos de la relación
│       └── preferences/
│           └── PreferencesWindow.tsx   # + «Trazado de relaciones» y «Animación de relaciones»
├── hooks/
│   └── useGridNavigation.ts    # Se reutiliza tal cual para la rejilla de la ficha
└── styles/
    └── screens.css             # + líneas, glifos, atenuado, flujo en @keyframes y fichas del panel

e2e/
├── soporte/modelo-relaciones.yaml  # Cuatro tablas en dos esquemas, cinco relaciones y un bucle
└── specs/11-relaciones.e2e.js

.github/workflows/
└── recorrido.yml                   # El job «Los ocho escenarios» pasa a nombrar los doce
```

**Structure Decision**: se mantiene el árbol que fija la constitución y no nace
ninguna carpeta de primer nivel. La ficha nueva entra en
`src/components/features/table/`, al lado de la rejilla de campos del Incremento
3, porque es la misma tabla vista de otra manera; la capa del lienzo entra en
`features/canvas/`, con las tarjetas y las zonas. El reparto del panel inferior
que el Incremento 3 estrenó se mantiene: su marco y sus fichas en `layout/`,
que es donde la constitución pone la estructura de ventana, y el contenido de
cada ficha en `features/table/`. Las dos piezas nuevas de `ui/` son puras y sin
estado, como exige la puerta 7.

## Complexity Tracking

| Violación | Por qué hace falta | Alternativa más simple, y por qué se descarta |
| --------- | ------------------ | --------------------------------------------- |
| Principio V: una misma acción en varias zonas. FR-001 ofrece abrir la ficha de claves foráneas desde «Relación» de la barra superior, con la tecla `R` y desde «Nueva clave foránea…» del menú de la tabla | Son las tres gramáticas de la misma acción, como las tres vías de «Nueva tabla» del Incremento 3: el botón para quien busca con la vista, la tecla para quien ya sabe y el menú contextual porque es el único sitio donde la acción llega con la tabla ya elegida, que es lo que FR-003 necesita | Dejar solo el botón de la barra superior: obligaría a seleccionar la tabla antes en un segundo gesto, y FR-002 tendría que dispararse continuamente |
| Puerta 4 incompleta: la tecla `R` existe, pero la acción no tiene entrada en la paleta de comandos | La paleta (D-09) es de un incremento posterior, igual que en los Incrementos 1, 2 y 3. El atajo sí está declarado, y `R` es el del tablero | Adelantar la paleta de comandos: es una pantalla entera con su propio alcance y arrastra el buscador del modelo, que tampoco es de aquí |
