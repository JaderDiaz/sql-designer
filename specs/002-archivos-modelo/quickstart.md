# Fase 1 · Cómo validar el Incremento 1

Guía de ejecución y validación. No trae código de implementación: eso va en
`tasks.md`. Las referencias de forma están en
[`contracts/commands.md`](./contracts/commands.md) y
[`data-model.md`](./data-model.md).

## Prerrequisitos

```bash
# Dependencias nuevas del frontend (el registro npm sí responde en este entorno)
npm install yaml @radix-ui/react-select @radix-ui/react-context-menu

# Dependencia nueva del backend. Necesita red: hazlo ANTES de tocar código Rust.
cd src-tauri && cargo add trash@5 && cargo fetch && cd ..
```

Si `cargo fetch` no puede salir a crates.io, el incremento se bloquea aquí y no a
mitad de la implementación (riesgo anotado en `research.md`, R7).

## Comprobaciones automáticas

```bash
npm run typecheck     # TypeScript strict, sin any ni @ts-ignore
npm run lint          # eslint + puerta 7 (capas e invoke)
npm test              # Vitest: modelo, almacén y pantallas
cd src-tauri && cargo check && cargo test && cd ..
```

Las cuatro tienen que pasar sin avisos nuevos (puerta 1 de la constitución).

### Pruebas que no pueden faltar

| Prueba | Qué prueba | Requisito |
| ------ | ---------- | --------- |
| `src/lib/model/slug.test.ts` | «Livy · Reservas» → `livy-reservas`; vacío; solo signos; nombre reservado de Windows; recorte a 80 | FR-002, FR-003 |
| `src/lib/model/parse.test.ts` | Error de YAML y error de validación con línea y columna exactas; versión futura | FR-016, FR-025 |
| `src/lib/model/roundtrip.test.ts` | Parsear → serializar → parsear da el mismo modelo y el mismo texto, con un ejemplo por motor | FR-023, SC-004, puerta 3 |
| `src/lib/model/defaults.test.ts` | Esquema por defecto: `public`/`PUB`, nombre del modelo en MySQL, `main`/`MAI` | FR-005 |
| `src/store/model.test.ts` | Transiciones guardado → editado → guardado, `model_stale`, fallo de guardado que no descarta cambios | FR-018 a FR-025 |
| `src/store/recents.test.ts` | Orden por último uso, sin duplicados, tope de 10, estados `missing` e `invalid` | FR-029 a FR-032 |
| `src-tauri/src/files.rs` | Escritura atómica, sello obsoleto, listado con filtro, carpeta nueva numerada | FR-010, FR-021, FR-022, FR-025 |
| `src-tauri/src/recents.rs` | 11 entradas descartan la más antigua; `recents.json` dañado se recupera con `.bak` | FR-032 |

## Recorrido automatizado

Los ocho escenarios de abajo están automatizados: conducen la aplicación de verdad
—no una maqueta— con el servidor de WebDriver que el binario monta cuando se
compila con `--features webdriver`.

```bash
npm run e2e           # compila el binario del recorrido y ejecuta los ocho escenarios
```

Qué hace por dentro (`e2e/wdio.conf.js`, `e2e/soporte/`):

- Aparta `preferences.json`, `recents.json` y `.window-state.json` del usuario con
  el sufijo `.antes-del-recorrido` y los repone al terminar.
- Crea una carpeta temporal con `modelo.yaml`, `roto.yaml`, `modelo-50-tablas.yaml`,
  `notas.md`, `vacia/` y `otra-carpeta/`, y la borra al final.
- Levanta Vite: una compilación de depuración carga la interfaz desde `devUrl`.
- Arranca cada escenario en la Bienvenida, porque el arranque reabre el último
  modelo cuando las preferencias lo recuerdan.
- Comprueba en el disco lo que la aplicación escribe: los `.yaml`, la lista de
  recientes y las preferencias.

Lo que el recorrido no puede hacer, y por eso sigue necesitando a una persona:
cambiar el tema o «Reducir movimiento» del sistema, comprobar «Mostrar en Finder»
y recorrer todo en Windows.

## Escenario 1 · Crear un modelo (FR-001 a FR-006)

```bash
npm run tauri dev
```

1. En la Bienvenida pulsa **Nuevo modelo…** (o ⌘N / Ctrl+N).
2. Escribe `Livy · Reservas`. **Esperado**: la ruta de abajo acaba en
   `livy-reservas.yaml` y «Crear modelo» está activo.
3. Borra el nombre. **Esperado**: «Escribe un nombre para el modelo.» y el botón
   deshabilitado. Escribe `···`. **Esperado**: «Usa al menos una letra o un número.»
