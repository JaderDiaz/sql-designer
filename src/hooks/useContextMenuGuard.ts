import { useEffect } from 'react'

/**
 * Deja sin efecto los menús contextuales del navegador.
 *
 * La ventana es una aplicación de escritorio, y el menú del sistema web
 * —«Buscar con Google», «Servicios», «Recargar»— no pinta nada aquí. Los
 * menús propios de la interfaz sí salen: los abre Radix, que ya llama a
 * `preventDefault`, y este guardia respeta lo que ya está evitado.
 *
 * Lo que se pierde de ese menú —deshacer, cortar, copiar, pegar, seleccionar
 * todo— vive en el menú Edición del sistema, y las acciones del modelo, en el
 * menú Archivo.
 */
export function useContextMenuGuard(): void {
  useEffect(() => {
    const onContextMenu = (event: MouseEvent) => {
      if (!event.defaultPrevented) event.preventDefault()
    }

    document.addEventListener('contextmenu', onContextMenu)
    return () => document.removeEventListener('contextmenu', onContextMenu)
  }, [])
}
