# Feature Specification: Tablas y campos (Incremento 3)

**Feature Branch**: `004-tablas-campos`

**Created**: 2026-10-27

**Status**: Draft

**Input**: User description: "Incremento 3 · Tablas y campos. Objetivo: crear tablas y definir sus campos y llaves primarias y únicas. Depende de: Incremento 2. Se demuestra: crear tres tablas con sus campos, moverlas entre esquemas y renombrarlas. SF-3.1 Crear una tabla; SF-3.2 Mover tablas; SF-3.3 Inspector de tabla; SF-3.4 Editor de campos; SF-3.5 Llaves y plantillas de campos; SF-3.6 Renombrar, duplicar y eliminar tablas. El diseño de pantallas es «SQL Designer · Diseño de Pantallas» y los componentes vienen de «Aura»."

## Clarifications

### Session 2026-10-27

- Q: SF-3.5 dice que la marca PK/UK aparece «en la tabla del lienzo y en el SQL». ¿Qué alcance de SQL entra en este incremento? → A: Solo lienzo y archivo: la marca se ve en la fila del campo y en la tabla del lienzo y viaja en el `.yaml`; la sección «SQL» del panel y el generador llegan en su propio incremento

- Q: La lista de tipos del tablero de diseño es de PostgreSQL, igual que los valores por defecto `gen_random_uuid()` y `now()`. ¿Qué hace este incremento? → A: Lista por motor: cada modelo ofrece los tipos de su motor, y la llave primaria `id` y las plantillas usan los valores por defecto de ese motor

- Q: Eliminar un campo que una relación usa: el enunciado pide confirmar y avisar qué relación se elimina; el tablero deshabilita el borrado. ¿Cuál manda? → A: El enunciado: se confirma nombrando la relación y se eliminan el campo y la relación en un solo paso deshacible (RS-08)

- Q: ¿La selección de varias tablas a la vez entra en este incremento? → A: No: la selección es de una sola tabla; el clic con ⇧, el recuadro de arrastre, la ficha «Selección» del inspector y las acciones en lote llegan con su propio incremento

- Q: ¿Cómo guarda el archivo la longitud y la escala de un campo? → A: Como dos valores opcionales propios del campo (`length` y `scale`) junto a `type`, que guarda solo el nombre del tipo; la versión del formato no sube y los archivos ya guardados siguen siendo válidos

- Q: Al escribir en una celda del panel de campos, ¿cuándo se cierra un paso de deshacer? → A: Un paso por celda: el paso se cierra al salir de la celda o al pulsar Intro, y el modelo se marca «Editado» con la primera pulsación

- Q: ¿Cómo se recorre con el teclado la rejilla de nueve columnas del panel de campos? → A: Como rejilla: el tabulador entra y sale del panel, dentro las flechas mueven de celda y de fila, Inicio y Fin van a los extremos de la fila, Intro empieza a editar la celda y Esc cancela

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Crear una tabla (Priority: P1)

Quien modela una entidad crea su tabla desde la barra superior, con la tecla T o
haciendo doble clic en el sitio del lienzo donde la quiere. Un diálogo pide el
nombre, el esquema y la descripción, y ofrece empezar con la llave primaria `id`
y con los campos de auditoría ya puestos. Al confirmar, la tabla aparece en el
lienzo —donde se hizo doble clic, o en el centro de lo visible—, queda
seleccionada y el editor de campos se abre para seguir trabajando.

**Why this priority**: sin tablas el incremento no existe y el lienzo del
Incremento 2 sigue vacío. Es el primer paso de la demostración y de lo que
dependen todas las demás historias.

**Independent Test**: se prueba desde un modelo con al menos un esquema creando
tres tablas por las tres vías de entrada, comprobando el error de nombre
repetido o inválido, el sitio donde aparece cada una y que el editor de campos
queda abierto sobre la tabla recién creada.

**Acceptance Scenarios**:

1. **Dado** el Editor con un esquema, **cuando** pulso «+ Tabla» en la barra
   superior, la tecla T o hago doble clic en un espacio vacío del lienzo,
   **entonces** se abre el diálogo Nueva tabla con nombre, esquema, descripción
   y las opciones «Llave primaria id» y «Campos de auditoría».
2. **Dado** el diálogo, **cuando** escribo «Pagos pendientes», **entonces** veo
   cómo quedará el nombre técnico (`pagos_pendientes`) antes de confirmar
   (RS-03).
3. **Dado** un nombre técnico vacío, que empieza por número o que ya existe en
   el modelo, **entonces** veo el error junto al campo y no puedo crear la tabla
   (RS-03).
4. **Dado** que abrí el diálogo con doble clic, **cuando** creo la tabla,
   **entonces** aparece donde hice doble clic.
5. **Dado** que abrí el diálogo desde la barra superior o con la tecla T,
   **cuando** creo la tabla, **entonces** aparece en el centro del área visible
   del lienzo, sin taparse con otra tabla.
6. **Dado** que creo la tabla, **entonces** queda seleccionada, el inspector
   muestra sus datos y el panel inferior se abre en «Campos».
7. **Dado** el diálogo con «Llave primaria id» y «Campos de auditoría»
   marcados, **cuando** creo la tabla, **entonces** llega con esos campos ya
   definidos y la vista previa del diálogo los había mostrado.
8. **Dado** el diálogo, **cuando** pulso «Cancelar» o Esc, **entonces** no se
   crea nada y el modelo queda como estaba.
