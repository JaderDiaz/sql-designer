# Feature Specification: Archivos de modelo (Incremento 1)

**Feature Branch**: `002-archivos-modelo`

**Created**: 2026-10-26

**Status**: Draft

**Input**: User description: "Incremento 1 · Archivos de modelo. Objetivo: crear, abrir, guardar y cerrar modelos, y retomarlos desde Recientes. Depende de: Incremento 0. Se demuestra: crear un modelo, cerrarlo, volver a abrirlo desde Recientes y ver los errores de archivo. SF-1.1 Crear un modelo nuevo; SF-1.2 Elegir la carpeta; SF-1.3 Abrir un modelo; SF-1.4 Guardar y estado de cambios; SF-1.5 Cerrar el modelo; SF-1.6 Recientes; SF-1.7 Acciones sobre un reciente."

## Clarifications

### Session 2026-10-26

- Q: ¿Para elegir carpeta y abrir un modelo se usan las pantallas propias del diseño o los diálogos de archivos del sistema operativo? → A: Pantallas propias (P-03 y P-04 del lienzo, con ubicaciones, buscador, Atrás/Adelante, vista previa y «Nueva carpeta»)
- Q: En este incremento el modelo todavía no se puede editar (el lienzo llega en el Incremento 2). ¿Qué cambio debe existir para poder ver «Editado» y probar ⌘S? → A: Renombrar el modelo abierto desde el Editor, con el mismo diálogo de renombrar (D-07); nada más del modelo se edita en este incremento
- Q: Con un modelo ya abierto en el Editor, ¿qué pasa si el usuario pide «Nuevo modelo» o «Abrir modelo»? → A: Un modelo a la vez en una sola ventana: el nuevo reemplaza al actual, preguntando antes «¿Guardar los cambios?» si había cambios sin guardar
- Q: Si otro programa modifica el archivo .yaml mientras está abierto en SQL Designer, ¿qué debe pasar al guardar? → A: Al guardar se detecta que el archivo cambió desde la última lectura y se pregunta: sobrescribir con lo que hay en pantalla, o cancelar y revisar
- Q: ¿Cuántos modelos debe recordar la lista de Recientes de la Bienvenida? → A: Máximo 10; al añadir la 11.ª se descarta la más antigua, sin avisos

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Crear un modelo nuevo (Priority: P1)

Quien quiere empezar un diseño abre «Nuevo modelo», escribe un nombre legible,
elige el motor SQL y la carpeta donde vivirá el archivo, y ve antes de crear la
ruta exacta que se va a escribir. Al confirmar, el Editor aparece con un modelo
vacío que ya tiene un esquema donde poner la primera tabla.

**Why this priority**: sin crear no hay archivo, y sin archivo no hay nada que
abrir, guardar ni listar en Recientes. Es la primera mitad de la demostración
del incremento.

**Independent Test**: se prueba desde la Bienvenida pulsando «Nuevo modelo…»,
escribiendo «Livy · Reservas», comprobando la ruta derivada, los errores de
nombre y el Editor resultante con su esquema por defecto.

**Acceptance Scenarios**:

1. **Dado** el diálogo Nuevo modelo, **cuando** escribo «Livy · Reservas»,
   **entonces** veo la ruta final del archivo terminada en `livy-reservas.yaml`
   dentro de la carpeta elegida (acentos y signos se convierten a minúsculas,
   números y guiones).
2. **Dado** que el nombre está vacío, **entonces** veo «Escribe un nombre para
   el modelo.» junto al campo y «Crear modelo» está deshabilitado.
3. **Dado** que el nombre no deja ninguna letra ni número al derivar el archivo,
   **entonces** veo «Usa al menos una letra o un número.» y no puedo crear.
4. **Dado** que ya existe ese archivo en la carpeta, **entonces** veo que ya
   existe ese `.yaml` en la carpeta y que debo elegir otro nombre, y no puedo
   crear.
5. **Dado** que elijo un motor entre PostgreSQL, MySQL y SQLite, **entonces**
   veo una frase que describe ese motor, y el motor preseleccionado al abrir el
   diálogo es el de Ajustes (RS-10).
6. **Dado** un nombre válido, **cuando** pulso «Crear modelo», **entonces** se
   escribe el archivo y se abre el Editor con el modelo vacío, sin ningún
   esquema: el primero lo crea quien modela.
7. **Dado** el diálogo Nuevo modelo, **cuando** pulso «Cancelar» o Esc,
   **entonces** vuelvo a la Bienvenida y no se ha escrito ningún archivo.

