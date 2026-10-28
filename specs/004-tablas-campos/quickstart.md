# Fase 1 · Cómo validar el Incremento 3

Guía de ejecución y validación. No trae código de implementación: eso va en
`tasks.md`. Las referencias de forma están en
[`contracts/tables.md`](./contracts/tables.md),
[`contracts/preferences.md`](./contracts/preferences.md),
[`contracts/model.schema.json`](./contracts/model.schema.json) y
[`data-model.md`](./data-model.md).

## Prerrequisitos

**Ninguna dependencia nueva**, ni de npm ni de Rust. La rejilla de campos se
construye con los componentes puros que ya existen (`TextField`, `Select`,
`Checkbox`, `Button`) y su navegación con un hook propio (research R7); el
panel inferior es layout y los diálogos reutilizan `Dialog` y `ContextMenu`.

### Modelos de pruebas

| Archivo | Para qué |
| ------- | -------- |
| `e2e/soporte/modelo-tablas.yaml` | **Nuevo.** Tres esquemas con tablas, una tabla de 40 campos, un campo con `length` y `scale`, una llave primaria compuesta, un único de un campo y dos relaciones, para los avisos de borrado |
| `e2e/soporte/modelo-esquemas.yaml` | El del Incremento 2; sigue usándose para el arrastre entre zonas |
| `src/lib/model/__fixtures__/modelo-tipos-ajenos.yaml` | **Nuevo.** Modelo SQLite con un campo `timestamptz`, para FR-018a |
| `src/lib/model/__fixtures__/modelo-postgres.yaml` | Se amplía con `length`, `scale`, `primaryKey` y `uniques`, para la puerta 3 |

## Comprobaciones automáticas

```bash
npm run typecheck     # TypeScript strict, sin any ni @ts-ignore
npm run lint          # eslint + puerta 7 (capas e invoke)
npm test              # Vitest: geometría, catálogo, almacén y pantallas
cd src-tauri && cargo check && cargo test && cd ..
```

Las cinco tienen que pasar sin avisos nuevos (puerta 1 de la constitución).

### Pruebas que no pueden faltar

| Prueba | Qué prueba | Requisito |
| ------ | ---------- | --------- |
| `src/lib/canvas/geometry.test.ts` | `tableHeight` con 0, 1, 4 y 40 campos; la zona envuelve tablas de altos distintos; `zoneAt` devuelve la última zona con solapes y `null` fuera; `snapToGrid` con y sin preferencia; `findFreeSpot` devuelve el punto pedido cuando está libre y nunca `null` | FR-006, FR-031, FR-032, FR-038 |
| `src/lib/model/engines.test.ts` | `typesOf` por motor; `typeTraits` de `varchar`, `numeric`, `integer` y de un tipo ajeno; `idField` y `templatesOf` de los tres motores | FR-015, FR-018, FR-018a, FR-027 |
| `src/lib/model/marks.test.ts` | `fieldMarks` con llave compuesta, único de un campo, único de varios y campo de relación; `relationsTouching` por tabla y por campo | FR-019, FR-025, FR-026, FR-039 |
| `src/lib/model/validate.test.ts` | `length` 0 y negativo rechazados; `scale` mayor que `length` rechazada; un campo de `primaryKey` con `nullable: true` rechazado; `comment` de 281 caracteres rechazado; un `length` sobre un tipo ajeno al motor **aceptado** | FR-016, FR-018a, FR-043, FR-051a |
| `src/lib/model/roundtrip.test.ts` | Un modelo con `length`, `scale`, `primaryKey`, `uniques` y `position` da el mismo texto al ir y volver, con el orden de claves del formato | FR-051, FR-051a, puerta 3 |
| `src/store/tables.test.ts` | Crear con y sin `id` y auditoría por motor; posición pedida y centro visible; mover con y sin cambio de esquema; renombrar propagando a relaciones y a nombres de únicos; duplicar con nombre libre; eliminar con relaciones; cada acción un solo paso de deshacer | FR-001 a FR-009, FR-030 a FR-041 |
| `src/store/tables.fields.test.ts` | Añadir, editar, reordenar y eliminar campos; el tipo olvida longitud y escala; PK fuerza no nulo; UK crea y borra `uq_<tabla>_<campo>`; plantilla que solo añade lo que falta; el último campo no se elimina | FR-011 a FR-028 |
| `src/store/model.test.ts` | La fusión del historial: tres cambios con la misma clave dejan **un** paso y deshacer devuelve el valor inicial; cambiar de celda cierra el paso | FR-024a |
| `src/components/features/table/TableDialog.test.tsx` | Nombre técnico propuesto; los tres errores de FR-004; la vista previa con `id` y auditoría; el esquema propuesto; «Crear tabla» deshabilitada | FR-003 a FR-008 |
| `src/components/features/table/FieldsGrid.test.tsx` | Las nueve columnas; longitud y escala deshabilitadas por tipo; flechas, Inicio, Fin, Intro y Esc mueven y editan sin salir de la rejilla; el tabulador sale en una pulsación; ⌥↑ y ⌥↓ reordenan | FR-011 a FR-017, FR-046a |
| `src/components/features/table/TableContextMenu.test.tsx` | Las cinco entradas; «Mover a esquema» lista los demás esquemas; «Eliminar tabla…» con su estilo destructivo | FR-036 |
| `src/components/features/table/DeleteTableDialog.test.tsx` | El título nombra la tabla; la descripción dice cuántas relaciones se van; cancelar no cambia el modelo | FR-039 |
| `src/components/layout/BottomPanel.test.tsx` | Topes 200 y 560 con puntero y con flechas; `aria-valuenow`; cerrar conserva la selección | FR-022, FR-023 |
| `src/components/layout/Inspector.test.tsx` | Con tabla seleccionada muestra nombre, descripción con cuenta y tope 280, esquema, ocho campos y «Mostrar N más»; sin selección vuelve a la ficha del modelo | FR-042 a FR-045 |
| `src/components/features/canvas/TableCard.test.tsx` | Las filas con marca y tipo; el alto sigue a `tableHeight`; el nombre accesible completo | FR-025, FR-047 |
| `src-tauri/src/preferences.rs` | Un `preferences.json` sin los campos nuevos los lee como `false` y `320` sin generar `.bak`; un alto de `40` o de `5000` se recorta a los topes | FR-022, FR-032 |

