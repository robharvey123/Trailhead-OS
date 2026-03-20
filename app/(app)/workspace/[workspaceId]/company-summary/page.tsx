import { createClient } from '@/lib/supabase/server'
import { currencySymbol as getCurrencySymbol, formatCurrency, formatNumber, formatPercent } from '@/lib/format'
import { pivotMonthly } from '@/lib/analytics/pivot'
import CompanyCharts from './CompanyCharts'
import CompanyMonthlyCharts from './CompanyMonthlyCharts'
import CompanySummaryTable from './CompanySummaryTable'
import PivotTable from '@/components/table/PivotTable'
import FiltersBar from '@/components/filters/FiltersBar'
import { resolveSearchParams, type WorkspaceSearchParams } from '@/lib/search-params'
import {
  resolveWorkspaceParams,
  type WorkspaceRouteParams,
} from '@/lib/route-params'

type SellInMonthlyRow = {
  customer: string
  month: string
  sell_in_units: number
  promo_units: number
  total_shipped: number
  revenue: number
}

type SellOutMonthlyRow = {
  company: string
  month: string
  sell_out_units: number
}

type MappingRow = {
  customer: string
  sell_out_company: string | null
}

type CompanySummaryRow = {
  company: string
  sellIn: number
  promo: number
  totalShipped: number
  sellOut: number
  channelStock: number
  sellThrough: number
  revenue: number
}

