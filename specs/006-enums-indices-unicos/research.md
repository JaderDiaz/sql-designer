# Fase 0 · Investigación: Enums, índices y únicos (Incremento 5)

Veintidós decisiones técnicas, cada una con su alternativa descartada. Casi todo
el incremento es dominio —nombres, listas y reglas sobre el modelo—, así que las
decisiones se escriben como funciones puras que se prueban sin pantalla; la
interfaz reutiliza la hoja, la rejilla y las fichas que ya existen.

## R1 · El campo usa el enum por su nombre, y quién es quién lo dice una sola función

**Decisión**: un campo de tipo enum guarda en `type` el nombre del enum, sin
identificador aparte. Una función pura `typeKindOf(model, type)` en
`src/lib/model/enums.ts` contesta `'engine'`, `'enum'` o `'unknown'`, y es lo
único que la rejilla de campos, la tarjeta y el selector de tipo consultan. Si
un archivo trae un enum con el nombre de un tipo del motor, gana el tipo del
motor: el archivo sigue siendo válido y la hoja impide crear ese caso (FR-005).

**Razón**: el formato 1 ya guarda el tipo como un nombre, y un enum es un tipo
con nombre también en SQL. Hoy `typeTraits` marca cualquier tipo fuera del
catálogo del motor como desconocido y la rejilla lo avisa (FR-018a del
Incremento 3); sin esta función, cada campo de tipo enum llevaría ese aviso.
Una sola función evita que el selector, la tarjeta y el aviso discrepen.

**Alternativa descartada**: un campo `enum` aparte en el campo, o un
identificador estable del enum. Las dos cambian el formato del archivo y
duplican lo que el nombre ya dice; el precio del nombre —propagar el renombrado—
se paga en R2 con una función de diez líneas.

## R2 · Renombrar propaga en la misma escritura al almacén

**Decisión**: `renameEnumInFields(model, from, to)` devuelve el modelo con el
tipo de todos los campos cambiado, y `updateEnum` la aplica junto con el cambio
del propio enum en **un solo** `pushHistory`. No hay un segundo paso ni un
efecto que reaccione al cambio.

**Razón**: FR-015 pide un solo paso de historial, y SC-003 que ningún campo se
quede con un tipo que ya no existe. Con una sola escritura no hay estado
intermedio que deshacer a medias. Es el mismo patrón con el que renombrar un
esquema ya arrastra a sus tablas, enums y vistas (`src/store/schemas.ts`).

**Alternativa descartada**: suscribirse al cambio del enum y retipar después.
Son dos pasos de historial y un cuadro en el que los campos apuntan a nada.

## R3 · El tipo de reemplazo sale del catálogo del motor

**Decisión**: `replacementTypeOf(engine)` consulta el catálogo de
`src/lib/model/engines.ts`: si el motor ofrece `varchar`, devuelve `varchar` con
longitud 40; si no, el tipo de texto del motor (`textTypeOf`), sin longitud. Da
`varchar(40)` en PostgreSQL y MySQL y `text` en SQLite. `dropEnums(model,
names)` quita los enums y retipa sus campos con esa función; la usan eliminar un
enum (FR-018) y eliminar un esquema con sus enums (FR-019).

**Razón**: la clarificación 3 fijó el tipo y descartó el selector. Preguntar al
catálogo y no escribir una tabla por motor cumple «o el tipo de texto del motor
cuando este no lo ofrezca» y sigue valiendo si mañana entra un cuarto motor. Una
sola función para los dos caminos de borrado impide que diverjan.

**Alternativa descartada**: usar `textTypeOf` a secas. En PostgreSQL devuelve
`text`, que no es lo que la clarificación decidió; y escribir `varchar` a mano
deja en SQLite un campo con el aviso de tipo desconocido.

## R4 · La hoja valida; el validador del archivo no se endurece

**Decisión**: las reglas de FR-005 a FR-007 viven en funciones puras de
`src/lib/model/enums.ts` —`enumNameProblem`, `enumValueProblems`,
`cleanEnumValue`— que la hoja consulta en cada tecla. `validate.ts` no gana
reglas: sigue exigiendo un nombre técnico, un esquema que exista y al menos un
valor no vacío. Un archivo con dos valores iguales o con un valor de 80
caracteres se abre; la hoja marca el problema cuando se edita ese enum.

