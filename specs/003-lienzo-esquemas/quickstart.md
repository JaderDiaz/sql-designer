# Fase 1 · Cómo validar el Incremento 2

Guía de ejecución y validación. No trae código de implementación: eso va en
`tasks.md`. Las referencias de forma están en
[`contracts/canvas.md`](./contracts/canvas.md),
[`contracts/preferences.md`](./contracts/preferences.md),
[`contracts/model.schema.json`](./contracts/model.schema.json) y
[`data-model.md`](./data-model.md).

## Prerrequisitos

```bash
# Única dependencia nueva del incremento: el interruptor de la confirmación
# (research.md R14). Hazlo antes de empezar, no a mitad de la implementación.
npm install @radix-ui/react-switch
```

No hay dependencias nuevas de Rust: el lienzo es todo frontend y lo único que
cruza la frontera son los dos booleanos de `contracts/preferences.md`.

### Modelo de pruebas

El recorrido del Incremento 1 ya crea `modelo-50-tablas.yaml` en su carpeta
temporal. Este incremento necesita además un modelo con tablas repartidas en
tres esquemas de colores distintos y un cuarto esquema vacío; se añade a
`e2e/soporte/` como `modelo-esquemas.yaml` y se usa en los escenarios de abajo.

## Comprobaciones automáticas

```bash
npm run typecheck     # TypeScript strict, sin any ni @ts-ignore
npm run lint          # eslint + puerta 7 (capas e invoke)
npm test              # Vitest: geometría, almacén y pantallas
cd src-tauri && cargo check && cargo test && cd ..
```

Las cinco tienen que pasar sin avisos nuevos (puerta 1 de la constitución).

### Pruebas que no pueden faltar

| Prueba | Qué prueba | Requisito |
| ------ | ---------- | --------- |
| `src/lib/canvas/geometry.test.ts` | La zona envuelve sus tablas con el margen exacto; alto mínimo con una sola tabla; zona vacía de 240 × 180; las zonas salen en el orden del modelo | FR-023 a FR-025 |
| `src/lib/canvas/layout.test.ts` | `resolveLayout` es determinista; respeta la posición del archivo; agrupa por esquema sin solapar zonas; no muta el modelo | FR-013, FR-028 |
| `src/lib/canvas/zoom.test.ts` | Topes 40 % y 200 %; el punto bajo el puntero no se mueve; «Ajustar» con posiciones negativas y enormes; modelo vacío → 100 % centrado | FR-008 a FR-011 |
| `src/lib/model/propose.test.ts` | «Ventas y cobros» → `ventas_y_cobros` / `VYC`; acentos; una sola palabra; empieza por número; vacío | FR-016 |
| `src/lib/model/colors.test.ts` | Los once identificadores; uno desconocido cae a `indigo` sin error | FR-021 |
| `src/lib/model/parse.test.ts` | `schemas[].position` se lee en un esquema vacío y **se descarta** en uno con tablas; una clave desconocida o una `x` no numérica sí invalidan el archivo | FR-026a, FR-044 |
| `src/lib/model/roundtrip.test.ts` | Un modelo con posición de esquema vacío y posiciones de tabla da el mismo texto al ir y volver | FR-044, puerta 3 |
| `src/store/canvas.test.ts` | La vista arranca ajustada; el foco se quita al eliminar el esquema enfocado y al cerrar el modelo; esconder la barra lateral escribe la preferencia | FR-006, FR-014, FR-032 |
| `src/store/schemas.test.ts` | Crear, editar, eliminar con y sin tablas, mover con y sin tablas; cada uno un solo paso de deshacer; el último esquema no se elimina | FR-015 a FR-037 |
| `src/components/features/schema/SchemaDialog.test.tsx` | Propuesta de nombre técnico y abreviatura; se deja de proponer al escribir a mano; los seis errores de FR-018; la vista previa cambia de color | FR-016 a FR-019 |
| `src/components/features/schema/DeleteSchemaDialog.test.tsx` | El interruptor arranca apagado; con tres esquemas hay selector y propone el primero; con dos no hay selector; «Eliminar…» deshabilitada con uno solo | FR-034 a FR-036 |
| `src/components/features/canvas/SchemaZone.test.tsx` | Rótulo con abreviatura, nombre y número de tablas; el texto «Aún no hay tablas en este esquema»; nombre accesible completo | FR-024, FR-025, FR-040 |
| `src-tauri/src/preferences.rs` | Un `preferences.json` sin los campos nuevos los lee como `false` y no genera `.bak`; el parche cambia uno sin tocar el otro | FR-006 |

## Recorrido automatizado

A los nueve archivos de `e2e/specs/` se añade `09-lienzo-y-esquemas.e2e.js`, con
los escenarios que necesitan navegador de verdad (research R17):

```bash
npm run e2e           # compila el binario del recorrido y ejecuta los escenarios
```

