# Contrato de índices y únicos · Incremento 5

Lo que la interfaz y las pruebas pueden dar por hecho sobre los índices y los
únicos: funciones puras, acciones del almacén, la rejilla, nombres accesibles y
mensajes. Los enums están en [`enums.md`](./enums.md).

## 1 · Funciones puras (`src/lib/model/indexes.ts` y `marks.ts`)

| Función | Entrada | Salida | Garantías |
| ------- | ------- | ------ | --------- |
| `automaticIndexes(table)` | Tabla | `Array<{ name, fields, kind }>` | Primero la llave primaria, si la hay, como `pk_<tabla>` y `kind: 'PRIMARY KEY'`; después cada único de `uniques[]`, en su orden, con su nombre real y `kind: 'UNIQUE'`. Lista vacía si la tabla no tiene ninguno (R9) |
| `splitUniques(table)` | Tabla | `{ single, compound }` | `single` son los de un campo; `compound`, los de dos o más. Conserva el orden del archivo (R13) |
| `constraintNames(model)` | Modelo | `Set<string>` | Los nombres de todos los índices y únicos de todas las tablas |
| `proposeConstraintName(prefix, table, fields, taken)` | Prefijo, tabla, columnas y nombres usados | Nombre técnico | `<prefix><table>_<campo>_<campo>…`; recortado a 63; con sufijo `_2`, `_3`… hasta no estar en `taken`, conservando el sufijo dentro de los 63 (R10) |
| `isProposedName(prefix, table, fields, name)` | Lo mismo y el nombre actual | Booleano | Si `name` es la propuesta para esas columnas, con o sin sufijo numérico (FR-026) |
| `proposeIndexField(model, table)` | Modelo y nombre de tabla | Nombre de campo | La columna de la primera clave foránea de la tabla cuyo `indexStateOf` es `'missing'`; si no hay, el primer campo fuera de la llave primaria; si no hay, el primer campo (FR-023) |
| `proposeUniqueFields(table)` | Tabla | `[campo, campo] \| null` | Los dos primeros campos fuera de la llave primaria; si no llegan a dos, se completa con los de la llave; `null` con menos de dos campos (FR-033) |
| `constraintNameProblem(model, name, editing)` | Modelo, nombre y el nombre que tenía | Mensaje o `null` | Vacío, sin forma de nombre técnico, de más de 63, o usado por otro índice o único del modelo (FR-027, FR-036) |
| `duplicateOf(table, fields, editing)` | Tabla, columnas en orden y el nombre del que se edita | Nombre o `null` | El índice, único o llave primaria de la tabla con las mismas columnas en el mismo orden (FR-028, FR-037) |
| `fieldDependents(table, field)` | Tabla y campo | `{ shrunk, removedIndexes, removedUniques }` | `shrunk`: índices no únicos que conservan otras columnas. `removedIndexes`: los que se quedan sin columnas y todos los marcados `unique`. `removedUniques`: los compuestos que usan el campo. El único de un campo no se lista porque no es un dependiente: es la marca UK del propio campo, y `removeFieldFromKeys` lo quita siempre con él (R15) |
| `cardinalityOf(model, relation)` | Ya existe en `marks.ts` | Cardinalidad | Cuenta como única la columna que es llave, que tiene UK **o que es la única columna de un índice con `unique: true`**. Los índices únicos de varias columnas no cuentan (R14, FR-029a) |

### Ejemplos fijados

Con la tabla `pago (id PK, residente_id FK, concepto, mes)`:

| Llamada | Resultado |
| ------- | --------- |
| `automaticIndexes(pago)` | `[{ name: 'pk_pago', fields: ['id'], kind: 'PRIMARY KEY' }]` |
| `proposeIndexField(m, 'pago')` | `'residente_id'` |
| `proposeConstraintName('idx_', 'pago', ['residente_id'], vacío)` | `'idx_pago_residente_id'` |
| `proposeConstraintName('idx_', 'pago', ['residente_id'], { 'idx_pago_residente_id' })` | `'idx_pago_residente_id_2'` |
| `proposeUniqueFields(pago)` | `['residente_id', 'concepto']` |
| `proposeConstraintName('uq_', 'pago', ['residente_id', 'mes'], vacío)` | `'uq_pago_residente_id_mes'` |
| `isProposedName('idx_', 'pago', ['residente_id'], 'idx_pago_residente_id_2')` | `true` |
| `fieldDependents(pago, 'mes')` con el único `uq_pago_residente_id_mes` | `removedUniques: ['uq_pago_residente_id_mes']` |

## 2 · Acciones del almacén (`IndexesSlice`, `src/store/indexes.ts`)