export default async function CompanySummaryPage({
  params,
  searchParams,
}: {
  params: WorkspaceRouteParams | Promise<WorkspaceRouteParams>
  searchParams: WorkspaceSearchParams | Promise<WorkspaceSearchParams>
}) {
  const resolvedParams = await resolveWorkspaceParams(params)
  const resolvedSearchParams = await resolveSearchParams(searchParams)
  const supabase = await createClient()

  const { data: settings } = await supabase
    .from('workspace_settings')
    .select('brand_filter, base_currency')
    .eq('workspace_id', resolvedParams.workspaceId)
    .maybeSingle()

  const brandFilter =
    resolvedSearchParams.brand?.trim() || settings?.brand_filter || ''
  const customerFilter = resolvedSearchParams.company?.trim() || ''
  const start = resolvedSearchParams.start ?? ''
  const end = resolvedSearchParams.end ?? ''
  const startDate = start ? `${start}-01` : null
  const endDate = end ? `${end}-01` : null

  let sellInQuery = supabase
    .from('vw_sell_in_customer_monthly')
    .select('customer, month, sell_in_units, promo_units, total_shipped, revenue')
    .eq('workspace_id', resolvedParams.workspaceId)

  let sellOutQuery = supabase
    .from('vw_sell_out_company_monthly')
    .select('company, month, sell_out_units')
    .eq('workspace_id', resolvedParams.workspaceId)

  if (brandFilter) {
    sellInQuery = sellInQuery.eq('brand', brandFilter)
    sellOutQuery = sellOutQuery.eq('brand', brandFilter)
  }

  if (startDate) {
    sellInQuery = sellInQuery.gte('month', startDate)
    sellOutQuery = sellOutQuery.gte('month', startDate)
  }

  if (endDate) {
    sellInQuery = sellInQuery.lte('month', endDate)
    sellOutQuery = sellOutQuery.lte('month', endDate)
  }

  const [{ data: sellInRows }, { data: sellOutRows }, { data: mappings }] =
    await Promise.all([
      sellInQuery,
      sellOutQuery,
      supabase
        .from('vw_sell_in_customer_match')
        .select('customer, sell_out_company')
        .eq('workspace_id', resolvedParams.workspaceId),
    ])

  const mappingByCustomer = new Map<string, MappingRow>()
  ;(mappings ?? []).forEach((mapping) => {
    mappingByCustomer.set(mapping.customer, mapping)
  })

  const availableCustomers = Array.from(
    new Set((sellInRows ?? []).map((row) => row.customer).filter(Boolean))
  ).sort()

  const filteredSellInRows = (sellInRows ?? []).filter((row) => {
    if (!customerFilter) {
      return true
    }
    return row.customer === customerFilter
  })

  const mappedCompanies = new Set<string>()
  if (customerFilter) {
    const mapping = mappingByCustomer.get(customerFilter)
    mappedCompanies.add(mapping?.sell_out_company ?? customerFilter)
  }

  const filteredSellOutRows = (sellOutRows ?? []).filter((row) => {
    if (!customerFilter) {
      return true
    }
    return mappedCompanies.has(row.company)
  })

  const sellInCompanyMonthlyMap = new Map<string, SellInMonthlyRow>()

  filteredSellInRows.forEach((row) => {
    const mapping = mappingByCustomer.get(row.customer)
    const company = mapping?.sell_out_company ?? row.customer
    const month = row.month
    const key = `${company}__${month}`
    const entry = sellInCompanyMonthlyMap.get(key) ?? {
      customer: company,
      month,
      sell_in_units: 0,
      promo_units: 0,
      total_shipped: 0,
      revenue: 0,
    }

    entry.sell_in_units += row.sell_in_units ?? 0
    entry.promo_units += row.promo_units ?? 0
    entry.total_shipped += row.total_shipped ?? 0
    entry.revenue += row.revenue ?? 0
    sellInCompanyMonthlyMap.set(key, entry)
  })

  const sellInCompanyMonthly = Array.from(sellInCompanyMonthlyMap.values())

  const summaryMap = new Map<string, CompanySummaryRow>()

  sellInCompanyMonthly.forEach((row) => {
    const entry = summaryMap.get(row.customer) ?? {
      company: row.customer,
      sellIn: 0,
      promo: 0,
      totalShipped: 0,
      sellOut: 0,
      channelStock: 0,
      sellThrough: 0,
      revenue: 0,
    }
    entry.sellIn += row.sell_in_units ?? 0
    entry.promo += row.promo_units ?? 0
    entry.totalShipped += row.total_shipped ?? 0
    entry.revenue += row.revenue ?? 0
    summaryMap.set(row.customer, entry)
  })

  filteredSellOutRows.forEach((row) => {
    const entry = summaryMap.get(row.company) ?? {
      company: row.company,
      sellIn: 0,
      promo: 0,
      totalShipped: 0,
      sellOut: 0,
      channelStock: 0,
      sellThrough: 0,
      revenue: 0,
    }
    entry.sellOut += row.sell_out_units ?? 0
    summaryMap.set(row.company, entry)
  })

  const summary = Array.from(summaryMap.values())
    .map((row) => {
      const channelStock = row.totalShipped - row.sellOut
      const sellThrough =
        row.totalShipped > 0 ? (row.sellOut / row.totalShipped) * 100 : 0
      return { ...row, channelStock, sellThrough }
    })
    .sort((a, b) => b.totalShipped - a.totalShipped)

  const currencySymbol = getCurrencySymbol(settings?.base_currency ?? 'GBP')

  const totals = summary.reduce(
    (acc, row) => {
      acc.sellIn += row.sellIn
      acc.promo += row.promo
      acc.totalShipped += row.totalShipped
      acc.sellOut += row.sellOut
      acc.channelStock += row.channelStock
      acc.revenue += row.revenue
      return acc
    },
    {
      sellIn: 0,
      promo: 0,
      totalShipped: 0,
      sellOut: 0,
      channelStock: 0,
      revenue: 0,
    }
  )

  const totalSellThrough =
    totals.totalShipped > 0
      ? (totals.sellOut / totals.totalShipped) * 100
      : 0

  const totalsRow = {
    company: 'Total',
    sellIn: formatNumber(totals.sellIn),
    promo: formatNumber(totals.promo),
    totalShipped: formatNumber(totals.totalShipped),
    sellOut: formatNumber(totals.sellOut),
    channelStock: formatNumber(totals.channelStock),
    sellThrough: formatPercent(totalSellThrough),
    revenue: formatCurrency(totals.revenue, currencySymbol),
  }

  const topCompanies = summary.slice(0, 8).map((row) => ({
    company: row.company,
    totalShipped: row.totalShipped,
    sellOut: row.sellOut,
    sellThrough: Number(row.sellThrough.toFixed(1)),
  }))

  const sellInPivot = pivotMonthly({
    rows: sellInCompanyMonthly.map((row) => ({
      company: row.customer,
      month: row.month,
      sell_in_units: row.sell_in_units,
    })),
    rowKey: 'company',
    monthKey: 'month',
    valueKey: 'sell_in_units',
  })

  const sellOutPivot = pivotMonthly({
    rows: filteredSellOutRows as SellOutMonthlyRow[],
    rowKey: 'company',
    monthKey: 'month',
    valueKey: 'sell_out_units',
  })

  const availableMonths = Array.from(
    new Set([...sellInPivot.months, ...sellOutPivot.months])
  ).sort()

  const sellInByMonth = new Map<string, number>()
  sellInCompanyMonthly.forEach((row) => {
    const month = String(row.month ?? '').slice(0, 7)
    if (!month) {
      return
    }
    sellInByMonth.set(
      month,
      (sellInByMonth.get(month) ?? 0) + (row.sell_in_units ?? 0)
    )
  })

  const sellOutByMonth = new Map<string, number>()
  filteredSellOutRows.forEach((row) => {
    const month = String(row.month ?? '').slice(0, 7)
    if (!month) {
      return
    }
    sellOutByMonth.set(
      month,
      (sellOutByMonth.get(month) ?? 0) + (row.sell_out_units ?? 0)
    )
  })

  const monthlyChartData = availableMonths.map((month) => ({
    month,
    sellIn: sellInByMonth.get(month) ?? 0,
    sellOut: sellOutByMonth.get(month) ?? 0,
  }))

  const monthlyChartTitle = customerFilter
    ? `Monthly sell in vs sell out • ${customerFilter}`
    : 'Monthly sell in vs sell out • All companies'

  return (
    <div className="space-y-8">
      <header>
        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
          Company Summary
        </p>
        <h1 className="mt-2 text-2xl font-semibold">Company performance</h1>
      </header>

      <FiltersBar
        basePath={`/workspace/${resolvedParams.workspaceId}/company-summary`}
        brand={brandFilter}
        start={start}
        end={end}
        availableMonths={availableMonths}
        company={customerFilter}
        availableCompanies={availableCustomers}
        companyLabel="Customer"
      />

      <CompanyMonthlyCharts data={monthlyChartData} title={monthlyChartTitle} />

      <CompanyCharts data={topCompanies} />

      <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
        <h2 className="text-lg font-semibold">Company performance summary</h2>
        <div className="mt-6">
          <CompanySummaryTable
            data={summary}
            totals={totalsRow}
            currencySymbol={currencySymbol}
          />
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
          <h3 className="text-sm font-semibold text-slate-200">
            Sell in by company
          </h3>
          <div className="mt-4">
            <PivotTable
              data={sellInPivot.data}
              months={sellInPivot.months}
              totals={sellInPivot.totals}
              rowKey="company"
              rowLabel="Company"
              csvFilename="company-sell-in-by-month.csv"
              filterPlaceholder="Filter companies..."
              stickyRowHeader
            />
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
          <h3 className="text-sm font-semibold text-slate-200">
            Sell out by company
          </h3>
          <div className="mt-4">
            <PivotTable
              data={sellOutPivot.data}
              months={sellOutPivot.months}
              totals={sellOutPivot.totals}
              rowKey="company"
              rowLabel="Company"
              csvFilename="company-sell-out-by-month.csv"
              filterPlaceholder="Filter companies..."
              stickyRowHeader
            />
          </div>
        </div>
      </section>
    </div>
  )
}
