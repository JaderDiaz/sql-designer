# Feature Specification: Relaciones (Incremento 4)

**Feature Branch**: `005-relaciones`

**Created**: 2026-10-28

**Status**: Draft

**Input**: User description: "Incremento 4 · Relaciones. Objetivo: relacionar tablas con claves foráneas y verlas claramente en el diagrama. Depende de: Incremento 3. Se demuestra: relacionar cuatro tablas, resaltar una y cambiar sus reglas de eliminación. SF-4.1 Crear una clave foránea; SF-4.2 Ver las relaciones; SF-4.3 Resaltar relaciones; SF-4.4 Reglas al eliminar y actualizar; SF-4.5 Eliminar una relación. El diseño de pantallas es «SQL Designer · Diseño de Pantallas» y los componentes vienen de «Aura»."

## Clarifications

### Session 2026-10-28

- Q: ¿Una clave foránea de este incremento puede usar varias columnas, o solo
  una contra la llave primaria de la tabla destino? → A: Solo una columna: una
  tabla con llave primaria compuesta no se ofrece como destino y la lista dice
  por qué, y una relación de varias columnas que venga del archivo se dibuja y
  se conserva sin poder editarse aquí
- Q: ¿Se puede crear una clave foránea que apunte a la misma tabla, por ejemplo
  `empleado.jefe_id → empleado.id` para una jerarquía? → A: Sí: la tabla
  editada aparece como destino y el lienzo dibuja el bucle que sale y vuelve a
  la misma tarjeta, con sus marcas de cardinalidad
- Q: ¿Hace falta poder crear la clave foránea tirando una línea de un campo a
  otro en el lienzo, además de hacerlo desde la pestaña? → A: No: solo las tres
  vías del enunciado («Relación», la tecla R y «Nueva clave foránea»); el gesto
  de arrastrar llega con su propio incremento si se quiere
- Q: ¿La columna que propone «Añadir clave foránea» debe llegar marcada «no
  nulo», o nulable para que la relación admita filas sin padre? → A: «No nulo»,
  como el tablero: la relación nace obligatoria, elegir SET NULL avisa y ofrece
  quitar el «no nulo» (FR-030), y quitarlo a mano se hace en «Campos»
- Q: ¿La marca del extremo de la línea debe reflejar si la relación es opcional
  o uno a uno, o siempre dibuja uno a muchos? → A: Sigue lo deducido: el extremo
  de «muchos» añade el círculo del cero cuando la columna admite nulos y pasa a
  «uno» cuando la columna es única, con la misma regla que el inspector del
  Incremento 3 ya usa para su texto

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Crear una clave foránea (Priority: P1)

Quien modela conecta dos tablas desde la tabla que llevará la clave: con
«Relación» en la barra superior, con la tecla R o con «Nueva clave foránea…»
del menú de la tabla se abre la pestaña «Claves foráneas» del editor inferior.
«Añadir clave foránea» deja una fila lista: propone la columna con el patrón de
nombre de Ajustes —por ejemplo `unidad_id`— con el tipo de la llave primaria
referenciada, y la tabla destino se elige en la misma fila. En cuanto la fila
está completa el campo queda marcado FK y la línea aparece en el diagrama.

**Why this priority**: sin claves foráneas el incremento no existe y el
diagrama del Incremento 3 sigue siendo tablas sueltas. Es el primer paso de la
demostración y de lo que dependen todas las demás historias.

**Independent Test**: se prueba sobre un modelo de cuatro tablas con llave
primaria creando sus relaciones por las tres vías de entrada, comprobando el
nombre y el tipo propuestos para la columna, la marca FK en el panel y en el
lienzo, y el aviso cuando no hay tabla seleccionada.

**Acceptance Scenarios**:

1. **Dado** una tabla seleccionada, **cuando** pulso «Relación» en la barra
   superior, la tecla R o «Nueva clave foránea…» en su menú, **entonces** el
   panel inferior se abre en «Claves foráneas» con esa tabla como la que
   llevará la clave.
2. **Dado** la pestaña abierta, **cuando** pulso «Añadir clave foránea»,
   **entonces** aparece una fila nueva con la columna propuesta —nombre según
   el patrón de Ajustes (`{tabla}_{pk}`, por ejemplo `unidad_id`), tipo y
   longitud de la llave primaria referenciada y «no nulo»— y con una tabla
   destino propuesta.
3. **Dado** la fila, **cuando** elijo otra tabla destino, **entonces** la
   referencia pasa a su llave primaria y, si la columna todavía tenía el nombre
   propuesto, se renombra y retipa según la tabla nueva.
