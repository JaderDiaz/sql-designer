# Fase 1 · Cómo validar el Incremento 4

Guía de ejecución y validación. No trae código de implementación: eso va en
`tasks.md`. Las referencias de forma están en
[`contracts/relations.md`](./contracts/relations.md),
[`contracts/preferences.md`](./contracts/preferences.md),
[`contracts/model.schema.json`](./contracts/model.schema.json) y
[`data-model.md`](./data-model.md).

## Prerrequisitos

**Una dependencia nueva**:

```bash
npm install @radix-ui/react-tabs
```

Es el primitivo de la lista de fichas del panel inferior, de la misma familia
que los siete paquetes de Radix que ya están en el proyecto (research R9). Nada
nuevo en Rust: los tres campos de preferencias van sobre `preferences_update`,
que ya existe.

### Modelos de pruebas

| Archivo | Para qué |
| ------- | -------- |
| `e2e/soporte/modelo-relaciones.yaml` | **Nuevo.** Cuatro tablas en dos esquemas con llave primaria de una columna, dos relaciones ya hechas —una con `CASCADE`—, una relación de una tabla hacia sí misma, una tabla con llave primaria compuesta para el destino deshabilitado y una columna de clave foránea sin índice |
| `e2e/soporte/modelo-tablas.yaml` | El del Incremento 3; sigue usándose para la ficha «Campos» y los avisos de borrado |
| `src/lib/model/__fixtures__/modelo-relaciones.yaml` | **Nuevo.** Las cinco acciones referenciales —`set_default` incluida—, una relación de varias columnas y un bucle, para la puerta 3 y para `validate.test.ts` |
| `src/lib/model/__fixtures__/modelo-50-tablas.yaml` | Se amplía a 60 relaciones, para medir SC-003 |

## Comprobaciones automáticas

```bash
npm run typecheck     # TypeScript strict, sin any ni @ts-ignore
npm run lint          # eslint + puerta 7 (capas e invoke)
npm test              # Vitest: geometría, dominio, almacén y pantallas
cd src-tauri && cargo check && cargo test && cd ..
```

Las cinco tienen que pasar sin avisos nuevos (puerta 1 de la constitución).

### Pruebas que no pueden faltar

| Prueba | Qué prueba | Requisito |
| ------ | ---------- | --------- |
| `src/lib/canvas/relations.test.ts` | Anclas en el centro de la fila del campo, los tres `kind`, el reparto en carriles con y sin cruces, los tres trazados, el bucle y los cuatro glifos | FR-013, FR-013a, FR-014, FR-016, FR-017 |
| `src/lib/model/relations.test.ts` | Propuesta de columna con el patrón y su sufijo, tipo copiado de la llave primaria, `null` con llave compuesta, nombre de relación con choque, destinos deshabilitados con su motivo y estado del índice | FR-004, FR-005, FR-009, FR-011, FR-033 |
| `src/lib/model/marks.test.ts` | `cardinalityOf` en los cuatro casos y `relationCardinality` como su formateador: el mismo dato para la línea y para el inspector | FR-014, SC-011 |
| `src/lib/model/validate.test.ts` | `set_default` aceptada, `fromFields` y `toFields` de distinta longitud rechazadas, campo inexistente rechazado | FR-028, FR-040 |
| `src/lib/model/roundtrip.test.ts` | Guardar y volver a cargar un modelo con cuatro relaciones, las cinco acciones, un bucle y una relación de varias columnas, sin perder nada ni subir de versión | FR-040, SC-007 |
| `src/store/relations.test.ts` | Las seis acciones, cada una como un paso deshacible con su etiqueta; la columna que sobrevive al borrado de la relación; la marca FK que se mantiene cuando otra relación usa el campo | FR-012, FR-035, FR-036 |
| `src/components/features/table/ForeignKeysTab.test.tsx` | Las seis columnas, el destino deshabilitado con su motivo, el aviso de SET NULL con su salida, las insignias del índice, «Referenciada por» y el contador de la ficha | FR-006 a FR-010, FR-028 a FR-034 |
| `src/components/features/canvas/RelationsLayer.test.tsx` | Cuántos `path` se pintan y con qué `d`, el color del esquema de la tabla con la llave primaria, `aria-hidden` y que la capa no captura el puntero | FR-013 a FR-018 |
| `src/components/features/canvas/CanvasSurface.test.tsx` | El resaltado por cursor y por foco: qué tarjetas quedan `is-hot`, `is-linked` e `is-dim`, y los campos marcados en las dos tablas | FR-021 a FR-023, FR-026, FR-027 |
| `src-tauri/src/preferences.rs` (pruebas de Rust) | Los tres campos con su valor por defecto cuando faltan, el enum fuera de rango que cae al valor por defecto y el recorte del patrón a 64 | FR-041 |

