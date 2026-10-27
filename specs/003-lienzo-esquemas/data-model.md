# Phase 1 · Modelo de datos: Lienzo y esquemas (Incremento 2)

Tres capas, y conviene no confundirlas:

1. **El archivo** (`.yaml`, formato 1): lo único que persiste del modelo. Este
   incremento le añade un campo opcional y escribe dos que ya estaban
   reservados.
2. **Las preferencias** (`preferences.json`, propiedad de Rust): lo que persiste
   de la aplicación. Gana dos booleanos.
3. **El estado de la sesión** (almacén Zustand): la vista, el foco y la
   selección. No persiste en ninguna parte.

Lo que se dibuja —las zonas— no es ninguna de las tres: se **deriva** del modelo
con funciones puras (§4).

---

## 1 · El archivo del modelo

### 1.1 `Schema` gana `position`

```ts
/** Esquema del modelo; un modelo puede no tener ninguno (FR-005a). */
export interface Schema {
  name: string            // nombre técnico, único (RS-03)
  abbreviation: string    // tres letras mayúsculas, única (RS-04)
  color?: string          // identificador de la paleta (FR-021)
  position?: Position     // zona del esquema SIN tablas (FR-026a)
  comment?: string
}
```

| Campo      | Tipo               | Obligatorio | Reglas |
| ---------- | ------------------ | ----------- | ------ |
| `name`     | `string`           | sí          | `TECHNICAL_NAME_PATTERN`, ≤ 63, único en el modelo |
| `abbreviation` | `string`       | sí          | `ABBREVIATION_PATTERN` (`^[A-Z]{3}$`), única en el modelo |
| `color`    | `string`           | no          | Identificador de `SCHEMA_COLORS`; uno desconocido cae a `indigo` (FR-021) |
| `position` | `{x, y}`           | no          | Números finitos. **Solo** en un esquema sin tablas (FR-026a) |
| `comment`  | `string`           | no          | Texto libre |

**Orden en el archivo** (`serialize.ts`): `name`, `abbreviation`, `color`,
`position`, `comment`.

**`formatVersion` sigue en `1`.** El campo es opcional, así que todo archivo ya
guardado sigue siendo válido y una build anterior lo ignora (FR-044, research
R6).

### 1.2 La poda al leer

`parseModel` descarta `schemas[].position` de cualquier esquema que tenga al
menos una tabla. No es un error del archivo: es un dato que dejó de aplicar.
Consecuencia buscada: el modelo en memoria nunca tiene una posición que no se
deba escribir, y leer → guardar → leer sigue dando el mismo modelo (puerta 3).

### 1.3 `tables[].position`, que ya existía

Este incremento es el primero que la escribe: arrastrar una zona mueve todas sus
tablas y escribe su `position` al soltar (FR-026). Las tablas que el archivo no
trae con posición se dibujan donde las pone `resolveLayout` y **no** se escriben
hasta que el usuario las mueve (FR-013).

---

## 2 · Las preferencias

| Campo              | Tipo      | Por defecto | Para qué |
| ------------------ | --------- | ----------- | -------- |
| `sidebarHidden`    | `boolean` | `false`     | La barra lateral quedó escondida (FR-006) |
| `inspectorHidden`  | `boolean` | `false`     | El inspector quedó escondido (FR-006) |

Declarados en `src-tauri/src/preferences.rs` con `#[serde(default)]`, aceptados
por `PreferencesPatch` y aplicados en `apply_patch`. `FORMAT_VERSION` de las
preferencias sigue en `1` (research R15).

---

## 3 · El estado de la sesión

### 3.1 `CanvasSlice` (`src/store/canvas.ts`)