---

### User Story 2 - Elegir la carpeta (Priority: P2)

Quien crea un modelo decide dónde se guarda: recorre sus ubicaciones habituales,
busca por nombre, crea una carpeta nueva si la necesita y vuelve a Nuevo modelo
con esa carpeta puesta en la ruta.

**Why this priority**: sin elegir carpeta se puede crear un modelo (hay una
carpeta por defecto), pero organizar proyectos es parte del valor de crear.

**Independent Test**: se prueba abriendo «Cambiar…» desde Nuevo modelo,
cambiando de ubicación, usando Atrás y Adelante, buscando, creando una carpeta y
pulsando «Elegir».

**Acceptance Scenarios**:

1. **Dado** Elegir carpeta, **cuando** cambio de ubicación en la lista lateral,
   **entonces** veo el contenido de esa ubicación y puedo volver con Atrás y
   avanzar con Adelante; ambos están deshabilitados cuando no hay a dónde ir.
2. **Dado** una ubicación con carpetas, **entonces** solo puedo seleccionar
   carpetas: los archivos se muestran atenuados y no seleccionables.
3. **Dado** que escribo en Buscar, **entonces** solo veo las entradas cuyo
   nombre coincide, y si no coincide ninguna veo «Sin resultados» con la
   explicación de qué texto no coincidió.
4. **Dado** una ubicación sin contenido, **entonces** veo «Carpeta vacía» y la
   salida de crear una carpeta nueva o elegir otra ubicación.
5. **Dado** que pulso «Nueva carpeta», **entonces** aparece una carpeta llamada
   «carpeta sin título» ya seleccionada, y si ese nombre ya existe se numera.
6. **Dado** una carpeta seleccionada, **cuando** pulso «Elegir», **entonces**
   vuelvo a Nuevo modelo con esa carpeta en la ruta final; con «Cancelar» vuelvo
   sin cambiarla.

---

### User Story 3 - Abrir un modelo (Priority: P1)

Quien ya tiene un archivo de modelo lo busca en sus carpetas, confirma en la
vista previa que es el que quiere, y lo abre en el Editor tal como lo guardó. Si
el archivo está roto, el error dice dónde está el problema y la pantalla de abrir
sigue en pie.

**Why this priority**: junto con crear, es la otra entrada al Editor y la única
forma de retomar trabajo hecho en otra sesión.

**Independent Test**: se prueba con «Abrir modelo…» sobre una carpeta que
contiene un `.yaml` válido, un `.yaml` con errores y archivos de otro tipo.

**Acceptance Scenarios**:

1. **Dado** Abrir modelo, **cuando** selecciono un `.yaml`, **entonces** veo su
   vista previa con nombre del modelo, nombre de archivo, motor, número de
   tablas, número de relaciones, tamaño y fecha de modificación.
2. **Dado** un archivo válido, **cuando** lo abro con doble clic o con «Abrir»,
   **entonces** el Editor muestra el modelo tal como se guardó: mismo motor,
   mismos esquemas, tablas, relaciones y posiciones.
3. **Dado** un archivo con errores, **cuando** intento abrirlo, **entonces** la
   vista previa lo marca como no abrible y aparece un diálogo que nombra el
   archivo y dice la línea y la causa del error, con «Mostrar en Finder» (o
   «Mostrar en el Explorador» en Windows) y «Aceptar»; al cerrarlo sigo en Abrir
   modelo.
4. **Dado** que no hay ninguna selección válida, **entonces** «Abrir» está
   deshabilitado y no hay vista previa.
5. **Dado** una carpeta sin modelos, **entonces** veo «No hay modelos aquí» y la
   explicación de que los modelos son archivos `.yaml`; con Buscar sin
   coincidencias veo «Sin resultados».
6. **Dado** un archivo que no es `.yaml`, **entonces** se muestra atenuado y no
   se puede seleccionar ni abrir.

---

### User Story 4 - Guardar y estado de cambios (Priority: P1)

Quien está diseñando sabe en todo momento si lo que ve está escrito en el disco:
el Editor dice «Guardado» con el motor y la hora, o «Editado» con un indicador en
el botón de cerrar, y ⌘S lo escribe.

**Why this priority**: es la garantía de no perder trabajo y la condición para
que cerrar y reabrir demuestre algo.

