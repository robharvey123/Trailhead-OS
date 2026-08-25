'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireAdmin } from '@/lib/auth/roles'
import { createSeoSite, getSeoSiteById } from '@/lib/db/growth'
import { syncSiteGsc } from '@/lib/growth/gsc'
import { requestKeywordIdeas } from '@/lib/growth/keywords'

function errMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'Something went wrong'
}

export async function createSeoSiteAction(formData: FormData) {
  await requireAdmin()

  const name = String(formData.get('name') ?? '').trim()
  const domain = String(formData.get('domain') ?? '').trim()
  const isClient = formData.get('is_client') === 'on'
  const clientAccountId = String(formData.get('client_account_id') ?? '') || null

  if (!name || !domain) {
    redirect(`/growth?error=${encodeURIComponent('Name and domain are required')}`)
  }
  if (isClient && !clientAccountId) {
    redirect(`/growth?error=${encodeURIComponent('Client sites must be linked to a CRM account')}`)
  }

  let siteId: string
  try {
    const site = await createSeoSite({
      name,
      domain,
      workstream_id: String(formData.get('workstream_id') ?? '') || null,
      client_account_id: clientAccountId,
      gsc_property: String(formData.get('gsc_property') ?? '').trim() || null,
      brand_voice: String(formData.get('brand_voice') ?? '').trim() || null,
      icp: String(formData.get('icp') ?? '').trim() || null,
      is_client: isClient,
    })
    siteId = site.id
  } catch (err) {
    redirect(`/growth?error=${encodeURIComponent(errMessage(err))}`)
  }

  revalidatePath('/growth')
  redirect(`/growth/${siteId}`)
}

export async function updateSeoSiteAction(siteId: string, formData: FormData) {
  await requireAdmin()

  const isClient = formData.get('is_client') === 'on'
  const clientAccountId = String(formData.get('client_account_id') ?? '') || null
  if (isClient && !clientAccountId) {
    redirect(
      `/growth/${siteId}/settings?error=${encodeURIComponent('Client sites must be linked to a CRM account')}`
    )
  }

  const { updateSeoSite, getSeoSiteById } = await import('@/lib/db/growth')
  try {
    // CMS config: rebuild from the form, but keep the stored WordPress app
    // password when the field is left blank (it is never echoed to the form).
    const cmsType = (String(formData.get('cms_type') ?? 'none') || 'none') as
      | 'none'
      | 'github'
      | 'wordpress'
      | 'internal'
    let cmsConfig: Record<string, unknown> = {}
    if (cmsType === 'github') {
      cmsConfig = {
        repo: String(formData.get('cms_repo') ?? '').trim(),
        base_branch: String(formData.get('cms_base_branch') ?? '').trim() || 'main',
        content_dir: String(formData.get('cms_content_dir') ?? '').trim() || 'content/blog',
        author: String(formData.get('cms_author') ?? '').trim() || null,
        auto_merge: formData.get('cms_auto_merge') === 'on',
      }
    } else if (cmsType === 'wordpress') {
      const existing = await getSeoSiteById(siteId)
      const stored = (existing?.cms_config ?? {}) as { app_password?: string }
      const enteredPassword = String(formData.get('cms_app_password') ?? '').trim()
      cmsConfig = {
        base_url: String(formData.get('cms_base_url') ?? '').trim(),
        username: String(formData.get('cms_username') ?? '').trim(),
        app_password: enteredPassword || stored.app_password || '',
      }
    }

    await updateSeoSite(siteId, {
      name: String(formData.get('name') ?? '').trim(),
      gsc_property: String(formData.get('gsc_property') ?? '').trim() || null,
      workstream_id: String(formData.get('workstream_id') ?? '') || null,
      client_account_id: clientAccountId,
      brand_voice: String(formData.get('brand_voice') ?? '').trim() || null,
      icp: String(formData.get('icp') ?? '').trim() || null,
      is_client: isClient,
      cms_type: cmsType,
      cms_config: cmsConfig,
    })
  } catch (err) {
    redirect(`/growth/${siteId}/settings?error=${encodeURIComponent(errMessage(err))}`)
  }

  revalidatePath('/growth')
  revalidatePath(`/growth/${siteId}`)
  redirect(`/growth/${siteId}?notice=${encodeURIComponent('Site settings saved')}`)
}

export async function syncGscNowAction(siteId: string) {
  await requireAdmin()

  const site = await getSeoSiteById(siteId)
  if (!site) redirect('/growth')

  try {
    const result = await syncSiteGsc(site)
    revalidatePath('/growth')
    revalidatePath(`/growth/${siteId}`)
    redirect(
      `/growth/${siteId}?notice=${encodeURIComponent(
        `GSC sync complete — ${result.keywords} keywords (${result.inserted} new)`
      )}`
    )
  } catch (err) {
    // redirect() throws internally — let it through.
    if (err && typeof err === 'object' && 'digest' in err) throw err
    redirect(`/growth/${siteId}?error=${encodeURIComponent(errMessage(err))}`)
  }
}

// ── Phase 3: clusters, briefs, drafts ────────────────────────────────────────

