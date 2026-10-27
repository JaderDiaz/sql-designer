# SQL Designer

Diseñador visual de bases de datos relacionales para Windows y macOS: modela
esquemas, tablas y relaciones, y genera SQL, documentación e imagen del
diagrama. No se conecta a ninguna base de datos ni la administra.

[![Puertas](https://github.com/JaderDiaz/sql-designer/actions/workflows/puertas.yml/badge.svg)](https://github.com/JaderDiaz/sql-designer/actions/workflows/puertas.yml)
[![Recorrido](https://github.com/JaderDiaz/sql-designer/actions/workflows/recorrido.yml/badge.svg)](https://github.com/JaderDiaz/sql-designer/actions/workflows/recorrido.yml)

## Estado

Versión 1.1.0, Incremento 1 «Archivos de modelo» cerrado. Lo que ya hace:

- Arranca con la Bienvenida y su identidad, sigue el tema del sistema o el
  elegido en Ajustes y recuerda el tamaño y la posición de la ventana
  (Incremento 0).
- Crea un modelo con su nombre, su motor, su carpeta y su archivo `.yaml`.
- Abre un archivo de modelo con vista previa, y dice la línea del error cuando
  el archivo está roto.
- Guarda con ⌘S, distingue «Guardado» de «Editado», avisa si el archivo cambió
  en el disco y no pierde el cambio cuando no puede escribir.
- Cierra el modelo preguntando por los cambios sin guardar.
- Lista los diez modelos recientes con su estado, y sobre cada uno: abrir,
  renombrar, copiar la ruta, quitar de la lista y mover a la papelera.

Diseñar tablas, columnas y relaciones llega en el Incremento 2, que todavía no
ha empezado.

## Requisitos

- Node.js 22.15 o superior y npm (lo pide el recorrido automatizado: WebdriverIO
  arrastra un `undici` que usa `createZstdDecompress`, que no existe antes; en
  GitHub se usa la 24)
- Rust 1.75 o superior (`rustup`)
- Las dependencias de sistema de Tauri 2 (en macOS, las Command Line Tools de Xcode)

## Arrancar

```bash
npm install          # instala dependencias
npm run tauri dev    # abre la aplicación en una ventana nativa
npm run dev          # solo el frontend, en el navegador
```

## Probar

Las cinco puertas, que son las que tienen que estar en verde antes de cualquier
commit:

```bash
npm run typecheck                               # TypeScript en modo strict
npm run lint                                    # ESLint y la puerta 7 de la constitución
npm test                                        # Vitest: modelo, almacén, hooks y pantallas
cargo check --manifest-path src-tauri/Cargo.toml
cargo test --manifest-path src-tauri/Cargo.toml # preferencias, archivos, recientes e identidad
```

Y el recorrido de los ocho escenarios del Incremento 1, que conduce la
aplicación de verdad con WebdriverIO:

```bash
npm run e2e          # compila el binario del recorrido y ejecuta los escenarios
```

Esto compila con la bandera `webdriver`, que mete un servidor de WebDriver
dentro de la aplicación y abre automatización en `127.0.0.1:4445`. No entra en
ninguna compilación normal ni en la de publicación. Corre en macOS y en
Windows, y en cada sistema comprueba lo que allí cambia: los símbolos de los
atajos, el nombre del gestor de archivos y las rutas del estado del usuario.

En cada empuje y en cada PR, GitHub repite las cinco puertas en macOS y en
Windows (`.github/workflows/puertas.yml`), y cuando el PR va hacia `main`, el
recorrido completo en los dos sistemas (`.github/workflows/recorrido.yml`).

Lo que ninguna máquina puede comprobar —el tema del sistema, «Reducir
movimiento», que el Finder abra con el archivo seleccionado— queda anotado como
recorrido manual en
[`specs/001-base-aplicacion/quickstart.md`](specs/001-base-aplicacion/quickstart.md)
y
[`specs/002-archivos-modelo/quickstart.md`](specs/002-archivos-modelo/quickstart.md).

## Empaquetar

```bash
npm run tauri build
```

El juego de iconos ya está en `src-tauri/icons/`, generado desde `icon.svg` con
`npm run tauri icon`. Hay que rehacerlo solo si cambia el dibujo; el arte deja
100 px de margen por lado dentro del lienzo de 1024, que es lo que espera la
rejilla de iconos de macOS.

### Medir el arranque y el cambio de tema

El binario anota SC-001 y SC-003 en el registro solo si se le pide, para no
dejar trazas de uso en una ejecución normal:

```bash
SQL_DESIGNER_MEDIR=1 "src-tauri/target/release/bundle/macos/SQL Designer.app/Contents/MacOS/sql-designer"
```

El procedimiento completo y los números medidos están en
[`specs/001-base-aplicacion/quickstart.md`](specs/001-base-aplicacion/quickstart.md).

## Dónde viven los datos

La aplicación no guarda nada fuera del equipo. Sus tres archivos locales:

| Archivo             | macOS                                                                       | Windows                                                           |
| ------------------- | --------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Preferencias        | `~/Library/Application Support/com.jaderdiaz.sql-designer/preferences.json` | `%APPDATA%\com.jaderdiaz.sql-designer\preferences.json`           |
| Modelos recientes   | `~/Library/Application Support/com.jaderdiaz.sql-designer/recents.json`     | `%APPDATA%\com.jaderdiaz.sql-designer\recents.json`               |
| Registro de errores | `~/Library/Logs/com.jaderdiaz.sql-designer/sql-designer.log`                | `%LOCALAPPDATA%\com.jaderdiaz.sql-designer\logs\sql-designer.log` |

Si el archivo de preferencias no se puede leer, la aplicación abre con los
valores por defecto, deja una copia `preferences.json.bak` junto al original y
anota la causa en el registro.

## Estructura

```text
src-tauri/   Contenedor y backend en Rust: ventana, menús, preferencias, registro
src/         Interfaz: componentes, hooks, almacén y tokens de diseño
scripts/     Comprobaciones de las puertas de calidad y compilación del recorrido
e2e/         Recorrido automatizado: conduce la aplicación de verdad
.github/     Workflows que corren las puertas y el recorrido en cada PR
specs/       Especificaciones Spec Kit por incremento
```

Las reglas que el código no puede romper están en
[`.specify/memory/constitution.md`](.specify/memory/constitution.md).
