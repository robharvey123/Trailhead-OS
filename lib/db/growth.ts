import { createClient } from '@/lib/supabase/server'
import type { SeoKeyword, SeoSite } from '@/lib/types'

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

async function getSupabase(client?: SupabaseClient) {
  return client ?? createClient()
}

export interface SeoSiteListItem extends SeoSite {
  keyword_count: number
  account_name: string | null
}

export async function getSeoSites(client?: SupabaseClient): Promise<SeoSiteListItem[]> {
  const supabase = await getSupabase(client)
  const { data, error } = await supabase
    .from('seo_sites')
    .select('*, accounts:client_account_id(name)')
    .order('created_at', { ascending: true })
  if (error) throw new Error(error.message)

  const sites = (data ?? []) as Array<SeoSite & { accounts: { name: string } | null }>
  const counts = await Promise.all(
    sites.map(async (site) => {
      const { count } = await supabase
        .from('seo_keywords')
        .select('id', { count: 'exact', head: true })
        .eq('site_id', site.id)
      return count ?? 0
    })
  )
  return sites.map((site, i) => {
    const { accounts, ...rest } = site
    return { ...rest, keyword_count: counts[i], account_name: accounts?.name ?? null }
  })
}

export async function getSeoSiteById(id: string, client?: SupabaseClient): Promise<SeoSite | null> {
  const supabase = await getSupabase(client)
  const { data, error } = await supabase.from('seo_sites').select('*').eq('id', id).maybeSingle()
  if (error) throw new Error(error.message)
  return (data as SeoSite | null) ?? null
}

export interface CreateSeoSiteInput {
  name: string
  domain: string
  workstream_id?: string | null
  client_account_id?: string | null
  gsc_property?: string | null
  brand_voice?: string | null
  icp?: string | null
  is_client?: boolean
}

export async function createSeoSite(
  input: CreateSeoSiteInput,
  client?: SupabaseClient
): Promise<SeoSite> {
  const supabase = await getSupabase(client)
  if (input.is_client && !input.client_account_id) {
    // Client SEO work must roll up to the same CRM account as the client's invoices.
    throw new Error('Client sites must be linked to a CRM account')
  }
  const { data, error } = await supabase
    .from('seo_sites')
    .insert({
      name: input.name,
      domain: input.domain.toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, ''),
      workstream_id: input.workstream_id ?? null,
      client_account_id: input.client_account_id ?? null,
      gsc_property: input.gsc_property || null,
      brand_voice: input.brand_voice || null,
      icp: input.icp || null,
      is_client: input.is_client ?? false,
    })
    .select('*')
    .single()
  if (error) throw new Error(error.message)
  return data as SeoSite
}

export async function getSeoKeywords(
  siteId: string,
  client?: SupabaseClient
): Promise<SeoKeyword[]> {
  const supabase = await getSupabase(client)
  const { data, error } = await supabase
    .from('seo_keywords')
    .select('*')
    .eq('site_id', siteId)
    .order('gsc_clicks', { ascending: false, nullsFirst: false })
    .order('search_volume', { ascending: false, nullsFirst: false })
    .limit(1000)
  if (error) throw new Error(error.message)
  return (data ?? []) as SeoKeyword[]
}