export async function generateClustersAction(siteId: string) {
  await requireAdmin()
  const { generateClusters } = await import('@/lib/growth/ai')
  try {
    const result = await generateClusters(siteId)
    revalidatePath(`/growth/${siteId}/clusters`)
    revalidatePath(`/growth/${siteId}`)
    redirect(
      `/growth/${siteId}/clusters?notice=${encodeURIComponent(
        `${result.created} clusters proposed covering ${result.assigned} keywords`
      )}`
    )
  } catch (err) {
    if (err && typeof err === 'object' && 'digest' in err) throw err
    redirect(`/growth/${siteId}/clusters?error=${encodeURIComponent(errMessage(err))}`)
  }
}

export async function approveClusterAction(siteId: string, clusterId: string) {
  await requireAdmin()
  const { createClient: createServiceClient } = await import('@/lib/supabase/service')
  const supabase = createServiceClient()

  try {
    const { data: cluster } = await supabase
      .from('seo_clusters')
      .select('*, seo_sites!inner(name, workstream_id)')
      .eq('id', clusterId)
      .single()
    if (!cluster) throw new Error('Cluster not found')

    const { data: keywords } = await supabase
      .from('seo_keywords')
      .select('keyword')
      .eq('cluster_id', clusterId)

    // The content programme becomes a Project so it lands on the existing Gantt.
    const { createProject } = await import('@/lib/db/projects')
    const site = cluster.seo_sites as { name: string; workstream_id: string | null }
    const brief = [
      `Content programme for the "${cluster.name}" topic cluster (${site.name}).`,
      `Pillar keyword: ${cluster.pillar_keyword ?? 'n/a'}. Intent: ${cluster.intent ?? 'n/a'}.`,
      `Keywords: ${(keywords ?? []).map((k) => k.keyword).join(', ')}`,
    ].join('\n')

    const project = await createProject({
      name: `Content: ${cluster.name}`,
      description: `SEO content cluster targeting "${cluster.pillar_keyword ?? cluster.name}"`,
      brief,
      status: 'planning',
      start_date: new Date().toISOString().slice(0, 10),
      workstream_id: site.workstream_id ?? undefined,
    })

    // Heuristic planner — generates phases/milestones/tasks on the Gantt. It
    // needs a workstream; without one the project still exists, just unplanned.
    let planned = false
    if (site.workstream_id) {
      const { planProjectFromBrief } = await import('@/lib/project-planner')
      await planProjectFromBrief({
        projectId: project.id,
        projectName: project.name,
        workstreamId: site.workstream_id,
        pricingTierId: null,
        startDate: project.start_date ?? new Date().toISOString().slice(0, 10),
        brief,
      })
      planned = true
    }

    const { error } = await supabase
      .from('seo_clusters')
      .update({ status: 'approved', project_id: project.id })
      .eq('id', clusterId)
    if (error) throw new Error(error.message)

    revalidatePath(`/growth/${siteId}/clusters`)
    revalidatePath(`/growth/${siteId}`)
    redirect(
      `/growth/${siteId}/clusters?notice=${encodeURIComponent(
        planned
          ? `Cluster approved — project "${project.name}" created and planned`
          : `Cluster approved — project "${project.name}" created (no workstream on the site, so no auto-plan)`
      )}`
    )
  } catch (err) {
    if (err && typeof err === 'object' && 'digest' in err) throw err
    redirect(`/growth/${siteId}/clusters?error=${encodeURIComponent(errMessage(err))}`)
  }
}

export async function archiveClusterAction(siteId: string, clusterId: string) {
  await requireAdmin()
  const { createClient: createServiceClient } = await import('@/lib/supabase/service')
  const supabase = createServiceClient()
  await supabase.from('seo_clusters').update({ status: 'archived' }).eq('id', clusterId)
  revalidatePath(`/growth/${siteId}/clusters`)
  redirect(`/growth/${siteId}/clusters?notice=${encodeURIComponent('Cluster archived')}`)
}

export async function generateBriefAction(siteId: string, clusterId: string) {
  await requireAdmin()
  const { generateBrief } = await import('@/lib/growth/ai')
  try {
    const briefId = await generateBrief(clusterId)
    revalidatePath(`/growth/${siteId}/briefs`)
    redirect(`/growth/${siteId}/briefs/${briefId}`)
  } catch (err) {
    if (err && typeof err === 'object' && 'digest' in err) throw err
    redirect(`/growth/${siteId}/clusters?error=${encodeURIComponent(errMessage(err))}`)
  }
}

export async function approveBriefAction(siteId: string, briefId: string) {
  await requireAdmin()
  const { createClient: createServiceClient } = await import('@/lib/supabase/service')
  const supabase = createServiceClient()

  try {
    const { data: brief } = await supabase.from('seo_briefs').select('*').eq('id', briefId).single()
    if (!brief) throw new Error('Brief not found')
    if (brief.status !== 'proposed') throw new Error('Only proposed briefs can be approved')

    const { error: briefError } = await supabase
      .from('seo_briefs')
      .update({ status: 'approved', approved_at: new Date().toISOString() })
      .eq('id', briefId)
    if (briefError) throw new Error(briefError.message)

    // Queue the draft — the growth-draft cron picks it up within 5 minutes.
    const { error: articleError } = await supabase.from('seo_articles').insert({
      site_id: brief.site_id,
      brief_id: briefId,
      title: brief.title,
      slug: brief.slug,
      status: 'drafting',
    })
    if (articleError) throw new Error(articleError.message)

    revalidatePath(`/growth/${siteId}/briefs`)
    revalidatePath(`/growth/${siteId}/articles`)
    revalidatePath(`/growth/${siteId}`)
    redirect(
      `/growth/${siteId}/briefs?notice=${encodeURIComponent(
        'Brief approved — draft queued, you will get a push when it is ready'
      )}`
    )
  } catch (err) {
    if (err && typeof err === 'object' && 'digest' in err) throw err
    redirect(`/growth/${siteId}/briefs/${briefId}?error=${encodeURIComponent(errMessage(err))}`)
  }
}

