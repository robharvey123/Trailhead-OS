'use client'

import type { ColumnDef } from '@tanstack/react-table'
import DataTable from '@/components/table/DataTable'
import TrendValue from '@/components/table/TrendValue'
import { formatMonthLabel, formatNumber } from '@/lib/format'

type MonthlySummary = {
  month: string
  sellIn: number
  promo: number
  totalShipped: number
  sellOut: number
  variance: number
}

export default function DashboardTable({
  data,
  totals,
}: {
  data: MonthlySummary[]
  totals: Record<string, string | number>
}) {
  const sortedData = [...data].sort((a, b) => a.month.localeCompare(b.month))
  const previousByMonth = new Map<string, MonthlySummary | null>()

  sortedData.forEach((row, index) => {
    previousByMonth.set(row.month, index > 0 ? sortedData[index - 1] : null)
  })

  const monthOptions = sortedData.map((row) => ({
    value: row.month,
    label: formatMonthLabel(row.month),
  }))

  const columns: ColumnDef<MonthlySummary>[] = [
    {
      accessorKey: 'month',
      header: 'Month',
      cell: ({ getValue }) => formatMonthLabel(String(getValue())),
    },
    {
      accessorKey: 'sellIn',
      header: 'Sell In',
      cell: ({ getValue, row }) => {
        const value = Number(getValue() ?? 0)
        const previous = previousByMonth.get(row.original.month)?.sellIn ?? null
        return (
          <TrendValue
            value={value}
            previous={previous}
            formatted={formatNumber(value)}
          />
        )
      },
    },
    {
      accessorKey: 'promo',
      header: 'Promo',
      cell: ({ getValue, row }) => {
        const value = Number(getValue() ?? 0)
        const previous = previousByMonth.get(row.original.month)?.promo ?? null
        return (
          <TrendValue
            value={value}
            previous={previous}
            formatted={formatNumber(value)}
          />
        )
      },
    },
    {
      accessorKey: 'totalShipped',
      header: 'Total Shipped',
      cell: ({ getValue, row }) => {
        const value = Number(getValue() ?? 0)
        const previous =
          previousByMonth.get(row.original.month)?.totalShipped ?? null
        return (
          <TrendValue
            value={value}
            previous={previous}
            formatted={formatNumber(value)}
          />
        )
      },
    },
    {
      accessorKey: 'sellOut',
      header: 'Sell Out',
      cell: ({ getValue, row }) => {
        const value = Number(getValue() ?? 0)
        const previous = previousByMonth.get(row.original.month)?.sellOut ?? null
        return (
          <TrendValue
            value={value}
            previous={previous}
            formatted={formatNumber(value)}
          />
        )
      },
    },
    {
      accessorKey: 'variance',
      header: 'Variance',
      cell: ({ getValue, row }) => {
        const value = Number(getValue() ?? 0)
        const previous =
          previousByMonth.get(row.original.month)?.variance ?? null
        return (
          <TrendValue
            value={value}
            previous={previous}
            formatted={formatNumber(value)}
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
      csvFilename="dashboard-monthly-summary.csv"
      filterPlaceholder="Filter months..."
      monthOptions={monthOptions}
      monthFilterLabel="Month"
      monthColumnId="month"
    />
  )
}