**Razón**: endurecer el validador convertiría en ilegibles archivos que hoy son
válidos, y el principio II dice que el archivo manda. La hoja es donde nace el
dato nuevo, y ahí sí puede ser estricta.

**Alternativa descartada**: rechazar al abrir. Rompe la ida y vuelta de un
archivo escrito a mano o por otra herramienta sin que el usuario pueda
arreglarlo desde la aplicación.

## R5 · La hoja del enum es un `Sheet` con borrador local

**Decisión**: `EnumDialog` usa el componente `Sheet` que ya usan «Nueva tabla» y
«Nuevo esquema». El nombre, el esquema, los valores y el valor a medio escribir
son estado local del componente; el almacén solo se toca al confirmar.
`navigation.ts` gana los diálogos `'enum'` y `'delete-enum'`, y la parte nueva
del almacén guarda `enumTarget`: el nombre del enum que se edita o se elimina, o
`null` para uno nuevo.

**Razón**: FR-009 pide que cancelar no cambie nada, y un borrador local lo da
gratis. El principio IV pone en el componente el estado efímero de un
formulario. Es además el patrón de los dos formularios vecinos, así que quien
los conoce conoce este.

**Alternativa descartada**: escribir cada tecla al almacén con fusión de pasos,
como la rejilla de campos. Sirve para una rejilla sin botón de guardar; aquí
obligaría a deshacer a mano al cancelar.

## R6 · Los valores se reordenan con botones, no arrastrando

**Decisión**: cada fila lleva «Subir», «Bajar» y «Quitar», como en el tablero y
como las flechas de la rejilla de campos del Incremento 3. No hay arrastre.

**Razón**: FR-044 exige todo con el teclado, y dos botones lo son sin escribir
un gesto. Una lista de valores es corta; arrastrar no ahorra nada.

**Alternativa descartada**: arrastrar con una biblioteca de reordenado. Es una
dependencia nueva y un segundo camino de teclado que mantener.

## R7 · Dos partes nuevas del almacén: `enums.ts` e `indexes.ts`

**Decisión**: `src/store/enums.ts` lleva las cuatro acciones del enum (crear,
editar, duplicar, eliminar) y la apertura de sus dos diálogos.
`src/store/indexes.ts` lleva las acciones de índices y únicos, que comparten
reglas de nombre y forma. `tables.ts` solo cambia en `removeFieldFromKeys`
(R15).

**Razón**: `tables.ts` ya pasa de 880 líneas. Los índices y los únicos viven
dentro de la tabla, pero sus acciones no comparten nada con las de los campos
salvo el modelo, y juntos entre sí comparten la validación del nombre y la
propuesta.

**Alternativa descartada**: meterlo todo en `tables.ts`. Funciona, y deja un
archivo de 1 300 líneas con tres temas.

## R8 · La marca de único es un dato opcional del índice, y la versión no sube

**Decisión**: el tipo `Index` extiende `NamedFields` con `unique?: boolean`. El
serializador lo escribe solo cuando es `true`; `parse.ts` y `validate.ts` lo
aceptan en `indexes[]` y lo rechazan en `uniques[]`. `formatVersion` sigue en 1.

**Razón**: FR-042. Es el mismo argumento que `set_default` en el Incremento 4:
un archivo anterior no trae la clave y se lee como no único, así que nada
escrito antes deja de ser válido. Omitirlo cuando es `false` mantiene idéntica
la ida y vuelta de los archivos existentes.

**Alternativa descartada**: guardar un índice único como un único más en
`uniques[]`. Mezcla una restricción con un índice —que en SQL son sentencias
distintas— y haría aparecer la marca UK en el campo.

## R9 · Los índices automáticos se deducen, no se guardan

**Decisión**: `automaticIndexes(table)` devuelve la llave primaria, con el
nombre `pk_<tabla>` y la clase `PRIMARY KEY`, y cada único de `uniques[]` con su
nombre y la clase `UNIQUE`. Es una función pura de la tabla; nada de eso se
escribe en el archivo.

