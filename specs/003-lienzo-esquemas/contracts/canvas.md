# Contrato del lienzo y de los esquemas

Lo que este incremento expone: las funciones puras de `src/lib/canvas/`, las
acciones del almacén, los gestos del lienzo, los atajos y el nombre accesible de
cada pieza. No hay comandos de Tauri nuevos: el lienzo es todo frontend, y lo
único que cruza la frontera son los dos campos de preferencias de
`contracts/preferences.md`.

---

## 1 · Funciones puras (`src/lib/canvas/`)

```ts
export interface Rect { x: number; y: number; width: number; height: number }
export interface View { pan: Position; zoom: number }

export interface SchemaZone {
  schema: string        // nombre técnico del esquema
  rect: Rect            // en coordenadas del modelo
  isEmpty: boolean
  color: string         // identificador de la paleta, ya resuelto
  tableCount: number
}
```

| Función | Entrada | Salida | Garantías |
| ------- | ------- | ------ | --------- |
| `resolveLayout(model)` | El modelo | `Map<nombre de tabla, Position>` | Determinista: el mismo modelo da el mismo mapa. Una tabla con `position` en el archivo sale con esa posición sin tocar |
| `schemaZones(model, layout)` | Modelo y mapa de `resolveLayout` | Una zona por esquema, en el orden del modelo | Una zona con tablas las contiene a todas; el alto nunca baja de `ZONE_HEADER + ZONE_PADDING`; una zona vacía mide `EMPTY_ZONE_WIDTH × EMPTY_ZONE_HEIGHT` |
| `contentBounds(zones)` | Las zonas | El envolvente, o `null` | `null` solo con un modelo sin tablas y sin zonas con posición |
| `fitToContent(bounds, viewport)` | Envolvente y caja del lienzo | `View` | Con `bounds` deja todo dentro de `viewport` con `FIT_MARGIN` de margen y el zoom recortado a `[ZOOM_MIN, ZOOM_MAX]`; con `null` devuelve `{ pan: {x: 0, y: 0}, zoom: 1 }` |
| `zoomAt(view, zoom, pointer)` | Vista, zoom pedido y puntero en coordenadas del lienzo | `View` | El punto del modelo bajo `pointer` sigue bajo `pointer`; el zoom se recorta a los topes |
| `clampZoom(zoom)` | Un número | Un número en `[ZOOM_MIN, ZOOM_MAX]` | — |

```ts
// src/lib/model/propose.ts
export function toTechnicalName(name: string): string
export function toAbbreviation(name: string): string
```

| Entrada | `toTechnicalName` | `toAbbreviation` |
| ------- | ----------------- | ---------------- |
| `Ventas y cobros` | `ventas_y_cobros` | `VYC` |
| `Unidad residencial` | `unidad_residencial` | `URE` |
| `Cartera` | `cartera` | `CAR` |
| `Área 51` | `area_51` | `A51` |
| `3 puertas` | `_3_puertas` | `3PU` |
| `  ` (vacío) | `` | `` |

Las dos devuelven cadena vacía cuando no queda nada que proponer; el diálogo
entonces no propone y espera que el usuario escriba (FR-016, FR-018).

La regla de `toAbbreviation` es la inicial de cada una de las tres primeras
palabras y, si el nombre no tiene tres, se sigue tomando letras de la última
hasta llegar a tres, rellenando con `X` si aun así no llegan. La tabla decía
`VEN` para «Ventas y cobros», que es un nombre de tres palabras y por tanto
propone `VYC`; se corrigió al implementar.

---

## 2 · Acciones del almacén

### 2.1 Vista y foco (`CanvasSlice`)

| Acción | Efecto | No hace |
| ------ | ------ | ------- |
| `setView({pan, zoom})` | Fija la vista; el zoom se recorta a los topes | No toca el modelo ni marca «Editado» |
| `zoomBy(delta, pointer?)` | Suma al zoom conservando el punto bajo el puntero; sin puntero, el centro del lienzo | — |
| `zoomTo(zoom, pointer?)` | Igual, con un zoom absoluto | — |
| `fitToModel()` | Aplica `fitToContent` sobre el modelo entero | — |
| `focusSchema(name \| null)` | Enfoca y centra en su zona; `null` quita el foco | No filtra el modelo: filtra lo que se muestra |
| `selectSchema(name \| null)` | Lo que mira el inspector | — |
| `toggleSidebar()`, `toggleInspector()` | Cambian la disposición y escriben la preferencia | No entran en el historial |

### 2.2 Esquemas (`ModelSlice`)

