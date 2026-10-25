# Fase 1 · Validación guiada: Base de la aplicación (Incremento 0)

**Fecha**: 2026-10-24 · **Plan**: [plan.md](./plan.md) · **Spec**: [spec.md](./spec.md)

Guía para comprobar que el incremento está entregado. Lo automatizable se ejecuta con los
comandos de abajo; el cromo de ventana y la revisión visual de los temas se hacen a mano
en cada sistema, como decidió la estrategia de pruebas de
[research.md](./research.md).

## Requisitos previos

- Rust estable (1.75+) con `cargo`, y Node 20+ con el gestor de paquetes del proyecto.
- macOS 13+ con Xcode Command Line Tools, o Windows 10/11 con el runtime de WebView2.
- Sin red: la validación se hace con el equipo desconectado al menos una vez (SC-009).

## Arranque en desarrollo

```bash
npm install
npm run tauri dev
```

## Pruebas automatizadas

```bash
cargo test --manifest-path src-tauri/Cargo.toml   # preferencias, geometría, identidad
npm run test                                       # almacén, hooks, pantallas
npm run typecheck                                  # TypeScript strict, sin any
cargo check --manifest-path src-tauri/Cargo.toml   # puerta 1 de la constitución
```

Esperado: todo en verde y sin avisos nuevos. Las pruebas de Rust cubren los casos del
archivo de preferencias (ausente, vacío, JSON inválido, versión futura, ida y vuelta,
copia `.bak`) y el recorte de geometría contra monitores simulados.

## Recorrido manual, por historia

### Historia 1 · Bienvenida (P1)

1. Abre la aplicación. Debe mostrar icono, «SQL Designer» y la versión con la fecha de
   compilación, con el formato `1.0.0 (2026.10.24)`. Compara con lo que devuelve
   `app_identity`; no debe haber una cadena escrita a mano.
2. Comprueba que «Nuevo modelo…» y «Abrir modelo…» muestran su atajo con los símbolos del
   sistema: `⌘N` y `⌘O` en macOS, `Ctrl+N` y `Ctrl+O` en Windows.
3. Recorre la pantalla solo con el teclado: ambas acciones, la casilla y el acceso a
   Ajustes deben alcanzarse con foco visible en cada paso.
4. Desmarca «Mostrar esta ventana al abrir», cierra y vuelve a abrir. Sin modelo
   registrado, debe aparecer la Bienvenida otra vez y la casilla seguir desmarcada.
5. Marca la casilla de nuevo, reinicia y confirma que la Bienvenida vuelve a ser la
   pantalla de entrada.
6. Pide a alguien que no conozca la aplicación que la abra y diga qué es y qué puede hacer
   a continuación. Debe conseguirlo en 10 segundos o menos, sin ayuda (SC-002).

### Historia 2 · Tema (P2)

1. Pon el sistema en oscuro y abre la aplicación: debe salir en oscuro. Repite en claro.
2. Abre Ajustes por las tres vías y confirma que las tres funcionan: atajo `⌘,` o
   `Ctrl+,`, entrada del menú, y control visible en la Bienvenida.
3. Cambia el tema a Claro, Oscuro y Sistema. Cada cambio debe verse al instante, sin
   reiniciar, y la pantalla debe conservar casilla, foco y posición de desplazamiento.
   Haz al menos una de las tres elecciones solo con el teclado, con foco visible (SC-004).
4. Con Claro u Oscuro elegido, cambia el tema del sistema: la aplicación no debe moverse.
   Vuelve a Sistema y repite: ahora sí debe seguirlo.
5. Reinicia y confirma que la elección se conservó.
6. Activa «reducir movimiento» en el sistema y comprueba que las transiciones se
   desactivan o se acortan.
7. Revisa el contraste del texto en los dos temas (SC-006): mínimo 4.5:1, etiquetas
   secundarias incluidas.

### Historia 3 · Ventana (P3)

1. Reduce la ventana hasta el mínimo: no debe poder bajar de 820 × 500 y el contenido
   debe seguir legible, sin recortes ni superposiciones.
2. En una pantalla de 1920 × 1080, y luego con la ventana reducida al mínimo, comprueba
   que solo desplaza la sección que no cabe; la ventana completa nunca desplaza y el
   documento tampoco (RS-01, SC-005).
3. En los dos sistemas: cerrar y minimizar arriba a la izquierda, con el estilo de la
   app; el símbolo aparece al pasar el cursor y cada botón hace lo que dice. No hay
   control de maximizar.
4. Arrastra por la zona de la barra de título: la ventana debe moverse. Doble clic debe
   comportarse como en cualquier ventana del sistema.
5. Mueve y redimensiona la ventana, cierra y vuelve a abrir: debe reaparecer con ese
   tamaño y en esa posición. No debe recordar si quedó maximizada.
6. Conecta un segundo monitor, mueve la ventana ahí, cierra, desconecta el monitor y abre:
   la ventana debe aparecer completa en el monitor principal.

## Estados de error

1. Edita `preferences.json` en el directorio de configuración de la app y déjalo con JSON
   inválido. Al abrir, la aplicación debe arrancar con tema Sistema y Bienvenida visible,
   dejar una copia `.bak` del archivo dañado y una entrada en el registro.
2. Borra `preferences.json`: arranque limpio con valores por defecto, sin error visible.
3. Comprueba el archivo de registro en el directorio de logs de la app: una entrada
   fechada por cada suceso de los dos puntos anteriores (SC-010).
4. Desconecta la red y repite el arranque y el cambio de tema: nada debe degradarse
   (SC-009).

## Criterio de entrega

El incremento está listo cuando las pruebas automatizadas pasan, el recorrido manual se
completa en Windows y en macOS, y los diez criterios de éxito de
[spec.md](./spec.md) quedan comprobados. Las medidas de tiempo (SC-001 y SC-003) se toman
sobre un binario empaquetado, no en modo desarrollo.