4. Cambia el motor entre los tres. **Esperado**: la frase de debajo cambia con cada
   uno; al abrir el diálogo venía preseleccionado el de Ajustes.
5. Pulsa **Crear modelo**. **Esperado**: aparece el Editor con el modelo vacío, la
   cabecera dice «Guardado · PostgreSQL» y el archivo existe en disco:

```bash
cat ~/Documents/livy-reservas.yaml   # o la carpeta que hayas elegido
# formatVersion: 1
# name: Livy · Reservas
# engine: postgres
# schemas:
#   - name: public
#     abbreviation: PUB
```

6. Repite el paso 1 con el mismo nombre y la misma carpeta. **Esperado**: «Ya existe
   livy-reservas.yaml en esta carpeta. Elige otro nombre.» y no se puede crear.

## Escenario 2 · Elegir la carpeta (FR-007 a FR-011)

1. En Nuevo modelo pulsa **Cambiar…**.
2. Cambia de ubicación en la lista lateral. **Esperado**: el contenido cambia, Atrás
   se activa y Adelante sigue deshabilitado hasta que uses Atrás.
3. Escribe algo que no exista en Buscar. **Esperado**: «Sin resultados» con el texto
   buscado. Bórralo y entra en una carpeta vacía. **Esperado**: «Carpeta vacía».
4. Pulsa **Nueva carpeta**. **Esperado**: aparece «carpeta sin título» seleccionada;
   repítelo y aparece «carpeta sin título 2».
5. Pulsa **Elegir**. **Esperado**: vuelves a Nuevo modelo con esa carpeta en la ruta
   y con el nombre que habías escrito intacto.
6. Repite y pulsa **Cancelar**. **Esperado**: la carpeta anterior se conserva.

## Escenario 3 · Abrir un modelo y archivo con errores (FR-012 a FR-017)

Prepara dos archivos en la misma carpeta:

```bash
cp src/lib/model/__fixtures__/modelo-postgres.yaml ~/Documents/modelo.yaml
printf 'formatVersion: 1\nname: Roto\nengine: postgres\nschemas\n  - name: public\n' > ~/Documents/roto.yaml
```

1. Bienvenida → **Abrir modelo…** (⌘O / Ctrl+O) y navega a esa carpeta.
2. Selecciona `modelo.yaml`. **Esperado**: la vista previa muestra nombre, archivo,
   motor, tablas, relaciones, tamaño y fecha.
3. Sin selección válida, **Abrir** está deshabilitado. Un `.md` o un `.png` no
   aparece en la lista: el listado de Rust solo devuelve carpetas y `.yaml`
   (`ListOnly::Models` en `src-tauri/src/files.rs`), así que no hay nada que ver
   atenuado.
4. Doble clic en `modelo.yaml`. **Esperado**: el Editor con el modelo tal como se
   guardó y la cabecera en «Guardado · <motor>».
5. Vuelve a Abrir modelo y selecciona `roto.yaml`. **Esperado**: la vista previa lo
   marca como no abrible; al intentar abrirlo, el diálogo nombra el archivo y dice
   la línea del error, con «Mostrar en Finder» y «Aceptar»; al aceptar sigues en
   Abrir modelo.
6. Pulsa «Mostrar en Finder» / «Mostrar en el Explorador». **Esperado**: el gestor de
   archivos se abre con el archivo seleccionado.

## Escenario 4 · Guardar, estado y archivo cambiado por fuera (FR-018 a FR-026)

1. Con un modelo abierto, renómbralo desde el Editor. **Esperado**: «Editado», el
   indicador en el botón de cerrar y el nombre nuevo en la cabecera; el nombre del
   archivo no cambia.
2. Pulsa ⌘S (Ctrl+S). **Esperado**: aviso breve «Guardado», la cabecera vuelve a
   «Guardado · <motor>» con la hora, y el `name` del `.yaml` ya es el nuevo.
3. Pulsa ⌘S otra vez sin cambios. **Esperado**: no pasa nada visible y la fecha de
   modificación del archivo no cambia (`stat` del archivo antes y después).
4. Cambia el archivo por fuera y guarda desde la app:

```bash
printf '\n# tocado por fuera\n' >> ~/Documents/modelo.yaml
```

   Renombra el modelo en la app y pulsa ⌘S. **Esperado**: aviso de que el archivo
   cambió en el disco con sobrescribir y cancelar; al cancelar no se escribe nada y
   sigue «Editado»; al sobrescribir se guarda y el comentario externo desaparece.
