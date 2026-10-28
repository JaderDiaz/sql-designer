# Modelo de datos · Incremento 3 (Tablas y campos)

Cuatro capas, como en el Incremento 2: el **archivo** del modelo (única fuente
de verdad), las **preferencias** de la instalación, el **estado de sesión** del
almacén y la **geometría derivada**, que no se guarda en ninguna parte.

La referencia normativa del archivo es
[`contracts/model.schema.json`](./contracts/model.schema.json).

## 1 · Archivo del modelo (`.yaml`, formato 1)

Este incremento **no sube la versión del formato**. Añade dos claves
opcionales al campo y empieza a escribir de verdad claves que el formato ya
declaraba (`tables[]`, `primaryKey`, `uniques`, `position`).

### `Field` — con los dos campos nuevos

| Campo | Tipo | Obligatorio | Regla |
| ----- | ---- | ----------- | ----- |
| `name` | texto | sí | Nombre técnico (RS-03), único dentro de la tabla |
| `type` | texto | sí | Solo el nombre del tipo, sin paréntesis ni números (R3) |
| `length` | entero | no | **Nuevo.** ≥ 1. Se omite cuando el tipo no la admite |
| `scale` | entero | no | **Nuevo.** ≥ 0 y ≤ `length`. Se omite cuando el tipo no la admite |
| `nullable` | booleano | no | Por defecto `false`. Un campo de `primaryKey` no puede ser `true` |
| `default` | texto | no | Tal como se escribe en SQL |
| `comment` | texto | no | Descripción libre del campo |

Orden de escritura: `name`, `type`, `length`, `scale`, `nullable`, `default`,
`comment`. El orden importa porque la puerta 3 compara textos.

### `Table` — sin cambios de forma, ahora sí se escribe

| Campo | Tipo | Obligatorio | Regla |
| ----- | ---- | ----------- | ----- |
| `name` | texto | sí | Nombre técnico (RS-03), único en el modelo |
| `schema` | texto | sí | `name` de un esquema existente |
| `comment` | texto | no | Hasta 280 caracteres (FR-043) |
| `fields` | lista de `Field` | sí | **Al menos uno** (FR-020); nombres únicos |
| `primaryKey` | lista de texto | no | Campos de esta tabla; vacía se omite |
| `uniques` | lista de `{ name, fields }` | no | Este incremento solo crea los de un campo, con nombre `uq_<tabla>_<campo>` (R12) |
| `indexes` | lista de `{ name, fields }` | no | No se crean aquí; se conservan y se renombran al duplicar |
| `position` | `{ x, y }` | no | Posición en el lienzo; este incremento la escribe al arrastrar |

### Ejemplo del archivo que este incremento produce

```yaml
formatVersion: 1
name: Condominio
engine: postgres
schemas:
  - name: operacion
    abbreviation: OPE
    color: blue
tables:
  - name: pago
    schema: operacion
    comment: Pagos recibidos de cada residente.
    fields:
      - name: id
        type: uuid
        nullable: false
        default: gen_random_uuid()
      - name: monto
        type: numeric
        length: 12
        scale: 2
        nullable: false
      - name: referencia
        type: varchar
        length: 120
        comment: Número que imprime el banco.
      - name: created_at
        type: timestamptz
        nullable: false
        default: now()
    primaryKey:
      - id
    uniques:
      - name: uq_pago_referencia
        fields:
          - referencia
    position:
      x: 240
      y: 120
```

### Reglas de validación al cargar (añadidas a las del Incremento 1)

Las comprueba `src/lib/model/validate.ts` y cada fallo trae `path`, `message`,
`line` y `column`:

1. `length` y `scale`, si están, son enteros finitos; `length` ≥ 1, `scale` ≥ 0.
2. `scale` ≤ `length` cuando los dos están.
3. `length` y `scale` **no** se validan contra el catálogo de tipos del motor:
   un archivo cuyo motor cambió sigue siendo válido (R3).
4. `fields` tiene al menos un elemento (ya lo exigía el Incremento 1).
5. Ningún campo de `primaryKey` tiene `nullable: true`.
6. `comment` de una tabla no pasa de 280 caracteres.

Lo que ya comprobaba el Incremento 1 y sigue valiendo: claves desconocidas
rechazadas en todo nivel, nombres técnicos conformes a RS-03 y únicos donde
toca, y referencias resueltas —el `schema` de la tabla existe y los campos de
`primaryKey`, `uniques`, `indexes` y de las relaciones pertenecen a su tabla.

## 2 · Preferencias (`preferences.json`, formato 1)

Delta de este incremento, detallado en
[`contracts/preferences.md`](./contracts/preferences.md):

| Campo | Tipo | Por defecto | Qué recuerda |
| ----- | ---- | ----------- | ------------ |
| `snapToGrid` | booleano | `false` | Si las tablas se alinean a la cuadrícula al soltarlas (FR-032) |
| `fieldsPanelHeight` | entero | `320` | Alto del panel de campos, recortado a `[200, 560]` al leer (FR-022) |

## 3 · Estado de sesión (almacén único)

Nada de esto se escribe en el archivo del modelo.

