# Contrato de relaciones · Incremento 4

Lo que este incremento añade a la aplicación, visto desde fuera: funciones
puras, acciones del almacén, gestos, atajos, nombres accesibles y mensajes. Es
el contrato que las pruebas afirman; la forma del archivo está en
[`model.schema.json`](./model.schema.json) y las preferencias en
[`preferences.md`](./preferences.md).

## 1 · Funciones puras

### 1.1 Geometría (`src/lib/canvas/relations.ts`)

| Función | Entrada | Salida | Garantías |
| ------- | ------- | ------ | --------- |
| `relationAnchors(model, layout, relation)` | Modelo, layout resuelto y una relación | `{ax, ay, bx, by, oa, ob, kind, base}` | `ay` y `by` caen en el centro de la fila del campo: `y + TABLE_HEADER + FIELD_ROW_HEIGHT × índice + FIELD_ROW_HEIGHT / 2`. `kind` es `'h'` cuando hay al menos `TABLE_WIDTH + GRID_SNAP` de hueco horizontal, `'loop'` cuando las tarjetas se solapan y `'self'` cuando `fromTable === toTable`. Determinista: no mide el DOM (R1) |
| `assignLanes(anchors[])` | Las anclas de todas las relaciones | `number[]`, un carril por relación | Las que comparten canal se reparten cada 14 px alrededor del centro del grupo; con 2 a 5 en el grupo se elige la permutación con menos cruces; con más, el orden del extremo superior. El carril de un `'h'` nunca sale del hueco entre las dos tarjetas (R2) |
| `pathOf(anchors, lane, route)` | Anclas, carril y trazado | La cadena `d` | `'orthogonal'` → `M … H lane V … H …`; `'curved'` → una cúbica con tiradores horizontales de `max(36, abs(bx − ax) / 2)`; `'straight'` → polilínea con 16 px de salida recta. Ningún trazado atraviesa una tarjeta (R3, R4) |
| `glyphOf(end, point, side)` | `'one' \| 'many' \| 'zero-or-many' \| 'zero-or-one'`, el punto y el lado | La cadena `d` del glifo | `'one'` son dos barras; `'many'`, pata de gallo; `'zero-or-many'`, pata de gallo con círculo; el glifo crece hacia dentro de la tarjeta según `side` (R5) |
| `relationLayer(model, layout, route)` | Modelo, layout y trazado | Una lista lista para pintar: `{name, d, lane, glyphA, glyphB, color, from, to}` | Es la composición de las cuatro anteriores; el color es el token del esquema de `toTable`, la tabla que tiene la llave primaria (FR-015), y `lane` viaja en la línea para que el arrastre repinte su `d` sin volver a repartir carriles (R6) |
| `touchedRelations(model, target)` | Modelo y `{kind: 'table' \| 'schema', name}` | Nombres de relación | Las que hay que repintar durante un arrastre: las de la tabla, o las de cualquier tabla del esquema (R6) |

### 1.2 Modelo (`src/lib/model/relations.ts`, `marks.ts`)

| Función | Entrada | Salida | Garantías |
| ------- | ------- | ------ | --------- |
| `proposeForeignKey(model, from, to, pattern)` | Modelo, tabla que llevará la clave, tabla destino y patrón de Ajustes | `{field, toField}` o `null` | El nombre sale del patrón con `{tabla}` y `{pk}` resueltos y sufijo `_2`, `_3`… si ya existe en la tabla; `type` y `length` se copian de la llave primaria; el campo nace **no nulo**. Devuelve `null` si `to` no tiene llave primaria de exactamente una columna (R13, FR-004, FR-009) |
| `relationName(table, field, existing)` | Tabla, campo y nombres ya usados | Nombre técnico | `fk_<tabla>_<campo>`, recortado a 63 caracteres y con sufijo numérico si choca (R10) |
| `foreignKeyTargets(model, table)` | Modelo y tabla abierta | `{name, enabled, reason?, self?}[]` | Todas las tablas del modelo, incluida la abierta; deshabilitadas las que no tienen llave primaria o la tienen compuesta, con su motivo (FR-009) |
| `indexStateOf(table, field)` | Tabla y campo | `'indexed' \| 'missing'` | `'indexed'` cuando el campo está solo o en primera posición en algún `indexes[]` o `uniques[]`, y cuando es la primera columna de `primaryKey` (FR-033) |
| `cardinalityOf(model, relation)` | Modelo y relación | `{from: 'one', to: 'many' \| 'zero-or-many' \| 'one' \| 'zero-or-one'}` | Sale del «no nulo» y de la unicidad de la columna. **Única fuente** de la cardinalidad: `relationCardinality` la formatea y `glyphOf` la dibuja (R5, SC-011) |

