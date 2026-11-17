# Fase 1 · Modelo de datos: Enums, índices y únicos (Incremento 5)

Cuatro capas, como en los incrementos anteriores: lo que viaja en el archivo del
modelo, lo que viaja en las preferencias, lo que vive solo en la sesión y lo que
se deduce de todo lo anterior. La regla del principio II se cumple aquí: nada
que se pueda deducir se guarda.

## 1 · Archivo del modelo (`.yaml`, formato 1)

`enums[]` en la raíz, y `uniques` e `indexes` en cada tabla, ya están declarados
en la versión 1 del formato desde el Incremento 1. Este incremento es el primero
que crea y edita enums, índices y únicos compuestos, y lo único que añade es la
marca `unique` del índice (R8). `formatVersion` **sigue en 1**. La forma
completa está en [`contracts/model.schema.json`](./contracts/model.schema.json).

### Enum

| Campo | Tipo | Obligatorio | Regla |
| ----- | ---- | ----------- | ----- |
| `name` | nombre técnico | sí | Único entre los enums del modelo. La hoja impide además que coincida con un tipo del catálogo del motor (FR-005) |
| `schema` | nombre técnico | sí | Un esquema declarado en el modelo (FR-003, Clarifications) |
| `values` | lista de textos | sí | Al menos uno, ninguno vacío. El orden es el del usuario (FR-008) |
| `comment` | texto | no | La hoja no lo edita; uno que venga del archivo se conserva |

Reglas que aplica la hoja y **no** el validador del archivo (R4): valores
distintos sin mirar mayúsculas ni espacios de los extremos, sin comillas
simples, y de 63 caracteres como mucho (FR-007).

### Campo de tipo enum

No hay forma nueva. El campo guarda en `type` el nombre del enum (R1) y no lleva
`length` ni `scale` (FR-011). El vínculo es el nombre: por eso renombrar el enum
reescribe `type` en sus campos (R2).

### Índice

| Campo | Tipo | Obligatorio | Regla |
| ----- | ---- | ----------- | ----- |
| `name` | nombre técnico | sí | Único entre los índices y únicos de todo el modelo (FR-027) |
| `fields` | lista de nombres técnicos | sí | Al menos uno, campos de su tabla, **en orden** (FR-025) |
| `unique` | booleano | no | **Nuevo.** Por defecto `false`; se omite cuando es `false` (FR-029, FR-042) |

No lleva método (Clarifications).

### Único

| Campo | Tipo | Obligatorio | Regla |
| ----- | ---- | ----------- | ----- |
| `name` | nombre técnico | sí | Único entre los índices y únicos de todo el modelo (FR-036) |
| `fields` | lista de nombres técnicos | sí | Con uno es la marca UK del campo (Incremento 3), que desde aquí se nombra con el prefijo de únicos (FR-038a); con dos o más es un único compuesto (R13) |

### Qué no se guarda

- **Los índices automáticos**: el de la llave primaria y el de cada único se
  deducen con `automaticIndexes` (R9).
- **Si un nombre es el propuesto**: se deduce comparándolo con la propuesta
  (R10).
- **Qué campos usan un enum**: se deduce con `enumUsage` (R19).
- **La cardinalidad**: se deduce con `cardinalityOf`, que ahora mira también el
  índice único de una columna (R14).
- **El estado «Indexada» / «Sin índice»**: se deduce con `indexStateOf`, que ya
  existía y no cambia.
- **Los prefijos**: son preferencias; el nombre que producen sí se guarda.
- **El borrador de la hoja, la ficha abierta y el foco**: son de la sesión.

### Orden de las claves al escribir

El serializador escribe cada enum como `name`, `schema`, `values`, `comment`;
cada único como `name`, `fields`; y cada índice como `name`, `fields`, `unique`.
`unique` solo aparece cuando vale `true`, así que un archivo anterior se reabre
y se guarda idéntico.

## 2 · Preferencias (`preferences.json`, formato 1)

Dos campos nuevos, con valor por defecto cuando faltan; la versión no sube
(R17). El detalle está en [`contracts/preferences.md`](./contracts/preferences.md).

| Campo | Tipo | Por defecto | Qué recuerda |
| ----- | ---- | ----------- | ------------ |
| `indexPrefix` | texto | `idx_` | Con qué empieza el nombre propuesto de un índice (FR-024) |
| `uniquePrefix` | texto | `uq_` | Con qué empieza el nombre propuesto de un único (FR-034) |

