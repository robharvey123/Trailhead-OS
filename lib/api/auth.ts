import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { SupabaseClient, User } from '@supabase/supabase-js'
import { getOwnerUser } from '@/lib/auth/owner'

/** Check if request was API-key-authenticated by middleware. Returns admin client + user, or null. */
export async function getApiKeyAuth(): Promise<{ supabase: SupabaseClient; user: User } | null> {
  const headersList = await headers()
  if (headersList.get('x-api-key-verified') !== 'true') return null
  const supabase = createAdminClient()
  // API-key requests act as the OS owner (profiles.role = 'owner').
  const user = await getOwnerUser(supabase)
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

/**
 * Session-only gate for user-management routes: owner/admin profiles pass,
 * everyone else gets 401/403. Deliberately ignores the API-key path, so a
 * Cowork token can't be used to create logins or reset passwords.
 */
export async function requireAdminSession(): Promise<{ ok: true } | { ok: false; response: NextResponse }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (profile?.role !== 'owner' && profile?.role !== 'admin') {
    return { ok: false, response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }
  return { ok: true }
}
