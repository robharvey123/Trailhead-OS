'use client'

import type { ColumnDef } from '@tanstack/react-table'
import DataTable from '@/components/table/DataTable'
import { formatNumber, formatPercent } from '@/lib/format'

type CompanySkuRow = {
  sku: string
  sellIn: number
  promo: number
  totalShipped: number
  sellOut: number
  variance: number
  sellThrough: number
}

export default function CompanySkuTable({
  data,
  totals,
  csvFilename,
}: {
  data: CompanySkuRow[]
  totals: Record<string, string | number>
  csvFilename: string
}) {
  const columns: ColumnDef<CompanySkuRow>[] = [
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
      csvFilename={csvFilename}
      filterPlaceholder="Filter SKUs..."
    />
  )
}
