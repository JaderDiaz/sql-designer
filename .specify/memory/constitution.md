# SQL Designer Constitution

## Core Principles

### I. Modelado Local Sin Conexión (NO NEGOCIABLE)

SQL Designer diseña bases de datos relacionales; NO las administra. El binario
MUST funcionar sin red y sin credenciales.

- PROHIBIDO incluir drivers de base de datos, clientes de red hacia motores SQL,
  telemetría, analítica o cualquier petición HTTP en tiempo de ejecución.
- PROHIBIDO en v1.0: conectar a una base real, importar SQL existente, ingeniería
  inversa, sincronizar cambios y colaboración en tiempo real.
- Las fuentes (Geist, Geist Mono) y todo asset se empaquetan con la aplicación; no
  se cargan desde un CDN.

Rationale: el alcance exclusivo de modelado es lo que permite una app ligera,
auditable y usable sin permisos de infraestructura; cada conexión añadida
convierte el producto en otro y multiplica su superficie de ataque.

### II. El Archivo del Modelo es la Única Fuente de Verdad

El `.yaml` del modelo define todo: esquemas, enums, tablas, campos, llaves,
relaciones, índices, únicos, vistas, motor y posiciones en el lienzo.

- Un único generador MUST producir todo el SQL (panel SQL de la tabla, «Copiar SQL»
  y Exportar). PROHIBIDO un segundo camino de generación por pantalla.
- El motor (`postgres`, `mysql`, `sqlite`) viaja con el modelo; el motor de Ajustes
  solo define el de los modelos nuevos.
- Toda salida (SQL, imagen, diccionario, YAML) MUST derivarse del modelo en memoria,
  nunca de lo que una vista haya renderizado.
- El formato del archivo lleva versión; un cambio incompatible exige nota de
  migración y lectura de los archivos de la versión anterior.

Rationale: una sola fuente y un solo generador hacen que SQL, documentación e
imagen no puedan contradecirse, que es la promesa del producto.

### III. Frontera Rust ↔ TypeScript Explícita

Todo lo que toca el sistema operativo vive en Rust y se expone como comando Tauri
con tipos declarados; la interfaz solo invoca comandos.

- Sistema de archivos, diálogos nativos, papelera, «Mostrar en Finder/Explorador»,
  rutas, ventana, menús nativos y lista de recientes: Rust.
- El frontend MUST NOT asumir rutas, separadores ni APIs del sistema operativo;
  los pide al backend.
- Ningún comando puede bloquear la interfaz: el trabajo largo es asíncrono y la UI
  conserva una salida visible.
- Los errores de un comando se devuelven como valores tipados, nunca como `panic!`.

Rationale: la frontera estrecha es lo que da «cero cuelgues» y lo que mantiene el
mismo diseño funcionando en WebView2 y en WebKit.

### IV. Tipado Estricto y Estado Único

TypeScript en modo `strict` y un único almacén Zustand como estado de la aplicación.

- PROHIBIDO `any` y `@ts-ignore` en código de producción; una excepción requiere
  comentario con la razón.
- El estado del modelo vive en Zustand; los componentes leen por selectores y no
  duplican estado derivado. PROHIBIDO Redux u otro gestor paralelo.
- Los tipos del modelo son uno solo, compartidos por editor, generador y
  serializador; la forma del `.yaml` se valida al cargar.
- El estado de interfaz efímero (hover, foco, apertura de un menú) no entra en el
  estado del modelo.

Rationale: el modelo es un grafo con muchas vistas simultáneas; un estado único y
tipado es lo que evita que el lienzo, el inspector y el SQL discrepen.

### V. Sistema de Diseño por Tokens

Radix UI (shadcn/ui) para el comportamiento, Tailwind sobre tokens para el aspecto,
Framer Motion con resortes para el movimiento.

- Todo color, sombra, radio, duración y curva MUST salir de un token; PROHIBIDO un
  valor literal en un componente. Excepciones únicas: el icono de la app y la imagen
  exportada, que resuelve los tokens a color fijo.
- Los primitivos de menú, diálogo, popover, selección y atajos se construyen sobre
  Radix o React Aria; PROHIBIDO reimplementar foco, rol ARIA o navegación de teclado
  a mano.
- Tema claro y oscuro son ambos obligatorios, y toda animación respeta
  `prefers-reduced-motion`.
- Cada zona de la interfaz tiene un solo trabajo; una misma acción no se duplica en
  dos zonas salvo como atajo de teclado o entrada de la paleta de comandos.
- Toda acción alcanzable con el ratón MUST tener forma de hacerse con el teclado;
  contraste de texto ≥ 4.5:1 en los dos temas.

Rationale: el aspecto «sutil, inspirado en Apple» no sobrevive a valores sueltos ni
a componentes caseros; los tokens y los primitivos accesibles lo hacen repetible.

### VI. Reversibilidad y Confirmación

El usuario nunca pierde trabajo sin haberlo dicho.

