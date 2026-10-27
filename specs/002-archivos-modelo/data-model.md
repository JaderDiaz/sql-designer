# Fase 1 · Modelo de datos (Incremento 1 · Archivos de modelo)

Tres cosas se describen aquí: el **archivo del modelo** (`.yaml`, formato `1`), el
**archivo de recientes** (`recents.json`) y el **estado en memoria** del almacén.
El esquema formal del archivo del modelo está en
[`contracts/model.schema.json`](./contracts/model.schema.json) y el de recientes en
[`contracts/recents.schema.json`](./contracts/recents.schema.json).

## 1. Archivo del modelo (`.yaml`, formato 1)

Es la única fuente de verdad (principio II). Los tipos de TypeScript que lo
representan viven en `src/lib/model/types.ts` y son los mismos que usan validador,
serializador y almacén.

### Documento raíz · `Model`

| Campo | Tipo | Obligatorio | Regla |
| ----- | ---- | ----------- | ----- |
| `formatVersion` | entero | sí | Debe ser `1`. Un valor mayor se rechaza con «archivo de una versión más nueva» (FR-025); otro valor es archivo con errores |
| `name` | texto | sí | Nombre legible del modelo, 1–120 caracteres, sin saltos de línea. No tiene por qué coincidir con el nombre del archivo |
| `engine` | `postgres` \| `mysql` \| `sqlite` | sí | Viaja con el modelo; el motor de Ajustes solo fija el inicial (FR-006, RS-10) |
| `schemas` | lista de `Schema` | sí | Puede estar vacía: así nace un modelo nuevo. Nombres técnicos únicos dentro del modelo |
| `enums` | lista de `Enum` | no | Por defecto lista vacía |
| `tables` | lista de `Table` | no | Por defecto lista vacía. Nombres técnicos únicos dentro del modelo (RS-03) |
| `relations` | lista de `Relation` | no | Por defecto lista vacía |
| `views` | lista de `View` | no | Por defecto lista vacía |

El orden de las claves al escribir es el de esta tabla, y el de cada lista es el del
modelo en memoria: así la ida y vuelta de la puerta 3 compara textos iguales.

### `Schema`

| Campo | Tipo | Obligatorio | Regla |
| ----- | ---- | ----------- | ----- |
| `name` | texto | sí | Nombre técnico: minúsculas, números y guion bajo, no empieza por número (RS-03) |
| `abbreviation` | texto | sí | Exactamente 3 letras mayúsculas (RS-04) |
| `color` | texto | no | Identificador de token de color del esquema; lo fija el Incremento 2 |
| `comment` | texto | no | Descripción libre |

**Esquema por defecto de un modelo nuevo** (FR-005):

| Motor | `name` | `abbreviation` |
| ----- | ------ | -------------- |
| PostgreSQL | `public` | `PUB` |
| MySQL | nombre técnico del modelo (el mismo texto que el nombre de archivo, con `-` convertido a `_`) | primeras 3 letras en mayúsculas de ese nombre, rellenadas con `X` si tiene menos |
| SQLite | `main` | `MAI` |

### `Table`

| Campo | Tipo | Obligatorio | Regla |
| ----- | ---- | ----------- | ----- |
| `name` | texto | sí | Nombre técnico (RS-03), único en el modelo |
| `schema` | texto | sí | Debe ser el `name` de un esquema existente |
| `comment` | texto | no | |
| `fields` | lista de `Field` | sí | Al menos uno; nombres únicos dentro de la tabla |
| `primaryKey` | lista de texto | no | Nombres de campos de esta tabla |
| `uniques` | lista de `{ name, fields }` | no | |
| `indexes` | lista de `{ name, fields }` | no | |
| `position` | `{ x, y }` números | no | Posición en el lienzo; la usa el Incremento 2 |

### `Field`

| Campo | Tipo | Obligatorio | Regla |
| ----- | ---- | ----------- | ----- |
| `name` | texto | sí | Nombre técnico (RS-03) |
| `type` | texto | sí | Tipo tal como lo escribe el usuario para su motor |
| `nullable` | booleano | no | Por defecto `false` |
| `default` | texto | no | |
| `comment` | texto | no | |

### `Relation`

| Campo | Tipo | Obligatorio | Regla |
| ----- | ---- | ----------- | ----- |
| `name` | texto | sí | Único en el modelo |
| `fromTable` / `fromFields` | texto / lista de texto | sí | Tabla y campos que llevan la llave foránea |
| `toTable` / `toFields` | texto / lista de texto | sí | Tabla y campos referenciados; ambas tablas deben existir |
| `onDelete` / `onUpdate` | `cascade` \| `restrict` \| `set_null` \| `no_action` | no | Por defecto `no_action` |