export async function rejectBriefAction(siteId: string, briefId: string) {
  await requireAdmin()
  const { createClient: createServiceClient } = await import('@/lib/supabase/service')
  const supabase = createServiceClient()
  await supabase.from('seo_briefs').update({ status: 'rejected' }).eq('id', briefId)
  revalidatePath(`/growth/${siteId}/briefs`)
  redirect(`/growth/${siteId}/briefs?notice=${encodeURIComponent('Brief rejected')}`)
}

export async function approveArticleAction(siteId: string, articleId: string) {
  await requireAdmin()
  const { createClient: createServiceClient } = await import('@/lib/supabase/service')
  const supabase = createServiceClient()
  await supabase.from('seo_articles').update({ status: 'approved' }).eq('id', articleId).eq('status', 'review')
  revalidatePath(`/growth/${siteId}/articles/${articleId}`)
  revalidatePath(`/growth/${siteId}/articles`)
  redirect(
    `/growth/${siteId}/articles/${articleId}?notice=${encodeURIComponent(
      'Article approved — publishing arrives in Phase 4'
    )}`
  )
}

export async function publishArticleAction(siteId: string, articleId: string) {
  await requireAdmin()
  const { createClient: createServiceClient } = await import('@/lib/supabase/service')
  const supabase = createServiceClient()

  try {
    const { data: article } = await supabase
      .from('seo_articles')
      .select('*')
      .eq('id', articleId)
      .single()
    if (!article) throw new Error('Article not found')
    if (article.status !== 'approved') throw new Error('Only approved articles can be published')
    const { data: site } = await supabase.from('seo_sites').select('*').eq('id', siteId).single()
    if (!site) throw new Error('Site not found')

    const { publishArticle, mergePublishPr } = await import('@/lib/growth/publish')
    const result = await publishArticle(article, site)

    // Opt-in per site: merge the PR immediately. The human gates (approve +
    // publish) already ran in the OS — this only removes the GitHub round-trip.
    let autoMerged = false
    if (
      site.cms_type === 'github' &&
      (site.cms_config as { auto_merge?: boolean } | null)?.auto_merge &&
      result.ref.startsWith('http')
    ) {
      try {
        await mergePublishPr(result.ref)
        autoMerged = true
      } catch {
        autoMerged = false // PR stays open; merge by hand from the article page
      }
    }

    const { error } = await supabase
      .from('seo_articles')
      .update({
        status: 'published',
        published_at: new Date().toISOString(),
        published_url: result.url,
        publish_ref: result.ref,
      })
      .eq('id', articleId)
    if (error) throw new Error(error.message)

    // An article nobody sees earns nothing — distribution is a task, due today.
    const { createEngineTaskOnce } = await import('@/lib/growth/tasks')
    const { count: metaAccounts } = await supabase
      .from('ads_accounts')
      .select('id', { count: 'exact', head: true })
      .eq('site_id', siteId)
      .eq('platform', 'meta')
      .eq('status', 'active')
    await createEngineTaskOnce({
      title: `Distribute: ${article.title}`,
      url: result.url,
      context: {
        what: 'Get the new article in front of the people it was written for.',
        why: 'Published today; the first week of engagement signals are the ones Google and the AI engines weigh most.',
        evidence: [`PR/ref: ${result.ref}`],
        firstStep: metaAccounts
          ? 'Build a traffic campaign around the article in Meta (link ad, 7 days, modest cap) and add readers to a retargeting audience; then LinkedIn and relevant forum threads.'
          : 'LinkedIn post from the personal profile, then relevant groups and forum threads where the question comes up.',
        link: `/growth/${siteId}/articles/${articleId}`,
      },
      dueDate: new Date().toISOString().slice(0, 10),
      priority: 'high',
      extraLabels: ['distribution'],
    })

    // C3: internal links from existing articles that already mention the topic.
    const { internalLinkTaskForArticle } = await import('@/lib/growth/task-generation')
    await internalLinkTaskForArticle(siteId, articleId).catch(() => false)

    revalidatePath(`/growth/${siteId}/articles/${articleId}`)
    revalidatePath(`/growth/${siteId}/articles`)
    revalidatePath(`/growth/${siteId}`)
    redirect(
      `/growth/${siteId}/articles/${articleId}?notice=${encodeURIComponent(
        site.cms_type === 'github'
          ? autoMerged
            ? 'Pull request opened and merged — live once the site deploy finishes. Distribution task created for today.'
            : 'Pull request opened — merge it to go live. Distribution task created for today.'
          : site.cms_type === 'internal'
            ? 'Draft created on the marketing blog — review and publish it from /blog. Distribution task created for today.'
            : 'WordPress draft created — publish it from WP admin. Distribution task created for today.'
      )}`
    )
  } catch (err) {
    if (err && typeof err === 'object' && 'digest' in err) throw err
    redirect(`/growth/${siteId}/articles/${articleId}?error=${encodeURIComponent(errMessage(err))}`)
  }
}