- Todo cambio al modelo MUST ser deshacible y rehacible, con etiqueta de qué cambió.
- Nada se escribe al archivo hasta Guardar; mientras haya cambios el modelo se marca
  «Editado» y al cerrar se pregunta.
- Eliminar cualquier objeto (tabla, esquema, vista, enum, archivo) pide confirmación
  y declara qué más queda afectado.
- Cada estado del sistema (modelo vacío, archivo con errores, archivo no encontrado,
  nombre repetido, sin resultados) MUST tener mensaje visible y salida clara.

Rationale: el modelado es exploratorio; sin deshacer fiable y sin confirmaciones
honestas el usuario diseña con miedo y la herramienta estorba.

### VII. Estructura por Capas y Sistema de Diseño Puro

El árbol de directorios es contrato, no sugerencia: el sistema operativo vive en
`src-tauri/`, la interfaz en `src/`, y dentro de `src/` cada carpeta tiene una
responsabilidad única (ver Estructura del Proyecto).

- Los componentes de `src/components/ui/` MUST ser puros: reciben props y nada más.
  PROHIBIDO que importen del almacén (`src/store/`), de `src/components/features/` o
  de lógica de dominio. Un componente del sistema de diseño se usa igual en cualquier
  pantalla y se puede probar en aislamiento.
- Las dependencias van en una sola dirección: `features` → `ui` y `features` → `store`;
  nunca `ui` → `features` ni `ui` → `store`.
- `src/components/layout/` es el único sitio donde vive la estructura de ventana
  (titlebar propia con sus controles, barra lateral, layout del editor).
- Toda llamada a un comando de Tauri MUST pasar por una función tipada de `src/lib/`.
  PROHIBIDO `invoke` suelto en un componente o en un hook de `src/hooks/`.
- Los tokens de diseño se declaran en `src/styles/` y `tailwind.config.js`; `src/assets/`
  guarda fuentes e iconos empaquetados con la app.

Rationale: aislar el sistema de diseño es lo que permite rediseñar sin tocar dominio y
cambiar dominio sin romper el aspecto; concentrar `invoke` en `src/lib/` deja la frontera
del principio III en un único lugar auditable.

### VIII. Documentación JSDoc en Español

Toda función, clase, método, componente, hook y proceso nuevo MUST llevar un bloque
JSDoc en español encima de su declaración.

- El bloque es breve y concreto: una línea de qué hace y, cuando la firma no lo deje
  claro, `@param`, `@returns` y `@throws`. PROHIBIDO narrar el cuerpo línea a línea o
  repetir el tipo que ya declara TypeScript.
- Un proceso de varios pasos (cargar preferencias, exportar, arrancar la ventana)
  documenta en su punto de entrada el orden de los pasos y el efecto de cada uno, en
  cinco líneas o menos.
- En Rust el equivalente es el comentario de documentación `///` en español, con la
  misma regla de brevedad, obligatorio en todo comando de Tauri y todo elemento
  público.
- Cuando la firma cambia, su bloque se actualiza en el mismo cambio: un JSDoc que
  miente es un defecto, igual que un tipo equivocado.
- PROHIBIDO documentación de plantilla («TODO: documentar», «función auxiliar») y
  bloques en inglés.

Rationale: la documentación corta y en el idioma del producto es la que se lee y se
mantiene al día; permite seguir un proceso sin leer su implementación y hace
revisable el código que escriben los agentes.

## Restricciones Tecnológicas

El stack es decisión tomada; cambiarlo es una enmienda MAJOR de esta constitución.

| Capa              | Elección                                  | Regla |
| ----------------- | ----------------------------------------- | ----- |
| Contenedor        | Tauri                                     | Motores web nativos: WebView2 en Windows, WebKit en macOS. PROHIBIDO Electron o un segundo runtime |
| Backend           | Rust                                      | Sistema operativo, archivos, ventanas y notificaciones |
| Compilación       | Vite                                      | Un solo pipeline para desarrollo y empaquetado |
| Interfaz          | React + TypeScript `strict`               | Componentes modulares, sin clases nuevas de estado |
| Primitivos UI     | Radix UI (shadcn/ui) / React Aria         | Headless y accesibles; se estilan, no se reescriben |
| Estilos           | Tailwind CSS sobre tokens                 | Ningún valor literal fuera de los tokens |
| Movimiento        | Framer Motion                             | Resortes antes que curvas de tiempo |
| Estado            | Zustand                                   | Almacén único; nada de Redux |

Plataformas soportadas: Windows y macOS. El diseño es el mismo en ambas; solo se
adapta lo que depende del sistema operativo (botones de ventana, símbolos de atajo
⌘/Ctrl, textos de papelera y de gestor de archivos, formato de rutas).

Alcance de salidas de v1.0: SQL para PostgreSQL, MySQL y SQLite; imagen del
diagrama; diccionario de datos; archivo `.yaml` del modelo.