**Independent Test**: se prueba abriendo un modelo, comprobando el estado
«Guardado», renombrando el modelo para provocar un cambio, comprobando
«Editado» y el indicador, y guardando con ⌘S (Ctrl+S en Windows).

**Acceptance Scenarios**:

1. **Dado** un modelo recién abierto o recién guardado, **entonces** veo
   «Guardado · <motor>» y la hora del último guardado.
2. **Dado** un modelo abierto, **cuando** lo renombro desde el Editor,
   **entonces** el Editor muestra el nombre nuevo y el nombre del archivo no
   cambia. Renombrar es el único cambio al modelo que este incremento permite.
3. **Dado** que hago ese cambio, **entonces** veo «Editado» en lugar de
   «Guardado» y un indicador de cambios sin guardar en el botón de cerrar
   (RS-07).
4. **Dado** cambios sin guardar, **cuando** pulso ⌘S (Ctrl+S), **entonces** el
   archivo se escribe, el estado vuelve a «Guardado», la hora se actualiza y veo
   un aviso breve «Guardado».
5. **Dado** un modelo sin cambios, **cuando** pulso ⌘S (Ctrl+S), **entonces** no
   se reescribe el archivo y el estado no cambia.
6. **Dado** que guardar falla (carpeta inexistente, sin permiso o disco lleno),
   **entonces** veo un mensaje que dice qué pasó, el modelo sigue marcado como
   «Editado» y no se pierde ningún cambio.
7. **Dado** que otro programa modificó el archivo desde que lo abrí, **cuando**
   pulso ⌘S (Ctrl+S), **entonces** veo un aviso de que el archivo cambió en el
   disco con las respuestas sobrescribir y cancelar; al cancelar no se escribe
   nada y el modelo sigue «Editado».
8. **Dado** que renombré el modelo, **cuando** pulso ⌘Z (Ctrl+Z), **entonces**
   vuelve el nombre anterior, veo un aviso breve que dice qué se deshizo, y el
   estado vuelve a «Guardado» porque el modelo coincide otra vez con el archivo;
   con ⇧⌘Z (Ctrl+Y) se repone el nombre nuevo y vuelve «Editado» (RS-06).
9. **Dado** que la carpeta del modelo ya no existe, **cuando** pulso ⌘S (Ctrl+S),
   **entonces** veo que la ruta ya no está y puedo elegir otra carpeta para
   guardarlo; al elegirla, el modelo se guarda allí y esa pasa a ser su ruta.

---

### User Story 5 - Cerrar el modelo (Priority: P2)

Quien termina una sesión cierra el modelo y vuelve a la Bienvenida; si quedan
cambios sin guardar, la aplicación pregunta antes de descartarlos.

**Why this priority**: cierra el ciclo de la demostración (crear, cerrar,
reabrir) y es la aplicación del principio de reversibilidad al archivo.

**Independent Test**: se prueba cerrando con el botón de cerrar y con ⌘W
(Ctrl+W), con y sin cambios pendientes, y eligiendo cada una de las tres
respuestas del diálogo.

**Acceptance Scenarios**:

1. **Dado** un modelo sin cambios, **cuando** lo cierro con el botón de cerrar o
   con ⌘W (Ctrl+W), **entonces** vuelvo a la Bienvenida y el modelo queda en
   Recientes en primer lugar.
2. **Dado** cambios sin guardar, **cuando** cierro, **entonces** veo el diálogo
   «¿Guardar los cambios?» con «Guardar», «No guardar» y «Cancelar», y el
   nombre del modelo afectado.
3. **Dado** ese diálogo, **cuando** elijo «Guardar», **entonces** el archivo se
   escribe y vuelvo a la Bienvenida.
4. **Dado** ese diálogo, **cuando** elijo «No guardar», **entonces** vuelvo a la
   Bienvenida y el archivo queda exactamente como en el último guardado.
5. **Dado** ese diálogo, **cuando** elijo «Cancelar» o Esc, **entonces** sigo en
   el Editor con mis cambios intactos y el modelo sigue marcado «Editado».
6. **Dado** cambios sin guardar, **cuando** cierro la ventana de la aplicación,
   **entonces** se pregunta lo mismo antes de salir.

---

### User Story 6 - Recientes (Priority: P2)

Quien vuelve a la aplicación ve en la Bienvenida los modelos que usó
últimamente, con lo justo para reconocerlos, y los abre con doble clic o Enter.
Los que ya no están o están rotos se ven marcados antes de intentar abrirlos.

**Why this priority**: es la vía rápida de retomar trabajo y la segunda mitad de
la demostración del incremento.

