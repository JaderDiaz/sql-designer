# Contrato · Comandos de Tauri (Incremento 1)

Amplía el contrato del Incremento 0 (`specs/001-base-aplicacion/contracts/commands.md`),
que sigue vigente. Mismas convenciones:

- Nombres de comando en `snake_case`; campos del payload en `camelCase` (serde los
  renombra), para que el tipo de TypeScript sea el mismo objeto sin adaptadores.
- Ningún comando entra en pánico. Todo fallo vuelve como `Err(AppError)` y el
  envoltorio de `src/lib/tauri/commands.ts` lo convierte en `CommandError`.
- `invoke` solo aparece en `src/lib/tauri/` (principios III y VII).
- **Concurrencia**: todo comando que toque el disco, la papelera, el gestor de
  archivos o el portapapeles se declara `async fn`, para que Tauri lo ejecute fuera
  del hilo principal. Un comando síncrono bloquea el webview mientras corre, y
  listar una carpeta grande o leer un modelo de 50 tablas tardan lo suficiente para
  notarse (principio III, FR-042). Los comandos del Incremento 0 son triviales y se
  quedan como están.

## Códigos de error nuevos

| Código | Cuándo |
| ------ | ------ |
| `path_not_found` | La ruta no existe o se borró entre dos operaciones |
| `path_not_a_directory` | Se pidió listar algo que no es una carpeta |
| `path_denied` | El sistema negó el acceso (permiso, carpeta protegida) |
| `path_invalid` | Nombre de archivo o carpeta vacío, con separadores o reservado |
| `path_exists` | Ya existe un archivo o carpeta con ese nombre |
| `model_read_failed` | El archivo existe pero no se pudo leer |
| `model_write_failed` | No se pudo escribir (disco, permiso, renombrado) |
| `model_stale` | El archivo cambió en el disco desde la última lectura o escritura (FR-025) |
| `recents_write_failed` | No se pudo persistir `recents.json` |
| `trash_unavailable` | El sistema no pudo mover el archivo a la papelera |
| `system_command_failed` | Falló revelar en el gestor de archivos o escribir en el portapapeles |

Los códigos del Incremento 0 (`preferences_unreadable`, `preferences_write_failed`,
`window_state_failed`) no cambian.

## Tipos compartidos

```ts
/** Sello del archivo en disco; identifica la versión que se leyó o escribió. */
interface FileStamp { modifiedMs: number; sizeBytes: number }

/** Una entrada de carpeta tal como la devuelve `fs_list_directory`. */
interface DirectoryEntry {
  name: string
  path: string
  isDirectory: boolean
  sizeBytes: number
  modifiedMs: number
  isModel: boolean      // true para los `.yaml`
}
```

## `fs_user_places`

Ubicaciones del usuario. Sin argumentos. Devuelve solo las que existen (R6).

```json
[
  { "id": "recents",  "label": "Recientes",   "icon": "clock",             "path": null,              "canCreateFolder": false },
  { "id": "desktop",  "label": "Escritorio",  "icon": "monitor",           "path": "/Users/x/Desktop","canCreateFolder": true },
  { "id": "documents","label": "Documentos",  "icon": "file-text",         "path": "/Users/x/Documents","canCreateFolder": true },
  { "id": "downloads","label": "Descargas",   "icon": "circle-arrow-down", "path": "/Users/x/Downloads","canCreateFolder": true },
  { "id": "home",     "label": "Inicio",      "icon": "folder",            "path": "/Users/x",        "canCreateFolder": true },
  { "id": "icloud",   "label": "iCloud Drive","icon": "cloud",             "path": "/Users/x/Library/Mobile Documents/com~apple~CloudDocs", "canCreateFolder": true },
  { "id": "root",     "label": "Macintosh HD","icon": "hard-drive",        "path": "/",               "canCreateFolder": false }
]
```

- `recents` es virtual: su contenido lo arma el frontend con `recents_list`.
- En Windows `root` es la unidad del sistema («Disco local (C:)») y no hay `icloud`.
- Nunca falla: una ubicación que no se puede resolver simplemente no se lista.
- Cubre FR-007 y FR-012.

## `fs_list_directory`

Contenido de una carpeta.

```json
{ "path": "/Users/x/Proyectos/livy", "only": "folders" }
```

- `only`: `"folders"` (Elegir carpeta), `"models"` (Abrir modelo: carpetas y
  `.yaml`) o `"all"`.
