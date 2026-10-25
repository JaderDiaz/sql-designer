# Feature Specification: Base de la aplicación (Incremento 0)

**Feature Branch**: `001-base-aplicacion`

**Created**: 2026-10-24

**Status**: Draft

**Input**: User description: "Incremento 0 · Base de la aplicación. Objetivo: la aplicación abre en Windows y macOS y muestra la Bienvenida con su identidad. Depende de: nada. Se demuestra: abrir la app, cambiar el tema y ver la Bienvenida en ambos sistemas. SF-0.1 Abrir la aplicación en la Bienvenida; SF-0.2 Tema claro y oscuro; SF-0.3 Ventana y desplazamiento."

## Clarifications

### Session 2026-10-24

- Q: ¿Qué debe incluir la ventana de Ajustes en este incremento? (FR-008) → A: Solo la preferencia de tema (Sistema, Claro, Oscuro)
- Q: ¿Debe la aplicación recordar el tamaño y la posición de su ventana entre sesiones? (FR-013) → A: Sí: recuerda tamaño y posición, y las corrige si no caben en los monitores conectados
- Q: ¿De dónde sale la fecha que acompaña a la versión, la «(2026.10.24)» de «1.0.0 (2026.10.24)»? (FR-002) → A: Fecha de compilación, inyectada al empaquetar la app
- Q: Cuando la aplicación falla al arrancar o no puede leer sus preferencias, ¿debe dejar constancia en algún sitio que el usuario pueda enviarte? (FR-016) → A: Sí: archivo de registro local en la carpeta de datos de la app, y la app sigue arrancando
- Q: ¿Cómo se abre la ventana de Ajustes en este incremento, si todavía no existe el Editor con su barra superior? (FR-008, FR-014) → A: Atajo ⌘, / Ctrl+, más entrada en el menú nativo y un control visible en la Bienvenida

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Abrir la aplicación en la Bienvenida (Priority: P1)

Quien abre SQL Designer por primera vez ve una pantalla de inicio que dice qué
aplicación es, en qué versión está y qué puede hacer a continuación: empezar un
modelo nuevo o abrir uno existente. También puede decidir que esa pantalla no
vuelva a aparecer al abrir.

**Why this priority**: es la única pantalla que existe en este incremento y la
puerta de entrada de todo el producto. Sin ella no hay nada que demostrar.

**Independent Test**: se prueba abriendo la aplicación en Windows y en macOS y
comprobando identidad, versión, acciones con sus atajos y el efecto de la casilla
«Mostrar esta ventana al abrir» tras reiniciar.

**Acceptance Scenarios**:

1. **Dado** que abro la aplicación, **cuando** termina de cargar, **entonces** veo la
   Bienvenida con el icono de la app, el nombre «SQL Designer» y la versión con la fecha
   de compilación, en el formato «1.0.0 (2026.10.24)».
2. **Dado** que estoy en la Bienvenida, **entonces** veo las acciones «Nuevo modelo…» y
   «Abrir modelo…», cada una con su atajo visible (⌘N y ⌘O en macOS; Ctrl+N y Ctrl+O
   en Windows).
3. **Dado** que estoy en la Bienvenida, **cuando** recorro la pantalla solo con el
   teclado, **entonces** puedo alcanzar y activar las dos acciones y la casilla, con
   foco visible en cada paso.
4. **Dado** que desmarco «Mostrar esta ventana al abrir», **cuando** cierro y vuelvo a
   abrir la aplicación, **entonces** la aplicación no se detiene en la Bienvenida y
   abre el último modelo usado; si no hay último modelo registrado o su archivo ya no
   está disponible, muestra la Bienvenida y la casilla sigue desmarcada.
5. **Dado** que la casilla está desmarcada, **cuando** llego a la Bienvenida por la vía
   anterior, **entonces** puedo volver a marcarla y al siguiente arranque la Bienvenida
   aparece de nuevo.

---

### User Story 2 - Tema claro y oscuro (Priority: P2)

Quien usa la aplicación la ve en el mismo tema que su sistema operativo, y puede
forzar claro u oscuro desde Ajustes sin reiniciar.

**Why this priority**: el tema afecta a cada pantalla posterior; fijarlo ahora evita
rehacer componentes más adelante. Es la segunda mitad de la demostración del
incremento.

**Independent Test**: se prueba poniendo el sistema en oscuro y abriendo la app, y
después cambiando el tema en Ajustes con la Bienvenida a la vista.

