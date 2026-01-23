import { createClient } from '@/lib/supabase/server'
import { formatCurrency } from '@/lib/format'
import PnlTable from './PnlTable'
import FiltersBar from '@/components/filters/FiltersBar'
import { resolveSearchParams, type WorkspaceSearchParams } from '@/lib/search-params'
import {
  resolveWorkspaceParams,
  type WorkspaceRouteParams,
} from '@/lib/route-params'

type SellInMonthlyRow = {
  month: string
  revenue: number
  promo_units: number
}

type PnlRow = {
  month: string
  revenue: number
  cogs: number
  grossProfit: number
  focCost: number
  netContribution: number
}

export default async function PnlPage({
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
    .select('brand_filter, cogs_pct, promo_cost, currency_symbol')
    .eq('workspace_id', resolvedParams.workspaceId)
    .maybeSingle()

  const brandFilter =
    resolvedSearchParams.brand?.trim() || settings?.brand_filter || ''
  const start = resolvedSearchParams.start ?? ''
  const end = resolvedSearchParams.end ?? ''
  const startDate = start ? `${start}-01` : null
  const endDate = end ? `${end}-01` : null

  let query = supabase
    .from('vw_sell_in_monthly')
    .select('month, revenue, promo_units')
    .eq('workspace_id', resolvedParams.workspaceId)

  if (brandFilter) {
    query = query.eq('brand', brandFilter)
  }

  if (startDate) {
    query = query.gte('month', startDate)
  }

  if (endDate) {
    query = query.lte('month', endDate)
  }

  const { data: rows } = await query

  const cogsPct = settings?.cogs_pct ?? 0.55
  const promoCost = settings?.promo_cost ?? 0.55
  const currencySymbol = settings?.currency_symbol ?? '$'

  const pnlRows: PnlRow[] = (rows ?? []).map((row) => {
    const revenue = row.revenue ?? 0
    const cogs = -revenue * cogsPct
    const grossProfit = revenue + cogs
    const focCost = -(row.promo_units ?? 0) * promoCost
    const netContribution = grossProfit + focCost

    return {
      month: row.month.slice(0, 7),
      revenue,
      cogs,
      grossProfit,
      focCost,
      netContribution,
    }
  })

  const totals = pnlRows.reduce(
    (acc, row) => {
      acc.revenue += row.revenue
      acc.cogs += row.cogs
      acc.grossProfit += row.grossProfit
      acc.focCost += row.focCost
      acc.netContribution += row.netContribution
      return acc
    },
    {
      revenue: 0,
      cogs: 0,
      grossProfit: 0,
      focCost: 0,
      netContribution: 0,
    }
  )

  const totalsRow = {
    month: 'Total',
    revenue: formatCurrency(totals.revenue, currencySymbol),
    cogs: formatCurrency(totals.cogs, currencySymbol),
    grossProfit: formatCurrency(totals.grossProfit, currencySymbol),
    focCost: formatCurrency(totals.focCost, currencySymbol),
    netContribution: formatCurrency(totals.netContribution, currencySymbol),
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
          P&L
        </p>
        <h1 className="mt-2 text-2xl font-semibold">Monthly P&L</h1>
        <p className="mt-2 text-sm text-slate-300">
          COGS {cogsPct}, promo cost {promoCost}.
        </p>
      </header>

      <FiltersBar
        basePath={`/workspace/${resolvedParams.workspaceId}/pnl`}
        brand={brandFilter}
        start={start}
        end={end}
      />

      <PnlTable
        data={pnlRows}
        totals={totalsRow}
        currencySymbol={currencySymbol}
      />
    </div>
  )
}