```ts
export interface CanvasSlice {
  /** Desplazamiento de la vista, en píxeles de pantalla. */
  pan: Position
  /** Escala, entre ZOOM_MIN y ZOOM_MAX. */
  zoom: number
  /** Nombre técnico del esquema enfocado, o null (FR-029 a FR-032). */
  focusedSchema: string | null
  /** Nombre técnico del esquema seleccionado, lo que mira el inspector. */
  selectedSchema: string | null
  /** Si hay un gesto en curso: quita sombras y transiciones (research R19). */
  isGesturing: boolean
  /** Zonas escondidas; se reflejan en preferences.json (FR-006). */
  isSidebarHidden: boolean
  isInspectorHidden: boolean

  setView: (view: { pan: Position; zoom: number }) => void
  zoomBy: (delta: number, pointer?: Position) => void
  zoomTo: (zoom: number, pointer?: Position) => void
  fitToModel: () => void
  focusSchema: (name: string | null) => void
  selectSchema: (name: string | null) => void
  setGesturing: (gesturing: boolean) => void
  toggleSidebar: () => void
  toggleInspector: () => void
}
```

Nada de esto se escribe en el archivo del modelo (FR-014, FR-032). El tamaño del
lienzo y el rectángulo de cada tarjeta no viven aquí: el lienzo los mide cuando
hace falta y los pasa a las funciones puras.

### 3.2 Transiciones

| Estado | Qué lo cambia | A qué |
| ------ | ------------- | ----- |
| `pan`, `zoom` | gesto de vista, botones, «Ajustar», enfocar, abrir un modelo | Al abrir, siempre ajustado al modelo (FR-014) |
| `focusedSchema` | clic en el nombre del esquema; Esc; «Todos los esquemas»; eliminar el esquema enfocado; cerrar el modelo | `null` en los cuatro últimos casos (FR-031, FR-032) |
| `selectedSchema` | clic en una zona o en la barra lateral; clic en el fondo | `null` al soltar la selección (FR-003) |
| `isSidebarHidden`, `isInspectorHidden` | el botón de la barra superior o su atajo | Se escribe en `preferences.json` (FR-006) |

### 3.3 Lo que el modelo cambia y pasa por el historial

| Operación del almacén | Etiqueta del paso | Requisitos |
| --------------------- | ----------------- | ---------- |
| `createSchema(draft)` | crear el esquema | FR-015 a FR-022 |
| `updateSchema(name, draft)` | editar el esquema | FR-020, FR-022 |
| `deleteSchema(name, {withTables, target})` | eliminar el esquema | FR-033 a FR-037 |
| `moveSchema(name, delta)` | mover el esquema / mover las tablas del esquema | FR-026, FR-026a, FR-027 |

Un gesto entero es un paso (research R3, R16). `moveSchema` toma la etiqueta
«mover el esquema» cuando el esquema está vacío —escribe `schemas[].position`— y
«mover las tablas del esquema» cuando tiene tablas —escribe `tables[].position`
de cada una y borra `schemas[].position` si quedara alguna—.

---

## 4 · Lo que se deriva: geometría

Todo en `src/lib/canvas/`, puro y sin DOM (research R4, R5).

```ts
/** Medidas de diseño, tomadas del tablero Editor del lienzo. */
export const TABLE_WIDTH = 200
export const TABLE_HEIGHT = 64
export const ZONE_PADDING = 20
export const ZONE_HEADER = 40
export const EMPTY_ZONE_WIDTH = 240
export const EMPTY_ZONE_HEIGHT = 180
export const ZOOM_MIN = 0.4
export const ZOOM_MAX = 2
export const FIT_MARGIN = 48

export interface Rect { x: number; y: number; width: number; height: number }

/** Posición de cada tabla: la del archivo, o la calculada (FR-013). */
export function resolveLayout(model: Model): Map<string, Position>

/** Zona de cada esquema, en el orden del modelo (FR-023 a FR-026a). */
export function schemaZones(model: Model, layout: Map<string, Position>): SchemaZone[]

/** Envolvente de todas las zonas y tablas, o null con el modelo vacío. */
export function contentBounds(zones: SchemaZone[]): Rect | null

/** Vista que deja `bounds` visible con margen; con null, 100 % centrado. */
export function fitToContent(bounds: Rect | null, viewport: Rect): View

/** Vista que conserva el punto del modelo bajo el puntero (FR-009). */
export function zoomAt(view: View, zoom: number, pointer: Position): View
```

