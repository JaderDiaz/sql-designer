# Tasks: Base de la aplicación (Incremento 0)

**Input**: Documentos de diseño en `specs/001-base-aplicacion/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: incluidos. No los pide la especificación, pero la estrategia de pruebas de
`research.md` §10 y las puertas de calidad 1 y 7 de la constitución los exigen:
`cargo test` para la lógica de Rust y Vitest con Testing Library para almacén, hooks y
pantallas. El cromo de ventana y la revisión visual se verifican a mano con
`quickstart.md`.

**Organization**: tareas agrupadas por historia de usuario para poder implementar y
probar cada una por separado.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: puede ir en paralelo (archivos distintos, sin dependencias pendientes)
- **[Story]**: historia a la que pertenece (US1, US2, US3)
- Cada tarea nombra su ruta exacta

## Path Conventions

Árbol de la constitución (sección Estructura del Proyecto), confirmado en `plan.md`:
backend en `src-tauri/`, interfaz en `src/`, pruebas de Rust junto a su módulo y pruebas
de frontend en `src/**/*.test.ts(x)`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: dejar el proyecto compilando y con el sistema de diseño en pie

- [X] T001 Crear el árbol de carpetas de `plan.md` (`src-tauri/src/`, `src/assets/fonts/`, `src/components/{ui,layout,features}/`, `src/hooks/`, `src/lib/tauri/`, `src/store/`, `src/styles/`) con un `.gitkeep` en las que queden vacías
- [X] T002 Inicializar el proyecto de frontend con Vite 5, React 18 y TypeScript en `package.json`, `vite.config.ts` y `tsconfig.json`, con `strict: true`, `noUncheckedIndexedAccess: true` y sin `any` permitido
- [X] T003 [P] Configurar Tailwind CSS 3 en `tailwind.config.js` y `postcss.config.js`, leyendo los tokens desde `src/styles/tokens.css`
- [X] T004 [P] Declarar los tokens de color, sombra, radio, duración y curva en `src/styles/tokens.css`, con bloque claro y bloque oscuro bajo `[data-theme="dark"]`
- [X] T005 [P] Empaquetar Geist y Geist Mono en `src/assets/fonts/` y declarar sus `@font-face` en `src/styles/fonts.css`, sin ninguna petición a CDN
- [X] T006 [P] Configurar Vitest y Testing Library en `vitest.config.ts` y `src/test/setup.ts`, con `jsdom` y `matchMedia` simulable
- [X] T007 [P] Configurar lint y formato en `eslint.config.js` y `.prettierrc`, con la regla que prohíbe `any` y `@ts-ignore` sin comentario de justificación
- [X] T008 Inicializar el proyecto Tauri 2 en `src-tauri/` (`Cargo.toml`, `src-tauri/src/main.rs` mínimo, `src-tauri/build.rs` vacío) con las dependencias `tauri`, `serde`, `serde_json`, `tauri-plugin-window-state`, `tauri-plugin-log`
- [X] T009 Configurar la ventana en `src-tauri/tauri.conf.json`: título `SQL Designer`, tamaño por defecto 820 × 500, `minWidth: 820`, `minHeight: 500`, sin decoración en Windows y barra de título superpuesta en macOS
- [X] T010 [P] Declarar los permisos mínimos en `src-tauri/capabilities/default.json`: solo lo que piden `tauri-plugin-window-state` (guardar y restaurar) y `tauri-plugin-log`, con una línea de comentario por permiso
- [X] T011 [P] Añadir los scripts `dev`, `build`, `test`, `typecheck` y `tauri` en `package.json`, y dejar `cargo check` documentado en `specs/001-base-aplicacion/quickstart.md`

**Checkpoint**: `npm run typecheck` y `cargo check --manifest-path src-tauri/Cargo.toml` pasan sobre un proyecto vacío

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: la frontera Rust ↔ TypeScript, las preferencias y el armazón de interfaz que las tres historias necesitan

**⚠️ CRITICAL**: ninguna historia puede empezar hasta cerrar esta fase

- [X] T012 Inyectar la fecha de compilación en `src-tauri/build.rs` como variable de entorno de compilación con formato `AAAA.MM.DD`
- [X] T013 [P] Implementar `src-tauri/src/identity.rs` con `name` fijo `SQL Designer`, `version` leída de `tauri.conf.json` y `buildDate` desde la variable de T012
- [X] T014 [P] Implementar `src-tauri/src/logging.rs` con `tauri-plugin-log` hacia el directorio de logs de la app, rotación por tamaño, niveles `warn` y `error`, ámbitos `startup`, `preferences` y `window-state`, y sin ningún destino de red
- [X] T015 Definir los tipos de preferencias en `src-tauri/src/preferences.rs` con `serde` y `rename_all = "camelCase"`, respetando el esquema de `contracts/preferences.schema.json`: `formatVersion` entero obligatorio con valor `1`, `theme` en `"system" | "light" | "dark"` por defecto `"system"`, `showWelcomeOnStart` booleano por defecto `true`, `window` objeto o nulo por defecto `null` con `width` mínimo 820 y `height` mínimo 500, y `lastModelPath` cadena no vacía o nulo por defecto `null`
- [X] T016 Implementar en `src-tauri/src/preferences.rs` la lectura tolerante: archivo ausente, vacío, JSON inválido o `formatVersion` mayor que 1 devuelven los valores por defecto con `recovered: true` y `recoveredReason`, guardan copia del original con sufijo `.bak` y registran la causa con ámbito `preferences` (depende de T014, T015)
- [X] T017 Implementar en `src-tauri/src/preferences.rs` la validación campo a campo: un `theme` desconocido se reemplaza por `"system"` sin descartar los demás campos válidos del archivo (depende de T015)
- [X] T018 Implementar en `src-tauri/src/preferences.rs` la escritura atómica (archivo temporal más renombrado) que devuelve `preferences_write_failed` cuando no se puede escribir (depende de T015)
- [X] T019 [P] Escribir pruebas de preferencias en `src-tauri/src/preferences.rs` (módulo `#[cfg(test)]`): valores por defecto, archivo dañado con copia `.bak`, `formatVersion` futura, `theme` inválido con el resto intacto, e ida y vuelta de guardar y volver a leer (depende de T016, T017, T018)
- [X] T020 Implementar los comandos de `contracts/commands.md` en `src-tauri/src/commands.rs`: `app_identity`, `platform_info`, `preferences_load` y `preferences_update`, cada uno devolviendo `Result<T, AppError>` con los códigos `preferences_unreadable`, `preferences_write_failed` y `window_state_failed`, sin un solo `panic!` ni `unwrap` en el camino de error (depende de T013, T016, T018)
- [X] T021 Registrar plugins, comandos y la ventana en `src-tauri/src/main.rs`, y registrar en el log con ámbito `startup` cualquier fallo de arranque sin impedir que la app abra (depende de T014, T020)
- [X] T022 Declarar los tipos compartidos de la frontera en `src/lib/tauri/types.ts` (`Preferences`, `PreferencesLoadResult`, `AppIdentity`, `PlatformInfo`, `AppError`), exactos al contrato
- [X] T023 Escribir los envoltorios tipados en `src/lib/tauri/commands.ts`, único archivo del proyecto que usa `invoke`, con un envoltorio por comando y conversión de `AppError` a excepción tipada (depende de T022)
- [X] T024 [P] Implementar `src/lib/platform.ts` con los símbolos de modificador y los textos por sistema a partir de `platform_info` (⌘ ⌥ ⌫ en macOS; Ctrl Alt Supr en Windows)
- [X] T025 [P] Implementar `src/lib/cn.ts` para componer clases de Tailwind
- [X] T026 Crear el almacén en `src/store/preferences.ts` con Zustand: `preferences`, `effectiveTheme`, `identity`, `platform`, `isPreferencesOpen`, `loadError`, y las acciones `load`, `setTheme`, `setShowWelcomeOnStart`, `openPreferences`, `closePreferences`; el cambio de preferencia revierte el estado al valor anterior si la escritura falla (depende de T023)
- [X] T027 [P] Escribir pruebas del almacén en `src/store/preferences.test.ts`: carga con `recovered: true` que deja `loadError`, reversión al fallar la escritura, y cálculo de `effectiveTheme` para los tres valores de `theme` (depende de T026)
- [X] T028 [P] Implementar los componentes puros de `src/components/ui/` que consumen las dos pantallas —`Button.tsx`, `Checkbox.tsx`, `SegmentedControl.tsx`, `Dialog.tsx`, `Icon.tsx`, `Kbd.tsx`— sobre Radix, solo con props y tokens, sin importar de `src/store/` ni de `src/components/features/`
- [X] T029 [P] Implementar `src/components/layout/ScrollRegion.tsx`: contenedor con desplazamiento interno propio, para que la ventana nunca desplace (RS-01)
- [X] T030 Implementar `src/components/layout/AppShell.tsx` como armazón de ventana (zona de barra de título, cuerpo y pie) y envolver la app en `MotionConfig` con `reducedMotion="user"` en `src/App.tsx`, más `@media (prefers-reduced-motion: reduce)` en `src/styles/tokens.css` que anula las duraciones (depende de T028, T029)
- [X] T031 Cargar preferencias, identidad y plataforma al arrancar en `src/main.tsx` y `src/App.tsx`, antes del primer render útil, de modo que el tema correcto se aplique sin parpadeo (depende de T026, T030)

