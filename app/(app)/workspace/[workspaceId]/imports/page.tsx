import ImportClient from './ImportClient'
import { createClient } from '@/lib/supabase/server'
import {
  resolveWorkspaceParams,
  type WorkspaceRouteParams,
} from '@/lib/route-params'

const uniqueValues = <T extends Record<string, unknown>>(
  rows: T[],
  key: keyof T
) => {
  const values = new Set<string>()
  rows.forEach((row) => {
    const raw = row[key]
    const value = typeof raw === 'string' ? raw.trim() : String(raw ?? '').trim()
    if (value) {
      values.add(value)
    }
  })
  return Array.from(values).sort((a, b) => a.localeCompare(b))
}

export default async function ImportsPage({
  params,
}: {
  params: Promise<WorkspaceRouteParams>
}) {
  const { workspaceId } = await resolveWorkspaceParams(params)
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return <div className="p-8">You must be logged in to view this page.</div>
  }

  const { data: member } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!member || !['owner', 'admin', 'editor'].includes(member.role)) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-xl font-semibold mb-2">Access denied</h2>
        <p className="text-slate-400">Only workspace admins and editors can import data.</p>
      </div>
    )
  }

  const [sellInResult, sellOutResult, settingsResult] = await Promise.all([
    supabase
      .from('sell_in')
      .select('customer,brand,product,country')
      .eq('workspace_id', workspaceId)
      .limit(5000),
    supabase
      .from('sell_out')
      .select('company,brand,product,platform,region')
      .eq('workspace_id', workspaceId)
      .limit(5000),
    supabase
      .from('workspace_settings')
      .select('brand_filter, base_currency, supported_currencies')
      .eq('workspace_id', workspaceId)
      .maybeSingle(),
  ])

  const sellInRows =
    (sellInResult.data as {
      customer: string | null
      brand: string | null
      product: string | null
      country: string | null
    }[]) ?? []
  const sellOutRows =
    (sellOutResult.data as {
      company: string | null
      brand: string | null
      product: string | null
      platform: string | null
      region: string | null
    }[]) ?? []

  const defaultBrand = settingsResult.data?.brand_filter?.trim() ?? ''
  const baseCurrency = settingsResult.data?.base_currency ?? 'GBP'
  const supportedCurrencies: string[] = settingsResult.data?.supported_currencies ?? ['GBP', 'EUR', 'USD']

  const sellInBrands = uniqueValues(sellInRows, 'brand')
  const sellOutBrands = uniqueValues(sellOutRows, 'brand')
  const mergedBrands = Array.from(
    new Set([
      defaultBrand,
      ...sellInBrands,
      ...sellOutBrands,
    ].filter(Boolean))
  ).sort((a, b) => a.localeCompare(b))

  const manualOptions = {
    sellIn: {
      customers: uniqueValues(sellInRows, 'customer'),
      brands: mergedBrands,
      products: uniqueValues(sellInRows, 'product'),
      countries: uniqueValues(sellInRows, 'country'),
    },
    sellOut: {
      companies: uniqueValues(sellOutRows, 'company'),
      brands: mergedBrands,
      products: uniqueValues(sellOutRows, 'product'),
      platforms: uniqueValues(sellOutRows, 'platform'),
      regions: uniqueValues(sellOutRows, 'region'),
    },
  }

  return (
    <ImportClient
      workspaceId={workspaceId}
      manualOptions={manualOptions}
      defaultBrand={defaultBrand}
      baseCurrency={baseCurrency}
      supportedCurrencies={supportedCurrencies}
    />
  )
}