**Independent Test**: se prueba creando dos modelos, cerrándolos, y comprobando
el orden y los datos de la lista; después moviendo uno fuera de su carpeta y
corrompiendo otro.

**Acceptance Scenarios**:

1. **Dado** la Bienvenida con modelos usados antes, **entonces** veo los
   recientes con nombre del modelo, ruta, fecha de último uso, motor y número de
   tablas, el más reciente primero, y el número total de modelos de la lista.
2. **Dado** un reciente, **cuando** hago doble clic o lo selecciono y pulso
   Enter, **entonces** se abre en el Editor y pasa al primer lugar de la lista.
3. **Dado** un modelo que abro o guardo, **entonces** la lista no lo duplica:
   la entrada existente se actualiza y sube al primer lugar.
4. **Dado** un reciente cuyo archivo ya no existe, **entonces** la fila se marca
   «No encontrado» y al intentar abrirlo veo un diálogo que dice que el archivo
   se movió o se eliminó, con «Quitar de recientes» y «Aceptar».
5. **Dado** un reciente con errores de formato, **entonces** la fila se marca
   «Archivo con errores» y al intentar abrirlo veo el diálogo con la línea del
   error.
6. **Dado** que no hay ningún reciente, **entonces** veo un mensaje que lo dice y
   las acciones de crear y abrir siguen disponibles.

---

### User Story 7 - Acciones sobre un reciente (Priority: P3)

Quien ordena sus proyectos renombra, quita o manda a la papelera un modelo desde
la Bienvenida, sin abrirlo.

**Why this priority**: es mantenimiento de la lista; el incremento se demuestra
sin esto, pero sin esto la lista se ensucia y no se puede limpiar.

**Independent Test**: se prueba con clic derecho y con ⇧F10 sobre un reciente
válido, uno no encontrado y uno con errores, ejecutando cada acción del menú.

**Acceptance Scenarios**:

1. **Dado** un reciente, **cuando** hago clic derecho o pulso ⇧F10 (o la tecla
   de menú), **entonces** veo un menú con «Abrir», «Renombrar…», «Copiar ruta»,
   «Quitar de recientes» y «Mover a la papelera…», recorrible con flechas y
   cerrable con Esc (RS-09).
2. **Dado** «Renombrar…», **cuando** confirmo un nombre nuevo no vacío,
   **entonces** cambia el nombre del modelo en su archivo y en la lista, y el
   archivo conserva su nombre de archivo, lo que el diálogo dice de antemano.
3. **Dado** «Copiar ruta», **entonces** la ruta completa del archivo queda en el
   portapapeles y veo un aviso breve de que se copió.
4. **Dado** «Quitar de recientes», **entonces** la fila desaparece de la lista y
   el archivo no se toca.
5. **Dado** «Mover a la papelera…», **cuando** confirmo, **entonces** el archivo
   va a la papelera del sistema y la fila sale de la lista; el diálogo dice antes
   qué archivo y de qué carpeta, y que se puede recuperar desde la papelera
   (RS-08).
6. **Dado** un reciente «No encontrado», **entonces** «Abrir», «Renombrar…» y
   «Mover a la papelera…» están deshabilitadas y siguen activas «Copiar ruta» y
   «Quitar de recientes».
7. **Dado** un reciente «Archivo con errores», **entonces** «Renombrar…» está
   deshabilitada y el resto de acciones que no necesitan leer el modelo siguen
   disponibles.

---

### Edge Cases

- **Nombre que colisiona al derivar el archivo**: «Livy · Reservas» y «livy
  reservas» producen el mismo `livy-reservas.yaml`; la segunda creación se
  bloquea con el error de archivo existente.
- **Nombre muy largo**: el nombre de archivo derivado se recorta a 80 caracteres
  sin cortar la extensión, y la ruta mostrada indica el nombre real que se
  escribirá.
- **Carpeta que deja de existir entre elegirla y crear**: crear falla con un
  mensaje que lo dice y el diálogo Nuevo modelo sigue abierto con los datos
  escritos.
- **Archivo del modelo abierto borrado o movido por fuera mientras está abierto**:
  al guardar se avisa de que la ruta ya no existe y se ofrece elegir otra carpeta
  donde guardarlo, que pasa a ser la ruta del modelo (FR-045).
- **Archivo del modelo modificado por otro programa mientras está abierto**: al
  guardar se avisa de que el archivo cambió en el disco y se puede sobrescribir o
  cancelar para revisarlo; sin respuesta no se escribe nada.
