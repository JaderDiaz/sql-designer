# Feature Specification: Enums, índices y únicos (Incremento 5)

**Feature Branch**: `006-enums-indices-unicos`

**Created**: 2026-11-17

**Status**: Draft

**Input**: User description: "Incremento 5 · Enums, índices y únicos. Objetivo: completar el modelo con listas de valores y reglas de búsqueda y unicidad. Depende de: Incremento 3 (los índices sobre claves foráneas, también del 4). Se demuestra: crear un enum, usarlo en dos campos, renombrarlo y crear un índice y un único compuesto. SF-5.1 Crear y editar enums; SF-5.2 Renombrar y eliminar enums en uso; SF-5.3 Índices; SF-5.4 Únicos compuestos. El diseño de pantallas es «SQL Designer · Diseño de Pantallas» y los componentes vienen de «Aura»."

## Clarifications

### Session 2026-11-17

- Q: ¿Cada enum debe pertenecer a un esquema, elegido en la hoja «Nuevo enum»,
  o los enums son del modelo entero, sin esquema? → A: Pertenece a un esquema:
  la hoja añade un selector, con el esquema enfocado o el primero como
  propuesta; sin esquemas no se crea un enum, igual que una tabla, y el archivo
  no cambia
- Q: ¿La pestaña «Índices» debe dejar elegir el método del índice (btree, hash,
  gin, gist), como dibuja el tablero de diseño, o el índice usa siempre el
  método por defecto del motor? → A: Sin método: el índice lleva nombre,
  columnas y único, y usa el método por defecto del motor; es un desvío
  deliberado del tablero
- Q: Al eliminar un enum que usan campos, ¿esos campos pasan siempre a un tipo
  de texto fijo, o la confirmación deja elegir el tipo al que pasan? → A: Tipo
  fijo: texto de longitud variable de 40 caracteres (`varchar(40)`), o el tipo
  de texto del motor si no lo ofrece; la confirmación lo anuncia y no pregunta
- Q: Al eliminar un campo que forma parte de un único compuesto, ¿el único
  compuesto se elimina entero o se queda con las columnas que le resten? → A:
  Se elimina entero y la confirmación lo nombra; el índice normal conserva las
  columnas que le queden, porque solo afecta a la velocidad y no a los datos
- Q: ¿Un índice marcado como único sobre una sola columna debe contar como
  «campo único» para deducir que una relación es uno a uno, igual que la marca
  UK? → A: Sí: un índice único de una sola columna hace «uno a uno» la relación
  de esa columna, como la marca UK; los índices únicos y los únicos compuestos
  de varias columnas no cambian la cardinalidad

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Crear y editar enums (Priority: P1)

Quien modela define una lista cerrada de valores —por ejemplo los estados de un
pago— y la reutiliza como tipo de campo. «Nuevo enum» abre una hoja donde se
escribe el nombre, se elige el esquema y se añaden los valores uno por fila; los
valores se pueden reordenar y quitar. Mientras el nombre esté repetido o algún
valor esté vacío o duplicado, la hoja dice qué falla y no deja guardar. El enum
creado aparece en la barra lateral con su número de valores y se ofrece como
tipo en el selector de tipo de cualquier campo.

**Why this priority**: es el primer paso de la demostración y la única parte
del incremento que añade un objeto nuevo al modelo. Sin enums, la historia 2 no
existe, y los campos siguen sin poder decir «solo estos valores».

**Independent Test**: se prueba sobre un modelo con un esquema y dos tablas
creando un enum de cuatro valores, reordenándolos, provocando los tres errores
(nombre repetido, valor vacío, valor duplicado), y eligiéndolo después como tipo
de dos campos.

**Acceptance Scenarios**:

1. **Dado** el Editor, **cuando** pulso «Nuevo enum» en la sección «Enums» de la
   barra lateral o pulso «Definir un enum» en la tarjeta del modelo vacío,
   **entonces** se abre la hoja «Nuevo enum» con el foco en el nombre.
2. **Dado** la hoja, **cuando** escribo un valor en «Nuevo valor» y pulso Enter
   o «Añadir», **entonces** el valor pasa a la lista como una fila numerada y el
   campo queda listo para el siguiente.
3. **Dado** varios valores, **cuando** pulso «Subir», «Bajar» o «Quitar» en una
   fila, **entonces** el valor cambia de posición o desaparece, y el contador
   dice cuántos quedan.
4. **Dado** un nombre que ya usa otro enum del modelo o un tipo del motor,
   **entonces** el campo dice «Ese nombre ya lo usa otro tipo» y «Crear enum»
   queda deshabilitado.
5. **Dado** un valor vacío o dos valores iguales, **entonces** la fila
   afectada se marca, la hoja dice «Hay valores vacíos» o «Hay valores
   repetidos» y no se puede guardar.
6. **Dado** la hoja sin ningún valor, **cuando** intento crear el enum,
   **entonces** la hoja dice «Añade al menos un valor» y no crea nada.
7. **Dado** un nombre con mayúsculas, espacios o acentos, **entonces** la hoja
   dice con qué nombre técnico se guardará antes de confirmar.
8. **Dado** un enum creado, **entonces** aparece en la sección «Enums» de la
   barra lateral con su número de valores, el modelo queda «Editado» y la
   creación se deshace en un solo paso.