**Acceptance Scenarios**:

1. **Dado** que mi sistema está en tema oscuro, **cuando** abro la aplicación,
   **entonces** se muestra en tema oscuro (RS-11).
2. **Dado** que mi sistema está en tema claro, **cuando** abro la aplicación,
   **entonces** se muestra en tema claro (RS-11).
3. **Dado** que estoy en la Bienvenida, **cuando** uso el atajo ⌘, (Ctrl+, en Windows),
   la entrada del menú nativo o el control visible de la pantalla, **entonces** se abre
   Ajustes en los tres casos.
4. **Dado** que cambio el tema en Ajustes a Claro, Oscuro o Sistema, **entonces** toda
   la aplicación cambia de inmediato y sin reiniciar, y la pantalla conserva su estado
   (casilla, foco y posición de desplazamiento).
5. **Dado** que elegí Claro u Oscuro en Ajustes, **cuando** cambio el tema de mi sistema
   operativo, **entonces** la aplicación mantiene lo que elegí; con la opción Sistema,
   la aplicación sigue el cambio.
6. **Dado** que elegí un tema, **cuando** cierro y vuelvo a abrir la aplicación,
   **entonces** esa elección se conserva.
7. **Dado** que mi sistema pide reducir el movimiento, **entonces** las transiciones de
   la aplicación se desactivan o se acortan (RS-11).

---

### User Story 3 - Ventana y desplazamiento estables (Priority: P3)

Quien usa la aplicación tiene una ventana que se comporta como las demás de su
sistema, y contenido que no se desordena cuando no cabe.

**Why this priority**: es la regla estructural que heredan todas las pantallas
siguientes (RS-01); se verifica sobre la única pantalla disponible.

**Independent Test**: se prueba reduciendo la ventana hasta que el contenido no cabe y
comprobando que los controles de ventana están donde los pide el diseño y hacen lo que
dicen.

**Acceptance Scenarios**:

1. **Dado** que estoy en cualquier pantalla, **cuando** su contenido no cabe,
   **entonces** se desplaza solo la sección que lo necesita y el resto de la ventana se
   queda quieto; la ventana completa no se desplaza (RS-01).
2. **Dado** cualquiera de los dos sistemas, **entonces** los controles de cerrar y
   minimizar están arriba a la izquierda, en el sitio que marca el diseño, y cada uno
   hace lo que dice.
3. **Dado** que la Bienvenida no se maximiza, **entonces** no hay control de maximizar.
4. **Dado** cualquiera de los dos sistemas, **cuando** arrastro una zona libre de la
   barra lateral o de la cabecera, **entonces** la ventana se mueve.
5. **Dado** que redimensiono la ventana por debajo de su tamaño mínimo, **entonces** la
   ventana no permite reducirse más y el contenido sigue legible, sin recortes ni
   superposiciones.
6. **Dado** que moví y redimensioné la ventana, **cuando** cierro y vuelvo a abrir la
   aplicación, **entonces** la ventana reaparece con ese tamaño y en esa posición; si esa
   posición ya no cabe en los monitores conectados, aparece completa dentro del área
   visible.

---

### Edge Cases

- **Sin último modelo**: la casilla está desmarcada y nunca se abrió un modelo. La
  aplicación muestra la Bienvenida.
- **Último modelo no disponible**: el archivo registrado se movió, se borró o está en
  una unidad desconectada. La aplicación muestra la Bienvenida y no bloquea el
  arranque; el aviso detallado del archivo corresponde al Incremento 1.
- **Preferencias ilegibles**: el archivo de preferencias está corrupto o vacío. La
  aplicación arranca con los valores por defecto (tema Sistema, Bienvenida visible),
  deja la causa en el registro local y no pierde el arranque.
- **Tema del sistema cambia mientras la app está abierta**: con la opción Sistema, la
  aplicación cambia en caliente; con Claro u Oscuro, no.
- **Pantalla pequeña o escalado alto**: la ventana se abre dentro del área visible del
  monitor; si el contenido no cabe, se desplaza la sección y no la ventana.
- **Segundo monitor desconectado**: la posición recordada queda fuera de los monitores
  conectados; la ventana vuelve al monitor principal en lugar de abrirse fuera de la
  pantalla.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: La aplicación MUST arrancar en Windows y en macOS y mostrar la Bienvenida
  como primera pantalla cuando la preferencia «Mostrar esta ventana al abrir» está
  activada.
