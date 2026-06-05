import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

/** Store (or refresh) the caller's browser push subscription. */
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorised' }, { status: 401 })

  const body = await request.json().catch(() => null)
  const endpoint = body?.endpoint as string | undefined
  const p256dh = body?.keys?.p256dh as string | undefined
  const auth = body?.keys?.auth as string | undefined
  if (!endpoint || !p256dh || !auth) {
    return Response.json({ error: 'Invalid subscription' }, { status: 400 })
  }

  // endpoint is unique: the same browser re-subscribing overwrites its row
  // (and re-homes it to this user if it moved accounts).
  const { error } = await supabase
    .from('push_subscriptions')
    .upsert(
      {
        user_id: user.id,
        endpoint,
        p256dh,
        auth,
        user_agent: (body?.user_agent as string | undefined) ?? null,
        last_used_at: new Date().toISOString(),
      },
      { onConflict: 'endpoint' }
    )

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}
