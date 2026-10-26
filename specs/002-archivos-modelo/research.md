# Fase 0 · Investigación (Incremento 1 · Archivos de modelo)

Cada entrada resuelve una incógnita del Technical Context de `plan.md`. Formato:
decisión, razón, alternativas descartadas.

## R1 · El YAML se parsea y se escribe en TypeScript, no en Rust

**Decisión**: Rust lee y escribe **bytes** del archivo del modelo; TypeScript posee
la gramática YAML con la librería `yaml` (eemeli), versión 2.9.

**Razón**: el principio IV exige un solo juego de tipos del modelo, compartido por
editor, generador y serializador, y el generador SQL de los incrementos siguientes
vive en TypeScript. Parsear en Rust obligaría a mantener las mismas estructuras dos
veces y a traducir entre ellas en cada cambio del formato. Además, el error de un
archivo roto tiene que decir la línea (FR-016) y `yaml` da `range` por nodo y
`linePos()` para convertir el desplazamiento en línea y columna.

**Alternativas descartadas**:

- `serde_yaml` en Rust: duplica los tipos del modelo y rompe el principio IV; el
  crate además está sin mantenimiento activo desde 2024.
- `js-yaml`: los errores traen `mark.line`, pero no expone el árbol con rangos por
  nodo, así que un campo inválido en la línea 87 no se puede señalar con precisión.

## R2 · Validación a mano sobre el árbol de `yaml`, sin zod

**Decisión**: `src/lib/model/validate.ts` recorre el documento ya parseado campo a
campo y devuelve una lista de errores con `path`, `message`, `line` y `column`.

**Razón**: la precisión del mensaje es un requisito visible (FR-016 y el diálogo de
error del lienzo: «Línea 42: se esperaba “:” después de “tablas”»). Un validador de
esquemas devuelve la ruta del campo pero pierde la posición en el texto, que es lo
que el usuario necesita para arreglar el archivo en un editor. Es el mismo patrón
que `preferences.rs` ya usa en Rust: validar campo a campo y decir la causa.

**Alternativas descartadas**: zod o ajv — dependencia nueva, mensajes en inglés y
sin número de línea; habría que mapear a mano la ruta del error al nodo del AST, que
es justo el trabajo que se quería evitar.

## R3 · Ida y vuelta: modelo tipado completo y validación estricta

**Decisión**: el tipo del modelo cubre el formato `1` entero. Al cargar, una clave
desconocida es un error de validación con su línea (archivo con errores), no un
campo que se ignora. Al guardar se serializa el modelo en memoria completo, con
orden de claves estable.

**Razón**: así la ida y vuelta de la puerta 3 (FR-023, SC-004) es exacta por
construcción y la salida deriva del modelo en memoria, como exige el principio II.
Una versión futura del formato no llega aquí: la corta `formatVersion` (FR-025).

**Alternativas descartadas**:

- Parchear el `Document` de `yaml` y re-serializarlo (conserva comentarios y orden
  original): tentador para no perder nada, pero la salida dejaría de derivar del
  modelo en memoria, que es el principio II, y el parche se volvería imposible
  cuando el Editor empiece a reorganizar tablas.
- Ignorar las claves desconocidas: un archivo escrito a mano con un error de
  tecleo («tabals:») se abriría en silencio como un modelo vacío.

## R4 · Escritura atómica y sello de obsolescencia

**Decisión**: `model_write` escribe en un archivo temporal del **mismo directorio**
y renombra sobre el destino (el patrón que ya usa `preferences::save_to`). Cada
lectura y cada escritura devuelven un sello `{ modifiedMs, sizeBytes }`, y
`model_write` recibe el sello esperado: si el del disco no coincide, no escribe y
devuelve `model_stale`.

**Razón**: el renombrado en el mismo volumen es atómico en macOS y en Windows, así
que un fallo a mitad no deja el archivo anterior truncado (FR-022). El sello resuelve
FR-025 sin vigilar el archivo: basta comparar en el momento de escribir, que es el
único instante en el que se puede destruir trabajo ajeno.

**Alternativas descartadas**:

- Hash del contenido: más exacto ante un sistema de archivos con mtime de baja
  resolución, pero obliga a releer el archivo entero en cada guardado.
- Vigilar el archivo con un *watcher*: trae una dependencia y un hilo nuevos para
  avisar de algo que solo importa al guardar.

## R5 · Recientes: `recents.json` en Rust con revalidación perezosa