- **FR-002**: La Bienvenida MUST mostrar el icono de la aplicación, el nombre «SQL
  Designer» y la versión con fecha en el formato «MAYOR.MENOR.PARCHE (AAAA.MM.DD)», por
  ejemplo «1.0.0 (2026.10.24)». La fecha MUST ser la de compilación, inyectada al
  empaquetar la aplicación, y MUST NOT escribirse a mano en el código de la pantalla.
- **FR-003**: La Bienvenida MUST ofrecer las acciones «Nuevo modelo…» y «Abrir modelo…»
  con su atajo visible junto a cada una, mostrado con los símbolos del sistema en uso
  (⌘ en macOS, Ctrl en Windows) (RS-12).
- **FR-004**: En este incremento las acciones «Nuevo modelo…» y «Abrir modelo…» MUST
  estar presentes y alcanzables, y declarar que su flujo llega en el Incremento 1; no
  crean ni abren archivos todavía.
- **FR-005**: La Bienvenida MUST ofrecer la casilla «Mostrar esta ventana al abrir» y
  MUST conservar su valor entre sesiones.
- **FR-006**: Con la casilla desmarcada, la aplicación MUST abrir el último modelo
  usado al arrancar; si no hay último modelo registrado o su archivo no está
  disponible, MUST mostrar la Bienvenida sin perder la preferencia.
- **FR-007**: La aplicación MUST seguir el tema claro u oscuro del sistema operativo
  cuando la preferencia de tema es «Sistema» (RS-11).
- **FR-008**: Ajustes MUST permitir elegir entre tema Sistema, Claro y Oscuro, y el
  cambio MUST aplicarse a toda la aplicación sin reiniciar y sin perder el estado de la
  pantalla visible. En este incremento Ajustes MUST contener únicamente esa preferencia;
  ninguna otra opción aparece todavía, ni deshabilitada ni como sección vacía.
- **FR-009**: La preferencia de tema MUST conservarse entre sesiones, y una elección
  explícita de Claro u Oscuro MUST ignorar los cambios de tema del sistema.
- **FR-010**: Toda animación o transición MUST desactivarse o acortarse cuando el
  sistema pide reducir el movimiento (RS-11).
- **FR-011**: Cuando el contenido de una sección no cabe, MUST desplazarse solo esa
  sección; la ventana MUST NOT desplazarse ni crecer para acomodar contenido (RS-01).
- **FR-012**: La ventana MUST llevar controles propios de cerrar y minimizar, arriba a
  la izquierda en los dos sistemas, en la posición que marca el diseño, y MUST poder
  moverse arrastrando una zona libre. La Bienvenida MUST NOT ofrecer maximizar.
- **FR-013**: La ventana MUST tener un tamaño mínimo por debajo del cual no se puede
  reducir, y MUST abrirse dentro del área visible de un monitor conectado.
- **FR-014**: Toda acción y control de la Bienvenida y de Ajustes MUST ser alcanzable y
  activable con el teclado, con foco visible (RS-09).
- **FR-015**: Los textos de la interfaz MUST estar en español (RS-12).
- **FR-016**: Si las preferencias guardadas no se pueden leer, la aplicación MUST
  arrancar con los valores por defecto (tema Sistema, Bienvenida visible) y MUST NOT
  impedir el arranque.
- **FR-017**: La aplicación MUST funcionar sin conexión de red y MUST NOT requerir
  credenciales ni enviar datos de uso.
- **FR-018**: La aplicación MUST recordar el tamaño y la posición de la ventana entre
  sesiones, y al restaurarlos MUST corregirlos cuando no caben en los monitores
  conectados, dejando la ventana completa dentro del área visible y nunca por debajo de
  su tamaño mínimo. No se recuerda si la ventana quedó maximizada o en pantalla
  completa.
- **FR-019**: La aplicación MUST registrar los fallos de arranque y los errores al leer
  o escribir las preferencias en un archivo de registro local, dentro de la carpeta de
  datos de la aplicación, con fecha y descripción por entrada. El registro MUST quedar
  solo en el equipo —nada se envía a ningún servicio— y un fallo al escribirlo MUST NOT
  impedir el arranque.
- **FR-020**: Ajustes MUST poder abrirse de tres formas: con el atajo ⌘, en macOS y
  Ctrl+, en Windows, desde la entrada correspondiente del menú nativo de la aplicación,
  y desde un control visible en la Bienvenida. El atajo y el menú MUST funcionar aunque
  la Bienvenida no esté a la vista.

