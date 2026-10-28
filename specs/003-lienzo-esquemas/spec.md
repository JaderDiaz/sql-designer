# Feature Specification: Lienzo y esquemas (Incremento 2)

**Feature Branch**: `003-lienzo-esquemas`

**Created**: 2026-10-27

**Status**: Draft

**Input**: User description: "Incremento 2 · Lienzo y esquemas. Objetivo: el Editor muestra el lienzo y permite organizar el modelo en esquemas de color. Depende de: Incremento 1. Se demuestra: crear tres esquemas, moverlos por el lienzo y enfocarlos. SF-2.1 Estructura del Editor y modelo vacío; SF-2.2 Navegar el lienzo; SF-2.3 Crear y editar un esquema; SF-2.4 Eliminar un esquema; SF-2.5 Zonas de esquema; SF-2.6 Enfocar un esquema."

## Clarifications

### Session 2026-10-27

- Q: ¿En este incremento el lienzo solo dibuja las tablas que ya trae el archivo, o también se puede arrastrar una tabla para llevarla a otro esquema? → A: Solo dibujar; mover una tabla sola o cambiarle el esquema llega en el Incremento 3, y la zona vacía dice «Aún no hay tablas en este esquema»

- Q: ¿Dónde se guarda la posición de la zona de un esquema que no tiene tablas? → A: En un campo opcional de posición del esquema, que solo se escribe cuando el esquema está vacío y se ha movido; el formato gana un campo opcional sin subir de versión

- Q: Cuando se elimina un esquema con el interruptor «Eliminar también sus tablas» apagado, ¿quién decide a qué esquema pasan sus tablas? → A: El usuario elige en el diálogo, con el primer esquema restante propuesto; con un solo destino posible, el diálogo lo nombra sin selector

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Estructura del Editor y modelo vacío (Priority: P1)

Quien abre un modelo encuentra un espacio de trabajo completo en lugar de una
pantalla provisional: barra lateral con el contenido del modelo, barra superior
con las acciones, el lienzo en el centro, el inspector a la derecha y la barra
de estado al pie. Con un modelo todavía sin tablas, el lienzo explica por dónde
empezar en vez de quedarse en blanco, y quien necesita sitio puede esconder la
barra lateral o el inspector y recuperarlos después.

**Why this priority**: es el marco donde viven las demás historias. Sin las
cinco zonas no hay lienzo que navegar, ni barra lateral desde donde enfocar un
esquema, ni inspector donde ver sus datos.

**Independent Test**: se prueba abriendo cualquier modelo del Incremento 1 y
comprobando que las cinco zonas están, que un modelo sin tablas muestra la
tarjeta de inicio con sus tres filas, y que esconder y mostrar la barra lateral
y el inspector devuelve ese espacio al lienzo y lo recupera.

**Acceptance Scenarios**:

1. **Dado** un modelo abierto en el Editor, **entonces** veo la barra lateral,
   la barra superior, el lienzo, el inspector y la barra de estado (P-05).
2. **Dado** un modelo sin tablas, **entonces** veo en el lienzo la tarjeta
   «Empieza a diseñar tu modelo» con las filas «Crear la primera tabla»,
   «Agregar un esquema» y «Definir un enum».
3. **Dado** el Editor, **cuando** escondo la barra lateral, **entonces** el
   lienzo ocupa ese espacio y la barra superior ofrece volver a mostrarla.
4. **Dado** el Editor, **cuando** escondo el inspector, **entonces** el lienzo
   ocupa ese espacio y puedo volver a mostrarlo.
5. **Dado** que escondí la barra lateral o el inspector, **cuando** cierro el
   modelo y abro otro, **entonces** siguen escondidos: la elección es de la
   aplicación, no del archivo.
6. **Dado** el Editor, **entonces** la barra de estado dice el motor del modelo,
   el estado del archivo del Incremento 1 («Guardado · <motor>» o «Editado»), el
   porcentaje de zoom y cuántos esquemas y tablas tiene el modelo.
7. **Dado** el Editor, **entonces** el inspector muestra la ficha del modelo
   —nombre, estado del archivo, ruta, motor y cuánto tiene dentro— en lugar de
   quedarse vacío.
8. **Dado** la lista de esquemas de la barra lateral, **cuando** pulso la fila de
   un esquema, **entonces** el lienzo se centra en su zona y el inspector sigue
   mostrando la ficha del modelo.

---

### User Story 2 - Crear y editar un esquema (Priority: P2)

Quien organiza su modelo por dominios crea un esquema escribiendo su nombre: la
aplicación propone el nombre técnico y una abreviatura de tres letras, que se
pueden corregir, y ofrece una paleta de colores con vista previa de cómo se verá
la zona en el lienzo. Los nombres y abreviaturas repetidos se avisan antes de
guardar. Un esquema recién creado aparece en el lienzo como una zona vacía que
espera sus tablas.

