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