9. **Dado** un enum creado, **cuando** abro el selector de tipo de un campo,
   **entonces** el enum aparece entre las opciones, distinguido de los tipos del
   motor, y al elegirlo el campo deja de pedir longitud y escala.
10. **Dado** un campo cuyo tipo es un enum, **entonces** la tarjeta de la tabla
    y el panel de campos muestran el nombre del enum como tipo.
11. **Dado** un enum de la barra lateral, **cuando** lo pulso, **entonces** se
    abre la hoja «Editar enum» con su nombre, su esquema y sus valores, y con la
    lista «Usado por» de los campos que lo usan.
12. **Dado** un modelo sin ningún esquema, **cuando** abro «Nuevo enum»,
    **entonces** la hoja dice que primero hace falta un esquema y ofrece
    crearlo, igual que «Nueva tabla».

---

### User Story 2 - Renombrar y eliminar enums en uso (Priority: P2)

Quien cambia un enum que ya usan varios campos no tiene que ir campo por campo:
al renombrarlo, todos los campos que lo usaban pasan al nombre nuevo. Al
eliminarlo, la confirmación dice qué campos lo usan y a qué tipo pasarán. El
menú contextual del enum ofrece Editar, Duplicar y Eliminar.

**Why this priority**: «renombrarlo» es el tercer paso de la demostración, y es
lo que hace seguro usar enums: sin esta propagación, un cambio de nombre deja
campos con un tipo que no existe. Necesita los enums de la historia 1.

**Independent Test**: se prueba sobre un enum usado por dos campos de tablas
distintas renombrándolo, deshaciendo, duplicándolo y eliminándolo, y
comprobando en cada paso el tipo de los dos campos.

**Acceptance Scenarios**:

1. **Dado** un enum usado por campos, **cuando** cambio su nombre y guardo,
   **entonces** esos campos pasan a tener el nombre nuevo como tipo, en el panel
   de campos y en las tarjetas del lienzo.
2. **Dado** el cambio de nombre, **entonces** un solo deshacer devuelve el
   nombre anterior al enum y a todos sus campos a la vez.
3. **Dado** un enum, **cuando** cambio, reordeno, añado o quito valores y
   guardo, **entonces** los campos que lo usan siguen usándolo sin cambios.
4. **Dado** un enum usado por campos, **cuando** pido eliminarlo, **entonces**
   la confirmación nombra cada campo como `tabla.campo` y dice el tipo al que
   pasarán.
5. **Dado** que confirmo, **entonces** el enum desaparece de la barra lateral y
   del selector de tipo, sus campos quedan con el tipo anunciado, y un solo
   deshacer devuelve el enum y los tipos.
6. **Dado** un enum que no usa ningún campo, **cuando** pido eliminarlo,
   **entonces** la confirmación lo dice y, al confirmar, solo desaparece el
   enum.
7. **Dado** un enum de la barra lateral, **cuando** abro su menú contextual
   —clic secundario o teclado—, **entonces** tengo «Editar enum…», «Duplicar
   enum» y «Eliminar enum…», con una cabecera que dice cuántos valores tiene y
   cuántos campos lo usan.
8. **Dado** «Duplicar enum», **entonces** aparece un enum nuevo en el mismo
   esquema, con los mismos valores y el nombre del original más `_copia` —
   numerado si ya existe—, que ningún campo usa todavía.
9. **Dado** la hoja «Editar enum», **cuando** pulso un campo de «Usado por»,
   **entonces** la hoja se cierra y el Editor selecciona esa tabla con el panel
   de campos abierto en ese campo.
10. **Dado** la hoja «Editar enum», **entonces** ofrece también «Eliminar enum»,
    que lleva a la misma confirmación.

---

### User Story 3 - Índices (Priority: P3)

Quien quiere consultas rápidas abre la pestaña «Índices» del editor inferior de
una tabla. Arriba ve los índices que ya crean las restricciones —la llave
primaria y los únicos—, que no se editan. Debajo crea los suyos: «Añadir índice»
deja una fila con un nombre propuesto —con el prefijo de Ajustes— y una columna
propuesta; ahí elige una o varias columnas y si el índice es único.

**Why this priority**: «crear un índice» es el cuarto paso de la demostración y
cierra el aviso «Sin índice» que el Incremento 4 dejó en las claves foráneas.
No depende de los enums.

**Independent Test**: se prueba sobre una tabla con llave primaria, un campo
único y dos claves foráneas sin índice: se comprueban los índices automáticos,
se crea un índice de una columna y otro de dos, se marca uno como único, y se
comprueba que las claves foráneas pasan de «Sin índice» a «Indexada».

**Acceptance Scenarios**:

1. **Dado** una tabla en el editor inferior, **cuando** abro la pestaña
   «Índices», **entonces** veo el bloque «Creados por restricciones» con la
   llave primaria y cada único de la tabla —nombre, columnas y clase— y sin
   ningún mando para cambiarlos.
2. **Dado** la pestaña, **cuando** pulso «Añadir índice», **entonces** aparece
   una fila con un nombre propuesto —prefijo de Ajustes, tabla y columna, por
   ejemplo `idx_pago_residente_id`— y una columna ya elegida: la primera clave
   foránea de la tabla que todavía no tiene índice, o el primer campo fuera de
   la llave primaria si no hay ninguna.