**Why this priority**: es la mitad del objetivo del incremento y lo primero de
la demostración (crear tres esquemas). Depende solo del marco de la historia 1.

**Independent Test**: se prueba desde el Editor creando tres esquemas con
nombres legibles, comprobando el nombre técnico y la abreviatura propuestos, el
error de duplicado, el color elegido y la zona vacía resultante en el lienzo.

**Acceptance Scenarios**:

1. **Dado** el diálogo Nuevo esquema, **cuando** escribo «Ventas y cobros»,
   **entonces** veo propuestos el nombre técnico `ventas_y_cobros` y la
   abreviatura `VEN`, y puedo cambiar los dos (RS-03, RS-04).
2. **Dado** que corrijo el nombre técnico o la abreviatura a mano, **cuando**
   sigo escribiendo el nombre legible, **entonces** lo que corregí se respeta y
   deja de proponerse.
3. **Dado** el diálogo, **cuando** elijo un color de la paleta, **entonces** veo
   una vista previa de la zona con ese color antes de guardar.
4. **Dado** un nombre técnico que ya existe en el modelo, **entonces** veo el
   error junto al campo y no puedo guardar.
5. **Dado** una abreviatura que ya existe en el modelo, **entonces** veo el error
   junto al campo y no puedo guardar.
6. **Dado** un nombre técnico vacío o con forma inválida (empieza por número,
   lleva mayúsculas o signos), **entonces** veo el error y no puedo guardar
   (RS-03).
7. **Dado** una abreviatura que no son exactamente tres letras, **entonces** veo
   el error y no puedo guardar (RS-04).
8. **Dado** un esquema válido, **cuando** guardo, **entonces** aparece en la
   barra lateral y en el lienzo como una zona vacía con el texto «Aún no hay
   tablas en este esquema», el modelo queda «Editado» y puedo deshacer la
   creación.
9. **Dado** un esquema existente, **cuando** lo edito, **entonces** puedo
   cambiar su nombre, su abreviatura, su color y su descripción con las mismas
   reglas, y el lienzo y la barra lateral lo reflejan al confirmar.
10. **Dado** el diálogo, **cuando** pulso «Cancelar» o Esc, **entonces** el
    modelo queda como estaba.

---

### User Story 3 - Zonas de esquema en el lienzo (Priority: P3)

Quien mira el lienzo distingue los dominios de un vistazo: cada esquema es un
área de su color que rodea sus tablas, con su abreviatura, su nombre y cuántas
tablas tiene. El área se ajusta sola cuando las tablas se mueven, y arrastrar el
área mueve el esquema completo con sus tablas dentro.

**Why this priority**: es la otra mitad del objetivo y el segundo paso de la
demostración (moverlos por el lienzo). Necesita esquemas (historia 2) y se
aprovecha de la navegación (historia 4), pero no depende de ella.

**Independent Test**: se prueba abriendo un modelo con tablas repartidas en
varios esquemas, comprobando que cada zona rodea las suyas con su color y su
rótulo, y arrastrando una zona para ver que sus tablas la acompañan y que el
modelo queda «Editado».

**Acceptance Scenarios**:

1. **Dado** un esquema con tablas, **entonces** su zona rodea todas sus tablas
   con el color del esquema y deja un margen visible entre el borde y las
   tablas.
2. **Dado** la zona de un esquema, **entonces** muestra su abreviatura, su
   nombre y el número de tablas que contiene.
3. **Dado** un esquema sin tablas, **entonces** su zona se dibuja igual, con un
   tamaño mínimo propio y el texto «Aún no hay tablas en este esquema».
4. **Dado** dos esquemas y un archivo sin posiciones, **entonces** sus zonas no
   se superponen al abrir el modelo.
5. **Dado** una zona, **cuando** la arrastro, **entonces** la zona y todas sus
   tablas se mueven juntas y conservan sus posiciones relativas.
6. **Dado** que solté una zona en otro sitio, **entonces** el modelo queda
   «Editado», puedo deshacer el movimiento con ⌘Z / Ctrl+Z y al guardar las
   posiciones nuevas quedan en el archivo.
7. **Dado** una zona arrastrada fuera del área visible, **entonces** el lienzo
   la sigue mientras arrastro y el minimapa refleja la posición nueva.
8. **Dado** un modelo cuyas tablas no traen posición en el archivo, **entonces**
   el lienzo las coloca de forma ordenada dentro de la zona de su esquema y el
   modelo **no** queda «Editado» por haberlas colocado.
9. **Dado** un esquema sin tablas, **cuando** arrastro su zona y guardo,
   **entonces** al volver a abrir el modelo la zona sigue donde la dejé; y
   **cuando** ese esquema recibe tablas, su zona vuelve a rodearlas.

---

### User Story 4 - Navegar el lienzo (Priority: P4)

