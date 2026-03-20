import { createClient } from '@/lib/supabase/server'
import { currencySymbol as getCurrencySymbol, formatCurrency, formatNumber, formatPercent } from '@/lib/format'
import { resolveSearchParams, type WorkspaceSearchParams } from '@/lib/search-params'
import {
  resolveWorkspaceParams,
  type WorkspaceRouteParams,
} from '@/lib/route-params'
import DashboardCharts from './DashboardCharts'
import DashboardInsights from './DashboardInsights'
import DashboardKPIs from './DashboardKPIs'
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

type SellOutPlatformMonthlyRow = {
  platform: string | null
  month: string
  sell_out_units: number
}

type SellOutRegionMonthlyRow = {
  region: string | null
  month: string
  sell_out_units: number
}

type SellInCustomerMonthlyRow = {
  customer: string
  month: string
  revenue: number
  sell_in_units: number
}

type SellOutCompanyMonthlyRow = {
  company: string
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

    entry.sellIn += row.sell_in_units ?? 0
    entry.promo += row.promo_units ?? 0
    entry.totalShipped += row.total_shipped ?? 0
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

    entry.sellOut += row.sell_out_units ?? 0
    map.set(monthKey, entry)
  })

  return Array.from(map.values())
    .map((entry) => ({
      ...entry,
      variance: entry.totalShipped - entry.sellOut,
    }))
    .sort((a, b) => a.month.localeCompare(b.month))
}

