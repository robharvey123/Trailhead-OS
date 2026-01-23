'use client'

import type { ColumnDef } from '@tanstack/react-table'
import DataTable from './DataTable'
import { formatNumber } from '@/lib/format'

type PivotRow = Record<string, string | number>

type PivotTableProps = {
  data: PivotRow[]
  months: string[]
  totals: PivotRow
  rowKey: string
  rowLabel: string
  csvFilename: string
  filterPlaceholder: string
}

export default function PivotTable({
  data,
  months,
  totals,
  rowKey,
  rowLabel,
  csvFilename,
  filterPlaceholder,
}: PivotTableProps) {
  const columns: ColumnDef<PivotRow>[] = [
    {
      accessorKey: rowKey,
      header: rowLabel,
      cell: ({ getValue }) => String(getValue()),
    },
    ...months.map((month) => ({
      accessorKey: month,
      header: month,
      cell: ({ getValue }) => formatNumber(Number(getValue() ?? 0)),
    })),
    {
      accessorKey: 'total',
      header: 'Total',
      cell: ({ getValue }) => formatNumber(Number(getValue() ?? 0)),
    },
  ]

  const totalsRow = Object.fromEntries(
    Object.entries(totals).map(([key, value]) => [
      key,
      typeof value === 'number' ? formatNumber(value) : value,
    ])
  )

  return (
    <DataTable
      data={data}
      columns={columns}
      totals={totalsRow}
      csvFilename={csvFilename}
      filterPlaceholder={filterPlaceholder}
    />
  )
}