export async function mergeArticlePrAction(siteId: string, articleId: string) {
  await requireAdmin()
  const { createClient: createServiceClient } = await import('@/lib/supabase/service')
  const supabase = createServiceClient()
  try {
    const { data: article } = await supabase
      .from('seo_articles')
      .select('publish_ref')
      .eq('id', articleId)
      .single()
    if (!article?.publish_ref?.startsWith('http')) {
      throw new Error('This article has no publish pull request')
    }
    const { mergePublishPr } = await import('@/lib/growth/publish')
    const message = await mergePublishPr(article.publish_ref)
    revalidatePath(`/growth/${siteId}/articles/${articleId}`)
    redirect(`/growth/${siteId}/articles/${articleId}?notice=${encodeURIComponent(message)}`)
  } catch (err) {
    if (err && typeof err === 'object' && 'digest' in err) throw err
    redirect(`/growth/${siteId}/articles/${articleId}?error=${encodeURIComponent(errMessage(err))}`)
  }
}

export async function retryDraftAction(siteId: string, articleId: string) {
  await requireAdmin()
  const { createClient: createServiceClient } = await import('@/lib/supabase/service')
  const supabase = createServiceClient()
  await supabase
    .from('seo_articles')
    .update({ error: null, draft_started_at: null })
    .eq('id', articleId)
    .eq('status', 'drafting')
  revalidatePath(`/growth/${siteId}/articles/${articleId}`)
  redirect(
    `/growth/${siteId}/articles/${articleId}?notice=${encodeURIComponent('Draft re-queued')}`
  )
}

// ── Phase 5: link building ───────────────────────────────────────────────────

export async function importProspectsAction(siteId: string, formData: FormData) {
  await requireAdmin()
  const competitor = String(formData.get('competitor') ?? '').trim()
  if (!competitor) {
    redirect(`/growth/${siteId}/links?error=${encodeURIComponent('Enter a competitor domain')}`)
  }
  try {
    const { importLinkProspects } = await import('@/lib/growth/links')
    const result = await importLinkProspects(siteId, competitor)
    revalidatePath(`/growth/${siteId}/links`)
    redirect(
      `/growth/${siteId}/links?notice=${encodeURIComponent(
        `${result.found} referring domains found — ${result.createdTargets} new targets, ${result.createdAccounts} new CRM prospects, ${result.skippedExisting} already known`
      )}`
    )
  } catch (err) {
    if (err && typeof err === 'object' && 'digest' in err) throw err
    redirect(`/growth/${siteId}/links?error=${encodeURIComponent(errMessage(err))}`)
  }
}

export async function findContactAction(siteId: string, targetId: string) {
  await requireAdmin()
  try {
    const { findProspectContact } = await import('@/lib/growth/outreach')
    const result = await findProspectContact(targetId)
    revalidatePath(`/growth/${siteId}/links`)
    redirect(
      `/growth/${siteId}/links?notice=${encodeURIComponent(
        result.found ? `Contact found: ${result.note}` : `No contact found: ${result.note}`
      )}`
    )
  } catch (err) {
    if (err && typeof err === 'object' && 'digest' in err) throw err
    redirect(`/growth/${siteId}/links?error=${encodeURIComponent(errMessage(err))}`)
  }
}

export async function findContactsBatchAction(siteId: string) {
  await requireAdmin()
  const { createClient: createServiceClient } = await import('@/lib/supabase/service')
  const supabase = createServiceClient()
  try {
    const { data: targets } = await supabase
      .from('seo_link_targets')
      .select('id')
      .eq('site_id', siteId)
      .in('status', ['identified', 'researching'])
      .is('contact_search_at', null)
      .order('tier', { ascending: true })
      .limit(8)
    if (!targets || targets.length === 0) {
      redirect(`/growth/${siteId}/links?notice=${encodeURIComponent('No targets awaiting contact search')}`)
    }
    const { findProspectContact } = await import('@/lib/growth/outreach')
    let found = 0
    for (const target of targets!) {
      try {
        if ((await findProspectContact(target.id as string)).found) found += 1
      } catch {
        /* keep going — per-target failures are recorded on the row */
      }
    }
    revalidatePath(`/growth/${siteId}/links`)
    redirect(
      `/growth/${siteId}/links?notice=${encodeURIComponent(
        `Searched ${targets!.length} prospects — found ${found} contacts. Run again for the next batch.`
      )}`
    )
  } catch (err) {
    if (err && typeof err === 'object' && 'digest' in err) throw err
    redirect(`/growth/${siteId}/links?error=${encodeURIComponent(errMessage(err))}`)
  }
}

export async function draftPitchAction(siteId: string, targetId: string) {
  await requireAdmin()
  try {
    const { draftPitch } = await import('@/lib/growth/outreach')
    await draftPitch(targetId)
    revalidatePath(`/growth/${siteId}/links`)
    redirect(`/growth/${siteId}/links?notice=${encodeURIComponent('Pitch drafted — review it below, then approve to queue')}`)
  } catch (err) {
    if (err && typeof err === 'object' && 'digest' in err) throw err
    redirect(`/growth/${siteId}/links?error=${encodeURIComponent(errMessage(err))}`)
  }
}