5. Quita el permiso de escritura y guarda:

```bash
chmod 555 ~/Documents               # recuerda devolverlo con chmod 755
```

   El permiso va en la carpeta y no en el archivo: la escritura es atómica —se
   escribe un temporal al lado y se renombra encima—, y renombrar sobre un archivo
   de solo lectura funciona igual mientras la carpeta deje escribir.

   **Esperado**: mensaje de que no se pudo guardar, el modelo sigue «Editado» y no se
   pierde el cambio.

## Escenario 5 · Cerrar (FR-027 a FR-030)

1. Sin cambios, pulsa el botón de cerrar o ⌘W (Ctrl+W). **Esperado**: vuelves a la
   Bienvenida y el modelo está primero en Recientes.
2. Con cambios, cierra. **Esperado**: «¿Guardar los cambios?» nombrando el modelo,
   con Guardar, No guardar y Cancelar.
3. Prueba las tres. **Esperado**: Guardar escribe y vuelve a la Bienvenida; No
   guardar vuelve dejando el archivo como el último guardado (compruébalo con
   `cat`); Cancelar o Esc deja el Editor con los cambios y «Editado».
4. Con cambios, pide **Nuevo modelo** desde el Editor. **Esperado**: la misma
   pregunta antes de reemplazar el modelo abierto.
5. Con cambios, cierra la ventana de la aplicación. **Esperado**: la misma pregunta
   antes de salir.

## Escenario 6 · Recientes y sus acciones (FR-031 a FR-036)

1. Crea y cierra dos modelos. **Esperado**: los dos en la lista, el último primero,
   cada uno con nombre, ruta, fecha, motor y número de tablas, y el total arriba.
2. Doble clic, y después selección con teclado y Enter. **Esperado**: ambos abren y
   la entrada sube al primer lugar.
3. Mueve un archivo por fuera y vuelve a la Bienvenida:

```bash
mv ~/Documents/livy-reservas.yaml ~/Documents/otra-carpeta/
```

   **Esperado**: «No encontrado»; al abrirlo, diálogo con «Quitar de recientes» y
   «Aceptar», y al quitarlo la fila desaparece sin tocar el archivo.
4. Rompe otro archivo por fuera y vuelve. **Esperado**: «Archivo con errores»; al
   abrirlo, el diálogo con la línea.
5. Clic derecho en un reciente y después ⇧F10 sobre el seleccionado. **Esperado**: el
   mismo menú con Abrir, Renombrar…, Copiar ruta, Quitar de recientes y Mover a la
   papelera…, recorrible con flechas y cerrable con Esc.
6. **Renombrar…**: confirma un nombre nuevo. **Esperado**: cambia en la lista y en el
   `name` del `.yaml`; el nombre del archivo no cambia y el diálogo lo decía.
7. **Copiar ruta**: pega en cualquier editor. **Esperado**: la ruta completa, y un
   aviso breve de que se copió.
8. **Mover a la papelera…**: confirma. **Esperado**: el diálogo dijo qué archivo y de
   qué carpeta; el archivo está en la papelera del sistema (recuperable) y la fila
   salió de la lista.
9. Sobre un reciente «No encontrado». **Esperado**: Abrir, Renombrar… y Mover a la
   papelera… deshabilitadas; Copiar ruta y Quitar de recientes activas.
10. Crea 11 modelos. **Esperado**: la lista muestra 10 y la más antigua desapareció.

## Escenario 7 · Teclado, temas y movimiento reducido (FR-037 a FR-041, SC-007, SC-009)

1. Recorre las cuatro pantallas y los cinco diálogos **solo con el teclado**:
   **Esperado**: toda acción es alcanzable, con foco visible en cada paso, y Esc
   cierra cada diálogo.
2. Cambia el tema del sistema y repite una vuelta rápida. **Esperado**: las cuatro
   pantallas correctas en claro y en oscuro, sin texto de bajo contraste.
3. Activa «Reducir movimiento» en el sistema. **Esperado**: los diálogos aparecen sin
   animación de entrada y nada parpadea.
4. Comprueba los símbolos de atajo: ⌘ en macOS, Ctrl en Windows (RS-12).

## Escenario 8 · Medidas de SC-002 y SC-003

```bash
SQL_DESIGNER_MEDIR=1 npm run tauri dev
```

1. Crea un modelo. **Esperado**: en el registro, una línea con los milisegundos hasta
   que el Editor quedó pintado, por debajo de 1 000 (SC-002).
