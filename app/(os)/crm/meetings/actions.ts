'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

// Manual meeting ↔ account / contact linking. Runs as the signed-in user, so the
// join tables' "authenticated full access" RLS is the authorisation boundary. Each
// action revalidates the meeting detail page so the chips refresh.

type Result = { error?: string }

function revalidate(meetingId: string) {
  revalidatePath(`/crm/meetings/${meetingId}`)
}

export async function addMeetingAccount(meetingId: string, accountId: string): Promise<Result> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('meeting_accounts')
    .upsert({ meeting_id: meetingId, account_id: accountId }, { onConflict: 'meeting_id,account_id', ignoreDuplicates: true })
  if (error) return { error: error.message }

  // Populate the legacy primary account if the meeting had none.
  const { data: mtg } = await supabase.from('meetings').select('account_id').eq('id', meetingId).maybeSingle()
  if (mtg && !mtg.account_id) {
    await supabase.from('meetings').update({ account_id: accountId }).eq('id', meetingId)
  }
  revalidate(meetingId)
  return {}
}

export async function removeMeetingAccount(meetingId: string, accountId: string): Promise<Result> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('meeting_accounts')
    .delete()
    .eq('meeting_id', meetingId)
    .eq('account_id', accountId)
  if (error) return { error: error.message }

  // If we just removed the primary, repoint it at a remaining linked account (or null).
  const { data: mtg } = await supabase.from('meetings').select('account_id').eq('id', meetingId).maybeSingle()
  if (mtg?.account_id === accountId) {
    const { data: remaining } = await supabase
      .from('meeting_accounts')
      .select('account_id')
      .eq('meeting_id', meetingId)
      .limit(1)
    await supabase.from('meetings').update({ account_id: remaining?.[0]?.account_id ?? null }).eq('id', meetingId)
  }
  revalidate(meetingId)
  return {}
}

export async function addMeetingContact(meetingId: string, contactId: string): Promise<Result> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('meeting_contacts')
    .upsert({ meeting_id: meetingId, contact_id: contactId }, { onConflict: 'meeting_id,contact_id', ignoreDuplicates: true })
  if (error) return { error: error.message }
  revalidate(meetingId)
  return {}
}

export async function removeMeetingContact(meetingId: string, contactId: string): Promise<Result> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('meeting_contacts')
    .delete()
    .eq('meeting_id', meetingId)
    .eq('contact_id', contactId)
  if (error) return { error: error.message }
  revalidate(meetingId)
  return {}
}
