import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth/roles'
import { gatherReportData, londonWeekRange, londonMonthRange, type ReportData } from './data'
import { generateNarrative, EMPTY_NARRATIVE, type Narrative } from './narrative'
import { renderReportPdf } from './pdf'
import { buildReportXlsx } from './xlsx'

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

const BUCKET = 'engagement-reports'
const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
const DAILY_LIMIT = 10 // per engagement per day — stops runaway regeneration

export type ReportKind = 'weekly_internal' | 'weekly_client' | 'monthly_client'

/** Resolve the period for a kind when not explicitly supplied. */
export function defaultPeriod(kind: ReportKind): { start: string; end: string } {
  if (kind === 'monthly_client') return londonMonthRange(-1) // previous calendar month
  return londonWeekRange(0) // current week
}

function pdfPath(engagementId: string, reportId: string) {
  return `${engagementId}/${reportId}/report.pdf`
}
function xlsxPath(engagementId: string, reportId: string) {
  return `${engagementId}/${reportId}/timesheet.xlsx`
}

async function uploadArtifacts(
  supabase: SupabaseClient,
  engagementId: string,
  reportId: string,
  data: ReportData,
  narrative: Narrative,
  kind: ReportKind
) {
  const [pdf, xlsx] = await Promise.all([renderReportPdf(data, narrative, kind), buildReportXlsx(data)])
  const pPath = pdfPath(engagementId, reportId)
  const xPath = xlsxPath(engagementId, reportId)
  const up1 = await supabase.storage.from(BUCKET).upload(pPath, pdf, { contentType: 'application/pdf', upsert: true })
  if (up1.error) throw new Error(up1.error.message || 'Failed to upload PDF')
  const up2 = await supabase.storage.from(BUCKET).upload(xPath, xlsx, { contentType: XLSX_MIME, upsert: true })
  if (up2.error) throw new Error(up2.error.message || 'Failed to upload timesheet')
  return { pPath, xPath }
}

/**
 * Generate (or regenerate) a draft report for an engagement + period: gather
 * data → LLM narrative → render PDF + XLSX → upload → upsert the row. Idempotent
 * per (engagement, kind, period_start). Returns the report id.
 *
 * Never sends. Recipients are NOT auto-populated (a draft must be reviewed and
 * recipients explicitly added before send — see the review screen).
 */
export async function generateEngagementReport(
  input: { engagementId: string; kind: ReportKind; periodStart?: string; periodEnd?: string },
  client?: SupabaseClient
): Promise<string> {
  const supabase = client ?? (await createClient())
  const admin = await requireAdmin(supabase)

  const period = input.periodStart && input.periodEnd
    ? { start: input.periodStart, end: input.periodEnd }
    : defaultPeriod(input.kind)

  // Rate limit (per engagement per day).
  const since = new Date()
  since.setHours(0, 0, 0, 0)
  const { count } = await supabase
    .from('engagement_reports')
    .select('id', { count: 'exact', head: true })
    .eq('engagement_id', input.engagementId)
    .gte('created_at', since.toISOString())
  if ((count ?? 0) >= DAILY_LIMIT) {
    throw new Error(`Report generation limit reached for this engagement today (${DAILY_LIMIT}/day).`)
  }

  const data = await gatherReportData(input.engagementId, period.start, period.end, supabase)
  let narrative: Narrative
  try {
    narrative = await generateNarrative(data, { tone: 'consulting' })
  } catch {
    // Don't block the draft on an LLM miss — create it with an empty narrative the
    // user can write/regenerate from the review screen.
    narrative = EMPTY_NARRATIVE
  }

  const numbers = {
    total_hours: data.hours_summary.total,
    billable_hours: data.hours_summary.billable,
    total_value_gbp: data.engagement.is_billable ? data.totals.value_gbp : 0,
    task_count_completed: data.tasks_completed.length,
  }

  // Idempotent per (engagement, kind, period_start): reuse an existing draft.
  const { data: existing } = await supabase
    .from('engagement_reports')
    .select('id, status')
    .eq('engagement_id', input.engagementId)
    .eq('kind', input.kind)
    .eq('period_start', period.start)
    .maybeSingle()

  let reportId: string
  if (existing) {
    reportId = existing.id as string
    const { error } = await supabase
      .from('engagement_reports')
      .update({ narrative_json: narrative, narrative_edited: null, period_end: period.end, ...numbers })
      .eq('id', reportId)
    if (error) throw new Error(error.message || 'Failed to update report')
  } else {
    const { data: row, error } = await supabase
      .from('engagement_reports')
      .insert({
        engagement_id: input.engagementId,
        kind: input.kind,
        period_start: period.start,
        period_end: period.end,
        status: 'draft',
        narrative_json: narrative,
        created_by: admin.id,
        ...numbers,
      })
      .select('id')
      .single()
    if (error) throw new Error(error.message || 'Failed to create report')
    reportId = row.id as string
  }

  const { pPath, xPath } = await uploadArtifacts(supabase, input.engagementId, reportId, data, narrative, input.kind)
  await supabase.from('engagement_reports').update({ pdf_storage_path: pPath, xlsx_storage_path: xPath }).eq('id', reportId)

  return reportId
}

/**
 * Re-render the PDF from the current (edited) narrative after a save. The XLSX is
 * data-only and unaffected by narrative edits, so it's left as-is.
 */
export async function rerenderReportPdf(reportId: string, client?: SupabaseClient): Promise<void> {
  const supabase = client ?? (await createClient())
  await requireAdmin(supabase)

  const { data: report, error } = await supabase
    .from('engagement_reports')
    .select('id, engagement_id, kind, period_start, period_end, narrative_json, narrative_edited')
    .eq('id', reportId)
    .maybeSingle()
  if (error || !report) throw new Error('Report not found')

  const data = await gatherReportData(report.engagement_id as string, report.period_start as string, report.period_end as string, supabase)
  const narrative = (report.narrative_edited as Narrative | null) ?? (report.narrative_json as Narrative | null) ?? EMPTY_NARRATIVE
  const pdf = await renderReportPdf(data, narrative, report.kind as ReportKind)
  const up = await supabase.storage.from(BUCKET).upload(pdfPath(report.engagement_id as string, reportId), pdf, { contentType: 'application/pdf', upsert: true })
  if (up.error) throw new Error(up.error.message || 'Failed to re-render PDF')
}

/** Mint a fresh 1-hour signed URL for an artifact path (preview/download). */
export async function signedReportUrl(path: string, client?: SupabaseClient): Promise<string | null> {
  const supabase = client ?? (await createClient())
  const { data } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600)
  return data?.signedUrl ?? null
}