De una línea solo se afirma su atributo `d`: `jsdom` no hace layout de SVG, así
que la forma en pantalla se mira en el recorrido y en la revisión de los temas
(research R16).

## Recorrido sobre la aplicación real

```bash
npm run build         # dist/ con el frontend
npm run e2e           # compila con la característica webdriver y ejecuta los 12 archivos
```

`npm run tauri dev` reconstruye el binario **sin** la característica
`webdriver`: después de usarlo hay que volver a lanzar `npm run e2e`, que
recompila lo que hace falta.

### `e2e/specs/11-relaciones.e2e.js`

| Escenario | Qué comprueba | Requisito |
| --------- | ------------- | --------- |
| 1 · Las tres vías de entrada | «Relación», la tecla `R` y «Nueva clave foránea…» abren la ficha con la tabla correcta; sin selección aparece el aviso y no se crea nada | FR-001 a FR-003 |
| 2 · Relacionar cuatro tablas | Cuatro claves foráneas creadas con la columna propuesta, la marca FK en el panel y en la tarjeta, y cuatro líneas nuevas en el lienzo | FR-004 a FR-010 |
| 3 · La tabla consigo misma | La tabla abierta aparece como destino, el bucle se dibuja sobre su tarjeta y la columna no puede ser el campo referenciado | FR-009a, FR-013a |
| 4 · Destino imposible | La tabla de llave primaria compuesta sale deshabilitada con su motivo | FR-009 |
| 5 · Resaltar | Con el cursor y con el teclado: la tabla, sus líneas y sus tablas relacionadas se resaltan y el resto se atenúa; los campos de la relación quedan marcados | FR-021 a FR-023, FR-027 |
| 6 · Trazado y animación | Los tres trazados de Ajustes redibujan las líneas en menos de 100 ms y con la ventana de Ajustes abierta; las tres animaciones se notan y «Apagada» no anima | FR-017, FR-024 |
| 7 · Reglas | Las cinco acciones en ON DELETE y ON UPDATE; SET NULL sobre una columna no nula avisa y «Quitar «no nulo»» lo arregla | FR-028, FR-030 |
| 8 · Referenciada por | La sección lista las tablas que referencian y pulsar una lleva a ella | FR-031 |
| 9 · Eliminar | La línea desaparece, la columna se queda sin marca FK y ⌘Z / Ctrl+Z lo devuelve con sus reglas | FR-035, FR-036 |
| 10 · Guardar y reabrir | Las relaciones, sus reglas y las marcas siguen como se dejaron | SC-007 |
| 11 · Reinicio | El trazado y la animación elegidos siguen puestos al volver a abrir la aplicación | FR-041, SC-007 |
| 12 · Arrastre con relaciones | Con el modelo de 50 tablas y 60 relaciones, arrastrar una tabla mantiene las líneas pegadas y no baja de 60 fps | SC-003 |

El Modo de bajo consumo del sistema tiene que estar **apagado** para medir el
escenario 12: con él encendido el navegador limita los cuadros por segundo y la
medición no dice nada (es la excepción que el Incremento 3 anotó en SC-004).

## Revisión a mano antes de cerrar

| Qué | Dónde mirar | Requisito |
| --- | ----------- | --------- |
| Tema claro, tema oscuro y movimiento reducido | La ficha «Claves foráneas», las líneas con sus glifos, el resaltado y los dos controles de Ajustes | SC-010 |
| Contraste del texto ≥ 4,5:1 | Las seis columnas de la rejilla, las insignias y «Referenciada por» | SC-010 |
| Contraste de la línea ≥ 3:1 contra el fondo del lienzo | Las líneas en reposo, que son las más tenues, en los dos temas | SC-010 |
| Todo con el teclado | Abrir la ficha, añadir, cambiar los cinco selectores, ir a la tabla y eliminar, con foco visible | FR-038, SC-008 |
| Los seis estados | La tabla de `contracts/relations.md` §6, uno por uno | SC-009 |
| Apego al diseño | El tablero `Editor` y el componente `TableEditorPanel` en su variante `fks`: medidas, textos y jerarquía, con los siete desvíos de `research.md` R18 a la vista | Puerta 6 |

## Demostración del incremento

Con `e2e/soporte/modelo-relaciones.yaml` abierto, en menos de cinco minutos
(SC-001):

1. Relacionar las cuatro tablas, una por cada vía de entrada.
2. Pasar el cursor por una de ellas y ver su grupo resaltado.
3. Cambiar su ON DELETE a `CASCADE` y su ON UPDATE a `RESTRICT`.
4. Guardar, cerrar y volver a abrir: todo sigue igual.