**Razón**: principio II: lo que se puede deducir no se guarda. La pestaña solo
los muestra (FR-021), y el nombre `pk_<tabla>` es el del tablero.

**Alternativa descartada**: materializarlos en `indexes[]` con una marca de
«automático». Dos verdades sobre la misma restricción, y un archivo que hay que
reconciliar cada vez que cambia la llave.

## R10 · El nombre propuesto no necesita una bandera

**Decisión**: `proposeConstraintName(prefix, table, fields, taken)` forma
`<prefijo><tabla>_<campo>_<campo>…`, lo recorta a 63 caracteres y le pone sufijo
`_2`, `_3`… hasta no chocar con ningún índice ni único del modelo. Para saber si
un nombre «sigue siendo el propuesto» (FR-026, FR-034) no se guarda nada: se
compara el nombre actual con lo que la propuesta daría para las columnas que el
índice tenía antes del cambio. Si coinciden, se vuelve a proponer.

**Razón**: es la misma lectura que FR-007 del Incremento 4 hace de la columna de
la clave foránea, y evita un campo en el archivo —o un estado de sesión que se
pierde al reabrir— para algo que el propio nombre ya dice.

**Alternativa descartada**: una bandera `autoName` en el índice. Ensucia el
archivo con un dato de interfaz.

## R11 · La fila nunca deja el modelo inválido

**Decisión**: «Añadir índice» y «Añadir único» crean el objeto ya completo, con
columnas y nombre. Un cambio que lo dejaría inválido —nombre vacío o repetido,
índice sin columnas, único compuesto con una— no llega al almacén: la celda
conserva lo escrito con su error y el modelo se queda como estaba, igual que la
celda de nombre de la rejilla de campos.

**Razón**: el formato exige al menos un campo por índice, y un único de un campo
es otra cosa: la marca UK (R13). Si el modelo en memoria nunca es inválido,
Guardar nunca escribe un archivo que no se pueda reabrir, y deshacer nunca
vuelve a un estado roto.

**Alternativa descartada**: filas a medio rellenar en el modelo, como dibuja el
tablero para los únicos (columnas vacías). Obliga a filtrar al guardar y a
explicar por qué lo guardado no es lo que se ve.

## R12 · El selector de varias columnas se monta sobre el menú de Radix que ya está

**Decisión**: `src/components/ui/MultiSelect.tsx`, puro, sobre
`@radix-ui/react-dropdown-menu` con `CheckboxItem`: el menú no se cierra al
marcar, el disparador muestra las columnas elegidas en orden, y el valor es una
lista ordenada por el momento de la elección. **Ninguna dependencia nueva.**

**Razón**: Radix no trae un selector múltiple, pero sí el menú con casillas, que
aporta foco, roles y teclado (principio V). El paquete ya está en el proyecto.
El orden importa: en un índice compuesto solo la primera columna sirve para
buscar por ella sola (FR-025, FR-031).

**Alternativa descartada**: `<select multiple>` nativo —no conserva el orden de
elección y no se puede vestir con los tokens— o una biblioteca de combobox, que
es una dependencia nueva para una lista de diez campos.

## R13 · Único de un campo y único compuesto comparten lista y se separan al leer

**Decisión**: los dos viven en `uniques[]`, como hasta ahora.
`splitUniques(table)` los separa por `fields.length`: con uno es la marca UK,
que se sigue poniendo y quitando en «Campos» con la acción que ya existe; con
dos o más es compuesto y se edita en la pestaña. Las acciones de la pestaña no
pueden producir un único de un campo (R11). `setFieldKey` deja de escribir
`uq_` a mano: nombra el único de la marca UK con `proposeConstraintName` y el
prefijo de únicos, igual que un compuesto (FR-038a). Con el prefijo inicial y
sin choques el nombre es el de siempre, `uq_<tabla>_<campo>`.

**Razón**: el Incremento 3 ya guarda la marca UK así, y FR-032 pide mostrar los
dos en la misma pestaña. Una sola lista en el archivo y una sola función que la
parte.

**Alternativa descartada**: una lista aparte para los compuestos. Cambia el
formato y obliga a migrar los archivos existentes.

