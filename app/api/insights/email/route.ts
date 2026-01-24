import { NextResponse } from 'next/server'
import { z } from 'zod'
import { Resend } from 'resend'
import { createClient } from '@/lib/supabase/server'
import { getInsightsData } from '@/lib/insights/data'
import { generateInsightsNarrative } from '@/lib/insights/narrative'
import { renderInsightsPdf } from '@/lib/insights/pdf'

const EmailRequestSchema = z.object({
  workspaceId: z.string().uuid(),
  brand: z.string().optional().default(''),
  start: z.string().optional().default(''),
  end: z.string().optional().default(''),
  reportType: z.enum(['exec', 'detailed']),
  includeFinancials: z.boolean().default(false),
  recipients: z.array(z.string().email()).min(1),
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
  const parsed = EmailRequestSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }

  const {
    workspaceId,
    brand,
    start,
    end,
    reportType,
    includeFinancials,
    recipients,
    report,
  } = parsed.data

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

  const resendKey = process.env.RESEND_API_KEY
  const fromAddress =
    process.env.RESEND_FROM_EMAIL ?? 'Rush Analytics <reports@example.com>'

  if (!resendKey) {
    return NextResponse.json(
      { error: 'RESEND_API_KEY is not configured.' },
      { status: 500 }
    )
  }

  try {
    const data = await getInsightsData({
      supabase,
      workspaceId,
      brand,
      start,
      end,
    })

    const narrative = report
      ? {
          title: report.title ?? 'Monthly S&OP summary',
          summary: report.summary ?? '',
          highlights: report.highlights ?? [],
          risks: report.risks ?? [],
          actions: report.actions ?? [],
        }
      : await generateInsightsNarrative({
          data,
          reportType,
          includeFinancials,
        })

    const buffer = await renderInsightsPdf(data, narrative)
    const periodLabel = data.start || data.end
      ? `${data.start || 'start'}-${data.end || 'latest'}`
      : 'all-months'
    const filename = `snop-report-${periodLabel}.pdf`

    const resend = new Resend(resendKey)

    await resend.emails.send({
      from: fromAddress,
      to: recipients,
      subject: `S&OP Report${data.brand ? ` - ${data.brand}` : ''}`,
      text: narrative.summary || 'Attached is your S&OP report PDF.',
      attachments: [
        {
          filename,
          content: buffer.toString('base64'),
        },
      ],
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Email failed.' },
      { status: 500 }
    )
  }
}