4. **Dado** la fila completa, **entonces** el campo queda marcado FK en el panel
   de campos y en la tabla del lienzo, y la línea de la relación aparece en el
   diagrama.
5. **Dado** la fila, **cuando** elijo una columna que ya existe en la tabla en
   lugar de la propuesta, **entonces** esa columna queda marcada FK y la
   anterior deja de estarlo si ninguna otra relación la usa.
6. **Dado** que no hay ninguna tabla seleccionada, **cuando** pulso «Relación» o
   la tecla R, **entonces** la aplicación pide seleccionar la tabla que tendrá
   la clave y no crea nada.
7. **Dado** la lista de tablas destino, **entonces** veo las tablas del modelo
   con la abreviatura y el color de su esquema, incluida la tabla que estoy
   editando, para poder relacionarla consigo misma.
7a. **Dado** la tabla que estoy editando elegida como destino, **cuando** dejo
   la columna propuesta, **entonces** la relación apunta a su propia llave
   primaria y la columna no puede ser ese mismo campo.
8. **Dado** una tabla destino sin llave primaria o con llave primaria de varias
   columnas, **entonces** no se puede elegir y la lista dice por qué.
9. **Dado** una relación creada, **entonces** el modelo queda «Editado» y puedo
   deshacerla en un solo paso con ⌘Z / Ctrl+Z (RS-06).

---

### User Story 2 - Ver las relaciones (Priority: P2)

Quien lee el diagrama ve cada relación como una línea que une el campo de
origen con el campo de destino, con la cardinalidad en sus extremos y con el
color del esquema de la tabla que tiene la llave primaria. Cuando varias líneas
bajan por el mismo hueco se reparten en carriles para no pisarse, y ninguna
atraviesa una tabla. En Ajustes se elige el trazado: ortogonal, curvo o recto.

**Why this priority**: «verlas claramente en el diagrama» es la mitad del
objetivo del incremento; sin la línea, crear la clave foránea solo se nota en el
panel. Necesita las relaciones de la historia 1.

**Independent Test**: se prueba con un modelo de cuatro tablas y cinco
relaciones —dos de ellas compartiendo hueco— comprobando los extremos, el
color, el reparto en carriles y los tres trazados de Ajustes.

**Acceptance Scenarios**:

1. **Dado** una relación, **entonces** su línea sale de la fila del campo de la
   clave foránea y llega a la fila del campo de la llave primaria, pegada al
   borde de cada tarjeta.
2. **Dado** una relación cuya columna es «no nulo» y no es única, **entonces**
   su extremo del lado de la llave primaria muestra la marca de «uno» y el del
   lado de la clave foránea la de «muchos».
2a. **Dado** una relación cuya columna admite nulos, **entonces** el extremo de
   «muchos» añade la marca del cero; **dado** una columna única, **entonces** ese
   extremo pasa a «uno». En los dos casos la línea dice lo mismo que el texto
   de cardinalidad del inspector.
3. **Dado** la línea, **entonces** su color es el del esquema de la tabla con la
   llave primaria (RS-05).
4. **Dado** varias líneas que bajan por el mismo hueco entre tablas,
   **entonces** se reparten en carriles separados y ninguna atraviesa una
   tarjeta de tabla.
4a. **Dado** una relación de una tabla hacia sí misma, **entonces** su línea
   sale y vuelve a la misma tarjeta como un bucle, con la marca de «uno» y la
   de «muchos» en sus extremos y sin atravesar la tarjeta.
5. **Dado** Ajustes, **cuando** cambio «Trazado de relaciones» entre Ortogonal,
   Curvas y Rectas, **entonces** todas las líneas cambian en menos de 100
   milisegundos, sin cerrar la ventana de Ajustes, y la elección se conserva al
   reabrir la aplicación.
6. **Dado** que muevo una tabla, hago zoom o desplazo el lienzo, **entonces**
   las líneas siguen pegadas a sus campos.
7. **Dado** una relación del archivo con varias columnas, **entonces** se
   dibuja anclada a su primer campo y se conserva tal cual, aunque sus columnas
   no se puedan cambiar en esta pestaña.
8. **Dado** el lienzo, **cuando** pulso sobre una línea, **entonces** el clic
   llega a lo que haya debajo: las líneas no capturan el puntero.

---

### User Story 3 - Resaltar relaciones (Priority: P3)

Quien busca con qué se conecta una tabla pasa el cursor por encima o la
selecciona: la tabla, sus relaciones y sus tablas relacionadas se resaltan y
todo lo demás se atenúa. Los campos que forman cada relación resaltada se
marcan en las dos tablas. Con la animación activa, las líneas resaltadas
muestran el sentido del flujo y la cardinalidad 1 / N junto a sus extremos.

