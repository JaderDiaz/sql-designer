# SQL Designer

Diseñador visual de bases de datos relacionales para Windows y macOS: modela
esquemas, tablas y relaciones, y genera SQL, documentación e imagen del
diagrama. No se conecta a ninguna base de datos ni la administra.

## Estado

Incremento 0 «Base de la aplicación»: la aplicación arranca, muestra la
Bienvenida con su identidad, sigue el tema del sistema o el elegido en Ajustes,
y recuerda el tamaño y la posición de la ventana. Crear y abrir modelos llega en
el Incremento 1.

## Requisitos

- Node.js 20 o superior y npm
- Rust 1.75 o superior (`rustup`)
- Las dependencias de sistema de Tauri 2 (en macOS, las Command Line Tools de Xcode)

## Arrancar

```bash
npm install          # instala dependencias y copia las fuentes Geist
npm run tauri dev    # abre la aplicación en una ventana nativa
npm run dev          # solo el frontend, en el navegador
```

## Probar

```bash
npm run test                                    # Vitest: almacén, hooks y pantallas
npm run typecheck                               # TypeScript en modo strict
npm run lint                                    # ESLint y la puerta 7 de la constitución
cargo test --manifest-path src-tauri/Cargo.toml # preferencias, geometría e identidad
cargo check --manifest-path src-tauri/Cargo.toml
```

El recorrido manual por historia está en
[`specs/001-base-aplicacion/quickstart.md`](specs/001-base-aplicacion/quickstart.md).

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

La aplicación no guarda nada fuera del equipo. Sus dos archivos locales:

| Archivo             | macOS                                                                       | Windows                                                           |
| ------------------- | --------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Preferencias        | `~/Library/Application Support/com.jaderdiaz.sql-designer/preferences.json` | `%APPDATA%\com.jaderdiaz.sql-designer\preferences.json`           |
| Registro de errores | `~/Library/Logs/com.jaderdiaz.sql-designer/sql-designer.log`                | `%LOCALAPPDATA%\com.jaderdiaz.sql-designer\logs\sql-designer.log` |

Si el archivo de preferencias no se puede leer, la aplicación abre con los
valores por defecto, deja una copia `preferences.json.bak` junto al original y
anota la causa en el registro.

## Estructura

```text
src-tauri/   Contenedor y backend en Rust: ventana, menús, preferencias, registro
src/         Interfaz: componentes, hooks, almacén y tokens de diseño
scripts/     Comprobaciones de las puertas de calidad y copia de fuentes
specs/       Especificaciones Spec Kit por incremento
```

Las reglas que el código no puede romper están en
[`.specify/memory/constitution.md`](.specify/memory/constitution.md).
