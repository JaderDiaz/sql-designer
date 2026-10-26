import { Button } from '@/components/ui/Button'
import { FileList, type FileDraftRow, type FileRow } from '@/components/ui/FileList'
import { Icon } from '@/components/ui/Icon'
import { SearchField } from '@/components/ui/SearchField'
import { Sidebar, type SidebarItem, type SidebarSection } from '@/components/ui/Sidebar'
import type { IconName } from '@/components/ui/Icon'
import { formatModified } from '@/lib/format'
import { fileNameOf } from '@/lib/model/summary'
import type { DirectoryEntry } from '@/lib/tauri/types'
import { useAppStore } from '@/store'
import {
  EMPTY_FOLDER_HINT,
  EMPTY_FOLDER_TITLE,
  NO_MODELS_HINT,
  NO_MODELS_TITLE,
  NO_RESULTS_TITLE,
  filterEntries,
  isSelectable,
} from '@/store/browser'

/**
 * Explorador de archivos compartido por Abrir modelo y Elegir carpeta
 * (`research.md` R4): barra con Atrás, Adelante, la carpeta actual y el
 * buscador; ubicaciones a la izquierda; y la lista con su estado vacío.
 *
 * Lo único que cambia entre los dos diálogos es el filtro `only` del almacén,
 * que decide qué se lista y qué se puede seleccionar.
 */

/** Props del explorador. */
export interface FileBrowserProps {
  /**
   * Doble clic o Enter sobre un archivo seleccionable. Las carpetas las
   * recorre el propio explorador; qué hacer con un archivo lo decide el
   * diálogo: Abrir modelo lo abre y Elegir carpeta no hace nada.
   */
  onActivateFile?: (path: string) => void
  /** Clases del contenedor, con las que el diálogo lo coloca. */
  className?: string
}

/** Secciones de la barra lateral, con las ubicaciones en su grupo. */
function toSections(items: SidebarItem[]): SidebarSection[] {
  const favourites = items.filter((item) => item.id !== 'icloud' && item.id !== 'root')
  const locations = items.filter((item) => item.id === 'icloud' || item.id === 'root')
  const sections: SidebarSection[] = []
  if (favourites.length > 0) sections.push({ title: 'Favoritos', items: favourites })
  if (locations.length > 0) sections.push({ title: 'Ubicaciones', items: locations })
  return sections
}

/**
 * Icono y tinte de una entrada, como en el lienzo.
 *
 * @param entry Entrada de la carpeta.
 * @param selectable Si se puede elegir con el filtro actual.
 */
function iconOf(entry: DirectoryEntry, selectable: boolean): { icon: IconName; tint: string } {
  if (entry.isDirectory) return { icon: 'folder', tint: 'text-blue' }
  if (entry.isModel) return { icon: 'file-code', tint: selectable ? 'text-indigo' : '' }
  return { icon: 'file', tint: 'text-label-tertiary' }
}

