import { NextRequest } from 'next/server'
import { validateCoworkToken } from '@/lib/cowork-auth'
import { formatEnquiry, jsonError, parseEnquiryStatus, parseLimit } from '@/lib/cowork-api'
import { supabaseService } from '@/lib/supabase/service'

export async function GET(request: NextRequest) {
  if (!validateCoworkToken(request)) {
    return Response.json({ error: 'Unauthorised' }, { status: 401 })
  }

  try {
    const searchParams = request.nextUrl.searchParams
    const status = parseEnquiryStatus(searchParams.get('status'))
    const limit = parseLimit(searchParams.get('limit'), 10, 100)

    const { data, error } = await supabaseService
      .from('enquiries')
      .select('id, biz_name, contact_name, contact_email, contact_phone, biz_type, project_type, top_features, pain_points, timeline, budget, status, created_at')
      .eq('status', status)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      throw error
    }

    return Response.json((data ?? []).map((row) => formatEnquiry(row as never)))
  } catch (error) {
    return jsonError(error, 'Failed to load enquiries')
  }
}