**Decisión**: Rust posee `recents.json` en el directorio de configuración, con la
misma estrategia de recuperación que `preferences.json` (copia `.bak`, valores por
defecto, causa al registro). Guarda como máximo 10 entradas con los campos
cacheados `path`, `name`, `engine`, `tables`, `usedAtMs` y el sello de la última
lectura. `recents_list` añade, para cada entrada, el estado del archivo en disco
(`exists`, `modifiedMs`, `sizeBytes`). El frontend pinta de inmediato lo cacheado y,
después del primer fotograma, revalida en segundo plano las entradas cuyo sello
cambió: las que no parsean pasan a «Archivo con errores».

**Razón**: la lista de recientes es de Rust por el principio III. Pintar la
Bienvenida no puede esperar a parsear hasta diez archivos (FR-040), pero las marcas
«No encontrado» y «Archivo con errores» tienen que verse antes de intentar abrir
(FR-031): el caché más el `stat` cubren el caso normal y la revalidación corrige el
resto sin bloquear.

**Alternativas descartadas**:

- Parsear los diez archivos al arrancar: arranque proporcional al tamaño de los
  modelos, justo en la pantalla que mide SC-001.
- Guardar los recientes dentro de `preferences.json`: mezcla una lista que cambia en
  cada apertura con las preferencias del usuario, y una corrupción se llevaría las
  dos cosas.

## R6 · Ubicaciones preguntadas al sistema

**Decisión**: `fs_user_places` devuelve, y solo si existen: Recientes (virtual, sin
ruta), Escritorio, Documentos, Descargas, Inicio, iCloud Drive (solo macOS, si
`~/Library/Mobile Documents/com~apple~CloudDocs` está presente) y la raíz del
volumen («Macintosh HD» en macOS, la unidad del sistema en Windows). Cada
ubicación trae `id`, `label`, `icon`, `path` y si admite crear carpetas.

**Razón**: el principio III prohíbe que el frontend suponga rutas, y mostrar
carpetas que no existen es un estado muerto. Las rutas salen del resolvedor de
Tauri, que ya conoce las carpetas del usuario en los dos sistemas.

**Alternativas descartadas**: copiar la lista del mock del lienzo («Proyectos»,
«iCloud Drive» fijos) — son datos de maqueta, y la puerta 6 dice que el prototipo es
referencia de diseño, no base de código. Queda anotado como desvío en `plan.md`.

## R7 · Papelera con el crate `trash`

**Decisión**: `trash_move` usa el crate `trash` 5.x, única dependencia nueva de
Rust.

**Razón**: Tauri 2 no expone la papelera. El crate la implementa con la API nativa
de cada sistema (Finder en macOS, `IFileOperation` en Windows), devuelve error en
vez de borrar cuando no hay papelera disponible, y el archivo se puede recuperar,
que es lo que promete el diálogo (FR-035, RS-08).

**Alternativas descartadas**:

- `osascript -e 'tell application "Finder" to delete …'` en macOS y PowerShell en
  Windows: depende de que Finder responda, es lento y falla en silencio.
- Borrar el archivo: incumple RS-08, que exige poder recuperarlo.

**Riesgo operativo**: en este entorno crates.io no respondió al preparar el plan y la
caché local no tiene el crate. La primera tarea de la fase de backend debe ejecutar
`cargo fetch` con red disponible antes de tocar código; si no la hay, el incremento
se bloquea en esa acción, no a mitad de la implementación.

## R8 · Revelar en el gestor y portapapeles sin dependencias nuevas

**Decisión**: dos comandos de Rust con `std::process::Command`:

- `reveal_in_file_manager`: `open -R <ruta>` en macOS, `explorer /select,<ruta>` en
  Windows.
- `clipboard_write_text`: `pbcopy` en macOS, `powershell -NoProfile -Command
  Set-Clipboard` en Windows.

**Razón**: resuelven «Mostrar en Finder/Explorador» (FR-016) y «Copiar ruta»
(FR-034) sin añadir dos plugins de Tauri ni sus permisos. `navigator.clipboard` se
descarta porque escribir en el portapapeles desde el webview depende de gesto de
usuario y de contexto seguro, y el principio III pone el sistema operativo en Rust.

**Alternativas descartadas**: `tauri-plugin-opener` y
`tauri-plugin-clipboard-manager` — dos dependencias y dos permisos nuevos para dos
llamadas de una línea; `arboard` — un crate más para lo mismo.

## R9 · Las rutas se construyen en Rust

**Decisión**: `path_build_model({ folder, fileStem })` devuelve `{ path, fileName,
exists }`. El frontend nunca concatena separadores ni añade la extensión.

**Razón**: principio III, literal: el frontend no asume rutas ni separadores. Además
la comprobación «ya existe ese archivo en la carpeta» (FR-003) tiene que mirar el
disco, que es trabajo de Rust, y hacerlo en el mismo comando evita dos viajes por
cada tecla escrita.

