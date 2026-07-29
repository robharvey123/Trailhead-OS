import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedSupabase } from '@/lib/api/auth'

// Statuses that mean a recipient is still mid-flight in a campaign. Merging or
// archiving such a contact would either drop a queued send (collision delete) or
// keep sending as a ghost — so we refuse and make the caller stop the campaign first.
const LIVE_RECIPIENT_STATUSES = ['pending', 'active']

type Body = { type?: unknown; winner_id?: unknown; loser_id?: unknown }

export async function POST(request: NextRequest) {
  const auth = await getAuthenticatedSupabase()
  if (!auth.ok) return auth.response
  const supabase = auth.supabase

  const body = (await request.json().catch(() => ({}))) as Body
  const type = body.type === 'account' ? 'account' : body.type === 'contact' ? 'contact' : null
  const winnerId = typeof body.winner_id === 'string' ? body.winner_id : ''
  const loserId = typeof body.loser_id === 'string' ? body.loser_id : ''

  if (!type) return NextResponse.json({ error: 'type must be "contact" or "account"' }, { status: 400 })
  if (!winnerId || !loserId) return NextResponse.json({ error: 'winner_id and loser_id are required' }, { status: 400 })
  if (winnerId === loserId) return NextResponse.json({ error: 'winner_id and loser_id must differ' }, { status: 400 })

  // Live-campaign guard: never merge a contact that still has queued/active sends.
  if (type === 'contact') {
    const { data: live, error: liveErr } = await supabase
      .from('outreach_recipients')
      .select('id, campaign_id')
      .eq('contact_id', loserId)
      .in('status', LIVE_RECIPIENT_STATUSES)
      .limit(1)
    if (liveErr) return NextResponse.json({ error: liveErr.message }, { status: 500 })
    if (live && live.length > 0) {
      return NextResponse.json(
        { error: 'This contact is in a running outreach campaign. Stop or complete the campaign before merging.' },
        { status: 409 },
      )
    }
  }

  const fn = type === 'contact' ? 'crm_merge_contacts' : 'crm_merge_accounts'
  const { error } = await supabase.rpc(fn, { winner: winnerId, loser: loserId })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, merged: loserId, into: winnerId })
}