## R14 · La cardinalidad aprende del índice único en la función que ya manda

**Decisión**: `cardinalityOf` en `src/lib/model/marks.ts` añade a las claves que
considera únicas los índices con `unique: true` y **una sola** columna. Nada más
cambia: `relationCardinality` y el glifo siguen leyéndola.

**Razón**: la clarificación 5. Como la cardinalidad sale de un solo sitio desde
el Incremento 4, la línea y el inspector no pueden discrepar (SC-013). Limitarlo
a una columna cumple FR-029a: los de varias no cambian la lectura.

**Alternativa descartada**: convertir el índice único de una columna en marca
UK. FR-029a lo prohíbe, y haría desaparecer el índice de su pestaña.

## R15 · Eliminar un campo ya no deja una regla más estricta

**Decisión**: `fieldDependents(table, field)` devuelve tres listas: índices que
pierden la columna, índices que desaparecen (los que se quedan sin columnas y
los marcados como únicos) y únicos compuestos que desaparecen.
`removeFieldFromKeys` de `src/store/tables.ts` pasa a aplicarla, y
`DeleteFieldDialog` la usa para nombrarlos.

**Razón**: la clarificación 4. Hoy `removeFieldFromKeys` quita el campo de cada
único y conserva lo que quede, así que un único de «torre + número» se convierte
en «torre» única sin avisar. Que el diálogo y la acción lean la misma función
garantiza que lo que se anuncia es lo que pasa (RS-08).

**Alternativa descartada**: conservar el único reducido. Es el comportamiento
actual y es justo el que la clarificación descartó.

## R16 · Eliminar un esquema con sus enums retipa los campos de fuera

**Decisión**: `deleteSchema` con «eliminar también su contenido» pasa los enums
que se van por `dropEnums` (R3), de modo que los campos de tablas de otros
esquemas que los usaban quedan con el tipo de reemplazo. `DeleteSchemaDialog`
los cuenta y lo dice.

**Razón**: FR-019. Hoy esos campos se quedan con un tipo que ya no existe; hasta
ahora no se notaba porque ningún incremento creaba enums.

**Alternativa descartada**: impedir eliminar el esquema mientras sus enums estén
en uso. Bloquea una acción que el Incremento 2 dejó permitida y confirmada.

## R17 · Dos preferencias nuevas sobre el comando que ya existe

**Decisión**: `indexPrefix` (por defecto `idx_`) y `uniquePrefix` (`uq_`) en
`preferences.json`, con el mismo `preferences_update`. Rust los sanea como hace
con `foreignKeyPattern`: recorta espacios, pasa a minúsculas, descarta lo que no
sea letra, número o guion bajo, limita a 16 caracteres y, si no queda nada o
empieza por número, vuelve al valor por defecto. En Ajustes son dos campos de
texto que escriben al perder el foco o con Enter.

**Razón**: FR-043. Un prefijo es el principio de un nombre técnico, así que
tiene que poder serlo. Escribir al salir del campo, y no en cada tecla, evita
guardar prefijos a medias en el disco.

**Alternativa descartada**: guardar los prefijos en el modelo. Son una costumbre
de quien modela, no un dato del modelo: el nombre resultante sí viaja en el
archivo.

## R18 · La sección «Enums» de la barra lateral repite la de «Tablas»

**Decisión**: `ModelSidebar` gana una sección «Enums» entre «Esquemas» y
«Tablas», en el orden del tablero, con el botón «Nuevo enum» en su cabecera, una
fila por enum con su abreviatura y su número de valores, y el filtro por esquema
enfocado que ya usa «Tablas». El icono de cada fila lleva el color de su
esquema, como el de las tablas: el tablero lo pinta morado fijo porque allí el
enum no tiene esquema, y aquí sí lo tiene (pedido por el usuario el
2026-11-17). Cada fila se envuelve en
`EnumContextMenu`, sobre el `ContextMenu` puro que ya usan esquemas y tablas.

**Razón**: FR-010 y FR-020. El menú contextual de Radix abre con clic
secundario, con ⇧F10 y con la tecla de menú, que es lo que FR-020 pide.

