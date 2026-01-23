'use client'

import type { ColumnDef } from '@tanstack/react-table'
import DataTable from '@/components/table/DataTable'
import { formatCurrency, formatNumber, formatPercent } from '@/lib/format'

type CompanySummaryRow = {
  company: string
  sellIn: number
  promo: number
  totalShipped: number
  sellOut: number
  channelStock: number
  sellThrough: number
  revenue: number
}

export default function CompanySummaryTable({
  data,
  totals,
  currencySymbol,
}: {
  data: CompanySummaryRow[]
  totals: Record<string, string | number>
  currencySymbol: string
}) {
  const columns: ColumnDef<CompanySummaryRow>[] = [
    {
      accessorKey: 'company',
      header: 'Company',
      cell: ({ getValue }) => String(getValue()),
    },
    {
      accessorKey: 'sellIn',
      header: 'Sell In',
      cell: ({ getValue }) => formatNumber(Number(getValue() ?? 0)),
    },
    {
      accessorKey: 'promo',
      header: 'Promo',
      cell: ({ getValue }) => formatNumber(Number(getValue() ?? 0)),
    },
    {
      accessorKey: 'totalShipped',
      header: 'Total Shipped',
      cell: ({ getValue }) => formatNumber(Number(getValue() ?? 0)),
    },
    {
      accessorKey: 'sellOut',
      header: 'Sell Out',
      cell: ({ getValue }) => formatNumber(Number(getValue() ?? 0)),
    },
    {
      accessorKey: 'channelStock',
      header: 'Channel Stock',
      cell: ({ getValue }) => formatNumber(Number(getValue() ?? 0)),
    },
    {
      accessorKey: 'sellThrough',
      header: 'ST%',
      cell: ({ getValue }) => formatPercent(Number(getValue() ?? 0)),
    },
    {
      accessorKey: 'revenue',
      header: 'Revenue',
      cell: ({ getValue }) =>
        formatCurrency(Number(getValue() ?? 0), currencySymbol),
    },
  ]

  return (
    <DataTable
      data={data}
      columns={columns}
      totals={totals}
      csvFilename="company-summary.csv"
      filterPlaceholder="Filter companies..."
    />
  )
}
