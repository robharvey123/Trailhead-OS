'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getCurrentProfile, roleCanUseSales } from '@/lib/auth/roles'
import {
  NEEDS_DATE,
  NEEDS_REASON,
  NEEDS_SUMMARY,
  OUTCOME_CODES,
  OUTCOME_LABELS,
  PIPELINE_STAGES,
  type OutcomeCode,
  type PipelineStage,
} from '@/lib/sales/queue'

export type SalesActionResult<T = undefined> = { ok: true; data?: T } | { ok: false; error: string }

const CHANNELS = ['call', 'email', 'demo', 'meeting', 'linkedin'] as const
type Channel = (typeof CHANNELS)[number]

async function salesSession() {
  const supabase = await createClient()
  const profile = await getCurrentProfile(supabase).catch(() => null)
  if (!profile || !roleCanUseSales(profile.role)) return null
  return { supabase, profile }
}

function revalidateSales(contactId?: string) {
  revalidatePath('/sales/queue')
  revalidatePath('/sales/pipeline')
  revalidatePath('/sales/dashboard')
  revalidatePath('/sales/contacts')
  if (contactId) revalidatePath(`/sales/contacts/${contactId}`)
}

/** Postgres raises friendly messages from log_sales_outcome / set_pipeline_stage; pass them through. */
function dbError(error: { message?: string; code?: string } | null, fallback: string): string {
  if (!error) return fallback
  if (error.code === '42501') return error.message?.includes('sales seat') || error.message?.includes('yourself') ? error.message : 'You do not have access to that contact.'
  if (error.code === 'P0002') return 'Contact not found in your list.'
  return error.message || fallback
}

export interface LogOutcomeInput {
  contactId: string
  outcome: OutcomeCode
  summary?: string
  channel?: Channel
  nextActionAt?: string | null
  nextActionNote?: string
  durationSeconds?: number | null
  reason?: string
}

export async function logOutcome(input: LogOutcomeInput): Promise<SalesActionResult<{ stageAfter: PipelineStage }>> {
  const session = await salesSession()
  if (!session) return { ok: false, error: 'Sign in to the sales seat first.' }
  const outcome = input.outcome
  if (!OUTCOME_CODES.includes(outcome)) return { ok: false, error: 'Pick an outcome.' }
  const channel: Channel = input.channel && CHANNELS.includes(input.channel) ? input.channel : 'call'
  const summary = (input.summary ?? '').trim()
  const reason = (input.reason ?? '').trim()
  if (NEEDS_SUMMARY.has(outcome) && !summary) return { ok: false, error: `${OUTCOME_LABELS[outcome]} needs a summary of what they said.` }
  if (NEEDS_REASON.has(outcome) && !reason) return { ok: false, error: `${OUTCOME_LABELS[outcome]} needs a reason.` }
  let nextActionAt: string | null = null
  if (input.nextActionAt) {
    const d = new Date(input.nextActionAt)
    if (Number.isNaN(d.getTime())) return { ok: false, error: 'That next-action date is not valid.' }
    nextActionAt = d.toISOString()
  }
  if (NEEDS_DATE.has(outcome) && !nextActionAt) return { ok: false, error: 'Pick a date and time for the callback.' }
  if (summary.length > 4000 || reason.length > 1000) return { ok: false, error: 'That summary is too long.' }
  const duration = input.durationSeconds == null ? null : Math.round(input.durationSeconds)
  if (duration != null && (!Number.isFinite(duration) || duration < 0 || duration > 6 * 3600)) return { ok: false, error: 'Duration looks wrong.' }

  const { data, error } = await session.supabase.rpc('log_sales_outcome', {
    p_contact_id: input.contactId,
    p_outcome: outcome,
    p_summary: summary || null,
    p_channel: channel,
    p_next_action_at: nextActionAt,
    p_next_action_note: (input.nextActionNote ?? '').trim() || null,
    p_duration_seconds: duration,
    p_reason: reason || null,
  })
  if (error) return { ok: false, error: dbError(error, 'Could not log that outcome.') }
  revalidateSales(input.contactId)
  return { ok: true, data: { stageAfter: (data as { stage_after: PipelineStage }).stage_after } }
}

export async function setStage(contactId: string, stage: PipelineStage, reason?: string): Promise<SalesActionResult> {
  const session = await salesSession()
  if (!session) return { ok: false, error: 'Sign in to the sales seat first.' }
  if (!PIPELINE_STAGES.includes(stage)) return { ok: false, error: 'Unknown stage.' }
  const r = (reason ?? '').trim()
  if ((stage === 'disqualified' || stage === 'lost') && !r) return { ok: false, error: 'Give a reason first.' }
  const { error } = await session.supabase.rpc('set_pipeline_stage', { p_contact_id: contactId, p_stage: stage, p_reason: r || null })
  if (error) return { ok: false, error: dbError(error, 'Could not move that contact.') }
  revalidateSales(contactId)
  return { ok: true }
}

export async function claimContact(contactId: string, claim: boolean): Promise<SalesActionResult> {
  const session = await salesSession()
  if (!session) return { ok: false, error: 'Sign in to the sales seat first.' }
  const { data: { user } } = await session.supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Sign in to the sales seat first.' }
  const query = session.supabase.from('contacts').update({ owner_user_id: claim ? user.id : null }).eq('id', contactId)
  const { error } = claim ? await query.is('owner_user_id', null) : await query.eq('owner_user_id', user.id)
  if (error) return { ok: false, error: dbError(error, 'Could not update the owner.') }
  revalidateSales(contactId)
  return { ok: true }
}

export async function setEngineerOsOrgId(contactId: string, orgId: string): Promise<SalesActionResult> {
  const session = await salesSession()
  if (!session) return { ok: false, error: 'Sign in to the sales seat first.' }
  const value = orgId.trim()
  if (value.length > 120 || (value && !/^[A-Za-z0-9._:-]+$/.test(value))) return { ok: false, error: 'Use the org slug or id, letters, numbers and - _ . : only.' }
  const { error } = await session.supabase.from('contacts').update({ engineer_os_org_id: value || null }).eq('id', contactId)
  if (error) return { ok: false, error: dbError(error, 'Could not save the org id.') }
  revalidateSales(contactId)
  return { ok: true }
}