| Acción | Efecto | Historial |
| ------ | ------ | --------- |
| `addIndex(table)` | Añade un índice con la columna y el nombre propuestos; devuelve su nombre | «crear el índice» |
| `setIndexName(table, name, next)` | Renombra. No cambia nada y devuelve el mensaje si `next` no es válido | «editar el índice», fusionado mientras se escribe |
| `setIndexFields(table, name, fields)` | Cambia las columnas conservando el orden recibido; repropone el nombre si era el propuesto. No cambia nada con la lista vacía | «editar el índice» |
| `setIndexUnique(table, name, unique)` | Pone o quita la marca; quitarla borra la clave `unique` | «editar el índice» |
| `deleteIndex(table, name)` | Quita el índice; borra `indexes` si queda vacía | «eliminar el índice» |
| `addUnique(table)` | Añade un único compuesto con dos columnas y el nombre propuestos. No hace nada con menos de dos campos | «crear el único» |
| `setUniqueName(table, name, next)` | Como `setIndexName` | «editar el único», fusionado |
| `setUniqueFields(table, name, fields)` | Como `setIndexFields`, pero no cambia nada con menos de dos columnas | «editar el único» |
| `deleteUnique(table, name)` | Quita el único compuesto | «eliminar el único» |

Todas marcan el modelo «Editado» y se deshacen en un paso (FR-041). Ninguna
puede dejar un índice sin columnas ni un único compuesto con una (R11). Los
prefijos se leen de las preferencias en el momento de proponer.

`removeFieldFromKeys` (`src/store/tables.ts`) aplica `fieldDependents` (R15) y
sigue quitando el único de un campo del campo eliminado. `setFieldKey` nombra el
único de la marca UK con `proposeConstraintName(uniquePrefix, tabla, [campo],
constraintNames(model))` y ya no con `uq_` fijo (FR-038a). `setPanelTab` acepta
`'indexes'` y `'uniques'`.

## 3 · Las dos pestañas

Orden de las fichas del panel: **Campos · Índices · Claves foráneas · Únicos**,
el del tablero. Cada ficha lleva su contador: los índices propios en «Índices»
(FR-030) y los únicos de un campo más los compuestos en «Únicos» (FR-038).

### «Índices»

| Bloque | Contenido |
| ------ | --------- |
| «Creados por restricciones» | Una línea por índice automático: candado, nombre, columnas entre paréntesis y la clase. Sin mandos (FR-021) |
| «Índices» | Rejilla de cuatro columnas: Nombre, Columnas, Único y eliminar. Botón «Añadir índice» en la cabecera de la ficha |

### «Únicos»

| Bloque | Contenido |
| ------ | --------- |
| «Desde la columna Llave (UK)» | Una línea por único de un campo: nombre y columna. Sin mandos (FR-032) |
| «Únicos compuestos» | Rejilla de tres columnas: Nombre, Columnas y eliminar. Botón «Añadir único» en la cabecera de la ficha |

Las dos rejillas se recorren con `useGridNavigation`, como la de campos y la de
claves foráneas: el tabulador entra y sale, las flechas mueven de celda y de
fila (FR-044).

## 4 · Nombres accesibles

| Elemento | Nombre |
| -------- | ------ |
| Fichas | «Índices, 2» / «Únicos, 3» |
| Celda de nombre | «Nombre del índice» / «Nombre de la restricción» |
| Selector de columnas | «Columnas», con las elegidas en orden: «Columnas: residente_id, mes» |
| Casilla | «Índice único» |
| Botones | «Eliminar índice», «Eliminar restricción», «Añadir índice», «Añadir único» |
| Bloques | regiones «Creados por restricciones», «Índices», «Desde la columna Llave (UK)», «Únicos compuestos» |

## 5 · Mensajes y estados

| Estado | Texto | Salida |
| ------ | ----- | ------ |
| Tabla sin llave ni únicos | «Esta tabla no tiene llave primaria ni únicos, así que ninguna restricción crea un índice.» | — |
| Tabla sin índices propios | «Sin índices adicionales. Añade uno para las columnas por las que más filtras u ordenas, sobre todo las FK.» | «Añadir índice» |
| Tabla sin únicos compuestos | «Usa uno cuando la combinación de varias columnas no puede repetirse, por ejemplo torre + número de unidad.» | «Añadir único» |
| Tabla con menos de dos campos | «Un único compuesto necesita al menos dos campos.» en el título de «Añadir único», deshabilitado | Añadir un campo |
| Nombre vacío | «Escribe un nombre.» | Corregir la celda |
| Nombre con forma inválida | «Usa minúsculas, números y guion bajo, sin empezar por número.» | Corregir la celda |
| Nombre repetido | «Ese nombre ya lo usa otro índice o único del modelo.» | Corregir la celda |
| Quitar la última columna de un índice | «Un índice necesita al menos una columna.» | La columna se conserva |
| Dejar un único compuesto en una columna | «Un único compuesto necesita al menos dos columnas. El de un solo campo se marca con UK en «Campos».» | Las dos se conservan |
| Mismas columnas que otro | «Repite las columnas de <nombre>.» | Aviso; se guarda igual |
| Eliminar un campo indexado | En la confirmación del campo: «El índice <nombre> perderá esta columna.» / «El índice <nombre> se eliminará con él.» / «El único <nombre> se eliminará con él.» | «Cancelar» / «Eliminar campo» |

## 6 · Lo que este contrato no cubre

- El método del índice (Clarifications).
- El orden ascendente o descendente de cada columna y los índices parciales.
- El SQL de `CREATE INDEX` y `ADD CONSTRAINT … UNIQUE`: incremento de
  exportación.
- Una marca en la tarjeta del lienzo para los campos de un índice o de un único
  compuesto.
- Un botón en el aviso «Sin índice» de «Claves foráneas»: el camino es «Añadir
  índice», que ya propone esa columna.
