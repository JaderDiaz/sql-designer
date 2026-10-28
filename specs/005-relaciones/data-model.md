# Fase 1 · Modelo de datos: Relaciones (Incremento 4)

Cuatro capas, como en los incrementos anteriores: lo que viaja en el archivo del
modelo, lo que viaja en las preferencias, lo que vive solo en la sesión y lo que
se deduce de todo lo anterior. La regla del principio II se cumple aquí: nada
que se pueda deducir se guarda.

## 1 · Archivo del modelo (`.yaml`, formato 1)

`relations[]` ya está declarado en la versión 1 del formato desde el Incremento
1. Este incremento es el primero que lo escribe, y lo único que cambia es un
valor del enum de las dos reglas (R11).

### Relación

| Campo | Tipo | Obligatorio | Regla |
| ----- | ---- | ----------- | ----- |
| `name` | nombre técnico | sí | Único en el modelo. Lo genera la aplicación como `fk_<tabla>_<campo>`, con sufijo `_2`, `_3`… si choca (R10) |
| `fromTable` | nombre técnico | sí | Tabla declarada en el modelo; es la que lleva la clave foránea |
| `fromFields` | lista de nombres técnicos | sí | Al menos uno. Las relaciones que este incremento crea tienen exactamente uno (Clarifications) |
| `toTable` | nombre técnico | sí | Tabla declarada en el modelo. Puede ser la misma que `fromTable` (FR-013a) |
| `toFields` | lista de nombres técnicos | sí | Misma longitud que `fromFields`. En lo que crea este incremento, la llave primaria de `toTable` |
| `onDelete` | acción referencial | no | Por defecto `no_action` |
| `onUpdate` | acción referencial | no | Por defecto `no_action` |

### Acción referencial

```text
no_action | restrict | cascade | set_null | set_default
```

`set_default` es el valor nuevo (R11). Los cuatro anteriores se leen igual que
antes, así que ningún archivo guardado deja de ser válido y `formatVersion`
**sigue en 1**. En la interfaz se muestran en mayúsculas y con espacio —
`NO ACTION`, `SET NULL`, `SET DEFAULT`— porque son palabras de SQL (FR-028).

### Qué no se guarda

- **La marca FK del campo**: se deduce de las relaciones con `fieldMarks`, que
  ya existe. Crear la relación marca el campo sin un segundo cambio.
- **La cardinalidad**: se deduce del «no nulo» y de la unicidad de la columna
  con `cardinalityOf` (R5).
- **El estado del índice**: se deduce de `indexes[]` y `uniques[]` de la tabla.
- **El trazado y la animación**: son preferencias de quien mira, no del modelo.
- **El resaltado, la ficha abierta y el foco**: son de la sesión.

### Orden de las claves al escribir

El serializador escribe cada relación en este orden fijo, que es el que ya
tiene: `name`, `fromTable`, `fromFields`, `toTable`, `toFields`, `onDelete`,
`onUpdate`. Las dos reglas se omiten cuando valen `no_action`, para que un
archivo sin reglas explícitas no engorde.

## 2 · Preferencias (`preferences.json`, formato 1)

Tres campos nuevos, con valor por defecto cuando faltan; la versión no sube
(R15). El detalle está en [`contracts/preferences.md`](./contracts/preferences.md).

| Campo | Tipo | Por defecto | Qué recuerda |
| ----- | ---- | ----------- | ------------ |
| `relationRoute` | `orthogonal` \| `curved` \| `straight` | `orthogonal` | Trazado de las líneas (FR-017) |
| `relationAnimation` | `off` \| `subtle` \| `lively` | `subtle` | Flujo de las relaciones resaltadas (FR-024) |
| `foreignKeyPattern` | `string` (≤ 64) | `{tabla}_{pk}` | Patrón del nombre de la columna propuesta (FR-004) |

## 3 · Estado de la sesión (almacén, no se guarda)

| Dónde | Campo | Qué es |
| ----- | ----- | ------ |
| `src/store/fieldsPanel.ts` | `panelTab` | Ficha abierta: `'fields'` \| `'foreignKeys'` (FR-003) |
| `src/store/fieldsPanel.ts` | `focusedCell` | La celda enfocada, que ahora también apunta a celdas de la ficha de claves foráneas |
| `src/store/relations.ts` | `nullableWarning` | Qué relación tiene el aviso de SET NULL abierto (FR-030) |
| `CanvasSurface` (estado local) | `hotTable` | Tabla caliente por cursor o por foco; nadie fuera del lienzo la necesita (R7) |

