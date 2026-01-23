'use client'

import type { ColumnDef } from '@tanstack/react-table'
import DataTable from '@/components/table/DataTable'
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
  const columns: ColumnDef<MonthlySummary>[] = [
    {
      accessorKey: 'month',
      header: 'Month',
      cell: ({ getValue }) => formatMonthLabel(String(getValue())),
    },
    {
      accessorKey: 'sellIn',
      header: 'Sell In',
      cell: ({ getValue }) => formatNumber(getValue<number>()),
    },
    {
      accessorKey: 'promo',
      header: 'Promo',
      cell: ({ getValue }) => formatNumber(getValue<number>()),
    },
    {
      accessorKey: 'totalShipped',
      header: 'Total Shipped',
      cell: ({ getValue }) => formatNumber(getValue<number>()),
    },
    {
      accessorKey: 'sellOut',
      header: 'Sell Out',
      cell: ({ getValue }) => formatNumber(getValue<number>()),
    },
    {
      accessorKey: 'variance',
      header: 'Variance',
      cell: ({ getValue }) => formatNumber(getValue<number>()),
    },
  ]

  return (
    <DataTable
      data={data}
      columns={columns}
      totals={totals}
      csvFilename="dashboard-monthly-summary.csv"
      filterPlaceholder="Filter months..."
    />
  )
}