**Why this priority**: es el segundo paso de la demostración («resaltar una») y
lo que hace legible un diagrama con muchas líneas. Necesita las líneas de la
historia 2.

**Independent Test**: se prueba con un modelo de cuatro tablas y cinco
relaciones pasando el cursor por cada tabla, seleccionándola, llegando a ella
con el teclado y repitiendo con las tres opciones de animación y con «Reducir
movimiento» del sistema activo.

**Acceptance Scenarios**:

1. **Dado** el diagrama, **cuando** paso el cursor por una tabla o la
   selecciono, **entonces** se resaltan ella, sus relaciones y las tablas al
   otro lado de esas relaciones, y las demás tablas, zonas y líneas se atenúan.
2. **Dado** una relación resaltada, **entonces** los campos que la forman se
   marcan en la tabla de origen y en la de destino.
3. **Dado** la tabla activa, **entonces** se distingue de las relacionadas: la
   activa lleva el anillo completo y las relacionadas uno más tenue.
4. **Dado** que llego a una tabla con el teclado, **entonces** se resalta igual
   que con el cursor.
5. **Dado** Ajustes con «Animación de relaciones» en Sutil o Viva, **entonces**
   las relaciones resaltadas muestran el sentido del flujo y su cardinalidad
   —1 / N, 1 / 0..N o 1 / 1— junto a cada extremo; en Viva el flujo es más
   marcado.
6. **Dado** Ajustes con la animación Apagada, **entonces** las relaciones
   resaltadas se ven resaltadas pero sin flujo.
7. **Dado** «Reducir movimiento» del sistema, **entonces** ninguna línea se
   anima, cualquiera que sea el ajuste, y el resaltado se nota igual (RS-11).
8. **Dado** que quito el cursor y la selección, **entonces** todo vuelve a su
   aspecto normal.
9. **Dado** un esquema enfocado (Incremento 2), **entonces** sus tablas se
   resaltan con estas mismas reglas.

---

### User Story 4 - Reglas al eliminar y actualizar (Priority: P4)

Quien define qué pasa con los datos relacionados elige ON DELETE y ON UPDATE de
cada clave foránea en su fila, entre NO ACTION, RESTRICT, CASCADE, SET NULL y
SET DEFAULT. La misma pestaña dice qué tablas referencian a esta en
«Referenciada por», y avisa si la columna de la clave foránea no está indexada.

**Why this priority**: «cambiar sus reglas de eliminación» cierra la
demostración, y las reglas son lo que el SQL necesitará más adelante. Necesita
las claves foráneas de la historia 1.

**Independent Test**: se prueba sobre una tabla con dos claves foráneas
cambiando las diez combinaciones de reglas, guardando y reabriendo el modelo, y
sobre la tabla referenciada comprobando «Referenciada por».

**Acceptance Scenarios**:

1. **Dado** una clave foránea, **entonces** su fila ofrece ON DELETE y ON UPDATE
   con NO ACTION, RESTRICT, CASCADE, SET NULL y SET DEFAULT, y las dos empiezan
   en NO ACTION.
2. **Dado** que cambio una regla, **entonces** el modelo queda «Editado», el
   cambio se deshace en un solo paso y al guardar y reabrir la regla sigue
   puesta.
3. **Dado** que elijo SET NULL sobre una columna «no nulo», **entonces** la fila
   avisa de que la regla no podrá aplicarse y ofrece quitar el «no nulo».
4. **Dado** la pestaña de una tabla referenciada por otras, **entonces**
   «Referenciada por» lista cada tabla con la abreviatura y el color de su
   esquema y el nombre `tabla.columna`.
5. **Dado** «Referenciada por», **cuando** pulso una de esas tablas,
   **entonces** el lienzo la selecciona y la muestra.
6. **Dado** una tabla sin claves foráneas, **entonces** la pestaña lo dice y
   explica qué hace «Añadir clave foránea», en lugar de mostrar una rejilla
   vacía.
7. **Dado** una clave foránea cuya columna está en un índice del modelo,
   **entonces** la fila la muestra como «Indexada»; si no lo está, la muestra
   como «Sin índice».
8. **Dado** la ficha «Claves foráneas» del panel, **entonces** muestra cuántas
   tiene la tabla, como hace «Campos».

---

### User Story 5 - Eliminar una relación (Priority: P5)

Quien quita una relación que ya no aplica la elimina desde su fila: la línea
desaparece del diagrama y el campo se queda en la tabla, pero deja de estar
marcado como FK. Todo se deshace en un solo paso.

**Why this priority**: completa el ciclo de vida de la relación; el incremento
se demuestra sin ella, pero sin eliminar no se puede corregir un error.

