import { createClient } from '@/lib/supabase/server'
import { currencySymbol as getCurrencySymbol } from '@/lib/format'
import { pivotMonthly } from '@/lib/analytics/pivot'
import PromoTable from './PromoTable'
import FiltersBar from '@/components/filters/FiltersBar'
import { resolveSearchParams, type WorkspaceSearchParams } from '@/lib/search-params'
import {
  resolveWorkspaceParams,
  type WorkspaceRouteParams,
} from '@/lib/route-params'

type PromoMonthlyRow = {
  customer: string
  month: string
  promo_units: number
}

type PromoPivotRow = Record<string, string | number> & { estCost?: number }

export default async function PromoSummaryPage({
  params,
  searchParams,
}: {
  params: Promise<WorkspaceRouteParams>
  searchParams: Promise<WorkspaceSearchParams>
}) {
  const resolvedParams = await resolveWorkspaceParams(params)
  const resolvedSearchParams = await resolveSearchParams(searchParams)
  const supabase = await createClient()

  const { data: settings } = await supabase
    .from('workspace_settings')
    .select('brand_filter, promo_cost, base_currency')
    .eq('workspace_id', resolvedParams.workspaceId)
    .maybeSingle()

  const brandFilter =
    resolvedSearchParams.brand?.trim() || settings?.brand_filter || ''
  const start = resolvedSearchParams.start ?? ''
  const end = resolvedSearchParams.end ?? ''
  const startDate = start ? `${start}-01` : null
  const endDate = end ? `${end}-01` : null

  let query = supabase
    .from('vw_sell_in_customer_monthly')
    .select('customer, month, promo_units')
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

  const { data: pivotData, months, totals } = pivotMonthly({
    rows: (rows ?? []) as PromoMonthlyRow[],
    rowKey: 'customer',
    monthKey: 'month',
    valueKey: 'promo_units',
  })

  const promoCost = 0
  const currencySymbol = getCurrencySymbol(settings?.base_currency ?? 'GBP')

  const dataWithCost: PromoPivotRow[] = pivotData.map((row) => ({
    ...row,
    estCost: Number(row.total ?? 0) * promoCost,
  }))

  const totalPromo = Number(totals.total ?? 0)
  const totalCost = totalPromo * promoCost

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
          Promo Summary
        </p>
        <h1 className="mt-2 text-2xl font-semibold">
          Promo units by customer
        </h1>
        <p className="mt-2 text-sm text-slate-300">
          Promo stock is valued at zero for reporting.
        </p>
      </header>

      <FiltersBar
        basePath={`/workspace/${resolvedParams.workspaceId}/promo`}
        brand={brandFilter}
        start={start}
        end={end}
        availableMonths={months}
      />

      <PromoTable
        data={dataWithCost}
        months={months}
        totals={{ ...totals, estCost: totalCost }}
        currencySymbol={currencySymbol}
      />
    </div>
  )
}
