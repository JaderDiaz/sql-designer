# Contrato de tablas y campos · Incremento 3

Lo que este incremento añade a `specs/003-lienzo-esquemas/contracts/canvas.md`,
que sigue siendo el contrato del lienzo. Aquí van las funciones puras nuevas,
las acciones del almacén, los gestos, los atajos y los nombres accesibles.

## 1 · Funciones puras

### 1.1 Geometría (`src/lib/canvas/`)

| Función | Entrada | Salida | Garantías |
| ------- | ------- | ------ | --------- |
| `tableHeight(fieldCount)` | Número de campos | Alto en píxeles del modelo | `42 + 24 × campos`; con 0 campos devuelve el alto de una fila. Determinista |
| `zoneAt(zones, point)` | Zonas y un punto en coordenadas del modelo | La zona que lo contiene, o `null` | Con zonas solapadas devuelve la **última** del orden del modelo, que es la que se dibuja encima (FR-031) |
| `snapToGrid(position, enabled)` | Posición y si la preferencia está activa | Posición | Con `enabled` redondea los dos ejes a múltiplos de `GRID_SNAP` (24); sin ella devuelve la posición con los ejes redondeados a entero |
| `findFreeSpot(occupied, desired, size)` | Rectángulos ocupados, punto pedido y tamaño | Posición | Devuelve `desired` si no choca; si choca, el primer desplazamiento libre probado en este orden: derecha, abajo, derecha-abajo, izquierda, arriba, más a la derecha. Si ninguno cabe, devuelve `desired` desplazado una vez a la derecha y abajo, nunca `null` (FR-006, FR-038) |

`resolveLayout` y `schemaZones` conservan su firma y pasan a usar
`tableHeight`: la envolvente de una zona contiene las tablas con su alto real
(R1).

### 1.2 Modelo (`src/lib/model/`)

| Función | Entrada | Salida | Garantías |
| ------- | ------- | ------ | --------- |
| `fieldMarks(table, relations)` | Una tabla y las relaciones del modelo | `Map<campo, 'PK' \| 'UK' \| 'FK'>` | `PK` si está en `primaryKey`; `UK` si está en algún `uniques`; `FK` si alguna relación lo nombra en `fromFields`. Un campo que es `PK` y además `FK` sale como `PK` |
| `relationsTouching(model, { table, field? })` | El modelo y el objeto a eliminar | `Relation[]` | Sin `field`, las relaciones con ese extremo en `fromTable` o `toTable`; con `field`, las que lo nombran en `fromFields` o `toFields` |
| `typesOf(engine)` | Motor | `string[]` | La lista del motor, en orden de presentación (research R2) |
| `typeTraits(engine, type)` | Motor y tipo | `{ hasLength, hasScale, defaultLength?, defaultScale?, isUnknown }` | Para un tipo que el motor no conoce: todo falso e `isUnknown: true` (FR-018a) |
| `idField(engine)` | Motor | `Field` | El campo `id` de FR-008, ya tipado para ese motor |
| `templatesOf(engine)` | Motor | `FieldTemplate[]` | Cuatro grupos: auditoría, borrado lógico, autoría y activo |

### 1.3 Ejemplos fijados

| Entrada | Salida |
| ------- | ------ |
| `tableHeight(0)` | `66` |
| `tableHeight(1)` | `66` |
| `tableHeight(4)` | `138` |
| `snapToGrid({x: 37, y: 11}, true)` | `{x: 48, y: 0}` |
| `snapToGrid({x: 37.4, y: 11}, false)` | `{x: 37, y: 11}` |
| `typeTraits('postgres', 'numeric')` | `{hasLength: true, hasScale: true, defaultLength: 12, defaultScale: 2, isUnknown: false}` |
| `typeTraits('sqlite', 'timestamptz')` | `{hasLength: false, hasScale: false, isUnknown: true}` |
| `idField('mysql')` | `{name: 'id', type: 'char', length: 36, nullable: false, default: '(uuid())'}` |

## 2 · Acciones del almacén

### 2.1 Tablas (`TablesSlice`)