3. **Dado** la fila, **cuando** elijo varias columnas, **entonces** el índice
   las guarda en el orden en que las elegí y la fila las muestra en ese orden.
4. **Dado** la fila, **cuando** marco «Único», **entonces** el índice queda
   guardado como único.
5. **Dado** un índice cuyo nombre sigue siendo el propuesto, **cuando** cambio
   sus columnas, **entonces** el nombre se vuelve a proponer; si ya lo había
   escrito a mano, se conserva.
6. **Dado** un nombre vacío, con forma inválida o que ya usa otro índice o
   único del modelo, **entonces** la fila dice el motivo y el cambio no se
   guarda.
7. **Dado** un índice con una sola columna, **cuando** intento quitársela,
   **entonces** la fila dice que un índice necesita al menos una columna y la
   conserva.
8. **Dado** un índice, **cuando** lo elimino desde su fila, **entonces**
   desaparece y un solo deshacer lo devuelve.
9. **Dado** una tabla sin índices propios, **entonces** la pestaña lo dice y
   explica para qué sirve añadir uno, en lugar de mostrar una rejilla vacía.
10. **Dado** una clave foránea cuya columna es la primera de un índice recién
    creado, **entonces** su fila en «Claves foráneas» pasa de «Sin índice» a
    «Indexada».
11. **Dado** la ficha «Índices» del panel, **entonces** muestra cuántos índices
    propios tiene la tabla.
11a. **Dado** una clave foránea cuya columna no lleva UK, **cuando** creo sobre
    esa sola columna un índice y lo marco «Único», **entonces** la línea de la
    relación y el texto del inspector pasan a «uno a uno»; al quitar la marca o
    añadir otra columna al índice, vuelven a como estaban.
12. **Dado** Ajustes, **cuando** cambio «Prefijo de índices», **entonces** los
    índices que cree a partir de ahí proponen su nombre con ese prefijo y los
    que ya existían no cambian.

---

### User Story 4 - Únicos compuestos (Priority: P4)

Quien necesita impedir combinaciones repetidas —torre y número de unidad, por
ejemplo— abre la pestaña «Únicos». Arriba ve los únicos de un solo campo, que
vienen de la marca UK de la pestaña «Campos». Debajo crea los compuestos:
«Añadir único» deja una fila con un nombre propuesto y dos columnas, y ahí se
eligen las que formen la restricción.

**Why this priority**: cierra la demostración («un único compuesto») y completa
lo que el Incremento 3 dejó a medias, donde solo se podía marcar único un campo
suelto. Es la historia con menos dependencias: solo necesita tablas con campos.

**Independent Test**: se prueba sobre una tabla con cuatro campos, uno de ellos
marcado UK: se comprueba que aparece arriba como único de un campo, se crea un
único compuesto de dos columnas, se le añade una tercera, se intenta dejarlo en
una y se elimina.

**Acceptance Scenarios**:

1. **Dado** una tabla con un campo marcado UK, **cuando** abro la pestaña
   «Únicos», **entonces** ese campo aparece en el bloque «Desde la columna
   Llave (UK)» con su nombre de restricción y su columna, sin mandos para
   editarlo.
2. **Dado** la pestaña, **cuando** pulso «Añadir único», **entonces** aparece
   una fila en «Únicos compuestos» con un nombre propuesto —prefijo de Ajustes,
   tabla y columnas— y dos columnas ya elegidas.
3. **Dado** la fila, **cuando** añado o cambio columnas, **entonces** la
   restricción las guarda y, si el nombre seguía siendo el propuesto, se vuelve
   a proponer.
4. **Dado** un único compuesto con dos columnas, **cuando** intento quitar una,
   **entonces** la fila dice que un único compuesto necesita al menos dos y que
   el de un solo campo se marca con UK en «Campos», y conserva las dos.
5. **Dado** una tabla con un solo campo, **entonces** «Añadir único» no está
   disponible y dice por qué.
6. **Dado** un nombre vacío, con forma inválida o que ya usa otro índice o
   único del modelo, **entonces** la fila dice el motivo y el cambio no se
   guarda.
7. **Dado** un único compuesto, **cuando** lo elimino desde su fila,
   **entonces** desaparece y un solo deshacer lo devuelve.
8. **Dado** un único compuesto creado, **entonces** aparece también en
   «Creados por restricciones» de la pestaña «Índices».
9. **Dado** una tabla sin únicos compuestos, **entonces** el bloque lo dice con
   un ejemplo de cuándo usar uno.
10. **Dado** la ficha «Únicos» del panel, **entonces** muestra cuántos únicos
    tiene la tabla, contando los de un campo y los compuestos.
11. **Dado** que quito la marca UK de un campo en «Campos», **entonces** deja de
    aparecer en la pestaña «Únicos» y en los índices automáticos.

---

### Edge Cases

- **Modelo sin esquemas**: «Nuevo enum» dice que primero hace falta un esquema
  y ofrece crearlo; no crea un enum sin esquema (FR-004).
- **Nombre de enum igual a un tipo del motor**: `text`, `integer` o cualquier
  tipo del catálogo del motor del modelo no se admite como nombre de enum
  (FR-005).
