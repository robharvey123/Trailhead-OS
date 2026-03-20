import { NextRequest, NextResponse } from 'next/server'
import { getWorkspaceContext } from '@/lib/workspace/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import type { CommissionEarning } from '@/lib/holding/types'

export async function GET(request: NextRequest) {
  const workspaceId = request.nextUrl.searchParams.get('workspace_id') || ''
  const auth = await getWorkspaceContext(workspaceId)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { supabase } = auth.ctx
  const from = request.nextUrl.searchParams.get('from')
  const to = request.nextUrl.searchParams.get('to')
  const brand = request.nextUrl.searchParams.get('brand')

  // 1. Fetch commission rates for this workspace
  const { data: rates, error: ratesError } = await supabase
    .from('commission_rates')
    .select('*')
    .eq('workspace_id', workspaceId)
  if (ratesError) return NextResponse.json({ error: ratesError.message }, { status: 500 })
  if (!rates?.length) return NextResponse.json({ earnings: [], summary: { total_earned: 0, by_brand: [], by_month: [] } })

  // 2. Group rates by source workspace
  const ratesBySource = new Map<string, typeof rates>()
  for (const rate of rates) {
    const list = ratesBySource.get(rate.source_workspace_id) || []
    list.push(rate)
    ratesBySource.set(rate.source_workspace_id, list)
  }

  // 3. Query sell_in from each linked workspace using admin client
  const admin = createAdminClient()
  const allEarnings: CommissionEarning[] = []

  for (const [sourceWorkspaceId, sourceRates] of ratesBySource) {
    const brands = [...new Set(sourceRates.map((r) => r.brand))]
    if (brand && !brands.includes(brand)) continue

    let query = admin
      .from('sell_in')
      .select('customer, brand, product, date, qty_cans, unit_price, total')
      .eq('workspace_id', sourceWorkspaceId)
      .in('brand', brand ? [brand] : brands)

    if (from) query = query.gte('date', from)
    if (to) query = query.lte('date', to)

    const { data: sellInRows, error: sellInError } = await query
    if (sellInError) continue

    for (const row of sellInRows || []) {
      // Find applicable rate: match brand + date within effective range
      const applicableRate = sourceRates.find((r) => {
        if (r.brand !== row.brand) return false
        if (r.effective_from && row.date < r.effective_from) return false
        if (r.effective_to && row.date > r.effective_to) return false
        return true
      })
      if (!applicableRate) continue

      const revenue = row.total ?? (row.qty_cans * (row.unit_price ?? 0))
      const earned = applicableRate.commission_type === 'percentage'
        ? revenue * (applicableRate.rate / 100)
        : row.qty_cans * applicableRate.rate

      allEarnings.push({
        brand: row.brand,
        customer: row.customer,
        date: row.date,
        qty_cans: row.qty_cans,
        revenue,
        commission_type: applicableRate.commission_type,
        rate: applicableRate.rate,
        earned,
        source_workspace_id: sourceWorkspaceId,
      })
    }
  }

  // 4. Build summary
  const totalEarned = allEarnings.reduce((s, e) => s + e.earned, 0)

  const byBrandMap = new Map<string, number>()
  const byMonthMap = new Map<string, number>()
  for (const e of allEarnings) {
    byBrandMap.set(e.brand, (byBrandMap.get(e.brand) ?? 0) + e.earned)
    const month = e.date.slice(0, 7)
    byMonthMap.set(month, (byMonthMap.get(month) ?? 0) + e.earned)
  }

  return NextResponse.json({
    earnings: allEarnings,
    summary: {
      total_earned: totalEarned,
      by_brand: [...byBrandMap.entries()].map(([brand, earned]) => ({ brand, earned })).sort((a, b) => b.earned - a.earned),
      by_month: [...byMonthMap.entries()].map(([month, earned]) => ({ month, earned })).sort((a, b) => a.month.localeCompare(b.month)),
    },
  })
}