9. **Dado** una tabla recién creada, **entonces** el modelo queda «Editado» y
   puedo deshacer la creación con ⌘Z / Ctrl+Z (RS-06).
10. **Dado** un modelo sin ningún esquema, **cuando** intento crear una tabla,
    **entonces** la aplicación me dice que primero hace falta un esquema y me
    ofrece crearlo.

---

### User Story 2 - Editor de campos (Priority: P2)

Quien ya tiene la tabla define sus campos en el panel inferior: una fila por
campo con llave, nombre, tipo, longitud, escala, no nulo, valor por defecto,
comentario y orden. Los valores que el tipo no admite no se piden. «Añadir
campo» deja una fila nueva lista para escribir y las flechas cambian el orden.
El panel se puede hacer más alto o más bajo según lo que haga falta ver.

**Why this priority**: una tabla sin campos no describe nada; es la otra mitad
del objetivo del incremento y lo segundo de la demostración.

**Independent Test**: se prueba sobre una tabla existente añadiendo, editando,
reordenando y eliminando campos, comprobando que longitud y escala se piden solo
cuando el tipo las admite y que el alto del panel se puede cambiar entre 200 y
560 px.

**Acceptance Scenarios**:

1. **Dado** el panel inferior en «Campos», **entonces** cada fila muestra llave,
   nombre, tipo, longitud, escala, no nulo, valor por defecto, comentario y los
   controles de orden.
2. **Dado** un campo de un tipo que no admite longitud (por ejemplo un entero o
   una fecha), **entonces** longitud y escala no se piden en esa fila.
3. **Dado** un campo de un tipo con longitud y escala (por ejemplo un decimal),
   **entonces** los dos valores se piden y se guardan.
4. **Dado** «Añadir campo», **entonces** aparece una fila nueva al final, con el
   foco puesto en su nombre y valores iniciales razonables.
5. **Dado** un campo, **cuando** uso las flechas de subir y bajar, **entonces**
   su posición cambia y el orden se refleja en la tabla del lienzo; la primera
   fila no puede subir y la última no puede bajar.
6. **Dado** un nombre de campo repetido dentro de la tabla o con forma inválida,
   **entonces** veo el error en la fila y el modelo no guarda ese nombre
   (RS-03).
7. **Dado** un campo sin uso, **cuando** lo elimino, **entonces** desaparece de
   la tabla y del lienzo y puedo deshacerlo.
8. **Dado** un campo usado por una relación, **cuando** lo elimino,
   **entonces** se pide confirmación diciendo qué relación se elimina con él, y
   al confirmar desaparecen el campo y esa relación en un solo paso deshacible
   (RS-08).
9. **Dado** el panel, **cuando** arrastro su borde superior o uso las flechas
   sobre él con el teclado, **entonces** su alto cambia entre 200 y 560 px y se
   queda en los topes.
9a. **Dado** el panel con el foco dentro, **cuando** uso las flechas, Inicio,
   Fin, Intro y Esc, **entonces** me muevo entre celdas y filas, edito la celda
   enfocada y cancelo lo escrito sin salir de la rejilla; el tabulador sale del
   panel en una sola pulsación.
10. **Dado** cualquier cambio en un campo, **entonces** el modelo queda
    «Editado» y el cambio se puede deshacer y rehacer (RS-06).
10a. **Dado** que escribo un nombre de campo entero y salgo de la celda,
    **cuando** pulso ⌘Z / Ctrl+Z una vez, **entonces** la celda recupera el
    valor que tenía antes de empezar a escribir, no la letra anterior.
11. **Dado** una tabla con un solo campo, **cuando** intento eliminarlo,
    **entonces** la aplicación lo impide diciendo que una tabla necesita al
    menos un campo.
12. **Dado** el panel abierto, **cuando** lo cierro, **entonces** el lienzo
    recupera ese espacio y la tabla sigue seleccionada.

---

### User Story 3 - Llaves y plantillas de campos (Priority: P3)

Quien define la identidad de una tabla marca sus campos como llave primaria o
como única, y la marca se ve en la tabla del lienzo. Para los campos que se
repiten en casi todas las tablas —auditoría, borrado lógico, autoría— hay
plantillas que los añaden de una vez, sin escribirlos campo a campo.

**Why this priority**: «llaves primarias y únicas» está en el objetivo del
incremento, y las plantillas son lo que hace rápido crear las tres tablas de la
demostración. Necesita el editor de campos de la historia 2.

**Independent Test**: se prueba marcando PK y UK en campos de una tabla y
comprobando la marca en el lienzo, y aplicando cada plantilla sobre una tabla
vacía y sobre una que ya tiene esos campos.

**Acceptance Scenarios**:

1. **Dado** un campo, **cuando** lo marco como PK, **entonces** la marca
   aparece en su fila y en la tabla del lienzo, y el campo queda «no nulo» sin
   poder dejar de serlo.
2. **Dado** un campo, **cuando** lo marco como UK, **entonces** la marca
   aparece en su fila y en la tabla del lienzo.
3. **Dado** varios campos marcados PK, **entonces** la llave primaria es la
   combinación de todos ellos y la tabla del lienzo lo muestra.
4. **Dado** un campo marcado, **cuando** le quito la marca, **entonces**
   desaparece de la fila y del lienzo y el cambio se puede deshacer.