**Checkpoint**: la app abre una ventana vacía con el tema del sistema aplicado, las preferencias leídas y el registro escribiendo

---

## Phase 3: User Story 1 - Abrir la aplicación en la Bienvenida (Priority: P1) 🎯 MVP

**Goal**: la aplicación abre y muestra la Bienvenida con su identidad, sus dos acciones con atajos y la casilla que decide si vuelve a aparecer.

**Independent Test**: abrir la app en Windows y macOS y comprobar identidad, versión con fecha de compilación, atajos según sistema, recorrido completo con teclado y el efecto de la casilla tras reiniciar.

### Tests for User Story 1

- [X] T032 [P] [US1] Escribir pruebas de la Bienvenida en `src/components/features/welcome/WelcomeScreen.test.tsx`: muestra nombre, versión y fecha tal como las devuelve `app_identity`; muestra los atajos con los símbolos de la plataforma simulada; la casilla refleja y cambia `showWelcomeOnStart`
- [X] T033 [P] [US1] Escribir prueba de recorrido con teclado en `src/components/features/welcome/WelcomeScreen.keyboard.test.tsx`: tabulando se alcanzan y activan las dos acciones, la casilla y el acceso a Ajustes, con foco visible
- [X] T034 [P] [US1] Escribir prueba de decisión de arranque en `src/App.startup.test.tsx`: con `showWelcomeOnStart: false` y `lastModelPath: null` la pantalla inicial es la Bienvenida y la preferencia no cambia

