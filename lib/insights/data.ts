import type { SupabaseClient } from '@supabase/supabase-js'

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
  sell_in_units: number
  promo_units: number
  total_shipped: number
  revenue: number
}

type SellOutCompanyMonthlyRow = {
  company: string
  month: string
  sell_out_units: number
}

type MappingRow = {
  customer: string
  sell_out_company: string | null
}

export type InsightsMonthlySummary = {
  month: string
  sellIn: number
  promo: number
  totalShipped: number
  sellOut: number
  revenue: number
  variance: number
  channelStock: number
  sellThrough: number
}

export type InsightsChartDatum = {
  month: string
  totalShipped: number
  sellOut: number
  cumulativeStock: number
}

export type InsightsCategoryDatum = {
  label: string
  value: number
}

export type InsightsCompanySummary = {
  company: string
  sellIn: number
  promo: number
  totalShipped: number
  sellOut: number
  channelStock: number
  sellThrough: number
  revenue: number
}

export type InsightsCustomerInbound = {
  customer: string
  sellIn: number
  promo: number
  totalShipped: number
  revenue: number
}

export type InsightsData = {
  brand: string
  start: string
  end: string
  currencySymbol: string
  cogsPct: number
  promoCost: number
  monthlySummary: InsightsMonthlySummary[]
  chartData: InsightsChartDatum[]
  aspData: { month: string; value: number }[]
  promoRateData: { month: string; value: number }[]
  platformData: InsightsCategoryDatum[]
  regionData: InsightsCategoryDatum[]
  topCustomerRevenue: InsightsCategoryDatum[]
  topCompanySellOut: InsightsCategoryDatum[]
  companySummary: InsightsCompanySummary[]
  companyTotals: Omit<InsightsCompanySummary, 'company' | 'sellThrough'> & {
    sellThrough: number
  }
  customerInbound: InsightsCustomerInbound[]
  totals: {
    sellIn: number
    promo: number
    totalShipped: number
    sellOut: number
    revenue: number
    channelStock: number
    sellThrough: number
    cogs: number
    grossProfit: number
    promoCost: number
    netContribution: number
  }
  availableMonths: string[]
}

const buildMonthlySummary = (
  sellInRows: SellInMonthlyRow[],
  sellOutRows: SellOutMonthlyRow[]
) => {
  const map = new Map<string, InsightsMonthlySummary>()

  sellInRows.forEach((row) => {
    const monthKey = row.month.slice(0, 7)
    const entry = map.get(monthKey) ?? {
      month: monthKey,
      sellIn: 0,
      promo: 0,
      totalShipped: 0,
      sellOut: 0,
      revenue: 0,
      variance: 0,
      channelStock: 0,
      sellThrough: 0,
    }

    entry.sellIn = row.sell_in_units ?? 0
    entry.promo = row.promo_units ?? 0
    entry.totalShipped = row.total_shipped ?? 0
    entry.revenue = row.revenue ?? 0
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
      revenue: 0,
      variance: 0,
      channelStock: 0,
      sellThrough: 0,
    }

    entry.sellOut = row.sell_out_units ?? 0
    map.set(monthKey, entry)
  })

  return Array.from(map.values())
    .map((entry) => {
      const variance = entry.totalShipped - entry.sellOut
      const channelStock = variance
      const sellThrough =
        entry.totalShipped > 0 ? (entry.sellOut / entry.totalShipped) * 100 : 0
      return { ...entry, variance, channelStock, sellThrough }
    })
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

  return Array.from(map.entries()).map(([label, value]) => ({ label, value }))
}

const topWithOther = (
  rows: InsightsCategoryDatum[],
  limit: number,
  otherLabel = 'Other'
) => {
  const sorted = [...rows].sort((a, b) => b.value - a.value)
  if (sorted.length <= limit) {
    return sorted
  }

  const top = sorted.slice(0, limit)
  const remainder = sorted
    .slice(limit)
    .reduce((sum, row) => sum + row.value, 0)
  if (remainder > 0) {
    top.push({ label: otherLabel, value: remainder })
  }

  return top
}