**Alternativa descartada**: un panel propio de enums. El tablero los pone en la
barra lateral y no hay nada más que mostrar.

## R19 · «Usado por» y la confirmación leen la misma lista

**Decisión**: `enumUsage(model, name)` devuelve los campos que usan un enum como
pares tabla y campo. La leen la hoja («Usado por»), la cabecera del menú
contextual (cuántos campos) y la confirmación de eliminar (cuáles).

**Razón**: SC-004 pide que la confirmación nombre exactamente los campos
afectados. Una sola función es la forma de que las tres pantallas no puedan
contar distinto.

**Alternativa descartada**: un índice inverso mantenido en el almacén. Es estado
derivado, que el principio II manda deducir; recorrer 200 tablas cuesta menos de
un milisegundo.

## R20 · Qué se prueba con qué

**Decisión**:

- **Vitest, funciones puras**: todo `src/lib/model/enums.ts` y
  `src/lib/model/indexes.ts`, `cardinalityOf` con el índice único, y la ida y
  vuelta del archivo con `unique`.
- **Vitest, almacén**: cada acción con su paso de historial, el renombrado que
  propaga, el borrado que retipa y el campo eliminado que se lleva sus únicos.
- **Vitest, componentes**: la hoja del enum con sus errores, las dos pestañas
  con sus estados vacíos, la sección de la barra lateral, `MultiSelect`.
- **WebdriverIO**: `e2e/specs/12-enums-indices-unicos.e2e.js` recorre la
  demostración de SC-001 sobre la aplicación real, guarda, reabre y mide SC-011.

**Razón**: el reparto de los incrementos anteriores. Lo que es regla se prueba
como función, donde un caso cuesta un milisegundo; el recorrido se reserva para
lo que solo existe con la ventana de verdad.

**Alternativa descartada**: probar las reglas a través de la pantalla. Lento, y
un fallo no dice si se rompió la regla o el botón.

## R21 · La paleta de comandos sigue sin existir

**Decisión**: el tablero ofrece «Nuevo enum…» en la paleta de comandos y lista
en ella los enums. La paleta es de un incremento posterior, igual que en los
Incrementos 1 a 4, así que el spec lo deja fuera en Assumptions. Este incremento
deja las acciones listas —`openEnumDialog(null)` y `openEnumDialog(nombre)`— y
la puerta 4 queda parcial, anotada en Complexity Tracking. Ninguna acción nueva
gana atajo: el tablero no le da ninguno a «Nuevo enum» y las demás son acciones
de fila o de menú contextual.

**Razón**: adelantar la paleta arrastra el buscador del modelo y una pantalla
entera. Las dos entradas de FR-001 —la barra lateral y la tarjeta del modelo
vacío— sí entran.

**Alternativa descartada**: exigir la paleta en el spec. Un requisito que
depende de una pantalla que no existe no se puede cumplir ni probar; el análisis
cruzado lo señaló y se movió a Assumptions.

## R22 · Desvíos deliberados del tablero de diseño

Del tablero `Editor` se toman medidas, textos y jerarquía. Nueve cosas se hacen
distinto a propósito:

1. **Selector de esquema en la hoja del enum**: el tablero no lo dibuja y el
   formato lo exige (clarificación 1).
2. **Sin columna «Método»** en los índices (clarificación 2).
3. **Sin vista previa de SQL** en la hoja del enum: el SQL sale del generador
   único, que llega con Exportar (principio II).
4. **«Añadir único» nace con dos columnas**: el tablero lo crea vacío (R11).
5. **El nombre del único se forma con sus columnas** (`uq_unidad_torre_numero`)
   y no con un contador (`uq_unidad_1`), para que diga qué restringe (R10).
6. **El índice automático de un único usa su nombre real** del archivo y no uno
   recalculado.
7. **Ajustes solo gana los dos prefijos**: «Nombres de tabla», «Estilo de
   nombres» y el patrón de claves foráneas del tablero no entran aquí.
8. **El icono del enum en la barra lateral lleva el color de su esquema**, no el
   morado fijo del tablero (R18).
9. **El valor de un enum tiene largo máximo** (63 caracteres), que el tablero no
   limita (FR-007).
