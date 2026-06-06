import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCurrentProfile, roleIsAdmin } from '@/lib/auth/roles'
import { signedReportUrl } from '@/lib/reports/generate'
import { EMPTY_NARRATIVE, type Narrative } from '@/lib/reports/narrative'
import ReportReviewClient from '@/components/os/engagements/ReportReviewClient'

export const dynamic = 'force-dynamic'

export default async function ReportPage({ params }: { params: Promise<{ id: string; reportId: string }> }) {
  const { id, reportId } = await params
  const supabase = await createClient()
  const profile = await getCurrentProfile(supabase)
  if (!profile) redirect('/login')
  if (!roleIsAdmin(profile.role)) redirect(`/engagements/${id}`)

  const { data: report } = await supabase
    .from('engagement_reports')
    .select('*')
    .eq('id', reportId)
    .eq('engagement_id', id)
    .maybeSingle()
  if (!report) notFound()

  const { data: engagement } = await supabase
    .from('engagements')
    .select('id, name, end_client_account_id, billed_via_account_id, currency, is_billable')
    .eq('id', id)
    .maybeSingle()

  // Suggested recipients (contacts on the client + billed-via accounts). These are
  // suggestions only — they are NOT added to the send list automatically.
  const accountIds = [engagement?.end_client_account_id, engagement?.billed_via_account_id].filter(Boolean) as string[]
  let suggested: { name: string; email: string }[] = []
  if (accountIds.length) {
    const { data: contacts } = await supabase
      .from('contacts')
      .select('name, email')
      .in('account_id', accountIds)
      .not('email', 'is', null)
    suggested = (contacts ?? []).map((c) => ({ name: c.name as string, email: c.email as string }))
  }

  // Signed URLs are re-minted on every load (they expire after an hour).
  const [pdfUrl, xlsxUrl] = await Promise.all([
    report.pdf_storage_path ? signedReportUrl(report.pdf_storage_path as string, supabase) : Promise.resolve(null),
    report.xlsx_storage_path ? signedReportUrl(report.xlsx_storage_path as string, supabase) : Promise.resolve(null),
  ])

  let sentByName: string | null = null
  if (report.sent_by) {
    const { data } = await supabase.from('profiles').select('display_name').eq('id', report.sent_by).maybeSingle()
    sentByName = (data?.display_name as string | null) ?? null
  }

  const narrative = (report.narrative_edited ?? report.narrative_json ?? EMPTY_NARRATIVE) as Narrative

  return (
    <ReportReviewClient
      engagementId={id}
      engagementName={engagement?.name ?? 'Engagement'}
      reportId={reportId}
      kind={report.kind as string}
      status={report.status as 'draft' | 'sent' | 'archived'}
      periodStart={report.period_start as string}
      periodEnd={report.period_end as string}
      narrative={narrative}
      pdfUrl={pdfUrl}
      xlsxUrl={xlsxUrl}
      recipients={(report.recipient_emails as string[]) ?? []}
      suggested={suggested}
      sentAt={(report.sent_at as string | null) ?? null}
      sentByName={sentByName}
    />
  )
}
