# Contrato de preferencias · delta del Incremento 3

El contrato base es `specs/001-base-aplicacion` (comandos `preferences_load` y
`preferences_update`), ampliado por
`specs/003-lienzo-esquemas/contracts/preferences.md`. Este incremento añade dos
campos y no cambia nada más: `formatVersion` de `preferences.json` **sigue en
`1`** (research R15).

## Campos nuevos

```jsonc
{
  "formatVersion": 1,
  "theme": "system",
  "showWelcomeOnStart": true,
  "window": null,
  "lastModelPath": null,
  "engine": "postgres",
  "lastFolder": null,
  "sidebarHidden": false,
  "inspectorHidden": false,
  "snapToGrid": false,        // nuevo (FR-032)
  "fieldsPanelHeight": 320    // nuevo (FR-022)
}
```

| Campo | Tipo | Por defecto | Qué recuerda |
| ----- | ---- | ----------- | ------------ |
| `snapToGrid` | `boolean` | `false` | Las tablas se alinean a la cuadrícula al soltarlas |
| `fieldsPanelHeight` | `integer` | `320` | Alto del panel de campos, en píxeles |

`fieldsPanelHeight` se recorta a `[200, 560]` **al leer** y **al escribir**: un
archivo con `40` o con `5000` no invalida las preferencias, se queda en el tope
más cercano.

## `preferences_update`

`PreferencesPatch` acepta los dos como `Option<...>`: ausente deja el valor
anterior, presente lo cambia. Ninguno admite `null`, así que no necesitan el
`double_option` de las rutas.

```ts
// src/lib/tauri/commands.ts
await preferencesUpdate({ snapToGrid: true })
await preferencesUpdate({ fieldsPanelHeight: 420 })
```

El alto se escribe **al soltar** el tirador, no en cada `pointermove`: un
gesto, una escritura.

## Dónde se cambian

| Campo | Desde dónde |
| ----- | ----------- |
| `snapToGrid` | Ajustes, pestaña del lienzo: «Ajustar a la cuadrícula», con la nota «Las tablas se alinean a los puntos del lienzo al soltarlas» |
| `fieldsPanelHeight` | El tirador del panel de campos; no aparece en Ajustes |

## Compatibilidad

| Caso | Qué pasa |
| ---- | -------- |
| Archivo de un incremento anterior (sin los campos) | Se leen como `false` y `320` por `#[serde(default)]`; ningún aviso, ninguna copia `.bak` |
| Archivo escrito por esta build, leído por una anterior | Serde ignora los campos que no conoce; la build anterior abre normal |
| `snapToGrid` con un valor que no es booleano | El lector cae a las preferencias por defecto y guarda la copia `.bak`, igual que con cualquier otro campo mal escrito |
| `fieldsPanelHeight` fuera de `[200, 560]` | Se recorta al tope más cercano; el archivo no se trata como inválido |
