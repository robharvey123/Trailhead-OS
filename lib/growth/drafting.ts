import { createClient } from '@/lib/supabase/service'
import { draftArticle } from '@/lib/growth/ai'
import { pushToUser } from '@/lib/push/server'
import type { SeoArticle, SeoBrief, SeoSite } from '@/lib/types'

/**
 * Draft queue worker (growth-draft cron). One article per tick, claimed with a
 * conditional update (the scheduled_emails pattern) so overlapping ticks can't
 * double-draft. A failed article records `error` and is NOT retried until the
 * error is cleared from the UI — no token-burning retry loops.
 */

const STALE_CLAIM_MINUTES = 20

export interface DraftTickResult {
  drafted: string | null
  skipped?: string
  error?: string
}

export async function processDraftQueue(): Promise<DraftTickResult> {
  const supabase = createClient()
  const staleBefore = new Date(Date.now() - STALE_CLAIM_MINUTES * 60_000).toISOString()

  const { data: candidates, error: findError } = await supabase
    .from('seo_articles')
    .select('*')
    .eq('status', 'drafting')
    .is('body_mdx', null)
    .is('error', null)
    .or(`draft_started_at.is.null,draft_started_at.lt.${staleBefore}`)
    .order('created_at', { ascending: true })
    .limit(1)
  if (findError) throw new Error(findError.message)

  const article = candidates?.[0] as (SeoArticle & { draft_started_at: string | null }) | undefined
  if (!article) return { drafted: null, skipped: 'queue empty' }

  // Optimistic claim on the exact prior claim value.
  let claim = supabase
    .from('seo_articles')
    .update({ draft_started_at: new Date().toISOString() })
    .eq('id', article.id)
  claim = article.draft_started_at === null
    ? claim.is('draft_started_at', null)
    : claim.eq('draft_started_at', article.draft_started_at)
  const { data: claimed, error: claimError } = await claim.select('id')
  if (claimError) throw new Error(claimError.message)
  if (!claimed || claimed.length === 0) return { drafted: null, skipped: 'claimed by another run' }

  try {
    if (!article.brief_id) throw new Error('Article has no brief')
    const { data: brief } = await supabase
      .from('seo_briefs')
      .select('*')
      .eq('id', article.brief_id)
      .single<SeoBrief>()
    if (!brief) throw new Error('Brief not found')
    const { data: site } = await supabase
      .from('seo_sites')
      .select('*')
      .eq('id', article.site_id)
      .single<SeoSite>()
    if (!site) throw new Error('Site not found')

    const draft = await draftArticle(brief, site)

    const { error: saveError } = await supabase
      .from('seo_articles')
      .update({
        body_mdx: draft.body_mdx,
        meta_description: draft.meta_description,
        schema_jsonld: draft.schema_jsonld,
        word_count: draft.word_count,
        model_used: draft.model_used,
        token_cost: draft.token_cost,
        status: 'review',
        error: null,
      })
      .eq('id', article.id)
    if (saveError) throw new Error(saveError.message)

    void notifyDraftReady(article.id, article.site_id, article.title, site.name)
    return { drafted: article.id }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await supabase.from('seo_articles').update({ error: message }).eq('id', article.id)
    return { drafted: null, error: `${article.title}: ${message}` }
  }
}

/** Single-tenant OS: the drafts go to the (one) admin user, same resolution
 *  pattern as the calendar-sync cron. Fire-and-forget. */
async function notifyDraftReady(articleId: string, siteId: string, title: string, siteName: string): Promise<void> {
  try {
    const supabase = createClient()
    const { data } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1 })
    const userId = data?.users?.[0]?.id
    if (!userId) return
    await pushToUser(userId, {
      title: 'Draft ready to review',
      body: `${siteName}: "${title}" has been drafted`,
      url: `/growth/${siteId}/articles/${articleId}`,
      tag: `growth-draft:${articleId}`,
      category: 'push_growth',
    })
  } catch {
    /* never let a push failure mark the draft as failed */
  }
}
