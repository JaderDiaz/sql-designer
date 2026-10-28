import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { TableCard } from '@/components/features/canvas/TableCard'
import { TABLE_HEADER, FIELD_ROW_HEIGHT, tableHeight } from '@/lib/canvas/constants'
import type { Relation, Table } from '@/lib/model/types'

/**
 * Pruebas de la tarjeta de una tabla en el lienzo (FR-012, FR-025, FR-047).
 *
 * La tarjeta es la otra cara del editor de campos: lista los mismos campos, y
 * su alto crece con ellos. Las marcas no pueden vivir solo en el color, así
 * que viajan también en el nombre accesible (contracts/tables.md §5).
 */

/** Tabla de ejemplo con una llave primaria, un único y una clave foránea. */
const TABLE: Table = {
  name: 'reservas',
  schema: 'ventas',
  fields: [
    { name: 'id', type: 'uuid' },
    { name: 'codigo', type: 'varchar', length: 20 },
    { name: 'cliente_id', type: 'uuid' },
    { name: 'nota', type: 'text', nullable: true },
  ],
  primaryKey: ['id'],
  uniques: [{ name: 'reservas_codigo_key', fields: ['codigo'] }],
}

/** Relación que hace de `cliente_id` una clave foránea. */
const RELATIONS: Relation[] = [
  {
    name: 'reservas_cliente_fk',
    fromTable: 'reservas',
    fromFields: ['cliente_id'],
    toTable: 'clientes',
    toFields: ['id'],
  },
]

/** Dibuja la tarjeta con lo mínimo que necesita. */
function renderCard(overrides: Partial<React.ComponentProps<typeof TableCard>> = {}) {
  return render(
    <TableCard
      table={TABLE}
      position={{ x: 40, y: 80 }}
      abbreviation="VEN"
      schema="ventas"
      color="blue"
      relations={RELATIONS}
      isDim={false}
      {...overrides}
    />,
  )
}

describe('TableCard', () => {
  it('lista sus campos con nombre y tipo (FR-012)', () => {
    renderCard()

    const card = screen.getByRole('button', { name: /^Tabla reservas,/ })
    expect(card).toHaveTextContent('id')
    expect(card).toHaveTextContent('uuid')
    expect(card).toHaveTextContent('varchar')
    expect(card).toHaveTextContent('nota')
  })

  it('su alto sigue a `tableHeight` (research R1)', () => {
    renderCard()

    const card = screen.getByRole('button', { name: /^Tabla reservas,/ })
    expect(card.style.height).toBe(`${tableHeight(4)}px`)
    expect(tableHeight(4)).toBe(TABLE_HEADER + FIELD_ROW_HEIGHT * 4)
  })

  it('una tabla sin campos mide lo mismo que una de un campo (research R1)', () => {
    renderCard({ table: { name: 'reservas', schema: 'ventas', fields: [] } })

    const card = screen.getByRole('button', { name: /^Tabla reservas,/ })
    expect(card.style.height).toBe(`${tableHeight(1)}px`)
  })

  it('su nombre accesible es el del contrato, campo a campo (FR-047, §5)', () => {
    renderCard()

    expect(
      screen.getByRole('button', {
        name:
          'Tabla reservas, esquema VEN · ventas, 4 campos. ' +
          'id, uuid, llave primaria. ' +
          'codigo, varchar, única. ' +
          'cliente_id, uuid, clave foránea. ' +
          'nota, text, admite nulos',
      }),
    ).toBeInTheDocument()
  })

  it('dice «1 campo» en singular (FR-047)', () => {
    renderCard({ table: { ...TABLE, fields: [{ name: 'id', type: 'uuid' }] } })

    expect(screen.getByRole('button', { name: /, 1 campo\./ })).toBeInTheDocument()
  })

  it('dibuja la marca de cada campo, que gana PK sobre UK y FK (FR-025)', () => {
    renderCard()

    const card = screen.getByRole('button', { name: /^Tabla reservas,/ })
    expect(card.querySelectorAll('[data-mark="PK"]')).toHaveLength(1)
    expect(card.querySelectorAll('[data-mark="UK"]')).toHaveLength(1)
    expect(card.querySelectorAll('[data-mark="FK"]')).toHaveLength(1)
  })

  it('la tabla seleccionada se anuncia como pulsada (FR-007a)', () => {
    renderCard({ isSelected: true })

    expect(screen.getByRole('button', { name: /^Tabla reservas,/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  it('la marca entra en el nombre accesible, no solo en el color (FR-047, RS-11)', () => {
    renderCard()

    const card = screen.getByRole('button', { name: /^Tabla reservas,/ })
    const label = card.getAttribute('aria-label') ?? ''
    expect(label).toContain('id, uuid, llave primaria')
    expect(label).toContain('codigo, varchar, única')
    expect(label).toContain('cliente_id, uuid, clave foránea')
    // Las insignias visibles no se leen dos veces: la fila es decorativa.
    expect(card.querySelector('.sm-table-fields')).toHaveAttribute('aria-hidden', 'true')
  })

  it('la insignia va en la fila de su campo (FR-025, FR-029)', () => {
    renderCard()

    const rows = screen
      .getByRole('button', { name: /^Tabla reservas,/ })
      .querySelectorAll('.sm-field-row')
    expect(rows[0]?.querySelector('[data-mark]')?.textContent).toBe('PK')
    expect(rows[1]?.querySelector('[data-mark]')?.textContent).toBe('UK')
    expect(rows[2]?.querySelector('[data-mark]')?.textContent).toBe('FK')
    // El campo sin marca guarda su sitio, para que los nombres se alineen.
    expect(rows[3]?.querySelector('.sm-field-mark-space')).not.toBeNull()
  })

  it('la tabla resaltada y la relacionada llevan clases distintas (FR-021, FR-022)', () => {
    const { container } = renderCard({ isHot: true })
    expect(container.querySelector('.sm-table')?.className).toContain('is-hot')

    const linked = renderCard({ isLinked: true })
    expect(linked.container.querySelector('.sm-table')?.className).toContain('is-linked')
  })

  it('marca los campos de las relaciones resaltadas (FR-023)', () => {
    const { container } = renderCard({ hotFields: new Set(['cliente_id']) })

    const marked = Array.from(container.querySelectorAll('.sm-field-row[data-hot]')).map(
      (row) => row.querySelector('.sm-field-name')?.textContent,
    )
    expect(marked).toEqual(['cliente_id'])
  })

  it('sin relaciones, el campo deja de ser clave foránea (FR-025)', () => {
    renderCard({ relations: [] })

    expect(screen.getByRole('button', { name: /^Tabla reservas,/ }).getAttribute('aria-label')).toContain(
      'cliente_id, uuid.',
    )
  })
})