5. **Dado** «Plantillas», **entonces** veo los grupos disponibles con los campos
   que añade cada uno, y elegir uno los añade de una vez.
6. **Dado** un grupo cuyos campos ya están todos en la tabla, **entonces** la
   plantilla se muestra como ya aplicada y no duplica nada.
7. **Dado** un grupo cuyos campos están solo en parte, **cuando** lo aplico,
   **entonces** se añaden únicamente los que faltan.
8. **Dado** una plantilla aplicada, **entonces** el modelo queda «Editado» y la
   aplicación completa se deshace en un solo paso (RS-06).

---

### User Story 4 - Mover tablas (Priority: P4)

Quien acomoda el diagrama arrastra las tablas hasta que se entienda: la zona de
su esquema se ajusta sola, y soltar una tabla dentro de la zona de otro esquema
la cambia de esquema. Con la opción de alinear a la cuadrícula activa, las
tablas quedan cuadradas entre sí al soltarlas.

**Why this priority**: es el tercer paso de la demostración («moverlas entre
esquemas») y lo que hace legible un diagrama con varias tablas. Necesita tablas
en el lienzo (historia 1) y las zonas del Incremento 2.

**Independent Test**: se prueba con un modelo de dos esquemas y tres tablas,
arrastrando una tabla dentro de su zona, soltándola en la zona del otro esquema
y repitiendo con la opción de cuadrícula activada y desactivada.

**Acceptance Scenarios**:

1. **Dado** una tabla en el lienzo, **cuando** la arrastro, **entonces** se
   mueve con el puntero y la zona de su esquema se ajusta a su posición nueva.
2. **Dado** que suelto la tabla dentro de la zona de otro esquema, **entonces**
   pasa a ese esquema: la barra lateral, el inspector y el color de la tabla lo
   reflejan.
3. **Dado** que suelto la tabla fuera de toda zona, **entonces** se queda donde
   la solté y conserva su esquema.
4. **Dado** la opción «Ajustar a la cuadrícula» activa, **cuando** suelto una
   tabla, **entonces** su posición se alinea a la cuadrícula del lienzo.
5. **Dado** la opción «Ajustar a la cuadrícula» apagada, **cuando** suelto una
   tabla, **entonces** se queda exactamente donde la solté.
6. **Dado** que moví una tabla o la cambié de esquema, **entonces** el modelo
   queda «Editado», puedo deshacerlo en un solo paso y al guardar la posición y
   el esquema nuevos quedan en el archivo.
7. **Dado** que arrastro una tabla hacia el borde del área visible,
   **entonces** el lienzo la sigue y el minimapa refleja la posición nueva.
8. **Dado** una tabla seleccionada, **cuando** uso el teclado para moverla,
   **entonces** se desplaza con las mismas reglas de cuadrícula y de cambio de
   esquema.

---

### User Story 5 - Renombrar, duplicar y eliminar tablas (Priority: P5)

Quien ya tiene tablas las gestiona sin rehacerlas: renombrar muestra cómo
quedará el nombre técnico y avisa si ya existe; duplicar crea una copia con los
mismos campos y descripción en un hueco junto a la original; eliminar confirma
diciendo cuántas relaciones se van con la tabla.

**Why this priority**: «renombrarlas» cierra la demostración, y duplicar y
eliminar completan el ciclo de vida de la tabla. Necesita tablas creadas
(historia 1).

**Independent Test**: se prueba sobre una tabla existente renombrándola a un
nombre nuevo y a uno ya usado, duplicándola dos veces y eliminándola desde su
menú contextual.

**Acceptance Scenarios**:

1. **Dado** una tabla, **cuando** abro «Renombrar…» y escribo un nombre,
   **entonces** veo cómo quedará el nombre técnico y el error si ya existe otra
   tabla con ese nombre (RS-03).
2. **Dado** el diálogo de renombrar con un nombre inválido, **entonces** no
   puedo confirmar.
3. **Dado** una tabla renombrada, **entonces** el lienzo, la barra lateral, el
   inspector y el panel de campos usan el nombre nuevo, y el cambio se deshace
   en un solo paso.
4. **Dado** una tabla, **cuando** elijo «Duplicar», **entonces** se crea
   «<tabla>_copia» con los mismos campos, llaves y descripción, en un espacio
   libre junto a la original, en el mismo esquema y queda seleccionada.
5. **Dado** que ya existe «<tabla>_copia», **cuando** duplico otra vez,
   **entonces** el nombre nuevo no choca con el que ya está.
6. **Dado** una tabla, **cuando** elijo «Eliminar…», **entonces** se pide
   confirmación nombrando la tabla y diciendo cuántas relaciones se eliminan con
   ella (RS-08).
7. **Dado** la confirmación, **cuando** pulso «Cancelar» o Esc, **entonces** no
   se elimina nada.
8. **Dado** una tabla eliminada, **entonces** el modelo queda «Editado», la
   selección y el panel de campos se cierran, y deshacer devuelve la tabla con
   sus campos, su posición y sus relaciones (RS-06).
---

### User Story 6 - Inspector de tabla (Priority: P6)

Quien tiene una tabla seleccionada ve y cambia sus datos principales en el
inspector sin abrir el editor completo: nombre, descripción de hasta 280
caracteres, esquema con su abreviatura, un resumen de los campos y sus
relaciones. Si la tabla tiene muchos campos, el resumen muestra los primeros y
deja un enlace al editor.