- **Valor con comillas simples**: no se admiten dentro de un valor; se
  descartan al escribirlas (FR-007).
- **Valores que solo difieren en mayúsculas**: cuentan como repetidos (FR-007).
- **Quitar un valor que un campo usa como valor por defecto**: el enum se
  guarda; el valor por defecto del campo se conserva tal cual y no se valida
  contra los valores del enum en este incremento (FR-014).
- **Enum sin uso**: se elimina con una confirmación que lo dice (FR-017).
- **Eliminar el esquema de un enum en uso**: la confirmación de eliminar el
  esquema (Incremento 2) dice también qué campos de otras tablas usan sus enums
  y a qué tipo pasan, y los cambia en el mismo paso (FR-019).
- **Enums con cualquier motor**: un modelo de PostgreSQL, de MySQL o de SQLite
  admite enums por igual; el enum es un objeto del modelo, no del motor
  (FR-012).
- **Archivo con un campo cuyo tipo no es del motor ni un enum**: se conserva y
  se muestra tal cual, como ya hacía el Incremento 3; no se convierte ni se
  marca como enum.
- **Tabla sin llave primaria ni únicos**: «Creados por restricciones» no se
  muestra vacío; el bloque dice que la tabla no tiene ninguno (FR-021).
- **Índice con las mismas columnas que otro**: se permite y la fila avisa de
  que repite a otro índice o a una restricción, sin impedir guardarlo (FR-028).
- **Único compuesto con las mismas columnas que la llave primaria o que otro
  único**: igual, se avisa y se permite (FR-037).
- **Único de varios campos que viene del archivo**: se muestra como compuesto y
  se edita como los creados aquí (FR-032).
- **Índice del archivo sin la marca de único**: se lee como no único (FR-042).
- **Renombrar un campo indexado**: el índice y el único siguen apuntando al
  campo con su nombre nuevo, como ya ocurría (Incremento 3).
- **Eliminar un campo que está en un índice o en un único compuesto**: la
  confirmación los nombra; el índice no único pierde esa columna —y desaparece
  si era la única—, y el único compuesto y el índice marcado como único
  desaparecen enteros para no dejar una regla más estricta que la que se definió
  (FR-039).
- **Eliminar o duplicar una tabla**: sus índices y únicos se van o se copian con
  ella, con nombres que siguen siendo únicos en el modelo (FR-040).
- **Nombre propuesto ya usado o demasiado largo**: se recorta al largo máximo
  de un nombre técnico y lleva sufijo numérico hasta ser único (FR-024,
  FR-034).

## Requirements *(mandatory)*

### Functional Requirements

**Crear y editar enums**

- **FR-001**: El sistema MUST abrir la hoja «Nuevo enum» desde la acción «Nuevo
  enum» de la sección «Enums» de la barra lateral y desde «Definir un enum» de
  la tarjeta del modelo vacío, que deja de estar anunciada como futura.
- **FR-002**: La hoja MUST pedir el nombre y el esquema del enum y MUST mostrar
  sus valores uno por fila, numerados, con las acciones «Subir», «Bajar» y
  «Quitar» en cada fila y un campo «Nuevo valor» que añade con Enter o con
  «Añadir». La hoja MUST decir cuántos valores hay.
- **FR-003**: Todo enum MUST pertenecer a un esquema del modelo, elegido en la
  hoja (decidido en Clarifications). El esquema propuesto MUST ser el esquema
  enfocado si hay uno y, si no, el primero del modelo; «Editar enum» MUST
  permitir cambiarlo, y cambiarlo MUST NOT afectar a los campos que usan el
  enum.
- **FR-004**: Sin ningún esquema en el modelo, la hoja MUST decir que primero
  hace falta uno, MUST ofrecer crearlo y MUST NOT crear el enum.
- **FR-005**: El nombre MUST convertirse a nombre técnico (RS-03) y la hoja MUST
  decir cómo se guardará cuando difiera de lo escrito. Un nombre vacío, uno que
  ya use otro enum del modelo o uno igual a un tipo del catálogo del motor del
  modelo MUST mostrarse como error y MUST impedir guardar.
- **FR-006**: Un enum MUST tener al menos un valor; intentar guardar sin
  ninguno MUST decirlo y MUST NOT cambiar el modelo.
- **FR-007**: Un valor vacío o repetido —comparando sin distinguir mayúsculas
  ni espacios de los extremos— MUST marcarse en su fila, MUST explicarse en la
  hoja y MUST impedir guardar. Las comillas simples MUST NOT quedar dentro de
  un valor, y un valor MUST NOT superar el largo máximo de un nombre técnico.
- **FR-008**: El orden de los valores MUST conservarse tal como lo dejó el
  usuario, en el modelo y en el archivo.
- **FR-009**: Cancelar o cerrar la hoja MUST NOT cambiar el modelo.
- **FR-010**: La barra lateral MUST mostrar la sección «Enums» con cada enum y
  su número de valores; con un esquema enfocado MUST listar solo los de ese
  esquema, como hace la sección «Tablas». Pulsar un enum MUST abrir «Editar
  enum».
