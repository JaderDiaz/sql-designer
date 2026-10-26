import { Button } from '@/components/ui/Button'
import { Sheet } from '@/components/ui/Sheet'
import { isMacOS } from '@/lib/platform'
import { revealInFileManager } from '@/lib/tauri/commands'
import { useAppStore } from '@/store'

/**
 * Diálogo de archivo con errores (FR-016).
 *
 * Dice la línea y la causa, y ofrece abrir el gestor de archivos del sistema
 * para corregir el archivo a mano. Al cerrarse no cambia de pantalla: se sigue
 * en Abrir modelo o en la Bienvenida, según de dónde se intentó abrir.
 */

/**
 * Descripción del fallo, con su línea delante.
 *
 * @param message Causa que devolvió el validador.
 * @param line Línea del archivo donde está el fallo.
 */
export function fileErrorDescription(message: string, line: number): string {
  return `El archivo no es un modelo válido de SQL Designer. Línea ${line}: ${message} Corrige el archivo en un editor de texto e inténtalo de nuevo.`
}

export function FileErrorDialog() {
  const fileError = useAppStore((state) => state.fileError)
  const dismissFileError = useAppStore((state) => state.dismissFileError)
  const platform = useAppStore((state) => state.platform)
  const showNotice = useAppStore((state) => state.showNotice)

  const revealLabel = isMacOS(platform) ? 'Mostrar en Finder' : 'Mostrar en el Explorador'

  /** Abre el gestor de archivos y deja el diálogo cerrado. */
  function reveal() {
    if (fileError === null) return
    const path = fileError.path
    dismissFileError()
    void revealInFileManager(path).catch(() => {
      showNotice('No se pudo abrir el gestor de archivos del sistema.')
    })
  }

  return (
    <Sheet
      open={fileError !== null}
      onOpenChange={(next) => {
        if (!next) dismissFileError()
      }}
      icon="file-warning"
      iconClassName="bg-warning-soft"
      iconColorClassName="text-orange"
      title={`No se pudo abrir «${fileError?.fileName ?? ''}»`}
      description={
        fileError === null
          ? ''
          : fileErrorDescription(fileError.issue.message, fileError.issue.line)
      }
      width={380}
      footer={
        <>
          <Button onClick={reveal}>{revealLabel}</Button>
          <Button variant="primary" onClick={dismissFileError}>
            Aceptar
          </Button>
        </>
      }
    />
  )
}