**Independent Test**: se prueba sobre una tabla con dos claves foráneas
eliminando una, comprobando el campo que queda, la línea que desaparece y el
deshacer; y sobre una columna usada por dos relaciones, eliminando solo una.

**Acceptance Scenarios**:

1. **Dado** una clave foránea, **cuando** la elimino desde su fila,
   **entonces** su línea desaparece del diagrama y su fila de la pestaña.
2. **Dado** la clave foránea eliminada, **entonces** la columna se conserva con
   su nombre, su tipo y sus demás propiedades, y deja de estar marcada FK.
3. **Dado** una columna que usan dos relaciones, **cuando** elimino una,
   **entonces** la columna sigue marcada FK por la otra.
4. **Dado** una relación eliminada, **entonces** el modelo queda «Editado» y
   deshacer la devuelve con sus reglas ON DELETE y ON UPDATE (RS-06).
5. **Dado** que elimino el campo o la tabla de una relación (Incremento 3),
   **entonces** la confirmación nombra las relaciones que se van y al confirmar
   se van con el campo o la tabla en un solo paso deshacible (RS-08).

---

### Edge Cases

- **Sin tabla seleccionada**: «Relación» y la tecla R piden seleccionar la tabla
  que tendrá la clave y no crean nada (FR-002).
- **Tabla destino sin llave primaria**: no se puede elegir como referencia y la
  lista lo dice; la aplicación no inventa una llave (FR-009).
- **Llave primaria de varias columnas**: la tabla no se ofrece como destino en
  este incremento, con el motivo a la vista (FR-009).
- **Tabla sola en el modelo**: con una sola tabla el único destino posible es
  ella misma, y es la que se propone; sin ninguna llave primaria de una columna,
  «Añadir clave foránea» lo dice en lugar de crear una fila sin referencia
  (FR-005).
- **Relación hacia la misma tabla**: se crea como cualquier otra y se dibuja
  como un bucle sobre su tarjeta; la columna de la clave foránea no puede ser el
  campo de la llave primaria al que apunta (FR-009a, FR-013a).
- **Relación de varias columnas en el archivo**: se muestra, se dibuja anclada a
  su primer campo y se conserva al guardar; sus columnas no se editan aquí y la
  fila lo explica (FR-020).
- **Nombre de columna ya usado**: la columna propuesta por el patrón que ya
  exista en la tabla llega con sufijo numérico (`unidad_id_2`) (FR-004).
- **Dos relaciones sobre la misma columna**: se permiten y la columna sigue
  marcada FK mientras quede una (FR-035).
- **SET NULL sobre columna no nula**: se avisa de que la regla no podrá
  aplicarse y se ofrece quitar el «no nulo»; la regla se guarda igual (FR-030).
- **Clave foránea sin índice**: la fila lo dice con «Sin índice»; crear el
  índice llega con el incremento de índices (FR-033).
- **Muchas líneas por el mismo hueco**: se reparten en carriles y el orden se
  elige para cruzar lo menos posible (FR-016).
- **Tablas solapadas o muy juntas**: cuando no hay hueco entre ellas la línea
  sale por el mismo lado de las dos y rodea, sin atravesar ninguna tarjeta
  (FR-016).
- **Modelo sin relaciones**: el diagrama se ve igual que en el Incremento 3 y el
  resaltado sigue funcionando sobre la tabla sola (FR-021).
- **Movimiento reducido**: con «Reducir movimiento» del sistema el resaltado
  llega al mismo resultado sin animación (FR-025).
- **Eliminar la tabla referenciada**: la confirmación dice cuántas relaciones se
  van con ella y deshacer las devuelve (FR-037).

## Requirements *(mandatory)*

### Functional Requirements

**Crear una clave foránea**

- **FR-001**: El sistema MUST abrir la pestaña «Claves foráneas» del panel
  inferior desde «Relación» de la barra superior, desde la tecla R, desde
  «Nueva clave foránea…» del menú de la tabla y desde la paleta de comandos.
- **FR-001a**: La relación MUST crearse solo por esas entradas: arrastrar de un
  campo a otro en el lienzo MUST NOT crear ni empezar una relación, y arrastrar
  sobre una tabla MUST seguir siendo moverla (decidido en Clarifications).
- **FR-002**: Sin tabla seleccionada, esas entradas MUST pedir seleccionar la
  tabla que tendrá la clave y MUST NOT cambiar el modelo.
- **FR-003**: Con una tabla seleccionada, abrir la pestaña MUST dejarla como la
  tabla que lleva la clave y MUST decir sobre qué tabla se está trabajando.
