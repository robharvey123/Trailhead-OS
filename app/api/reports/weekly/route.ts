import { NextResponse } from 'next/server'
import { anthropic, ANTHROPIC_MODELS } from '@/lib/anthropic/client'
import { getAuthenticatedSupabase } from '@/lib/api/auth'
import { getWeeklyReportData, type WeeklyReportData } from '@/lib/db/weekly-report'
import { renderWeeklyReportPdf } from '@/lib/pdf/WeeklyReportPDF'

async function generateNarrative(data: WeeklyReportData): Promise<string> {
  const prompt = `You are the AI assistant for Trailhead OS, Rob Harvey's personal business operating system.

Write a concise weekly briefing (150-250 words) for the week of ${data.weekLabel}. Use a professional but direct tone — no fluff.

Here are the numbers:
- Open tasks: ${data.taskSummary.total}
- Completed this week: ${data.taskSummary.completed}
- New tasks added: ${data.taskSummary.added}
- Overdue: ${data.taskSummary.overdue}
- Due soon: ${data.taskSummary.dueSoon}

Workstream breakdown:
${data.workstreams.map((ws) => `- ${ws.label}: ${ws.openTasks} open, ${ws.completedThisWeek} completed, ${ws.overdue} overdue`).join('\n')}

Active projects:
${data.projectSummary.map((p) => `- ${p.name} (${p.workstream_label ?? 'No workstream'}): ${p.completed_task_count}/${p.task_count} tasks done${p.next_milestone ? `, next milestone: ${p.next_milestone}` : ''}`).join('\n')}

Structure: Start with headline summary, then highlight workstreams that need attention (overdue tasks, stalled projects), close with one or two priorities for next week. No bullet points — write in short paragraphs.`

  try {
    const response = await anthropic.messages.create({
      model: ANTHROPIC_MODELS.SONNET,
      // Sonnet 5 thinks by default and thinking shares max_tokens with the answer.
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
    })

    const block = response.content[0]
    if (block.type === 'text') return block.text
    return ''
  } catch {
    return ''
  }
}

export async function GET(request: Request) {
  const auth = await getAuthenticatedSupabase()
  if (!auth.ok) return auth.response!

  const url = new URL(request.url)
  const format = url.searchParams.get('format')
  const includeNarrative = url.searchParams.get('narrative') !== 'false'

  const data = await getWeeklyReportData(auth.supabase)

  if (includeNarrative) {
    data.narrative = await generateNarrative(data)
  }

  if (format === 'pdf') {
    const buffer = await renderWeeklyReportPdf(data)

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="weekly-report-${data.startDate}.pdf"`,
      },
    })
  }

  return NextResponse.json(data)
}