| Acción | Entrada | Efecto | Errores |
| ------ | ------- | ------ | ------- |
| `createSchema(draft)` | `{name, technicalName, abbreviation, color, comment?}` | Añade el esquema al final de `schemas`, marca «Editado», deja el paso «crear el esquema» | No escribe nada si el nombre técnico o la abreviatura están repetidos: el diálogo lo impide antes (FR-018) |
| `updateSchema(name, draft)` | El nombre técnico actual y el borrador | Cambia los campos y, si cambió el nombre técnico, lo propaga a las tablas, enums y vistas del esquema. Paso «editar el esquema» | Igual que arriba |
| `deleteSchema(name, {withTables, target})` | `withTables` del interruptor; `target` el esquema de destino | Con `withTables` quita el esquema y sus tablas, enums, vistas y las relaciones que los tocaban; sin él, mueve tablas, enums y vistas a `target`. Paso «eliminar el esquema» | No hace nada si es el único esquema del modelo (FR-035) ni si `target` no existe |
| `moveSchema(name, delta)` | El desplazamiento del gesto, en coordenadas del modelo | Con tablas, suma `delta` a la `position` de cada una —resolviendo primero las que no la traían— y borra `schemas[].position`; sin tablas, escribe `schemas[].position`. Un solo paso | — |

Las cuatro pasan por el historial del Incremento 1 y se deshacen en un paso
(FR-022, FR-027, FR-037, RS-06).

---

## 3 · Gestos del lienzo

| Gesto | Entrada | Resultado | Requisito |
| ----- | ------- | --------- | --------- |
| Arrastrar el fondo | `pointerdown` con botón 0 sobre el fondo | Mueve la vista | FR-007 |
| Arrastrar con el botón central | `pointerdown` con botón 1, en cualquier sitio | Mueve la vista; se cancela el autoscroll de Windows | FR-007 |
| Espacio + arrastrar | `keydown` de `Space` mantenido, en cualquier sitio | Mueve la vista; el cursor pasa a `grab`; se suelta en `keyup` y en `blur` | FR-007 |
| ⌘/Ctrl + rueda | `wheel` con `metaKey` o `ctrlKey` | Zoom en el puntero | FR-008, FR-009 |
| Pellizco del panel táctil | `wheel` con `ctrlKey` sintético | Zoom en el puntero | FR-008 |
| Rueda sola | `wheel` | Mueve la vista | FR-007 |
| Arrastrar una zona | `pointerdown` con botón 0 sobre una zona | Mueve la zona y sus tablas; al soltar, un paso de historial | FR-026, FR-026a, FR-027 |
| Menú contextual | `contextmenu` o ⇧F10 sobre una zona o su fila de la barra lateral | «Editar esquema…», «Eliminar esquema…» | FR-033, FR-038 |
| Pulsar o arrastrar en el minimapa | `pointerdown` / `pointermove` dentro del minimapa | Mueve la vista a ese punto | FR-012 |

Durante cualquiera de ellos, `isGesturing` está en `true` y el lienzo pinta sin
sombras ni transiciones (research R19).

---

## 4 · Atajos

| Atajo (macOS / Windows) | Acción | Requisito |
| ----------------------- | ------ | --------- |
| ⌥⌘S / Alt+Ctrl+S | Esconder o mostrar la barra lateral | FR-006 |
| ⌥⌘I / Alt+Ctrl+I | Esconder o mostrar el inspector | FR-006 |
| ⌘+ / Ctrl++ y ⌘− / Ctrl+− | Acercar y alejar | FR-008 |
| ⌘0 / Ctrl+0 | Volver al 100 % | FR-008 |
| ⇧1 | Ajustar | FR-010 |
| Flechas (lienzo enfocado) | Mover la vista | FR-039 |
| Tab / ⇧Tab | Recorrer zonas y tablas | FR-039 |
| Esc | Quitar el foco del esquema | FR-031 |
| ⌘Z / Ctrl+Z, ⇧⌘Z / Ctrl+Y | Deshacer y rehacer | FR-022 |

«Nuevo esquema» no tiene atajo de tecla; se justifica en `research.md` R18.

---

## 5 · Nombres accesibles

| Pieza | Rol y nombre |
| ----- | ------------ |
| Lienzo | `aria-label="Lienzo del modelo"`, con `tabindex="0"` |
| Zona de un esquema con tablas | Botón, `Esquema VEN · Ventas, 3 tablas` |
| Zona de un esquema sin tablas | Botón, `Esquema VEN · Ventas, sin tablas` |
| Tarjeta de una tabla | Botón, `Tabla facturas, esquema VEN · Ventas, 7 campos` |
| Fila del esquema en la barra lateral | Opción de lista, `Ventas, 3 tablas`; `aria-current` cuando está enfocado |
| «Todos los esquemas» | Opción de lista, `aria-current` cuando no hay foco |
| Porcentaje de zoom | `aria-live="polite"` |
| Minimapa | `aria-label="Minimapa del modelo"` |
| Barra de estado | `aria-live="polite"` para el estado del archivo, el resto estático |
| Paleta de colores | Grupo de radio, `aria-label="Color del esquema"`; cada color con su nombre («Índigo») |
| Interruptor de la confirmación | `role="switch"`, `Eliminar también sus 3 tablas` |

El color nunca es el único portador de la información: la abreviatura y el
nombre están siempre en el rótulo (FR-040).
