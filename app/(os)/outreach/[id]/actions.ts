'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { OutreachCampaignStatus } from '@/lib/types'

async function setStatus(id: string, status: OutreachCampaignStatus): Promise<void> {
  if (!id) return
  const supabase = await createClient()
  const patch: Record<string, unknown> = { status }
  if (status === 'running') {
    const { data: existing } = await supabase.from('outreach_campaigns').select('started_at').eq('id', id).maybeSingle<{ started_at: string | null }>()
    if (existing && !existing.started_at) patch.started_at = new Date().toISOString()
  }
  if (status === 'completed' || status === 'cancelled') patch.completed_at = new Date().toISOString()
  await supabase.from('outreach_campaigns').update(patch).eq('id', id)
  revalidatePath(`/outreach/${id}`)
  revalidatePath('/outreach')
}

// Form actions (read the campaign id from a hidden field).
export async function startCampaignAction(formData: FormData): Promise<void> { await setStatus(String(formData.get('id') ?? ''), 'running') }
export async function pauseCampaignAction(formData: FormData): Promise<void> { await setStatus(String(formData.get('id') ?? ''), 'paused') }
export async function resumeCampaignAction(formData: FormData): Promise<void> { await setStatus(String(formData.get('id') ?? ''), 'running') }
export async function cancelCampaignAction(formData: FormData): Promise<void> { await setStatus(String(formData.get('id') ?? ''), 'cancelled') }

/** Create a draft campaign from the /outreach/new form and open it. */
export async function createCampaign(formData: FormData): Promise<void> {
  const supabase = await createClient()
  const name = String(formData.get('name') ?? '').trim()
  if (!name) redirect('/outreach/new')
  const audienceId = String(formData.get('audience_id') ?? '') || null

  const { data, error } = await supabase
    .from('outreach_campaigns')
    .insert({
      name,
      audience_id: audienceId,
      status: 'draft',
      from_name: String(formData.get('from_name') ?? '').trim() || null,
      from_email: String(formData.get('from_email') ?? '').trim() || null,
      reply_to: String(formData.get('reply_to') ?? '').trim() || null,
      daily_send_cap: Number(formData.get('daily_send_cap')) || 20,
    })
    .select('id')
    .single()
  if (error || !data) throw new Error(error?.message ?? 'Failed to create campaign')

  revalidatePath('/outreach')
  redirect(`/outreach/${data.id}`)
}