export async function draftPitchesBatchAction(siteId: string) {
  await requireAdmin()
  const { createClient: createServiceClient } = await import('@/lib/supabase/service')
  const supabase = createServiceClient()
  try {
    const { data: targets } = await supabase
      .from('seo_link_targets')
      .select('id')
      .eq('site_id', siteId)
      .in('status', ['identified', 'researching'])
      .not('contact_id', 'is', null)
      .is('pitch_generated_at', null)
      .order('tier', { ascending: true })
      .limit(5)
    if (!targets || targets.length === 0) {
      redirect(`/growth/${siteId}/links?notice=${encodeURIComponent('No contacts awaiting a pitch draft')}`)
    }
    const { draftPitch } = await import('@/lib/growth/outreach')
    let drafted = 0
    for (const target of targets!) {
      try {
        await draftPitch(target.id as string)
        drafted += 1
      } catch {
        /* per-target failures shouldn't sink the batch */
      }
    }
    revalidatePath(`/growth/${siteId}/links`)
    redirect(
      `/growth/${siteId}/links?notice=${encodeURIComponent(
        `${drafted} pitches drafted — review each below and approve to queue`
      )}`
    )
  } catch (err) {
    if (err && typeof err === 'object' && 'digest' in err) throw err
    redirect(`/growth/${siteId}/links?error=${encodeURIComponent(errMessage(err))}`)
  }
}

export async function approvePitchAction(siteId: string, targetId: string) {
  await requireAdmin()
  try {
    const { queueApprovedPitch } = await import('@/lib/growth/outreach')
    await queueApprovedPitch(targetId)
    revalidatePath(`/growth/${siteId}/links`)
    redirect(
      `/growth/${siteId}/links?notice=${encodeURIComponent(
        'Queued — the engine sends inside its window (Tue-Thu, 07:30-16:00), follows up once at 7 days, and stops on reply'
      )}`
    )
  } catch (err) {
    if (err && typeof err === 'object' && 'digest' in err) throw err
    redirect(`/growth/${siteId}/links?error=${encodeURIComponent(errMessage(err))}`)
  }
}

export async function markLinkOutreachAction(siteId: string, targetId: string) {
  await requireAdmin()
  const { createClient: createServiceClient } = await import('@/lib/supabase/service')
  const supabase = createServiceClient()
  await supabase
    .from('seo_link_targets')
    .update({ status: 'outreach', outreach_at: new Date().toISOString() })
    .eq('id', targetId)
    .in('status', ['identified', 'researching'])
  revalidatePath(`/growth/${siteId}/links`)
  redirect(
    `/growth/${siteId}/links?notice=${encodeURIComponent(
      'Marked as outreach — the 7-day follow-up task is now armed (fires once)'
    )}`
  )
}

export async function markLinkWonAction(siteId: string, targetId: string, formData: FormData) {
  await requireAdmin()
  const wonUrl = String(formData.get('won_url') ?? '').trim()
  if (!wonUrl) {
    redirect(`/growth/${siteId}/links?error=${encodeURIComponent('Paste the URL where the link went live')}`)
  }
  const { createClient: createServiceClient } = await import('@/lib/supabase/service')
  const supabase = createServiceClient()
  const { data: target } = await supabase
    .from('seo_link_targets')
    .select('url, seo_sites!inner(name)')
    .eq('id', targetId)
    .single()
  await supabase
    .from('seo_link_targets')
    .update({ status: 'won', won_url: wonUrl, won_at: new Date().toISOString() })
    .eq('id', targetId)

  if (target) {
    const { notifyLinkWon } = await import('@/lib/growth/links')
    const site = target.seo_sites as unknown as { name: string }
    let host = wonUrl
    try {
      host = new URL(wonUrl.startsWith('http') ? wonUrl : `https://${wonUrl}`).hostname
    } catch {
      /* keep the raw string */
    }
    void notifyLinkWon(site.name, host, wonUrl)
  }
  revalidatePath(`/growth/${siteId}/links`)
  redirect(`/growth/${siteId}/links?notice=${encodeURIComponent('Link won 🎉')}`)
}

export async function markLinkLostAction(siteId: string, targetId: string) {
  await requireAdmin()
  const { createClient: createServiceClient } = await import('@/lib/supabase/service')
  const supabase = createServiceClient()
  await supabase.from('seo_link_targets').update({ status: 'lost' }).eq('id', targetId)
  revalidatePath(`/growth/${siteId}/links`)
  redirect(`/growth/${siteId}/links?notice=${encodeURIComponent('Marked lost')}`)
}

// ── Phase 6: AI visibility prompts ───────────────────────────────────────────

export async function addPromptAction(siteId: string, formData: FormData) {
  await requireAdmin()
  const prompt = String(formData.get('prompt') ?? '').trim()
  if (!prompt) {
    redirect(`/growth/${siteId}/prompts?error=${encodeURIComponent('Enter a prompt')}`)
  }
  const { createClient: createServiceClient } = await import('@/lib/supabase/service')
  const supabase = createServiceClient()
  await supabase.from('seo_prompts').insert({
    site_id: siteId,
    prompt,
    category: String(formData.get('category') ?? '').trim() || null,
  })
  revalidatePath(`/growth/${siteId}/prompts`)
  redirect(`/growth/${siteId}/prompts?notice=${encodeURIComponent('Prompt added')}`)
}

