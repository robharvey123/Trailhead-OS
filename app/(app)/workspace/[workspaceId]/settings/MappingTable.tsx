'use client'

import type { ColumnDef } from '@tanstack/react-table'
import DataTable from '@/components/table/DataTable'
import { deleteMapping } from './actions'

type MappingRow = {
  id: string
  sell_in_customer: string
  sell_out_company: string
  group_name: string | null
}

export default function MappingTable({
  data,
  workspaceId,
}: {
  data: MappingRow[]
  workspaceId: string
}) {
  const columns: ColumnDef<MappingRow>[] = [
    {
      accessorKey: 'sell_in_customer',
      header: 'Sell In customer',
      cell: ({ getValue }) => String(getValue()),
    },
    {
      accessorKey: 'sell_out_company',
      header: 'Sell Out company',
      cell: ({ getValue }) => String(getValue()),
    },
    {
      accessorKey: 'group_name',
      header: 'Group',
      cell: ({ getValue }) => String(getValue() ?? ''),
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <form action={deleteMapping}>
          <input type="hidden" name="workspaceId" value={workspaceId} />
          <input type="hidden" name="mappingId" value={row.original.id} />
          <button
            type="submit"
            className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-300 hover:border-rose-400 hover:text-rose-200"
          >
            Delete
          </button>
        </form>
      ),
    },
  ]

  return (
    <DataTable
      data={data}
      columns={columns}
      csvFilename="customer-mappings.csv"
      filterPlaceholder="Filter mappings..."
    />
  )
}
