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
    let cmsConfig: Record<string, unknown> = {}
    if (cmsType === 'github') {
      cmsConfig = {
        repo: String(formData.get('cms_repo') ?? '').trim(),
        base_branch: String(formData.get('cms_base_branch') ?? '').trim() || 'main',
        content_dir: String(formData.get('cms_content_dir') ?? '').trim() || 'content/blog',
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

    const { publishArticle } = await import('@/lib/growth/publish')
    const result = await publishArticle(article, site)

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
    await createEngineTaskOnce({
      title: `Distribute: ${article.title}`,
      description: `Share ${result.url} — LinkedIn, relevant groups, forum threads. PR/ref: ${result.ref}`,
      dueDate: new Date().toISOString().slice(0, 10),
      priority: 'high',
      extraLabels: ['distribution'],
    })

    revalidatePath(`/growth/${siteId}/articles/${articleId}`)
    revalidatePath(`/growth/${siteId}/articles`)
    revalidatePath(`/growth/${siteId}`)
    redirect(
      `/growth/${siteId}/articles/${articleId}?notice=${encodeURIComponent(
        site.cms_type === 'github'
          ? 'Pull request opened — merge it to go live. Distribution task created for today.'
          : 'WordPress draft created — publish it from WP admin. Distribution task created for today.'
      )}`
    )
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