- **FR-004**: «Añadir clave foránea» MUST añadir una fila con una columna nueva
  en la tabla: nombre según el patrón de Ajustes —`{tabla}_{pk}`, con sufijo
  numérico si ese nombre ya existe en la tabla—, tipo y longitud de la llave
  primaria referenciada, «no nulo» y marcada FK. La relación nace así
  obligatoria; quitarle el «no nulo» se hace en la pestaña «Campos» (decidido
  en Clarifications).
- **FR-005**: La tabla destino propuesta MUST ser la primera tabla distinta de
  la editada a la que esta todavía no apunta; si no queda ninguna, MUST
  proponerse la tabla editada misma. Cuando ninguna tabla del modelo tiene
  llave primaria de una sola columna, el sistema MUST decirlo y MUST NOT crear
  la fila ni la columna.
- **FR-006**: Cada fila de la pestaña MUST mostrar la columna, la referencia
  (tabla y campo referenciado, con una acción para ir a esa tabla), ON DELETE,
  ON UPDATE, el estado del índice y la acción de eliminar.
- **FR-007**: Cambiar la tabla referenciada MUST apuntar la relación a su llave
  primaria; si la columna conserva el nombre que el patrón le había puesto,
  MUST renombrarse y retiparse según la tabla nueva, y si el usuario ya la había
  renombrado MUST conservarse tal cual.
- **FR-008**: Cambiar la columna de la clave foránea MUST marcar FK la columna
  nueva y MUST quitar la marca de la anterior salvo que otra relación la use.
- **FR-009**: La lista de columnas MUST ofrecer los campos de la tabla que se
  está editando. La lista de tablas destino MUST ofrecer las tablas del modelo
  con la abreviatura y el color de su esquema, incluida la tabla que se está
  editando, y MUST impedir elegir —diciendo el motivo— una tabla sin llave
  primaria o con llave primaria de varias columnas.
- **FR-009a**: En una relación de una tabla hacia sí misma, la columna de la
  clave foránea MUST NOT ser el campo de la llave primaria al que apunta; la
  fila MUST decirlo y MUST NOT guardar esa combinación.
- **FR-010**: Cuando una fila queda con columna y referencia válidas, el sistema
  MUST marcar el campo FK en el panel de campos y en la tabla del lienzo y MUST
  dibujar la línea de la relación en el diagrama.
- **FR-011**: El sistema MUST generar el nombre técnico de la relación
  (`fk_<tabla>_<columna>`), MUST mantenerlo único en el modelo y MUST NOT
  pedirlo al usuario.
- **FR-012**: Crear, cambiar y eliminar una clave foránea y cambiar sus reglas
  MUST marcar el modelo «Editado» y MUST deshacerse y rehacerse en un solo paso
  con etiqueta propia («Editar clave foránea», «Eliminar clave foránea»,
  «Cambiar ON DELETE / UPDATE») (RS-06).

**Ver las relaciones**

- **FR-013**: Cada relación MUST dibujarse como una línea entre la fila del
  campo de la clave foránea y la fila del campo de la llave primaria, enganchada
  al borde de cada tarjeta.
- **FR-013a**: Una relación de una tabla hacia sí misma MUST dibujarse como un
  bucle que sale y vuelve a la misma tarjeta, con las dos marcas de cardinalidad
  y sin atravesarla, en los tres trazados de FR-017.
- **FR-014**: Los extremos de la línea MUST mostrar la cardinalidad: la marca de
  «uno» en el lado de la llave primaria y, en el de la clave foránea, «muchos»,
  «cero o muchos» cuando su columna admite nulos, o «uno» cuando su columna es
  única. La cardinalidad MUST deducirse con la misma regla que el inspector del
  Incremento 3 usa para su texto, y las dos MUST coincidir siempre (decidido en
  Clarifications).
- **FR-015**: El color de la línea MUST ser el del esquema de la tabla con la
  llave primaria (RS-05), más tenue en reposo y más firme y gruesa cuando está
  resaltada.
- **FR-016**: Las líneas que recorren el mismo hueco entre tablas MUST
  repartirse en carriles separados, el orden de los carriles MUST elegirse para
  reducir los cruces, y ninguna línea MUST atravesar una tarjeta de tabla.
- **FR-017**: Ajustes MUST ofrecer «Trazado de relaciones» con Ortogonal —el
  valor inicial—, Curvas y Rectas; al elegir una opción, todas las líneas del
  lienzo MUST quedar redibujadas en menos de 100 milisegundos, sin cerrar ni
  volver a abrir la ventana de Ajustes, y la elección MUST conservarse entre
  sesiones.
