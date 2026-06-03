import { getAuthenticatedSupabase } from '@/lib/api/auth'
import { deactivateContributor, updateContributor } from '@/lib/db/contributors'
import { NextRequest, NextResponse } from 'next/server'

// PATCH { action: 'deactivate' } | { role?, hourly_rate_gbp?, is_active? }
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { ok, response: authResponse, supabase } = await getAuthenticatedSupabase()
    if (!ok) return authResponse
    const { id } = await params
    const body = await request.json()

    if (body.action === 'deactivate') {
      const contributor = await deactivateContributor(id, supabase)
      return NextResponse.json({ contributor })
    }

    const patch: { role?: string | null; hourly_rate_gbp?: number; is_active?: boolean } = {}
    if ('role' in body) patch.role = body.role ?? null
    if ('hourly_rate_gbp' in body && body.hourly_rate_gbp != null) {
      const rate = Number(body.hourly_rate_gbp)
      if (Number.isNaN(rate) || rate < 0) return NextResponse.json({ error: 'hourly_rate_gbp must be a non-negative number' }, { status: 400 })
      patch.hourly_rate_gbp = rate
    }
    if ('is_active' in body) patch.is_active = !!body.is_active
    const contributor = await updateContributor(id, patch, supabase)
    return NextResponse.json({ contributor })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to update contributor' }, { status: 500 })
  }
}