### Implementation for User Story 1

- [X] T035 [US1] Implementar `src/components/features/welcome/WelcomeScreen.tsx`: icono, nombre «SQL Designer», versión con fecha formateada como `1.0.0 (2026.10.24)` a partir de `identity`, y el estado vacío de recientes reservado para el Incremento 1 (depende de T028, T031)
- [X] T036 [US1] Implementar `src/components/features/welcome/WelcomeActions.tsx` con «Nuevo modelo…» y «Abrir modelo…», habilitadas y enfocables, cada una con su `Kbd` resuelto por `src/lib/platform.ts`; al activarse muestran el aviso «Esta acción llega en el Incremento 1» y no abren ningún flujo ni crean archivos (depende de T024, T028)
- [X] T037 [US1] Implementar `src/components/features/welcome/ShowWelcomeToggle.tsx` conectado a `setShowWelcomeOnStart`, que avisa en pantalla si la escritura falló (depende de T026, T028)
- [X] T038 [US1] Implementar la decisión de arranque en `src/App.tsx`: con la casilla desmarcada y un `lastModelPath` ausente o no disponible, mostrar la Bienvenida sin modificar la preferencia (depende de T031)
- [X] T039 [US1] Mostrar el aviso de `loadError` en la Bienvenida cuando las preferencias llegaron por defecto tras un archivo dañado, con texto que explique qué pasó y que la app siguió (depende de T026, T035)
- [X] T040 [P] [US1] Registrar los atajos `⌘N`/`Ctrl+N` y `⌘O`/`Ctrl+O` en `src/hooks/useShortcut.ts` de modo que muestren el mismo aviso «Esta acción llega en el Incremento 1» que el clic, para que la pantalla no anuncie un atajo que no responde (depende de T024)

**Checkpoint**: la Bienvenida es demostrable de principio a fin con teclado y ratón en los dos sistemas

---

## Phase 4: User Story 2 - Tema claro y oscuro (Priority: P2)

**Goal**: la aplicación sigue el tema del sistema y permite forzar claro u oscuro desde Ajustes, sin reiniciar y conservando el estado de la pantalla.

