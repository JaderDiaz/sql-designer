import { motion } from 'framer-motion'
import { useEffect } from 'react'

import { CanvasSurface } from '@/components/features/canvas/CanvasSurface'
import { EmptyModelCard } from '@/components/features/canvas/EmptyModelCard'
import { Minimap } from '@/components/features/canvas/Minimap'
import { ZoomBar } from '@/components/features/canvas/ZoomBar'
import { FieldsGrid } from '@/components/features/table/FieldsGrid'
import { FieldsPanelHeader } from '@/components/features/table/FieldsPanelHeader'
import { BottomPanel } from '@/components/layout/BottomPanel'
import { EditorChrome } from '@/components/layout/EditorChrome'
import { EditorLayout } from '@/components/layout/EditorLayout'
import { Inspector } from '@/components/layout/Inspector'
import { ModelSidebar } from '@/components/layout/ModelSidebar'
import { StatusBar } from '@/components/layout/StatusBar'
import { isBlankModel } from '@/lib/model/defaults'
import { screenIn } from '@/lib/motion'
import { measureModelOpened } from '@/lib/tauri/commands'
import { useAppStore } from '@/store'

/**
 * Pantalla del Editor: orquesta las cinco zonas de P-05 (FR-001).
 *
 * No dibuja nada por sí misma. Compone el marco con la barra superior, la
 * barra lateral, el lienzo, el inspector y la barra de estado, y deja a cada
 * zona su trabajo.
 *
 * Aquí se anota la medida de SC-002 del Incremento 1: el reloj arranca al
 * pulsar «Crear modelo» o «Abrir» y se para cuando esta pantalla ya está
 * pintada.
 */
export function EditorScreen() {
  const model = useAppStore((state) => state.model)
  const openStartedMs = useAppStore((state) => state.openStartedMs)
  const clearOpenMeasure = useAppStore((state) => state.clearOpenMeasure)
  const isWindowSettling = useAppStore((state) => state.isWindowSettling)
  const isSidebarHidden = useAppStore((state) => state.isSidebarHidden)
  const isInspectorHidden = useAppStore((state) => state.isInspectorHidden)
  const isFieldsPanelOpen = useAppStore((state) => state.isFieldsPanelOpen)
  const fieldsPanelTable = useAppStore((state) => state.fieldsPanelTable)

  const tables = model?.tables?.length ?? 0
  // El panel de campos solo se pinta si su tabla sigue en el modelo: al
  // eliminarla el panel se queda sin tema del que hablar (FR-023).
  const panelTable = isFieldsPanelOpen
    ? (model?.tables ?? []).find((table) => table.name === fieldsPanelTable)
    : undefined
  // La tarjeta de empezar solo sale con el modelo en blanco: con una tabla o
  // un esquema propio ya hay algo que mirar en el lienzo (FR-005a).
  const isBlank = isBlankModel(model)

  useEffect(() => {
    if (openStartedMs === null) return undefined
    // Dos fotogramas, igual que el arranque en `src/App.tsx`: se informa
    // cuando el Editor ya está pintado, no cuando monta.
    let second = 0
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => {
        clearOpenMeasure()
        void measureModelOpened(performance.now() - openStartedMs, tables).catch(() => undefined)
      })
    })
    return () => {
      cancelAnimationFrame(first)
      cancelAnimationFrame(second)
    }
  }, [clearOpenMeasure, openStartedMs, tables])

  return (
    <motion.section
      key="editor"
      aria-label={model ? `Editor de ${model.name}` : 'Editor'}
      variants={screenIn}
      initial="hidden"
      animate="visible"
      exit="exit"
      className="flex h-full min-h-0 w-full flex-col bg-canvas"
    >
      <EditorLayout
        isSidebarHidden={isSidebarHidden}
        isInspectorHidden={isInspectorHidden}
        chrome={<EditorChrome />}
        sidebar={<ModelSidebar />}
        inspector={<Inspector />}
        panel={
          panelTable === undefined ? null : (
            <BottomPanel>
              <FieldsPanelHeader table={panelTable} />
              <FieldsGrid table={panelTable} />
            </BottomPanel>
          )
        }
        statusBar={<StatusBar />}
        canvas={
          <CanvasSurface
            overlay={
              <>
                {/* La tarjeta va centrada, así que no se pone hasta que la
                    ventana está en su sitio: mientras crece, su centro se
                    mueve en cada paso y la tarjeta temblaba persiguiéndolo. */}
                {isBlank && !isWindowSettling ? (
                  <div className="pointer-events-none absolute inset-0 grid place-items-center p-6">
                    <EmptyModelCard />
                  </div>
                ) : null}
                <ZoomBar />
                <Minimap />
              </>
            }
          />
        }
      />
    </motion.section>
  )
}
