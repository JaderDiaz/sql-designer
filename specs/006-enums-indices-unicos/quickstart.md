# Fase 1 · Cómo validar el Incremento 5

Guía de ejecución y validación. No trae código de implementación: eso va en
`tasks.md`. Las referencias de forma están en
[`contracts/enums.md`](./contracts/enums.md),
[`contracts/indexes.md`](./contracts/indexes.md),
[`contracts/preferences.md`](./contracts/preferences.md),
[`contracts/model.schema.json`](./contracts/model.schema.json) y
[`data-model.md`](./data-model.md).

## Prerrequisitos

**Ninguna dependencia nueva.** El selector de varias columnas se monta sobre
`@radix-ui/react-dropdown-menu`, que ya está en el proyecto (research R12). En
Rust solo crecen dos campos de preferencias sobre `preferences_update`.

Antes de empezar, la rama tiene que incluir lo que cerró el Incremento 4 después
de su etiqueta: el rodeo de las líneas (PR #10) y el arreglo del explorador de
carpetas (PR #11).

### Modelos de pruebas

| Archivo | Para qué |
| ------- | -------- |
| `e2e/soporte/modelo-enums.yaml` | **Nuevo.** Dos esquemas y cuatro tablas: una con llave primaria, un campo UK y dos claves foráneas sin índice; un enum de cuatro valores usado por dos campos de tablas distintas; un enum sin uso; un índice de dos columnas y un único compuesto ya hechos |
| `src/lib/model/__fixtures__/modelo-enums.yaml` | **Nuevo.** Lo mismo para la puerta 3 y para `validate.test.ts`, más un índice con `unique: true`, un enum con descripción y un enum con dos valores iguales, que el archivo admite (research R4) |
| `src/lib/model/__fixtures__/modelo-50-tablas.yaml` | Gana un enum usado por 100 campos, para medir SC-011 |
| `e2e/soporte/modelo-relaciones.yaml` | El del Incremento 4; sirve para ver pasar una clave foránea de «Sin índice» a «Indexada» |

## Comprobaciones automáticas

```bash
npm run typecheck     # TypeScript strict, sin any ni @ts-ignore
npm run lint          # eslint + puerta 7 (capas e invoke)
npm test              # Vitest: dominio, almacén y pantallas
cd src-tauri && cargo check && cargo test && cd ..
```

Las cinco tienen que pasar sin avisos nuevos (puerta 1 de la constitución).

### Pruebas que no pueden faltar

| Prueba | Qué prueba | Requisito |
| ------ | ---------- | --------- |
| `src/lib/model/enums.test.ts` | Las nueve funciones de `contracts/enums.md` §1 con sus ejemplos fijados: clase de tipo, uso, errores de nombre y de valores, nombre de la copia, renombrado en campos, tipo de reemplazo por motor y borrado que retipa | FR-005 a FR-007, FR-015, FR-018, FR-020 |
| `src/lib/model/indexes.test.ts` | Índices automáticos, separación de únicos, nombres propuestos con recorte y choque, propuesta de columnas, errores de nombre, columnas repetidas y dependientes de un campo | FR-021, FR-023 a FR-028, FR-033 a FR-037, FR-039 |
| `src/lib/model/marks.test.ts` | `cardinalityOf` con un índice único de una columna (uno a uno), con uno de dos columnas (sin cambio) y sin la marca (sin cambio) | FR-029a, SC-013 |
| `src/lib/model/validate.test.ts` | `unique` aceptado en un índice y rechazado en un único; un archivo sin `unique` sigue siendo válido | FR-042 |
| `src/lib/model/roundtrip.test.ts` | `modelo-enums.yaml` sale igual que entró, con el orden de los valores, el de las columnas y `unique` solo donde es `true` | Puerta 3, SC-007 |
| `src/store/enums.test.ts` | Crear, editar, duplicar y eliminar: un paso de historial cada uno; renombrar retipa y deshacer lo devuelve todo; eliminar retipa al tipo de reemplazo | FR-014 a FR-018, FR-041, SC-003, SC-004, SC-006 |
| `src/store/indexes.test.ts` | Las nueve acciones; la repropuesta del nombre; que ninguna deja un índice sin columnas ni un único con una | FR-023 a FR-029, FR-033 a FR-036, SC-006 |
| `src/store/tables.test.ts` | Eliminar un campo: el índice normal pierde la columna, el índice único y el único compuesto desaparecen, y deshacer los devuelve. Marcar UK nombra el único con el prefijo de Ajustes y sin repetir. Renombrar, eliminar y duplicar una tabla con índices y únicos | FR-038a, FR-039, FR-040 |
| `src/store/schemas.test.ts` | Eliminar un esquema con un enum que usa un campo de otro esquema: el campo pasa al tipo de reemplazo | FR-019 |
| `src/components/features/enum/EnumDialog.test.tsx` | Alta por teclado, reordenar y quitar, los errores de nombre y de valores, el modelo sin esquemas, «Usado por» y cancelar sin cambios | FR-001 a FR-009, FR-013, SC-002, SC-009 |
| `src/components/features/table/IndexesTab.test.tsx` y `UniquesTab.test.tsx` | Los bloques de solo lectura, los estados vacíos, los mensajes de la fila y el recorrido de la rejilla con el teclado | FR-021, FR-030, FR-032, FR-035, FR-038, FR-044 |
| `src/components/layout/ModelSidebar.test.tsx` | La sección «Enums», su contador, el filtro por esquema enfocado y el menú contextual | FR-010, FR-020 |
| `src/components/ui/MultiSelect.test.tsx` | El orden de elección, el nombre accesible y el teclado | FR-025, FR-044 |
| `src-tauri/src/preferences.rs` (pruebas del módulo) | Los seis casos de saneado de `contracts/preferences.md` | FR-043 |

## Recorrido sobre la aplicación

```bash
caffeinate -d npm run e2e
```

`caffeinate -d` evita que la pantalla se apague a mitad: con la pantalla apagada
la aplicación se queda en la pantalla de carga y el recorrido falla entero.

El escenario nuevo es `e2e/specs/12-enums-indices-unicos.e2e.js`, sobre
`e2e/soporte/modelo-enums.yaml`. Es la demostración del incremento:

| Paso | Qué se hace | Qué se espera |
| ---- | ----------- | ------------- |
| 1 | «Nuevo enum» en la barra lateral; nombre `Estado Pago`; cuatro valores con Enter | La hoja anuncia «Se guardará como estado_pago»; el enum aparece en «Enums» con «4» |
| 2 | Repetir un valor; dejar uno vacío | «Hay valores repetidos.» y «Hay valores vacíos.»; «Guardar» deshabilitado |
| 3 | Elegir `estado_pago` como tipo de dos campos de tablas distintas | Las dos tarjetas muestran `estado_pago`; ningún aviso de tipo desconocido |
| 4 | Editar el enum y renombrarlo a `estado_cobro` | Los dos campos muestran `estado_cobro`; ⌘Z devuelve el nombre al enum y a los dos campos a la vez |
| 5 | Menú contextual del enum: «Duplicar enum» | Aparece `estado_cobro_copia`, sin uso |
| 6 | «Eliminar enum…» sobre el que está en uso | La confirmación nombra los dos campos y dice «varchar(40)»; al confirmar, los dos campos son `varchar` con longitud 40; ⌘Z lo devuelve todo |
| 7 | Pestaña «Índices» de la tabla con dos claves foráneas | «Creados por restricciones» lista `pk_…` y el único del campo UK |
| 8 | «Añadir índice» | Fila con `idx_<tabla>_<fk>` y esa columna; en «Claves foráneas» la fila pasa a «Indexada» |
| 9 | Añadir una segunda columna y marcar «Único» | El nombre se repropone con las dos columnas; la marca queda puesta |
| 10 | Pestaña «Únicos»: «Añadir único»; intentar dejarlo en una columna | Fila con `uq_<tabla>_…` y dos columnas; el mensaje de «al menos dos» y las dos columnas siguen |
| 11 | Eliminar un campo del único compuesto desde «Campos» | La confirmación nombra el único; al confirmar desaparece; ⌘Z lo devuelve |
| 12 | Crear un índice único sobre la columna de una clave foránea sin UK | El inspector de la relación dice «uno a uno» y la línea cambia su glifo |
| 13 | Ajustes: «Prefijo de índices» a `ix_`; añadir otro índice | El nuevo se propone con `ix_`; los anteriores no cambian |
| 14 | Guardar, cerrar y reabrir | Enums con el orden de sus valores, índices con el orden de sus columnas y su marca, y únicos compuestos, como se dejaron (SC-007) |
| 15 | Abrir `modelo-50-tablas.yaml` y renombrar el enum de los 100 campos | El cambio se ve en menos de 200 ms (SC-011) |

Todo el escenario se hace también solo con el teclado en su paso 1 y en los
pasos 8 a 10 (SC-002, SC-008).

## Revisión manual antes de cerrar

1. **Tema claro, tema oscuro**: la hoja del enum con un error de cada clase, la
   sección «Enums», el menú contextual, la confirmación de eliminar, las dos
   pestañas con y sin filas, y el grupo «Nombres» de Ajustes. Ningún texto de
   contenido por debajo de 4,5:1 (SC-010).
2. **Los nueve estados de SC-009**, uno por uno, con su mensaje y su salida:
   están listados en `contracts/enums.md` §5 y `contracts/indexes.md` §5.
3. **Los tres motores**: crear un enum y eliminarlo en uso con PostgreSQL, MySQL
   y SQLite; la confirmación dice `varchar(40)` en los dos primeros y `text` en
   el tercero.
4. **Un archivo anterior**: abrir `e2e/soporte/modelo-relaciones.yaml`, guardar
   sin cambios y comprobar que el archivo no cambia.
5. **Windows y macOS**: el recorrido corre en los dos por
   `.github/workflows/recorrido.yml`, cuyo job pasa a nombrar los trece
   escenarios.

## Cierre del incremento

Versión del producto a `1.5.0` en `package.json`, `src-tauri/tauri.conf.json` y
`src-tauri/Cargo.toml`; `README.md` con lo que el Editor hace ahora; PR hacia
`main` con Puertas y Recorrido en verde en las dos plataformas; y la etiqueta
anotada `v1.5.0` sobre el commit de merge.