**Alternativas descartadas**: montar la ruta en TypeScript con `/` y comprobar la
existencia aparte — rompe en Windows y duplica las llamadas.

## R10 · El nombre de archivo se deriva en TypeScript

**Decisión**: `src/lib/model/slug.ts` convierte «Livy · Reservas» en
`livy-reservas`: normalización NFD, se quitan los diacríticos, minúsculas, todo lo
que no sea `a-z0-9` pasa a `-`, se colapsan y recortan los guiones, y el resultado se
limita a 80 caracteres. La función también detecta el resultado vacío y los nombres
reservados de Windows (`con`, `prn`, `aux`, `nul`, `com1`–`com9`, `lpt1`–`lpt9`), que
se prefijan con `modelo-`.

**Razón**: la ruta final se muestra mientras el usuario escribe (FR-002), así que la
derivación tiene que ser síncrona y pura; es además la función más fácil de probar de
todo el incremento. Rust solo la usa como texto ya saneado para armar la ruta.

**Alternativas descartadas**: derivar en Rust en cada tecla — un viaje por pulsación
para un cálculo de cadenas; dejar el nombre tal cual con espacios y acentos —
incumple RS-03 y produce rutas que otras herramientas manejan mal.

**Descubrimiento**: dos nombres distintos («Livy · Reservas» y «livy reservas») dan
el mismo archivo; es el caso borde ya anotado en el spec, y lo detecta la propia
comprobación de existencia de `path_build_model`.

## R11 · Un solo almacén Zustand con slices

**Decisión**: nace `src/store/index.ts` con `useAppStore`, compuesto por cinco
creadores de slice: `preferences` (el actual, refactorizado), `navigation`, `model`,
`recents` y `browser`. Los componentes siguen leyendo por selectores.

**Razón**: el principio IV pide un almacén único. El Incremento 0 solo necesitaba
preferencias, pero este incremento añade cuatro dominios de estado y crear cuatro
`create()` sueltos serían cinco almacenes paralelos.

**Coste**: hay que actualizar los componentes y pruebas del Incremento 0 que importan
`usePreferencesStore` (`App.tsx`, `WelcomeScreen`, `ShowWelcomeToggle`,
`WelcomeActions`, `PreferencesWindow`, `Titlebar` y sus pruebas). Es un cambio
mecánico de nombre y selector, sin cambio de comportamiento; va en su propia tarea,
antes de las pantallas nuevas.

**Alternativas descartadas**: varios almacenes independientes (más simple de escribir,
pero deja el estado del modelo y el de navegación sin un punto único y contradice el
principio IV); mantener `usePreferencesStore` como alias (dos nombres para la misma
cosa, que es lo que envejece mal).

## R12 · Navegación entre pantallas en el almacén

**Decisión**: el slice `navigation` guarda `screen` (`'welcome' | 'editor'`) y
`dialog` (`null | 'new-model' | 'choose-folder' | 'open-model' | 'rename' |
'confirm-close' | 'file-error' | 'not-found' | 'trash'`). `App.tsx` elige la pantalla
y monta el diálogo activo; `Elegir carpeta` se abre encima de `Nuevo modelo`, como en
el lienzo, conservando el borrador.

**Razón**: no hay enrutador ni URLs en una app de escritorio de una ventana; el
estado de pantalla es estado de aplicación, y tenerlo en el almacén permite que los
atajos y los diálogos lo cambien sin pasar props por tres niveles.

**Alternativas descartadas**: React Router (dependencia y conceptos web que no
aportan aquí); estado local en `App.tsx` (los atajos y el almacén tendrían que
subirlo de todos modos).

## R13 · Componentes nuevos del sistema de diseño

**Decisión**: se añaden a `src/components/ui/`, puros y sobre Radix donde haya
comportamiento: `TextField` (con etiqueta, pista y error), `SearchField` (variante de
búsqueda), `Select` (sobre `@radix-ui/react-select`, para el formato en Abrir
modelo), `Sidebar` (lista de ubicaciones con secciones), `FileList` (listbox de
filas con nombre, fecha y estado deshabilitado) y `ContextMenu` (sobre
`@radix-ui/react-context-menu`, con apertura por ⇧F10 y por la tecla de menú).

**Razón**: el principio V prohíbe reimplementar foco, rol ARIA o navegación de
teclado, y RS-09 exige que todo el menú contextual se use con el teclado. Radix da
ambas cosas; `FileList` se construye sobre el patrón `listbox` nativo porque Radix no
tiene un equivalente y la semántica es la de una lista de selección única.

**Alternativas descartadas**: un `<select>` nativo (no se puede estilar con los tokens
en WebView2 ni mostrar la descripción del formato); menú contextual propio (foco y
flechas a mano, prohibido por el principio V).

