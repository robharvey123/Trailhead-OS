'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { validateCampaignForSend } from '@/lib/outreach/validate'
import { sendTestEmail } from '@/lib/outreach/send'
import type { OutreachCampaignStatus } from '@/lib/types'

const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7]

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':')
  return (Number(h) || 0) * 60 + (Number(m) || 0)
}

type ScheduleValues = { send_days: number[]; send_window_start: string; send_window_end: string; timezone: string }

/** Parse + validate the schedule fields shared by create and edit. */
function parseSchedule(formData: FormData): { error: string } | ScheduleValues {
  const send_days = [...new Set(formData.getAll('send_days').map((v) => Number(v)))]
    .filter((n) => WEEKDAYS.includes(n))
    .sort((a, b) => a - b)
  if (send_days.length === 0) return { error: 'Pick at least one send day, or the campaign will never send.' }
  const send_window_start = String(formData.get('send_window_start') ?? '').trim() || '07:30'
  const send_window_end = String(formData.get('send_window_end') ?? '').trim() || '16:00'
  if (timeToMinutes(send_window_end) <= timeToMinutes(send_window_start)) {
    return { error: 'The send window end time must be after its start time.' }
  }
  const timezone = String(formData.get('timezone') ?? '').trim() || 'Europe/London'
  return { send_days, send_window_start, send_window_end, timezone }
}

async function setStatus(id: string, status: OutreachCampaignStatus): Promise<void> {
  if (!id) return
  const supabase = await createClient()
  const patch: Record<string, unknown> = { status }
  if (status === 'running') {
    // Gate the button: don't let a campaign with placeholder or invalid-token
    // templates go live and email placeholder text to real businesses.
    const error = await validateCampaignForSend(supabase, id)
    if (error) redirect(`/outreach/${id}?error=${encodeURIComponent(error)}`)
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
  if (!name) redirect(`/outreach/new?error=${encodeURIComponent('Give the campaign a name.')}`)
  const schedule = parseSchedule(formData)
  if ('error' in schedule) redirect(`/outreach/new?error=${encodeURIComponent(schedule.error)}`)
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
      send_days: schedule.send_days,
      send_window_start: schedule.send_window_start,
      send_window_end: schedule.send_window_end,
      timezone: schedule.timezone,
    })
    .select('id')
    .single()
  if (error || !data) throw new Error(error?.message ?? 'Failed to create campaign')

  revalidatePath('/outreach')
  redirect(`/outreach/${data.id}`)
}

/** Edit a campaign's schedule. Allowed while running — takes effect next tick. */
export async function updateCampaignScheduleAction(formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '')
  if (!id) return
  const schedule = parseSchedule(formData)
  if ('error' in schedule) redirect(`/outreach/${id}?error=${encodeURIComponent(schedule.error)}`)
  const supabase = await createClient()
  await supabase.from('outreach_campaigns').update({
    send_days: schedule.send_days,
    send_window_start: schedule.send_window_start,
    send_window_end: schedule.send_window_end,
    timezone: schedule.timezone,
  }).eq('id', id)
  revalidatePath(`/outreach/${id}`)
  revalidatePath('/outreach')
  redirect(`/outreach/${id}`)
}

const STEPS_LOCKED = 'Pause the campaign before editing its steps — recipients hold a step position that would shift onto the wrong email underneath them.'

/** Append a step (step_number = max + 1). Refused while running. */
export async function addCampaignStepAction(formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '')
  if (!id) return
  const supabase = await createClient()
  const { data: campaign } = await supabase.from('outreach_campaigns').select('status').eq('id', id).maybeSingle<{ status: OutreachCampaignStatus }>()
  if (!campaign) redirect('/outreach')
  if (campaign!.status === 'running') redirect(`/outreach/${id}?error=${encodeURIComponent(STEPS_LOCKED)}`)

  const templateId = String(formData.get('template_id') ?? '')
  if (!templateId) redirect(`/outreach/${id}?error=${encodeURIComponent('Choose a template for the step.')}`)
  const delayDays = Math.max(0, Number(formData.get('delay_days')) || 0)

  const { data: last } = await supabase.from('outreach_campaign_steps').select('step_number').eq('campaign_id', id).order('step_number', { ascending: false }).limit(1).maybeSingle<{ step_number: number }>()
  const nextNumber = (last?.step_number ?? 0) + 1
  await supabase.from('outreach_campaign_steps').insert({ campaign_id: id, step_number: nextNumber, template_id: templateId, delay_days: delayDays })
  revalidatePath(`/outreach/${id}`)
  redirect(`/outreach/${id}`)
}

/** Remove a step, then renumber the rest gaplessly. Refused while running. */
export async function removeCampaignStepAction(formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '')
  const stepId = String(formData.get('step_id') ?? '')
  if (!id || !stepId) return
  const supabase = await createClient()
  const { data: campaign } = await supabase.from('outreach_campaigns').select('status').eq('id', id).maybeSingle<{ status: OutreachCampaignStatus }>()
  if (!campaign) redirect('/outreach')
  if (campaign!.status === 'running') redirect(`/outreach/${id}?error=${encodeURIComponent(STEPS_LOCKED)}`)

  await supabase.from('outreach_campaign_steps').delete().eq('id', stepId).eq('campaign_id', id)

  // Renumber remaining steps to 1..N with no gaps: send.ts indexes the ordered
  // step array by recipient.current_step, so a gap would misdeliver. Updating in
  // ascending order is collision-safe — each target slot is already vacated.
  const { data: remaining } = await supabase.from('outreach_campaign_steps').select('id, step_number').eq('campaign_id', id).order('step_number', { ascending: true })
  let n = 1
  for (const s of (remaining ?? []) as Array<{ id: string; step_number: number }>) {
    if (s.step_number !== n) await supabase.from('outreach_campaign_steps').update({ step_number: n }).eq('id', s.id)
    n++
  }
  revalidatePath(`/outreach/${id}`)
  redirect(`/outreach/${id}`)
}

/** Send a one-off test of a step to an address. Writes nothing (see sendTestEmail). */
export async function sendTestEmailAction(formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '')
  if (!id) return
  const toEmail = String(formData.get('to_email') ?? '').trim()
  const result = await sendTestEmail({
    campaignId: id,
    contactId: String(formData.get('contact_id') ?? ''),
    toEmail,
    stepNumber: Number(formData.get('step_number')) || 1,
  })
  if (!result.ok) redirect(`/outreach/${id}?error=${encodeURIComponent(result.error)}`)
  redirect(`/outreach/${id}?test=${encodeURIComponent(toEmail)}`)
}