- **FR-011**: El selector de tipo de un campo MUST ofrecer todos los enums del
  modelo además de los tipos del motor, distinguidos como enum. Un campo cuyo
  tipo es un enum MUST NOT pedir ni guardar longitud ni escala, y MUST mostrar
  el nombre del enum como tipo en el panel de campos y en la tarjeta del lienzo.
- **FR-012**: Los enums MUST poder crearse, usarse como tipo y eliminarse en un
  modelo de cualquiera de los tres motores, con el mismo comportamiento salvo el
  tipo de reemplazo de FR-018.
- **FR-013**: La hoja «Editar enum» MUST mostrar «Usado por» con los campos que
  usan el enum como `tabla.campo`, o decir que ninguno lo usa; pulsar uno MUST
  cerrar la hoja y llevar a ese campo en el panel de campos de su tabla.
- **FR-014**: Cambiar, reordenar, añadir o quitar valores de un enum en uso MUST
  NOT cambiar los campos que lo usan, ni su tipo ni su valor por defecto.

**Renombrar y eliminar enums en uso**

- **FR-015**: Guardar un enum con otro nombre MUST cambiar el tipo de todos los
  campos que lo usaban al nombre nuevo, en el mismo paso de historial que el
  cambio del enum.
- **FR-016**: Eliminar un enum MUST pedir confirmación. La confirmación MUST
  nombrar cada campo que lo usa como `tabla.campo` y MUST decir el tipo al que
  pasarán (RS-08).
- **FR-017**: Un enum que ningún campo usa MUST poder eliminarse con una
  confirmación que diga que no está en uso.
- **FR-018**: Al confirmar, el sistema MUST quitar el enum y MUST cambiar los
  campos que lo usaban al tipo de texto de reemplazo —texto de longitud
  variable de 40 caracteres, o el tipo de texto del motor cuando este no lo
  ofrezca—, todo en un solo paso deshacible. La confirmación MUST NOT ofrecer
  elegir otro tipo (decidido en Clarifications).
- **FR-019**: Eliminar un esquema junto con sus enums (Incremento 2) MUST
  aplicar la misma regla a los campos de otras tablas que usaban esos enums, y
  su confirmación MUST decirlo.
- **FR-020**: El menú contextual de un enum de la barra lateral MUST ofrecer
  «Editar enum…», «Duplicar enum» y «Eliminar enum…», MUST abrirse con el
  puntero y con el teclado, y MUST decir cuántos valores tiene el enum y cuántos
  campos lo usan. «Duplicar enum» MUST crear en el mismo esquema un enum con los
  mismos valores y el nombre del original más `_copia`, numerado hasta ser
  único. «Editar enum» MUST ofrecer también «Eliminar enum».

**Índices**

- **FR-021**: La pestaña «Índices» del panel inferior MUST mostrar, en un bloque
  «Creados por restricciones», el índice de la llave primaria de la tabla y el
  de cada único —de un campo o compuesto— con su nombre, sus columnas y su clase
  (PRIMARY KEY o UNIQUE). Esos índices MUST NOT poder editarse ni eliminarse
  desde ahí, y una tabla sin ninguno MUST decirlo.
- **FR-022**: La pestaña MUST listar los índices propios de la tabla, con su
  nombre, sus columnas, si es único y la acción de eliminar. MUST NOT ofrecer
  ni guardar el método del índice (decidido en Clarifications).
- **FR-023**: «Añadir índice» MUST crear un índice completo y válido: con una
  columna propuesta —la primera clave foránea de la tabla que no sea la primera
  columna de ningún índice ni restricción, o el primer campo fuera de la llave
  primaria— y con un nombre propuesto.
- **FR-024**: El nombre propuesto MUST formarse con el prefijo de índices de
  Ajustes, el nombre de la tabla y sus columnas, MUST recortarse al largo máximo
  de un nombre técnico y MUST llevar sufijo numérico si ya existe.
- **FR-025**: El usuario MUST poder elegir una o varias columnas de la tabla; el
  índice MUST conservar el orden en que se eligieron. Un índice MUST tener
  siempre al menos una columna.
- **FR-026**: Mientras el nombre del índice sea el propuesto, cambiar sus
  columnas MUST volver a proponerlo; un nombre escrito a mano MUST conservarse.
- **FR-027**: El nombre de un índice MUST ser un nombre técnico (RS-03) y MUST
  ser único entre los índices y únicos del modelo; un nombre inválido o repetido
  MUST mostrarse como error en la fila y MUST NOT guardarse.
- **FR-028**: Un índice con las mismas columnas en el mismo orden que otro
  índice o que una restricción de la tabla MUST avisarlo en la fila y MUST
  poder guardarse.
- **FR-029**: Cada índice MUST poder marcarse como único, y la marca MUST
  guardarse con el índice.
- **FR-029a**: Un índice único de una sola columna MUST contar como unicidad de
  esa columna al deducir la cardinalidad de una relación, igual que la marca UK:
  la línea del lienzo y el texto del inspector MUST leer «uno a uno» y MUST
  seguir coincidiendo entre sí. Un índice único o un único compuesto de varias
  columnas MUST NOT cambiar la cardinalidad, y el índice único MUST NOT añadir
  la marca UK al campo (decidido en Clarifications).
