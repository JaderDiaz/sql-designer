# Contrato de preferencias · delta del Incremento 5

El contrato base es `specs/001-base-aplicacion` (comandos `preferences_load` y
`preferences_update`), ampliado por los deltas de los Incrementos 2, 3 y 4; el
último es `specs/005-relaciones/contracts/preferences.md`. Este incremento añade
dos campos y no cambia nada más: `formatVersion` de `preferences.json` **sigue
en `1`** (research R17).

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
  "relationRoute": "orthogonal",
  "relationAnimation": "subtle",
  "foreignKeyPattern": "{tabla}_{pk}",
  "indexPrefix": "idx_",   // nuevo (FR-024, FR-043)
  "uniquePrefix": "uq_"    // nuevo (FR-034, FR-043)
}
```

| Campo | Tipo | Por defecto | Qué recuerda |
| ----- | ---- | ----------- | ------------ |
| `indexPrefix` | `string` | `"idx_"` | Con qué empieza el nombre propuesto de un índice |
| `uniquePrefix` | `string` | `"uq_"` | Con qué empieza el nombre propuesto de un único compuesto |

## Reglas de lectura

1. **Campo ausente**: se usa el valor por defecto, sin aviso, como los campos
   que estrenaron los incrementos anteriores.
2. **Valor de otro tipo** (un número, `null`): se usa el valor por defecto.
3. **Texto que no puede empezar un nombre técnico**: se sanea —se recortan los
   espacios, se pasa a minúsculas y se descarta todo lo que no sea letra sin
   acento, número o guion bajo— y se limita a 16 caracteres. Si después no queda
   nada, o lo que queda empieza por número, se usa el valor por defecto.

## Reglas de escritura

1. `preferences_update` acepta los dos campos en su parche, cada uno opcional.
2. El valor que se guarda es el saneado, no el recibido, y es el que el comando
   devuelve: la interfaz muestra lo que quedó en el disco.
3. Cambiar un prefijo no toca ningún modelo: solo cambia lo que se propone a
   partir de ahí (FR-043).

## Interfaz

Ajustes gana un grupo «Nombres» con dos campos de texto, «Prefijo de índices» y
«Prefijo de únicos», cada uno con su ejemplo debajo («Ejemplo:
idx_pago_residente_id»). El campo escribe al perder el foco o con Enter, no en
cada tecla, y después muestra el valor saneado.

## Rust

`src-tauri/src/preferences.rs` gana `index_prefix` y `unique_prefix` en
`Preferences` y en `PreferencesPatch`, con `#[serde(default = …)]`, y una
función `clamp_name_prefix(text, default)` que aplica las reglas de lectura. Se
prueba con: campo ausente, valor de otro tipo, texto con mayúsculas y espacios,
texto solo con símbolos, texto que empieza por número y texto de más de 16
caracteres. Ningún comando nuevo y ningún permiso nuevo en `capabilities/`.