| Acción | Entrada | Efecto | No hace |
| ------ | ------- | ------ | ------- |
| `createTable(draft)` | `{name, schema, comment?, withId, withAudit, position?}` | Añade la tabla al final de `tables`, con los campos de `withId` y `withAudit` según el motor, en `position` o en el centro visible pasado por el lienzo, buscando hueco libre. Selecciona la tabla y abre el panel. Paso «crear la tabla» | No crea nada si el nombre está repetido o el esquema no existe: el diálogo lo impide antes (FR-004) |
| `moveTable(name, delta, options)` | Desplazamiento del gesto y `{schema?}` | Suma `delta` a la posición —resolviendo primero la que no la traía—, ajusta a la cuadrícula si la preferencia está activa y, con `schema`, cambia el esquema. Un solo paso: «mover la tabla» o «cambiar la tabla de esquema» | No mueve nada si el desplazamiento es cero y el esquema no cambia |
| `setTableSchema(name, schema)` | Nombre y esquema de destino | Cambia el esquema sin tocar la posición. Paso «cambiar la tabla de esquema» | — |
| `renameTable(name, next)` | Nombre actual y nombre nuevo | Renombra la tabla y propaga el nombre a las relaciones, a los nombres de `uniques` e `indexes` que empezaban por el nombre viejo y a la selección. Paso «renombrar la tabla» | No hace nada si el nombre nuevo ya existe o incumple RS-03 |
| `duplicateTable(name)` | Nombre | Crea `<tabla>_copia` (o `_copia_2`…) con campos, llaves, índices y descripción, en el mismo esquema y en el hueco libre más cercano; la deja seleccionada. Paso «duplicar la tabla» | No copia relaciones (R11) |
| `deleteTable(name)` | Nombre | Elimina la tabla y las relaciones que la tocaban; limpia selección y panel. Paso «eliminar la tabla» | — |
| `setTableComment(name, comment)` | Nombre y texto | Escribe la descripción recortada a 280. Paso «editar la descripción», con clave de fusión | — |

### 2.2 Campos (`TablesSlice`)

| Acción | Entrada | Efecto | No hace |
| ------ | ------- | ------ | ------- |
| `addField(table)` | Nombre de la tabla | Añade al final un campo `nuevo_campo` con el tipo de texto del motor y su longitud propuesta; enfoca su nombre. Paso «añadir el campo» | — |
| `updateField(table, field, patch, coalesce?)` | Nombre, campo y parche parcial | Aplica el parche. Al cambiar `name`, propaga el nombre nuevo a `primaryKey`, a `uniques`, a `indexes` y a las relaciones que lo nombraban en `fromFields` o en `toFields` (FR-021). Al cambiar `type`, olvida `length` y `scale` si el tipo nuevo no los admite y propone los valores del tipo si los admite y estaban vacíos. Al poner `PK`, fuerza `nullable: false`. Paso «editar el campo», fusionado por `coalesce` (R8) | No escribe un nombre repetido dentro de la tabla ni uno que incumpla RS-03: devuelve el error para la fila |
| `moveFieldBy(table, field, offset)` | `-1` o `+1` | Cambia el orden del campo. Paso «reordenar los campos» | No hace nada en el primero hacia arriba ni en el último hacia abajo |
| `deleteField(table, field)` | Nombre y campo | Elimina el campo, lo quita de `primaryKey`, `uniques` e `indexes` y elimina las relaciones que lo usaban. Paso «eliminar el campo» | No elimina el último campo de la tabla (FR-020). Con relaciones afectadas, el diálogo confirma antes (FR-019) |
| `setFieldKey(table, field, key)` | `'PK' \| 'UK' \| null` | `PK` añade o quita el campo de `primaryKey` y fuerza `nullable: false`; `UK` crea o elimina el único `uq_<tabla>_<campo>`; `null` quita las dos. Paso «cambiar la llave» | No toca un único de varios campos (R12) |
| `applyTemplate(table, template)` | Nombre y grupo | Añade solo los campos del grupo que faltan, con el tipo y el valor por defecto del motor. Paso «añadir los campos de la plantilla» | No duplica ni marca «Editado» si ya estaban todos (FR-028) |

### 2.3 Panel y selección

| Acción | Efecto | No hace |
| ------ | ------ | ------- |
| `selectTable(name \| null)` | Lo que mira el inspector; limpia `selectedSchema`. Una sola tabla a la vez (FR-007a) | No entra en el historial |
| `openFieldsPanel(table?, cell?)` | Abre el panel sobre la tabla —la seleccionada si no se dice— y enfoca la celda pedida | — |
| `closeFieldsPanel()` | Cierra el panel y conserva la selección (FR-023) | — |
| `setFieldsPanelHeight(px, commit?)` | Recorta a `[200, 560]`. Con `commit` escribe la preferencia; sin él solo cambia el alto de la sesión, que es lo que hace cada `pointermove` del tirador | No entra en el historial ni escribe en disco mientras se arrastra |