Quien trabaja con un modelo que no cabe en la pantalla se mueve por él: arrastra
el fondo, usa la rueda presionada o Espacio con el ratón, acerca y aleja entre el
40 % y el 200 % con la rueda y el modificador, con el pellizco del panel táctil o
con los botones de la barra de zoom, y recupera la vista completa con «Ajustar».
El minimapa dice dónde está mirando dentro del modelo entero.

**Why this priority**: hace usable un modelo grande, pero las zonas y el foco se
pueden demostrar sin ella en un modelo pequeño.

**Independent Test**: se prueba abriendo un modelo de 50 tablas y recorriéndolo
con las tres formas de mover, las cuatro de hacer zoom, «Ajustar» y el minimapa,
comprobando el porcentaje mostrado y los topes.

**Acceptance Scenarios**:

1. **Dado** el lienzo, **cuando** arrastro desde un espacio vacío, **entonces**
   el lienzo se mueve con el puntero.
2. **Dado** el lienzo, **cuando** arrastro con la rueda presionada, o mantengo
   Espacio y arrastro, **entonces** el lienzo se mueve igual, también encima de
   una tabla o de una zona.
3. **Dado** el lienzo, **cuando** uso ⌘ + rueda (Ctrl + rueda en Windows), el
   pellizco del panel táctil o los botones «−» y «+», **entonces** el zoom
   cambia y veo el porcentaje.
4. **Dado** el zoom al 200 %, **cuando** intento acercar más, **entonces** se
   queda en 200 %; al 40 %, alejar más lo deja en 40 %.
5. **Dado** un zoom cualquiera, **cuando** acerco con la rueda, **entonces** el
   punto del modelo bajo el puntero se queda bajo el puntero.
6. **Dado** un modelo que no cabe, **cuando** pulso «Ajustar», **entonces** todo
   el modelo queda visible dentro del lienzo con un margen y el porcentaje lo
   dice.
7. **Dado** un modelo sin tablas y sin esquemas con posición, **cuando** pulso
   «Ajustar», **entonces** el lienzo vuelve al 100 % centrado, sin errores.
8. **Dado** el minimapa, **entonces** veo la posición de todas las tablas y de
   las zonas, y un recuadro con el área visible.
9. **Dado** el minimapa, **cuando** pulso o arrastro dentro de él, **entonces**
   el lienzo se mueve a ese punto.
10. **Dado** que me moví y cambié el zoom, **cuando** cierro el modelo y lo
    vuelvo a abrir, **entonces** el lienzo arranca ajustado al modelo: la vista
    no se guarda en el archivo.

---

### User Story 5 - Enfocar un esquema (Priority: P5)

Quien quiere trabajar en un dominio concreto hace clic en su nombre en la barra
lateral: el lienzo se centra en ese esquema, el resto del modelo se atenúa y la
lista de tablas de la barra lateral se queda solo con las suyas. «Todos los
esquemas» devuelve la vista completa.

**Why this priority**: es el tercer paso de la demostración y el que hace útil la
organización por esquemas en un modelo grande; necesita zonas y navegación.

**Independent Test**: se prueba con un modelo de tres esquemas, enfocando cada
uno desde la barra lateral y comprobando el centrado, la atenuación del resto, el
filtrado de la lista y la vuelta con «Todos los esquemas».

**Acceptance Scenarios**:

1. **Dado** la lista de esquemas de la barra lateral, **cuando** hago clic en el
   nombre de un esquema, **entonces** el lienzo se centra en su zona con el zoom
   necesario para que quepa.
2. **Dado** un esquema enfocado, **entonces** las demás zonas y sus tablas se
   atenúan y la lista de tablas de la barra lateral muestra solo las de ese
   esquema.
3. **Dado** un esquema enfocado, **entonces** la barra lateral y la barra de
   estado dicen cuál está enfocado.
4. **Dado** un esquema enfocado, **cuando** hago clic en «Todos los esquemas»,
   **entonces** se quita el foco, nada queda atenuado y la lista vuelve a
   mostrar todas las tablas.
5. **Dado** un esquema enfocado, **cuando** pulso Esc en el lienzo, **entonces**
   se quita el foco.
6. **Dado** un esquema enfocado, **cuando** lo elimino o cambio de modelo,
   **entonces** el foco se quita solo y la vista vuelve al modelo completo.
7. **Dado** un esquema vacío, **cuando** lo enfoco, **entonces** el lienzo se
   centra en su zona vacía y la lista de tablas dice que el esquema no tiene
   tablas.
8. **Dado** un esquema enfocado, **cuando** cierro el modelo y lo vuelvo a
   abrir, **entonces** no hay foco: es estado de la sesión, no del archivo.

---

### User Story 6 - Eliminar un esquema (Priority: P6)

Quien ya no usa un esquema lo elimina desde su menú contextual, y la aplicación
pregunta antes diciendo qué queda afectado: un interruptor decide si las tablas
del esquema se van con él o se quedan en otro esquema. El único esquema de un
modelo no se puede eliminar.