const aggregateTotals = <T,>(
  rows: T[],
  keyFn: (row: T) => string,
  valueFn: (row: T) => number
) => {
  const map = new Map<string, number>()

  rows.forEach((row) => {
    const key = keyFn(row)
    const value = valueFn(row)
    if (!key || Number.isNaN(value)) {
      return
    }
    map.set(key, (map.get(key) ?? 0) + value)
  })

  return Array.from(map.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
}

const topWithOther = (
  rows: { label: string; value: number }[],
  limit: number,
  otherLabel: string
) => {
  if (rows.length <= limit) {
    return rows
  }

  const top = rows.slice(0, limit)
  const remainder = rows.slice(limit).reduce((sum, row) => sum + row.value, 0)

  if (remainder > 0) {
    top.push({ label: otherLabel, value: remainder })
  }

  return top
}

export default async function DashboardPage({
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
  const currencySymbol = getCurrencySymbol(settings?.base_currency ?? 'GBP')
  const start = resolvedSearchParams.start ?? ''
  const end = resolvedSearchParams.end ?? ''
  const startDate = start ? `${start}-01` : null
  const endDate = end ? `${end}-01` : null

  let sellInQuery = supabase
    .from('vw_sell_in_monthly')
    .select('month, sell_in_units, promo_units, total_shipped, revenue')
    .eq('workspace_id', resolvedParams.workspaceId)

  let sellOutQuery = supabase
    .from('vw_sell_out_monthly')
    .select('month, sell_out_units')
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

  let sellOutPlatformQuery = supabase
    .from('vw_sell_out_platform_monthly')
    .select('platform, month, sell_out_units')
    .eq('workspace_id', resolvedParams.workspaceId)

  let sellOutRegionQuery = supabase
    .from('vw_sell_out_region_monthly')
    .select('region, month, sell_out_units')
    .eq('workspace_id', resolvedParams.workspaceId)

  let sellInCustomerQuery = supabase
    .from('vw_sell_in_customer_monthly')
    .select('customer, month, revenue, sell_in_units')
    .eq('workspace_id', resolvedParams.workspaceId)

  let sellOutCompanyQuery = supabase
    .from('vw_sell_out_company_monthly')
    .select('company, month, sell_out_units')
    .eq('workspace_id', resolvedParams.workspaceId)

  if (brandFilter) {
    sellOutPlatformQuery = sellOutPlatformQuery.eq('brand', brandFilter)
    sellOutRegionQuery = sellOutRegionQuery.eq('brand', brandFilter)
    sellInCustomerQuery = sellInCustomerQuery.eq('brand', brandFilter)
    sellOutCompanyQuery = sellOutCompanyQuery.eq('brand', brandFilter)
  }

  if (startDate) {
    sellOutPlatformQuery = sellOutPlatformQuery.gte('month', startDate)
    sellOutRegionQuery = sellOutRegionQuery.gte('month', startDate)
    sellInCustomerQuery = sellInCustomerQuery.gte('month', startDate)
    sellOutCompanyQuery = sellOutCompanyQuery.gte('month', startDate)
  }

  if (endDate) {
    sellOutPlatformQuery = sellOutPlatformQuery.lte('month', endDate)
    sellOutRegionQuery = sellOutRegionQuery.lte('month', endDate)
    sellInCustomerQuery = sellInCustomerQuery.lte('month', endDate)
    sellOutCompanyQuery = sellOutCompanyQuery.lte('month', endDate)
  }

  const [
    { data: sellInMonthly },
    { data: sellOutMonthly },
    { data: sellOutPlatformMonthly },
    { data: sellOutRegionMonthly },
    { data: sellInCustomerMonthly },
    { data: sellOutCompanyMonthly },
  ] = await Promise.all([
    sellInQuery,
    sellOutQuery,
    sellOutPlatformQuery,
    sellOutRegionQuery,
    sellInCustomerQuery,
    sellOutCompanyQuery,
  ])

  // Module KPI queries
  const wid = resolvedParams.workspaceId
  const { data: { user } } = await supabase.auth.getUser()
  const [
    { count: outstandingInvoiceCount },
    { data: outstandingInvoices },
    { count: activeDealCount },
    { data: dealPipelineRows },
    { count: activeCampaignCount },
    { count: lowStockCount },
    { count: inTransitCount },
    { count: activeStaffCount },
    { count: unreadNotifCount },
  ] = await Promise.all([
    supabase.from('finance_invoices').select('*', { count: 'exact', head: true }).eq('workspace_id', wid).not('status', 'in', '("paid","cancelled","refunded")'),
    supabase.from('finance_invoices').select('total, amount_paid').eq('workspace_id', wid).not('status', 'in', '("paid","cancelled","refunded")'),
    supabase.from('crm_deals').select('*', { count: 'exact', head: true }).eq('workspace_id', wid).not('stage', 'like', 'closed_%'),
    supabase.from('crm_deals').select('value').eq('workspace_id', wid).not('stage', 'like', 'closed_%'),
    supabase.from('marketing_campaigns').select('*', { count: 'exact', head: true }).eq('workspace_id', wid).in('status', ['active', 'scheduled']),
    supabase.from('inventory').select('*', { count: 'exact', head: true }).eq('workspace_id', wid).filter('qty_on_hand', 'lte', 'reorder_point'),
    supabase.from('shipments').select('*', { count: 'exact', head: true }).eq('workspace_id', wid).in('status', ['in_transit', 'shipped']),
    supabase.from('staff_profiles').select('*', { count: 'exact', head: true }).eq('workspace_id', wid).eq('is_active', true),
    supabase.from('notifications').select('*', { count: 'exact', head: true }).eq('workspace_id', wid).eq('user_id', user?.id ?? '').eq('is_read', false),
  ])

  const outstandingTotal = (outstandingInvoices ?? []).reduce((s, i) => s + ((i.total ?? 0) - (i.amount_paid ?? 0)), 0)
  const pipelineValue = (dealPipelineRows ?? []).reduce((s, d) => s + (d.value ?? 0), 0)

  const moduleKpis = {
    outstandingInvoices: outstandingInvoiceCount ?? 0,
    outstandingTotal,
    activeDealCount: activeDealCount ?? 0,
    pipelineValue,
    activeCampaignCount: activeCampaignCount ?? 0,
    lowStockCount: lowStockCount ?? 0,
    inTransitShipments: inTransitCount ?? 0,
    activeStaffCount: activeStaffCount ?? 0,
    unreadNotifications: unreadNotifCount ?? 0,
    currencySymbol,
  }

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
  const aspOverall = totalSellIn > 0 ? totalRevenue / totalSellIn : 0
  const promoRateOverall =
    totalShipped > 0 ? (totalPromo / totalShipped) * 100 : 0
  const sellOutMoM = (() => {
    if (monthlySummary.length < 2) {
      return 0
    }
    const previous = monthlySummary[monthlySummary.length - 2]
    const current = monthlySummary[monthlySummary.length - 1]
    if (!previous.sellOut) {
      return 0
    }
    return ((current.sellOut - previous.sellOut) / previous.sellOut) * 100
  })()

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

  // Aggregate ASP per month across currencies
  const aspMap = new Map<string, { revenue: number; units: number }>()
  for (const row of (sellInMonthly ?? []) as SellInMonthlyRow[]) {
    const month = row.month.slice(0, 7)
    const entry = aspMap.get(month) ?? { revenue: 0, units: 0 }
    entry.revenue += row.revenue ?? 0
    entry.units += row.sell_in_units ?? 0
    aspMap.set(month, entry)
  }
  const aspData = Array.from(aspMap.entries())
    .map(([month, agg]) => ({ month, value: agg.units > 0 ? agg.revenue / agg.units : 0 }))
    .sort((a, b) => a.month.localeCompare(b.month))

  const promoRateData = monthlySummary.map((row) => ({
    month: row.month,
    value: row.totalShipped > 0 ? (row.promo / row.totalShipped) * 100 : 0,
  }))

  const platformData = topWithOther(
    aggregateTotals(
      (sellOutPlatformMonthly ?? []) as SellOutPlatformMonthlyRow[],
      (row) => row.platform?.trim() || 'Unknown',
      (row) => row.sell_out_units ?? 0
    ),
    8,
    'Other'
  )

  const regionData = topWithOther(
    aggregateTotals(
      (sellOutRegionMonthly ?? []) as SellOutRegionMonthlyRow[],
      (row) => row.region?.trim() || 'Unknown',
      (row) => row.sell_out_units ?? 0
    ),
    8,
    'Other'
  )

  const topCustomerRevenue = topWithOther(
    aggregateTotals(
      (sellInCustomerMonthly ?? []) as SellInCustomerMonthlyRow[],
      (row) => row.customer?.trim() || 'Unknown',
      (row) => row.revenue ?? 0
    ),
    10,
    'Other'
  )

  const topCompanySellOut = topWithOther(
    aggregateTotals(
      (sellOutCompanyMonthly ?? []) as SellOutCompanyMonthlyRow[],
      (row) => row.company?.trim() || 'Unknown',
      (row) => row.sell_out_units ?? 0
    ),
    10,
    'Other'
  )

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
    {
      label: 'Average Selling Price',
      value: formatCurrency(aspOverall, currencySymbol),
    },
    {
      label: 'Promo Rate',
      value: formatPercent(promoRateOverall),
    },
    {
      label: 'Sell-Out MoM',
      value: formatPercent(sellOutMoM),
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
        basePath={`/workspace/${resolvedParams.workspaceId}/dashboard`}
        brand={brandFilter}
        start={start}
        end={end}
        availableMonths={monthlySummary.map((row) => row.month)}
      />

      <DashboardKPIs kpis={moduleKpis} workspaceId={resolvedParams.workspaceId} />

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

      <DashboardInsights
        aspData={aspData}
        promoRateData={promoRateData}
        platformData={platformData}
        regionData={regionData}
        topCustomerRevenue={topCustomerRevenue}
        topCompanySellOut={topCompanySellOut}
        currencySymbol={currencySymbol}
      />

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