**Why this priority**: es comodidad sobre lo que las historias 1, 2 y 4 ya
permiten hacer en el diálogo y en el panel; el incremento se demuestra sin ella.

**Independent Test**: se prueba seleccionando una tabla de pocos campos y otra
de más de ocho, comprobando los datos mostrados, el tope de la descripción, el
cambio de esquema desde el inspector y el enlace al editor de campos.

**Acceptance Scenarios**:

1. **Dado** una tabla seleccionada, **entonces** el inspector muestra su nombre,
   su descripción, su esquema con la abreviatura, el resumen de campos y sus
   relaciones.
2. **Dado** el inspector, **cuando** escribo en la descripción, **entonces**
   veo cuántos caracteres quedan y no puedo pasar de 280.
3. **Dado** el inspector, **cuando** cambio el esquema, **entonces** la tabla se
   mueve a la zona de ese esquema en el lienzo.
4. **Dado** el inspector, **cuando** cambio el nombre, **entonces** se valida
   igual que al renombrar (RS-03) y el lienzo lo refleja.
5. **Dado** una tabla con más campos de los que caben, **entonces** el resumen
   muestra los primeros, dice cuántos faltan y ofrece abrir el editor de campos.
6. **Dado** el resumen de campos, **cuando** pulso un campo, **entonces** se
   abre el editor de campos con ese campo enfocado.
7. **Dado** una tabla sin relaciones, **entonces** el inspector lo dice en lugar
   de mostrar una lista vacía.
8. **Dado** que quito la selección, **entonces** el inspector vuelve a la ficha
   del modelo del Incremento 2.

---

### Edge Cases

- **Modelo sin esquemas**: crear una tabla exige un esquema; con el modelo en
  blanco la aplicación lo dice y ofrece crear el esquema primero (FR-002).
- **Nombre repetido o inválido**: el diálogo de crear, el de renombrar y el
  inspector rechazan el nombre vacío, el que empieza por número, el que lleva
  signos y el que ya existe, siempre con el error junto al campo (FR-004,
  FR-035, FR-041).
- **Doble clic sobre una tabla o una zona**: el doble clic sobre una tabla abre
  su editor de campos y el doble clic sobre el fondo crea una tabla; nunca las
  dos cosas (FR-003).
- **Tabla creada encima de otra**: cuando el centro visible está ocupado, la
  tabla nueva se coloca en el hueco libre más cercano sin taparse con otra
  (FR-006).
- **Tipo sin longitud**: cambiar un campo a un tipo que no admite longitud ni
  escala olvida los valores que tuviera, y volver al tipo anterior propone los
  valores habituales de ese tipo (FR-015).
- **Longitud o escala imposibles**: solo se aceptan números; la escala mayor que
  la longitud se avisa y no se guarda (FR-016).
- **Campo único de la tabla**: no se puede quedar sin campos; eliminar el último
  se impide con su mensaje (FR-020).
- **Campo usado por una relación**: se muestra con su marca y con la relación
  que lo usa; renombrarlo actualiza la relación y eliminarlo pide confirmación
  antes de llevarse las dos cosas (FR-019, FR-021).
- **Tipo ajeno al motor**: un campo cuyo tipo no está en la lista del motor
  —del archivo, o porque el modelo cambió de motor— se muestra tal cual con su
  aviso y se puede volver a elegir, sin invalidar el archivo (FR-018a).
- **Plantilla ya aplicada**: aplicar un grupo cuyos campos ya están no duplica
  nada ni marca el modelo «Editado» (FR-026).
- **Tabla soltada entre dos zonas**: cuando el punto de soltar cae en dos zonas
  solapadas, manda la zona de encima, y el inspector dice en qué esquema quedó
  (FR-030).
- **Tabla soltada fuera de toda zona**: conserva su esquema; su zona se estira
  para seguir rodeándola (FR-029).
- **Duplicar sin sitio libre**: cuando no hay hueco alrededor, la copia se
  coloca desplazada de la original y queda visible y seleccionada (FR-038).
- **Descripción en el tope**: a 280 caracteres el campo no acepta más y lo dice
  (FR-043).
- **Muchos campos**: una tabla de 40 campos se recorre en el panel sin perder la
  fila de encabezado, y el resumen del inspector no crece sin fin (FR-044,
  SC-006).
- **Eliminar lo que se está editando**: eliminar la tabla abierta en el panel
  cierra el panel y vacía el inspector sin errores (FR-040).
- **Movimiento reducido**: con «Reducir movimiento» del sistema, abrir el panel,
  crear una tabla y colocar la copia llegan al resultado sin animación
  (FR-049).

## Requirements *(mandatory)*

### Functional Requirements

**Crear una tabla**

- **FR-001**: El sistema MUST permitir crear una tabla desde la barra superior
  («+ Tabla»), con la tecla T y con doble clic en un espacio vacío del lienzo, y
  MUST ofrecer la misma acción en la paleta de comandos.
- **FR-002**: Crear una tabla MUST exigir un esquema de destino. Con un modelo
  sin esquemas el sistema MUST decirlo y MUST ofrecer crear el esquema antes de
  seguir, sin crear la tabla.
- **FR-003**: El diálogo Nueva tabla MUST pedir nombre, esquema y descripción, y
  MUST ofrecer las opciones «Llave primaria id» y «Campos de auditoría»,
  diciendo qué campos añade cada una y mostrando una vista previa de la tabla
  resultante.
