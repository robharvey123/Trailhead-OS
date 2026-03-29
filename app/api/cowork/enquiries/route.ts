import { NextRequest, NextResponse } from 'next/server'
import { jsonError, mapEnquiry, parseEnquiryStatus, requireCoworkAuth } from '@/lib/cowork-api'
import { supabaseService } from '@/lib/supabase/service'

export async function GET(request: NextRequest) {
  const unauthorised = requireCoworkAuth(request)
  if (unauthorised) {
    return unauthorised
  }

  try {
    const searchParams = request.nextUrl.searchParams
    const status = parseEnquiryStatus(searchParams.get('status'))
    const limitParam = searchParams.get('limit')
    const limit = limitParam ? Number(limitParam) : 10

    if (!Number.isInteger(limit) || limit < 1) {
      return NextResponse.json({ error: 'limit must be a positive integer' }, { status: 400 })
    }

    const { data, error } = await supabaseService
      .from('enquiries')
      .select('id, biz_name, contact_name, biz_type, team_size, top_features, pain_points, timeline, budget, status, created_at')
      .eq('status', status)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      throw error
    }

    return NextResponse.json((data ?? []).map((row) => mapEnquiry(row)))
  } catch (error) {
    return jsonError(error, 'Failed to load enquiries')
  }
}
