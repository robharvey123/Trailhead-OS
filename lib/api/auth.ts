import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { SupabaseClient, User } from '@supabase/supabase-js'

/** Check if request was API-key-authenticated by middleware. Returns admin client + user, or null. */
export async function getApiKeyAuth(): Promise<{ supabase: SupabaseClient; user: User } | null> {
  const headersList = await headers()
  if (headersList.get('x-api-key-verified') !== 'true') return null
  const supabase = createAdminClient()
  const { data: { users } } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1 })
  const user = users[0] ?? null
  if (!user) return null
  return { supabase, user }
}

export async function getAuthenticatedSupabase() {
  const apiKeyAuth = await getApiKeyAuth()
  if (apiKeyAuth) {
    return { ok: true as const, response: null, supabase: apiKeyAuth.supabase, user: apiKeyAuth.user }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
      supabase,
      user: null,
    }
  }

  return {
    ok: true as const,
    response: null,
    supabase,
    user,
  }
}