| Escenario | Qué conduce | Qué comprueba |
| --------- | ----------- | ------------- |
| 1 · Las cinco zonas | Abre `modelo-esquemas.yaml` | Barra lateral, barra superior, lienzo, inspector y barra de estado están, y la barra de estado dice el motor, el estado del archivo, el zoom y los contadores |
| 2 · Esconder y recuperar | ⌥⌘S, ⌥⌘I, cierra el modelo, abre otro | El lienzo ocupa el espacio, los botones vuelven a mostrarlo y la elección sobrevive al cambio de modelo y al reinicio |
| 3 · Mover la vista | Arrastra el fondo, arrastra con el botón central, Espacio + arrastrar | La vista se mueve en los tres casos y en Windows el botón central no dispara el autoscroll |
| 4 · Zoom | ⌘/Ctrl + rueda, botones «−» y «+», ⌘0, ⇧1 | El porcentaje cambia, se para en 40 % y 200 % con el botón del tope deshabilitado, el punto bajo el puntero no se mueve y «Ajustar» deja todo a la vista |
| 5 · Crear tres esquemas | Nuevo esquema tres veces con nombres legibles | Nombre técnico y abreviatura propuestos, color elegido, error de duplicado, y las tres zonas vacías aparecen en el lienzo |
| 6 · Arrastrar una zona y guardar | Arrastra la zona de un esquema con tablas, guarda, cierra y reabre | Las tablas acompañaron a la zona, el modelo quedó «Editado», ⌘Z lo devuelve en un paso y tras guardar y reabrir todo sigue donde se dejó |
| 7 · Arrastrar una zona vacía | Arrastra la zona del esquema vacío, guarda, cierra y reabre | La zona sigue donde se dejó y el archivo trae `schemas[].position` solo en ese esquema |
| 8 · Enfocar | Clic en los tres esquemas de la barra lateral, Esc, «Todos los esquemas» | El lienzo se centra en cada uno, el resto se atenúa, la lista de tablas se filtra, y las dos salidas quitan el foco |
| 9 · Eliminar | Menú contextual de una zona, elige destino, confirma; repite con el interruptor encendido; prueba un modelo de un solo esquema | Las tablas llegan al destino elegido, con el interruptor se van con el esquema, ⌘Z deshace todo en un paso y con un solo esquema la opción está deshabilitada |

## Recorrido manual

Lo que ninguna prueba puede firmar sola:

### SC-003 · Rendimiento con 50 tablas

1. `npm run tauri dev` y abre `modelo-50-tablas.yaml`.
2. Con el panel de rendimiento del navegador grabando, arrastra una zona, mueve
   la vista y haz zoom durante unos segundos.
3. Comprueba que no hay cuadros por debajo de 60 por segundo durante los gestos
   y que el primer movimiento responde en menos de 100 ms.

La cifra se mide sobre la compilación de depuración, como en los incrementos
anteriores; medirla sobre el binario empaquetado sigue siendo tarea abierta del
Incremento 0 (T069).

### SC-010 · Temas y movimiento reducido (puerta 5)

Con el Editor abierto, el diálogo de esquema y la confirmación de eliminar, en
este orden:

1. Tema claro.
2. Tema oscuro.
3. «Reducir movimiento» del sistema activado: centrar, hacer zoom y «Ajustar»
   llegan al resultado sin animación (FR-042).

En los tres, ningún texto por debajo de 4,5:1 de contraste y el color nunca es
la única pista de a qué esquema pertenece algo.

### SC-008 · Todo con el teclado

Desde el Editor y sin tocar el ratón: esconder y mostrar las dos zonas, recorrer
las zonas y las tablas con el tabulador, mover la vista con las flechas, cambiar
el zoom, ajustar, crear un esquema, abrir el menú contextual de una zona con
⇧F10, editarlo, eliminarlo eligiendo destino y deshacerlo. Foco visible en cada
paso.

### SC-001, SC-002 y SC-005 · Tiempos

| Criterio | Cómo se mide |
| -------- | ------------ |
| SC-001 | Cronómetro desde el Editor: abrir el diálogo, escribir el nombre, confirmar. Tres pasos, menos de 30 s |
| SC-002 | Crear los tres esquemas, moverlos y enfocar cada uno: menos de 3 min sin ayuda |
| SC-005 | Enfocar un esquema deja su zona completa y centrada en menos de 1 s |

## Antes de dar el incremento por terminado

1. Las cinco puertas en verde en las dos plataformas (workflow `puertas.yml`).
2. El recorrido en verde en macOS y en Windows (workflow `recorrido.yml`).
3. Puerta 6: ningún archivo del lienzo copiado al repositorio; los tres desvíos
   deliberados anotados en `research.md` R20 siguen siendo los únicos.
4. Puerta 8: todo símbolo nuevo con su bloque JSDoc en español.
5. Versión del producto a `1.2.0` en `package.json`,
   `src-tauri/tauri.conf.json` y `src-tauri/Cargo.toml`, y etiqueta anotada
   `v1.2.0` sobre el commit que cierra el incremento.
