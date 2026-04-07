import { NextResponse } from 'next/server'
import { getAuthenticatedSupabase } from '@/lib/api/auth'

export async function POST(request: Request) {
  const auth = await getAuthenticatedSupabase()

  if (!auth.ok) {
    return auth.response
  }

  await auth.supabase.from('microsoft_tokens').delete().neq('id', '')

  return NextResponse.redirect(new URL('/calendar/integrations?microsoft=disconnected', request.url), 303)
}