### Key Entities

- **Preferencias de la aplicación**: ajustes que sobreviven al cierre; en este
  incremento, el tema elegido (Sistema, Claro u Oscuro), la preferencia «Mostrar esta
  ventana al abrir», el tamaño y la posición de la ventana, y la referencia al último
  modelo usado. Son del usuario y de la instalación, no de ningún modelo.
- **Identidad de la aplicación**: nombre visible «SQL Designer», icono y versión con la
  fecha de compilación, mostrados en la Bienvenida y en los metadatos de la ventana. La
  versión y la fecha vienen del empaquetado, no de la pantalla.
- **Último modelo usado**: referencia al archivo de modelo abierto más recientemente;
  en este incremento solo se guarda y se lee, nunca se crea desde la app.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: La aplicación muestra la Bienvenida lista para usar en 2 segundos o menos
  desde el arranque, en Windows y en macOS.
- **SC-002**: Quien abre la aplicación por primera vez identifica qué es y sus dos
  acciones siguientes sin ayuda externa, en 10 segundos o menos.
- **SC-003**: El cambio de tema en Ajustes se refleja en toda la pantalla visible en 1
  segundo o menos, sin reiniciar y sin perder el estado de la pantalla.
- **SC-004**: El 100 % de las acciones y controles de la Bienvenida y de Ajustes se
  pueden alcanzar y activar solo con el teclado.
- **SC-005**: A 1920 × 1080 la ventana completa no se desplaza en ninguna pantalla; el
  desplazamiento ocurre únicamente dentro de la sección que no cabe, en el 100 % de los
  casos probados.
- **SC-006**: El texto de la Bienvenida y de Ajustes alcanza un contraste de 4.5:1 o
  mejor en los dos temas.
- **SC-007**: Tras elegir tema y estado de la casilla, el 100 % de los arranques
  siguientes respeta ambas elecciones.
- **SC-008**: Con las preferencias dañadas o ausentes, el 100 % de los arranques
  termina en una pantalla usable y no en un error.
- **SC-009**: La aplicación arranca y funciona con la red desconectada, sin ninguna
  función degradada.
- **SC-010**: El 100 % de los fallos de arranque y de los errores de preferencias deja
  una entrada fechada en el registro local, recuperable sin herramientas de desarrollo.

## Assumptions

- **La casilla vive en la Bienvenida**: «Mostrar esta ventana al abrir» se controla
  desde la propia Bienvenida, como indica el catálogo de pantallas (P-01).
- **FR-006 se demuestra parcialmente aquí**: sin crear ni abrir modelos (Incremento 1)
  no existe «último modelo usado», así que en este incremento se verifica que la
  preferencia se guarda y se lee, y que el arranque sin último modelo cae en la
  Bienvenida. El salto directo al último modelo se verifica en cuanto el Incremento 1
  permita abrir uno.
- **Sin lista de recientes**: la Bienvenida de este incremento no muestra recientes; la
  lista aparece cuando hay modelos que listar (Incremento 1).
- **Tamaño de referencia**: los artboards del diseño se dibujan sobre un monitor
  simulado de 1920 × 1080 (RS-01); la ventana de la Bienvenida es la pieza de 820 × 500
  que aparece centrada en ellos, y ese es a la vez su tamaño por defecto y su mínimo.
- **Idioma**: la interfaz es en español y los símbolos de atajo se adaptan al sistema
  (RS-12).
- **Un solo modelo a la vez**: la aplicación no abre varias ventanas de modelo en
  paralelo.

## Dependencies

- **Depende de**: nada. Es el primer incremento.
- **Habilita**: Incremento 1 (crear, abrir y guardar modelos), que añade a la
  Bienvenida la lista de recientes y da contenido real a «Nuevo modelo…» y «Abrir
  modelo…».

## Out of Scope

- Crear, abrir, guardar o renombrar modelos, y la lista de recientes con sus estados
  («Editado», «No encontrado», archivo con errores) → Incremento 1.
- El Editor, el lienzo, el diccionario, tablas, esquemas, enums y relaciones →
  Incrementos 2 y siguientes.
- Exportar SQL, imagen, diccionario o YAML → Incremento 9.
- La revisión automática de diseño y sus advertencias → Incremento 8.
- Paleta de comandos, menús contextuales del modelo y atajos del Editor → Incrementos 6
  y 10.
- El resto de preferencias de Ajustes, incluidas las convenciones de nombres y el motor
  por defecto.