2. Abre `src/lib/model/__fixtures__/modelo-50-tablas.yaml` copiado a una carpeta real
   y guárdalo. **Esperado**: apertura por debajo de 2 000 ms y guardado por debajo de
   1 000 ms (SC-003).
3. Sin la variable de entorno, el registro no debe traer ninguna de esas líneas.

## Resultados de la validación

### Comprobaciones automáticas · 2026-10-26

| Puerta | Comando | Resultado |
| ------ | ------- | --------- |
| Tipos | `npm run typecheck` | Sin errores |
| Capas e `invoke` (puerta 7) | `npm run lint` | 100 archivos revisados, sin avisos |
| Pruebas del frontend | `npx vitest run` | 188 pruebas en 32 archivos, todas en verde |
| Compilación del frontend | `npm run build` | Correcta |
| Rust (puerta 1) | `cargo check` | Sin avisos |
| Pruebas de Rust | `cargo test` | 58 pruebas, todas en verde |

### Revisión de superficies · 2026-10-26

- Las nueve superficies modales de `data-model.md` §3 (Nuevo modelo, Elegir carpeta,
  Abrir modelo, Renombrar, Guardar los cambios, Archivo con errores, No encontrado,
  Mover a la papelera y Archivo cambiado por fuera) se montan sobre `Sheet` o
  `BrowserDialog`, que son Radix: cierran con Esc, atrapan el foco y se describen
  con su título. Ninguna trae colores literales; los únicos valores fuera de
  tokens del repositorio siguen siendo el dibujo del icono de la aplicación y el
  trazo de los controles de ventana, que ya venían del Incremento 0.
- Las filas de Recientes animan su entrada con `prefers-reduced-motion` respetado
  en `src/styles/screens.css`, y el resto del movimiento pasa por `MotionConfig`
  con `reducedMotion="user"`.
- Ninguna superficie pasa de 780 × 456, así que todas caben en la ventana mínima de
  820 × 500; lo que no cabe desplaza dentro de su sección
  (`src/components/layout/ScrollRegion.tsx`, y la lista de Recientes con su propio
  `overflow-y`).
- Todo texto visible nuevo está en español y los símbolos de atajo salen de
  `src/lib/platform.ts`.

### Recorrido automatizado · 2026-10-26

`npm run e2e`: 9 archivos, 55 pruebas, todas en verde en 43 s.

| Escenario | Archivo | Pruebas |
| --------- | ------- | ------- |
| Arranque (humo) | `e2e/specs/00-arranque.e2e.js` | 1 |
| 1 · Crear un modelo | `e2e/specs/01-crear-modelo.e2e.js` | 7 |
| 2 · Elegir la carpeta | `e2e/specs/02-elegir-carpeta.e2e.js` | 8 |
| 3 · Abrir un modelo | `e2e/specs/03-abrir-modelo.e2e.js` | 7 |
| 4 · Guardar y estado de cambios | `e2e/specs/04-guardar.e2e.js` | 6 |
| 5 · Cerrar | `e2e/specs/05-cerrar.e2e.js` | 6 |
| 6 · Recientes y sus acciones | `e2e/specs/06-recientes.e2e.js` | 11 |
| 7 · Teclado y temas | `e2e/specs/07-teclado-y-temas.e2e.js` | 6 |
| 8 · Medidas (T112) | `e2e/specs/08-medidas.e2e.js` | 3 |

Las medidas del escenario 8, con `SQL_DESIGNER_MEDIR=1`: crear un modelo deja el
Editor pintado por debajo de 1 000 ms (SC-002), y `modelo-50-tablas.yaml` abre por
debajo de 2 000 ms y guarda por debajo de 1 000 ms (SC-003).

### Pendiente de una persona delante de la aplicación

- El tema del sistema y «Reducir movimiento»: son ajustes de macOS y cambiarlos
  necesita a una persona. El recorrido automatizado sí comprueba los tres temas de
  Ajustes y que nada desplace la ventana entera.
- «Mostrar en Finder» del diálogo de archivo con errores: abre el Finder, que ya
  está fuera de la aplicación.
- El recorrido completo en Windows: no hubo máquina Windows al cerrar el
  incremento el 2026-10-26, igual que en el Incremento 0.

## Validación en las dos plataformas

Los escenarios 1 a 8 se ejecutan en macOS y en Windows. Lo que cambia por sistema y
hay que mirar expresamente: símbolos de atajo, «Mostrar en Finder» frente a «Mostrar
en el Explorador», el nombre de la papelera, la ubicación raíz («Macintosh HD»
frente a la unidad del sistema), la ausencia de iCloud Drive en Windows y el formato
de las rutas que se muestran.
