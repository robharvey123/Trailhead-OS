import { createClient } from '@/lib/supabase/server'
import { formatCurrency, formatNumber, formatPercent } from '@/lib/format'
import { resolveSearchParams, type WorkspaceSearchParams } from '@/lib/search-params'
import DashboardCharts from './DashboardCharts'
import DashboardTable from './DashboardTable'
import FiltersBar from '@/components/filters/FiltersBar'

type SellInMonthlyRow = {
  month: string
  sell_in_units: number
  promo_units: number
  total_shipped: number
  revenue: number
}

type SellOutMonthlyRow = {
  month: string
  sell_out_units: number
}

type MonthlySummary = {
  month: string
  sellIn: number
  promo: number
  totalShipped: number
  sellOut: number
  variance: number
}

const buildMonthlyMap = (
  sellInRows: SellInMonthlyRow[],
  sellOutRows: SellOutMonthlyRow[]
) => {
  const map = new Map<string, MonthlySummary>()

  sellInRows.forEach((row) => {
    const monthKey = row.month.slice(0, 7)
    const entry = map.get(monthKey) ?? {
      month: monthKey,
      sellIn: 0,
      promo: 0,
      totalShipped: 0,
      sellOut: 0,
      variance: 0,
    }

    entry.sellIn = row.sell_in_units ?? 0
    entry.promo = row.promo_units ?? 0
    entry.totalShipped = row.total_shipped ?? 0
    map.set(monthKey, entry)
  })

  sellOutRows.forEach((row) => {
    const monthKey = row.month.slice(0, 7)
    const entry = map.get(monthKey) ?? {
      month: monthKey,
      sellIn: 0,
      promo: 0,
      totalShipped: 0,
      sellOut: 0,
      variance: 0,
    }

    entry.sellOut = row.sell_out_units ?? 0
    map.set(monthKey, entry)
  })

  return Array.from(map.values())
    .map((entry) => ({
      ...entry,
      variance: entry.totalShipped - entry.sellOut,
    }))
    .sort((a, b) => a.month.localeCompare(b.month))
}

export default async function DashboardPage({
  params,
  searchParams,
}: {
  params: { workspaceId: string }
  searchParams: WorkspaceSearchParams | Promise<WorkspaceSearchParams>
}) {
  const resolvedSearchParams = await resolveSearchParams(searchParams)
  const supabase = await createClient()

  const { data: settings } = await supabase
    .from('workspace_settings')
    .select('brand_filter, currency_symbol')
    .eq('workspace_id', params.workspaceId)
    .maybeSingle()

  const brandFilter =
    resolvedSearchParams.brand?.trim() || settings?.brand_filter || ''
  const currencySymbol = settings?.currency_symbol ?? '$'
  const start = resolvedSearchParams.start ?? ''
  const end = resolvedSearchParams.end ?? ''
  const startDate = start ? `${start}-01` : null
  const endDate = end ? `${end}-01` : null

  let sellInQuery = supabase
    .from('vw_sell_in_monthly')
    .select('month, sell_in_units, promo_units, total_shipped, revenue')
    .eq('workspace_id', params.workspaceId)

  let sellOutQuery = supabase
    .from('vw_sell_out_monthly')
    .select('month, sell_out_units')
    .eq('workspace_id', params.workspaceId)

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

  const [{ data: sellInMonthly }, { data: sellOutMonthly }] =
    await Promise.all([sellInQuery, sellOutQuery])

  const monthlySummary = buildMonthlyMap(
    (sellInMonthly ?? []) as SellInMonthlyRow[],
    (sellOutMonthly ?? []) as SellOutMonthlyRow[]
  )

  const totalSellIn = monthlySummary.reduce(
    (sum, row) => sum + row.sellIn,
    0
  )
  const totalPromo = monthlySummary.reduce((sum, row) => sum + row.promo, 0)
  const totalShipped = monthlySummary.reduce(
    (sum, row) => sum + row.totalShipped,
    0
  )
  const totalSellOut = monthlySummary.reduce(
    (sum, row) => sum + row.sellOut,
    0
  )

  const totalRevenue = (sellInMonthly ?? []).reduce(
    (sum, row) => sum + (row.revenue ?? 0),
    0
  )

  const channelStockBuild = totalShipped - totalSellOut
  const sellThroughRate =
    totalShipped > 0 ? (totalSellOut / totalShipped) * 100 : 0

  const chartData = (() => {
    let cumulative = 0
    return monthlySummary.map((row) => {
      cumulative += row.totalShipped - row.sellOut
      return {
        month: row.month,
        totalShipped: row.totalShipped,
        sellOut: row.sellOut,
        cumulativeStock: cumulative,
      }
    })
  })()

  const totalsRow = {
    month: 'Total',
    sellIn: formatNumber(totalSellIn),
    promo: formatNumber(totalPromo),
    totalShipped: formatNumber(totalShipped),
    sellOut: formatNumber(totalSellOut),
    variance: formatNumber(channelStockBuild),
  }

  const metrics = [
    {
      label: 'Total Sell In',
      value: formatNumber(totalSellIn),
    },
    {
      label: 'Total Revenue',
      value: formatCurrency(totalRevenue, currencySymbol),
    },
    {
      label: 'Promo Stock (FOC)',
      value: formatNumber(totalPromo),
    },
    {
      label: 'Total Shipped',
      value: formatNumber(totalShipped),
    },
    {
      label: 'Total Sell Out',
      value: formatNumber(totalSellOut),
    },
    {
      label: 'Channel Stock Build',
      value: formatNumber(channelStockBuild),
    },
    {
      label: 'Sell Through Rate',
      value: formatPercent(sellThroughRate),
    },
  ]

  return (
    <div className="space-y-8">
      <header>
        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
          Dashboard
        </p>
        <h1 className="mt-2 text-2xl font-semibold">Sell-in vs sell-out</h1>
        <p className="mt-2 text-sm text-slate-300">
          {brandFilter ? `Brand filter: ${brandFilter}` : 'All brands'}
        </p>
      </header>

      <FiltersBar
        basePath={`/workspace/${params.workspaceId}/dashboard`}
        brand={brandFilter}
        start={start}
        end={end}
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <div
            key={metric.label}
            className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4"
          >
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
              {metric.label}
            </p>
            <p className="mt-3 text-xl font-semibold text-white">
              {metric.value}
            </p>
          </div>
        ))}
      </section>

      <DashboardCharts data={chartData} />

      <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
        <h2 className="text-lg font-semibold">Monthly summary</h2>
        <p className="mt-2 text-sm text-slate-300">
          Sell in, promo, shipments, sell out, and variance by month.
        </p>
        <div className="mt-6">
          <DashboardTable data={monthlySummary} totals={totalsRow} />
        </div>
      </section>
    </div>
  )
}
