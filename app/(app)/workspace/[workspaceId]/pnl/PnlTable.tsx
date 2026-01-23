'use client'

import type { ColumnDef } from '@tanstack/react-table'
import DataTable from '@/components/table/DataTable'
import { formatCurrency, formatMonthLabel } from '@/lib/format'

type PnlRow = {
  month: string
  revenue: number
  cogs: number
  grossProfit: number
  focCost: number
  netContribution: number
}

export default function PnlTable({
  data,
  totals,
  currencySymbol,
}: {
  data: PnlRow[]
  totals: Record<string, string | number>
  currencySymbol: string
}) {
  const columns: ColumnDef<PnlRow>[] = [
    {
      accessorKey: 'month',
      header: 'Month',
      cell: ({ getValue }) => formatMonthLabel(String(getValue())),
    },
    {
      accessorKey: 'revenue',
      header: 'Revenue',
      cell: ({ getValue }) =>
        formatCurrency(Number(getValue() ?? 0), currencySymbol),
    },
    {
      accessorKey: 'cogs',
      header: 'COGS',
      cell: ({ getValue }) =>
        formatCurrency(Number(getValue() ?? 0), currencySymbol),
    },
    {
      accessorKey: 'grossProfit',
      header: 'Gross Profit',
      cell: ({ getValue }) =>
        formatCurrency(Number(getValue() ?? 0), currencySymbol),
    },
    {
      accessorKey: 'focCost',
      header: 'FOC Stock Cost',
      cell: ({ getValue }) =>
        formatCurrency(Number(getValue() ?? 0), currencySymbol),
    },
    {
      accessorKey: 'netContribution',
      header: 'Net Contribution',
      cell: ({ getValue }) =>
        formatCurrency(Number(getValue() ?? 0), currencySymbol),
    },
  ]

  return (
    <DataTable
      data={data}
      columns={columns}
      totals={totals}
      csvFilename="pnl-summary.csv"
      filterPlaceholder="Filter months..."
    />
  )
}
