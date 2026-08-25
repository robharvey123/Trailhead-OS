import { NextResponse } from 'next/server'
import { syncAllGoogleAccounts } from '@/lib/growth/ads-google'
import { syncAllMetaAccounts } from '@/lib/growth/ads-meta'
import { applyCommercialWeighting, pushMinedTermsToKeywords } from '@/lib/growth/paid-loops'
import { createClient } from '@/lib/supabase/service'

export const maxDuration = 300

// Nightly 05:15, before enrichment: Google Ads (GAQL) and Meta insights, then
// the paid → organic loops that write onto seo_keywords.
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const supabase = createClient()
    const google = await syncAllGoogleAccounts(supabase)
    const meta = await syncAllMetaAccounts(supabase)
    const { data: sites } = await supabase.from('ads_accounts').select('site_id')
    const loops: Array<{ site_id: string; mined: number; weighted: number }> = []
    for (const siteId of new Set((sites ?? []).map((s) => s.site_id as string))) {
      try {
        loops.push({
          site_id: siteId,
          mined: await pushMinedTermsToKeywords(siteId, supabase),
          weighted: await applyCommercialWeighting(siteId, supabase),
        })
      } catch (err) {
        google.errors.push({ account: siteId, error: `loops: ${err instanceof Error ? err.message : String(err)}` })
      }
    }
    return NextResponse.json({ google, meta, loops })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Ads sync failed' }, { status: 500 })
  }
}