**Independent Test**: arrancar con el sistema en oscuro y en claro, abrir Ajustes por las tres vías, cambiar entre los tres valores y comprobar que el cambio es inmediato, que persiste al reiniciar y que una elección explícita ignora el cambio del sistema.

### Tests for User Story 2

- [X] T041 [P] [US2] Escribir pruebas de `src/hooks/useTheme.test.ts`: con `system` el tema efectivo sigue a `matchMedia` y reacciona a su cambio; con `light` o `dark` lo ignora
- [X] T042 [P] [US2] Escribir pruebas de Ajustes en `src/components/features/preferences/PreferencesWindow.test.tsx`: los tres valores se pueden elegir, el elegido queda marcado, la ventana no muestra ninguna otra preferencia, y el control de tema se recorre y se activa solo con el teclado con foco visible (SC-004, FR-014)
- [X] T043 [P] [US2] Escribir prueba de las tres vías de apertura en `src/components/features/preferences/open-preferences.test.tsx`: atajo, evento `preferences://open` y control visible llaman a la misma acción `openPreferences`

### Implementation for User Story 2

- [X] T044 [US2] Implementar `src/hooks/useTheme.ts`: resuelve el tema efectivo desde `preferences.theme` más `matchMedia('(prefers-color-scheme: dark)')`, escucha sus cambios y escribe `data-theme` en `<html>` (depende de T026)
- [X] T045 [US2] Completar el bloque oscuro de `src/styles/tokens.css` y revisar que ningún componente de `src/components/` contenga un color, sombra, radio o duración literal (depende de T004, T028)
- [X] T046 [US2] Implementar `src/components/features/preferences/PreferencesWindow.tsx` con un `SegmentedControl` de Sistema / Claro / Oscuro y nada más, conectado a `setTheme` (depende de T028, T044)
- [X] T047 [US2] Añadir al comando de preferencias el aviso al sistema del tema elegido en `src-tauri/src/commands.rs`, para que el cromo nativo acompañe al tema de la interfaz (depende de T020)
- [X] T048 [US2] Construir el menú nativo de aplicación en `src-tauri/src/main.rs` con el elemento Preferencias y su acelerador `Cmd+,` en macOS, que emite el evento `preferences://open` (depende de T021)
- [X] T049 [US2] Escuchar `preferences://open` en `src/lib/tauri/events.ts` y conectarlo a `openPreferences` del almacén (depende de T023, T026)
- [X] T050 [US2] Implementar el atajo `Ctrl+,` para Windows en `src/hooks/useShortcut.ts` y el control visible de acceso a Ajustes en la Bienvenida, ambos llamando a la misma acción `openPreferences` (depende de T040, T049)
- [X] T051 [US2] Verificar y ajustar que el cambio de tema conserva el estado de la pantalla —casilla, foco y posición de desplazamiento— sin desmontar componentes, en `src/App.tsx` (depende de T044, T046)

**Checkpoint**: tema y Ajustes completos; US1 y US2 funcionan por separado

---

## Phase 5: User Story 3 - Ventana y desplazamiento estables (Priority: P3)

**Goal**: la ventana se comporta como la de cada sistema, respeta su tamaño mínimo, recuerda tamaño y posición, y solo desplaza la sección que no cabe.

**Independent Test**: reducir la ventana al mínimo, comprobar el desplazamiento por sección, comparar los controles con la convención de cada sistema, y mover, cerrar y reabrir con y sin el segundo monitor conectado.

### Tests for User Story 3

- [X] T052 [P] [US3] Escribir pruebas de recorte de geometría en `src-tauri/src/window_state.rs` (módulo `#[cfg(test)]`): rectángulo dentro del área visible intacto, rectángulo fuera reposicionado al monitor principal, tamaño mayor que el área recortado, y nunca por debajo de 820 × 500
- [X] T053 [P] [US3] Escribir prueba de `src/components/layout/ScrollRegion.test.tsx`: el contenido que no cabe desplaza dentro de la región y no propaga el desplazamiento al documento

### Implementation for User Story 3

