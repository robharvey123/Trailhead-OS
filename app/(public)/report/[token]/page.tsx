import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import DashboardCharts from '@/app/(app)/workspace/[workspaceId]/dashboard/DashboardCharts'
import DashboardInsights from '@/app/(app)/workspace/[workspaceId]/dashboard/DashboardInsights'
import { createAdminClient } from '@/lib/supabase/admin'
import { formatCurrency, formatNumber, formatPercent } from '@/lib/format'

type ReportTokenRow = {
  id: string
  workspace_id: string
  label: string | null
  expires_at: string
}

type WorkspaceRow = {
  id: string
  name: string
}

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

function createAnonClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  )
}

function buildMonthlyMap(
  sellInRows: SellInMonthlyRow[],
  sellOutRows: SellOutMonthlyRow[]
) {
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

function aggregateTotals<T>(
  rows: T[],
  keyFn: (row: T) => string,
  valueFn: (row: T) => number
) {
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

function topWithOther(
  rows: { label: string; value: number }[],
  limit: number,
  otherLabel: string
) {
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

function formatMonth(value: string) {
  const [year, month] = value.split('-')
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, 1))

  return new Intl.DateTimeFormat('en-GB', {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date)
}

function ExpiredReportPage() {
  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-4xl items-center justify-center px-4 py-16 sm:px-6 lg:px-8">
      <div className="w-full rounded-[2rem] border border-[#d8cfbf] bg-white/80 p-10 text-center shadow-[0_30px_80px_rgba(15,23,42,0.08)] backdrop-blur">
        <p className="text-xs uppercase tracking-[0.3em] text-[#9a7b54]">
          Shared report
        </p>
        <h1 className="mt-4 text-3xl font-semibold text-slate-900">
          This report link has expired or is invalid.
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-sm text-slate-600">
          Ask Trailhead Holdings for a fresh share link if you still need access
          to this analytics view.
        </p>
      </div>
    </div>
  )
}

export default async function PublicReportPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const anonSupabase = createAnonClient()
  const { data: tokenRow, error: tokenError } = await anonSupabase
    .from('report_tokens')
    .select('id, workspace_id, label, expires_at')
    .eq('token', token)
    .maybeSingle()

  const reportToken = (tokenRow as ReportTokenRow | null) ?? null
  const expired =
    !reportToken ||
    Boolean(tokenError) ||
    Number.isNaN(new Date(reportToken?.expires_at ?? '').getTime()) ||
    new Date(reportToken.expires_at) < new Date()

  if (expired) {
    return <ExpiredReportPage />
  }

  const adminSupabase = createAdminClient()

  const { data: workspace } = await adminSupabase
    .from('workspaces')
    .select('id, name')
    .eq('id', reportToken.workspace_id)
    .maybeSingle()

  if (!workspace) {
    return <ExpiredReportPage />
  }

  const { data: settings } = await adminSupabase
    .from('workspace_settings')
    .select('brand_filter, base_currency')
    .eq('workspace_id', reportToken.workspace_id)
    .maybeSingle()

  const brandFilter = settings?.brand_filter?.trim() || ''
  const currencyCode = settings?.base_currency ?? 'GBP'

  let sellInQuery = adminSupabase
    .from('vw_sell_in_monthly')
    .select('month, sell_in_units, promo_units, total_shipped, revenue')
    .eq('workspace_id', reportToken.workspace_id)

  let sellOutQuery = adminSupabase
    .from('vw_sell_out_monthly')
    .select('month, sell_out_units')
    .eq('workspace_id', reportToken.workspace_id)

  let sellOutPlatformQuery = adminSupabase
    .from('vw_sell_out_platform_monthly')
    .select('platform, month, sell_out_units')
    .eq('workspace_id', reportToken.workspace_id)

  let sellOutRegionQuery = adminSupabase
    .from('vw_sell_out_region_monthly')
    .select('region, month, sell_out_units')
    .eq('workspace_id', reportToken.workspace_id)

  let sellInCustomerQuery = adminSupabase
    .from('vw_sell_in_customer_monthly')
    .select('customer, month, revenue, sell_in_units')
    .eq('workspace_id', reportToken.workspace_id)

  let sellOutCompanyQuery = adminSupabase
    .from('vw_sell_out_company_monthly')
    .select('company, month, sell_out_units')
    .eq('workspace_id', reportToken.workspace_id)

  if (brandFilter) {
    sellInQuery = sellInQuery.eq('brand', brandFilter)
    sellOutQuery = sellOutQuery.eq('brand', brandFilter)
    sellOutPlatformQuery = sellOutPlatformQuery.eq('brand', brandFilter)
    sellOutRegionQuery = sellOutRegionQuery.eq('brand', brandFilter)
    sellInCustomerQuery = sellInCustomerQuery.eq('brand', brandFilter)
    sellOutCompanyQuery = sellOutCompanyQuery.eq('brand', brandFilter)
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

  const monthlySummary = buildMonthlyMap(
    (sellInMonthly ?? []) as SellInMonthlyRow[],
    (sellOutMonthly ?? []) as SellOutMonthlyRow[]
  )

  const chartData = monthlySummary.reduce<Array<{
    month: string
    totalShipped: number
    sellOut: number
    cumulativeStock: number
  }>>((rows, row) => {
    const previousCumulative = rows[rows.length - 1]?.cumulativeStock ?? 0
    rows.push({
      month: row.month,
      totalShipped: row.totalShipped,
      sellOut: row.sellOut,
      cumulativeStock: previousCumulative + row.totalShipped - row.sellOut,
    })
    return rows
  }, [])

  const aspMap = new Map<string, { revenue: number; units: number }>()
  ;((sellInMonthly ?? []) as SellInMonthlyRow[]).forEach((row) => {
    const monthKey = row.month.slice(0, 7)
    const current = aspMap.get(monthKey) ?? { revenue: 0, units: 0 }
    current.revenue += row.revenue ?? 0
    current.units += row.sell_in_units ?? 0
    aspMap.set(monthKey, current)
  })

  const aspData = Array.from(aspMap.entries())
    .map(([month, totals]) => ({
      month,
      value: totals.units > 0 ? totals.revenue / totals.units : 0,
    }))
    .sort((a, b) => a.month.localeCompare(b.month))

  const promoRateData = monthlySummary.map((row) => ({
    month: row.month,
    value: row.sellIn > 0 ? (row.promo / row.sellIn) * 100 : 0,
  }))

  const platformData = topWithOther(
    aggregateTotals(
      (sellOutPlatformMonthly ?? []) as SellOutPlatformMonthlyRow[],
      (row) => row.platform ?? 'Unknown',
      (row) => row.sell_out_units ?? 0
    ),
    6,
    'Other'
  )

  const regionData = topWithOther(
    aggregateTotals(
      (sellOutRegionMonthly ?? []) as SellOutRegionMonthlyRow[],
      (row) => row.region ?? 'Unknown',
      (row) => row.sell_out_units ?? 0
    ),
    6,
    'Other'
  )

  const topCustomerRevenue = topWithOther(
    aggregateTotals(
      (sellInCustomerMonthly ?? []) as SellInCustomerMonthlyRow[],
      (row) => row.customer ?? 'Unknown',
      (row) => row.revenue ?? 0
    ),
    6,
    'Other'
  )

  const topCompanySellOut = topWithOther(
    aggregateTotals(
      (sellOutCompanyMonthly ?? []) as SellOutCompanyMonthlyRow[],
      (row) => row.company ?? 'Unknown',
      (row) => row.sell_out_units ?? 0
    ),
    6,
    'Other'
  )

  const totals = monthlySummary.reduce(
    (sum, row) => ({
      sellIn: sum.sellIn + row.sellIn,
      promo: sum.promo + row.promo,
      totalShipped: sum.totalShipped + row.totalShipped,
      sellOut: sum.sellOut + row.sellOut,
      variance: sum.variance + row.variance,
    }),
    { sellIn: 0, promo: 0, totalShipped: 0, sellOut: 0, variance: 0 }
  )

  const revenueTotal = ((sellInMonthly ?? []) as SellInMonthlyRow[]).reduce(
    (sum, row) => sum + (row.revenue ?? 0),
    0
  )
  const promoRate =
    totals.sellIn > 0 ? (totals.promo / totals.sellIn) * 100 : 0
  const sellThrough =
    totals.totalShipped > 0 ? (totals.sellOut / totals.totalShipped) * 100 : 0

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-12 pt-8 sm:px-6 lg:px-8">
      <div className="overflow-hidden rounded-[2.5rem] border border-[#d8cfbf] bg-white/75 shadow-[0_30px_80px_rgba(15,23,42,0.08)] backdrop-blur">
        <div className="border-b border-[#e7dccd] bg-[linear-gradient(135deg,rgba(255,255,255,0.88),rgba(244,235,222,0.82))] px-6 py-8 sm:px-8">
          <p className="text-xs uppercase tracking-[0.32em] text-[#9a7b54]">
            Shared analytics report
          </p>
          <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-3xl font-semibold text-slate-900">
                {(workspace as WorkspaceRow).name}
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-600">
                Read-only performance snapshot shared securely by Trailhead
                Holdings.
                {reportToken.label ? ` ${reportToken.label}.` : ''}
              </p>
            </div>
            <div className="rounded-full border border-[#d7c4aa] bg-white/80 px-4 py-2 text-xs uppercase tracking-[0.2em] text-[#8b6b44]">
              Expires {new Date(reportToken.expires_at).toLocaleDateString('en-GB')}
            </div>
          </div>
        </div>

        <div className="space-y-8 bg-[#f8f3eb] px-6 py-8 sm:px-8">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-[1.75rem] border border-[#e5d8c6] bg-white/85 p-5">
              <p className="text-xs uppercase tracking-[0.2em] text-[#8b6b44]">
                Revenue
              </p>
              <p className="mt-3 text-2xl font-semibold text-slate-900">
                {formatCurrency(revenueTotal, currencyCode)}
              </p>
            </div>
            <div className="rounded-[1.75rem] border border-[#e5d8c6] bg-white/85 p-5">
              <p className="text-xs uppercase tracking-[0.2em] text-[#8b6b44]">
                Total shipped
              </p>
              <p className="mt-3 text-2xl font-semibold text-slate-900">
                {formatNumber(totals.totalShipped)}
              </p>
            </div>
            <div className="rounded-[1.75rem] border border-[#e5d8c6] bg-white/85 p-5">
              <p className="text-xs uppercase tracking-[0.2em] text-[#8b6b44]">
                Promo rate
              </p>
              <p className="mt-3 text-2xl font-semibold text-slate-900">
                {formatPercent(promoRate)}
              </p>
            </div>
            <div className="rounded-[1.75rem] border border-[#e5d8c6] bg-white/85 p-5">
              <p className="text-xs uppercase tracking-[0.2em] text-[#8b6b44]">
                Sell-through
              </p>
              <p className="mt-3 text-2xl font-semibold text-slate-900">
                {formatPercent(sellThrough)}
              </p>
            </div>
          </div>

          <DashboardCharts data={chartData} />

          <DashboardInsights
            aspData={aspData}
            promoRateData={promoRateData}
            platformData={platformData}
            regionData={regionData}
            topCustomerRevenue={topCustomerRevenue}
            topCompanySellOut={topCompanySellOut}
            currencySymbol={currencyCode}
          />

          <section className="rounded-[2rem] border border-[#e5d8c6] bg-white/85 p-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">
                  Monthly summary
                </h2>
                <p className="mt-2 text-sm text-slate-600">
                  Core sell-in, promo, shipped, and sell-out performance by
                  month.
                </p>
              </div>
            </div>

            <div className="mt-6 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-[#eadfce] text-left text-xs uppercase tracking-[0.18em] text-[#8b6b44]">
                    <th className="pb-3 pr-4">Month</th>
                    <th className="pb-3 pr-4 text-right">Sell In</th>
                    <th className="pb-3 pr-4 text-right">Promo</th>
                    <th className="pb-3 pr-4 text-right">Total shipped</th>
                    <th className="pb-3 pr-4 text-right">Sell out</th>
                    <th className="pb-3 text-right">Variance</th>
                  </tr>
                </thead>
                <tbody>
                  {monthlySummary.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="py-8 text-center text-sm text-slate-500"
                      >
                        No analytics data is available for this shared report yet.
                      </td>
                    </tr>
                  ) : (
                    monthlySummary.map((row) => (
                      <tr
                        key={row.month}
                        className="border-b border-[#f0e7da] text-slate-700"
                      >
                        <td className="py-3 pr-4 font-medium text-slate-900">
                          {formatMonth(row.month)}
                        </td>
                        <td className="py-3 pr-4 text-right">
                          {formatNumber(row.sellIn)}
                        </td>
                        <td className="py-3 pr-4 text-right">
                          {formatNumber(row.promo)}
                        </td>
                        <td className="py-3 pr-4 text-right">
                          {formatNumber(row.totalShipped)}
                        </td>
                        <td className="py-3 pr-4 text-right">
                          {formatNumber(row.sellOut)}
                        </td>
                        <td className="py-3 text-right font-medium text-slate-900">
                          {formatNumber(row.variance)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>

      <footer className="pb-4 pt-6 text-center text-xs uppercase tracking-[0.22em] text-[#8b6b44]">
        Powered by Trailhead OS
      </footer>
    </div>
  )
}
