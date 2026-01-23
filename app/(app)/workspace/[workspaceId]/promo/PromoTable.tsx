'use client'

import type { ColumnDef } from '@tanstack/react-table'
import DataTable from '@/components/table/DataTable'
import { formatCurrency, formatNumber } from '@/lib/format'

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
    {
      accessorKey: 'estCost',
      header: 'Est. Cost',
      cell: ({ getValue }) =>
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