- [X] T054 [US3] Registrar `tauri-plugin-window-state` en `src-tauri/src/main.rs` con las banderas limitadas a tamaño y posición (`StateFlags::SIZE | StateFlags::POSITION`), dejando fuera la de maximizado tanto al guardar como al restaurar (depende de T021)
- [X] T055 [US3] Implementar el recorte al área visible en `src-tauri/src/window_state.rs` y el comando `window_apply_saved_geometry` que devuelve `applied` y `clamped`, convirtiendo píxeles físicos a lógicos antes de comparar con el mínimo (depende de T020, T054)
- [X] T056 [US3] Implementar `src/components/layout/Titlebar.tsx` con los controles propios de la ventana: cerrar y minimizar arriba a la izquierda en los dos sistemas, círculos de 12 px con tokens, símbolo al pasar el cursor y `aria-label`; sin maximizar (depende de T028, T030)
- [X] T057 [US3] Implementar el comando `window_controls` en `src-tauri/src/commands.rs` con las acciones `minimize`, `toggle_maximize`, `close` y `start_drag`, y su envoltorio en `src/lib/tauri/commands.ts` (depende de T020, T023)
- [X] T058 [US3] Pasar la Bienvenida y Ajustes a `ScrollRegion` donde su contenido puede no caber, y comprobar en `src/components/layout/AppShell.tsx` que el documento nunca desplaza (SC-005) (depende de T029, T035, T046)

**Checkpoint**: las tres historias funcionan de forma independiente

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: cerrar las verificaciones pendientes y las puertas de calidad de la constitución

- [X] T059 [P] Confirmar el cromo de ventana en Tauri 2: la ventana va sin decoración y transparente en los dos sistemas (`decorations: false`, `transparent: true`, `macOSPrivateApi: true` y la feature `macos-private-api` de `tauri`), y el marco redondeado con su filo lo dibuja `src/components/layout/AppShell.tsx`
- [X] T060 [P] Confirmar que `tauri-plugin-window-state` guarda el tamaño en píxeles físicos en la versión usada y validar la conversión de `src-tauri/src/window_state.rs` (anotado en `research.md` §3)
- [X] T061 [P] Confirmar el nombre del evento de cambio de tema del sistema y la firma de `setTheme` en la API de ventana de Tauri 2, y ajustar `src/hooks/useTheme.ts` y `src-tauri/src/commands.rs` (anotado en `research.md` §4)
- [X] T062 Añadir la comprobación de la puerta 7 de la constitución como script en `scripts/check-layers.mjs` y conectarlo a `npm run lint`: ningún archivo de `src/components/ui/` importa de `src/store/` ni de `src/components/features/`, y `invoke` solo aparece en `src/lib/`
- [X] T063 [P] Revisar el contraste de texto en los dos temas y corregir los tokens que no alcancen 4.5:1, incluidas las etiquetas secundarias (SC-006)
- [X] T064 [P] Medir SC-001 y SC-003 sobre un binario empaquetado en macOS y anotar los números en `specs/001-base-aplicacion/quickstart.md` — hecho el 2026-10-26: SC-001 máximo 997 ms de 2000, SC-003 46 ms de 1000. La medida la escribe el propio binario cuando se arranca con `SQL_DESIGNER_MEDIR=1` (`src-tauri/src/measure.rs`). Windows se separó en T069
- [X] T065 Ejecutar el recorrido de `specs/001-base-aplicacion/quickstart.md` en macOS — hecho el 2026-10-26: tema, ventana y teclado de las Historias 1 a 3, más los estados de error de preferencias dañadas y borradas. Lo que quedó sin probar en macOS está en T071; Windows, en T070
- [X] T066 [P] Actualizar `README.md` con cómo arrancar, cómo probar y dónde viven las preferencias y el registro en cada sistema
- [X] T067 [P] Revisar que toda cadena visible de `src/components/` esté en español y sin texto de plantilla en inglés, y que los símbolos de atajo salgan de `src/lib/platform.ts` y no escritos a mano (FR-015, RS-12)
- [ ] T069 [P] Medir SC-001 y SC-003 sobre un binario empaquetado en Windows y añadir la fila a la tabla de «Resultados medidos» de `specs/001-base-aplicacion/quickstart.md`. Bloqueado: no hubo máquina Windows al cerrar el incremento el 2026-10-26
- [ ] T070 Ejecutar el recorrido de `specs/001-base-aplicacion/quickstart.md` en Windows, incluidos los estados de error. Bloqueado por la misma razón que T069
- [ ] T071 Completar en macOS lo que quedó fuera del recorrido del 2026-10-26: segundo monitor, «reducir movimiento», revisión de contraste (SC-006), la casilla entre reinicios, el arranque con la red desconectada (SC-009) y SC-002 con una persona ajena
- [X] T068 [P] Revisar que todo símbolo de `src/` y de `src-tauri/src/` creado en este incremento lleve su bloque de documentación en español —JSDoc en TypeScript, `///` en Rust—, breve y acorde a lo que hace: una línea de qué hace, `@param`/`@returns`/`@throws` solo cuando la firma no lo deja claro, y en los procesos de varios pasos (`src-tauri/src/preferences.rs`, `src-tauri/src/window_state.rs`, `src/store/preferences.ts`) el orden de los pasos en cinco líneas o menos (puerta 8 de la constitución)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Fase 1)**: sin dependencias. T002 antes de T003, T006 y T007; T008 antes de T009, T010 y T011
- **Foundational (Fase 2)**: depende de la Fase 1 completa. **Bloquea las tres historias**
- **User Stories (Fases 3 a 5)**: todas dependen de la Fase 2. US1 no depende de US2 ni de US3; US2 y US3 tampoco entre sí
- **Polish (Fase 6)**: depende de las historias que se quieran entregar

