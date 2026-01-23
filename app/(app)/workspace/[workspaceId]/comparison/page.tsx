import { createClient } from '@/lib/supabase/server'
import { formatNumber, formatPercent } from '@/lib/format'
import ComparisonTable from './ComparisonTable'
import FiltersBar from '@/components/filters/FiltersBar'
import { resolveSearchParams, type WorkspaceSearchParams } from '@/lib/search-params'
import {
  resolveWorkspaceParams,
  type WorkspaceRouteParams,
} from '@/lib/route-params'

type SellInTotalsRow = {
  customer: string
  sell_in_units: number
  promo_units: number
  total_shipped: number
}

type SellOutTotalsRow = {
  company: string
  sell_out_units: number
}

type MappingRow = {
  customer: string
  sell_out_company: string | null
  group_name: string | null
}

type ComparisonRow = {
  customer: string
  sellIn: number
  promo: number
  totalShipped: number
  sellOutCompany: string
  sellOut: number
  variance: number
  sellThrough: number
  isChild?: boolean
}

export default async function ComparisonPage({
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
    .from('vw_sell_in_customer_monthly')
    .select('customer, sell_in_units, promo_units, total_shipped, month')
    .eq('workspace_id', resolvedParams.workspaceId)

  let sellOutQuery = supabase
    .from('vw_sell_out_company_monthly')
    .select('company, sell_out_units, month')
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

  const [{ data: sellInMonthly }, { data: sellOutMonthly }, { data: mappings }] =
    await Promise.all([
      sellInQuery,
      sellOutQuery,
      supabase
        .from('vw_sell_in_customer_match')
        .select('customer, sell_out_company, group_name')
        .eq('workspace_id', resolvedParams.workspaceId),
    ])

  const sellInTotals = new Map<string, SellInTotalsRow>()
  ;(sellInMonthly ?? []).forEach((row) => {
    const entry = sellInTotals.get(row.customer) ?? {
      customer: row.customer,
      sell_in_units: 0,
      promo_units: 0,
      total_shipped: 0,
    }
    entry.sell_in_units += row.sell_in_units ?? 0
    entry.promo_units += row.promo_units ?? 0
    entry.total_shipped += row.total_shipped ?? 0
    sellInTotals.set(row.customer, entry)
  })

  const sellOutTotals = new Map<string, SellOutTotalsRow>()
  ;(sellOutMonthly ?? []).forEach((row) => {
    const entry = sellOutTotals.get(row.company) ?? {
      company: row.company,
      sell_out_units: 0,
    }
    entry.sell_out_units += row.sell_out_units ?? 0
    sellOutTotals.set(row.company, entry)
  })

  const sellOutByCompany = new Map<string, number>(
    Array.from(sellOutTotals.values()).map((row) => [
      row.company,
      row.sell_out_units ?? 0,
    ])
  )

  const mappingByCustomer = new Map<string, MappingRow>()
  ;(mappings ?? []).forEach((mapping) => {
    mappingByCustomer.set(mapping.customer, mapping)
  })

  const rows = Array.from(sellInTotals.values()).map((row) => {
    const mapping = mappingByCustomer.get(row.customer)
    const sellOutCompany = mapping?.sell_out_company ?? ''
    const sellOut = sellOutCompany
      ? sellOutByCompany.get(sellOutCompany) ?? 0
      : 0

    return {
      customer: row.customer,
      sellIn: row.sell_in_units ?? 0,
      promo: row.promo_units ?? 0,
      totalShipped: row.total_shipped ?? 0,
      sellOutCompany,
      sellOut,
      variance: (row.total_shipped ?? 0) - sellOut,
      sellThrough:
        row.total_shipped && row.total_shipped > 0
          ? (sellOut / row.total_shipped) * 100
          : 0,
      groupName: mapping?.group_name ?? null,
    }
  })

  const grouped = new Map<string, typeof rows>()
  rows.forEach((row) => {
    const key = row.groupName ?? row.customer
    const group = grouped.get(key) ?? []
    group.push(row)
    grouped.set(key, group)
  })

  const comparisonRows: ComparisonRow[] = []

  grouped.forEach((groupRows, key) => {
    if (groupRows.length > 1) {
      const totalSellIn = groupRows.reduce((sum, row) => sum + row.sellIn, 0)
      const totalPromo = groupRows.reduce((sum, row) => sum + row.promo, 0)
      const totalShipped = groupRows.reduce(
        (sum, row) => sum + row.totalShipped,
        0
      )
      const companies = Array.from(
        new Set(groupRows.map((row) => row.sellOutCompany).filter(Boolean))
      )
      const sellOut = companies.reduce(
        (sum, company) => sum + (sellOutByCompany.get(company) ?? 0),
        0
      )

      comparisonRows.push({
        customer: key,
        sellIn: totalSellIn,
        promo: totalPromo,
        totalShipped,
        sellOutCompany: companies.length === 1 ? companies[0] : 'Multiple',
        sellOut,
        variance: totalShipped - sellOut,
        sellThrough: totalShipped > 0 ? (sellOut / totalShipped) * 100 : 0,
      })

      groupRows.forEach((row) => {
        comparisonRows.push({
          customer: row.customer,
          sellIn: row.sellIn,
          promo: row.promo,
          totalShipped: row.totalShipped,
          sellOutCompany: row.sellOutCompany,
          sellOut: row.sellOut,
          variance: row.variance,
          sellThrough: row.sellThrough,
          isChild: true,
        })
      })
    } else {
      const row = groupRows[0]
      comparisonRows.push({
        customer: row.customer,
        sellIn: row.sellIn,
        promo: row.promo,
        totalShipped: row.totalShipped,
        sellOutCompany: row.sellOutCompany,
        sellOut: row.sellOut,
        variance: row.variance,
        sellThrough: row.sellThrough,
      })
    }
  })

  const totals = comparisonRows.reduce(
    (acc, row) => {
      if (row.isChild) {
        return acc
      }
      acc.sellIn += row.sellIn
      acc.promo += row.promo
      acc.totalShipped += row.totalShipped
      acc.sellOut += row.sellOut
      acc.variance += row.variance
      return acc
    },
    {
      sellIn: 0,
      promo: 0,
      totalShipped: 0,
      sellOut: 0,
      variance: 0,
    }
  )

  const totalSellThrough =
    totals.totalShipped > 0 ? (totals.sellOut / totals.totalShipped) * 100 : 0

  const totalsRow = {
    customer: 'Total',
    sellIn: formatNumber(totals.sellIn),
    promo: formatNumber(totals.promo),
    totalShipped: formatNumber(totals.totalShipped),
    sellOutCompany: '',
    sellOut: formatNumber(totals.sellOut),
    variance: formatNumber(totals.variance),
    sellThrough: formatPercent(totalSellThrough),
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
          Comparison
        </p>
        <h1 className="mt-2 text-2xl font-semibold">Sell in vs sell out</h1>
      </header>

      <FiltersBar
        basePath={`/workspace/${resolvedParams.workspaceId}/comparison`}
        brand={brandFilter}
        start={start}
        end={end}
      />

      <ComparisonTable data={comparisonRows} totals={totalsRow} />
    </div>
  )
}