- **FR-018**: Las líneas MUST dibujarse por debajo de las tarjetas y MUST NOT
  capturar el puntero.
- **FR-019**: Las líneas MUST seguir pegadas a sus campos al mover una tabla, al
  cambiar el zoom, al desplazar el lienzo y al cambiar el orden de los campos.
- **FR-020**: Una relación del archivo que use varias columnas MUST mostrarse,
  MUST dibujarse anclada a su primer campo y MUST conservarse al guardar; sus
  columnas MUST NOT editarse en esta pestaña, que MUST decir por qué.

**Resaltar relaciones**

- **FR-021**: Pasar el cursor por una tabla, seleccionarla o llegar a ella con
  el teclado MUST resaltar la tabla, sus relaciones y las tablas al otro lado de
  esas relaciones, y MUST atenuar las demás tablas, zonas y líneas.
- **FR-022**: La tabla activa MUST distinguirse de las relacionadas con un
  realce más marcado.
- **FR-023**: Los campos que forman una relación resaltada MUST marcarse en las
  dos tablas.
- **FR-024**: Ajustes MUST ofrecer «Animación de relaciones» con Apagada, Sutil
  —el valor inicial— y Viva; con Sutil y Viva, las relaciones resaltadas MUST
  mostrar el sentido del flujo y la cardinalidad deducida junto a cada extremo
  —1 / N, 1 / 0..N o 1 / 1—, y con Apagada MUST resaltarse sin flujo.
- **FR-025**: Con «Reducir movimiento» del sistema, ninguna línea MUST animarse,
  cualquiera que sea el ajuste, y el resaltado MUST seguir siendo visible
  (RS-11).
- **FR-026**: Quitar el cursor y la selección MUST devolver tablas, zonas y
  líneas a su aspecto normal.
- **FR-027**: El foco de esquema del Incremento 2 MUST resaltar las tablas de
  ese esquema con estas mismas reglas.

**Reglas al eliminar y actualizar**

- **FR-028**: Cada clave foránea MUST ofrecer ON DELETE y ON UPDATE entre
  NO ACTION, RESTRICT, CASCADE, SET NULL y SET DEFAULT, MUST empezar las dos en
  NO ACTION y MUST guardarlas en la relación del archivo.
- **FR-029**: Las reglas MUST sobrevivir a guardar y reabrir el modelo.
- **FR-030**: Elegir SET NULL sobre una columna «no nulo» MUST avisar de que la
  regla no podrá aplicarse y MUST ofrecer quitar el «no nulo», sin impedir
  guardar la regla.
- **FR-031**: La pestaña MUST mostrar «Referenciada por» con las tablas que
  referencian a la tabla editada —abreviatura y color de su esquema y
  `tabla.columna`—, y pulsar una de ellas MUST seleccionarla en el lienzo.
- **FR-032**: Una tabla sin claves foráneas MUST verlo dicho en la pestaña, con
  la explicación de qué hace «Añadir clave foránea»; sin tablas que la
  referencien, «Referenciada por» MUST NOT mostrarse vacía.
- **FR-033**: Cada fila MUST decir si la columna de la clave foránea está
  cubierta por un índice del modelo («Indexada») o no («Sin índice»). Crear el
  índice MUST NOT entrar en este incremento.
- **FR-034**: La ficha «Claves foráneas» del panel MUST mostrar cuántas tiene la
  tabla, como la ficha «Campos».

**Eliminar una relación**

- **FR-035**: Eliminar una clave foránea MUST quitar la relación y su línea,
  MUST conservar la columna con todas sus propiedades y MUST quitarle la marca
  FK salvo que otra relación la use.
- **FR-036**: Eliminar una clave foránea MUST deshacerse en un solo paso,
  devolviendo la relación con sus dos reglas (RS-06).
- **FR-037**: Eliminar un campo o una tabla MUST seguir confirmando qué
  relaciones se van, ahora contando las creadas en este incremento, y MUST
  llevárselas en el mismo paso deshacible (RS-08).

**Transversales**

- **FR-038**: Todas las acciones del incremento —abrir la pestaña, añadir,
  cambiar los cinco selectores de una fila, ir a la tabla referenciada y
  eliminar— MUST poder hacerse solo con el teclado, con foco visible, y la
  rejilla de la pestaña MUST recorrerse como la de campos: el tabulador entra y
  sale, las flechas mueven de celda y de fila.
- **FR-039**: Toda la pantalla nueva MUST construirse con los componentes y los
  tokens de «Aura», MUST funcionar en tema claro y oscuro y MUST mantener el
  contraste de la constitución; las líneas de relación MUST distinguirse del
  fondo del lienzo en los dos temas.
