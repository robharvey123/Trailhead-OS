import { NextResponse } from 'next/server'
import { getAuthenticatedSupabase } from '@/lib/api/auth'

export async function GET() {
  const auth = await getAuthenticatedSupabase()
  if (!auth.ok) return auth.response

  const { data, error } = await auth.supabase
    .from('microsoft_tokens')
    .select('id, email, label, created_at')
    .order('created_at')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ accounts: data ?? [] })
}
