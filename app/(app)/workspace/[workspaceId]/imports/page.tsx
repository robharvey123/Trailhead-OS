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
  params: WorkspaceRouteParams | Promise<WorkspaceRouteParams>
}) {
  const { workspaceId } = await resolveWorkspaceParams(params)
  const supabase = await createClient()

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
      .select('brand_filter')
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
    />
  )
}