### 1.3 Ejemplos fijados

| Entrada | Salida |
| ------- | ------ |
| `relationAnchors` con origen en `{x: 0, y: 0}` (4 campos), campo índice 3, destino en `{x: 320, y: 0}`, campo índice 0 | `{ax: 200, ay: 126, bx: 320, by: 54, oa: 1, ob: -1, kind: 'h'}` |
| `assignLanes` de dos relaciones con el mismo canal en `x = 260` | `[253, 267]` |
| `pathOf({ax: 200, ay: 126, bx: 320, by: 54, …}, 260, 'orthogonal')` | `'M200 126 H260 V54 H320'` |
| `relationName('pago', 'unidad_id', ['fk_pago_unidad_id'])` | `'fk_pago_unidad_id_2'` |
| `proposeForeignKey(modelo, 'pago', 'unidad', '{tabla}_{pk}')` | `{field: {name: 'unidad_id', type: 'uuid'}, toField: 'id'}` — sin `nullable`: «no nulo» es la ausencia de la clave en todo el formato |
| `proposeForeignKey(modelo, 'pago', 'pago_cargo', …)` con llave primaria de dos columnas | `null` |
| `cardinalityOf` de una relación sobre una columna no nula y no única | `{from: 'one', to: 'many'}` |
| `cardinalityOf` de una relación sobre una columna que admite nulos | `{from: 'one', to: 'zero-or-many'}` |
| `cardinalityOf` de una relación sobre una columna única y no nula | `{from: 'one', to: 'one'}` |
| `indexStateOf` de una columna que no está en ningún índice | `'missing'` |

## 2 · Acciones del almacén (`RelationsSlice`)

| Acción | Entrada | Efecto | No hace |
| ------ | ------- | ------ | ------- |
| `addForeignKey(table, target?)` | Tabla que llevará la clave y, si se sabe, la tabla destino | Crea el campo propuesto al final de la tabla y la relación que lo usa, con las dos reglas en `no_action`. Sin `target`, elige la primera tabla a la que esta todavía no apunta y, si no queda ninguna, la propia tabla. Paso «editar la clave foránea» | No crea nada —ni campo ni relación— si ninguna tabla tiene llave primaria de una columna: devuelve el motivo para el mensaje (FR-005) |
| `setForeignKeyColumn(name, field)` | Relación y campo de la tabla | Cambia `fromFields` al campo elegido. La marca FK se recoloca sola, porque se deduce. Paso «editar la clave foránea» | No hace nada si el campo es el que ya tiene, y rechaza el campo que la relación referencia cuando apunta a su propia tabla (FR-009a) |
| `setForeignKeyTarget(name, table)` | Relación y tabla destino | Apunta `toTable` y `toFields` a la llave primaria de la tabla nueva y, **solo** si la columna conserva el nombre que el patrón le había puesto, la renombra y la retipa. Paso «editar la clave foránea» | No toca la columna si el usuario ya la había renombrado (FR-007) |
| `setReferentialAction(name, key, action)` | Relación, `'onDelete' \| 'onUpdate'` y la acción | Escribe la regla; omite la clave del archivo cuando vale `no_action`. Paso «cambiar ON DELETE / UPDATE» | No valida contra el «no nulo»: eso lo avisa la pantalla y no bloquea (FR-030) |
| `deleteForeignKey(name)` | Relación | Quita la relación. La columna se queda con su nombre, su tipo y sus demás propiedades, y pierde la marca FK si ninguna otra relación la usa. Paso «eliminar la clave foránea» | No elimina el campo (FR-035) |
| `clearNotNull(table, field)` | Tabla y campo | Quita el «no nulo» de la columna: es la salida del aviso de SET NULL. Paso «editar el campo», el del Incremento 3 | — |

Las seis escriben por el historial del Incremento 1: cada una es **un** paso
deshacible y rehacible con su etiqueta, y marca el modelo «Editado» (FR-012).

## 3 · Gestos y estado de la sesión

| Gesto | Efecto |
| ----- | ------ |
| Cursor sobre una tarjeta | Resalta la tarjeta, sus relaciones y las tablas al otro lado; atenúa el resto. Se apaga mientras hay un arrastre en curso (R7) |
| Foco de teclado en una tarjeta | El mismo resaltado que el cursor (FR-021) |
| Arrastrar una tabla o una zona | Las relaciones afectadas se repintan por cuadro escribiendo su atributo `d`; los carriles se quedan como estaban y se recalculan al soltar (R2, R6) |
| Clic sobre una línea | Llega a lo que haya debajo: la capa no captura el puntero (FR-018) |
| Clic en una tabla de «Referenciada por» | Selecciona esa tabla en el lienzo y la muestra (FR-031) |
| Clic en «ir a la tabla referenciada» de una fila | Lo mismo, desde la fila de la clave foránea (FR-006) |