- **FR-004**: Al escribir el nombre, el diálogo MUST mostrar el nombre técnico
  que se guardará y MUST rechazar —con el error junto al campo y sin poder
  crear— el nombre vacío, el de forma inválida y el que ya existe en el modelo
  (RS-03).
- **FR-005**: El esquema propuesto MUST ser el esquema enfocado si hay uno, o el
  de la tabla seleccionada, o el primero del modelo.
- **FR-006**: Una tabla creada con doble clic MUST aparecer en el punto del
  modelo donde se hizo doble clic; creada por cualquier otra vía MUST aparecer
  en el centro del área visible del lienzo. En los dos casos MUST NOT quedar
  tapada por otra tabla.
- **FR-007**: Al crear la tabla, el sistema MUST seleccionarla, MUST mostrar sus
  datos en el inspector y MUST abrir el panel inferior en «Campos».
- **FR-007a**: La selección MUST ser de una sola tabla: seleccionar otra MUST
  quitar la anterior, y las acciones de este incremento MUST actuar sobre esa
  única tabla (decidido en Clarifications).
- **FR-008**: Una tabla creada con «Llave primaria id» MUST llegar con un campo
  `id` marcado como llave primaria y no nulo; con «Campos de auditoría» MUST
  llegar además con los campos de creación y de modificación. Las dos opciones
  MUST llegar marcadas por defecto.
- **FR-009**: «Cancelar» y Esc MUST cerrar el diálogo sin cambiar el modelo.

**Editor de campos**

- **FR-010**: El panel inferior MUST ofrecer la sección «Campos» de la tabla
  seleccionada, con el nombre de la tabla, su esquema y cuántos campos tiene.
- **FR-011**: Cada campo MUST mostrarse como una fila con llave, nombre, tipo,
  longitud, escala, no nulo, valor por defecto, comentario y controles de orden.
- **FR-012**: El sistema MUST permitir editar cada una de esas propiedades en la
  propia fila, y cada cambio MUST verse en la tabla del lienzo.
- **FR-013**: «Añadir campo» MUST añadir una fila al final, con el foco en su
  nombre y con tipo y valores iniciales razonables.
- **FR-014**: El sistema MUST permitir cambiar el orden de los campos con las
  flechas de subir y bajar, MUST deshabilitar subir en el primero y bajar en el
  último, y el orden MUST ser el que se guarda en el archivo y el que muestran
  la tabla del lienzo y el inspector.
- **FR-015**: El sistema MUST pedir longitud y escala solo en los tipos que las
  admiten y MUST NOT pedirlas en los demás. Al cambiar a un tipo que no las
  admite MUST olvidar esos valores; al cambiar a uno que sí MUST proponer los
  valores habituales de ese tipo.
- **FR-016**: Longitud y escala MUST aceptar solo números enteros positivos, y
  una escala mayor que la longitud MUST avisarse sin guardarse.
- **FR-017**: Los nombres de campo MUST seguir las reglas del producto (RS-03) y
  MUST ser únicos dentro de la tabla; un nombre inválido o repetido MUST
  mostrarse como error en su fila y MUST NOT guardarse.
- **FR-018**: El tipo MUST elegirse de la lista de tipos del motor del modelo, y
  esa lista MUST cambiar con el motor (PostgreSQL, MySQL, SQLite). La llave
  primaria `id` de FR-008 y los campos de las plantillas de FR-027 MUST usar el
  tipo y el valor por defecto que corresponden a ese motor (decidido en
  Clarifications).
- **FR-018a**: Un campo cuyo tipo no está en la lista del motor del modelo
  —porque el archivo lo traía o porque el modelo cambió de motor— MUST mostrarse
  tal cual, MUST avisar de que ese motor no lo reconoce y MUST poder volver a
  elegirse, sin invalidar el archivo.
- **FR-019**: Eliminar un campo MUST quitarlo de la tabla y del lienzo. Cuando
  una relación usa ese campo, el sistema MUST pedir confirmación nombrando la
  relación, y confirmar MUST eliminar el campo y esa relación como un solo paso
  deshacible (RS-08, decidido en Clarifications).
- **FR-020**: Una tabla MUST tener al menos un campo: eliminar el último MUST
  impedirse con un mensaje visible.
- **FR-021**: Un campo que una relación usa MUST mostrar su marca y MUST decir
  qué relación lo usa. Renombrarlo MUST actualizar esa relación; eliminarlo MUST
  pasar por la confirmación de FR-019.
- **FR-022**: El alto del panel MUST poder cambiarse entre 200 y 560 px, con el
  ratón y con el teclado, y MUST quedarse en los topes. El alto elegido MUST ser
  preferencia de la aplicación, no del archivo.
- **FR-023**: El panel MUST poder cerrarse, devolviendo su espacio al lienzo sin
  perder la selección, y MUST poder volver a abrirse desde el inspector, el menú
  contextual de la tabla y el doble clic sobre la tabla.
- **FR-024**: Todo cambio en los campos MUST marcar el modelo «Editado» y MUST
  poder deshacerse y rehacerse con su etiqueta (RS-06).
- **FR-024a**: Escribir en una celda MUST valer un solo paso de deshacer: el
  paso MUST cerrarse al salir de la celda o al pulsar Intro, y el modelo MUST
  marcarse «Editado» con la primera pulsación. Deshacer MUST devolver el valor
  que la celda tenía antes de empezar a escribir (decidido en Clarifications).