Idioma del producto: español. Nombres técnicos de tablas y campos en minúsculas,
números y guion bajo, sin empezar por número.

## Estructura del Proyecto

```
sql-designer/
├── src-tauri/
│   ├── src/
│   │   └── main.rs            # Comandos en Rust, ventanas y menús nativos
│   ├── tauri.conf.json        # Configuración, permisos y metadatos de la app
│   └── Cargo.toml             # Dependencias del backend
├── src/
│   ├── assets/                # Fuentes (Geist, Geist Mono), iconos SVG
│   ├── components/
│   │   ├── ui/                # Sistema de diseño: componentes puros sobre Radix y Framer Motion
│   │   ├── layout/            # Titlebar propia, barra lateral, inspector, panel inferior, layout
│   │   └── features/          # Dominio: lienzo, tablas, relaciones, diccionario, exportar
│   ├── hooks/                 # Lógica reutilizable (useTheme, useWindowSize, atajos)
│   ├── lib/                   # Utilidades y envoltorios tipados de los comandos de Tauri
│   ├── store/                 # Estado global del modelo con Zustand
│   ├── styles/                # CSS global y tokens de diseño
│   ├── App.tsx                # Orquestador de la interfaz
│   └── main.tsx               # Punto de entrada de React
├── index.html                 # Plantilla HTML base
├── tailwind.config.js         # Tokens: color, sombra, radio, tipografía, movimiento
└── vite.config.ts             # Configuración del empaquetador
```

Reglas del árbol:

- Un archivo nuevo MUST caber en una de estas carpetas; si no cabe, la discusión es de
  arquitectura y pasa por `/speckit-plan`, no por una carpeta nueva improvisada.
- Mover o renombrar una de estas carpetas es una enmienda MINOR de esta constitución.
- `src-tauri/tauri.conf.json` declara el permiso mínimo necesario; un permiso nuevo se
  justifica en el `plan.md` de la feature que lo pide.

## Flujo de Desarrollo y Puertas de Calidad

El trabajo pasa por el ciclo Spec Kit: `/speckit-specify` → `/speckit-clarify` →
`/speckit-plan` → `/speckit-tasks` → `/speckit-implement`, con `/speckit-analyze` y
`/speckit-converge` cuando los artefactos se desalinean. La especificación vive en
`specs/<feature>/`; el código no adelanta a su `spec.md`.

Puertas que un cambio MUST pasar antes de darse por hecho:

1. `cargo check` y la comprobación de tipos del frontend pasan sin avisos nuevos.
2. El generador SQL tiene pruebas por motor (PostgreSQL, MySQL, SQLite) para cada
   construcción que toca: esquemas, enums, llaves, relaciones, índices, únicos y
   comentarios. Una relación solo se exporta si ambas tablas están en el alcance.
3. Cargar y guardar un modelo es de ida y vuelta: leer un `.yaml`, guardarlo y
   volver a leerlo produce el mismo modelo.
4. Toda acción nueva declara su atajo de teclado y su entrada en la paleta de
   comandos, o justifica por qué no tiene.
5. Las pantallas se revisan en tema claro y oscuro, y con movimiento reducido.
6. Ningún artefacto de implementación copia el prototipo de diseño tal cual: el
   prototipo es referencia de diseño, no base de código.
7. La dirección de dependencias se verifica: nada en `src/components/ui/` importa de
   `src/store/` ni de `src/components/features/`, y `invoke` solo aparece en `src/lib/`.
8. Todo símbolo nuevo o con firma modificada lleva su bloque JSDoc en español (`///`
   en Rust), breve y acorde a lo que hace el código.

La memoria del proyecto se persiste en Engram según `CLAUDE.md`; una fase sin su
`mem_save` no está completa.

## Governance

Esta constitución está por encima de cualquier otra práctica del repositorio. Donde
un plan, una tarea o una costumbre la contradigan, manda la constitución.

- **Enmiendas**: se proponen editando `.specify/memory/constitution.md` con un Sync
  Impact Report al inicio, se aprueban por el responsable del proyecto y se guardan
  en Engram con `topic_key` `architecture/constitution`.
- **Versionado** (semántico): MAJOR al quitar o redefinir un principio de forma
  incompatible, incluido cambiar el stack de Restricciones Tecnológicas; MINOR al
  añadir un principio, ampliar guía de forma material o mover una carpeta del árbol
  de Estructura del Proyecto; PATCH para aclaraciones y correcciones sin cambio de
  sentido.
- **Cumplimiento**: toda revisión de cambios verifica los ocho principios y las
  puertas de calidad. Una desviación se documenta en el `plan.md` de la feature con
  su razón y su alternativa descartada; complejidad sin justificar se rechaza.
- **Guía en tiempo de ejecución**: `CLAUDE.md` para agentes y memoria; este archivo
  para los límites del producto.

**Version**: 1.2.0 | **Ratified**: 2026-10-24 | **Last Amended**: 2026-10-24
