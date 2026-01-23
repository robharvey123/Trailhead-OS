import { createClient } from '@/lib/supabase/server'
import { pivotMonthly } from '@/lib/analytics/pivot'
import PivotTable from '@/components/table/PivotTable'
import FiltersBar from '@/components/filters/FiltersBar'

type SellInMonthlyRow = {
  customer: string
  month: string
  sell_in_units: number
}

export default async function SellInSummaryPage({
  params,
  searchParams,
}: {
  params: { workspaceId: string }
  searchParams: { brand?: string; start?: string; end?: string }
}) {
  const supabase = createClient()

  const { data: settings } = await supabase
    .from('workspace_settings')
    .select('brand_filter')
    .eq('workspace_id', params.workspaceId)
    .maybeSingle()

  const brandFilter =
    searchParams.brand?.trim() || settings?.brand_filter || ''
  const start = searchParams.start ?? ''
  const end = searchParams.end ?? ''
  const startDate = start ? `${start}-01` : null
  const endDate = end ? `${end}-01` : null

  let query = supabase
    .from('vw_sell_in_customer_monthly')
    .select('customer, month, sell_in_units')
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
    rows: (rows ?? []) as SellInMonthlyRow[],
    rowKey: 'customer',
    monthKey: 'month',
    valueKey: 'sell_in_units',
  })

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
          Sell In Summary
        </p>
        <h1 className="mt-2 text-2xl font-semibold">
          Customer by month (Sell In)
        </h1>
      </header>

      <FiltersBar
        basePath={`/workspace/${params.workspaceId}/sell-in`}
        brand={brandFilter}
        start={start}
        end={end}
      />

      <PivotTable
        data={pivotData}
        months={months}
        totals={totals}
        rowKey="customer"
        rowLabel="Customer"
        csvFilename="sell-in-summary.csv"
        filterPlaceholder="Filter customers..."
      />
    </div>
  )
}
