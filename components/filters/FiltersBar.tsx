import Link from 'next/link'
import { formatMonthLabel } from '@/lib/format'

type FiltersBarProps = {
  basePath: string
  brand: string
  start: string
  end: string
  availableMonths?: string[]
  company?: string
  availableCompanies?: string[]
}

export default function FiltersBar({
  basePath,
  brand,
  start,
  end,
  availableMonths,
  company,
  availableCompanies,
}: FiltersBarProps) {
  const normalizedMonths = (availableMonths ?? [])
    .map((month) => month.slice(0, 7))
    .filter(Boolean)
  const uniqueMonths = Array.from(new Set(normalizedMonths)).sort()
  const monthOptions = [...uniqueMonths]

  if (start && !monthOptions.includes(start)) {
    monthOptions.unshift(start)
  }
  if (end && !monthOptions.includes(end)) {
    monthOptions.push(end)
  }

  const showSelects = monthOptions.length > 0
  const monthRangeLabel =
    monthOptions.length > 0
      ? `${formatMonthLabel(monthOptions[0])} → ${formatMonthLabel(
          monthOptions[monthOptions.length - 1]
        )}`
      : 'All months'

  const normalizedCompanies = (availableCompanies ?? [])
    .map((value) => value.trim())
    .filter(Boolean)
  const uniqueCompanies = Array.from(new Set(normalizedCompanies)).sort()
  const companyOptions = [...uniqueCompanies]
  if (company && !companyOptions.includes(company)) {
    companyOptions.unshift(company)
  }
  const showCompanySelect = companyOptions.length > 0

  return (
    <form
      method="get"
      action={basePath}
      className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-800 bg-slate-900/70 p-4 text-sm"
    >
      <label className="flex flex-col gap-2">
        <span className="text-xs uppercase tracking-[0.2em] text-slate-400">
          Brand
        </span>
        <input
          name="brand"
          defaultValue={brand}
          placeholder="Brand"
          className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500"
        />
      </label>
      {showCompanySelect ? (
        <label className="flex flex-col gap-2">
          <span className="text-xs uppercase tracking-[0.2em] text-slate-400">
            Company
          </span>
          <select
            name="company"
            defaultValue={company}
            className="min-w-[180px] rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200"
          >
            <option value="">All companies</option>
            {companyOptions.map((value) => (
              <option key={`company-${value}`} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <label className="flex flex-col gap-2">
        <span className="text-xs uppercase tracking-[0.2em] text-slate-400">
          Start month
        </span>
        {showSelects ? (
          <select
            name="start"
            defaultValue={start}
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200"
          >
            <option value="">All months</option>
            {monthOptions.map((month) => (
              <option key={`start-${month}`} value={month}>
                {formatMonthLabel(month)}
              </option>
            ))}
          </select>
        ) : (
          <input
            type="month"
            name="start"
            defaultValue={start}
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200"
          />
        )}
      </label>
      <label className="flex flex-col gap-2">
        <span className="text-xs uppercase tracking-[0.2em] text-slate-400">
          End month
        </span>
        {showSelects ? (
          <select
            name="end"
            defaultValue={end}
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200"
          >
            <option value="">All months</option>
            {monthOptions.map((month) => (
              <option key={`end-${month}`} value={month}>
                {formatMonthLabel(month)}
              </option>
            ))}
          </select>
        ) : (
          <input
            type="month"
            name="end"
            defaultValue={end}
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200"
          />
        )}
      </label>
      <button
        type="submit"
        className="rounded-lg bg-white/90 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-950"
      >
        Apply
      </button>
      <Link
        href={basePath}
        className="rounded-lg border border-slate-700 px-4 py-2 text-xs uppercase tracking-wide text-slate-300"
      >
        Reset
      </Link>
      <span className="text-xs uppercase tracking-[0.2em] text-slate-500">
        Range: {monthRangeLabel}
      </span>
    </form>
  )
}
