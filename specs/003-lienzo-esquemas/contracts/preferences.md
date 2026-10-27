# Contrato de preferencias · delta del Incremento 2

El contrato base es `specs/001-base-aplicacion` (comando `preferences_load` y
`preferences_update`). Este incremento añade dos campos y no cambia nada más:
`formatVersion` de `preferences.json` **sigue en `1`** (research R15).

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
  "sidebarHidden": false,    // nuevo (FR-006)
  "inspectorHidden": false   // nuevo (FR-006)
}
```

| Campo | Tipo | Por defecto | Qué recuerda |
| ----- | ---- | ----------- | ------------ |
| `sidebarHidden` | `boolean` | `false` | La barra lateral del Editor quedó escondida |
| `inspectorHidden` | `boolean` | `false` | El inspector del Editor quedó escondido |

## `preferences_update`

`PreferencesPatch` acepta los dos como `Option<bool>`: ausente deja el valor
anterior, presente lo cambia. No hay `null` que valga para un booleano, así que
no necesitan el `double_option` que usan las rutas.

```ts
// src/lib/tauri/commands.ts
await preferencesUpdate({ sidebarHidden: true })
```

## Compatibilidad

| Caso | Qué pasa |
| ---- | -------- |
| Archivo del Incremento 0 o 1 (sin los campos) | Se leen como `false` por `#[serde(default)]`; ningún aviso, ninguna copia `.bak` |
| Archivo escrito por esta build, leído por una anterior | Serde ignora los campos que no conoce; la build anterior abre normal |
| `sidebarHidden` con un valor que no es booleano | El lector cae a las preferencias por defecto y guarda la copia `.bak`, igual que con cualquier otro campo mal escrito |
