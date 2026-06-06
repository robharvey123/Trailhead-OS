import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth/roles'
import { sendEmail } from '@/lib/google/gmail'
import { EMPTY_NARRATIVE, type Narrative } from './narrative'

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

const BUCKET = 'engagement-reports'
const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
function fmtDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}
function slug(s: string): string {
  return s.replace(/[^\w-]+/g, '_').replace(/^_+|_+$/g, '')
}

async function downloadBase64(supabase: SupabaseClient, path: string): Promise<string> {
  const { data, error } = await supabase.storage.from(BUCKET).download(path)
  if (error || !data) throw new Error(`Could not load ${path}: ${error?.message ?? 'missing'}`)
  return Buffer.from(await data.arrayBuffer()).toString('base64')
}

/**
 * Send a draft report to its recipients with the PDF + XLSX attached, via the
 * existing Gmail wrapper. Templated cover note (not LLM-drafted, for a fast and
 * predictable send). Stamps the send audit fields. Admin-only; never auto-sends —
 * always called from an explicit user action.
 */
export async function sendReport(reportId: string, client?: SupabaseClient): Promise<{ messageId: string | null }> {
  const supabase = client ?? (await createClient())
  const admin = await requireAdmin(supabase)

  const { data: report, error } = await supabase
    .from('engagement_reports')
    .select('id, engagement_id, kind, period_start, period_end, status, pdf_storage_path, xlsx_storage_path, recipient_emails, narrative_json, narrative_edited')
    .eq('id', reportId)
    .maybeSingle()
  if (error || !report) throw new Error('Report not found')
  if (report.status === 'sent') throw new Error('This report has already been sent.')

  const recipients = (report.recipient_emails as string[]) ?? []
  if (recipients.length === 0) throw new Error('Add at least one recipient before sending.')
  if (!report.pdf_storage_path || !report.xlsx_storage_path) throw new Error('Report files are missing — regenerate the report first.')

  const { data: eng } = await supabase.from('engagements').select('name, code').eq('id', report.engagement_id).maybeSingle()
  const engName = (eng?.name as string) ?? 'the engagement'
  const code = (eng?.code as string | null) ?? 'report'

  const narrative = ((report.narrative_edited ?? report.narrative_json ?? EMPTY_NARRATIVE) as Narrative)
  const execSummary = narrative.executive_summary?.trim() ?? ''
  const kindWord = report.kind === 'monthly_client' ? 'monthly' : 'weekly'

  // First name from the first recipient's contact record; else "there".
  let firstName = 'there'
  const { data: contact } = await supabase.from('contacts').select('name').eq('email', recipients[0]).maybeSingle()
  if (contact?.name) firstName = String(contact.name).trim().split(/\s+/)[0]

  const [pdfB64, xlsxB64] = await Promise.all([
    downloadBase64(supabase, report.pdf_storage_path as string),
    downloadBase64(supabase, report.xlsx_storage_path as string),
  ])

  const subject = `Trailhead Holdings · ${engName} ${kindWord} report · ${report.period_start} to ${report.period_end}`
  const body =
    `<p>Hi ${esc(firstName)},</p>` +
    `<p>Please find attached the ${kindWord} report for ${esc(engName)}, covering ${fmtDate(report.period_start as string)} to ${fmtDate(report.period_end as string)}.</p>` +
    (execSummary ? `<p><strong>Headline summary:</strong><br/>${esc(execSummary)}</p>` : '') +
    `<p>A detailed timesheet is also attached for your records.</p>` +
    `<p>Happy to walk through anything on a call.</p>` +
    `<p>Best,<br/>Rob Harvey<br/>Trailhead Holdings Ltd</p>`

  const stamp = `${slug(code)}_${report.period_start}_${report.period_end}`
  const result = await sendEmail({
    to: recipients.join(', '),
    subject,
    body,
    attachments: [
      { filename: `${stamp}_report.pdf`, contentType: 'application/pdf', dataBase64: pdfB64 },
      { filename: `${stamp}_timesheet.xlsx`, contentType: XLSX_MIME, dataBase64: xlsxB64 },
    ],
  })

  const messageId = (result.data?.id as string | undefined) ?? null
  await supabase
    .from('engagement_reports')
    .update({ status: 'sent', sent_at: new Date().toISOString(), sent_to_message_id: messageId, sent_by: admin.id })
    .eq('id', reportId)

  return { messageId }
}