export async function togglePromptAction(siteId: string, promptId: string, active: boolean) {
  await requireAdmin()
  const { createClient: createServiceClient } = await import('@/lib/supabase/service')
  const supabase = createServiceClient()
  await supabase.from('seo_prompts').update({ active }).eq('id', promptId)
  revalidatePath(`/growth/${siteId}/prompts`)
  redirect(`/growth/${siteId}/prompts`)
}

export async function seedPromptsAction(siteId: string) {
  await requireAdmin()
  try {
    const { seedPrompts } = await import('@/lib/growth/visibility')
    const added = await seedPrompts(siteId)
    revalidatePath(`/growth/${siteId}/prompts`)
    redirect(
      `/growth/${siteId}/prompts?notice=${encodeURIComponent(
        added > 0 ? `${added} buyer-intent prompts generated from the ICP` : 'No new prompts — the generated set already exists'
      )}`
    )
  } catch (err) {
    if (err && typeof err === 'object' && 'digest' in err) throw err
    redirect(`/growth/${siteId}/prompts?error=${encodeURIComponent(errMessage(err))}`)
  }
}

export async function researchKeywordsAction(siteId: string, formData: FormData) {
  await requireAdmin()

  const seeds = String(formData.get('seeds') ?? '')
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter(Boolean)

  if (seeds.length === 0) {
    redirect(`/growth/${siteId}?error=${encodeURIComponent('Enter at least one seed keyword')}`)
  }

  try {
    await requestKeywordIdeas(siteId, seeds)
  } catch (err) {
    redirect(`/growth/${siteId}?error=${encodeURIComponent(errMessage(err))}`)
  }

  redirect(
    `/growth/${siteId}?notice=${encodeURIComponent(
      'Keyword research queued — results land on the next collect run (within ~15 minutes)'
    )}`
  )
}

// ── v2: worksheets, overlap clustering, competitors, paid ───────────────────

async function serviceClient() {
  const { createClient: createServiceClient } = await import('@/lib/supabase/service')
  return createServiceClient()
}

export async function generateWorksheetAction(siteId: string, encodedUrl: string) {
  await requireAdmin()
  const { generateWorksheet, decodePageUrl } = await import('@/lib/growth/refresh')
  const site = await getSeoSiteById(siteId)
  if (!site) redirect('/growth')
  const url = decodePageUrl(encodedUrl)
  const path = `/growth/${siteId}/pages/${encodedUrl}`
  try {
    await generateWorksheet(site, url)
    revalidatePath(path)
    redirect(`${path}?notice=${encodeURIComponent('Worksheet generated')}`)
  } catch (err) {
    if (err && typeof err === 'object' && 'digest' in err) throw err
    redirect(`${path}?error=${encodeURIComponent(errMessage(err))}`)
  }
}

export async function toggleWorksheetItemAction(siteId: string, encodedUrl: string, key: string, checked: boolean) {
  await requireAdmin()
  const { setWorksheetCheck, decodePageUrl } = await import('@/lib/growth/refresh')
  await setWorksheetCheck(siteId, decodePageUrl(encodedUrl), key, checked)
  revalidatePath(`/growth/${siteId}/pages/${encodedUrl}`)
}

export async function setWorksheetStatusAction(siteId: string, encodedUrl: string, status: 'open' | 'applied' | 'dismissed') {
  await requireAdmin()
  const { setWorksheetStatus, decodePageUrl } = await import('@/lib/growth/refresh')
  await setWorksheetStatus(siteId, decodePageUrl(encodedUrl), status)
  const path = `/growth/${siteId}/pages/${encodedUrl}`
  revalidatePath(path)
  revalidatePath(`/growth/${siteId}`)
  redirect(`${path}?notice=${encodeURIComponent(status === 'applied' ? 'Marked applied' : status === 'dismissed' ? 'Dismissed' : 'Reopened')}`)
}

/** D3: turn the ticked change-list items into a PR (GitHub) or a draft (WordPress). */
export async function openRefreshPrAction(siteId: string, encodedUrl: string) {
  await requireAdmin()
  const { getWorksheet, setWorksheetStatus, decodePageUrl } = await import('@/lib/growth/refresh')
  const path = `/growth/${siteId}/pages/${encodedUrl}`
  try {
    const site = await getSeoSiteById(siteId)
    if (!site) throw new Error('Site not found')
    const url = decodePageUrl(encodedUrl)
    const ws = await getWorksheet(siteId, url)
    const list = ws?.payload.change_list
    if (!ws || !list) throw new Error('Generate the worksheet first')
    const checked = ws.checked
    const sections = list.sections_to_add
      .map((s, i) => ({ key: `section:${i}`, s }))
      .filter(({ key }) => checked[key])
      .map(({ s }) => ({ heading: s.heading, body: `_${s.covers}_\n\n<!-- Draft this section: ${s.covers} -->` }))
    const changes = {
      title: checked.title ? list.title.proposed : undefined,
      meta_description: checked.meta ? list.meta_description.proposed : undefined,
      sections,
    }
    if (!changes.title && !changes.meta_description && sections.length === 0) throw new Error('Tick at least one change to apply')
    const { updateArticle } = await import('@/lib/growth/publish')
    const title = ws.payload.page?.title ?? url
    const result = await updateArticle(site, url, title, changes)
    await setWorksheetStatus(siteId, url, 'applied', result.ref)
    revalidatePath(path)
    redirect(`${path}?notice=${encodeURIComponent(site.cms_type === 'github' ? `Pull request opened: ${result.ref}` : `WordPress draft ${result.ref} created — review it in WP admin`)}`)
  } catch (err) {
    if (err && typeof err === 'object' && 'digest' in err) throw err
    redirect(`${path}?error=${encodeURIComponent(errMessage(err))}`)
  }
}

