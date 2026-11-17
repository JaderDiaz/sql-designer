# Contrato de enums · Incremento 5

Lo que la interfaz y las pruebas pueden dar por hecho sobre los enums: funciones
puras, acciones del almacén, nombres accesibles y mensajes. Los índices y los
únicos están en [`indexes.md`](./indexes.md); la forma del archivo, en
[`model.schema.json`](./model.schema.json).

## 1 · Funciones puras (`src/lib/model/enums.ts`)

| Función | Entrada | Salida | Garantías |
| ------- | ------- | ------ | --------- |
| `typeKindOf(model, type)` | Modelo y nombre de tipo | `'engine' \| 'enum' \| 'unknown'` | `'engine'` si está en el catálogo del motor del modelo; si no, `'enum'` si hay un enum con ese nombre; si no, `'unknown'`. El tipo del motor gana al enum del mismo nombre (R1) |
| `enumUsage(model, name)` | Modelo y nombre de enum | `Array<{ table, field }>` | En el orden de las tablas y de sus campos. Lista vacía si nadie lo usa o si el nombre es un tipo del motor (R19) |
| `enumNameProblem(model, name, editing)` | Modelo, nombre ya convertido a técnico y nombre del enum que se edita (o `null`) | Mensaje o `null` | Vacío, repetido en otro enum, igual a un tipo del motor, o de más de 63 caracteres. El propio enum que se edita no cuenta como repetido (FR-005) |
| `cleanEnumValue(text)` | Lo escrito en una fila | Texto | Sin comillas simples y recortado a 63 caracteres; no toca los espacios, que se recortan al guardar (FR-007) |
| `enumValueProblems(values)` | Lista de valores tal como está en la hoja | `{ rows: Array<'empty' \| 'duplicate' \| null>, message: string \| null }` | Compara sin mayúsculas ni espacios de los extremos; marca como repetida la segunda aparición y las siguientes. `message` es uno solo, con esta prioridad: sin valores, repetidos, vacíos (FR-006, FR-007) |
| `duplicateEnumName(model, name)` | Modelo y nombre | Nombre técnico | `<name>_copia`, después `<name>_copia_2`, `_3`…; recortado a 63 conservando el sufijo (FR-020) |
| `renameEnumInFields(model, from, to)` | Modelo y dos nombres | Modelo | Cambia `type` en cada campo cuyo tipo es `from`; no toca `length`, `scale` ni `default`. Devuelve el mismo objeto si nadie lo usa (R2) |
| `replacementTypeOf(engine)` | Motor | `{ type, length? }` | `varchar` con 40 si el catálogo lo ofrece; si no, el tipo de texto del motor sin longitud (R3) |
| `dropEnums(model, names)` | Modelo y nombres de enum | Modelo | Quita esos enums y pasa sus campos al tipo de reemplazo, sin `scale`. Omite `enums` si la lista queda vacía (R3) |

### Ejemplos fijados

| Llamada | Resultado |
| ------- | --------- |
| `typeKindOf(m, 'estado_pago')` con ese enum en `m` | `'enum'` |
| `typeKindOf(m, 'text')` en PostgreSQL, aunque exista un enum `text` | `'engine'` |
| `enumNameProblem(m, 'integer', null)` en PostgreSQL | `'Ese nombre ya lo usa otro tipo.'` |
| `enumValueProblems(['activo', ' Activo ', ''])` | `rows: [null, 'duplicate', 'empty']`, `message: 'Hay valores repetidos.'` |
| `enumValueProblems([])` | `rows: []`, `message: 'Añade al menos un valor.'` |
| `duplicateEnumName(m, 'estado_pago')` con `estado_pago_copia` ya en `m` | `'estado_pago_copia_2'` |
| `replacementTypeOf('postgres')` | `{ type: 'varchar', length: 40 }` |
| `replacementTypeOf('sqlite')` | `{ type: 'text' }` |

## 2 · Acciones del almacén (`EnumsSlice`, `src/store/enums.ts`)

| Acción | Efecto | Historial |
| ------ | ------ | --------- |
| `openEnumDialog(name \| null)` | Abre la hoja: `null` para «Nuevo enum», un nombre para «Editar enum» | — |
| `openDeleteEnumDialog(name)` | Abre la confirmación de eliminar | — |
| `createEnum(draft)` | Añade el enum al final de `enums[]`. Devuelve `false` y no cambia nada si el borrador no es válido | «crear el enum» |
| `updateEnum(name, draft)` | Cambia nombre, esquema y valores; si el nombre cambia, retipa los campos en la misma escritura (R2) | «editar el enum» |
| `duplicateEnum(name)` | Añade la copia justo después del original, en su mismo esquema | «duplicar el enum» |
| `deleteEnum(name)` | `dropEnums` con ese nombre y cierra la hoja y la confirmación | «eliminar el enum» |

