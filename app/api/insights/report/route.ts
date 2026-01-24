import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { getInsightsData } from '@/lib/insights/data'
import { generateInsightsNarrative } from '@/lib/insights/narrative'

const ReportRequestSchema = z.object({
  workspaceId: z.string().uuid(),
  brand: z.string().optional().default(''),
  start: z.string().optional().default(''),
  end: z.string().optional().default(''),
  reportType: z.enum(['exec', 'detailed']),
  includeFinancials: z.boolean().default(false),
})

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const parsed = ReportRequestSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }

  const { workspaceId, brand, start, end, reportType, includeFinancials } =
    parsed.data

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  const { data: member } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!member) {
    return NextResponse.json({ error: 'Workspace access denied.' }, { status: 403 })
  }

  try {
    const data = await getInsightsData({
      supabase,
      workspaceId,
      brand,
      start,
      end,
    })

    const report = await generateInsightsNarrative({
      data,
      reportType,
      includeFinancials,
    })

    return NextResponse.json({ report })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Report failed.' },
      { status: 500 }
    )
  }
}