### `Enum` y `View`

| Entidad | Campos |
| ------- | ------ |
| `Enum` | `name` (técnico, único), `schema`, `values` (lista de texto, al menos uno), `comment` (opcional) |
| `View` | `name` (técnico, único), `schema`, `tables` (lista de nombres de tablas existentes), `comment` (opcional) |

### Reglas de validación al cargar

Las comprueba `src/lib/model/validate.ts` y cada fallo trae `path`, `message`,
`line` y `column` (FR-016):

1. El texto es YAML válido; si no, el error de la librería ya trae la línea.
2. La raíz es un mapa y `formatVersion` es `1`. Mayor → «versión más nueva».
3. Los campos obligatorios están y tienen el tipo esperado.
4. **No hay claves desconocidas** en ningún nivel (decisión R3 de `research.md`).
5. `schemas` está presente y es una lista, que puede estar vacía.
6. Nombres técnicos conformes a RS-03 y únicos donde la tabla de arriba lo exige.
7. Referencias resueltas: el `schema` de cada tabla, enum y vista existe; las tablas
   y campos de cada relación existen; los campos de `primaryKey`, `uniques` e
   `indexes` pertenecen a la tabla.

Un archivo con uno o más fallos es **archivo con errores**: no se abre y el diálogo
muestra el primero, con su línea.

### Qué escribe este incremento

Crear un modelo escribe `formatVersion`, `name`, `engine` y un único `schemas` con
el esquema por defecto. Las demás colecciones se omiten del archivo cuando están
vacías, para que un modelo nuevo sea legible a ojo. Renombrar cambia solo `name`.
Guardar vuelve a escribir el modelo completo que hay en memoria.

### Derivación del nombre de archivo

`src/lib/model/slug.ts`: NFD → quitar diacríticos → minúsculas → todo lo que no sea
`[a-z0-9]` a `-` → colapsar y recortar guiones → máximo 80 caracteres. Vacío →
error «Usa al menos una letra o un número.» Nombre reservado de Windows (`con`,
`prn`, `aux`, `nul`, `com1`–`com9`, `lpt1`–`lpt9`) → se prefija `modelo-`. La ruta
final la arma Rust con `path_build_model` (R9).

## 2. Archivo de recientes (`recents.json`)

Propiedad de Rust, en el directorio de configuración de la aplicación, junto a
`preferences.json`.

| Campo | Tipo | Regla |
| ----- | ---- | ----- |
| `formatVersion` | entero | `1` |
| `entries` | lista de `RecentEntry` | Máximo 10, de más reciente a más antigua |

### `RecentEntry`

| Campo | Tipo | Regla |
| ----- | ---- | ----- |
| `path` | texto | Ruta absoluta del archivo. Es la identidad de la entrada: no se repite |
| `name` | texto | Nombre del modelo cacheado de la última lectura o escritura |
| `engine` | `postgres` \| `mysql` \| `sqlite` | Cacheado |
| `tables` | entero ≥ 0 | Cacheado, para la línea «PostgreSQL · 6 tablas» |
| `usedAtMs` | entero | Marca de tiempo del último uso; ordena la lista |
| `stamp` | `{ modifiedMs, sizeBytes }` \| `null` | Sello del archivo cuando se cachearon los campos anteriores |
| `invalid` | booleano | `true` si la última validación falló. Se recalcula cuando el sello cambia |

**Invariantes**: la lista se ordena por `usedAtMs` descendente al leer y al escribir;
al insertar la 11.ª entrada se descarta la última (FR-032); una ruta que ya está se
actualiza en sitio y sube al primer lugar (FR-031); si el archivo falta, está vacío,
no es JSON, declara una versión futura o no es legible, se recupera con copia `.bak`,
lista vacía y la causa al registro, exactamente como `preferences.json`.

### Estado de una entrada (lo que pinta la Bienvenida)

| Estado | Cómo se determina | Qué se ve |
| ------ | ----------------- | --------- |
| `ok` | El archivo existe y `invalid` es `false` | Motor y número de tablas |
| `missing` | `exists: false` en el `stat` de `recents_list` | «No encontrado»; al abrir, diálogo con «Quitar de recientes» y «Aceptar» |
| `invalid` | `invalid: true`, o la revalidación en segundo plano falló | «Archivo con errores»; al abrir, diálogo con la línea del error |
| `stale` | El sello del disco no coincide con `stamp` | Se pinta como `ok` con los datos cacheados y se revalida tras el primer fotograma (R5) |

## 3. Estado en memoria (`src/store/index.ts`)

Un solo almacén Zustand, cinco slices (R11). Solo se listan los campos que añade
este incremento.

### Slice `preferences` (existente, ampliado)

