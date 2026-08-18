import { createClient } from '@/lib/supabase/service'
import { getCompetitorBacklinks } from '@/lib/growth/dataforseo'
import { pushToUser } from '@/lib/push/server'

/**
 * Link building on the CRM's rails (Growth Phase 5). A prospect's company is a
 * real accounts row with record_type 'link_prospect' — email history, notes
 * and contacts live in the CRM like every other relationship. seo_link_targets
 * holds only the SEO-specific fields. Contacts are NOT auto-created: finding
 * the right editor is manual research by design.
 */

function tierFromRank(rank: number | null): number {
  if (rank === null) return 3
  if (rank >= 400) return 1
  if (rank >= 150) return 2
  return 3
}

export interface ImportResult {
  found: number
  createdAccounts: number
  createdTargets: number
  skippedExisting: number
}

export async function importLinkProspects(
  siteId: string,
  competitorDomain: string
): Promise<ImportResult> {
  const supabase = createClient()
  const domain = competitorDomain.toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '')
  if (!domain.includes('.')) throw new Error('Enter a competitor domain, e.g. joblogic.com')

  const backlinks = await getCompetitorBacklinks(domain)
  const result: ImportResult = {
    found: backlinks.length,
    createdAccounts: 0,
    createdTargets: 0,
    skippedExisting: 0,
  }

  const { data: existingTargets } = await supabase
    .from('seo_link_targets')
    .select('url')
    .eq('site_id', siteId)
  const knownUrls = new Set((existingTargets ?? []).map((t) => t.url as string))

  for (const link of backlinks) {
    if (knownUrls.has(link.url_from)) {
      result.skippedExisting += 1
      continue
    }

    const prospectDomain = link.domain_from.toLowerCase()
    // Find-or-create the CRM account for the referring domain.
    const { data: existingAccount } = await supabase
      .from('accounts')
      .select('id')
      .eq('record_type', 'link_prospect')
      .ilike('website', `%${prospectDomain}%`)
      .limit(1)
      .maybeSingle()

    let accountId = existingAccount?.id as string | undefined
    if (!accountId) {
      const { data: created, error } = await supabase
        .from('accounts')
        .insert({
          name: prospectDomain,
          website: `https://${prospectDomain}`,
          record_type: 'link_prospect',
          status: 'prospect',
          source: 'seo-engine',
          notes: `Link prospect mined from ${domain} backlinks.`,
        })
        .select('id')
        .single()
      if (error) throw new Error(error.message)
      accountId = created.id as string
      result.createdAccounts += 1
    }

    const angle = link.page_from_title
      ? `They link to ${domain} from "${link.page_from_title}" — pitch the better/updated resource.`
      : `They link to ${domain} — pitch the better/updated resource.`

    const { error: targetError } = await supabase.from('seo_link_targets').insert({
      site_id: siteId,
      crm_account_id: accountId,
      url: link.url_from,
      domain_authority: link.domain_from_rank,
      tier: tierFromRank(link.domain_from_rank),
      angle,
      status: 'identified',
    })
    if (targetError) throw new Error(targetError.message)
    knownUrls.add(link.url_from)
    result.createdTargets += 1
  }

  return result
}

/** The only celebratory notification in the module — keep it. */
export async function notifyLinkWon(siteName: string, domain: string, wonUrl: string): Promise<void> {
  try {
    const supabase = createClient()
    const { data } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1 })
    const userId = data?.users?.[0]?.id
    if (!userId) return
    await pushToUser(userId, {
      title: `Link won for ${siteName} 🎉`,
      body: `${domain} is now linking: ${wonUrl}`,
      url: wonUrl,
      tag: `growth-link-won:${wonUrl}`,
      category: 'push_growth',
    })
  } catch {
    /* never fail the action on a push problem */
  }
}