- Respuesta: lista de `DirectoryEntry` ordenada con las carpetas primero y después
  por nombre, con orden natural e insensible a mayúsculas.
- Se omiten los archivos ocultos y los que el sistema no deja leer.
- Errores: `path_not_found`, `path_not_a_directory`, `path_denied`.
- Cubre FR-007, FR-009, FR-012.

## `fs_create_directory`

Crea una carpeta y devuelve el nombre real, ya desambiguado.

```json
{ "parent": "/Users/x/Proyectos", "name": "carpeta sin título" }
```

Respuesta: `{ "name": "carpeta sin título 2", "path": "/Users/x/Proyectos/carpeta sin título 2" }`

- Si el nombre ya existe, se numera (` 2`, ` 3`, …) hasta encontrar uno libre: la
  numeración la decide Rust, no la interfaz (FR-010).
- Errores: `path_invalid` (nombre vacío o con separadores), `path_denied`,
  `path_not_found` (el padre ya no está).
- Cubre FR-010.

## `path_build_model`

Arma la ruta final del archivo del modelo y dice si ya existe. El frontend nunca
concatena separadores ni añade la extensión (R9).

```json
{ "folder": "/Users/x/Proyectos/livy", "fileStem": "livy-reservas" }
```

Respuesta: `{ "path": "/Users/x/Proyectos/livy/livy-reservas.yaml", "fileName": "livy-reservas.yaml", "exists": false }`

- `fileStem` llega ya saneado por `src/lib/model/slug.ts`; Rust rechaza con
  `path_invalid` si trae separadores, está vacío o es un nombre reservado.
- `exists: true` es lo que bloquea «Crear modelo» con el error de archivo repetido.
- Cubre FR-002 y FR-003.

## `model_read`

Lee el archivo del modelo como texto, con su sello. Rust no interpreta el YAML (R1).

```json
{ "path": "/Users/x/Proyectos/livy/modelo.yaml" }
```

Respuesta: `{ "text": "formatVersion: 1\nname: …", "stamp": { "modifiedMs": 1761500000000, "sizeBytes": 28672 } }`

- Errores: `path_not_found`, `model_read_failed`, `path_denied`.
- Un archivo que no parsea **no** es un error de este comando: el texto vuelve bien
  y la validación del frontend decide (FR-016).
- Cubre FR-013, FR-015, FR-016.

## `model_write`

Escribe el archivo de forma atómica: temporal en el mismo directorio y renombrado.

```json
{
  "path": "/Users/x/Proyectos/livy/modelo.yaml",
  "text": "formatVersion: 1\nname: …",
  "expectedStamp": { "modifiedMs": 1761500000000, "sizeBytes": 28672 }
}
```

Respuesta: `{ "stamp": { "modifiedMs": 1761500090000, "sizeBytes": 28700 } }`

- `expectedStamp` ausente o `null` = crear un archivo nuevo; si entonces el archivo
  ya existe, devuelve `path_exists`.
- Si el sello del disco no coincide con `expectedStamp`, **no escribe** y devuelve
  `model_stale` (FR-025). El frontend pregunta y, si el usuario elige sobrescribir,
  repite la llamada con `"force": true`.
- Errores: `model_write_failed`, `path_not_found` (la carpeta ya no está),
  `path_denied`, `model_stale`, `path_exists`.
- Nunca deja el archivo anterior truncado (FR-022).
- Cuando la carpeta del destino ya no existe devuelve `path_not_found`; el frontend
  ofrece entonces elegir otra carpeta y repite la llamada con la ruta nueva y sin
  `expectedStamp` (FR-045).
- Cubre FR-005, FR-021 a FR-025 y FR-045.

## `model_stat`

Estado en disco de varias rutas, de una sola llamada. Para las marcas de Recientes.

```json
{ "paths": ["/Users/x/a.yaml", "/Users/x/b.yaml"] }
```

Respuesta: `[{ "path": "/Users/x/a.yaml", "exists": true, "stamp": { "modifiedMs": 1761500000000, "sizeBytes": 28672 } }, { "path": "/Users/x/b.yaml", "exists": false, "stamp": null }]`

- Nunca falla: una ruta inaccesible vuelve como `exists: false`.
- Cubre FR-031.

## `recents_list`

Lista de recientes con el estado del archivo ya resuelto. Sin argumentos.

