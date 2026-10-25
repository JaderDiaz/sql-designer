# Contrato · Comandos de Tauri (Incremento 0)

La única interfaz entre el frontend y el sistema operativo. Cada comando se invoca desde
un envoltorio tipado de `src/lib/tauri/`; `invoke` no aparece en ningún otro sitio
(principios III y VII de la constitución).

Convenciones:

- Nombres de comando en `snake_case`; campos de payload en `camelCase` (serde los
  renombra), para que el tipo de TypeScript sea el mismo objeto sin adaptadores.
- Ningún comando entra en pánico. Todo fallo vuelve como `Err(AppError)`, que el
  envoltorio convierte en una excepción tipada.
- `AppError`: `{ "code": string, "message": string }`. Códigos de este incremento:
  `preferences_unreadable`, `preferences_write_failed`, `window_state_failed`.

## `app_identity`

Devuelve la identidad del binario. Sin argumentos.

```json
{ "name": "SQL Designer", "version": "1.0.0", "buildDate": "2026.10.24" }
```

- Nunca falla: los tres valores están incrustados en el binario.
- Cubre FR-002.

## `platform_info`

Devuelve el sistema y los símbolos de modificador. Sin argumentos.

```json
{ "os": "macos", "modifierSymbols": { "meta": "⌘", "alt": "⌥", "del": "⌫" } }
```

- Nunca falla. Cubre FR-003 y RS-12.

## `preferences_load`

Lee las preferencias al arrancar. Sin argumentos.

```json
{
  "preferences": {
    "formatVersion": 1,
    "theme": "system",
    "showWelcomeOnStart": true,
    "window": { "x": 120, "y": 80, "width": 1440, "height": 900 },
    "lastModelPath": null
  },
  "recovered": false,
  "recoveredReason": null
}
```

- `recovered: true` con `recoveredReason` cuando el archivo faltaba, estaba dañado o era
  de una versión futura: la respuesta trae los valores por defecto y la causa quedó en el
  registro y en la copia `.bak`.
- No falla por un archivo ilegible; eso es `recovered`, no error (FR-016).
- Cubre FR-005, FR-009, FR-016, FR-018.

## `preferences_update`

Guarda un cambio parcial. Argumento: un objeto con los campos a modificar.

```json
{ "patch": { "theme": "dark" } }
```

Respuesta: las preferencias completas ya persistidas, con la misma forma que
`preferences_load.preferences`.

- Escritura atómica; devuelve `preferences_write_failed` si no se pudo escribir, y en ese
  caso el estado en memoria se revierte al valor anterior y la pantalla avisa.
- Campos admitidos en este incremento: `theme`, `showWelcomeOnStart`.
- Cubre FR-005, FR-008, FR-009.

## `window_apply_saved_geometry`

Restaura tamaño y posición guardados, recortados al área visible. Sin argumentos.

```json
{ "applied": true, "clamped": false }
```

- `clamped: true` cuando el rectángulo guardado no cabía en los monitores conectados y la
  ventana se reposicionó al principal.
- `applied: false` cuando no había geometría recordada: la ventana abre centrada con su
  tamaño por defecto.
- Cubre FR-013 y FR-018.

## `window_controls`

Acciones de los controles propios de la barra de título. Argumento:

```json
{ "action": "minimize" }
```

- Acciones: `minimize`, `toggle_maximize`, `close`, `start_drag`.
- En macOS no se usa para minimizar, maximizar ni cerrar —esos son los botones nativos—
  pero `start_drag` sí, para la zona arrastrable.
- Cubre FR-012.

## Evento `preferences://open`

No es un comando: es el evento que emite el menú nativo de macOS al activar Preferencias.
El frontend lo escucha en `src/lib/tauri/` y llama a la misma acción del almacén que el
atajo y el control visible de la Bienvenida, de modo que las tres vías de FR-020 no se
desincronizan.
