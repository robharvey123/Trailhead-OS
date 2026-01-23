import { createClient } from '@/lib/supabase/server'
import { formatNumber, formatPercent } from '@/lib/format'
import CompanySkuTable from './CompanySkuTable'
import CompanySkuCharts from './CompanySkuCharts'
import FiltersBar from '@/components/filters/FiltersBar'
import { resolveSearchParams, type WorkspaceSearchParams } from '@/lib/search-params'
import {
  resolveWorkspaceParams,
  type WorkspaceRouteParams,
} from '@/lib/route-params'

type SellInSkuRow = {
  customer: string
  product: string
  sell_in_units: number
  promo_units: number
  total_shipped: number
  month?: string
}

type SellOutSkuRow = {
  company: string
  product: string
  sell_out_units: number
  month?: string
}

type MappingRow = {
  customer: string
  sell_out_company: string | null
}

type CompanySkuRow = {
  sku: string
  sellIn: number
  promo: number
  totalShipped: number
  sellOut: number
  variance: number
  sellThrough: number
}

type CompanySkuAccum = CompanySkuRow & { company: string }

type CompanyGroup = {
  company: string
  skus: CompanySkuRow[]
  totals: CompanySkuRow
}

export default async function CompanySkuDetailPage({
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
  const start = resolvedSearchParams.start ?? ''
  const end = resolvedSearchParams.end ?? ''
  const startDate = start ? `${start}-01` : null
  const endDate = end ? `${end}-01` : null

  let sellInQuery = supabase
    .from('vw_sell_in_customer_sku_monthly')
    .select('customer, product, sell_in_units, promo_units, total_shipped, month')
    .eq('workspace_id', resolvedParams.workspaceId)

  let sellOutQuery = supabase
    .from('vw_sell_out_company_sku_monthly')
    .select('company, product, sell_out_units, month')
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

  const skuMap = new Map<string, CompanySkuAccum>()

  ;(sellInRows ?? []).forEach((row) => {
    const mapping = mappingByCustomer.get(row.customer)
    const company = mapping?.sell_out_company ?? row.customer
    const key = `${company}__${row.product}`
    const entry = skuMap.get(key) ?? {
      sku: row.product,
      sellIn: 0,
      promo: 0,
      totalShipped: 0,
      sellOut: 0,
      variance: 0,
      sellThrough: 0,
      company,
    }

    entry.sellIn += row.sell_in_units ?? 0
    entry.promo += row.promo_units ?? 0
    entry.totalShipped += row.total_shipped ?? 0
    skuMap.set(key, { ...entry, company })
  })

  ;(sellOutRows ?? []).forEach((row) => {
    const key = `${row.company}__${row.product}`
    const entry = skuMap.get(key) ?? {
      sku: row.product,
      sellIn: 0,
      promo: 0,
      totalShipped: 0,
      sellOut: 0,
      variance: 0,
      sellThrough: 0,
      company: row.company,
    }

    entry.sellOut += row.sell_out_units ?? 0
    skuMap.set(key, { ...entry, company: row.company })
  })

  const companyMap = new Map<string, CompanyGroup>()

  skuMap.forEach((row) => {
    const company = row.company
    const skuRow: CompanySkuRow = {
      sku: row.sku,
      sellIn: row.sellIn,
      promo: row.promo,
      totalShipped: row.totalShipped,
      sellOut: row.sellOut,
      variance: row.totalShipped - row.sellOut,
      sellThrough:
        row.totalShipped > 0 ? (row.sellOut / row.totalShipped) * 100 : 0,
    }

    const group = companyMap.get(company) ?? {
      company,
      skus: [],
      totals: {
        sku: 'Total',
        sellIn: 0,
        promo: 0,
        totalShipped: 0,
        sellOut: 0,
        variance: 0,
        sellThrough: 0,
      },
    }

    group.skus.push(skuRow)
    group.totals.sellIn += skuRow.sellIn
    group.totals.promo += skuRow.promo
    group.totals.totalShipped += skuRow.totalShipped
    group.totals.sellOut += skuRow.sellOut
    group.totals.variance += skuRow.variance
    group.totals.sellThrough =
      group.totals.totalShipped > 0
        ? (group.totals.sellOut / group.totals.totalShipped) * 100
        : 0

    companyMap.set(company, group)
  })

  const groups = Array.from(companyMap.values()).sort((a, b) =>
    a.company.localeCompare(b.company)
  )

  const availableMonths = Array.from(
    new Set(
      [
        ...(sellInRows ?? []).map((row) => row.month?.slice(0, 7)),
        ...(sellOutRows ?? []).map((row) => row.month?.slice(0, 7)),
      ].filter(Boolean)
    )
  ).sort()

  const grandTotals = groups.reduce(
    (totals, group) => {
      totals.sellIn += group.totals.sellIn
      totals.sellOut += group.totals.sellOut
      totals.totalShipped += group.totals.totalShipped
      return totals
    },
    { sellIn: 0, sellOut: 0, totalShipped: 0 }
  )

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
          Company SKU Detail
        </p>
        <h1 className="mt-2 text-2xl font-semibold">SKU drilldowns</h1>
      </header>

      <FiltersBar
        basePath={`/workspace/${resolvedParams.workspaceId}/company-sku-detail`}
        brand={brandFilter}
        start={start}
        end={end}
        availableMonths={availableMonths}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
            Grand total sell in
          </p>
          <p className="mt-3 text-2xl font-semibold text-slate-100">
            {formatNumber(grandTotals.sellIn)}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
            Grand total sell out
          </p>
          <p className="mt-3 text-2xl font-semibold text-slate-100">
            {formatNumber(grandTotals.sellOut)}
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {groups.length ? (
          groups.map((group) => {
            const chartData = group.skus
              .slice()
              .sort((a, b) => b.totalShipped - a.totalShipped)
              .slice(0, 12)
              .map((sku) => ({
                sku: sku.sku,
                sellIn: sku.sellIn,
                sellOut: sku.sellOut,
              }))

            return (
              <details
                key={group.company}
                className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4"
                open={groups.length <= 3}
              >
                <summary className="cursor-pointer list-none text-sm font-semibold text-slate-200">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <span>{group.company}</span>
                    <span className="text-xs text-slate-400">
                      Total shipped: {formatNumber(group.totals.totalShipped)} | Sell
                      out: {formatNumber(group.totals.sellOut)} | ST%:{' '}
                      {formatPercent(group.totals.sellThrough)}
                    </span>
                  </div>
                </summary>
                <div className="mt-4 space-y-4">
                  <CompanySkuCharts data={chartData} />
                  <CompanySkuTable
                    data={group.skus.sort(
                      (a, b) => b.totalShipped - a.totalShipped
                    )}
                    totals={{
                      ...group.totals,
                      sellIn: formatNumber(group.totals.sellIn),
                      promo: formatNumber(group.totals.promo),
                      totalShipped: formatNumber(group.totals.totalShipped),
                      sellOut: formatNumber(group.totals.sellOut),
                      variance: formatNumber(group.totals.variance),
                      sellThrough: formatPercent(group.totals.sellThrough),
                    }}
                    csvFilename={`${group.company}-sku-detail.csv`}
                  />
                </div>
              </details>
            )
          })
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-900/40 p-6 text-sm text-slate-300">
            No SKU data yet. Import sell-in and sell-out rows to populate company
            drilldowns.
          </div>
        )}
      </div>
    </div>
  )
}