**Why this priority**: cierra el ciclo de vida del esquema, pero el incremento se
demuestra sin ella; es la que menos arrastra al resto.

**Independent Test**: se prueba con un modelo de tres esquemas eliminando uno con
el interruptor apagado y otro con el interruptor encendido, y comprobando que en
un modelo de un solo esquema la opción está deshabilitada.

**Acceptance Scenarios**:

1. **Dado** un esquema en la barra lateral o su zona en el lienzo, **cuando**
   abro su menú contextual y elijo «Eliminar…», **entonces** veo una
   confirmación que nombra el esquema, dice cuántas tablas tiene y trae el
   interruptor «Eliminar también sus tablas».
2. **Dado** la confirmación con el interruptor apagado, **cuando** confirmo,
   **entonces** el esquema desaparece y sus tablas pasan al esquema de destino
   que indica el diálogo, conservando su contenido.
3. **Dado** que el modelo tiene más de un esquema restante, **entonces** la
   confirmación permite elegir a cuál pasan las tablas y propone el primero del
   modelo distinto del que se elimina.
4. **Dado** la confirmación con el interruptor encendido, **cuando** confirmo,
   **entonces** el esquema y sus tablas desaparecen, y el diálogo lo había dicho
   nombrando cuántas tablas se iban.
5. **Dado** un modelo con un solo esquema, **cuando** lo elimino, **entonces**
   el modelo se queda sin esquemas y el lienzo vuelve a la tarjeta de empezar;
   si ese esquema tenía tablas, se van con él, porque no hay destino al que
   moverlas (FR-035).
6. **Dado** un esquema eliminado, **entonces** el modelo queda «Editado» y puedo
   deshacer la eliminación completa —esquema, color, tablas y sus posiciones—
   con ⌘Z / Ctrl+Z.
7. **Dado** la confirmación, **cuando** pulso «Cancelar» o Esc, **entonces** no
   se elimina nada.
8. **Dado** un esquema con enums o vistas, **cuando** lo elimino con el
   interruptor apagado, **entonces** esos objetos pasan al mismo esquema de
   destino que las tablas, y el diálogo lo dice.
9. **Dado** un modelo con dos esquemas, **cuando** elimino uno con el
   interruptor apagado, **entonces** el diálogo nombra el único destino posible
   y no ofrece elección.

---

### Edge Cases

- **Esquema repetido**: ¿qué pasa si el nombre técnico o la abreviatura ya
  existen? Error junto al campo, sin poder guardar (FR-018).
- **Único esquema**: eliminar el último esquema está permitido y deja el modelo
  en blanco; sus tablas se eliminan con él, porque no hay otro esquema al que
  moverlas (FR-005a, FR-035).
- **Tablas sin posición**: un modelo guardado sin posiciones se coloca de forma
  ordenada y determinista al abrirlo, sin marcar «Editado» (FR-013).
- **Posiciones imposibles**: coordenadas negativas, enormes o repetidas no dejan
  tablas inalcanzables: «Ajustar» siempre las trae a la vista (FR-011).
- **Color desconocido**: un esquema cuyo color no está en la paleta se dibuja con
  el color por defecto y se puede volver a elegir, sin tratar el archivo como
  inválido (FR-021).
- **Zona vacía arrastrada**: mover la zona de un esquema sin tablas marca el
  modelo «Editado» y guarda su posición; cuando ese esquema recibe tablas, la
  zona pasa a deducirse de ellas y la posición guardada deja de usarse
  (FR-026a).
- **Esquema vacío sin posición guardada**: un esquema sin tablas que nunca se
  movió se coloca de forma determinista a partir de su orden en el modelo, sin
  marcar «Editado» (FR-025).
- **Zonas solapadas guardadas**: un archivo cuyas posiciones dejan dos zonas
  encima la una de la otra se dibuja tal como está, sin recolocar nada: lo que el
  usuario guardó manda, y «Ajustar» sigue trayéndolo todo a la vista (FR-028,
  FR-011).
- **Destino único al eliminar**: al eliminar uno de dos esquemas con el
  interruptor apagado no hay nada que elegir: el diálogo nombra el esquema que
  recibirá las tablas y no muestra el selector (FR-036).
- **Zoom en los topes**: en el 40 % y en el 200 % los botones del tope quedan
  deshabilitados y el porcentaje no cambia (FR-008).
- **Modelo grande**: 50 tablas y 60 relaciones se recorren y se arrastran sin que
  el movimiento se note a saltos (SC-003).
- **Ventana pequeña**: con la ventana en su tamaño mínimo las cinco zonas siguen
  usables; la barra lateral y el inspector se pueden esconder para dejar sitio
  (FR-006).
- **Movimiento reducido**: con «Reducir movimiento» del sistema el centrado, el
  zoom y el ajuste llegan al resultado sin animación (FR-042).
- **Foco sobre un esquema eliminado**: si el esquema enfocado desaparece, el foco
  se quita solo (FR-032).