- **FR-040**: El sistema MUST leer y escribir las relaciones en `relations[]`
  del archivo del modelo, que ya existe en la versión 1 del formato; la versión
  del formato MUST NOT subir.
- **FR-041**: Las preferencias MUST guardar el trazado de relaciones, la
  animación de relaciones y el patrón de nombre de claves foráneas, con valor
  por defecto cuando falten, sin subir la versión de las preferencias.
- **FR-042**: Toda relación MUST vivir en el almacén único del modelo, y el
  lienzo, el inspector, el panel de campos y la pestaña de claves foráneas MUST
  mostrar siempre el mismo estado.

### Key Entities *(include if feature involves data)*

- **Relación**: una llave foránea del modelo. Nombre técnico único, tabla y
  campos que la llevan, tabla y campos referenciados, y las reglas ON DELETE y
  ON UPDATE. Ya existe en el formato del archivo; este incremento es el primero
  que la crea y la edita.
- **Clave foránea de una tabla**: la misma relación vista desde la tabla que la
  lleva, que es como la muestra la pestaña: columna, referencia, reglas y estado
  del índice.
- **Referenciada por**: la relación vista desde la tabla con la llave primaria;
  no es un dato nuevo, se deduce de las relaciones del modelo.
- **Preferencias de relación**: trazado (ortogonal, curvas, rectas), animación
  (apagada, sutil, viva) y patrón de nombre de claves foráneas. Viven en las
  preferencias de la aplicación, no en el modelo.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Relacionar las cuatro tablas de la demostración, resaltar una y
  cambiar sus reglas de eliminación se completa sin ayuda externa en menos de 5
  minutos.
- **SC-002**: Crear una clave foránea cuesta como máximo tres pasos: abrir la
  pestaña, «Añadir clave foránea» y elegir la tabla destino.
- **SC-003**: Con un modelo de 50 tablas y 60 relaciones, arrastrar una tabla se
  mantiene a 60 cuadros por segundo y las líneas siguen pegadas a sus campos sin
  retraso visible.
- **SC-004**: Pasar el cursor por una tabla resalta su grupo en menos de 100
  milisegundos.
- **SC-005**: En un modelo de 20 relaciones con al menos 4 compartiendo hueco,
  ninguna línea atraviesa una tarjeta de tabla y las que comparten canal se
  distinguen una de otra.
- **SC-006**: En 100 % de los casos probados, crear, cambiar de columna, cambiar
  de tabla referenciada, cambiar una regla y eliminar se deshacen en un solo
  paso y devuelven el modelo exactamente al estado anterior.
- **SC-007**: En 100 % de los casos probados, guardar y reabrir el modelo
  conserva las relaciones, sus reglas y las marcas FK como se dejaron, y el
  trazado y la animación elegidos siguen puestos al reabrir la aplicación.
- **SC-008**: 100 % de las acciones del incremento se completan solo con el
  teclado, con foco visible en cada paso.
- **SC-009**: Los seis estados del incremento (sin tabla seleccionada, tabla sin
  claves foráneas, sin tablas que la referencien, tabla destino sin llave
  primaria o con llave compuesta, columna de la clave foránea igual al campo
  referenciado en una relación hacia la misma tabla, y SET NULL sobre una
  columna no nula) muestran un mensaje visible y al menos una salida clara.
- **SC-010**: La pestaña «Claves foráneas», las líneas del diagrama y el
  resaltado se revisan en tema claro, tema oscuro y con movimiento reducido sin
  texto de contenido por debajo de 4.5:1 de contraste y sin línea de relación
  por debajo de 3:1 contra el fondo del lienzo, con el mismo desvío deliberado
  que el Incremento 2 documentó para el tercer gris.

- **SC-011**: En 100 % de los casos probados, la cardinalidad que dibujan los
  extremos de una línea coincide con el texto de cardinalidad que el inspector
  muestra para esa misma relación.

## Assumptions

- **Diseño visual**: la pestaña «Claves foráneas» del panel inferior, las líneas
  del diagrama, el resaltado y las dos opciones nuevas de Ajustes siguen el
  lienzo «SQL Designer · Diseño de Pantallas» —tablero `Editor`, componente
  `TableEditorPanel` en su variante `fks` y el tablero `PreferencesWindow`—, y
  los componentes y tokens vienen del sistema de diseño «Aura». El lienzo es
  referencia de diseño, no base de código (constitución, puerta 6).
- **Clave foránea de una sola columna** (decidido en Clarifications): lo mismo
  que dibuja el tablero de diseño, que propone y edita una columna contra la
  llave primaria de la tabla destino. Las claves foráneas de varias columnas no
  se crean aquí; una que venga del archivo se respeta (FR-020). Si el producto
  las necesita, es su propio incremento.
