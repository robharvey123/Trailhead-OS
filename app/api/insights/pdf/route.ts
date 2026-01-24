import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { getInsightsData } from '@/lib/insights/data'
import type { InsightsNarrative } from '@/lib/insights/narrative'
import { renderInsightsPdf } from '@/lib/insights/pdf'

const PdfRequestSchema = z.object({
  workspaceId: z.string().uuid(),
  brand: z.string().optional().default(''),
  start: z.string().optional().default(''),
  end: z.string().optional().default(''),
  reportType: z.enum(['exec', 'detailed']).optional().default('exec'),
  includeFinancials: z.boolean().default(false),
  report: z
    .object({
      title: z.string().optional(),
      summary: z.string().optional(),
      highlights: z.array(z.string()).optional(),
      risks: z.array(z.string()).optional(),
      actions: z.array(z.string()).optional(),
    })
    .optional(),
})

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const parsed = PdfRequestSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }

  const { workspaceId, brand, start, end, report } = parsed.data

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

    const narrative = (report
      ? {
          title: report.title ?? 'Monthly S&OP summary',
          summary: report.summary ?? '',
          highlights: report.highlights ?? [],
          risks: report.risks ?? [],
          actions: report.actions ?? [],
        }
      : null) as InsightsNarrative | null

    const buffer = await renderInsightsPdf(data, narrative)
    const body = new Uint8Array(buffer)

    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="snop-report.pdf"',
      },
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'PDF failed.' },
      { status: 500 }
    )
  }
}