## R14 · Pruebas

**Decisión**:

- **Frontend**: Vitest con los comandos de Tauri doblados desde `src/test/helpers.ts`
  (igual que el Incremento 0). Un juego de modelos de ejemplo en
  `src/lib/model/__fixtures__/` con un `.yaml` por motor, uno roto en una línea
  conocida y uno de 50 tablas para el límite de SC-003. Pruebas de ida y vuelta
  (parsear → serializar → parsear) y de cada mensaje de validación con su línea.
- **Backend**: `cargo test` por módulo con directorios temporales
  (`std::env::temp_dir()` más el pid, el patrón de `preferences.rs`): listar, crear
  carpeta con nombre repetido, escritura atómica, sello obsoleto, recientes con 11
  entradas y recuperación de `recents.json` dañado.
- **Manual**: lo que no se puede automatizar sin red ni sistema real (papelera,
  revelar en el gestor, portapapeles, revisión en los dos temas) queda en
  `quickstart.md` como pasos con resultado esperado.

**Razón**: cubre la puerta 3 y SC-004 con pruebas, y deja explícito lo que exige
máquina real, como ya ocurrió con la verificación de macOS del Incremento 0.

**Alternativas descartadas**: `tempfile` como dependencia de pruebas (el patrón
existente no la necesita); pruebas de extremo a extremo con WebDriver (infraestructura
nueva para un incremento que todavía no tiene lienzo).

## R15 · Medidas de rendimiento con el mecanismo existente

**Decisión**: se añaden `measure_model_opened` y `measure_model_saved`, que anotan
milisegundos solo cuando el binario arranca con `SQL_DESIGNER_MEDIR=1`, igual que
`measure_startup_ready` y `measure_theme_applied`.

**Razón**: SC-002 y SC-003 son números y hay que poder leerlos en el binario
empaquetado, no deducirlos. El mecanismo ya existe y calla en un uso normal.

**Alternativas descartadas**: cronometrar a mano con un reloj en pantalla
(impreciso); dejar los criterios sin instrumentar (fue justo el problema que
obligó a reabrir el Incremento 0).

## R16 · Alcance del Editor en este incremento

**Decisión**: el Editor trae solo su cabecera (nombre del modelo, motor, estado
«Guardado · <motor>» con la hora o «Editado», botón de cerrar con indicador), la
tarjeta de modelo vacío «Empieza a diseñar tu modelo» en estado informativo y el
diálogo de renombrar. Sin lienzo, sin inspector, sin panel inferior.

**Razón**: es lo que el spec pide (FR-018 a FR-021 y la aclaración de que renombrar
es el único cambio permitido) y lo que hace demostrable el ciclo crear → editar →
guardar → cerrar → reabrir. El lienzo es el Incremento 2.

**Nota de trabajo**: la referencia visual de la cabecera está en
`project/Editor.dc.html` del lienzo, que pesa 303 KB. Hay que descargarlo con la
acción de lectura del artefacto y inspeccionarlo con `grep` sobre el archivo
guardado; volcarlo entero en la conversación no cabe.

## R17 · Sin entradas nuevas en el menú nativo

**Decisión**: los atajos ⌘N, ⌘O, ⌘S y ⌘W se registran en el webview con el hook
`useShortcut` existente; el menú nativo de macOS no cambia.

**Razón**: el menú nativo del Incremento 0 solo existe para Preferencias, y el
Incremento 10 («Ajustes y multiplataforma») es el que revisa menús y atajos en los
dos sistemas. Añadirlos ahora obligaría a duplicar en Rust la lógica de qué está
disponible según la pantalla.

**Alternativas descartadas**: menú Archivo completo ahora — el estado de
disponibilidad («Guardar» solo con modelo abierto y cambios) viviría en dos sitios.

## R18 · Preferencias: dos campos nuevos, sin subir la versión del formato

**Decisión**: `preferences.json` gana `engine` (`postgres` | `mysql` | `sqlite`, por
defecto `postgres`) y `lastFolder` (`string | null`). `formatVersion` sigue en `1` y
`PreferencesPatch` acepta `engine`, `lastFolder` y `lastModelPath`.

**Razón**: el lector ya reconstruye campo a campo y da el valor por defecto a lo que
falte, así que un `preferences.json` del Incremento 0 se abre sin aviso. Subir la
versión forzaría una recuperación con `.bak` y un aviso en la cara del usuario por
dos campos añadidos.

**Alternativas descartadas**: subir a `formatVersion: 2` (recuperación innecesaria);
guardar el motor por defecto en otro archivo (dos archivos de preferencias).
