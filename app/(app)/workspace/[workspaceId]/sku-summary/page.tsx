import { createClient } from '@/lib/supabase/server'
import { formatNumber, formatPercent } from '@/lib/format'
import { pivotMonthly } from '@/lib/analytics/pivot'
import SkuCharts from './SkuCharts'
import SkuSummaryTable from './SkuSummaryTable'
import PivotTable from '@/components/table/PivotTable'
import FiltersBar from '@/components/filters/FiltersBar'
import { resolveSearchParams, type WorkspaceSearchParams } from '@/lib/search-params'
import {
  resolveWorkspaceParams,
  type WorkspaceRouteParams,
} from '@/lib/route-params'

type SellInSkuRow = {
  customer?: string
  product: string
  month: string
  sell_in_units: number
  promo_units: number
  total_shipped: number
}

type SellOutSkuRow = {
  company?: string
  product: string
  month: string
  sell_out_units: number
}

type SkuSummaryRow = {
  sku: string
  sellIn: number
  promo: number
  totalShipped: number
  sellOut: number
  channelStock: number
  sellThrough: number
}

export default async function SkuSummaryPage({
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
    .select('brand_filter')
    .eq('workspace_id', resolvedParams.workspaceId)
    .maybeSingle()

  const brandFilter =
    resolvedSearchParams.brand?.trim() || settings?.brand_filter || ''
  const companyFilter = resolvedSearchParams.company?.trim() || ''
  const start = resolvedSearchParams.start ?? ''
  const end = resolvedSearchParams.end ?? ''
  const startDate = start ? `${start}-01` : null
  const endDate = end ? `${end}-01` : null

  let sellInQuery = supabase
    .from('vw_sell_in_customer_sku_monthly')
    .select(
      'customer, product, month, sell_in_units, promo_units, total_shipped'
    )
    .eq('workspace_id', resolvedParams.workspaceId)

  let sellOutQuery = supabase
    .from('vw_sell_out_company_sku_monthly')
    .select('company, product, month, sell_out_units')
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

  const mappingByCustomer = new Map<string, string>()
  ;(mappings ?? []).forEach((mapping) => {
    if (mapping.customer) {
      mappingByCustomer.set(mapping.customer, mapping.sell_out_company ?? '')
    }
  })

  const companyOptions = Array.from(
    new Set(
      [
        ...(sellOutRows ?? []).map((row) => row.company),
        ...(sellInRows ?? []).map((row) =>
          mappingByCustomer.get(row.customer ?? '') || row.customer
        ),
      ].filter(Boolean)
    )
  ).sort()

  const filteredSellInRows = (sellInRows ?? []).filter((row) => {
    if (!companyFilter) {
      return true
    }
    const mapped =
      mappingByCustomer.get(row.customer ?? '') || row.customer || ''
    return mapped === companyFilter
  })

  const filteredSellOutRows = (sellOutRows ?? []).filter((row) => {
    if (!companyFilter) {
      return true
    }
    return (row.company ?? '') === companyFilter
  })

  const summaryMap = new Map<string, SkuSummaryRow>()

  filteredSellInRows.forEach((row) => {
    const sku = row.product
    const entry = summaryMap.get(sku) ?? {
      sku,
      sellIn: 0,
      promo: 0,
      totalShipped: 0,
      sellOut: 0,
      channelStock: 0,
      sellThrough: 0,
    }
    entry.sellIn += row.sell_in_units ?? 0
    entry.promo += row.promo_units ?? 0
    entry.totalShipped += row.total_shipped ?? 0
    summaryMap.set(sku, entry)
  })

  filteredSellOutRows.forEach((row) => {
    const sku = row.product
    const entry = summaryMap.get(sku) ?? {
      sku,
      sellIn: 0,
      promo: 0,
      totalShipped: 0,
      sellOut: 0,
      channelStock: 0,
      sellThrough: 0,
    }
    entry.sellOut += row.sell_out_units ?? 0
    summaryMap.set(sku, entry)
  })

  const summary = Array.from(summaryMap.values())
    .map((row) => {
      const channelStock = row.totalShipped - row.sellOut
      const sellThrough =
        row.totalShipped > 0 ? (row.sellOut / row.totalShipped) * 100 : 0
      return { ...row, channelStock, sellThrough }
    })
    .sort((a, b) => b.totalShipped - a.totalShipped)

  const totals = summary.reduce(
    (acc, row) => {
      acc.sellIn += row.sellIn
      acc.promo += row.promo
      acc.totalShipped += row.totalShipped
      acc.sellOut += row.sellOut
      acc.channelStock += row.channelStock
      return acc
    },
    {
      sellIn: 0,
      promo: 0,
      totalShipped: 0,
      sellOut: 0,
      channelStock: 0,
    }
  )

  const totalSellThrough =
    totals.totalShipped > 0
      ? (totals.sellOut / totals.totalShipped) * 100
      : 0

  const totalsRow = {
    sku: 'Total',
    sellIn: formatNumber(totals.sellIn),
    promo: formatNumber(totals.promo),
    totalShipped: formatNumber(totals.totalShipped),
    sellOut: formatNumber(totals.sellOut),
    channelStock: formatNumber(totals.channelStock),
    sellThrough: formatPercent(totalSellThrough),
  }

  const topSkuChart = summary.slice(0, 8).map((row) => ({
    sku: row.sku,
    totalShipped: row.totalShipped,
    sellOut: row.sellOut,
    sellThrough: Number(row.sellThrough.toFixed(1)),
  }))

  const sellInPivot = pivotMonthly({
    rows: filteredSellInRows as SellInSkuRow[],
    rowKey: 'product',
    monthKey: 'month',
    valueKey: 'sell_in_units',
  })

  const sellOutPivot = pivotMonthly({
    rows: filteredSellOutRows as SellOutSkuRow[],
    rowKey: 'product',
    monthKey: 'month',
    valueKey: 'sell_out_units',
  })

  const availableMonths = Array.from(
    new Set([...sellInPivot.months, ...sellOutPivot.months])
  ).sort()

  return (
    <div className="space-y-8">
      <header>
        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
          SKU Summary
        </p>
        <h1 className="mt-2 text-2xl font-semibold">SKU performance</h1>
      </header>

      <FiltersBar
        basePath={`/workspace/${resolvedParams.workspaceId}/sku-summary`}
        brand={brandFilter}
        start={start}
        end={end}
        availableMonths={availableMonths}
        company={companyFilter}
        availableCompanies={companyOptions}
      />

      <SkuCharts data={topSkuChart} />

      <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
        <h2 className="text-lg font-semibold">SKU performance summary</h2>
        <p className="mt-2 text-sm text-slate-300">
          Sorted by total shipped.
        </p>
        <div className="mt-6">
          <SkuSummaryTable data={summary} totals={totalsRow} />
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
          <h3 className="text-sm font-semibold text-slate-200">
            Sell in by SKU
          </h3>
          <div className="mt-4">
            <PivotTable
              data={sellInPivot.data}
              months={sellInPivot.months}
              totals={sellInPivot.totals}
              rowKey="product"
              rowLabel="SKU"
              csvFilename="sku-sell-in-by-month.csv"
              filterPlaceholder="Filter SKUs..."
              stickyRowHeader
            />
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
          <h3 className="text-sm font-semibold text-slate-200">
            Sell out by SKU
          </h3>
          <div className="mt-4">
            <PivotTable
              data={sellOutPivot.data}
              months={sellOutPivot.months}
              totals={sellOutPivot.totals}
              rowKey="product"
              rowLabel="SKU"
              csvFilename="sku-sell-out-by-month.csv"
              filterPlaceholder="Filter SKUs..."
              stickyRowHeader
            />
          </div>
        </div>
      </section>
    </div>
  )
}