`draft` es `{ name, schema, values }`, con el nombre ya técnico y los valores ya
recortados. Las cuatro escrituras marcan el modelo «Editado» y son un solo paso
cada una (FR-041).

`deleteSchema` (`src/store/schemas.ts`), cuando se lleva el contenido del
esquema, pasa sus enums por `dropEnums` (R16).

## 3 · Entradas y teclado

| Entrada | Qué hace |
| ------- | -------- |
| Botón «Nuevo enum» de la sección «Enums» | `openEnumDialog(null)` (FR-001) |
| «Definir un enum» de la tarjeta del modelo vacío | `openEnumDialog(null)` (FR-001) |
| Clic o Enter sobre un enum de la barra lateral | `openEnumDialog(nombre)` (FR-010) |
| Clic secundario, ⇧F10 o tecla de menú sobre un enum | Menú contextual (FR-020) |
| Enter en «Nuevo valor» | Añade el valor y deja el foco en el campo (FR-002) |
| Enter en cualquier otro campo de la hoja | Confirma, si no hay errores |
| Escape | Cierra la hoja sin cambiar nada (FR-009) |

No hay atajo global para «Nuevo enum»: el tablero no le da ninguno. La entrada
de la paleta de comandos no es de este incremento (spec, Assumptions; research
R21).

## 4 · Nombres accesibles

| Elemento | Nombre |
| -------- | ------ |
| Hoja | «Nuevo enum» / «Editar enum» |
| Campo del nombre | «Nombre» |
| Selector de esquema | «Esquema» |
| Fila de valor | «Valor 1», «Valor 2»… |
| Botones de fila | «Subir», «Bajar», «Quitar <valor>» |
| Campo de alta | «Nuevo valor» |
| Sección de la barra lateral | región «Enums» (o «Enums de <esquema>» con foco de esquema) |
| Fila de enum | «<nombre>, 4 valores» |
| Ficha de uso | «Abrir <tabla>.<campo> en el editor» |
| Opción del selector de tipo | «<nombre>», con la segunda línea «enum» |

## 5 · Mensajes y estados

| Estado | Texto | Salida |
| ------ | ----- | ------ |
| Modelo sin esquemas | «Primero crea un esquema: un enum vive dentro de uno.» | Botón «Nuevo esquema» (FR-004) |
| Nombre vacío | «Escribe un nombre para el enum.» | Corregir el campo |
| Nombre repetido o de un tipo del motor | «Ese nombre ya lo usa otro tipo.» | Corregir el campo |
| Nombre que cambia al convertirse | «Se guardará como <nombre>» | Informativo |
| Sin valores | «Añade al menos un valor.» | Campo «Nuevo valor» |
| Lista vacía, antes de intentar guardar | «Aún no hay valores. Escribe el primero abajo y pulsa Enter.» | Campo «Nuevo valor» |
| Valor repetido | Fila marcada «Repetido»; «Hay valores repetidos.» | Corregir o quitar la fila |
| Valor vacío | Fila marcada; «Hay valores vacíos.» | Corregir o quitar la fila |
| Enum sin uso, en la hoja | «Ningún campo lo usa todavía.» | — |
| Eliminar un enum en uso | «¿Eliminar el enum «<nombre>»?» · «2 campos lo usan (pago.estado, cuota.estado) y pasarán a varchar(40).» | «Cancelar» / «Eliminar enum» |
| Eliminar un enum sin uso | «¿Eliminar el enum «<nombre>»?» · «Ningún campo lo usa.» | «Cancelar» / «Eliminar enum» |
| Cabecera del menú contextual | «Enum · 4 valores · 2 campos» | — |

El tipo de la confirmación se escribe con `replacementTypeOf`, así que en SQLite
dice «text».

## 6 · Lo que este contrato no cubre

- El SQL del enum en cada motor y la vista previa de la hoja: incremento de
  exportación.
- La descripción del enum: no se edita aquí.
- Validar los valores por defecto de los campos contra los valores del enum.
- La entrada de la paleta de comandos y la lista de enums en ella: cuando
  exista la paleta.