### Dependencias no obvias

- T016 (lectura tolerante) necesita T014 (registro) y no al revés: el archivo dañado tiene que poder registrarse, así que el registro se monta primero
- T031 (cargar preferencias antes del primer render) es lo que evita el parpadeo de tema; si se deja para después, US2 parecerá roto aunque `useTheme` esté bien
- T048 (menú nativo en Rust) habilita T049 y T050: las tres vías de FR-020 convergen en `openPreferences`, así que el evento debe existir antes de conectar atajo y control visible
- T055 (recorte) depende de T054: el plugin restaura primero y el recorte corrige después; invertirlo deja la ventana fuera de pantalla un instante
- T058 toca archivos de US1 y US2, así que va al final de la Fase 5 aunque pertenezca a US3
- T059 a T061 pueden invalidar decisiones de T009, T044 y T055; conviene hacerlas antes de pulir estilos para no repetir el ajuste visual

### Within Each User Story

- Las pruebas de cada historia se escriben antes de su implementación y deben fallar primero
- Rust antes del frontend cuando la pantalla consume un comando nuevo
- Pantalla antes de la integración con el almacén

### Parallel Opportunities

- Fase 1: T003, T004, T005, T006, T007 en paralelo tras T002; T010 y T011 tras T008
- Fase 2: T013 y T014 en paralelo; T024, T025, T028 y T029 en paralelo; T019 y T027 en paralelo con la implementación de la otra capa
- Fase 3: T032, T033 y T034 en paralelo
- Fase 4: T041, T042 y T043 en paralelo
- Fase 5: T052 y T053 en paralelo
- Fase 6: T059, T060, T061, T063, T064, T066, T067 y T068 en paralelo
- Con varias personas, US1, US2 y US3 avanzan a la vez una vez cerrada la Fase 2

---

## Parallel Example: User Story 1

```bash
# Pruebas de US1, juntas:
Task: "Pruebas de la Bienvenida en src/components/features/welcome/WelcomeScreen.test.tsx"
Task: "Prueba de recorrido con teclado en src/components/features/welcome/WelcomeScreen.keyboard.test.tsx"
Task: "Prueba de decisión de arranque en src/App.startup.test.tsx"
```

---

## Implementation Strategy

### MVP First (solo US1)

1. Fase 1 completa
2. Fase 2 completa (crítica: bloquea todo)
3. Fase 3 completa
4. **PARAR Y VALIDAR**: la Bienvenida se demuestra sola en los dos sistemas
5. Entregar o demostrar

### Entrega incremental

1. Setup + Foundational → base lista
2. US1 → validar → demo (MVP)
3. US2 → validar → demo
4. US3 → validar → demo
5. Fase 6 → cerrar verificaciones y puertas de calidad

### Equipo en paralelo

Cerrada la Fase 2: una persona en US1, otra en US2, otra en US3. T058 se coordina al final
porque toca archivos de las tres.

---

## Notes

- Las tareas con [P] tocan archivos distintos y no dependen entre sí
- La etiqueta [Story] solo aparece en las fases de historia; Setup, Foundational y Polish no la llevan
- Confirmar que cada prueba falla antes de implementar lo que la hace pasar
- `invoke` solo en `src/lib/`; `src/components/ui/` no importa de `src/store/` ni de `features/` (puerta 7, verificada por T062)
- Ningún valor literal de color, sombra, radio o duración fuera de los tokens
- Commit por tarea o por grupo lógico; parar en cada checkpoint para validar