export function FileBrowser({ onActivateFile, className }: FileBrowserProps) {
  const places = useAppStore((state) => state.places)
  const placeId = useAppStore((state) => state.placeId)
  const browsePath = useAppStore((state) => state.browsePath)
  const entries = useAppStore((state) => state.entries)
  const only = useAppStore((state) => state.only)
  const query = useAppStore((state) => state.query)
  const selection = useAppStore((state) => state.selection)
  const browseHistory = useAppStore((state) => state.browseHistory)
  const browseFuture = useAppStore((state) => state.browseFuture)
  const browseError = useAppStore((state) => state.browseError)
  const setQuery = useAppStore((state) => state.setQuery)
  const select = useAppStore((state) => state.select)
  const goBack = useAppStore((state) => state.goBack)
  const goForward = useAppStore((state) => state.goForward)
  const goToFolder = useAppStore((state) => state.goToFolder)
  const goToPlace = useAppStore((state) => state.goToPlace)
  const folderDraft = useAppStore((state) => state.folderDraft)
  const setFolderDraftName = useAppStore((state) => state.setFolderDraftName)
  const confirmFolderDraft = useAppStore((state) => state.confirmFolderDraft)
  const cancelFolderDraft = useAppStore((state) => state.cancelFolderDraft)

  const onlyFolders = only === 'folders'
  const visible = filterEntries(entries, query)
  const place = places.find((candidate) => candidate.id === placeId)
  const folderName = place?.label ?? (browsePath === null ? '—' : fileNameOf(browsePath))

  const rows: FileRow[] = visible.map((entry) => {
    const selectable = isSelectable(entry, only)
    const { icon, tint } = iconOf(entry, selectable)
    return {
      id: entry.path,
      name: entry.name,
      meta: formatModified(entry.modifiedMs),
      icon,
      iconClassName: tint,
      // Una carpeta en Abrir modelo no se selecciona, pero sí se puede abrir
      // con doble clic, así que no se deshabilita.
      disabled: !selectable && !entry.isDirectory,
    }
  })

  // La carpeta nueva se escribe en la propia lista y no existe en el disco
  // hasta que se confirma el nombre (FR-010).
  const draft: FileDraftRow | null =
    folderDraft === null
      ? null
      : {
          name: folderDraft,
          icon: 'folder',
          iconClassName: 'text-blue',
          label: 'Nombre de la carpeta nueva',
          onNameChange: setFolderDraftName,
          onCommit: () => void confirmFolderDraft(),
          onCancel: cancelFolderDraft,
        }

  /** Doble clic o Enter: entrar en la carpeta, o avisar al diálogo. */
  function activate(path: string) {
    const entry = entries.find((candidate) => candidate.path === path)
    if (entry === undefined) return
    if (entry.isDirectory) void goToFolder(path)
    else if (isSelectable(entry, only)) onActivateFile?.(path)
  }

  const empty =
    query.trim() !== '' ? (
      <EmptyState
        icon="search-x"
        title={NO_RESULTS_TITLE}
        description={`${
          onlyFolders ? 'Ninguna carpeta coincide' : 'Ningún archivo coincide'
        } con «${query.trim()}».`}
      />
    ) : onlyFolders ? (
      <EmptyState icon="folder-open" title={EMPTY_FOLDER_TITLE} description={EMPTY_FOLDER_HINT} />
    ) : (
      <EmptyState icon="folder-open" title={NO_MODELS_TITLE} description={NO_MODELS_HINT} />
    )

  return (
    <div className={className}>
      <div className="flex h-12 flex-none items-center gap-2 border-b-[0.5px] border-separator px-3">
        <div className="flex gap-0.5">
          <Button
            variant="plain"
            icon="chevron-left"
            aria-label="Atrás"
            disabled={browseHistory.length === 0}
            onClick={() => void goBack()}
          />
          <Button
            variant="plain"
            icon="chevron-right"
            aria-label="Adelante"
            disabled={browseFuture.length === 0}
            onClick={() => void goForward()}
          />
        </div>
        <span className="sm-path" aria-label={`Carpeta actual: ${folderName}`}>
          <Icon name={(place?.icon as IconName | undefined) ?? 'folder'} className="text-blue" />
          <span>{folderName}</span>
        </span>
        <div className="flex-1" />
        <SearchField
          label={onlyFolders ? 'Buscar carpetas' : 'Buscar archivos'}
          value={query}
          onValueChange={setQuery}
          className="w-[180px]"
        />
      </div>

      <div className="flex min-h-0 flex-1">
        <div className="w-[172px] flex-none overflow-auto border-r-[0.5px] border-separator bg-sidebar p-2">
          <Sidebar
            label="Ubicaciones"
            sections={toSections(
              places
                .filter((candidate) => candidate.path !== null)
                .map((candidate) => ({
                  id: candidate.id,
                  label: candidate.label,
                  icon: (candidate.icon as IconName | undefined) ?? 'folder',
                })),
            )}
            value={placeId ?? ''}
            onValueChange={(id) => void goToPlace(id)}
          />
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          {browseError === null ? null : (
            <p
              role="alert"
              className="m-0 bg-warning-soft px-5 py-2 text-[12px] leading-4 text-warning-text"
            >
              {browseError}
            </p>
          )}
          <FileList
            label={`Contenido de ${folderName}`}
            metaLabel={onlyFolders ? 'Fecha de modificación' : 'Modificado'}
            metaWidth={onlyFolders ? 130 : 116}
            rows={rows}
            value={selection}
            onValueChange={(id) => void select(id)}
            onActivate={activate}
            empty={empty}
            draft={draft}
          />
        </div>
      </div>
    </div>
  )
}

/** Props del estado vacío de la lista. */
interface EmptyStateProps {
  icon: IconName
  title: string
  description: string
}

/** Estado vacío de la lista, con su icono, su título y su explicación (FR-009). */
function EmptyState({ icon, title, description }: EmptyStateProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-1.5 px-4 py-8 text-center text-label-secondary">
      <Icon name={icon} size={24} />
      <span className="text-[13px] font-semibold leading-[18px] text-label">{title}</span>
      <span className="text-[12px] leading-4">{description}</span>
    </div>
  )
}
