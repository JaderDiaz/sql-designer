import { motion } from 'framer-motion'

import { Icon, type IconName } from '@/components/ui/Icon'
import { riseIn } from '@/lib/motion'
import { useAppStore } from '@/store'

/**
 * Tarjeta «Empieza a diseñar tu modelo» (FR-005, SC-009).
 *
 * Es el estado vacío del lienzo: un modelo sin tablas no tiene nada que
 * dibujar, y en lugar de un lienzo en blanco se dice por dónde empezar. De
 * sus tres filas, «Agregar un esquema» es la única que actúa en este
 * incremento; las otras dos anuncian lo que traen los siguientes y por eso no
 * son botones.
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
  /** Si la fila actúa en este incremento. */
  action?: 'new-schema'
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
    action: 'new-schema',
  },
  {
    label: 'Definir un enum',
    description: 'Listas de valores reutilizables en los campos.',
    icon: 'tags',
    tint: 'sm-tint-purple',
    color: 'text-purple',
  },
]

export function EmptyModelCard() {
  const model = useAppStore((state) => state.model)
  const openSchemaDialog = useAppStore((state) => state.openSchemaDialog)

  const schema = model?.schemas[0]

  return (
    <motion.div
      variants={riseIn}
      initial="hidden"
      animate="visible"
      role="region"
      aria-labelledby="sm-start-title"
      className="sm-start pointer-events-auto box-border flex w-[440px] max-w-full flex-col items-center gap-4 rounded-xl bg-raised px-6 pb-5 pt-7 shadow-[var(--shadow-raised),0_0_0_0.5px_var(--separator)]"
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
        {START_ROWS.map((row) => {
          const content = (
            <>
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
            </>
          )

          return (
            <li key={row.label}>
              {row.action === 'new-schema' ? (
                <button
                  type="button"
                  className="sm-start-row sm-start-row-action w-full"
                  onClick={() => openSchemaDialog(null)}
                >
                  {content}
                  <Icon name="chevron-right" size={14} className="text-label-tertiary" />
                </button>
              ) : (
                <span className="sm-start-row">{content}</span>
              )}
            </li>
          )
        })}
      </ul>

      <span className="flex items-center gap-1.5 text-[11px] leading-[14px] text-label-tertiary">
        <Icon name="mouse-pointer-click" size={12} />
        Crea un esquema para empezar a organizar el modelo.
      </span>
    </motion.div>
  )
}