**Llaves y plantillas**

- **FR-025**: El sistema MUST permitir marcar cada campo como llave primaria
  (PK) o como única (UK), o sin marca, y la marca MUST verse en la fila del
  campo, en la tabla del lienzo y en el resumen del inspector.
- **FR-026**: Un campo marcado PK MUST quedar no nulo y MUST NOT poder dejar de
  serlo mientras lo esté. Varios campos marcados PK MUST formar una sola llave
  primaria compuesta.
- **FR-027**: El sistema MUST ofrecer plantillas de campos comunes —al menos
  auditoría— que añaden sus campos de una vez, con sus tipos y valores por
  defecto ya puestos.
- **FR-028**: Una plantilla MUST añadir solo los campos que faltan, MUST decir
  cuándo ya está aplicada y MUST poder deshacerse en un solo paso.
- **FR-029**: Las marcas de llave MUST viajar en el archivo del modelo —la
  llave primaria y los campos únicos de la tabla— y MUST verse en la fila del
  campo, en la tabla del lienzo y en el resumen del inspector. El SQL de la
  tabla MUST NOT formar parte de este incremento: la sección «SQL» del panel
  inferior y el generador llegan en el incremento que los tiene por objetivo
  (decidido en Clarifications).

**Mover tablas**

- **FR-030**: El sistema MUST permitir arrastrar una tabla por el lienzo, y la
  zona de su esquema MUST ajustarse mientras se mueve y al soltarla.
- **FR-031**: Soltar una tabla dentro de la zona de otro esquema MUST cambiarla
  a ese esquema; soltarla fuera de toda zona MUST conservar su esquema. Cuando
  el punto de soltar cae en dos zonas solapadas MUST mandar la de encima.
- **FR-032**: El sistema MUST ofrecer la opción de alinear a la cuadrícula como
  preferencia de la aplicación; con ella activa, la posición de una tabla MUST
  ajustarse a la cuadrícula al soltarla.
- **FR-033**: Mover una tabla y cambiarla de esquema MUST marcar el modelo
  «Editado», MUST poder deshacerse en un solo paso y MUST escribirse en el
  archivo al guardar.
- **FR-034**: El sistema MUST permitir mover una tabla seleccionada con el
  teclado, con las mismas reglas de cuadrícula y de cambio de esquema.
- **FR-035**: El sistema MUST ofrecer cambiar el esquema de una tabla también
  desde su menú contextual y desde el inspector, con el mismo efecto que
  arrastrarla a esa zona.

**Renombrar, duplicar y eliminar**

- **FR-036**: El sistema MUST ofrecer «Renombrar…», «Duplicar» y «Eliminar…» en
  el menú contextual de la tabla y en las acciones del inspector, y «Duplicar»
  MUST tener atajo de teclado.
- **FR-037**: Renombrar MUST mostrar cómo quedará el nombre técnico y MUST
  rechazar el nombre inválido y el que ya existe (RS-03); al confirmar, el
  nombre nuevo MUST verse en el lienzo, la barra lateral, el inspector y el
  panel de campos.
- **FR-038**: Duplicar MUST crear «<tabla>_copia» con los mismos campos, marcas
  de llave y descripción, en el mismo esquema, en un espacio libre junto a la
  original, y MUST dejarla seleccionada. Cuando ese nombre ya existe MUST elegir
  uno libre derivado de él.
- **FR-039**: Eliminar MUST pedir confirmación nombrando la tabla y diciendo
  cuántas relaciones se eliminan con ella (RS-08).
- **FR-040**: Eliminar la tabla abierta en el panel MUST cerrar el panel y
  vaciar la selección sin errores.
- **FR-041**: Renombrar, duplicar y eliminar MUST marcar el modelo «Editado» y
  MUST poder deshacerse en un solo paso, devolviendo la tabla con sus campos,
  sus marcas, su descripción, su esquema y su posición (RS-06).

**Inspector de tabla**

- **FR-042**: Con una tabla seleccionada, el inspector MUST mostrar su nombre,
  su descripción, su esquema con la abreviatura, un resumen de sus campos y sus
  relaciones.
- **FR-043**: El inspector MUST permitir cambiar el nombre, la descripción y el
  esquema de la tabla, con las mismas validaciones que el diálogo de crear y el
  de renombrar. La descripción MUST aceptar hasta 280 caracteres y MUST decir
  cuántos quedan.
- **FR-044**: El resumen de campos MUST mostrar los primeros campos con su marca
  de llave y su tipo, MUST decir cuántos quedan fuera y MUST ofrecer abrir el
  editor de campos; pulsar un campo del resumen MUST abrir el editor con ese
  campo enfocado.
- **FR-045**: Con una tabla sin relaciones el inspector MUST decirlo, y sin
  selección MUST volver a la ficha del modelo del Incremento 2.

**Transversales**

- **FR-046**: Toda acción de este incremento alcanzable con el ratón MUST poder
  hacerse con el teclado, con foco visible, y los atajos MUST mostrarse con ⌘ en
  macOS y con Ctrl en Windows (RS-09, RS-12).
