import { createClient } from '@/lib/supabase/server'
import { pivotMonthly } from '@/lib/analytics/pivot'
import PivotTable from '@/components/table/PivotTable'
import FiltersBar from '@/components/filters/FiltersBar'
import { resolveSearchParams, type WorkspaceSearchParams } from '@/lib/search-params'

type SellOutMonthlyRow = {
  company: string
  month: string
  sell_out_units: number
}

export default async function SellOutSummaryPage({
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
    .select('brand_filter')
    .eq('workspace_id', params.workspaceId)
    .maybeSingle()

  const brandFilter =
    resolvedSearchParams.brand?.trim() || settings?.brand_filter || ''
  const start = resolvedSearchParams.start ?? ''
  const end = resolvedSearchParams.end ?? ''
  const startDate = start ? `${start}-01` : null
  const endDate = end ? `${end}-01` : null

  let query = supabase
    .from('vw_sell_out_company_monthly')
    .select('company, month, sell_out_units')
    .eq('workspace_id', params.workspaceId)

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
    rows: (rows ?? []) as SellOutMonthlyRow[],
    rowKey: 'company',
    monthKey: 'month',
    valueKey: 'sell_out_units',
  })

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
          Sell Out Summary
        </p>
        <h1 className="mt-2 text-2xl font-semibold">
          Company by month (Sell Out)
        </h1>
      </header>

      <FiltersBar
        basePath={`/workspace/${params.workspaceId}/sell-out`}
        brand={brandFilter}
        start={start}
        end={end}
      />

      <PivotTable
        data={pivotData}
        months={months}
        totals={totals}
        rowKey="company"
        rowLabel="Company"
        csvFilename="sell-out-summary.csv"
        filterPlaceholder="Filter companies..."
      />
    </div>
  )
}
