import { motion } from 'framer-motion'
import { useEffect } from 'react'

import { EditorChrome } from '@/components/layout/EditorChrome'
import { ScrollRegion } from '@/components/layout/ScrollRegion'
import { Icon, type IconName } from '@/components/ui/Icon'
import { riseIn, stagger } from '@/lib/motion'
import { measureModelOpened } from '@/lib/tauri/commands'
import { useAppStore } from '@/store'

/**
 * Pantalla del Editor. En este incremento trae solo el estado de modelo
 * vacío: la tarjeta «Empieza a diseñar tu modelo» de `project/Editor.dc.html`,
 * en modo informativo (research.md R16). El lienzo de tablas llega después.
 *
 * Aquí se anota la medida de SC-002: el reloj arranca al pulsar «Crear
 * modelo» y se para cuando esta pantalla ya está pintada.
 */

/** Una fila de la tarjeta: qué se podrá hacer con el modelo. */
interface StartRow {
  label: string
  description: string
  icon: IconName
  /** Clase del cuadro del icono, con su tinte. */
  tint: string
  /** Color del propio icono. */
  color: string
}

const START_ROWS: StartRow[] = [
  {
    label: 'Crear la primera tabla',
    description: 'Nombre, esquema, llave primaria y campos de auditoría.',
    icon: 'table-2',
    tint: 'sm-tint-indigo',
    color: 'text-indigo',
  },
  {
    label: 'Agregar un esquema',
    description: 'Agrupa las tablas por dominio con su color.',
    icon: 'layers',
    tint: 'sm-tint-teal',
    color: 'text-teal',
  },
  {
    label: 'Definir un enum',
    description: 'Listas de valores reutilizables en los campos.',
    icon: 'tags',
    tint: 'sm-tint-purple',
    color: 'text-purple',
  },
]

export function EditorScreen() {
  const model = useAppStore((state) => state.model)
  const openStartedMs = useAppStore((state) => state.openStartedMs)
  const clearOpenMeasure = useAppStore((state) => state.clearOpenMeasure)

  const schema = model?.schemas[0]
  const tables = model?.tables?.length ?? 0

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
      variants={stagger}
      initial="hidden"
      animate="visible"
      className="flex h-full min-h-0 w-full flex-col bg-canvas"
    >
      <EditorChrome />

      <ScrollRegion label="Lienzo del modelo" className="flex items-center justify-center p-6">
        <motion.div
          variants={riseIn}
          role="region"
          aria-labelledby="sm-start-title"
          className="sm-start box-border flex w-[440px] max-w-full flex-col items-center gap-4 rounded-xl bg-raised px-6 pb-5 pt-7 shadow-[var(--shadow-raised),0_0_0_0.5px_var(--separator)]"
        >
          <span className="sm-tint-indigo flex h-12 w-12 items-center justify-center rounded-lg">
            <Icon name="table-2" size={24} className="text-indigo" />
          </span>

          <div className="flex flex-col items-center gap-1 text-center">
            <h2 id="sm-start-title" className="m-0 text-[17px] font-semibold leading-[22px]">
              Empieza a diseñar tu modelo
            </h2>
            <p className="m-0 max-w-[340px] text-[12px] leading-4 text-label-secondary">
              {schema
                ? `Este modelo aún no tiene tablas. La primera se creará en el esquema ${schema.abbreviation} · ${schema.name} y podrás moverla después.`
                : 'Este modelo aún no tiene tablas.'}
            </p>
          </div>

          <ul className="m-0 flex w-full list-none flex-col gap-0.5 p-0">
            {START_ROWS.map((row) => (
              <li key={row.label} className="sm-start-row">
                <span
                  className={`${row.tint} flex h-8 w-8 flex-none items-center justify-center rounded-md`}
                >
                  <Icon name={row.icon} className={row.color} />
                </span>
                <span className="flex min-w-0 flex-1 flex-col text-left">
                  <span className="text-[13px] font-semibold leading-[18px]">{row.label}</span>
                  <span className="text-[11px] leading-[14px] text-label-secondary">
                    {row.description}
                  </span>
                </span>
              </li>
            ))}
          </ul>

          <span className="flex items-center gap-1.5 text-[11px] leading-[14px] text-label-tertiary">
            <Icon name="mouse-pointer-click" size={12} />
            El lienzo de tablas llega en el Incremento 2.
          </span>
        </motion.div>
      </ScrollRegion>
    </motion.section>
  )
}