```json
[
  {
    "path": "/Users/x/Proyectos/livy/modelo.yaml",
    "name": "Livy · Modelo de datos",
    "engine": "postgres",
    "tables": 6,
    "usedAtMs": 1761500000000,
    "stamp": { "modifiedMs": 1761500000000, "sizeBytes": 28672 },
    "invalid": false,
    "exists": true,
    "diskStamp": { "modifiedMs": 1761500000000, "sizeBytes": 28672 }
  }
]
```

- Ordenada por `usedAtMs` descendente, máximo 10 entradas.
- `exists` y `diskStamp` vienen del disco; `stamp` e `invalid` son del caché. Si
  difieren, el frontend revalida esa entrada en segundo plano (R5).
- No falla por un `recents.json` dañado: se recupera con copia `.bak`, devuelve lista
  vacía y deja la causa en el registro.
- Cubre FR-029, FR-031.

## `recents_touch`

Registra o actualiza una entrada y la pone primera.

```json
{
  "entry": {
    "path": "/Users/x/Proyectos/livy/modelo.yaml",
    "name": "Livy · Modelo de datos",
    "engine": "postgres",
    "tables": 6,
    "stamp": { "modifiedMs": 1761500090000, "sizeBytes": 28700 },
    "invalid": false
  }
}
```

Respuesta: la lista completa, con la misma forma que `recents_list`.

- Se llama al crear, al abrir y al guardar; también después de revalidar una entrada
  para refrescar su caché.
- Una ruta ya presente se actualiza en sitio; al pasar de 10 se descarta la más
  antigua (FR-029, FR-032).
- Error: `recents_write_failed`.

## `recents_remove`

Quita una entrada de la lista. El archivo no se toca.

```json
{ "path": "/Users/x/Clientes/acme/inventario.yaml" }
```

Respuesta: la lista completa. Error: `recents_write_failed`. Cubre FR-034.

## `trash_move`

Mueve el archivo a la papelera del sistema (crate `trash`, R7).

```json
{ "path": "/Users/x/Proyectos/livy/facturacion.yaml" }
```

Respuesta: `null`.

- Errores: `path_not_found`, `trash_unavailable`, `path_denied`. Cuando falla, el
  archivo sigue donde estaba y la entrada **no** se quita de la lista.
- El frontend llama después a `recents_remove`. Cubre FR-035, RS-08.

## `reveal_in_file_manager`

Abre el gestor de archivos del sistema con el archivo seleccionado.

```json
{ "path": "/Users/x/Proyectos/livy/facturacion.yaml" }
```

Respuesta: `null`. `open -R` en macOS, `explorer /select,` en Windows (R8).

- Errores: `path_not_found`, `system_command_failed`.
- Es la salida «Mostrar en Finder» / «Mostrar en el Explorador» del diálogo de
  archivo con errores. Cubre FR-016.

## `clipboard_write_text`

Escribe texto en el portapapeles del sistema.

```json
{ "text": "/Users/x/Proyectos/livy/modelo.yaml" }
```

Respuesta: `null`. `pbcopy` en macOS, `Set-Clipboard` en Windows (R8).

- Error: `system_command_failed`. Cubre FR-034 («Copiar ruta»).

## `preferences_update` · campos nuevos

El comando no cambia de forma; su `patch` acepta tres campos más (R18):

```json
{ "patch": { "engine": "mysql", "lastFolder": "/Users/x/Proyectos/livy", "lastModelPath": "/Users/x/Proyectos/livy/modelo.yaml" } }
```

- `engine`: motor por defecto de los modelos nuevos (FR-004).
- `lastFolder`: carpeta inicial del diálogo Nuevo modelo.
- `lastModelPath`: último modelo usado; ya existía en el archivo y ahora se escribe
  de verdad al abrir y al guardar.
- `formatVersion` sigue en `1`: los campos ausentes caen a su valor por defecto.

## `measure_model_opened` · `measure_model_saved`

Anotan milisegundos para SC-002 y SC-003, y solo cuando el binario arrancó con
`SQL_DESIGNER_MEDIR=1` (R15).

```json
{ "millis": 840, "tables": 50 }
```

Respuesta: los milisegundos anotados, o `null` si la medida está apagada. Nunca
fallan.

## Permisos (`src-tauri/capabilities/default.json`)

Los comandos propios no necesitan permiso: pasan por `invoke_handler`. Este
incremento **no añade permisos nuevos**, porque el acceso al disco, la papelera, el
gestor de archivos y el portapapeles se hacen desde código propio de Rust y no por
plugins. Si una tarea introdujera un plugin, tendría que justificar su permiso aquí.