- **Llave primaria compuesta** (decidido en Clarifications): por lo anterior,
  una tabla con llave primaria de varias columnas no puede ser destino en este
  incremento y la lista lo dice.
  Las llaves compuestas sí se pueden definir desde el Incremento 3, así que el
  caso existe y tiene mensaje (FR-009).
- **Relación hacia la misma tabla** (decidido en Clarifications): entra en este
  incremento, aunque el tablero de diseño no ofrezca la tabla editada como
  destino: las jerarquías —categoría padre, empleado jefe— son de lo primero
  que alguien modela. El bucle sobre la propia tarjeta es trazado nuevo que el
  tablero no dibuja; el trazado de dos tablas solapadas es su punto de partida.
- **Sin arrastrar de campo a campo** (decidido en Clarifications): el enunciado
  y el tablero crean la relación desde la pestaña, no tirando una línea de un
  campo a otro en el lienzo. Arrastrar sigue siendo mover la tabla (FR-001a). Si
  se quiere ese gesto, es trabajo de otro incremento.
- **Nombre de la relación automático**: el formato exige un nombre único por
  relación y el tablero no lo pide; se genera como `fk_<tabla>_<columna>`, se
  mantiene único y no se muestra como campo editable.
- **Solo la pestaña «Claves foráneas»**: el panel inferior tiene cinco secciones
  (Campos, Índices, Claves foráneas, Únicos, SQL). El Incremento 3 construyó
  «Campos»; este construye «Claves foráneas». «Índices», «Únicos» y «SQL» siguen
  esperando su incremento.
- **El índice solo se informa**: la fila dice «Indexada» o «Sin índice» leyendo
  los índices que ya trae el modelo; crear el índice que falta es del incremento
  de índices (FR-033).
- **Aviso de SET NULL**: el tablero no lo dibuja; se añade porque la columna
  propuesta llega «no nulo» y la regla sería imposible. Es un aviso, no un
  bloqueo (FR-030).
- **Cardinalidad deducida** (decidido en Clarifications): la cardinalidad no se
  guarda en el archivo: se deduce del «no nulo» y de la unicidad de la columna,
  con la misma regla que el inspector del Incremento 3 ya usa para su texto, y
  la línea del lienzo dibuja esa misma lectura (FR-014).
- **El archivo no cambia**: `relations[]`, con `fromTable`, `fromFields`,
  `toTable`, `toFields`, `onDelete` y `onUpdate`, ya está en la versión 1 del
  formato; este incremento solo empieza a escribirlo (FR-040).
- **Preferencias nuevas sin subir versión**: el trazado, la animación y el
  patrón de claves foráneas se añaden con valor por defecto cuando faltan, como
  se hizo con la cuadrícula y el alto del panel en el Incremento 3 (FR-041).
- **Sin SQL todavía**: las reglas se guardan y se ven, pero el `ALTER TABLE …
  FOREIGN KEY` que las usa es del incremento de exportación, con el generador
  único de la constitución (principio II).
- **Sin red ni servicios**: todo ocurre sobre el modelo en memoria y su archivo
  local (constitución, principio I).
- **Rendimiento medido en desarrollo**: las cifras de SC-003 y SC-004 se miden
  sobre la compilación de depuración, como en los incrementos anteriores, con el
  Modo de bajo consumo del sistema apagado.

## Dependencies

- **Incremento 3 (`specs/004-tablas-campos`)**: las tablas con sus campos, las
  marcas PK / FK / PF / UK, el panel inferior con su rejilla y su alto, el
  inspector de tabla, el menú de la tabla, y las confirmaciones de eliminar
  campo y eliminar tabla que ya nombran las relaciones afectadas.
- **Incremento 2 (`specs/003-lienzo-esquemas`)**: el lienzo con su navegación,
  su zoom y su minimapa, las zonas de esquema, el color y la abreviatura del
  esquema y el foco de esquema.
- **Incremento 1 (`specs/002-archivos-modelo`)**: abrir y guardar el modelo, el
  estado del archivo, el historial de deshacer, el almacén único y el formato
  `.yaml` versión 1, que ya declara `relations[]`.
- **Incremento 0 (`specs/001-base-aplicacion`)**: ventana propia, temas claro y
  oscuro, preferencias, atajos y paleta de comandos.
- **Incrementos siguientes**: «Índices» hereda de aquí el aviso «Sin índice» y
  es quien crea el índice; «Exportar» hereda las reglas ON DELETE y ON UPDATE
  para el SQL; la sección «SQL» del panel llega con él.
