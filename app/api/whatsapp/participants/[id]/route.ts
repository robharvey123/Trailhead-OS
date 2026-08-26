import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedSupabase } from '@/lib/api/auth'
import { mergeParticipants } from '@/lib/whatsapp/import'

// PATCH — link/unlink a participant to a CRM contact, or merge it into another
// participant of the same conversation (a rename detected after import).
//   { contact_id: string | null }         relabels the whole history without a re-import
//   { merge_into_participant_id: string } reassigns rows, keeps the newest name
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { ok, response, supabase } = await getAuthenticatedSupabase()
    if (!ok) return response
    const { id } = await params
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>

    if (typeof body.merge_into_participant_id === 'string') {
      const participant = await mergeParticipants(id, body.merge_into_participant_id, supabase)
      return NextResponse.json({ participant, merged: true })
    }

    if (!('contact_id' in body)) return NextResponse.json({ error: 'contact_id or merge_into_participant_id is required' }, { status: 400 })
    const contactId = body.contact_id === null ? null : typeof body.contact_id === 'string' ? body.contact_id : undefined
    if (contactId === undefined) return NextResponse.json({ error: 'contact_id must be a string or null' }, { status: 400 })

    if (contactId) {
      const { data: contact } = await supabase.from('contacts').select('id').eq('id', contactId).maybeSingle()
      if (!contact) return NextResponse.json({ error: 'Contact not found' }, { status: 404 })
    }

    const { data: participant, error } = await supabase
      .from('whatsapp_participants')
      .update({ contact_id: contactId })
      .eq('id', id)
      .select('*, contact:contacts(id,name,account_id)')
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Keep the denormalised copy on the rows in step (legacy readers only).
    await supabase.from('whatsapp_messages').update({ contact_id: contactId }).eq('sender_participant_id', id)

    return NextResponse.json({ participant })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Update failed' }, { status: 500 })
  }
}
