'use client'

import type { CellContext, ColumnDef } from '@tanstack/react-table'
import DataTable from './DataTable'
import { formatMonthLabel, formatNumber } from '@/lib/format'

type PivotRow = Record<string, string | number>

type PivotTableProps = {
  data: PivotRow[]
  months: string[]
  totals: PivotRow
  rowKey: string
  rowLabel: string
  csvFilename: string
  filterPlaceholder: string
  stickyRowHeader?: boolean
}

export default function PivotTable({
  data,
  months,
  totals,
  rowKey,
  rowLabel,
  csvFilename,
  filterPlaceholder,
  stickyRowHeader = false,
}: PivotTableProps) {
  const columns: ColumnDef<PivotRow>[] = [
    {
      accessorKey: rowKey,
      header: rowLabel,
      cell: ({ getValue }: CellContext<PivotRow, unknown>) =>
        String(getValue()),
    },
    ...months.map<ColumnDef<PivotRow>>((month) => ({
      accessorKey: month,
      header: formatMonthLabel(month),
      cell: ({ getValue }: CellContext<PivotRow, unknown>) =>
        formatNumber(Number(getValue() ?? 0)),
    })),
    {
      accessorKey: 'total',
      header: 'Total',
      cell: ({ getValue }: CellContext<PivotRow, unknown>) =>
        formatNumber(Number(getValue() ?? 0)),
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
      stickyColumnId={stickyRowHeader ? rowKey : undefined}
    />
  )
}