### 4.1 `SchemaZone`

| Campo | De dónde sale |
| ----- | ------------- |
| `schema` | El nombre técnico |
| `rect` | Con tablas: envolvente de sus tablas + `ZONE_PADDING` a los lados y abajo, `ZONE_HEADER` arriba. Sin tablas: `schemas[].position` si la trae, o la posición determinista por su orden en el modelo, con tamaño `EMPTY_ZONE_*` |
| `isEmpty` | `true` cuando el esquema no tiene tablas (FR-025) |
| `color` | `schemas[].color` resuelto contra la paleta (FR-021) |
| `tableCount` | Cuántas tablas tiene, para el rótulo (FR-024) |

### 4.2 Reglas que la geometría garantiza

- Una zona nunca queda sin rótulo: el alto mínimo es `ZONE_HEADER + ZONE_PADDING`.
- Dos zonas de un modelo recién abierto **sin** posiciones no se solapan, porque
  `resolveLayout` da a cada esquema su banda horizontal (FR-028). Las posiciones
  que el usuario guardó se respetan tal cual, también si las dejó solapadas.
- «Ajustar» siempre trae a la vista cualquier posición del archivo, porque parte
  del envolvente y no de una zona fija (FR-011).

---

## 5 · La paleta de colores

`src/lib/model/colors.ts`:

```ts
export interface SchemaColor { id: string; label: string }

/** Los once colores de la paleta, en el orden en que se muestran. */
export const SCHEMA_COLORS: SchemaColor[]

/** Color por defecto y destino de un identificador desconocido (FR-021). */
export const DEFAULT_SCHEMA_COLOR = 'indigo'

/** El identificador si está en la paleta, DEFAULT_SCHEMA_COLOR si no. */
export function resolveSchemaColor(color: string | undefined): string
```

| `id` | Nombre | | `id` | Nombre |
| ---- | ------ | - | ---- | ------ |
| `gray` | Grafito | | `orange` | Naranja |
| `blue` | Azul | | `yellow` | Amarillo |
| `indigo` | Índigo | | `brown` | Marrón |
| `purple` | Morado | | `green` | Verde |
| `pink` | Rosa | | `teal` | Teal |
| `red` | Rojo | | | |

En el archivo viaja el `id`; el valor del color sale del token `--<id>` de
`src/styles/tokens.css`, de modo que claro y oscuro salen del mismo nombre
(principio V).

---

## 6 · Validación

Lo que `src/lib/model/validate.ts` añade:

| Caso | Mensaje | Dónde se ve |
| ---- | ------- | ----------- |
| `schemas[].position` con una clave desconocida | «La posición solo admite «x» e «y».» | Diálogo de archivo inválido |
| `schemas[].position.x` o `.y` que no es número finito | ««x» de la posición tiene que ser un número.» | Diálogo de archivo inválido |

Y lo que valida el diálogo de esquema, sin tocar el archivo (FR-018):

| Caso | Mensaje |
| ---- | ------- |
| Nombre legible vacío | «Escribe un nombre para el esquema.» |
| Nombre técnico vacío | «Escribe el nombre técnico del esquema.» |
| Nombre técnico con forma inválida | «Usa minúsculas, números y guion bajo; no empieces por un número.» |
| Nombre técnico repetido | «Ya existe un esquema con este nombre técnico.» |
| Abreviatura que no son tres letras | «La abreviatura son tres letras.» |
| Abreviatura repetida | «Ya la usa otro esquema.» |

`schemas[].position` no se valida contra «el esquema tiene tablas»: ese caso se
poda al leer (§1.2), no se rechaza.