export const getInsightsData = async ({
  supabase,
  workspaceId,
  brand,
  start,
  end,
}: {
  supabase: SupabaseClient
  workspaceId: string
  brand: string
  start: string
  end: string
}): Promise<InsightsData> => {
  const startDate = start ? `${start}-01` : null
  const endDate = end ? `${end}-01` : null

  const { data: settings } = await supabase
    .from('workspace_settings')
    .select('currency_symbol, cogs_pct, promo_cost')
    .eq('workspace_id', workspaceId)
    .maybeSingle()

  const currencySymbol = settings?.currency_symbol ?? '$'
  const cogsPct = settings?.cogs_pct ?? 0.55
  const promoCost = settings?.promo_cost ?? 0.55

  let sellInQuery = supabase
    .from('vw_sell_in_monthly')
    .select('month, sell_in_units, promo_units, total_shipped, revenue')
    .eq('workspace_id', workspaceId)

  let sellOutQuery = supabase
    .from('vw_sell_out_monthly')
    .select('month, sell_out_units')
    .eq('workspace_id', workspaceId)

  let sellOutPlatformQuery = supabase
    .from('vw_sell_out_platform_monthly')
    .select('platform, month, sell_out_units')
    .eq('workspace_id', workspaceId)

  let sellOutRegionQuery = supabase
    .from('vw_sell_out_region_monthly')
    .select('region, month, sell_out_units')
    .eq('workspace_id', workspaceId)

  let sellInCustomerQuery = supabase
    .from('vw_sell_in_customer_monthly')
    .select('customer, month, sell_in_units, promo_units, total_shipped, revenue')
    .eq('workspace_id', workspaceId)

  let sellOutCompanyQuery = supabase
    .from('vw_sell_out_company_monthly')
    .select('company, month, sell_out_units')
    .eq('workspace_id', workspaceId)

  if (brand) {
    sellInQuery = sellInQuery.eq('brand', brand)
    sellOutQuery = sellOutQuery.eq('brand', brand)
    sellOutPlatformQuery = sellOutPlatformQuery.eq('brand', brand)
    sellOutRegionQuery = sellOutRegionQuery.eq('brand', brand)
    sellInCustomerQuery = sellInCustomerQuery.eq('brand', brand)
    sellOutCompanyQuery = sellOutCompanyQuery.eq('brand', brand)
  }

  if (startDate) {
    sellInQuery = sellInQuery.gte('month', startDate)
    sellOutQuery = sellOutQuery.gte('month', startDate)
    sellOutPlatformQuery = sellOutPlatformQuery.gte('month', startDate)
    sellOutRegionQuery = sellOutRegionQuery.gte('month', startDate)
    sellInCustomerQuery = sellInCustomerQuery.gte('month', startDate)
    sellOutCompanyQuery = sellOutCompanyQuery.gte('month', startDate)
  }

  if (endDate) {
    sellInQuery = sellInQuery.lte('month', endDate)
    sellOutQuery = sellOutQuery.lte('month', endDate)
    sellOutPlatformQuery = sellOutPlatformQuery.lte('month', endDate)
    sellOutRegionQuery = sellOutRegionQuery.lte('month', endDate)
    sellInCustomerQuery = sellInCustomerQuery.lte('month', endDate)
    sellOutCompanyQuery = sellOutCompanyQuery.lte('month', endDate)
  }

  const [
    sellInRes,
    sellOutRes,
    platformRes,
    regionRes,
    sellInCustomerRes,
    sellOutCompanyRes,
    mappingRes,
  ] = await Promise.all([
    sellInQuery,
    sellOutQuery,
    sellOutPlatformQuery,
    sellOutRegionQuery,
    sellInCustomerQuery,
    sellOutCompanyQuery,
    supabase
      .from('vw_sell_in_customer_match')
      .select('customer, sell_out_company')
      .eq('workspace_id', workspaceId),
  ])

  const sellInMonthly = (sellInRes.data ?? []) as SellInMonthlyRow[]
  const sellOutMonthly = (sellOutRes.data ?? []) as SellOutMonthlyRow[]
  const sellOutPlatformMonthly = platformRes.error
    ? []
    : ((platformRes.data ?? []) as SellOutPlatformMonthlyRow[])
  const sellOutRegionMonthly = regionRes.error
    ? []
    : ((regionRes.data ?? []) as SellOutRegionMonthlyRow[])
  const sellInCustomerMonthly = (sellInCustomerRes.data ??
    []) as SellInCustomerMonthlyRow[]
  const sellOutCompanyMonthly = (sellOutCompanyRes.data ??
    []) as SellOutCompanyMonthlyRow[]
  const mappings = (mappingRes.data ?? []) as MappingRow[]

  const monthlySummary = buildMonthlySummary(sellInMonthly, sellOutMonthly)

  const availableMonths = monthlySummary.map((row) => row.month)

  const chartData: InsightsChartDatum[] = []
  let cumulative = 0
  monthlySummary.forEach((row) => {
    cumulative += row.totalShipped - row.sellOut
    chartData.push({
      month: row.month,
      totalShipped: row.totalShipped,
      sellOut: row.sellOut,
      cumulativeStock: cumulative,
    })
  })

  const aspData = sellInMonthly
    .map((row) => {
      const month = row.month.slice(0, 7)
      const units = row.sell_in_units ?? 0
      return {
        month,
        value: units > 0 ? (row.revenue ?? 0) / units : 0,
      }
    })
    .sort((a, b) => a.month.localeCompare(b.month))

  const promoRateData = monthlySummary.map((row) => ({
    month: row.month,
    value: row.totalShipped > 0 ? (row.promo / row.totalShipped) * 100 : 0,
  }))

  const platformData = topWithOther(
    aggregateTotals(
      sellOutPlatformMonthly,
      (row) => row.platform?.trim() || 'Unknown',
      (row) => row.sell_out_units ?? 0
    ),
    8
  )

  const regionData = topWithOther(
    aggregateTotals(
      sellOutRegionMonthly,
      (row) => row.region?.trim() || 'Unknown',
      (row) => row.sell_out_units ?? 0
    ),
    8
  )

  const topCustomerRevenue = topWithOther(
    aggregateTotals(
      sellInCustomerMonthly,
      (row) => row.customer,
      (row) => row.revenue ?? 0
    ),
    8
  )

  const topCompanySellOut = topWithOther(
    aggregateTotals(
      sellOutCompanyMonthly,
      (row) => row.company,
      (row) => row.sell_out_units ?? 0
    ),
    8
  )

  const mappingByCustomer = new Map<string, MappingRow>()
  mappings.forEach((mapping) => {
    mappingByCustomer.set(mapping.customer, mapping)
  })

  const customerInboundMap = new Map<string, InsightsCustomerInbound>()
  sellInCustomerMonthly.forEach((row) => {
    const entry = customerInboundMap.get(row.customer) ?? {
      customer: row.customer,
      sellIn: 0,
      promo: 0,
      totalShipped: 0,
      revenue: 0,
    }
    entry.sellIn += row.sell_in_units ?? 0
    entry.promo += row.promo_units ?? 0
    entry.totalShipped += row.total_shipped ?? 0
    entry.revenue += row.revenue ?? 0
    customerInboundMap.set(row.customer, entry)
  })

  const customerInbound = Array.from(customerInboundMap.values()).sort(
    (a, b) => b.totalShipped - a.totalShipped
  )

  const sellInCompanyMap = new Map<string, InsightsCompanySummary>()
  sellInCustomerMonthly.forEach((row) => {
    const mapping = mappingByCustomer.get(row.customer)
    const company = mapping?.sell_out_company ?? row.customer
    const entry = sellInCompanyMap.get(company) ?? {
      company,
      sellIn: 0,
      promo: 0,
      totalShipped: 0,
      sellOut: 0,
      channelStock: 0,
      sellThrough: 0,
      revenue: 0,
    }
    entry.sellIn += row.sell_in_units ?? 0
    entry.promo += row.promo_units ?? 0
    entry.totalShipped += row.total_shipped ?? 0
    entry.revenue += row.revenue ?? 0
    sellInCompanyMap.set(company, entry)
  })

  sellOutCompanyMonthly.forEach((row) => {
    const entry = sellInCompanyMap.get(row.company) ?? {
      company: row.company,
      sellIn: 0,
      promo: 0,
      totalShipped: 0,
      sellOut: 0,
      channelStock: 0,
      sellThrough: 0,
      revenue: 0,
    }
    entry.sellOut += row.sell_out_units ?? 0
    sellInCompanyMap.set(row.company, entry)
  })

  const companySummary = Array.from(sellInCompanyMap.values())
    .map((row) => {
      const channelStock = row.totalShipped - row.sellOut
      const sellThrough =
        row.totalShipped > 0 ? (row.sellOut / row.totalShipped) * 100 : 0
      return { ...row, channelStock, sellThrough }
    })
    .sort((a, b) => b.totalShipped - a.totalShipped)

  const companyTotals = companySummary.reduce(
    (acc, row) => {
      acc.sellIn += row.sellIn
      acc.promo += row.promo
      acc.totalShipped += row.totalShipped
      acc.sellOut += row.sellOut
      acc.channelStock += row.channelStock
      acc.revenue += row.revenue
      return acc
    },
    {
      sellIn: 0,
      promo: 0,
      totalShipped: 0,
      sellOut: 0,
      channelStock: 0,
      revenue: 0,
      sellThrough: 0,
    }
  )

  companyTotals.sellThrough =
    companyTotals.totalShipped > 0
      ? (companyTotals.sellOut / companyTotals.totalShipped) * 100
      : 0

  const totals = monthlySummary.reduce(
    (acc, row) => {
      acc.sellIn += row.sellIn
      acc.promo += row.promo
      acc.totalShipped += row.totalShipped
      acc.sellOut += row.sellOut
      acc.revenue += row.revenue
      return acc
    },
    {
      sellIn: 0,
      promo: 0,
      totalShipped: 0,
      sellOut: 0,
      revenue: 0,
      channelStock: 0,
      sellThrough: 0,
      cogs: 0,
      grossProfit: 0,
      promoCost: 0,
      netContribution: 0,
    }
  )

  totals.channelStock = totals.totalShipped - totals.sellOut
  totals.sellThrough =
    totals.totalShipped > 0 ? (totals.sellOut / totals.totalShipped) * 100 : 0
  totals.cogs = totals.revenue * cogsPct * -1
  totals.grossProfit = totals.revenue + totals.cogs
  totals.promoCost = totals.promo * promoCost * -1
  totals.netContribution = totals.grossProfit + totals.promoCost

  return {
    brand,
    start,
    end,
    currencySymbol,
    cogsPct,
    promoCost,
    monthlySummary,
    chartData,
    aspData,
    promoRateData,
    platformData,
    regionData,
    topCustomerRevenue,
    topCompanySellOut,
    companySummary,
    companyTotals,
    customerInbound,
    totals,
    availableMonths,
  }
}