## 3 · Gestos

| Gesto | Entrada | Resultado | Requisito |
| ----- | ------- | --------- | --------- |
| Doble clic en el fondo del lienzo | `dblclick` sobre el fondo | Abre Nueva tabla con ese punto del modelo | FR-001, FR-006 |
| Doble clic en una tabla | `dblclick` sobre la tarjeta | Abre el panel de campos de esa tabla | FR-023 |
| Clic en una tabla | `click` con botón 0 | La selecciona | FR-007a |
| Arrastrar una tabla | `pointerdown` con botón 0 sobre la tarjeta, por encima del umbral de 3 px | La mueve; al soltar, un paso de historial y, si cayó en otra zona, cambio de esquema | FR-030 a FR-033 |
| Menú contextual de tabla | `contextmenu` o ⇧F10 sobre la tarjeta o su fila de la barra lateral | «Editar campos…», «Renombrar…», «Duplicar tabla», «Mover a esquema», «Eliminar tabla…» | FR-036 |
| Arrastrar el tirador del panel | `pointerdown` sobre el separador | Cambia el alto entre 200 y 560 px; al soltar, escribe la preferencia | FR-022 |
| Espacio + arrastrar sobre una tabla | `keydown` de `Space` mantenido | Mueve la vista, no la tabla | FR-007 del Incremento 2 |

## 4 · Atajos

Los de `research.md` R16. Se muestran con ⌘ en macOS y con Ctrl en Windows
(FR-046).

## 5 · Nombres accesibles

| Elemento | Nombre accesible |
| -------- | ---------------- |
| Tarjeta de tabla | `Tabla <nombre>, esquema <abreviatura> · <esquema>, <n> campos` |
| Fila de campo de la tarjeta | `<campo>, <tipo>` más `, llave primaria` / `, única` / `, clave foránea` cuando lleva marca, y `, admite nulos` cuando los admite (FR-047) |
| Rejilla del panel | `Campos de <tabla>`, con `role="grid"` y `aria-rowcount` / `aria-colcount` |
| Celda de la rejilla | La columna más el campo: `Longitud de <campo>`, `Llave de <campo>`… |
| Celda deshabilitada | Añade `, no aplica a este tipo` (FR-015) |
| Tirador del panel | `Cambiar el alto del editor de campos`, `role="separator"` con `aria-orientation="horizontal"` y `aria-valuenow` en píxeles |
| Resumen del inspector | `Campos · <n>`, y cada fila como la de la tarjeta |
| Confirmación de eliminar | Título con el nombre y descripción con cuántas relaciones se van (FR-039) |

## 6 · Estados y mensajes

| Estado | Mensaje | Salida |
| ------ | ------- | ------ |
| Modelo sin esquemas al crear una tabla | «Primero crea un esquema: una tabla vive dentro de uno.» | Botón «Crear esquema…», que abre el diálogo del Incremento 2 (FR-002) |
| Nombre de tabla repetido | «Ya existe una tabla llamada `<nombre>`.» | El campo queda enfocado; «Crear tabla» deshabilitado (FR-004) |
| Nombre de tabla inválido | «Usa letras, números y guion bajo; no empieces con un número.» | Igual (RS-03) |
| Nombre de campo repetido | «Ya hay un campo `<nombre>` en esta tabla.» | La fila muestra el error y conserva el valor anterior (FR-017) |
| Escala mayor que la longitud | «La escala no puede pasar de la longitud.» | La celda muestra el aviso y no guarda (FR-016) |
| Último campo de la tabla | «Una tabla necesita al menos un campo.» | El botón de eliminar queda deshabilitado con ese título (FR-020) |
| Campo usado por una relación | «La relación `<nombre>` usa este campo.» en la celda de llave; «Se eliminará también la relación `<nombre>`.» al eliminarlo | Renombrarlo actualiza la relación; eliminarlo pide confirmar o cancelar (FR-019, FR-021) |
| Tipo que el motor no reconoce | «`<tipo>` no es un tipo de `<motor>`.» | El selector deja elegir uno válido; el archivo sigue siendo válido (FR-018a) |
| Tabla sin relaciones | «Esta tabla todavía no tiene relaciones.» | — (FR-045) |
