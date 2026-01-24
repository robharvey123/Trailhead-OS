'use client'

import type { CellContext, ColumnDef } from '@tanstack/react-table'
import DataTable from '@/components/table/DataTable'
import { formatCurrency, formatMonthLabel, formatNumber } from '@/lib/format'

type PromoRow = Record<string, string | number>

export default function PromoTable({
  data,
  months,
  totals,
  currencySymbol,
}: {
  data: PromoRow[]
  months: string[]
  totals: PromoRow
  currencySymbol: string
}) {
  const columns: ColumnDef<PromoRow>[] = [
    {
      accessorKey: 'customer',
      header: 'Customer',
      cell: ({ getValue }: CellContext<PromoRow, unknown>) =>
        String(getValue()),
    },
    ...months.map<ColumnDef<PromoRow>>((month) => ({
      accessorKey: month,
      header: formatMonthLabel(month),
      cell: ({ getValue }: CellContext<PromoRow, unknown>) =>
        formatNumber(Number(getValue() ?? 0)),
    })),
    {
      accessorKey: 'total',
      header: 'Total',
      cell: ({ getValue }: CellContext<PromoRow, unknown>) =>
        formatNumber(Number(getValue() ?? 0)),
    },
    {
      accessorKey: 'estCost',
      header: 'Est. Cost',
      cell: ({ getValue }: CellContext<PromoRow, unknown>) =>
        formatCurrency(Number(getValue() ?? 0), currencySymbol),
    },
  ]

  const totalsRow = Object.fromEntries(
    Object.entries(totals).map(([key, value]) => [
      key,
      typeof value === 'number'
        ? key === 'estCost'
          ? formatCurrency(value, currencySymbol)
          : formatNumber(value)
        : value,
    ])
  )

  return (
    <DataTable
      data={data}
      columns={columns}
      totals={totalsRow}
      csvFilename="promo-summary.csv"
      filterPlaceholder="Filter customers..."
    />
  )
}
