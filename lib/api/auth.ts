import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function getAuthenticatedSupabase() {
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
