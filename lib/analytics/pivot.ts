export type PivotRow = Record<string, string | number>

type PivotInput = {
  rows: Record<string, unknown>[]
  rowKey: string
  monthKey: string
  valueKey: string
}

export const pivotMonthly = ({
  rows,
  rowKey,
  monthKey,
  valueKey,
}: PivotInput) => {
  const months = Array.from(
    new Set(
      rows
        .map((row) => String(row[monthKey] ?? '').slice(0, 7))
        .filter(Boolean)
    )
  ).sort()

  const rowMap = new Map<string, PivotRow>()
  const totals: PivotRow = { [rowKey]: 'Total' }

  rows.forEach((row) => {
    const name = String(row[rowKey] ?? '').trim()
    const month = String(row[monthKey] ?? '').slice(0, 7)
    const value = Number(row[valueKey] ?? 0)

    if (!name || !month) {
      return
    }

    const entry = rowMap.get(name) ?? { [rowKey]: name }
    const current = Number(entry[month] ?? 0)
    entry[month] = current + value
    entry.total = Number(entry.total ?? 0) + value
    rowMap.set(name, entry)

    totals[month] = Number(totals[month] ?? 0) + value
    totals.total = Number(totals.total ?? 0) + value
  })

  const data = Array.from(rowMap.values()).sort((a, b) =>
    String(a[rowKey]).localeCompare(String(b[rowKey]))
  )

  return { data, months, totals }
}
