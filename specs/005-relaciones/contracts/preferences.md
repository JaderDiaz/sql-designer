# Contrato de preferencias · delta del Incremento 4

El contrato base es `specs/001-base-aplicacion` (comandos `preferences_load` y
`preferences_update`), ampliado por
`specs/003-lienzo-esquemas/contracts/preferences.md` y
`specs/004-tablas-campos/contracts/preferences.md`. Este incremento añade tres
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
  "snapToGrid": false,
  "fieldsPanelHeight": 320,
  "relationRoute": "orthogonal",       // nuevo (FR-017)
  "relationAnimation": "subtle",       // nuevo (FR-024)
  "foreignKeyPattern": "{tabla}_{pk}"  // nuevo (FR-004)
}
```

| Campo | Tipo | Por defecto | Qué recuerda |
| ----- | ---- | ----------- | ------------ |
| `relationRoute` | `"orthogonal"` \| `"curved"` \| `"straight"` | `"orthogonal"` | Trazado de las líneas del diagrama |
| `relationAnimation` | `"off"` \| `"subtle"` \| `"lively"` | `"subtle"` | Flujo de las relaciones resaltadas |
| `foreignKeyPattern` | `string` | `"{tabla}_{pk}"` | Patrón del nombre de la columna propuesta |

## Reglas de lectura

1. **Campo ausente**: se usa el valor por defecto, sin aviso. Es el mismo
   comportamiento que `snapToGrid` y `fieldsPanelHeight` estrenaron en el
   Incremento 3, y por eso la versión no sube.
2. **Valor fuera del enum**: se usa el valor por defecto, sin invalidar el
   archivo de preferencias.
3. **`foreignKeyPattern`**: se recorta a 64 caracteres. Un patrón sin `{tabla}`
   ni `{pk}` se acepta tal cual —es un nombre fijo, y el sufijo numérico de
   FR-004 evita el choque—; un patrón vacío cae al valor por defecto.
4. **`relationAnimation` frente al sistema**: con «Reducir movimiento» activo no
   se anima nada, cualquiera que sea el valor guardado (FR-025). La preferencia
   no se cambia por eso: se respeta cuando el sistema deja de pedirlo.

## Reglas de escritura

- Los tres campos se escriben por `preferences_update` con el parche de siempre:
  el campo ausente no se toca.
- `relationRoute` y `relationAnimation` se escriben al cambiar su control en
  Ajustes, sin esperar a cerrar la ventana.
- Ningún comando nuevo y ningún permiso nuevo en `src-tauri/capabilities/`.

## Rust

Los tres campos entran en `src-tauri/src/preferences.rs` con
`#[serde(default = "…")]` y su función de valor por defecto, igual que
`fields_panel_height`. El recorte del patrón vive en Rust, al lado del recorte
del alto del panel, para que la interfaz no pueda guardar un valor imposible.
