import { NextResponse } from 'next/server'
import { getAuthenticatedSupabase } from '@/lib/api/auth'
import { renderSeoReportPdf } from '@/lib/growth/report'

export const maxDuration = 60

/** Monthly SEO report PDF. ?month=YYYY-MM, defaulting to the previous calendar
 *  month (the month you'd be reporting on the 1st). */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ siteId: string }> }
) {
  const auth = await getAuthenticatedSupabase()
  if (!auth.ok) return auth.response

  const { siteId } = await params
  const url = new URL(request.url)
  const monthParam = url.searchParams.get('month')
  const month =
    monthParam && /^\d{4}-\d{2}$/.test(monthParam)
      ? monthParam
      : new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() - 1, 1))
          .toISOString()
          .slice(0, 7)

  try {
    const buffer = await renderSeoReportPdf(siteId, month)
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="seo-report-${month}.pdf"`,
      },
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate SEO report' },
      { status: 500 }
    )
  }
}