/** B1: queue SERP snapshots for keywords lacking one (the confirmation step). */
export async function queueOverlapSnapshotsAction(siteId: string) {
  await requireAdmin()
  const { queueMissingSnapshots } = await import('@/lib/growth/clustering')
  try {
    const queued = await queueMissingSnapshots(siteId)
    revalidatePath(`/growth/${siteId}/clusters`)
    redirect(`/growth/${siteId}/clusters?notice=${encodeURIComponent(queued === 0 ? 'Every keyword already has a snapshot or one is queued' : `${queued} SERP snapshots queued — they land within ~15 minutes`)}`)
  } catch (err) {
    if (err && typeof err === 'object' && 'digest' in err) throw err
    redirect(`/growth/${siteId}/clusters?error=${encodeURIComponent(errMessage(err))}`)
  }
}

export async function generateOverlapClustersAction(siteId: string) {
  await requireAdmin()
  const { generateOverlapClusters } = await import('@/lib/growth/clustering')
  try {
    const site = await getSeoSiteById(siteId)
    if (!site) throw new Error('Site not found')
    const r = await generateOverlapClusters(site)
    revalidatePath(`/growth/${siteId}/clusters`)
    revalidatePath(`/growth/${siteId}`)
    redirect(`/growth/${siteId}/clusters?notice=${encodeURIComponent(`${r.created} clusters from SERP overlap covering ${r.assigned} keywords (${r.skippedNoSerp} keywords had no snapshot and were left out)`)}`)
  } catch (err) {
    if (err && typeof err === 'object' && 'digest' in err) throw err
    redirect(`/growth/${siteId}/clusters?error=${encodeURIComponent(errMessage(err))}`)
  }
}

export async function addCompetitorAction(siteId: string, formData: FormData) {
  await requireAdmin()
  const domain = String(formData.get('domain') ?? '').trim()
  const addedBy = (String(formData.get('added_by') ?? 'manual') as 'manual' | 'serp' | 'labs')
  const { addCompetitor, pullCompetitorKeywords } = await import('@/lib/growth/competitors')
  try {
    await addCompetitor(siteId, domain, addedBy)
    const clean = domain.toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '')
    const n = await pullCompetitorKeywords(siteId, clean)
    revalidatePath(`/growth/${siteId}/gap`)
    redirect(`/growth/${siteId}/gap?notice=${encodeURIComponent(`${clean} added — ${n} ranked keywords pulled`)}`)
  } catch (err) {
    if (err && typeof err === 'object' && 'digest' in err) throw err
    redirect(`/growth/${siteId}/gap?error=${encodeURIComponent(errMessage(err))}`)
  }
}

export async function pullCompetitorAction(siteId: string, domain: string) {
  await requireAdmin()
  const { pullCompetitorKeywords } = await import('@/lib/growth/competitors')
  try {
    const n = await pullCompetitorKeywords(siteId, domain)
    revalidatePath(`/growth/${siteId}/gap`)
    redirect(`/growth/${siteId}/gap?notice=${encodeURIComponent(`${domain}: ${n} ranked keywords pulled`)}`)
  } catch (err) {
    if (err && typeof err === 'object' && 'digest' in err) throw err
    redirect(`/growth/${siteId}/gap?error=${encodeURIComponent(errMessage(err))}`)
  }
}

export async function toggleCompetitorAction(siteId: string, competitorId: string, tracked: boolean) {
  await requireAdmin()
  const supabase = await serviceClient()
  await supabase.from('seo_competitors').update({ tracked }).eq('id', competitorId)
  revalidatePath(`/growth/${siteId}/gap`)
  redirect(`/growth/${siteId}/gap`)
}

export async function addGapKeywordsAction(siteId: string, formData: FormData) {
  await requireAdmin()
  const keywords = formData.getAll('keyword').map((k) => String(k).trim().toLowerCase()).filter(Boolean)
  const { addKeywordsFromGap } = await import('@/lib/growth/competitors')
  try {
    const n = await addKeywordsFromGap(siteId, keywords)
    revalidatePath(`/growth/${siteId}/gap`)
    revalidatePath(`/growth/${siteId}`)
    redirect(`/growth/${siteId}/gap?notice=${encodeURIComponent(`${n} keywords added to the list (${keywords.length - n} were already there)`)}`)
  } catch (err) {
    if (err && typeof err === 'object' && 'digest' in err) throw err
    redirect(`/growth/${siteId}/gap?error=${encodeURIComponent(errMessage(err))}`)
  }
}

/** Research box: Labs expansion (suggestions + related) alongside Google Ads seeds. */
export async function expandSeedsAction(siteId: string, formData: FormData) {
  await requireAdmin()
  const seeds = String(formData.get('seeds') ?? '').split(/[,\n]/).map((s) => s.trim()).filter(Boolean)
  if (seeds.length === 0) redirect(`/growth/${siteId}?error=${encodeURIComponent('Enter at least one seed keyword')}`)
  const { expandSeeds } = await import('@/lib/growth/competitors')
  try {
    const r = await expandSeeds(siteId, seeds)
    revalidatePath(`/growth/${siteId}`)
    redirect(`/growth/${siteId}?notice=${encodeURIComponent(`Labs expansion: ${r.added} new keywords from ${r.seen} suggestions (tagged by source)`)}`)
  } catch (err) {
    if (err && typeof err === 'object' && 'digest' in err) throw err
    redirect(`/growth/${siteId}?error=${encodeURIComponent(errMessage(err))}`)
  }
}