Gana `engine` (motor por defecto de los modelos nuevos) y `lastFolder` (última
carpeta usada para crear o abrir). `lastModelPath` pasa a actualizarse de verdad al
abrir y al guardar.

### Slice `navigation`

| Campo | Tipo | Nota |
| ----- | ---- | ---- |
| `screen` | `'welcome' \| 'editor'` | Qué pantalla se pinta |
| `dialog` | `null \| 'new-model' \| 'choose-folder' \| 'open-model' \| 'rename' \| 'confirm-close' \| 'file-error' \| 'not-found' \| 'trash' \| 'stale'` | Diálogo activo; `choose-folder` se abre encima de `new-model` sin cerrarlo |
| `pendingIntent` | `null \| 'new-model' \| 'open-model' \| 'close'` | Qué hacer cuando `confirm-close` se resuelva con «Guardar» o «No guardar» (FR-030) |

### Slice `model`

| Campo | Tipo | Nota |
| ----- | ---- | ---- |
| `model` | `Model \| null` | El modelo abierto, tipado |
| `path` | `string \| null` | Ruta de su archivo |
| `stamp` | `{ modifiedMs, sizeBytes } \| null` | Sello de la última lectura o escritura; lo exige `model_write` (FR-025) |
| `isDirty` | booleano | `true` desde el primer cambio hasta el guardado (RS-07) |
| `savedAtMs` | `number \| null` | Para «Guardado · PostgreSQL · 9:12 a. m.» |
| `saveError` | `string \| null` | Mensaje visible cuando guardar falla; no borra cambios (FR-024) |
| `past` / `future` | listas de `{ model, label }` | Historial de deshacer y rehacer, con la etiqueta de qué cambió (FR-044, RS-06). En este incremento solo entra el renombrado |
| `savedModel` | `Model \| null` | El modelo tal como está en el archivo; `isDirty` es `model !== savedModel`, así que deshacer hasta el estado guardado devuelve «Guardado» |

**Transiciones del documento**:

```text
sin modelo ──crear/abrir──▶ guardado ──renombrar──▶ editado ──⌘S ok──▶ guardado
                                 ▲                     │
                                 └──⌘Z hasta el estado guardado (FR-044)
                                 │                     │
                                 │                     ├──⌘S falla──▶ editado + saveError
                                 │                     ├──⌘S con archivo cambiado──▶ editado + diálogo sobrescribir/cancelar
                                 │                     └──cerrar──▶ confirm-close ──┬─ Guardar ──▶ guardado ─▶ sin modelo
                                 │                                                   ├─ No guardar ─▶ sin modelo
                                 └──cerrar──▶ sin modelo                             └─ Cancelar ──▶ editado
```

### Slice `recents`

`entries` (con su estado resuelto), `isLoading`, y las acciones `refresh`,
`revalidateStale`, `touch`, `remove`, `rename`, `moveToTrash`. La revalidación
perezosa se lanza desde la Bienvenida después del primer fotograma.

### Slice `browser` (explorador de Elegir carpeta y Abrir modelo)

| Campo | Tipo | Nota |
| ----- | ---- | ---- |
| `placeId` | texto | Ubicación activa |
| `path` | `string \| null` | Carpeta activa dentro de la ubicación |
| `entries` | lista de `DirectoryEntry` | Lo que devolvió `fs_list_directory` |
| `query` | texto | Texto de búsqueda; filtra en memoria sobre `entries` |
| `selection` | `string \| null` | Ruta seleccionada |
| `history` / `future` | listas de rutas | Atrás y Adelante (FR-008) |
| `preview` | `ModelPreview \| null` | Solo en Abrir modelo: nombre, motor, tablas, relaciones, tamaño, fecha y si es inválido |
| `choosePurpose` | `'new-model' \| 'relocate-save'` | Para qué se abrió Elegir carpeta: la carpeta del modelo nuevo, o la carpeta nueva donde guardar cuando la ruta desapareció (FR-045) |

El borrador de Nuevo modelo (`name`, `engine`, `folder`) vive también en este slice
para que abrir Elegir carpeta encima no lo pierda.

### `DirectoryEntry` (frontera)

`{ name, path, isDirectory, sizeBytes, modifiedMs, isModel }`. `isModel` es `true`
para los `.yaml`; las demás entradas se pintan atenuadas y no se pueden seleccionar
(FR-012).

### `ModelPreview`

`{ name, fileName, engine, tables, relations, sizeBytes, modifiedMs, invalid,
error }`. Se calcula en TypeScript con `src/lib/model/summary.ts` a partir del texto
que devuelve `model_read`; si parsear falla, `invalid: true` y `error` trae el
mensaje con su línea (FR-013, FR-017).
