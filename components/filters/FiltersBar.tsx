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
  companyLabel?: string
}

export default function FiltersBar({
  basePath,
  brand,
  start,
  end,
  availableMonths,
  company,
  availableCompanies,
  companyLabel = 'Company',
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
      className="flex flex-wrap items-end gap-3 rounded-card border border-[var(--border)] bg-[var(--bg)] p-4 text-sm shadow-[var(--shadow-sm)]"
    >
      <label className="flex flex-col gap-2">
        <span className="os-label">
          Brand
        </span>
        <input
          name="brand"
          defaultValue={brand}
          placeholder="Brand"
          className="os-input px-3 py-2 text-sm"
        />
      </label>
      {showCompanySelect ? (
        <label className="flex flex-col gap-2">
          <span className="os-label">
            {companyLabel}
          </span>
          <select
            name="company"
            defaultValue={company}
            className="os-select min-w-[180px] px-3 py-2 text-sm"
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
        <span className="os-label">
          Start month
        </span>
        {showSelects ? (
          <select
            name="start"
            defaultValue={start}
            className="os-select px-3 py-2 text-sm"
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
            className="os-input px-3 py-2 text-sm"
          />
        )}
      </label>
      <label className="flex flex-col gap-2">
        <span className="os-label">
          End month
        </span>
        {showSelects ? (
          <select
            name="end"
            defaultValue={end}
            className="os-select px-3 py-2 text-sm"
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
            className="os-input px-3 py-2 text-sm"
          />
        )}
      </label>
      <button
        type="submit"
        className="btn btn-primary btn-sm"
      >
        Apply
      </button>
      <Link
        href={basePath}
        className="btn btn-ghost btn-sm"
      >
        Reset
      </Link>
      <span className="os-label">
        Range: {monthRangeLabel}
      </span>
    </form>
  )
}