## 4 · Atajos

| Atajo | Acción | Dónde |
| ----- | ------ | ----- |
| `R` | Abre la ficha «Claves foráneas» de la tabla seleccionada; sin selección, pide seleccionarla | Lienzo y Editor (FR-001, FR-002) |
| Tabulador | Entra y sale de la rejilla de la ficha en una pulsación | Ficha «Claves foráneas» (FR-038) |
| Flechas | Mueven de celda y de fila dentro de la rejilla | Ficha «Claves foráneas» (FR-038) |
| `Inicio` / `Fin` | Extremos de la fila | Ficha «Claves foráneas» (FR-038) |
| `Intro` | Abre el selector de la celda enfocada | Ficha «Claves foráneas» (FR-038) |
| `Esc` | Cierra el selector sin cambiar nada | Ficha «Claves foráneas» (FR-038) |
| ⌘Z / Ctrl+Z | Deshace la última de las seis acciones | Toda la aplicación (FR-012) |

La tecla `R` no actúa mientras el foco está en un campo de texto, como las demás
teclas sueltas del Incremento 3.

## 5 · Nombres accesibles

| Elemento | Nombre |
| -------- | ------ |
| Botón de la barra superior | `Relación` (con `title` «Nueva relación (R)») |
| Panel inferior | `Editor de tabla` (antes «Editor de campos») |
| Lista de fichas | `Secciones de la tabla` |
| Ficha | `Campos`, `Claves foráneas`, cada una con su contador |
| Rejilla de la ficha | `Claves foráneas de <tabla>` |
| Columnas de la rejilla | `Columna`, `Tabla referenciada`, `ON DELETE`, `ON UPDATE`, `Índice` |
| Botón de ir a la tabla | `Ir a <tabla>` |
| Botón de eliminar | `Eliminar la clave foránea` (con `title` «Eliminar la clave foránea (el campo se conserva)») |
| Sección de vuelta | `Referenciada por` |
| Capa de relaciones | Sin nombre: `aria-hidden`, porque lo que dibuja ya está en la ficha y en el inspector |
| Controles de Ajustes | `Trazado de relaciones`, `Animación de relaciones` |

## 6 · Mensajes y estados

Los seis estados de SC-009, con su texto y su salida:

| Estado | Mensaje | Salida |
| ------ | ------- | ------ |
| Sin tabla seleccionada al pulsar «Relación» o `R` | «Selecciona la tabla que tendrá la clave foránea.» | Seleccionar una tabla; el aviso no cambia el modelo (FR-002) |
| Tabla sin claves foráneas | «Esta tabla no referencia a otras. Usa «Añadir clave foránea»: se crea la columna con el tipo de la llave primaria referenciada y la relación aparece en el diagrama.» | El propio botón «Añadir clave foránea» (FR-032) |
| Sin tablas que la referencien | La sección «Referenciada por» no se muestra | — (FR-032) |
| Tabla destino sin llave primaria | «<tabla> no tiene llave primaria.» en la opción deshabilitada | Definir la llave primaria en la ficha «Campos» (FR-009) |
| Tabla destino con llave primaria compuesta | «<tabla> tiene llave primaria de varias columnas.» en la opción deshabilitada | Elegir otra tabla (FR-009) |
| `SET NULL` sobre una columna no nula | «La columna no admite nulos, así que SET NULL no podrá aplicarse.» | «Quitar «no nulo»», que ejecuta `clearNotNull`; la regla se guarda igual (FR-030) |

Y los dos mensajes que no son estados de error:

| Situación | Mensaje |
| --------- | ------- |
| Se abre la ficha desde la barra superior o `R` | «Agrega la clave foránea de <tabla>.» |
| La columna de una relación hacia la propia tabla es el campo referenciado | «La columna no puede ser el mismo campo al que apunta.» (FR-009a) |

## 7 · Lo que este contrato no cubre

- El SQL de las claves foráneas: es del incremento de exportación, con el
  generador único (principio II).
- Crear el índice que falta cuando la fila dice «Sin índice»: es del incremento
  de índices (FR-033).
- Las relaciones en el minimapa y en la imagen exportada (research R17).
- Las claves foráneas de varias columnas: las del archivo se muestran y se
  conservan, pero no se editan aquí (FR-020).