- **FR-030**: Una tabla sin índices propios MUST verlo dicho en la pestaña, con
  la explicación de para qué sirve añadir uno. La ficha «Índices» MUST mostrar
  cuántos índices propios tiene la tabla.
- **FR-031**: El estado «Indexada» / «Sin índice» de cada clave foránea
  (Incremento 4) MUST seguir en todo momento a los índices de esta pestaña: una
  clave foránea MUST contar como indexada cuando su columna es la primera de un
  índice propio, de la llave primaria o de un único.

**Únicos compuestos**

- **FR-032**: La pestaña «Únicos» del panel inferior MUST mostrar, en un bloque
  «Desde la columna Llave (UK)», los únicos de un solo campo con su nombre y su
  columna, sin poder editarlos ahí; y, en «Únicos compuestos», los de dos o más
  campos, tanto los creados aquí como los que traiga el archivo.
- **FR-033**: «Añadir único» MUST crear una restricción completa y válida, con
  un nombre propuesto y dos columnas propuestas. En una tabla con menos de dos
  campos MUST NOT estar disponible y MUST decir por qué.
- **FR-034**: El nombre propuesto MUST formarse con el prefijo de únicos de
  Ajustes, el nombre de la tabla y sus columnas, con las mismas reglas de
  recorte, sufijo y repropuesta que el de los índices (FR-024, FR-026).
- **FR-035**: Un único compuesto MUST tener siempre dos o más columnas;
  intentar dejarlo en una MUST decir que el único de un solo campo se marca con
  UK en «Campos» y MUST conservar la restricción como estaba.
- **FR-036**: El nombre de un único MUST cumplir las mismas reglas que el de un
  índice (FR-027).
- **FR-037**: Un único compuesto con las mismas columnas que la llave primaria
  o que otro único MUST avisarlo y MUST poder guardarse.
- **FR-038**: Marcar o quitar UK en «Campos» MUST reflejarse al momento en la
  pestaña «Únicos» y en «Creados por restricciones». La ficha «Únicos» MUST
  mostrar cuántos únicos tiene la tabla, contando los de un campo y los
  compuestos, y una tabla sin únicos compuestos MUST verlo dicho con un ejemplo.
- **FR-038a**: El único que crea la marca UK MUST nombrarse con las mismas
  reglas que un único compuesto: prefijo de únicos de Ajustes, tabla y campo,
  recortado y con sufijo numérico hasta ser único entre los índices y únicos del
  modelo (FR-034, FR-036). Los únicos de un campo que ya existan MUST conservar
  su nombre.

**Transversales**

- **FR-039**: Eliminar un campo MUST nombrar en su confirmación los índices y
  únicos compuestos que lo usan. Al confirmar, cada índice no único MUST perder
  esa columna —y eliminarse si era la única—, y cada único compuesto que la use
  MUST eliminarse entero, para no dejar en el modelo una regla más estricta que
  la definida (decidido en Clarifications). Un índice marcado como único es
  también una regla sobre los datos, así que MUST eliminarse entero por el mismo
  motivo. Todo MUST ocurrir en el mismo paso deshacible que el campo (RS-08).
- **FR-040**: Renombrar un campo o una tabla MUST mantener sus índices y únicos
  apuntando a los nombres nuevos; eliminar una tabla MUST llevarse los suyos y
  duplicarla MUST copiarlos con nombres únicos en el modelo.
- **FR-041**: Crear, editar, renombrar, duplicar y eliminar un enum, y crear,
  cambiar y eliminar un índice o un único, MUST marcar el modelo «Editado» y
  MUST deshacerse y rehacerse en un solo paso con etiqueta propia (RS-06).
- **FR-042**: El sistema MUST leer y escribir los enums, los índices y los
  únicos en el archivo del modelo, en las secciones que el formato ya declara.
  La marca de índice único MUST añadirse como dato opcional del índice, ausente
  por defecto, de modo que cualquier archivo escrito antes siga siendo válido;
  la versión del formato MUST NOT subir.
- **FR-043**: Ajustes MUST ofrecer «Prefijo de índices» y «Prefijo de únicos»,
  con `idx_` y `uq_` como valores iniciales y un ejemplo del nombre resultante.
  Las preferencias MUST guardarlos con su valor por defecto cuando falten, sin
  subir la versión de las preferencias, y cambiarlos MUST afectar solo a los
  nombres que se propongan después.
- **FR-044**: Todas las acciones del incremento —abrir y completar la hoja del
  enum, reordenar y quitar valores, abrir el menú contextual, y añadir, cambiar
  y eliminar índices y únicos— MUST poder hacerse solo con el teclado, con foco
  visible, y las rejillas de las dos pestañas MUST recorrerse como la de campos.
- **FR-045**: Toda la pantalla nueva MUST construirse con los componentes y los
  tokens de «Aura», MUST funcionar en tema claro y oscuro y MUST mantener el
  contraste de la constitución.
- **FR-046**: Enums, índices y únicos MUST vivir en el almacén único del modelo,
  y la barra lateral, el panel inferior, el inspector y el lienzo MUST mostrar
  siempre el mismo estado.

### Key Entities *(include if feature involves data)*

- **Enum**: lista cerrada y ordenada de valores con nombre técnico único entre
  los enums del modelo. Pertenece a un esquema y puede llevar una descripción.
  Ya existe en el formato del archivo; este incremento es el primero que lo
  crea, lo edita y lo usa como tipo.