- **FR-046a**: El panel de campos MUST recorrerse como una rejilla: el tabulador
  MUST entrar en el panel y salir de él como una sola parada, las flechas MUST
  mover de celda y de fila, Inicio y Fin MUST ir a los extremos de la fila,
  Intro MUST empezar a editar la celda enfocada y Esc MUST cancelar lo escrito
  en ella. La rejilla MUST anunciarse como tal a un lector de pantalla, con la
  columna y la fila de la celda enfocada (decidido en Clarifications).
- **FR-047**: Las tablas, sus campos y sus marcas de llave MUST anunciarse a un
  lector de pantalla con su nombre, su tipo y su marca, y el color MUST NOT ser
  el único portador de esa información.
- **FR-048**: Todo lo que este incremento añade MUST funcionar en tema claro y
  oscuro, con contraste de texto de contenido ≥ 4.5:1 en los dos (RS-11).
- **FR-049**: Con «Reducir movimiento» del sistema, abrir y cerrar el panel,
  crear una tabla, duplicarla y centrarla MUST llegar al resultado sin
  animación (RS-11).
- **FR-050**: Los textos de este incremento MUST estar en español y los nombres
  técnicos MUST seguir las reglas del producto (RS-03, RS-12).
- **FR-051**: El archivo del modelo MUST seguir siendo la única fuente de
  verdad: nombres, campos, marcas de llave, descripciones, esquema y posiciones
  MUST viajar en el archivo, y leer, guardar y volver a leer un modelo MUST
  producir el mismo modelo.
- **FR-051a**: La longitud y la escala MUST guardarse como dos valores
  opcionales propios del campo, y `type` MUST guardar solo el nombre del tipo,
  sin paréntesis ni números dentro. Al ser opcionales, la versión del formato
  MUST NOT cambiar y los archivos ya guardados MUST seguir siendo válidos
  (decidido en Clarifications).
- **FR-052**: Ninguna acción de este incremento MUST bloquear la interfaz:
  arrastrar una tabla, escribir en el panel de campos y duplicar una tabla MUST
  conservar la ventana respondiendo.

### Key Entities

- **Tabla**: la entidad del modelo. Tiene nombre técnico único en el modelo,
  esquema, descripción de hasta 280 caracteres, lista ordenada de campos,
  llave primaria, únicos y posición en el lienzo. Es el objeto que este
  incremento crea, mueve, renombra, duplica y elimina.
- **Campo**: una columna de la tabla. Tiene nombre técnico único dentro de la
  tabla, tipo (solo el nombre del tipo), longitud y escala opcionales cuando el
  tipo las admite, no nulo, valor por defecto, comentario y una posición en el
  orden de la tabla.
- **Marca de llave**: lo que un campo es dentro de la identidad de la tabla:
  llave primaria, única, sin marca, o definida por una relación. La llave
  primaria puede ser de varios campos.
- **Plantilla de campos**: un grupo con nombre de campos comunes —auditoría,
  borrado lógico, autoría— con sus tipos y valores por defecto, que se añade de
  una vez. Es catálogo de la aplicación, no contenido del archivo.
- **Tipo de campo**: lo que el campo guarda, elegido de la lista de tipos
  disponibles para el modelo, junto con si admite longitud y escala.
- **Posición de tabla**: las coordenadas de la tabla en el lienzo, que ya
  existen en el formato y que este incremento cambia al arrastrarla.
- **Alineación a la cuadrícula**: si las posiciones se ajustan a la cuadrícula
  al soltar. Preferencia de la aplicación, no del archivo.
- **Alto del panel inferior**: entre 200 y 560 px. Preferencia de la
  aplicación, no del archivo.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Desde un modelo con un esquema, crear una tabla con llave primaria
  y campos de auditoría toma como máximo tres pasos (abrir el diálogo, escribir
  el nombre, confirmar) y menos de 30 segundos para quien lo hace por primera
  vez.
- **SC-002**: Crear las tres tablas de la demostración con sus campos, moverlas
  entre esquemas y renombrarlas se completa sin ayuda externa en menos de 6
  minutos.
- **SC-003**: Definir un campo completo —nombre, tipo, longitud, no nulo y
  comentario— se hace sin salir del panel y sin usar el ratón.
- **SC-004**: Con un modelo de 50 tablas, arrastrar una tabla se ve continuo: el
  movimiento se mantiene a 60 cuadros por segundo y la tabla responde al primer
  gesto en menos de 100 milisegundos.
- **SC-005**: Escribir en el panel de campos responde al instante: ninguna
  pulsación tarda más de 100 milisegundos en verse en la fila y en la tabla del
  lienzo.
- **SC-006**: Una tabla de 40 campos se recorre y se edita en el panel sin
  perder la fila de encabezado y sin que el resumen del inspector crezca más
  allá de su tope.
- **SC-007**: En 100 % de los casos probados, crear, mover, cambiar de esquema,
  editar una celda de un campo, aplicar una plantilla, renombrar, duplicar y
  eliminar se deshacen en un solo paso y devuelven el modelo exactamente al
  estado anterior; escribir un valor completo en una celda cuenta como un paso,
  no como una pulsación por paso (FR-024a).
- **SC-008**: En 100 % de los casos probados, guardar después de crear y mover
  tablas y volver a abrir el modelo muestra las tablas, sus campos, sus marcas y
  sus posiciones como se dejaron.
- **SC-009**: 100 % de las acciones del incremento se pueden completar solo con
  el teclado, con foco visible en cada paso. En una tabla de 40 campos, llegar
  desde el panel hasta cualquier celda de la última fila MUST costar como máximo
  el tabulador de entrada más los movimientos de flecha, sin una parada de
  tabulador por celda (FR-046a).