## Requirements *(mandatory)*

### Functional Requirements

**Estructura del Editor**

- **FR-001**: El Editor MUST mostrar cinco zonas con un trabajo cada una: barra
  lateral con el contenido del modelo, barra superior con las acciones del
  modelo y de la vista, lienzo, inspector de la selección y barra de estado
  (P-05).
- **FR-002**: La barra lateral MUST listar los esquemas del modelo con su color,
  su abreviatura y su número de tablas, y las tablas del modelo o las del
  esquema enfocado.
- **FR-003**: El inspector MUST mostrar los datos de la tabla seleccionada. Las
  tablas llegan con el Incremento 3, así que en este incremento el inspector
  MUST mostrar siempre la ficha del modelo: nombre, estado del archivo, ruta,
  motor y cuántos esquemas y tablas tiene. Enfocar o pulsar un esquema MUST NOT
  cambiar el inspector; los datos del esquema se editan en su diálogo
  (FR-020).
- **FR-004**: La barra de estado MUST mostrar el motor del modelo, el estado del
  archivo definido en el Incremento 1, el porcentaje de zoom y el número de
  esquemas y de tablas.
- **FR-005**: Con el modelo en blanco —sin esquemas y sin tablas—, el lienzo
  MUST mostrar la tarjeta «Empieza a diseñar tu modelo» con las filas «Crear la
  primera tabla», «Agregar un esquema» y «Definir un enum»; «Agregar un
  esquema» MUST abrir el diálogo Nuevo esquema.
- **FR-005a**: Un modelo recién creado MUST llegar en blanco: sin ningún
  esquema, tampoco uno por defecto del motor. Con el modelo en blanco el lienzo
  MUST NOT dibujar ninguna zona, y en cuanto haya un esquema o una tabla la
  tarjeta MUST desaparecer y el lienzo MUST dibujar lo que haya.
- **FR-006**: El sistema MUST permitir esconder y volver a mostrar la barra
  lateral y el inspector, con el lienzo ocupando el espacio liberado, y MUST
  recordar esa elección entre modelos y entre sesiones como preferencia de la
  aplicación, no del archivo.

**Navegar el lienzo**

- **FR-007**: El sistema MUST permitir mover la vista del lienzo arrastrando
  desde un espacio vacío, arrastrando con la rueda presionada y manteniendo
  Espacio mientras se arrastra; las dos últimas MUST funcionar también sobre una
  tabla o una zona.
- **FR-008**: El sistema MUST permitir cambiar el zoom entre 40 % y 200 % con ⌘ +
  rueda (Ctrl + rueda en Windows), con el pellizco del panel táctil y con los
  botones «−» y «+», MUST mostrar el porcentaje y MUST deshabilitar el botón del
  tope alcanzado.
- **FR-009**: Al hacer zoom con el puntero, el sistema MUST conservar bajo el
  puntero el punto del modelo que había debajo.
- **FR-009a**: El porcentaje de la barra de zoom MUST poder escribirse: pulsarlo
  MUST convertirlo en un campo con el valor actual dentro, Intro MUST aplicar lo
  escrito recortado a los topes de FR-008, y Esc MUST dejar el zoom como
  estaba.
- **FR-010**: El sistema MUST ofrecer «Ajustar», que MUST dejar visible todo el
  modelo con un margen, y con un modelo vacío MUST volver al 100 % centrado.
- **FR-011**: El sistema MUST garantizar que ninguna tabla queda inalcanzable:
  «Ajustar» MUST traer a la vista cualquier posición guardada en el archivo.
- **FR-012**: El sistema MUST mostrar un minimapa con la posición de todas las
  tablas y zonas y un recuadro del área visible, y MUST permitir mover la vista
  pulsando o arrastrando dentro de él.
- **FR-013**: El sistema MUST colocar de forma ordenada y determinista las tablas
  que el archivo no trae con posición, agrupadas por su esquema, y MUST NOT
  marcar el modelo como «Editado» por esa colocación.
- **FR-014**: La vista del lienzo (desplazamiento y zoom) MUST ser estado de la
  sesión: MUST NOT escribirse en el archivo del modelo. Al abrir un modelo la
  vista MUST arrancar al 100 % centrada en su contenido; solo «Ajustar» MUST
  cambiar el porcentaje.

**Crear y editar un esquema**

- **FR-015**: El sistema MUST permitir crear un esquema desde la barra lateral,
  la barra superior y la tarjeta del modelo vacío, con un diálogo propio.
- **FR-016**: Al escribir el nombre legible, el sistema MUST proponer el nombre
  técnico (minúsculas, números y guion bajo, sin empezar por número) y una
  abreviatura de tres letras mayúsculas, y MUST permitir cambiar los dos (RS-03,
  RS-04).
- **FR-017**: Cuando el usuario corrige a mano el nombre técnico o la
  abreviatura, el sistema MUST dejar de proponerlos y MUST conservar lo escrito.