### `CanvasSlice` — añadidos

| Campo | Tipo | Qué es |
| ----- | ---- | ------ |
| `selectedTable` | `string \| null` | Nombre técnico de la tabla seleccionada; una sola a la vez (FR-007a) |

`selectTable(name \| null)` la fija y, al fijarla, limpia `selectedSchema`:
el inspector mira una cosa a la vez.

### `TablesSlice` — parte nueva (`src/store/tables.ts`)

| Campo | Tipo | Qué es |
| ----- | ---- | ------ |
| `tableTarget` | `string \| null` | Tabla que está editando el diálogo de renombrar, o `null` |
| `tableDraftPosition` | `Position \| null` | Punto pedido para la tabla nueva (doble clic), o `null` para el centro visible |
| `deleteTableTarget` | `string \| null` | Tabla en espera de confirmación de borrado |
| `deleteFieldTarget` | `{ table: string; field: string } \| null` | Campo en espera de confirmación, cuando una relación lo usa |

Acciones: `createTable`, `moveTable`, `renameTable`, `duplicateTable`,
`deleteTable`, `setTableSchema`, `setTableComment`, `addField`,
`updateField`, `moveFieldBy`, `deleteField`, `setFieldKey`, `applyTemplate`.
Su contrato está en [`contracts/tables.md`](./contracts/tables.md) §2.

### `FieldsPanelSlice` — parte nueva (`src/store/fieldsPanel.ts`)

| Campo | Tipo | Qué es |
| ----- | ---- | ------ |
| `isFieldsPanelOpen` | booleano | Si el panel inferior está abierto (FR-023) |
| `fieldsPanelHeight` | entero | Alto actual, espejo de la preferencia, recortado a `[200, 560]` |
| `focusedCell` | `{ field: string; column: FieldColumn } \| null` | Celda enfocada de la rejilla; la usa el enlace del inspector (FR-044) |

`FieldColumn` es `'key' | 'name' | 'type' | 'length' | 'scale' | 'nullable' |
'default' | 'comment'`.

### `ModelSlice` — un añadido al historial

| Campo | Tipo | Qué es |
| ----- | ---- | ------ |
| `HistoryStep.coalesceKey` | `string \| undefined` | Clave de fusión del paso. Un paso nuevo con la misma clave que el de arriba lo **reemplaza** en lugar de empujar (R8, FR-024a) |

Etiquetas nuevas del historial, que son lo que dice el aviso al deshacer:
«crear la tabla», «mover la tabla», «cambiar la tabla de esquema», «renombrar
la tabla», «duplicar la tabla», «eliminar la tabla», «editar la descripción»,
«añadir el campo», «editar el campo», «reordenar los campos», «eliminar el
campo», «cambiar la llave», «añadir los campos de la plantilla».

## 4 · Geometría derivada (`src/lib/canvas/`)

Funciones puras, sin DOM y sin estado. No se guardan: se recalculan cuando el
modelo cambia.

| Pieza | Qué calcula | Nuevo o revisado |
| ----- | ----------- | ---------------- |
| `tableHeight(fieldCount)` | `42 + 24 × campos`, mínimo una fila | **Nuevo**; sustituye a la constante `TABLE_HEIGHT` (R1) |
| `resolveLayout(model)` | Posición de cada tabla | Revisado: la rejilla de las tablas sin posición usa el alto real de cada una |
| `schemaZones(model, layout)` | Zona de cada esquema | Revisado: la envolvente usa `tableHeight` por tabla |
| `zoneAt(zones, point)` | La zona que contiene un punto, la última del orden del modelo si hay solapes | **Nuevo** (FR-031) |
| `snapToGrid(position, enabled)` | La posición ajustada a `GRID_SNAP` (24) | **Nuevo** (FR-032) |
| `findFreeSpot(occupied, desired, size)` | El primer sitio libre desde el pedido | **Nuevo** (FR-006, FR-038) |

Y dos funciones puras del modelo, en `src/lib/model/`:

| Pieza | Qué calcula |
| ----- | ----------- |
| `fieldMarks(table, relations)` | `PK`, `UK`, `FK` o nada, por campo (R12) |
| `relationsTouching(model, { table, field? })` | Las relaciones que se eliminarían con esa tabla o ese campo (R13) |

## 5 · Catálogo de tipos por motor (`src/lib/model/engines.ts`)

Datos puros, no estado. Por motor: la lista de tipos, cuáles admiten longitud,
cuáles admiten escala, los valores propuestos al elegir un tipo, el campo `id`
de FR-008 y los campos de cada plantilla de FR-027. Las tablas completas están
en [`research.md` R2](./research.md).

| Función | Devuelve |
| ------- | -------- |
| `typesOf(engine)` | La lista de tipos del motor, en el orden en que se muestra |
| `typeTraits(engine, type)` | `{ hasLength, hasScale, defaultLength?, defaultScale? }`; para un tipo que el motor no conoce, todo en falso y `isUnknown` |
| `idField(engine)` | El campo `id` completo (tipo, longitud, no nulo y valor por defecto) |
| `templatesOf(engine)` | Los cuatro grupos de campos comunes, ya tipados para ese motor |
