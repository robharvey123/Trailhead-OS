'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnFiltersState,
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

/* Header and footer strip. Two layers: the tint over the opaque ground, so the
   strip stays solid when it sticks, on white and on navy (where the surface
   tokens are translucent). */
const STRIP =
  'bg-[var(--bg)] bg-[linear-gradient(var(--surface),var(--surface))]'
const STICKY_STRIP = `${STRIP} shadow-[2px_0_0_0_var(--border)]`

export default function DataTable<T>({
  data,
  columns,
  totals,
  filterPlaceholder = 'Filter rows...',
  csvFilename = 'export.csv',
  showToolbar = true,
  monthOptions,
  monthColumnId = 'month',
  monthFilterLabel = 'Month',
  stickyColumnId,
}: {
  data: T[]
  columns: ColumnDef<T, unknown>[]
  totals?: Record<string, string | number>
  filterPlaceholder?: string
  csvFilename?: string
  showToolbar?: boolean
  monthOptions?: { value: string; label: string }[]
  monthColumnId?: string
  monthFilterLabel?: string
  stickyColumnId?: string
}) {
  const [sorting, setSorting] = useState<SortingState>([])
  const [globalFilter, setGlobalFilter] = useState('')
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [monthFilter, setMonthFilter] = useState('')

  useEffect(() => {
    if (!monthOptions?.length) {
      return
    }

    setColumnFilters((prev) => {
      const next = prev.filter((filter) => filter.id !== monthColumnId)
      if (monthFilter) {
        next.push({ id: monthColumnId, value: monthFilter })
      }
      return next
    })
  }, [monthFilter, monthColumnId, monthOptions])

  const table = useReactTable({
    data,
    columns,
    state: { sorting, globalFilter, columnFilters },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onColumnFiltersChange: setColumnFilters,
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
          <div className="flex w-full flex-wrap items-center gap-3 md:w-auto">
            <input
              value={globalFilter}
              onChange={(event) => setGlobalFilter(event.target.value)}
              placeholder={filterPlaceholder}
              aria-label={filterPlaceholder}
              className="os-input w-full px-3 py-2 text-sm md:max-w-xs"
            />
            {monthOptions?.length ? (
              <label className="os-label flex items-center gap-2">
                {monthFilterLabel}
                <select
                  value={monthFilter}
                  onChange={(event) => setMonthFilter(event.target.value)}
                  className="os-select px-3 py-2 text-sm font-normal tracking-normal"
                >
                  <option value="">All</option>
                  {monthOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
          </div>
          <button
            type="button"
            onClick={handleExport}
            className="btn btn-ghost btn-sm"
          >
            Export CSV
          </button>
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-card border border-[var(--border)]">
        <table className="min-w-full divide-y divide-[var(--border)] text-sm">
          <thead className={`sticky top-0 ${STRIP}`}>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    scope="col"
                    aria-sort={
                      header.column.getCanSort()
                        ? header.column.getIsSorted() === 'asc'
                          ? 'ascending'
                          : header.column.getIsSorted() === 'desc'
                            ? 'descending'
                            : 'none'
                        : undefined
                    }
                    className={`px-4 py-3 text-left${
                      header.column.id === stickyColumnId
                        ? ' sticky left-0 z-20 ' + STICKY_STRIP
                        : ''
                    }`}
                  >
                    {header.isPlaceholder ? null : (
                      <button
                        type="button"
                        onClick={header.column.getToggleSortingHandler()}
                        disabled={!header.column.getCanSort()}
                        className="os-label inline-flex items-center gap-2"
                      >
                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                        {/* aria-sort on the <th> carries the state; the glyph is decoration. */}
                        <span aria-hidden="true">
                          {
                            {
                              asc: '^',
                              desc: 'v',
                            }[header.column.getIsSorted() as string] ?? '<>'
                          }
                        </span>
                      </button>
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-[var(--border)] text-[var(--text)]">
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <tr key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      className={`px-4 py-3${
                        cell.column.id === stickyColumnId
                          ? ' sticky left-0 z-10 bg-[var(--bg)] shadow-[2px_0_0_0_var(--border)]'
                          : ''
                      }`}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={table.getVisibleLeafColumns().length}
                  className="px-4 py-8 text-center text-sm text-[var(--text-3)]"
                >
                  No data available for the current filters.
                </td>
              </tr>
            )}
          </tbody>
          {totals ? (
            <tfoot className={`border-t border-[var(--border)] text-[var(--text)] ${STRIP}`}>
              <tr>
                {table.getVisibleLeafColumns().map((column) => (
                  <td
                    key={column.id}
                    className={`px-4 py-3 font-semibold${
                      column.id === stickyColumnId
                        ? ' sticky left-0 z-10 ' + STICKY_STRIP
                        : ''
                    }`}
                  >
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