## Recorrido automatizado

A los diez archivos de `e2e/specs/` se añade `10-tablas-y-campos.e2e.js`, con lo
que necesita puntero y teclado de verdad (research R17):

| Escenario | Qué hace | Qué comprueba |
| --------- | -------- | ------------- |
| 1 · Crear tres tablas | Doble clic en el lienzo, `T` y el botón de la barra superior | Cada una aparece donde toca, queda seleccionada y abre el panel |
| 2 · Definir campos | Añade campos, escribe nombre y tipo, marca PK y UK, aplica la plantilla de auditoría | Las marcas se ven en la tarjeta del lienzo; el contador de la cabecera sube |
| 3 · Mover entre esquemas | Arrastra una tabla a la zona de otro esquema | Cambia de esquema y color; la zona de origen se encoge y la de destino crece |
| 4 · Cuadrícula | Activa «Ajustar a la cuadrícula» en Ajustes y arrastra | La posición queda en un múltiplo de 24 |
| 5 · Renombrar y duplicar | Renombra desde el menú contextual y duplica con ⌘D / Ctrl+D | Nombre nuevo en las cuatro zonas; la copia es `<tabla>_copia` y está al lado sin solapar |
| 6 · Eliminar | Elimina una tabla con relaciones | La confirmación dice cuántas relaciones se van; deshacer la devuelve entera |
| 7 · Alto del panel | Arrastra el tirador a los dos topes y reinicia la aplicación | El alto se queda en 200 y en 560 y sobrevive al reinicio |
| 8 · Deshacer por celda | Escribe un nombre de campo entero, sale de la celda y pulsa ⌘Z una vez | La celda recupera el valor anterior completo |
| 9 · Solo teclado | Crea una tabla, define dos campos y los reordena sin tocar el ratón | Todo alcanzable con foco visible (SC-009) |
| 10 · Guardar y reabrir | Guarda y vuelve a abrir el modelo | Tablas, campos, longitudes, marcas y posiciones como se dejaron (SC-008) |

```bash
npm run build && npm run e2e          # el recorrido completo
npm run e2e -- --spec e2e/specs/10-tablas-y-campos.e2e.js
```

## Revisión a mano

Lo que ninguna prueba automática cubre (SC-011, puerta 5). Con la aplicación en
marcha:

1. **Tema claro, tema oscuro y movimiento reducido** sobre el diálogo Nueva
   tabla, el panel de campos, el inspector de tabla, el diálogo de renombrar,
   el menú contextual y las dos confirmaciones.
2. **Contraste**: texto de contenido ≥ 4,5:1 y metadatos de 10–11 px ≥ 3:1, con
   el desvío que SC-010 del Incremento 2 ya documentó para el tercer gris.
3. **Tabla de 40 campos**: recorrer la rejilla sin perder la fila de
   encabezado; el resumen del inspector no crece más allá de sus ocho filas.
4. **Modelo de 50 tablas**: arrastrar una tabla y escribir en una celda se ven
   continuos (SC-004, SC-005).
5. **Ventana en su tamaño mínimo** (820 × 500): el panel a 200 px deja lienzo
   usable y la rejilla se desplaza en horizontal sin romper el layout.
6. **Los dos sistemas**: macOS y Windows, con ⌘ y Ctrl en los atajos y el
   contador de caracteres de la descripción en los dos.

## Definición de hecho

- [ ] Las cinco comprobaciones automáticas pasan sin avisos nuevos.
- [ ] Los diez escenarios del recorrido pasan en los dos sistemas.
- [ ] La revisión a mano está hecha y anotada en `tasks.md`.
- [ ] Las tres tablas de la demostración se crean, se mueven entre esquemas y se
      renombran en menos de 6 minutos (SC-002).
- [ ] `specs/004-tablas-campos/checklists/requirements.md` sigue en 17/17.
