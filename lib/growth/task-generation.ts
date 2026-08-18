import { createClient } from '@/lib/supabase/service'
import { createEngineTaskOnce } from '@/lib/growth/tasks'
import type { SeoSite } from '@/lib/types'

/**
 * Nightly engine → task generation (growth-tasks cron). Every rule is
 * idempotent: follow-ups flip a once-only flag, everything else dedupes on an
 * identical open task title via createEngineTaskOnce.
 */

const QUICK_WIN_LIMIT = 3
const AI_COMPETITOR_THRESHOLD = 3

export interface TaskGenResult {
  followups: number
  quickWins: number
  backlinkMining: number
  factChecks: number
  reportReviews: number
  errors: string[]
}

export async function generateEngineTasks(): Promise<TaskGenResult> {
  const supabase = createClient()
  const result: TaskGenResult = {
    followups: 0,
    quickWins: 0,
    backlinkMining: 0,
    factChecks: 0,
    reportReviews: 0,
    errors: [],
  }

  const { data: sites, error } = await supabase.from('seo_sites').select('*')
  if (error) throw new Error(error.message)

  for (const site of (sites ?? []) as SeoSite[]) {
    try {
      await followupTasks(site, result)
      await quickWinTasks(site, result)
      await backlinkMiningTasks(site, result)
      await factCheckTasks(site, result)
      await monthlyReportTask(site, result)
    } catch (err) {
      result.errors.push(`${site.domain}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }
  return result
}

/** Outreach follow-up at 7 days — once only, never twice (followup_created flag). */
async function followupTasks(site: SeoSite, result: TaskGenResult): Promise<void> {
  const supabase = createClient()
  const cutoff = new Date(Date.now() - 7 * 86400_000).toISOString()
  const { data: due } = await supabase
    .from('seo_link_targets')
    .select('id, url, angle, accounts:crm_account_id(name)')
    .eq('site_id', site.id)
    .eq('status', 'outreach')
    .eq('followup_created', false)
    .lt('outreach_at', cutoff)

  for (const target of due ?? []) {
    const account = (target.accounts as unknown as { name: string } | null)?.name ?? target.url
    await createEngineTaskOnce({
      title: `Follow up outreach: ${account}`,
      description: `One follow-up on the link pitch for ${site.domain}.\nTarget page: ${target.url}\nAngle: ${target.angle ?? '—'}`,
      dueDate: new Date().toISOString().slice(0, 10),
      extraLabels: ['outreach'],
    })
    await supabase.from('seo_link_targets').update({ followup_created: true }).eq('id', target.id)
    result.followups += 1
  }
}

/** Keywords parked at position 11-20 are the cheapest wins — refresh the page. */
async function quickWinTasks(site: SeoSite, result: TaskGenResult): Promise<void> {
  const supabase = createClient()
  const { data: winners } = await supabase
    .from('seo_keywords')
    .select('keyword, gsc_position, gsc_impressions')
    .eq('site_id', site.id)
    .gte('gsc_position', 11)
    .lte('gsc_position', 20)
    .order('gsc_impressions', { ascending: false, nullsFirst: false })
    .limit(QUICK_WIN_LIMIT)

  for (const k of winners ?? []) {
    const created = await createEngineTaskOnce({
      title: `On-page refresh: "${k.keyword}" (${site.domain})`,
      description: `Ranking ${k.gsc_position} with ${k.gsc_impressions ?? 0} impressions/90d — page two. Refresh the page targeting this keyword: update content, improve internal links, tighten the title.`,
      extraLabels: ['on-page'],
    })
    if (created) result.quickWins += 1
  }
}

/** A competitor the AI engines keep naming instead of us is a backlink-gap lead. */
async function backlinkMiningTasks(site: SeoSite, result: TaskGenResult): Promise<void> {
  const supabase = createClient()
  const since = new Date(Date.now() - 28 * 86400_000).toISOString()
  const { data: mentions } = await supabase
    .from('seo_ai_mentions')
    .select('competitors_mentioned')
    .eq('site_id', site.id)
    .gte('run_at', since)

  const counts = new Map<string, number>()
  for (const m of mentions ?? []) {
    for (const c of (m.competitors_mentioned as string[]) ?? []) {
      counts.set(c, (counts.get(c) ?? 0) + 1)
    }
  }
  for (const [competitor, count] of counts) {
    if (count <= AI_COMPETITOR_THRESHOLD) continue
    const created = await createEngineTaskOnce({
      title: `Mine backlinks: ${competitor} (${site.domain})`,
      description: `${competitor} was named ${count}× in AI answers over 28 days where ${site.name} wasn't. Run prospect import on their domain from /growth and work the gap.`,
      extraLabels: ['outreach'],
    })
    if (created) result.backlinkMining += 1
  }
}

/** Fact-check each article ~30 days after publishing. */
async function factCheckTasks(site: SeoSite, result: TaskGenResult): Promise<void> {
  const supabase = createClient()
  const from = new Date(Date.now() - 31 * 86400_000).toISOString()
  const to = new Date(Date.now() - 30 * 86400_000).toISOString()
  const { data: articles } = await supabase
    .from('seo_articles')
    .select('title, published_url')
    .eq('site_id', site.id)
    .eq('status', 'published')
    .gte('published_at', from)
    .lt('published_at', to)

  for (const article of articles ?? []) {
    const created = await createEngineTaskOnce({
      title: `Fact-check: ${article.title}`,
      description: `Published 30 days ago — re-verify claims, prices and sources.\n${article.published_url ?? ''}`,
      extraLabels: ['content'],
    })
    if (created) result.factChecks += 1
  }
}

/** First of the month: review & send the client report. */
async function monthlyReportTask(site: SeoSite, result: TaskGenResult): Promise<void> {
  if (new Date().getUTCDate() !== 1) return
  const month = new Date().toISOString().slice(0, 7)
  const created = await createEngineTaskOnce({
    title: `Send monthly SEO report: ${site.name} (${month})`,
    description: `Generate at /api/growth/report/${site.id}, review it, and send via Gmail${site.is_client ? ' to the client — logged against their CRM account' : ''}.`,
    dueDate: new Date().toISOString().slice(0, 10),
    priority: 'high',
    extraLabels: ['reporting'],
  })
  if (created) result.reportReviews += 1
}
