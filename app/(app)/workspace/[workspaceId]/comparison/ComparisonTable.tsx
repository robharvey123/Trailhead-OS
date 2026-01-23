'use client'

import type { ColumnDef } from '@tanstack/react-table'
import DataTable from '@/components/table/DataTable'
import { formatNumber, formatPercent } from '@/lib/format'

type ComparisonRow = {
  customer: string
  sellIn: number
  promo: number
  totalShipped: number
  sellOutCompany: string
  sellOut: number
  variance: number
  sellThrough: number
  isChild?: boolean
}

export default function ComparisonTable({
  data,
  totals,
}: {
  data: ComparisonRow[]
  totals: Record<string, string | number>
}) {
  const columns: ColumnDef<ComparisonRow>[] = [
    {
      accessorKey: 'customer',
      header: 'Customer',
      cell: ({ row, getValue }) => (
        <span className={row.original.isChild ? 'pl-4 text-slate-400' : ''}>
          {String(getValue())}
        </span>
      ),
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
      accessorKey: 'sellOutCompany',
      header: 'Sell Out Co.',
      cell: ({ getValue }) => String(getValue() ?? ''),
    },
    {
      accessorKey: 'sellOut',
      header: 'Sell Out',
      cell: ({ getValue }) => formatNumber(Number(getValue() ?? 0)),
    },
    {
      accessorKey: 'variance',
      header: 'Variance',
      cell: ({ getValue }) => formatNumber(Number(getValue() ?? 0)),
    },
    {
      accessorKey: 'sellThrough',
      header: 'ST%',
      cell: ({ getValue }) => formatPercent(Number(getValue() ?? 0)),
    },
  ]

  return (
    <DataTable
      data={data}
      columns={columns}
      totals={totals}
      csvFilename="sell-in-vs-sell-out.csv"
      filterPlaceholder="Filter customers..."
    />
  )
}
