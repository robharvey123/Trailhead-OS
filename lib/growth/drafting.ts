import { createClient } from '@/lib/supabase/service'
import { draftArticle } from '@/lib/growth/ai'
import { pushToUser } from '@/lib/push/server'
import type { SeoArticle, SeoArticleStatus, SeoBrief, SeoSite } from '@/lib/types'

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

/** Statuses a re-draft is allowed from. */
const REGENERATABLE_STATUSES = ['review', 'approved'] as const

export interface RegenerateResult {
  articleId: string
  wordCount: number
  previousStatus: SeoArticleStatus
}

/**
 * Re-draft an article that has already been drafted, in place.
 *
 * Runs the same `draftArticle` job the queue worker runs, against the article's
 * CURRENT brief and site rows — so a brand_voice, ICP or outline edited since
 * the first draft is what the new copy is written to. The row keeps its id and
 * slug, so inbound links, the publish_ref and anything referencing the article
 * still resolve.
 *
 * Deliberately synchronous rather than re-queued, for two reasons: the queue
 * worker only claims articles with a null body_mdx (so a re-queue would mean
 * destroying the existing draft first and leaving the article empty if the model
 * call then failed), and the Growth actions already run model calls inline —
 * generateBrief and generateClusters are the same shape. The existing body is
 * overwritten only once the new draft is in hand.
 *
 * Published articles are refused: the body is already out in a PR, a WordPress
 * draft or the marketing blog, and silently re-drafting underneath that would
 * leave publish_ref and published_url pointing at copy that no longer exists
 * here. Re-draft before approving, or publish again after.
 */
export async function regenerateArticleDraft(articleId: string): Promise<RegenerateResult> {
  const supabase = createClient()

  const { data: articleRow, error: articleError } = await supabase
    .from('seo_articles')
    .select('*')
    .eq('id', articleId)
    .maybeSingle()
  if (articleError) throw new Error(articleError.message)
  const article = articleRow as SeoArticle | null
  if (!article) throw new Error('Article not found')

  if (!REGENERATABLE_STATUSES.includes(article.status as (typeof REGENERATABLE_STATUSES)[number])) {
    throw new Error(
      article.status === 'published'
        ? 'A published article cannot be re-drafted — it is already out in a PR, WordPress draft or the blog'
        : `Only articles in review or approved can be re-drafted (this one is ${article.status})`
    )
  }
  if (!article.brief_id) throw new Error('Article has no brief to re-draft from')

  const [{ data: brief }, { data: site }] = await Promise.all([
    supabase.from('seo_briefs').select('*').eq('id', article.brief_id).single<SeoBrief>(),
    supabase.from('seo_sites').select('*').eq('id', article.site_id).single<SeoSite>(),
  ])
  if (!brief) throw new Error('Brief not found — it may have been deleted')
  if (!site) throw new Error('Site not found')

  // Model call first: a failure here leaves the existing draft untouched.
  const draft = await draftArticle(brief, site)

  const { error: saveError } = await supabase
    .from('seo_articles')
    .update({
      body_mdx: draft.body_mdx,
      meta_description: draft.meta_description,
      schema_jsonld: draft.schema_jsonld,
      word_count: draft.word_count,
      // Kept in step with the body: the article screen shows these next to the
      // copy, so leaving the first draft's values would misreport which model
      // wrote what is on screen and what it cost.
      model_used: draft.model_used,
      token_cost: draft.token_cost,
      // Back to the pre-approval state — new copy has not been read yet.
      status: 'review',
      error: null,
    })
    .eq('id', articleId)
  if (saveError) throw new Error(saveError.message)

  return { articleId, wordCount: draft.word_count, previousStatus: article.status }
}
