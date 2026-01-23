'use client'

import { useMemo, useState } from 'react'
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table'

const buildCsv = (rows: string[][]) =>
  rows.map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(',')).join('\n')

const downloadCsv = (filename: string, rows: string[][]) => {
  const csv = buildCsv(rows)
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

const getColumnLabel = <T,>(column: ColumnDef<T>) => {
  if (typeof column.header === 'string') {
    return column.header
  }
  if ('accessorKey' in column && typeof column.accessorKey === 'string') {
    return column.accessorKey
  }
  return column.id ?? ''
}

export default function DataTable<T>({
  data,
  columns,
  totals,
  filterPlaceholder = 'Filter rows...',
  csvFilename = 'export.csv',
  showToolbar = true,
}: {
  data: T[]
  columns: ColumnDef<T, unknown>[]
  totals?: Record<string, string | number>
  filterPlaceholder?: string
  csvFilename?: string
  showToolbar?: boolean
}) {
  const [sorting, setSorting] = useState<SortingState>([])
  const [globalFilter, setGlobalFilter] = useState('')

  const table = useReactTable({
    data,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    globalFilterFn: 'includesString',
  })

  const csvRows = useMemo(() => {
    const headers = table
      .getAllLeafColumns()
      .map((column) => getColumnLabel(column.columnDef))

    const body = table.getFilteredRowModel().rows.map((row) =>
      table.getAllLeafColumns().map((column) => {
        const value = row.getValue(column.id)
        return value === null || value === undefined ? '' : String(value)
      })
    )

    return [headers, ...body]
  }, [table])

  const handleExport = () => {
    downloadCsv(csvFilename, csvRows)
  }

  return (
    <div className="space-y-4">
      {showToolbar ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <input
            value={globalFilter}
            onChange={(event) => setGlobalFilter(event.target.value)}
            placeholder={filterPlaceholder}
            className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 md:max-w-xs"
          />
          <button
            type="button"
            onClick={handleExport}
            className="rounded-full border border-slate-700 px-4 py-2 text-xs uppercase tracking-wide text-slate-300 transition hover:border-slate-500 hover:text-white"
          >
            Export CSV
          </button>
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-2xl border border-slate-800">
        <table className="min-w-full divide-y divide-slate-800 text-sm">
          <thead className="sticky top-0 bg-slate-950 text-xs uppercase tracking-[0.2em] text-slate-400">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="px-4 py-3 text-left font-medium"
                  >
                    {header.isPlaceholder ? null : (
                      <button
                        type="button"
                        onClick={header.column.getToggleSortingHandler()}
                        className="inline-flex items-center gap-2"
                      >
                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                        {
                          {
                            asc: '^',
                            desc: 'v',
                          }[header.column.getIsSorted() as string] ?? '<>'
                        }
                      </button>
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-slate-800 text-slate-200">
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <tr key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-4 py-3">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={table.getVisibleLeafColumns().length}
                  className="px-4 py-8 text-center text-sm text-slate-400"
                >
                  No data available for the current filters.
                </td>
              </tr>
            )}
          </tbody>
          {totals ? (
            <tfoot className="border-t border-slate-800 bg-slate-950/80 text-slate-100">
              <tr>
                {table.getVisibleLeafColumns().map((column) => (
                  <td key={column.id} className="px-4 py-3 font-semibold">
                    {totals[column.id] ?? ''}
                  </td>
                ))}
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>
    </div>
  )
}