## 4 · Lo que se deduce: once funciones puras

Once en total, diez de ellas nuevas: `relationCardinality` ya existía y solo
cambia de papel.

Seis de geometría, en `src/lib/canvas/relations.ts`:

| Función | Entrada | Salida |
| ------- | ------- | ------ |
| `relationAnchors` | modelo, layout, relación | Los dos extremos, su lado y el tipo de recorrido (`h`, `loop`, `self`) |
| `assignLanes` | lista de anclas | El carril de cada relación, repartido cada 14 px y con los cruces minimizados (R2) |
| `pathOf` | anclas, carril, trazado | La cadena `d` del `path` |
| `glyphOf` | extremo, punto, lado | La cadena `d` del glifo de cardinalidad |
| `relationLayer` | modelo, layout, trazado | Todo lo anterior junto: una lista lista para pintar, con color y clases |
| `touchedRelations` | modelo, tabla o esquema | Qué relaciones hay que repintar durante un arrastre (R6) |

Y cinco de dominio, en `src/lib/model/relations.ts` y `marks.ts`:

| Función | Entrada | Salida |
| ------- | ------- | ------ |
| `proposeForeignKey` | modelo, tabla origen, tabla destino, patrón | El campo que se va a crear, o `null` si el destino no sirve (R13) |
| `relationName` | tabla, campo, nombres existentes | El nombre técnico de la relación (R10) |
| `foreignKeyTargets` | modelo, tabla | Todas las tablas del modelo con `enabled` y el motivo cuando no sirven como destino (FR-009) |
| `indexStateOf` | tabla, campo | `'indexed'` o `'missing'`, según si el campo abre algún índice, único o llave primaria (FR-033) |
| `cardinalityOf` | modelo, relación | `{ from: 'one', to: 'many' \| 'zero-or-many' \| 'one' \| 'zero-or-one' }` (R5) |

`relationCardinality`, que ya existía, pasa a ser el formateador de
`cardinalityOf`: así la línea del lienzo y el texto del inspector no pueden
discrepar (SC-011). `fieldMarks`, `foreignKeyOf` y `relationsTouching` se usan
tal como están.

### Estados derivados de la ficha

| Estado | Cómo se deduce |
| ------ | -------------- |
| Destinos válidos | Las tablas del modelo con llave primaria de exactamente una columna; las demás se ofrecen deshabilitadas con el motivo (FR-009) |
| «Indexada» / «Sin índice» | La columna está, sola o como primera, en algún `indexes[]` o `uniques[]` de la tabla (FR-033) |
| Aviso de SET NULL | La regla es `set_null` y la columna no admite nulos (FR-030) |
| «Referenciada por» | Relaciones cuyo `toTable` es la tabla abierta (FR-031) |
| Contador de la ficha | Relaciones cuyo `fromTable` es la tabla abierta (FR-034) |

## 5 · Transiciones

Una relación no tiene estados propios; lo que cambia es el modelo, y cada
cambio es un paso del historial con su etiqueta (FR-012):

```text
(sin relación)
   │  addForeignKey            «editar la clave foránea»
   ▼
relación completa ──── setForeignKeyColumn ────► relación completa
   │                   setForeignKeyTarget
   │                   setReferentialAction     «cambiar ON DELETE / UPDATE»
   │
   │  deleteForeignKey         «eliminar la clave foránea»
   ▼
(sin relación, la columna se queda sin marca FK)
```

Eliminar el campo o la tabla que una relación usa no es una transición de aquí:
lo hacen las acciones del Incremento 3, que ya se llevan las relaciones
afectadas en el mismo paso (FR-037).

## 6 · Invariantes

1. `fromFields.length === toFields.length` en toda relación del archivo.
2. `name` único entre las relaciones del modelo.
3. Toda tabla y todo campo que una relación nombra existen en el modelo (ya lo
   valida `validate.ts`).
4. En una relación de una tabla hacia sí misma, `fromFields` y `toFields` no
   comparten ningún campo (FR-009a).
5. La marca FK de un campo es verdadera si y solo si alguna relación lo usa en
   `fromFields`; no hay forma de escribirla a mano.
6. Lo que dibuja el glifo del extremo y lo que dice el texto del inspector salen
   de la misma llamada a `cardinalityOf` (SC-011).