- **FR-018**: El sistema MUST rechazar, con el error junto al campo y sin poder
  guardar: nombre técnico vacío o con forma inválida, nombre técnico repetido en
  el modelo, abreviatura que no son tres letras y abreviatura repetida en el
  modelo.
- **FR-019**: El sistema MUST ofrecer una paleta de colores con nombre y MUST
  mostrar una vista previa de la zona con el color elegido antes de guardar.
- **FR-020**: El sistema MUST permitir editar un esquema existente —nombre,
  nombre técnico, abreviatura, color y descripción— con las mismas reglas, y al
  confirmar MUST reflejarlo en el lienzo, la barra lateral y el inspector.
- **FR-021**: El sistema MUST guardar el color del esquema en el archivo del
  modelo como identificador de la paleta, y un identificador que no reconoce
  MUST caer al color por defecto sin invalidar el archivo.
- **FR-022**: Crear y editar un esquema MUST marcar el modelo «Editado» y MUST
  poder deshacerse y rehacerse con ⌘Z / ⇧⌘Z (Ctrl+Z / Ctrl+Y), diciendo en un
  aviso breve qué se deshizo (RS-06).

**Zonas de esquema**

- **FR-023**: El lienzo MUST dibujar cada esquema como una zona del color del
  esquema que rodea sus tablas con un margen, y MUST ajustarla sola cuando sus
  tablas se mueven o cambian de esquema.
- **FR-024**: Cada zona MUST mostrar la abreviatura, el nombre y el número de
  tablas del esquema.
- **FR-025**: Un esquema sin tablas MUST dibujarse como una zona de tamaño mínimo
  con el texto «Aún no hay tablas en este esquema».
- **FR-026**: El sistema MUST permitir arrastrar una zona, moviendo con ella
  todas sus tablas y conservando sus posiciones relativas; al soltar MUST marcar
  el modelo «Editado» y MUST escribir las posiciones nuevas al guardar.
- **FR-026a**: Arrastrar la zona de un esquema sin tablas MUST guardar su
  posición en el esquema, de modo que al reabrir el modelo la zona siga donde se
  dejó. Esa posición MUST ser un campo opcional del esquema, MUST escribirse solo
  cuando el esquema no tiene tablas y se ha movido, y MUST dejar de escribirse
  cuando el esquema vuelve a tener tablas, porque entonces la zona se deduce de
  ellas.
- **FR-027**: Mover una zona MUST poder deshacerse y rehacerse como un solo paso,
  devolviendo todas sus tablas a donde estaban (RS-06).
- **FR-028**: Al abrir un modelo cuyo archivo no trae posiciones, las zonas MUST
  NOT superponerse entre sí: la colocación determinista MUST dar a cada esquema su
  sitio. Las posiciones que el archivo sí trae MUST respetarse tal cual, también
  cuando dejan dos zonas solapadas, porque son las que el usuario guardó.

**Enfocar un esquema**

- **FR-029**: El sistema MUST permitir enfocar un esquema desde su nombre en la
  barra lateral, centrando el lienzo en su zona sin cambiar el porcentaje de
  zoom (FR-014).
- **FR-030**: Con un esquema enfocado, el sistema MUST atenuar las demás zonas y
  sus tablas, MUST filtrar la lista de tablas de la barra lateral a las de ese
  esquema y MUST decir en la interfaz cuál está enfocado.
- **FR-031**: El sistema MUST permitir quitar el foco con «Todos los esquemas»,
  con Esc en el lienzo y pulsando el fondo del lienzo sin arrastrarlo.
- **FR-032**: El foco MUST ser estado de la sesión: MUST NOT guardarse en el
  archivo, y MUST quitarse solo cuando el esquema enfocado desaparece o se cambia
  de modelo.

**Eliminar un esquema**

- **FR-033**: El sistema MUST ofrecer «Eliminar…» en el menú contextual del
  esquema, en la barra lateral y en su zona del lienzo.
- **FR-034**: Eliminar MUST pedir confirmación nombrando el esquema y cuántas
  tablas tiene, con el interruptor «Eliminar también sus tablas» apagado por
  defecto.
- **FR-035**: El sistema MUST permitir eliminar cualquier esquema, también el
  único del modelo, que entonces MUST dejar el modelo en blanco (FR-005a).
  Cuando no queda ningún esquema de destino, el diálogo MUST decir que las
  tablas se eliminan con él y MUST NOT ofrecer moverlas.
- **FR-036**: Con el interruptor apagado, confirmar MUST mover las tablas, los
  enums y las vistas del esquema al esquema de destino, que el diálogo MUST
  nombrar siempre. Cuando quedan dos o más esquemas, el diálogo MUST dejar
  elegir el destino y MUST proponer el primer esquema del modelo distinto del
  que se elimina; cuando queda uno solo, MUST nombrarlo sin ofrecer elección.