- **Campo de tipo enum**: un campo cuyo tipo es el nombre de un enum del
  modelo. No lleva longitud ni escala. El vínculo es el nombre: por eso
  renombrar el enum cambia el tipo de sus campos.
- **Índice**: nombre técnico, lista ordenada de una o más columnas de su tabla y
  si es único. Vive dentro de su tabla.
- **Único**: restricción con nombre técnico y una o más columnas de su tabla.
  Con una columna es la marca UK del Incremento 3; con dos o más es un único
  compuesto.
- **Índice automático**: el que acompaña a la llave primaria y a cada único. No
  es un dato nuevo: se deduce de las restricciones de la tabla y solo se
  muestra.
- **Preferencias de nombres**: prefijo de índices y prefijo de únicos. Viven en
  las preferencias de la aplicación, no en el modelo.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Crear un enum, usarlo en dos campos, renombrarlo y crear un índice
  y un único compuesto se completa sin ayuda externa en menos de 5 minutos.
- **SC-002**: Crear un enum de cuatro valores se completa en menos de 30
  segundos y sin usar el puntero.
- **SC-003**: En 100 % de los casos probados, renombrar un enum deja todos los
  campos que lo usaban con el nombre nuevo y ninguno con un tipo que ya no
  existe.
- **SC-004**: En 100 % de los casos probados, la confirmación de eliminar un
  enum nombra exactamente los campos que lo usan, y tras confirmar ningún campo
  conserva como tipo el enum eliminado.
- **SC-005**: Crear un índice sobre una clave foránea sin índice cuesta dos
  pasos —abrir la pestaña y «Añadir índice»— y deja la clave foránea como
  «Indexada».
- **SC-006**: En 100 % de los casos probados, crear, editar, renombrar, duplicar
  y eliminar un enum, y crear, cambiar y eliminar un índice o un único, se
  deshacen en un solo paso y devuelven el modelo exactamente al estado anterior.
- **SC-007**: En 100 % de los casos probados, guardar y reabrir el modelo
  conserva los enums con el orden de sus valores, los índices con el orden de
  sus columnas y su marca de único, y los únicos compuestos; y un archivo
  escrito por una versión anterior se abre y se guarda sin perder nada.
- **SC-008**: 100 % de las acciones del incremento se completan solo con el
  teclado, con foco visible en cada paso.
- **SC-009**: Los nueve estados del incremento (modelo sin esquemas, nombre de
  enum repetido, enum sin valores, valor vacío, valor repetido, tabla sin
  índices propios, tabla sin únicos compuestos, único compuesto que se quedaría
  con una columna, y nombre de índice o único repetido) muestran un mensaje
  visible y al menos una salida clara.
- **SC-010**: La hoja del enum, la sección «Enums» y las pestañas «Índices» y
  «Únicos» se revisan en tema claro y en tema oscuro sin texto de contenido por
  debajo de 4.5:1 de contraste.
- **SC-011**: Con un modelo de 50 tablas en el que un enum lo usan 100 campos,
  renombrar el enum se refleja en la pantalla en menos de 200 milisegundos.
- **SC-012**: En 100 % de los casos probados, lo que dice la pestaña «Claves
  foráneas» sobre el índice de una columna coincide con los índices que muestra
  la pestaña «Índices» de esa tabla.
- **SC-013**: En 100 % de los casos probados, la cardinalidad que dibuja la
  línea de una relación coincide con el texto del inspector, también cuando la
  unicidad de la columna viene de un índice único y no de la marca UK.

## Assumptions

- **Diseño visual**: la hoja del enum, su confirmación de eliminar, la sección
  «Enums» de la barra lateral con su menú contextual, las pestañas «Índices» y
  «Únicos» del panel inferior y los dos prefijos de Ajustes siguen el lienzo
  «SQL Designer · Diseño de Pantallas» —tablero `Editor`, componentes
  `EnumForm`, `ContextMenu`, `ConfirmDialog`, `TableEditorPanel` en sus
  variantes `indices` y `unicos`, y `PreferencesWindow`—, y los componentes y
  tokens vienen del sistema de diseño «Aura». El lienzo es referencia de diseño,
  no base de código (constitución, puerta 6).
- **El enum pertenece a un esquema** (decidido en Clarifications): el formato
  del archivo exige un esquema para cada enum y el tablero de diseño no lo pide.
  Se añade un selector de esquema a la hoja, con el esquema enfocado o el
  primero como propuesta, y sin esquemas no se puede crear un enum, igual que
  una tabla. Es un desvío deliberado del tablero; la alternativa —enums del
  modelo, sin esquema— obligaba a cambiar el formato.
- **Sin método de índice** (decidido en Clarifications): el tablero
  dibuja una columna «Método» con btree, hash, gin y gist. El enunciado no la
  pide, son métodos de PostgreSQL y el modelo admite tres motores, y el formato
  no la guarda. Este incremento no la incluye: el índice usa el método por
  defecto del motor. Es un desvío deliberado del tablero.
