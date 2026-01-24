import { createClient } from '@/lib/supabase/server'
import FiltersBar from '@/components/filters/FiltersBar'
import { resolveSearchParams, type WorkspaceSearchParams } from '@/lib/search-params'
import {
  resolveWorkspaceParams,
  type WorkspaceRouteParams,
} from '@/lib/route-params'
import InsightsClient from './InsightsClient'
import { getInsightsData } from '@/lib/insights/data'

export default async function InsightsPage({
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
    .select(
      'brand_filter, currency_symbol, cogs_pct, promo_cost, insights_recipients'
    )
    .eq('workspace_id', resolvedParams.workspaceId)
    .maybeSingle()

  const brandFilter =
    resolvedSearchParams.brand?.trim() || settings?.brand_filter || ''
  const start = resolvedSearchParams.start ?? ''
  const end = resolvedSearchParams.end ?? ''

  const data = await getInsightsData({
    supabase,
    workspaceId: resolvedParams.workspaceId,
    brand: brandFilter,
    start,
    end,
  })

  return (
    <div className="space-y-8">
      <header>
        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
          Insights
        </p>
        <h1 className="mt-2 text-2xl font-semibold">Monthly S&amp;OP report</h1>
        <p className="mt-2 text-sm text-slate-300">
          Generate AI-driven summaries, export PDFs, and share insights with the
          team.
        </p>
      </header>

      <FiltersBar
        basePath={`/workspace/${resolvedParams.workspaceId}/insights`}
        brand={brandFilter}
        start={start}
        end={end}
        availableMonths={data.availableMonths}
      />

      <InsightsClient
        workspaceId={resolvedParams.workspaceId}
        data={data}
        recipients={settings?.insights_recipients ?? []}
      />
    </div>
  )
}