- **FR-037**: Eliminar un esquema MUST marcar el modelo «Editado» y MUST poder
  deshacerse como un solo paso, recuperando el esquema, su color y las tablas con
  sus posiciones (RS-06).

**Transversales**

- **FR-038**: Toda acción de este incremento alcanzable con el ratón MUST poder
  hacerse con el teclado, con foco visible, y los atajos MUST mostrarse con ⌘ en
  macOS y con Ctrl en Windows (RS-09, RS-12).
- **FR-039**: El lienzo MUST ser alcanzable con el teclado: mover la vista,
  cambiar el zoom, «Ajustar» y recorrer esquemas y tablas MUST tener su forma sin
  ratón.
- **FR-040**: Los esquemas y sus zonas MUST anunciarse a un lector de pantalla
  con su nombre, su abreviatura y su número de tablas, y el color MUST NOT ser el
  único portador de esa información.
- **FR-041**: Todo lo que este incremento añade MUST funcionar en tema claro y
  oscuro, con contraste de texto ≥ 4.5:1 en los dos (RS-11).
- **FR-042**: Con «Reducir movimiento» del sistema, centrar, hacer zoom y ajustar
  MUST llegar al resultado sin animación (RS-11).
- **FR-043**: Los textos de este incremento MUST estar en español, y los nombres
  técnicos MUST seguir las reglas del producto (RS-03, RS-12).
- **FR-044**: El archivo del modelo MUST seguir siendo la única fuente de verdad:
  las posiciones y los colores que este incremento cambia MUST viajar en el
  archivo, y leer, guardar y volver a leer un modelo MUST producir el mismo
  modelo. El campo de posición de esquema que este incremento añade MUST ser
  opcional, de modo que la versión del formato no cambia y los archivos ya
  guardados siguen siendo válidos.
- **FR-045**: Ninguna acción del lienzo MUST bloquear la interfaz: arrastrar,
  hacer zoom y ajustar MUST conservar la ventana respondiendo.

### Key Entities

- **Esquema**: agrupación con nombre legible, nombre técnico único, abreviatura
  de tres letras única, color de la paleta y descripción. Un modelo puede no
  tener ninguno: así nace y así queda si se eliminan todos (FR-005a). Es el objeto que este incremento crea, edita y elimina.
- **Zona de esquema**: la representación del esquema en el lienzo. Con tablas se
  deduce de ellas —su rectángulo envolvente con un margen—; sin tablas se dibuja
  con un tamaño mínimo en su posición guardada, o, si no tiene ninguna, en un
  sitio derivado de su orden en el modelo.
- **Posición de esquema**: las coordenadas opcionales de la zona de un esquema en
  el lienzo, que el archivo guarda solo mientras el esquema no tiene tablas
  (decidido en Clarifications). Es el único campo que este incremento añade al
  formato.
- **Posición de tabla**: las coordenadas de una tabla en el lienzo, que ya existen
  en el formato del archivo. Este incremento las lee, las mueve al arrastrar una
  zona y las escribe al guardar.
- **Vista del lienzo**: desplazamiento y zoom entre 40 % y 200 % con los que se
  mira el modelo. Estado de la sesión, nunca del archivo.
- **Foco de esquema**: qué esquema se está mirando en exclusiva, si alguno.
  Estado de la sesión que filtra la lista de tablas y atenúa el resto del lienzo.
- **Paleta de colores**: el conjunto fijo de colores con nombre que un esquema
  puede tomar; en el archivo se guarda el identificador, no el valor del color.
- **Disposición del Editor**: qué zonas están escondidas. Preferencia de la
  aplicación, no del modelo.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Desde un modelo abierto, crear un esquema toma como máximo tres
  pasos (abrir el diálogo, escribir el nombre, confirmar) y menos de 30 segundos
  para quien lo hace por primera vez.
- **SC-002**: Crear los tres esquemas de la demostración, moverlos por el lienzo
  y enfocar cada uno se completa sin ayuda externa en menos de 3 minutos.
- **SC-003**: Con un modelo de 50 tablas y 60 relaciones, arrastrar una zona,
  mover la vista y hacer zoom se ven continuos: el movimiento se mantiene a 60
  cuadros por segundo y ninguna interacción tarda más de 100 milisegundos en
  responder al primer gesto.
- **SC-004**: «Ajustar» deja visible el 100 % de las tablas y zonas del modelo en
  todos los casos probados, incluidas posiciones negativas y dispersas.
- **SC-005**: Enfocar un esquema deja su zona completa a la vista y centrada en
  menos de 1 segundo.
- **SC-006**: En 100 % de los casos probados, mover una zona, crear, editar o
  eliminar un esquema se deshace en un solo paso y devuelve el modelo
  exactamente al estado anterior.
- **SC-007**: En 100 % de los casos probados, guardar después de mover zonas y
  volver a abrir el modelo muestra el lienzo igual que se dejó.
- **SC-008**: 100 % de las acciones del incremento se pueden completar solo con
  el teclado, con foco visible en cada paso.
