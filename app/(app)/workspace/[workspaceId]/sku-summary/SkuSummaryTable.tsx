'use client'

import type { ColumnDef } from '@tanstack/react-table'
import DataTable from '@/components/table/DataTable'
import { formatNumber, formatPercent } from '@/lib/format'

type SkuSummaryRow = {
  sku: string
  sellIn: number
  promo: number
  totalShipped: number
  sellOut: number
  channelStock: number
  sellThrough: number
}

export default function SkuSummaryTable({
  data,
  totals,
}: {
  data: SkuSummaryRow[]
  totals: Record<string, string | number>
}) {
  const columns: ColumnDef<SkuSummaryRow>[] = [
    {
      accessorKey: 'sku',
      header: 'SKU',
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
  ]

  return (
    <DataTable
      data={data}
      columns={columns}
      totals={totals}
      csvFilename="sku-summary.csv"
      filterPlaceholder="Filter SKUs..."
    />
  )
}
