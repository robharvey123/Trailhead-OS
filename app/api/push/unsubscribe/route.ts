import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

/** Remove the caller's subscription for a given endpoint. */
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorised' }, { status: 401 })

  const body = await request.json().catch(() => null)
  const endpoint = body?.endpoint as string | undefined
  if (!endpoint) return Response.json({ error: 'Missing endpoint' }, { status: 400 })

  // RLS (push_sub_self) also scopes this to the caller; the explicit user_id
  // filter keeps it correct even if RLS were ever relaxed.
  const { error } = await supabase
    .from('push_subscriptions')
    .delete()
    .eq('user_id', user.id)
    .eq('endpoint', endpoint)

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}