## 3 · Sesión (almacén, no se guarda)

| Dato | Dónde | Qué es |
| ---- | ----- | ------ |
| `dialog` | `navigation.ts` | Gana `'enum'` y `'delete-enum'` (R5) |
| `enumTarget` | `enums.ts` | Nombre del enum que se edita o se elimina; `null` para uno nuevo |
| `panelTab` | `fieldsPanel.ts` | Gana `'indexes'` y `'uniques'` |
| Borrador de la hoja | estado local de `EnumDialog` | Nombre, esquema, valores y el valor a medio escribir (R5) |
| Borrador de una celda de nombre | estado local de la fila | Lo escrito y su error, mientras no sea válido (R11) |

## 4 · Lo que se deduce (funciones puras)

| Función | Entrada | Salida |
| ------- | ------- | ------ |
| `typeKindOf` | modelo, nombre de tipo | `'engine'`, `'enum'` o `'unknown'` (R1) |
| `enumUsage` | modelo, nombre de enum | Los campos que lo usan, como tabla y campo (R19) |
| `enumNameProblem` | modelo, nombre, enum que se edita | El mensaje del error, o `null` (FR-005) |
| `cleanEnumValue` | lo escrito en una fila | El valor sin comillas simples y recortado a 63 caracteres (FR-007) |
| `enumValueProblems` | lista de valores | Qué filas están vacías o repetidas, y el mensaje de la hoja (FR-006, FR-007) |
| `duplicateEnumName` | modelo, nombre | `<nombre>_copia`, numerado hasta ser único (FR-020) |
| `renameEnumInFields` | modelo, nombre viejo, nombre nuevo | El modelo con los campos retipados (R2) |
| `replacementTypeOf` | motor | El tipo y la longitud a los que pasan los campos (R3) |
| `dropEnums` | modelo, nombres | El modelo sin esos enums y con sus campos retipados (R3) |
| `automaticIndexes` | tabla | La llave primaria y cada único, con nombre, columnas y clase (R9) |
| `splitUniques` | tabla | Los únicos de un campo y los compuestos (R13) |
| `constraintNames` | modelo | Todos los nombres de índices y únicos del modelo |
| `proposeConstraintName` | prefijo, tabla, campos, nombres usados | El nombre propuesto, recortado y sin choque (R10) |
| `isProposedName` | prefijo, tabla, campos, nombre | Si ese nombre es el propuesto para esas columnas (R10) |
| `proposeIndexField` | modelo, tabla | La primera clave foránea sin índice, o el primer campo fuera de la llave (FR-023) |
| `proposeUniqueFields` | tabla | Las dos columnas con las que nace un único, o `null` con menos de dos campos (FR-033) |
| `constraintNameProblem` | modelo, nombre, el que se edita | El mensaje del error, o `null` (FR-027, FR-036) |
| `duplicateOf` | tabla, columnas, el que se edita | El índice o la restricción que ya cubre esas mismas columnas, o `null` (FR-028, FR-037) |
| `fieldDependents` | tabla, campo | Índices que pierden la columna, índices que desaparecen y únicos compuestos que desaparecen (R15) |

Las firmas y los ejemplos fijados están en
[`contracts/enums.md`](./contracts/enums.md) y
[`contracts/indexes.md`](./contracts/indexes.md).

## 5 · Transiciones

### Enum

```text
(no existe) ──crear──▶ existe, sin uso ──elegir como tipo──▶ en uso
existe ──editar valores o esquema──▶ existe          (los campos no cambian)
en uso ──renombrar──▶ en uso                          (los campos siguen al nombre)
existe ──duplicar──▶ existe + copia sin uso
en uso ──eliminar──▶ (no existe)                      (los campos pasan al tipo de reemplazo)
```

Cada flecha es un solo paso de historial (FR-041).

### Único

```text
campo ──marcar UK en «Campos»──▶ único de un campo     (Incremento 3)
(no existe) ──«Añadir único»──▶ compuesto de dos columnas
compuesto ──añadir o cambiar columnas──▶ compuesto     (nunca menos de dos)
compuesto ──eliminar un campo suyo──▶ (no existe)      (R15)
```

### Índice

```text
(no existe) ──«Añadir índice»──▶ índice de una columna
índice ──cambiar columnas, nombre o único──▶ índice    (nunca sin columnas)
índice no único ──eliminar un campo suyo──▶ índice sin esa columna, o (no existe) si era la única
índice único ──eliminar un campo suyo──▶ (no existe)   (R15)
```
