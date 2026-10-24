# CLAUDE.md

Instrucciones obligatorias para Claude Code (y para cualquier agente o skill que
se ejecute en este repositorio, incluidas las skills de Spec Kit `speckit-*`).

## Regla principal: toda la memoria va a Engram

Engram (`mcp__engram__*`) es el **único** sistema de memoria persistente de este
proyecto. No se usan notas sueltas, archivos temporales ni resúmenes solo en el
chat para registrar conocimiento que deba sobrevivir a la sesión.

### Al iniciar una sesión

1. `mem_current_project` para confirmar que el proyecto resuelto es
   `sql-designer`.
2. `mem_context` (o `mem_search` con palabras clave del primer mensaje del
   usuario) antes de responder, para no repetir trabajo ya hecho.

### Durante el trabajo — `mem_save` es obligatorio

Llama a `mem_save` **inmediatamente**, sin esperar a que el usuario lo pida,
después de cada uno de estos eventos:

- Decisión de arquitectura, convención o elección de herramienta.
- Bug corregido (incluye la causa raíz, no solo el arreglo).
- Descubrimiento no obvio, *gotcha* o caso borde.
- Cambio de configuración o de entorno.
- Preferencia o restricción nueva expresada por el usuario.
- Feature implementada con un enfoque no evidente.
- El usuario acepta o rechaza una propuesta ("dale", "mejor X", "no, prefiero…").

Usa el formato estructurado de Engram en `content`:

```
**What**: …
**Why**: …
**Where**: rutas relativas al repositorio
**Learned**: …
```

Reglas de contenido:

- Rutas **relativas** al repositorio (`src/schema/parser.ts`), nunca absolutas
  como `/private/var/www/...`.
- Fechas absolutas (`2026-10-24`), nunca relativas ("ayer", "la semana pasada").
- `type` correcto: `decision`, `architecture`, `bugfix`, `pattern`, `config`,
  `discovery`, `learning`.
- `topic_key` estable para conocimiento que se actualiza en lugar de duplicarse,
  por ejemplo `architecture/schema-model` o `config/build-pipeline`.

### Al cerrar una sesión

Antes de dar un trabajo por terminado, llama a `mem_session_summary` con las
secciones Goal / Instructions / Discoveries / Accomplished / Next Steps /
Relevant Files.

## Spec Kit también guarda en Engram

Las skills `speckit-*` no sustituyen a Engram: cada fase del ciclo SDD debe
dejar su rastro en memoria además de en los archivos de `specs/`.

| Fase                   | Qué guardar con `mem_save`                                                             | `topic_key` sugerido                   |
| ---------------------- | -------------------------------------------------------------------------------------- | -------------------------------------- |
| `speckit-constitution` | Principios añadidos o modificados y su motivo                                          | `architecture/constitution`            |
| `speckit-specify`      | Feature, alcance y no-objetivos; ruta del `spec.md`                                     | `decision/spec-<slug-feature>`         |
| `speckit-clarify`      | Cada pregunta resuelta y la respuesta del usuario                                       | `decision/clarify-<slug-feature>`      |
| `speckit-plan`         | Decisiones técnicas y alternativas descartadas                                          | `architecture/plan-<slug-feature>`     |
| `speckit-tasks`        | Desglose y dependencias no obvias entre tareas                                          | `pattern/tasks-<slug-feature>`         |
| `speckit-implement`    | Un `mem_save` por hallazgo real durante la implementación (bugs, desvíos del plan)       | sin `topic_key` (son eventos distintos) |
| `speckit-analyze`      | Inconsistencias encontradas entre `spec.md`, `plan.md` y `tasks.md`                      | `discovery/analyze-<slug-feature>`     |
| `speckit-converge`     | Trabajo pendiente detectado y tareas añadidas                                            | `discovery/converge-<slug-feature>`    |

Donde `<slug-feature>` es el nombre del directorio de la feature en `specs/`.

Si una skill de Spec Kit termina sin haber escrito en Engram, la fase **no está
completa**: haz el `mem_save` que falte antes de reportar el resultado.

## Qué no guardar

- Lo que el repositorio ya registra por sí mismo: estructura de archivos,
  historial de git, contenido de este `CLAUDE.md`.
- Detalles que solo importan dentro de la conversación actual.
- Secretos, tokens o credenciales.

## Entrega

La memoria es trabajo interno, nunca la respuesta al usuario. Completa las
llamadas a Engram antes de redactar la respuesta final, y si una falla, informa
el resultado de todas formas.
