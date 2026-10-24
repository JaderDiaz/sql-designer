# Fase 1 · Modelo de datos: Base de la aplicación (Incremento 0)

**Fecha**: 2026-10-24 · **Plan**: [plan.md](./plan.md) · **Contratos**: [commands.md](./contracts/commands.md), [preferences.schema.json](./contracts/preferences.schema.json)

Este incremento no toca el modelo de base de datos del producto: no hay esquemas, tablas
ni relaciones todavía. Lo que sí existe es el estado de la instalación.

## Preferencias de la aplicación

Un único registro, persistido en `preferences.json` dentro del directorio de
configuración de la aplicación. Rust es su dueño; el frontend solo lo lee y lo escribe a
través de comandos.

| Campo | Tipo | Por defecto | Reglas |
|-------|------|-------------|--------|
| `formatVersion` | entero | `1` | Obligatorio. Un valor mayor que el soportado se trata como archivo no legible: valores por defecto y entrada en el registro |
| `theme` | `"system"` \| `"light"` \| `"dark"` | `"system"` | Cualquier otro valor se reemplaza por `"system"` |
| `showWelcomeOnStart` | booleano | `true` | FR-005, FR-006 |
| `window` | objeto o nulo | `null` | Geometría; `null` significa «sin geometría recordada»: la ventana abre centrada con su tamaño por defecto |
| `window.x`, `window.y` | entero | — | Posición en píxeles. Al restaurar se recorta al área visible de los monitores conectados (FR-018) |
| `window.width`, `window.height` | entero | — | Tamaño en píxeles. Nunca por debajo del mínimo (1024 × 720 lógicos) |
| `lastModelPath` | cadena o nulo | `null` | Ruta absoluta del último modelo abierto. En este incremento solo se lee y se preserva; ninguna pantalla la escribe todavía |

**Invariantes**

- Escritura atómica: archivo temporal y renombrado. Nunca se deja un archivo a medias.
- Lectura tolerante: archivo ausente, vacío, no válido o de versión futura ⇒ valores por
  defecto, copia del original con sufijo `.bak` y entrada en el registro (FR-016).
- `theme` y `showWelcomeOnStart` se validan por separado: un campo inválido no descarta
  los demás campos válidos del archivo.
- Las preferencias no pertenecen a ningún modelo; sobreviven a abrir y cerrar modelos
  (RS-10 reserva el motor por defecto para un incremento posterior).

**Transiciones de estado relevantes**

- `theme`: `system → light → dark → system` por elección del usuario en Ajustes. Con
  `system`, el tema efectivo cambia cuando lo hace el del sistema operativo; con `light`
  o `dark`, el tema efectivo es fijo (FR-009).
- `showWelcomeOnStart`: `true ⇄ false` desde la casilla de la Bienvenida. Con `false` y
  `lastModelPath` ausente o no disponible, el arranque muestra la Bienvenida sin cambiar
  la preferencia (FR-006).
- `window`: `null → {x, y, width, height}` al cerrar por primera vez con geometría
  válida; después se actualiza en cada cierre.

## Identidad de la aplicación

Valor de solo lectura, derivado del binario; no se persiste ni se puede editar.

| Campo | Tipo | Origen |
|-------|------|--------|
| `name` | cadena | Fijo: `SQL Designer` |
| `version` | cadena | Versión declarada en `src-tauri/tauri.conf.json` |
| `buildDate` | cadena `AAAA.MM.DD` | Inyectada en la compilación por `src-tauri/build.rs` (FR-002) |

La Bienvenida muestra `version` y `buildDate` como `1.0.0 (2026.10.24)`; el formateo es
responsabilidad de la pantalla, no del comando.

## Plataforma

Valor de solo lectura que el frontend necesita para los textos y los símbolos de atajo
(RS-12). Lo resuelve Rust para no repartir suposiciones por los componentes.

| Campo | Tipo | Valores |
|-------|------|---------|
| `os` | `"macos"` \| `"windows"` | Sistema en ejecución |
| `modifierSymbols` | objeto | `{ meta, alt, del }`: `⌘ ⌥ ⌫` en macOS; `Ctrl Alt Supr` en Windows |

## Entrada de registro

Una línea por suceso en el archivo de registro del directorio de logs de la aplicación.
No es un dato que la interfaz lea.

| Campo | Tipo | Notas |
|-------|------|-------|
| `timestamp` | fecha y hora | Local, con desplazamiento |
| `level` | `"warn"` \| `"error"` | En este incremento solo se registran avisos y errores |
| `scope` | cadena | `startup`, `preferences`, `window-state` |
| `message` | cadena | Descripción legible, sin datos del usuario más allá de la ruta implicada |

## Estado en memoria (almacén Zustand)

No se persiste; se deriva de lo anterior. Vive en `src/store/preferences.ts`.

| Campo | Tipo | Notas |
|-------|------|-------|
| `preferences` | Preferencias | Copia cargada al arrancar |
| `effectiveTheme` | `"light"` \| `"dark"` | Resultado de `theme` más el tema del sistema |
| `identity` | Identidad | Del comando `app_identity` |
| `platform` | Plataforma | Del comando `platform_info` |
| `isPreferencesOpen` | booleano | Interfaz efímera: las tres vías de apertura de Ajustes lo ponen a `true` |
| `loadError` | cadena o nulo | Mensaje si las preferencias llegaron por defecto tras un archivo dañado |