- **Archivo del modelo sin permiso de escritura**: guardar falla con mensaje
  claro y el modelo sigue «Editado».
- **`.yaml` válido como YAML pero que no es un modelo de SQL Designer**: se trata
  como archivo con errores, con la línea donde se detectó el problema.
- **`.yaml` de una versión de formato posterior a la de la aplicación**: no se
  abre y el mensaje dice que el archivo es de una versión más nueva.
- **Modelo sin esquemas en el archivo**: se abre con normalidad; el formato
  admite cero esquemas, que es como nace un modelo.
- **Ruta con caracteres que el sistema no admite** (`/`, `:`, `\`): el nombre
  derivado los sustituye y la ruta mostrada es la real.
- **Recientes con más de 10 entradas**: la lista conserva las 10 más recientes y
  descarta la más antigua, sin avisos.
- **Dos ventanas o dos arranques sobre el mismo archivo**: fuera del alcance de
  este incremento (una sola ventana de modelo, ver Assumptions).
- **Papelera no disponible en el sistema**: «Mover a la papelera…» informa de que
  no se pudo y no borra nada.

## Requirements *(mandatory)*

### Functional Requirements

**Crear**

- **FR-001**: El sistema MUST ofrecer «Nuevo modelo» desde la Bienvenida (botón
  y ⌘N / Ctrl+N) con los campos nombre, motor SQL y carpeta.
- **FR-002**: El sistema MUST derivar el nombre de archivo del nombre escrito
  pasándolo a minúsculas, quitando acentos y sustituyendo por guiones todo lo que
  no sea letra ni número, y MUST mostrar la ruta completa resultante con
  extensión `.yaml` antes de crear.
- **FR-003**: El sistema MUST impedir crear y MUST mostrar el motivo junto al
  campo cuando el nombre está vacío, cuando no deja ninguna letra ni número, o
  cuando el archivo derivado ya existe en la carpeta elegida.
- **FR-004**: El sistema MUST ofrecer los motores PostgreSQL, MySQL y SQLite,
  MUST preseleccionar el de Ajustes y MUST describir en una frase el motor
  seleccionado (RS-10).
- **FR-005**: Al crear, el sistema MUST escribir el archivo del modelo vacío y
  MUST abrir el Editor con ese modelo, que MUST NOT traer ningún esquema: ni el
  del motor ni ninguno propuesto. El primer esquema lo crea quien modela, con el
  nombre y el color que quiera (FR-005a del Incremento 2).
- **FR-006**: El sistema MUST conservar el motor dentro del archivo del modelo;
  el motor de Ajustes solo determina el valor inicial de los modelos nuevos
  (RS-10).

**Elegir carpeta**

- **FR-007**: El sistema MUST permitir elegir la carpeta destino en su propia
  pantalla, no en el selector de archivos del sistema operativo, recorriendo
  ubicaciones (Recientes, Escritorio, Documentos, Descargas, Proyectos, nube y
  disco), y MUST mostrar el contenido de la ubicación activa con su fecha de
  modificación.
- **FR-008**: El sistema MUST permitir volver y avanzar por el recorrido de
  ubicaciones, y MUST deshabilitar Atrás y Adelante cuando no hay destino.
- **FR-009**: El sistema MUST filtrar el contenido mostrado por el texto de
  búsqueda y MUST mostrar «Sin resultados» cuando nada coincide y «Carpeta vacía»
  cuando la ubicación no tiene contenido.
- **FR-010**: El sistema MUST permitir crear una carpeta en la ubicación actual
  con el nombre «carpeta sin título» ya seleccionado, numerándolo si ese nombre
  ya existe, y MUST deshabilitar la acción donde no se puede escribir.
- **FR-011**: El sistema MUST permitir seleccionar solo carpetas, y al confirmar
  MUST devolver al diálogo Nuevo modelo con la carpeta elegida reflejada en la
  ruta; al cancelar MUST dejar la carpeta anterior.

**Abrir**

- **FR-012**: El sistema MUST ofrecer «Abrir modelo» desde la Bienvenida (botón y
  ⌘O / Ctrl+O) en su propia pantalla, no en el selector de archivos del sistema
  operativo, mostrando ubicaciones y el contenido de la carpeta activa, con solo
  los archivos `.yaml` seleccionables.
- **FR-013**: El sistema MUST mostrar, para el archivo seleccionado, una vista
  previa con nombre del modelo, nombre de archivo, motor, número de tablas,
  número de relaciones, tamaño y fecha de modificación.
- **FR-014**: El sistema MUST abrir el archivo seleccionado con doble clic o con
  «Abrir», y MUST deshabilitar «Abrir» cuando no hay selección válida.
- **FR-015**: El sistema MUST cargar el modelo tal como se guardó: motor,
  esquemas, enums, tablas, campos, llaves, relaciones, índices, únicos, vistas y
  posiciones en el lienzo.
- **FR-016**: Cuando el archivo no es un modelo válido, el sistema MUST NOT
  abrirlo y MUST mostrar un diálogo con el nombre del archivo, la línea y la
  causa del error, con una salida para mostrarlo en el gestor de archivos y otra
  para aceptar, quedándose en la pantalla de origen.
- **FR-017**: El sistema MUST marcar en la vista previa el archivo que no se
  puede abrir antes de que el usuario lo intente.

**Guardar y estado**

- **FR-018**: El sistema MUST mostrar en el Editor el estado del archivo:
  «Guardado · <motor>» con la hora del último guardado, o «Editado» mientras haya
  cambios sin escribir (RS-07).
- **FR-019**: El sistema MUST marcar los cambios sin guardar también con un
  indicador en el botón de cerrar (RS-07).
- **FR-020**: El sistema MUST permitir renombrar el modelo abierto desde el
  Editor; el cambio MUST marcar el modelo como «Editado» y MUST NOT cambiar el
  nombre del archivo. Es el único cambio al contenido del modelo que este
  incremento permite.
- **FR-021**: El sistema MUST guardar con ⌘S / Ctrl+S y MUST confirmar con un
  aviso breve; guardar sin cambios MUST NOT reescribir el archivo.
- **FR-022**: El sistema MUST escribir el archivo de forma que un fallo a mitad
  de la escritura no deje el archivo anterior corrupto ni truncado.
- **FR-023**: Leer un archivo de modelo, guardarlo y volver a leerlo MUST
  producir el mismo modelo, sin pérdida ni reordenación de su contenido.
- **FR-024**: Cuando guardar falla, el sistema MUST decir qué ocurrió, MUST
  mantener el modelo marcado como «Editado» y MUST NOT descartar cambios.
- **FR-025**: Al guardar, el sistema MUST detectar si el archivo cambió en el
  disco desde la última lectura o escritura y, si cambió, MUST preguntar antes de
  escribir, con una respuesta para sobrescribir con el modelo en pantalla y otra
  para cancelar el guardado y revisar; MUST NOT sobrescribir sin respuesta.
- **FR-026**: El archivo del modelo MUST llevar la versión de su formato, y el
  sistema MUST rechazar con mensaje claro un archivo de una versión que no sabe
  leer.
- **FR-044**: El sistema MUST permitir deshacer y rehacer el renombrado del modelo
  con ⌘Z / ⇧⌘Z (Ctrl+Z / Ctrl+Y), MUST decir en un aviso breve qué se deshizo o
  rehízo, y cuando el modelo vuelve a coincidir con el archivo MUST volver a
  «Guardado» (RS-06).
- **FR-045**: Cuando guardar falla porque la carpeta del modelo ya no existe, el
  sistema MUST ofrecer elegir otra carpeta; al elegirla MUST guardar el modelo
  allí, MUST adoptar esa ruta como la del modelo y MUST actualizar Recientes.

**Cerrar**

- **FR-027**: El sistema MUST permitir cerrar el modelo con el botón de cerrar y
  con ⌘W / Ctrl+W, volviendo a la Bienvenida.
- **FR-028**: Cuando hay cambios sin guardar, cerrar el modelo o la ventana MUST
  preguntar «¿Guardar los cambios?» con «Guardar», «No guardar» y «Cancelar»,
  nombrando el modelo afectado (RS-07).
- **FR-029**: «No guardar» MUST dejar el archivo igual que en el último guardado;
  «Cancelar» MUST dejar el Editor y los cambios intactos.
- **FR-030**: El sistema MUST mantener un solo modelo abierto a la vez en una sola
  ventana: «Nuevo modelo» y «Abrir modelo» desde el Editor MUST reemplazar el
  modelo actual, y cuando este tiene cambios sin guardar MUST preguntar antes con
  las mismas tres respuestas que al cerrar (FR-028).

**Recientes**

- **FR-031**: El sistema MUST mostrar en la Bienvenida la lista de modelos usados
  recientemente, ordenada del más reciente al más antiguo, con nombre del modelo,
  ruta, fecha de último uso, motor y número de tablas, y el total de la lista.
- **FR-032**: El sistema MUST registrar en Recientes todo modelo creado, abierto
  o guardado, sin duplicar una ruta ya presente, MUST conservar la lista entre
  sesiones y MUST guardar como máximo 10 entradas, descartando la más antigua al
  superar ese número.
- **FR-033**: El sistema MUST permitir abrir un reciente con doble clic o con
  Enter, y MUST permitir recorrer la lista con el teclado con foco visible.
- **FR-034**: El sistema MUST marcar los recientes cuyo archivo no existe como
  «No encontrado» y los que no se pueden leer como «Archivo con errores», y al
  intentar abrirlos MUST mostrar el diálogo correspondiente con su salida
  (quitar de recientes, o mostrar en el gestor de archivos y aceptar).
- **FR-035**: El sistema MUST ofrecer en cada reciente, por menú contextual y por
  teclado, las acciones «Abrir», «Renombrar…», «Copiar ruta», «Quitar de
  recientes» y «Mover a la papelera…» (RS-09).
- **FR-036**: «Renombrar…» MUST cambiar el nombre del modelo dentro de su archivo
  y en la lista, MUST conservar el nombre del archivo y MUST decirlo en el
  diálogo; un nombre vacío MUST NOT poder confirmarse.
- **FR-037**: «Mover a la papelera…» MUST pedir confirmación diciendo qué archivo
  y de qué carpeta se mueve, MUST usar la papelera del sistema y MUST quitar la
  entrada de la lista (RS-08).
- **FR-038**: El sistema MUST deshabilitar en el menú las acciones que no aplican
  al estado del reciente (no encontrado, con errores).

> FR-044 y FR-045 se añadieron tras el análisis de consistencia del 2026-10-26 y
> pertenecen al bloque de guardar; conservan su número para no renumerar el resto.

**Transversales**

- **FR-039**: Toda pantalla y diálogo de este incremento MUST funcionar en tema
  claro y oscuro y MUST respetar la preferencia de reducir movimiento (RS-11).
- **FR-040**: Toda acción de este incremento alcanzable con el ratón MUST poder
  hacerse con el teclado, con foco visible, y los atajos MUST mostrarse con ⌘ en
  macOS y con Ctrl en Windows (RS-09, RS-12).
- **FR-041**: Los textos de este incremento MUST estar en español, y los nombres
  técnicos derivados (archivo, esquema por defecto) MUST usar minúsculas, números
  y guion bajo o guion, sin empezar por número (RS-03, RS-12).
- **FR-042**: Ninguna operación de archivo MUST bloquear la interfaz: mientras se
  lee, escribe o lista una carpeta la aplicación MUST conservar una salida
  visible.
- **FR-043**: Las pantallas Nuevo modelo, Elegir carpeta y Abrir modelo MUST
  caber en la ventana sin que esta crezca; lo que no cabe hace scroll dentro de
  su sección (RS-01).

### Key Entities

- **Modelo**: el diseño completo contenido en un archivo `.yaml`. Atributos
  propios de este incremento: nombre legible, motor, versión de formato y la
  colección de esquemas (al menos uno). El resto de su contenido (tablas,
  relaciones, vistas, enums, posiciones) se preserva íntegro al leer y escribir,
  aunque este incremento no lo edite.
- **Archivo de modelo**: la ruta en el disco donde vive un modelo, con nombre
  derivado del nombre del modelo, extensión `.yaml`, tamaño y fecha de
  modificación.
- **Esquema**: agrupación con nombre técnico y abreviatura de 3 letras; el modelo
  nuevo nace con uno según el motor.
- **Entrada de Recientes**: ruta del archivo, nombre del modelo, motor, número de
  tablas, fecha de último uso y estado (correcto, no encontrado, con errores).
- **Estado del documento**: si el modelo en memoria coincide con el archivo
  («Guardado», con la hora) o no («Editado»).
- **Ubicación**: carpeta del sistema que se puede recorrer, buscar y elegir, con
  su contenido (carpetas y archivos con fecha).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Desde la Bienvenida, crear un modelo nuevo y llegar al Editor toma
  como máximo tres pasos (abrir el diálogo, escribir el nombre, confirmar) y
  menos de 30 segundos para quien lo hace por primera vez.
- **SC-002**: Al pulsar «Crear modelo», el Editor con el modelo vacío aparece en
  menos de 1 segundo.
- **SC-003**: Un modelo de 50 tablas y 60 relaciones se abre completo en menos de
  2 segundos, y se guarda en menos de 1 segundo.
- **SC-004**: En 100 % de los casos probados, abrir un modelo, guardarlo sin
  cambios y volver a abrirlo produce un archivo idéntico y un modelo idéntico.
- **SC-005**: En 100 % de los intentos, ningún cambio sin guardar se descarta sin
  que el usuario haya elegido «No guardar», y ningún cambio hecho al archivo por
  fuera de la aplicación se sobrescribe sin que el usuario lo haya elegido.
- **SC-006**: Los cinco estados de archivo del incremento (nombre repetido,
  archivo con errores, archivo no encontrado, carpeta vacía, sin resultados)
  muestran un mensaje visible y al menos una salida clara.
- **SC-007**: 100 % de las acciones de las pantallas del incremento se pueden
  completar solo con el teclado, con foco visible en cada paso.
- **SC-008**: Tras crear y cerrar dos modelos, ambos aparecen en Recientes en
  orden de último uso y se reabren con doble clic al primer intento.
- **SC-009**: Las cuatro pantallas del incremento (Bienvenida con recientes,
  Nuevo modelo, Elegir carpeta, Abrir modelo) se revisan en tema claro, tema
  oscuro y con movimiento reducido sin texto por debajo de 4.5:1 de contraste.

## Assumptions

- **Diseño visual**: las pantallas de este incremento siguen el lienzo «SQL
  Designer · Diseño de Pantallas» (`Main`, `NuevoModelo`, `ElegirCarpeta`,
  `AbrirModelo`, `Editor`, y los componentes de diálogo, menú contextual y
  renombrar), y los componentes y tokens vienen del sistema de diseño «Aura». El
  lienzo es referencia de diseño, no base de código.
- **Un modelo a la vez** (decidido en Clarifications): la aplicación tiene una
  sola ventana de modelo; crear o abrir otro modelo reemplaza el actual, y si hay
  cambios sin guardar se pregunta antes. Las ventanas múltiples y las pestañas
  quedan fuera del alcance.
- **Explorador propio, no diálogo del sistema** (decidido en Clarifications):
  elegir carpeta y abrir modelo usan las pantallas propias del diseño (P-03 y
  P-04), no el selector de archivos de macOS ni de Windows; la aplicación obtiene
  del sistema el listado de carpetas, las ubicaciones del usuario y la papelera.
- **Límite de Recientes** (decidido en Clarifications): la lista guarda como
  máximo 10 entradas y descarta la más antigua al superarlo, sin avisos.
- **Carpeta por defecto del diálogo Nuevo modelo**: la última carpeta usada para
  crear o abrir un modelo; si no hay ninguna, la carpeta de documentos del
  usuario.
- **Abreviatura del esquema por defecto**: se deriva del nombre del esquema en 3
  letras mayúsculas (PUB en PostgreSQL, MAI en SQLite, las tres primeras letras
  del nombre técnico del modelo en MySQL) y es editable en un incremento
  posterior.
- **Contenido editable** (decidido en Clarifications): el único cambio al modelo
  que este incremento permite es renombrar el modelo abierto desde el Editor; no
  se añaden ni editan tablas, relaciones, enums, vistas ni esquemas más allá del
  esquema por defecto, y las posiciones del lienzo no se mueven todavía.
- **Vista previa de un modelo**: el número de tablas y relaciones se obtiene
  leyendo el archivo; si leerlo falla, el archivo se considera con errores.
- **Versión de formato**: los archivos escritos llevan la versión `1`; no hay
  archivos de versiones anteriores que migrar.
- **Sin red**: todo ocurre en el disco local; no hay servicios, cuentas ni
  sincronización (constitución, principio I).

## Dependencies

- **Incremento 0 (`specs/001-base-aplicacion`)**: ventana propia con sus
  controles, tema claro y oscuro, Bienvenida con sus acciones y atajos, Ajustes
  con la preferencia de tema, y el registro local de errores.
- **Ajustes**: la preferencia de motor por defecto que consume FR-004. Mientras
  Ajustes no la exponga (está prevista en el Incremento 10), el valor por defecto
  es PostgreSQL y se lee del mismo almacén de preferencias.
- **Editor**: este incremento lo abre y muestra su estado de archivo y su cabecera;
  el lienzo, el inspector y la edición del modelo llegan en el Incremento 2.
