import { Button } from '@/components/ui/Button'
import { Sheet } from '@/components/ui/Sheet'
import { useAppStore } from '@/store'

/**
 * Aviso de que un reciente ya no está en el disco (FR-034).
 *
 * Abrirlo no da un error de lectura: dice dónde estaba y ofrece quitarlo de
 * la lista, que es lo único que la aplicación puede arreglar. «Aceptar» lo
 * deja en la lista por si el archivo vuelve, por ejemplo al montar un disco
 * externo.
 */
export function RecentNotFoundDialog() {
  const missingTarget = useAppStore((state) => state.missingTarget)
  const dismissRecentDialogs = useAppStore((state) => state.dismissRecentDialogs)
  const removeRecent = useAppStore((state) => state.removeRecent)

  return (
    <Sheet
      open={missingTarget !== null}
      onOpenChange={(next) => {
        if (!next) dismissRecentDialogs()
      }}
      icon="file-question"
      iconClassName="bg-fill-hover"
      iconColorClassName="text-label-tertiary"
      title={`No se encontró «${missingTarget?.fileName ?? ''}»`}
      description={
        missingTarget === null
          ? ''
          : `El archivo se movió o se eliminó de ${missingTarget.folder}. Puedes quitarlo de la lista de recientes.`
      }
      width={380}
      footer={
        <>
          <Button
            onClick={() => {
              if (missingTarget !== null) void removeRecent(missingTarget.path)
            }}
          >
            Quitar de recientes
          </Button>
          <Button variant="primary" onClick={dismissRecentDialogs}>
            Aceptar
          </Button>
        </>
      }
    />
  )
}