- **SC-009**: Los cuatro estados del incremento (modelo sin tablas, esquema sin
  tablas, nombre o abreviatura repetidos, y el único esquema del modelo, que al
  eliminarse se lleva sus tablas) muestran un mensaje visible y al menos una
  salida clara.
- **SC-010**: El Editor con sus cinco zonas, el diálogo de esquema y la
  confirmación de eliminar se revisan en tema claro, tema oscuro y con movimiento
  reducido sin texto de contenido por debajo de 4.5:1 de contraste, y sin
  metadatos de 10 u 11 px por debajo de 3:1. El segundo umbral es un desvío
  deliberado: el tercer gris de la línea gráfica (`--label-tertiary`) no alcanza
  4.5:1 sobre los rellenos de la barra lateral sin volverse el segundo gris, y
  son datos de apoyo —el contador de tablas, la abreviatura de la fila y la
  línea «VEN · 2 campos»— que siempre están escritos también en el nombre
  accesible del control.

  Medido el 2026-10-27 con la aplicación en marcha, en los dos temas y en los
  tres sitios: el mínimo del texto de contenido es 5.6:1 y el de los metadatos,
  3.06:1 en claro y 3.27:1 en oscuro.

## Assumptions

- **Diseño visual**: el Editor y sus piezas siguen el lienzo «SQL Designer ·
  Diseño de Pantallas» (`Editor`, P-05, y los componentes de diálogo, menú
  contextual y confirmación), y los componentes y tokens vienen del sistema de
  diseño «Aura». El lienzo es referencia de diseño, no base de código
  (constitución, puerta 6).
- **Las tablas solo se dibujan en este incremento** (decidido en
  Clarifications): el lienzo pinta las tablas que trae el archivo para que las
  zonas las rodeen y el minimapa las sitúe, pero crear, editar, eliminar, mover
  una tabla sola y cambiarle el esquema arrastrándola a otra zona llegan en el
  Incremento 3. «Crear la primera tabla» y «Definir un enum» de la tarjeta del
  modelo vacío siguen siendo informativas, como en el Incremento 1; «Agregar un
  esquema» sí abre su diálogo.
- **Las relaciones todavía no se dibujan**: el archivo las conserva, pero las
  líneas entre tablas pertenecen al incremento de tablas y relaciones.
- **La zona se deduce de las tablas, salvo sin tablas** (decidido en
  Clarifications): la zona de un esquema con tablas es el rectángulo que las
  envuelve, y no se guarda. La de un esquema sin tablas sí se guarda, en un campo
  opcional de posición del esquema, para que lo que el usuario mueve se quede
  donde lo dejó; mientras ese esquema no se haya movido, la zona se coloca de
  forma determinista a partir de su orden en el modelo. El campo es opcional, de
  modo que los archivos ya guardados siguen siendo válidos y la versión del
  formato no sube.
- **Un color por esquema**: la paleta es un conjunto fijo de identificadores de
  token (el campo `color` que el formato ya reserva); no hay color libre ni
  selector hexadecimal.
- **El usuario elige el esquema de destino al eliminar** (decidido en
  Clarifications): con el interruptor apagado y varios esquemas restantes el
  diálogo deja elegir y propone el primero del modelo distinto del que se
  elimina; con un solo destino posible lo nombra sin selector.
- **Deshacer**: se reutiliza el historial del Incremento 1, que ya cubre el
  renombrado del modelo; este incremento añade sus propios pasos con etiqueta
  (RS-06).
- **Topes del zoom**: 40 % y 200 % son los del enunciado; los pasos de los
  botones y de la rueda son decisión de diseño dentro de ese rango.
- **Sin red ni servicios**: todo ocurre sobre el modelo en memoria y su archivo
  local (constitución, principio I).
- **Rendimiento medido en desarrollo**: las cifras de SC-003 se miden sobre la
  compilación de depuración como las de los incrementos anteriores; la medida
  sobre un binario empaquetado sigue siendo tarea abierta del Incremento 0.

## Dependencies

- **Incremento 1 (`specs/002-archivos-modelo`)**: crear, abrir, guardar y cerrar
  modelos, el estado del archivo («Guardado · <motor>» / «Editado»), el
  historial de deshacer, el almacén único del modelo y el formato `.yaml`
  versión 1 con `schemas[].color` y `tables[].position` ya reservados.
- **Incremento 0 (`specs/001-base-aplicacion`)**: ventana propia, temas claro y
  oscuro, preferencias y atajos.
- **Formato del modelo**: este incremento escribe `schemas[].color` y
  `tables[].position`, que el formato versión 1 ya declara, y añade la posición
  opcional de la zona de un esquema sin tablas; al ser opcional, la versión del
  formato no cambia.
- **Incremento 3 (tablas y relaciones)**: hereda de aquí el lienzo, las zonas y
  el foco, y es quien añade crear y arrastrar tablas y dibujar relaciones.