export async function runEnrichNowAction(siteId: string) {
  await requireAdmin()
  const { enrichSite } = await import('@/lib/growth/enrich')
  try {
    const site = await getSeoSiteById(siteId)
    if (!site) throw new Error('Site not found')
    const r = await enrichSite(site)
    revalidatePath(`/growth/${siteId}`)
    redirect(`/growth/${siteId}?notice=${encodeURIComponent(`Enriched ${r.enriched} keywords with Labs difficulty and intent (${r.seasonality} got volume history)`)}`)
  } catch (err) {
    if (err && typeof err === 'object' && 'digest' in err) throw err
    redirect(`/growth/${siteId}?error=${encodeURIComponent(errMessage(err))}`)
  }
}

export async function recrawlAction(siteId: string) {
  await requireAdmin()
  const { startCrawl } = await import('@/lib/growth/onpage')
  try {
    const site = await getSeoSiteById(siteId)
    if (!site) throw new Error('Site not found')
    if (site.crawl_task_id) throw new Error('A crawl is already running — results land on the next growth-crawl tick')
    await startCrawl(site)
    revalidatePath(`/growth/${siteId}/keywords`)
    redirect(`/growth/${siteId}/keywords?issues=1&notice=${encodeURIComponent(`Crawl started (up to ${site.max_crawl_pages} pages) — issues appear within a few hours`)}`)
  } catch (err) {
    if (err && typeof err === 'object' && 'digest' in err) throw err
    redirect(`/growth/${siteId}/keywords?issues=1&error=${encodeURIComponent(errMessage(err))}`)
  }
}

export async function linkAdsAccountAction(siteId: string, formData: FormData) {
  await requireAdmin()
  const platform = String(formData.get('platform') ?? '') as 'google' | 'meta'
  const externalId = String(formData.get('external_id') ?? '').trim().replace(/-/g, '')
  const name = String(formData.get('name') ?? '').trim() || null
  if (!platform || !externalId) redirect(`/growth/${siteId}/paid?error=${encodeURIComponent('Platform and account id are required')}`)
  const supabase = await serviceClient()
  const { error } = await supabase
    .from('ads_accounts')
    .upsert({ site_id: siteId, platform, external_id: externalId, name, status: 'active' }, { onConflict: 'platform,external_id' })
  if (error) redirect(`/growth/${siteId}/paid?error=${encodeURIComponent(error.message)}`)
  revalidatePath(`/growth/${siteId}/paid`)
  redirect(`/growth/${siteId}/paid?notice=${encodeURIComponent('Account linked — first sync runs tonight at 05:15, or press Sync now')}`)
}

export async function syncAdsNowAction(siteId: string) {
  await requireAdmin()
  try {
    const supabase = await serviceClient()
    const { syncAllGoogleAccounts } = await import('@/lib/growth/ads-google')
    const { syncAllMetaAccounts } = await import('@/lib/growth/ads-meta')
    const { applyCommercialWeighting, pushMinedTermsToKeywords } = await import('@/lib/growth/paid-loops')
    const g = await syncAllGoogleAccounts(supabase)
    const m = await syncAllMetaAccounts(supabase)
    const mined = await pushMinedTermsToKeywords(siteId, supabase)
    await applyCommercialWeighting(siteId, supabase)
    const errors = [...g.errors, ...m.errors].filter((e) => e.account !== '*')
    revalidatePath(`/growth/${siteId}/paid`)
    revalidatePath(`/growth/${siteId}`)
    if (errors.length > 0) redirect(`/growth/${siteId}/paid?error=${encodeURIComponent(errors.map((e) => `${e.account}: ${e.error}`).join(' · '))}`)
    redirect(`/growth/${siteId}/paid?notice=${encodeURIComponent(`Synced ${g.synced.length} Google and ${m.synced.length} Meta account(s); ${mined} converting search terms pushed to the keyword list`)}`)
  } catch (err) {
    if (err && typeof err === 'object' && 'digest' in err) throw err
    redirect(`/growth/${siteId}/paid?error=${encodeURIComponent(errMessage(err))}`)
  }
}

export async function updateGrowthBudgetsAction(siteId: string, formData: FormData) {
  await requireAdmin()
  const num = (k: string) => {
    const v = String(formData.get(k) ?? '').trim()
    return v === '' ? null : Number(v)
  }
  const supabase = await serviceClient()
  const { error } = await supabase
    .from('seo_sites')
    .update({
      serp_overlap_threshold: num('serp_overlap_threshold') ?? 3,
      monthly_api_budget: num('monthly_api_budget'),
      monthly_ads_budget: num('monthly_ads_budget'),
      max_crawl_pages: num('max_crawl_pages') ?? 200,
    })
    .eq('id', siteId)
  if (error) redirect(`/growth/${siteId}/settings?error=${encodeURIComponent(error.message)}`)
  revalidatePath(`/growth/${siteId}/settings`)
  redirect(`/growth/${siteId}/settings?notice=${encodeURIComponent('Budgets and thresholds saved')}`)
}