- **Tipo de reemplazo al eliminar un enum** (decidido en Clarifications): el
  del tablero, texto de longitud variable de 40 caracteres; con un motor que no
  lo ofrezca, su tipo de texto. No se pregunta en cada eliminación, y cambiarlo
  después se hace campo por campo en «Campos».
- **Enums en los tres motores**: el enum es un objeto del modelo. Cómo se
  traduce a cada motor —tipo propio, lista en la columna o restricción— es
  trabajo del incremento de exportación.
- **Los enums de cualquier esquema se ofrecen como tipo**: un campo puede usar
  un enum de otro esquema; el selector no filtra por el esquema de la tabla.
- **Valores sin validar contra los campos**: quitar o cambiar un valor no revisa
  los valores por defecto de los campos que usan el enum. Avisar de un valor por
  defecto que ya no existe queda para el incremento de validación o para el de
  exportación.
- **Sin descripción del enum en la hoja**: el formato admite una descripción y
  el tablero no la pide; una que venga del archivo se conserva al guardar.
- **Sin vista previa de SQL**: el tablero muestra en la hoja la sentencia que
  crearía el enum. No entra aquí: el SQL sale del generador único de la
  constitución (principio II), que llega con el incremento de exportación, igual
  que la sección «SQL» del panel.
- **Marca de único en el índice**: es lo único que este incremento añade al
  archivo, como dato opcional y sin subir la versión, igual que se hizo con
  SET DEFAULT en el Incremento 4 (FR-042).
- **Nombres únicos en el modelo**: los nombres de índices y únicos no se repiten
  en todo el modelo, la regla más estricta de los tres motores; así el modelo no
  depende del motor elegido.
- **Único de un campo e índice automático**: la marca UK del Incremento 3 ya se
  guarda como un único de un campo; este incremento la muestra en las dos
  pestañas y hace que su nombre siga el prefijo de únicos y no se repita en el
  modelo (FR-038a). Con el prefijo inicial el nombre es el mismo de siempre. Se
  sigue poniendo y quitando en «Campos».
- **Sin marca nueva en el lienzo**: los campos de un único compuesto o de un
  índice no llevan marca en la tarjeta; las marcas siguen siendo PK, FK, PF y
  UK. Índices y únicos compuestos se ven en sus pestañas.
- **Cardinalidad con índice único** (decidido en Clarifications): la regla que
  deduce «uno a uno» (Incrementos 3 y 4) cuenta, además de la marca UK, un
  índice único de una sola columna, para que el diagrama diga lo que la base de
  datos hará. Los de varias columnas no la alteran: no tienen una lectura clara
  como cardinalidad de una relación de una columna (FR-029a).
- **Crear el índice desde la clave foránea**: el aviso «Sin índice» no gana un
  botón propio; el camino es la pestaña «Índices», cuya propuesta ya apunta a la
  primera clave foránea sin índice (FR-023).
- **Sin paleta de comandos**: el tablero ofrece «Nuevo enum…» en la paleta y
  lista en ella los enums del modelo. La paleta todavía no existe en la
  aplicación; esas dos entradas llegan con el incremento que la traiga, y este
  deja hechas las acciones que llamará.
- **Sin diccionario ni exportación**: el tablero lista los enums en la vista de
  diccionario y los usa al exportar. Las dos cosas son de sus incrementos.
- **Preferencias nuevas sin subir versión**: los dos prefijos se añaden con
  valor por defecto cuando faltan, como el patrón de claves foráneas del
  Incremento 4 (FR-043).
- **Sin red ni servicios**: todo ocurre sobre el modelo en memoria y su archivo
  local (constitución, principio I).
- **Rendimiento medido en desarrollo**: la cifra de SC-011 se mide sobre la
  compilación de depuración, como en los incrementos anteriores, con el Modo de
  bajo consumo del sistema apagado.

## Dependencies

- **Incremento 4 (`specs/005-relaciones`)**: la pestaña «Claves foráneas» con su
  estado «Indexada» / «Sin índice», que este incremento alimenta, las claves
  foráneas que «Añadir índice» propone, y la regla única de cardinalidad que
  leen la línea del lienzo y el inspector, que aquí aprende del índice único.
- **Incremento 3 (`specs/004-tablas-campos`)**: las tablas con sus campos, el
  selector de tipo y el catálogo de tipos de cada motor, la marca UK, el panel
  inferior con sus fichas y su rejilla, el menú de la tabla, y las
  confirmaciones de eliminar campo y eliminar tabla.
- **Incremento 2 (`specs/003-lienzo-esquemas`)**: los esquemas, el foco de
  esquema, la barra lateral con sus secciones, y la confirmación de eliminar un
  esquema con sus tablas, enums y vistas.
- **Incremento 1 (`specs/002-archivos-modelo`)**: abrir y guardar el modelo, el
  estado del archivo, el historial de deshacer, el almacén único y el formato
  `.yaml` versión 1, que ya declara `enums[]` y, en cada tabla, `uniques` e
  `indexes`.
- **Incremento 0 (`specs/001-base-aplicacion`)**: ventana propia, temas claro y
  oscuro, preferencias y atajos.
- **Incrementos siguientes**: «Exportar» hereda los enums, los índices y los
  únicos para el SQL, y trae la vista previa de la hoja del enum y la sección
  «SQL» del panel; «Vistas» completa la barra lateral.
