'use client'

import type { ColumnDef } from '@tanstack/react-table'
import DataTable from '@/components/table/DataTable'
import TrendValue from '@/components/table/TrendValue'
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
  const sortedData = [...data].sort((a, b) => a.month.localeCompare(b.month))
  const previousByMonth = new Map<string, PnlRow | null>()

  sortedData.forEach((row, index) => {
    previousByMonth.set(row.month, index > 0 ? sortedData[index - 1] : null)
  })

  const columns: ColumnDef<PnlRow>[] = [
    {
      accessorKey: 'month',
      header: 'Month',
      cell: ({ getValue }) => formatMonthLabel(String(getValue())),
    },
    {
      accessorKey: 'revenue',
      header: 'Revenue',
      cell: ({ getValue, row }) => {
        const value = Number(getValue() ?? 0)
        const previous =
          previousByMonth.get(row.original.month)?.revenue ?? null
        return (
          <TrendValue
            value={value}
            previous={previous}
            formatted={formatCurrency(value, currencySymbol)}
          />
        )
      },
    },
    {
      accessorKey: 'cogs',
      header: 'COGS',
      cell: ({ getValue, row }) => {
        const value = Number(getValue() ?? 0)
        const previous = previousByMonth.get(row.original.month)?.cogs ?? null
        return (
          <TrendValue
            value={value}
            previous={previous}
            formatted={formatCurrency(value, currencySymbol)}
          />
        )
      },
    },
    {
      accessorKey: 'grossProfit',
      header: 'Gross Profit',
      cell: ({ getValue, row }) => {
        const value = Number(getValue() ?? 0)
        const previous =
          previousByMonth.get(row.original.month)?.grossProfit ?? null
        return (
          <TrendValue
            value={value}
            previous={previous}
            formatted={formatCurrency(value, currencySymbol)}
          />
        )
      },
    },
    {
      accessorKey: 'focCost',
      header: 'FOC Stock Cost',
      cell: ({ getValue, row }) => {
        const value = Number(getValue() ?? 0)
        const previous =
          previousByMonth.get(row.original.month)?.focCost ?? null
        return (
          <TrendValue
            value={value}
            previous={previous}
            formatted={formatCurrency(value, currencySymbol)}
          />
        )
      },
    },
    {
      accessorKey: 'netContribution',
      header: 'Net Contribution',
      cell: ({ getValue, row }) => {
        const value = Number(getValue() ?? 0)
        const previous =
          previousByMonth.get(row.original.month)?.netContribution ?? null
        return (
          <TrendValue
            value={value}
            previous={previous}
            formatted={formatCurrency(value, currencySymbol)}
          />
        )
      },
    },
  ]

  return (
    <DataTable
      data={sortedData}
      columns={columns}
      totals={totals}
      csvFilename="pnl-summary.csv"
      filterPlaceholder="Filter months..."
    />
  )
}