- **SC-010**: Los cinco estados del incremento (modelo sin esquemas, nombre de
  tabla repetido, nombre de campo repetido, tabla con un solo campo y campo
  usado por una relación) muestran un mensaje visible y al menos una salida
  clara.
- **SC-011**: El diálogo Nueva tabla, el panel de campos, el inspector de tabla,
  el diálogo de renombrar y las confirmaciones se revisan en tema claro, tema
  oscuro y con movimiento reducido sin texto de contenido por debajo de 4.5:1 de
  contraste, y sin metadatos de 10 u 11 px por debajo de 3:1, con el mismo
  desvío deliberado que el Incremento 2 documentó para el tercer gris.

## Assumptions

- **Diseño visual**: el diálogo Nueva tabla, el panel inferior de campos, el
  inspector de tabla, el diálogo de renombrar, el menú contextual de la tabla y
  las confirmaciones siguen el lienzo «SQL Designer · Diseño de Pantallas»
  —tablero `Editor` y los componentes `TableForm`, `TableEditorPanel`,
  `RenameDialog`, `ContextMenu` y `ConfirmDialog`—, y los componentes y tokens
  vienen del sistema de diseño «Aura». El lienzo es referencia de diseño, no
  base de código (constitución, puerta 6).
- **Solo la sección «Campos» del panel** (decidido en Clarifications): el
  tablero de diseño muestra el panel inferior con cinco secciones (Campos,
  Índices, Claves foráneas, Únicos, SQL). Este incremento construye «Campos»;
  las demás, incluida «SQL», llegan con los incrementos de relaciones, índices
  y exportación.
- **Sin selección múltiple** (decidido en Clarifications): el tablero de diseño
  muestra el clic con ⇧, el recuadro de arrastre en el vacío y la ficha
  «Selección» del inspector con acciones en lote. Nada de eso entra aquí: llega
  con su propio incremento.
- **Tipos por motor** (decidido en Clarifications): la lista del tablero es de
  PostgreSQL; este incremento ofrece la lista del motor del modelo y, con ella,
  el tipo y el valor por defecto de la llave `id` y de los campos de las
  plantillas. Qué tipos tiene cada motor es decisión del `/speckit-plan`.
- **Longitud y escala en el archivo** (decidido en Clarifications): se guardan
  como dos valores opcionales del campo, junto al tipo, y no dentro del texto
  del tipo. Al ser opcionales, la versión del formato no sube y los archivos ya
  guardados siguen siendo válidos, como se hizo en el Incremento 2 con la
  posición del esquema (FR-051a).
- **Únicos de este incremento**: «llaves únicas» significa marcar un campo como
  único (UK). Los únicos de varias columnas y los índices se definen en su
  propio incremento.
- **Las relaciones todavía no se crean aquí**: un modelo abierto puede traer
  relaciones en el archivo, y por eso eliminar un campo o una tabla avisa de las
  que se van; crear y dibujar relaciones es del incremento siguiente.
- **Etiquetas del diseño**: el diálogo llama a las dos opciones «Clave primaria
  id» y «Fechas de auditoría», que son las del enunciado «Llave primaria id» y
  «Campos de auditoría»; se usa un solo término en toda la interfaz.
- **Catálogo de plantillas**: además de auditoría, el tablero propone borrado
  lógico, autoría y activo. Se toman como el catálogo inicial; es catálogo de la
  aplicación y puede crecer sin cambiar el formato.
- **Cuadrícula**: alinear a la cuadrícula es la preferencia que el tablero de
  Ajustes ya declara; su paso es decisión de diseño.
- **Deshacer**: se reutiliza el historial del Incremento 1 con etiquetas nuevas
  por acción (RS-06); la granularidad al escribir en el panel es la de
  FR-024a, un paso por celda (decidido en Clarifications).
- **Sin red ni servicios**: todo ocurre sobre el modelo en memoria y su archivo
  local (constitución, principio I).
- **Rendimiento medido en desarrollo**: las cifras de SC-004 y SC-005 se miden
  sobre la compilación de depuración, como en los incrementos anteriores.

## Dependencies

- **Incremento 2 (`specs/003-lienzo-esquemas`)**: el Editor con sus cinco zonas,
  el lienzo con su navegación y su minimapa, los esquemas con su color y su
  abreviatura, las zonas de esquema que se deducen de las tablas, el foco de
  esquema y el inspector del modelo.
- **Incremento 1 (`specs/002-archivos-modelo`)**: crear, abrir, guardar y cerrar
  modelos, el estado del archivo («Guardado · <motor>» / «Editado»), el
  historial de deshacer, el almacén único del modelo y el formato `.yaml`
  versión 1, que ya declara `tables[]` con `fields[]`, `primaryKey`, `uniques`,
  `indexes` y `position`.
- **Incremento 0 (`specs/001-base-aplicacion`)**: ventana propia, temas claro y
  oscuro, preferencias y atajos.
- **Formato del modelo**: este incremento escribe tablas y campos completos y
  añade al campo la longitud y la escala como dos valores opcionales; al ser
  opcionales, la versión del formato no cambia (FR-051a).
- **Incremento siguiente (relaciones)**: hereda de aquí las tablas y sus campos,
  y es quien crea las claves foráneas y dibuja las líneas entre tablas.
